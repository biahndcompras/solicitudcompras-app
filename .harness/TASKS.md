---
schemaVersion: 1
tipo: mapa-vivo
proposito: "Única fuente de verdad de qué está listo, qué está a medias y qué falta."
autoridad: "Este documento reemplaza a STATE.md y HANDOFF.md como fuente de estado operativo."
ultima_verificacion: 2026-10-02
commit_verificado: b28c5cd
---

# Mapa vivo del Portal de Compras BIA

> **Este archivo es la lista oficial de tareas.** Toda tarea o subtarea nueva se registra acá,
> sin excepción. Ningún otro archivo las sostiene: ni `specs/`, ni los `assessment.md`, ni
> los checklists de QA.
>
> **Cómo usar este documento.** Es lo único que hay que leer para saber dónde está el proyecto.
> Si algo no está acá, no existe como tarea. Si algo está acá y ya se hizo, se borra (no se
> tacha: queda en git).
>
> **Regla de actualización:** al cerrar un bloque de trabajo, se actualiza la fila **en el
> mismo commit que el código**. Sin evidencia (commit, test, captura), no se marca.
>
> **Una tarea se describe UNA sola vez. §4 es el único lugar donde vive su estado.** §7.1
> referencia por número. §11 es la vista por rol: dice si una FUNCIÓN está lista, y para eso
> referencia el número de §4 — si al cerrar una tarea de §4 una fila de §11 la menciona, hay
> que revisar esa fila en el mismo commit. Esto no es estilo: tener el mismo ítem en
> tres tablas hizo que se contradijeran entre sí tres veces (§4 decía RESUELTO y §7.1 decía
> FALTA), y cada contradicción se descubre tarde. Los `specs/*/tasks.md` son **históricos**.
>
> **Regla de honestidad:** distingo siempre entre *verificado hoy* (lo corrí), *reportado por
> documentación* (puede estar viejo) y *inferido*. No marco nada como listo sin haberlo visto.

---

## 0. Estado real en una línea

El producto **funciona de punta a punta** y está verificado. Los **6 problemas críticos** que
encontró la verificación contra código (§11) **están cerrados**:

- ~~B3 no se valida en el servidor~~ → ✅ sin recomendación, la ruta devuelve **409** y no transiciona (4.7.1).
- ~~`GET /api/solicitudes/[id]` sin autenticación~~ → ✅ `guardApi(["coordinador","admin"])` (4.8.1).
- ~~Sin aislamiento entre coordinadores~~ → ✅ **Q2 resuelta** (se ven entre ellos, no era bug) + pertenencia en las escrituras de cotizaciones (4.8.3).
- ~~Correo 4 nunca se envía~~ → ✅ al coordinador asignado, tras cerrar la solicitud (4.9.2).
- ~~"Ninguna me sirve" cierra la solicitud~~ → ✅ reabre en `EN_COTIZACION` (4.7.3).
- ~~El correo 1 cae al propio solicitante~~ → ✅ al coordinador asignado o al alias (4.9.1).

Lo que queda **no son bugs conocidos**, sino tres cosas distintas: **bloqueantes del cliente**
(§1), **trabajo de producto** (§4) y **deuda de proceso/documental** (§6). El estado medido está
en §2 y el orden sugerido en §10.

`.harness/STATE.md` y `.harness/HANDOFF.md` ya no son fuente de estado: el primero es un
puntero a este archivo y el segundo quedó marcado como histórico.

---

## 1. BLOQUEANTES — hacer antes de producción

Ordenados por gravedad. Ninguno es código nuestro: dos son del cliente, uno es higiene nuestra.

| # | Tarea | Quién | Por qué importa | Dónde está registrado |
|---|---|---|---|---|
| ~~**B1**~~ | ~~Rotar la contraseña de Postgres y migrar a Supabase Cloud~~ | ✅ **RESUELTO 2026-10-21** | Contraseña reseteada y base migrada **en limpio** (decisión del usuario). `DROP SCHEMA public CASCADE` + las **21 migraciones**: 18 tablas, **RLS 18/18**, 7 usuarios del equipo, 24 campos de catálogo y 3 plantillas. PostgREST sigue cerrado (lectura y escritura anónimas → **401**). La app se verificó contra la nube: login real, dashboard leyendo, y un alta de solicitud escrita y borrada. Los tests corren contra la base **local** (`TEST_DATABASE_URL`), no contra la del piloto. **Pendiente de despliegue**: cargar `DATABASE_URL` y las claves en Vercel (no están en el repo) |
| ~~**B2**~~ | ~~Verificar el dominio de correo en Resend~~ | ✅ **RESUELTO 2026-10-14** | Dominio `biahnd.website` verificado (status `verified`). `MAIL_FROM` apunta a él. **Verificado end-to-end por la aplicación**: el correo 6 salió `enviado` en la bitácora y Resend lo reporta `delivered`. Los envíos anteriores fallaban con "The compras.bia domain is not verified" |
| ~~**B3**~~ | ~~Aceptación por escrito del riesgo del link público~~ | ✅ **RESUELTO 2026-10-14** | Aceptado por escrito por Compras (**Ladi Matute**), registrado en `docs/decisions/0007-riesgo-link-publico.md` con las mitigaciones vigentes (token de 12 bytes, expiración configurable, la decisión solo se acepta en `ENVIADA_A_SOLICITANTE`, no se indexa). Este renglón quedó viejo y lo corregí al revisar la deriva del documento |
| **B4** | Obtener confirmación escrita de las 6 decisiones D1/D2/D3/D7/D9/D10 | **Cliente** 🟠 | Sin esto el piloto arranca sobre base no aprobada. El documento mismo dice *"se requiere confirmación por escrito"*. | `propuesta-decisiones-piloto.md:5, 26-38` |
| **B5** | **Aplicar la migración 020 en el proyecto de Supabase** (RLS deny-all) | **Nosotros** 🔴 | **La base de Supabase estaba abierta de par en par**: el esquema `public` expuesto por PostgREST con RLS desactivado y `anon`/`authenticated` con privilegios por defecto. La `anon` key **viaja al navegador**, así que cualquiera en Internet podía **leer y escribir** todas las tablas. Verificado con peticiones reales el 2026-10-16: `usuario` devolvía **7 filas** (correos y roles del equipo), y un `POST` anónimo devolvía **201**. **La migración `020_rls_deny_all.sql` ya está escrita y probada en local** (RLS en 18/18 tablas; un rol con `GRANT` y sin ser dueño ve 0 filas donde antes veía 13; 510/510 tests siguen pasando). **Falta correrla en Supabase** (SQL Editor del dashboard) — es lo único de esta lista que no puedo cerrar yo y que debería hacerse **ya**. Ver §4.8 | Linter de Supabase: `rls_disabled_in_public`, `sensitive_columns_exposed` |

De los 4, **solo B4 sigue abierto**: la confirmación por escrito de las decisiones del piloto,
que la da el cliente. **B1, B2 y B3 ya están resueltos.** Ninguno es código nuestro.

---

## 2. Lo que está listo y verificado

Verificado hoy por mí salvo donde se indica otra cosa.

### Ciclo completo (una solicitud real, de punta a punta)
- Solicitante crea → clasifica (IA) → assessment → genera PDF → envía → llega a la bandeja del coordinador.
- Coordinador ve bandeja, carga cotizaciones, extrae con IA, genera comparativa, recomienda, manda enlace.
- Solicitante decide por token público; la solicitud cierra.
- Admin ve KPIs reales, alertas, exporta Excel.

### Calidad actual (medido 2026-10-15, `146e20f`)
| Batería | Resultado |
|---|---|
| Tests unitarios + integración | **505 pasan** (58 archivos) con `DATABASE_URL`; los de integración se omiten si no está |
| `tsc --noEmit` | limpio |
| `eslint` | **0 errores** (con algunos warnings) |
| Migraciones | **20 en disco, 20 aplicadas** — sin divergencia |
| Higiene de la base de tests | ✅ `vitest.global-setup.ts` deja **0** residuos (antes 1232 filas). Ver 4.10.13 |
| e2e (Playwright) | 5 specs existen. **NO los re-corrí**; última cifra registrada 22/22 (`e8ff42b`) |

### Features cerradas con gates y evidencia
| Feature | Estado | Evidencia |
|---|---|---|
| `000-sprint0-backend-base` | código hecho, cierre sin evidencia real | ⚠️ ver §8 |
| `001-frontend-prototype` | código hecho, cierre sin evidencia real | ⚠️ ver §8 |
| `002-backend-api` | código hecho, cierre sin evidencia real | ⚠️ ver §8 |
| `003-design-enterprise` | código hecho | ❌ **le faltan plan.md y verification.md** |
| `004-pdf-correos` | código hecho, cierre sin evidencia real | ⚠️ ver §8 |
| `005-auth-supabase` | código hecho, cierre sin evidencia real | ⚠️ ver §8 |
| `006-ia-integracion` | ✅ **G5/G6 con evidencia** | 19/19 tareas, e2e 21/21 |
| `007-sprint3-ia-comparativa` | ✅ **G5/G6 con evidencia** | 15/15 tareas, Excel 3 hojas verificado |
| `008-sprint4-dashboard-alertas` | ✅ **G5/G6 con evidencia** | 15/15 tareas, e2e 22/22 |

**Conclusión honesta:** 000–005 están terminadas *en código* pero su documentación dice lo
contrario (5 `verification.md` afirman literalmente *"Implementation is prohibited until G1, G2, G3 and G4 have explicit human approval"*). No es trabajo faltante: es deuda documental. Ver §8.

### Lo que hicimos en esta sesión
| Bloque | Qué resuelve | Commit |
|---|---|---|
| Assessment: obligatorios forzados, aviso al enviar, `contexto_investigado` visible, dedupe de preguntas duplicadas | El RFQ llegaba al coordinador sin fecha ni condiciones de pago; la IA se saltaba campos obligatorios; `contexto_investigado` estaba declarado en el schema pero nunca se pidió ni se renderizó | `6dc64d5` |
| Migración `017` | `forma_pago` → obligatorio | `6dc64d5` |
| Gate de envío + remediación de auditoría UX + idempotencia | Si el assessment falla, el RFQ salía vacío sin aviso. El envío creaba duplicados ante reintento. | `b28c5cd` |

**Working tree limpio** al cierre de la sesión.

---

## 3. Trabajo que estaba sin registrar — YA COMMITEA

**Resuelto en `b28c5cd`.** El working tree quedó limpio. Antes de ese commit había 9 piezas de
funcionalidad en producción que no estaban en ningún spec: tenían consumidores reales, estaban
probadas, y no aparecían en ningún `tasks.md` ni `assessment.md`.

El verdadero registro de ese trabajo era
`qa/evidencia-piloto/critique-solicitante/AUDIT-SOLICITANTES.md`, un archivo fuera del ciclo
de Spec Kit. Sus etiquetas (`P1-b`, `P2-c`, `P3-d`) no existen en `specs/`. **Ahora está
versionado** y referenciado desde acá.

| Pieza | Qué resuelve | Estado |
|---|---|---|
| `migrations/016` idempotencia | El envío son 3 llamadas encadenadas; un reintento o refresh creaba solicitudes duplicadas | ✅ `b28c5cd` |
| `lib/domain/moneda.ts` | La comparativa pedía comparar importes no comparables (USD vs HNL) | ✅ `b28c5cd` — **sin test propio, ver 6.13** |
| `lib/domain/archivos.ts` | Anti-subida: magic bytes, sin `.svg`, 4 MB, PDF truncado | ✅ `b28c5cd` + test |
| `lib/enlaces-decision.ts` + `CTADecision.tsx` | CTA honesto: no promete un enlace no abierto; el token no viaja por API | ✅ `b28c5cd` |
| `app/guias/manual-solicitante/page.tsx` | Ruta servida desde el `.md`, 5 puntos de entrada | ✅ `b28c5cd` |
| 4 archivos de tests nuevos | Estado, idempotencia, adjuntos, autoguardado | ✅ `b28c5cd` |

**Pendiente de esta sección:** nada, salvo la tarea 6.13.

## 4. Pendientes de producto — requisito aprobado, NO cumplido

Esto sí es trabajo real. Ordenado por tema. Las referencias `RF-xx` son del PRD
(`docs/product/prd.md`), que es la fuente autoritativa de producto.

### 4.1 RFQ / RFI / RFP — referencia y PDF
| # | Tarea | Ref | Nota |
|---|---|---|---|
| ~~4.1.1~~ | La referencia se leía distinto según el rol | ✅ **RESUELTO 2026-10-14** | El generador **funciona** (236 solicitudes la tienen; las 93 sin referencia son datos de agosto, anteriores al generador). El bug era de pantalla: el admin **fabricaba** `SOL-<8 del id>` mientras el coordinador decía "Sin referencia". Inventar una referencia es peor que no mostrarla: parece real y no existe. Ahora las 5 pantallas dicen lo mismo y ninguna inventa. Verificado en navegador |
| 4.1.2 | **PDF con el diseño vertical oficial** | — | `plantilla-generica.ts` tiene membrete BIA pero no el formato exacto del RFQ de Ladi. Depende de insumos del cliente. |

### 4.2 Comparativa y ahorro
| # | Tarea | Ref | Nota |
|---|---|---|---|
| ~~4.2.1~~ | ~~Ahorro potencial en los pros~~ | ✅ **RESUELTO 2026-10-14** | Era el mismo defecto que 4.10.7: la fusión reemplazaba los pros deterministas cuando la IA respondía, y el ahorro (que es determinista) desaparecía. Ahora `comparativa.ts` fusiona ambos con `new Set([...det.contras, ...iaPC.contras])` y su equivalente en pros. Verificado leyendo el código al revisar la deriva |
| ~~4.2.2~~ | ~~Producto/servicio + detalle en la comparativa~~ | ✅ **RESUELTO 2026-10-20** | El glosario define la comparativa como "el producto/servicio a la izquierda y un proveedor por columna" (y RF-36 lo pide en el Excel), pero **ninguno de los tres artefactos decía qué se estaba comparando**: ni la pantalla del coordinador, ni la hoja "Comparativo" del Excel, ni la vista pública del enlace. Ahora los tres encabezan con el tipo (`etiquetaSubtipo`), el título y el detalle. Sin subtipo dice **"No especificado"**, no se inventa. Verificado en navegador en las dos superficies (coordinador etapa 08 y enlace público) y con tests en rojo contra el código anterior |
| 4.2.3 | Alertas por tipo (sin desglose, discrepancia, una sola cotización) | RF-54 / H4.4 | Diferido a Fase 3. |

### 4.3 Flujo de re-cotización
| # | Tarea | Ref | Nota |
|---|---|---|---|
| ~~4.3.1~~ | ~~Re-cotización del solicitante~~ | **DECIDIDO: no implementar por ahora** (2026-10-14) | **Su necesidad ya está cubierta**: el botón "Ninguna me sirve" devuelve la solicitud a Compras con el motivo, y *eso es* el pedido de re-cotización del solicitante. Agregar además un botón que reabra cotizaciones le daría poder de mover el proceso de Compras, y el flujo todavía **no tiene login**: cualquiera con su correo podría dispararlas. Reconsiderar cuando exista el login del solicitante (`docs/references/login-solicitante.md`) |

### 4.4 Administración (Sprint 4 residual)
| # | Tarea | Ref | Nota |
|---|---|---|---|
| ~~4.4.1a~~ | ~~La solicitud conserva su versión de origen~~ | **HECHO** (2026-10-15) | El esquema ya tenía `solicitud.plantilla_id` y `plantilla.version`, pero la referencia **nunca se escribía: 0 de 1053 solicitudes**. Ahora el POST la resuelve por `(tipo, subtipo, categoría)` en el servidor (no desde el cliente, que podría mentir) y `obtenerPlantillaPara` devuelve también la versión. **Falta 4.4.1b** |
| 4.4.1b | **RF-54 — versionado al EDITAR una plantilla** | RF-54 | **Bloqueada**: no existe UI para editar plantillas (solo campos sueltos en `/admin/campos`), así que no hay ediciones que versionar. Al crear esa UI hay que subir `plantilla.version` en vez de reescribir la fila, o las solicitudes viejas dejarían de conservar su origen. ⚠️ **Dos trampas medidas** (QA 2026-10-15): (1) `listarCamposDePlantilla` **no tiene `LIMIT`**: si quedan dos plantillas activas que matchean (una por categoría + la general `categoria IS NULL`, o dos versiones activas), **une los campos de las dos** mientras `obtenerPlantillaPara` elige **una** → el origen registrado dejaría de corresponder a los campos mostrados. Al versionar hay que hacer que ambos elijan la misma, o desactivar la versión anterior al subir. (2) `solicitud.plantilla_id` es FK **NO ACTION** (migración 004): borrar una versión referenciada **falla**, así que versionar no puede basarse en borrar la fila vieja |
| ~~4.4.2~~ | ~~**RF-56 — CRUD de coordinadores** desde la UI de admin~~ | **HECHO** (2026-10-15, `62ddc04`) | Alta/edición/baja con `guardApi(["admin"])`. **Desactivar quita el rol en Auth además de marcar `activo=false`**: verifiqué contra el Supabase real que `updateUserById({rol:null})` borra la clave (y que `app_metadata` se mergea). Sin eso, desactivar **no bloqueaba nada** (el guard solo miraba el rol de la sesión). Límite: la sesión viva sigue hasta el refresh del token. `usuarioLocalPorEmail` ahora filtra `activo`. Las categorías ya eran CRUD en `/admin/campos` |
| 4.4.3 | **H4.5 — RLS, seguridad por fila** | H4.5 | Pospuesto. **Además depende de una decisión abierta de Lady** (Q2: ¿los coordinadores ven solicitudes ajenas?). ⚠️ **No confundir con B5**: la migración 020 activa RLS **deny-all** (sin políticas) para cerrar PostgREST; eso **no** implementa 4.4.3, que son políticas por fila para cuando el acceso pase por Supabase. Son cosas distintas |
| 4.4.4 | Dashboard: distribución por subtipo, tiempo por etapa, rango personalizado | RF-51, RF-52 | "H4.1 menor". |
| 4.4.5 | Indicador de inactividad en la bandeja del coordinador | — | `user-flows.md:170` lo marca "(pendiente)". |
| 4.4.6 | Área como catálogo en vez de texto libre | — | Depende de la lista oficial de áreas de BIA. |
| ~~4.4.7~~ | Editar un campo de catálogo destruía atributos | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.4.8~~ | Crear un campo con clave existente sobrescribía en silencio | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.4.9~~ | No se podía borrar un campo | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~**4.4.10**~~ | ~~Alertas: selección por tipo y preview~~ | ✅ **RESUELTO 2026-10-18** | **Dos bugs y una falta.** (1) `discrepancia` era **código muerto**: `detectarAlertas` ya aceptaba `discrepanciasPorSolicitud`, pero la ruta nunca se lo pasaba. Ahora lo arma desde `comparativa.discrepancias_detectadas` (solo si se pide ese tipo). (2) El panel decía "N enviadas" leyendo `alertas.length` — **alertas detectadas**, no correos enviados, que podían ser 0. Ahora informa cuántos correos salieron de verdad. (3) Se agregaron **selección por tipo** y **previsualización** agrupada que no envía ni marca (el de-dup 4.11.7 quedó intacto). **Decisión del usuario: solo `inactividad` envía correo**; los otros 3 se detectan y se ven. Verificado en navegador con el admin |
| ~~**4.4.11**~~ | ~~El botón de alertas también manda los recordatorios RF-62~~ | ✅ **RESUELTO 2026-10-19** | La lógica de recordatorios estaba **duplicada**: vivía en `/api/cron/recordatorios` y, además, **dentro de la ruta de alertas**, así que "Enviar correos" mandaba recordatorios de *todas* las solicitudes sin relación con los tipos elegidos (en una prueba salió un correo real a `bbonilla@biabrands.co`). Ahora hay **una sola implementación** (`lib/mail/recordatorios.ts`) y **dos disparadores explícitos**: el cron y una acción propia del admin (`POST /api/admin/recordatorios/ejecutar`), con **preview**, confirmación que dice que son correos reales, y el botón **deshabilitado si no hay pendientes**. Verificado en navegador con el admin: "No hay recordatorios pendientes" y el botón apagado; **no se envió ningún correo** durante la verificación |

### 4.5 OCR y conversión
| # | Tarea | Ref | Nota |
|---|---|---|---|
| ~~4.5.1~~ | ~~OCR funcional en serverless~~ | ✅ **RESUELTO 2026-10-17** | `/api/convertir` dependía de `python3` + `markitdown`, que **no existen en Vercel**: en producción la conversión fallaba **siempre** y el coordinador cargaba a mano. Ahora la hace un **modelo multimodal de OpenRouter** (`lib/ai/conversion.ts`), sin binarios ni archivos temporales. Se eligió multimodal y no una librería de extracción de texto en JS porque la app acepta **PDF y también PNG/JPG**, y las cotizaciones suelen llegar **escaneadas o fotografiadas** (ahí un extractor de texto no ve nada). De paso desaparece el bug de la doble ejecución del script. **Verificado en vivo**: PDF e imagen → HTTP 200 con todos los montos; tipo no soportado → 415; si la IA falla → 503 y la pantalla degrada a carga manual |
| ~~4.5.2~~ | La fecha requerida aceptaba fechas pasadas | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.5.3~~ | La descripción no era obligatoria | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| 4.5.4 | **Retomar borrador desde P1** | medio | `app/page.tsx:22` borra el borrador antes de navegar con `?nuevo=1`, dejando el modal inalcanzable por ese camino |
| 4.5.5 | **Alinear el tope de preguntas con la norma** | bajo | `MAX_PEGUNTAS = 10`, la doc pide 6. Y puede exceder 10 cuando hay obligatorios (deliberado: preferimos exceder que truncar un obligatorio) |
| ~~4.5.6~~ | ~~Persistir las respuestas del assessment~~ | ✅ **RESUELTO 2026-10-14** | Se persisten al enviar y el coordinador las ve en "Respuestas del solicitante". Antes viajaban solo al PDF: la única forma de verlas era abrir el documento. Ver 4.10.11 |

### 4.6 Otros
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.6.1 | Mini-tracker visual compacto para el solicitante | 1.4 | Diferido. |
| 4.6.2 | Exenciones y retenciones fiscales | — | Diferido por acuerdo; **no hay reglas documentadas**. |

---

### 4.7 Integridad de RN-01 — la decisión humana no está garantizada ⚠️ CRÍTICO

Verificado leyendo el código, no la documentación. **Estos tres encontrados corrigen el mapa**:
no estaban en ninguna lista.

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| ~~**4.7.1**~~ | ~~B3 validado en el servidor~~ | ✅ **RESUELTO 2026-10-03** | `estado/route.ts:118-126`: sin recomendación (`trim()` vacío) devuelve **409** y **no transiciona, no guarda, no genera enlace**. 5 tests nuevos en `estado/route.test.ts`, 2 de ellos verificados **fallando** contra el código anterior. Reproducido en navegador con sesión real de coordinador: PATCH directo sin `nota` → 409; solo espacios → 409; con recomendación → 200 + enlace. Confirmado que la recomendación **llega al solicitante** por `/comparativa/[token]` |
| ~~**4.7.2**~~ | ~~Correo 4: decisión registrada~~ | ✅ **RESUELTO 2026-10-03** | Ver 4.9.2, que ya lo documentaba. Esta fila quedó sin actualizar y contradecía a la otra |
| ~~**4.7.3**~~ | ~~"Ninguna me sirve" reabre en `EN_COTIZACION`~~ | ✅ **RESUELTO 2026-10-03** | "Ninguna opción" devuelve la solicitud a `EN_COTIZACION` en vez de cerrarla como `CERRADA_SIN_DECISION` (que es terminal). La transición ya estaba permitida en la máquina de estados; nadie la invocaba. **Segunda mitad del bug**: el UPDATE ponía `fecha_cierre = now()` siempre, así que una solicitud reabierta quedaba con fecha de cierre y el semáforo la contaba como cerrada → ahora es condicional. La UI usa el dato real de la respuesta y deja de ofrecer tarjetas y botones muertos. Verificado contra la base real: `ENVIADA_A_SOLICITANTE` → `EN_COTIZACION` con `fecha_cierre` NULL |
| ~~**4.7.5**~~ | ~~Los tests del assessment fallan con `OPENROUTER_API_KEY` en el entorno~~ | ✅ **NO REPRODUCIBLE 2026-10-15** | Corrí la suite **completa y con la clave puesta**: 505/505 en verde. Los tests que ejercitan la IA **mockean `fetch`** (`orchestrator.test.ts`, `comparativa-ia.test.ts`), así que no hacen llamadas reales y la suite es hermética: **ya no hace falta desexportar la clave**. **Hallazgo real detrás**: el cliente de IA **no funciona bajo jsdom** — `fetch` con `AbortSignal` falla con *"Expected signal … to be an instance of AbortSignal"*. Por eso `vitest.setup.ts` dejó de asumir DOM, y un test de IA puede correr en entorno `node` (así verifiqué el prompt en vivo) |
| 4.7.6 | Limpiar la recomendación previa al regenerar la comparativa | bajo | `guardarComparativa` (`postgres-repo.ts:603-616`) hace upsert de precios/pros pero **no borra `recomendacion_comprador`**. **Riesgo contenido**: B3 fuerza una recomendación nueva en cada envío y el textarea arranca vacío, así que no puede llegar una vieja al solicitante. Es higiene, no bug vivo |
| ~~4.7.8~~ | El enlace público no se revocaba al decidir | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.7.7~~ | `clasificacion_corregida` nunca se persiste | ✅ **RESUELTO 2026-10-14** | Se perdía en **cuatro saltos**: el hook no lo mandaba, el cliente no lo declaraba, el schema del POST lo descartaba como campo desconocido, y el INSERT no escribía la columna. Toda solicitud nacía en `false`, así que la precisión del clasificador (doc 16) era incalculable. 7 tests, 6 verificados fallando |

### 4.8 Seguridad — fronteras entre roles ⚠️ CRÍTICO

`docs/product/prd.md` define un rol por persona. Estas rutas lo rompen.

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| ~~**4.8.1**~~ | ~~`GET /api/solicitudes/[id]` con autenticación~~ | ✅ **RESUELTO 2026-10-03** | `guardApi(["coordinador","admin"])`. El endpoint **no tenía consumidores** (el panel usa el repo desde el servidor), así que cerrarlo fue riesgo cero. Verificado: sin sesión → 401 y **no** devuelve los precios; con correo ajeno → 401; 4 tests verificados fallando contra el código anterior |
| ~~**4.8.2**~~ | ~~`/documento` y `/logo` verifican pertenencia~~ | ✅ **RESUELTO 2026-10-03** | Nuevo `guardRecursoDeSolicitud` en `lib/api-guard.ts`: acepta **rol de Compras o el correo dueño**, porque el solicitante ve su PDF y su logo **sin sesión** (el flujo no tiene login). El correo es la misma identidad de `/mis-solicitudes?email=`, no un mecanismo inventado. Los dos `<a href>` del solicitante ya lo envían |
| ~~**4.8.3**~~ | ~~Aislamiento horizontal en las escrituras~~ | ✅ **RESUELTO 2026-10-14** | **Q2 quedó resuelta: los coordinadores SÍ se ven entre ellos**, así que no se implementa aislamiento por fila — era una política, no un bug. Lo que **sí** era bug y se cerró: el `PATCH`/`DELETE` de cotizaciones operaba sobre cualquier cotización por su id sin comprobar que fuera de la solicitud de la URL, y el cliente mandaba un `_` literal en lugar del id real. Ahora verifica pertenencia (404) y manda el id real. 6 tests, 3 verificados fallando |
| ~~**4.8.4**~~ | ~~Bandeja: el `coordinadorId` viene de la sesión~~ | ✅ **RESUELTO 2026-10-03** | Para un coordinador el id sale de su sesión, nunca del query string: `?coordinadorId=<otro>` ya no abre la bandeja de un compañero. El admin conserva el parámetro (su vista de proceso es transversal). Nuevo `usuarioLocalPorEmail(email)` en el repo, usado por la ruta **y** por el panel, para que la lógica de identidad no se repita. **Además** se eliminó el fallback silencioso a `coordenadores[0]`: si la cuenta no está dada de alta, se responde 403 con el motivo en vez de mostrar la bandeja del primero. 4 tests, 2 verificados fallando contra el código anterior |
| ~~4.8.5~~ | guardApi inconsistente en las rutas de admin | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.8.6~~ | ~~Validación de tipo/MIME del logo en servidor~~ | ✅ **RESUELTO 2026-10-19** | El cliente validaba los magic bytes, pero **eso no es una frontera de seguridad: se salta con curl**. El POST solo miraba el tamaño, así que se podía guardar un ejecutable renombrado a `.png` o un PDF truncado. Ahora el servidor valida **extensión + contenido** (`EXTENSIONES_ACEPTADAS`, `contenidoCoincide`, `pdfLooksCompleto`) y responde **415**. Decide por extensión y bytes, **no** por el `Content-Type` declarado: ese dato es del cliente y un `application/octet-stream` rechazaría archivos válidos. El tope de 4 MB se sigue comprobando **antes** de leer los bytes. Verificado con curl: renombrado → 415, `.txt` → 415, PNG válido → 200 |
| ~~**4.8.11**~~ | ~~`POST /api/solicitudes/[id]/logo` sin autorización~~ | ✅ **RESUELTO 2026-10-15** | Cualquiera con el UUID podía **reemplazar** el material de marca de una solicitud ajena. Se le aplicó la **misma** regla que al GET (`guardRecursoDeSolicitud`): rol de Compras **o** el correo dueño. El guard corre **antes** de leer el cuerpo, para que un no autorizado no pueda mandar 4 MB. El cliente manda el correo desde el email del wizard (que ya era obligatorio: `z.string().email()` en el POST de creación), igual que `/mis-solicitudes` y la descarga. **Decisión**: la nota pedía un token de un solo uso; no se hizo porque el correo **es** la identidad de todo el flujo sin login (4.8.2 usó el mismo criterio) y un token sería un mecanismo nuevo e inconsistente. Cuando exista el login (`docs/references/login-solicitante.md`), el guard se apoya en la sesión y el token deja de hacer falta |
| ~~**4.8.7**~~ | ~~La consulta del solicitante no expone montos~~ | ✅ **RESUELTO 2026-10-14** | El detalle listaba cada proveedor **con su total**, y esa pantalla se abre **solo con el correo**. El listado ya los ocultaba a propósito (`user-flows.md:181`): era la misma información con dos criterios. Ahora muestra el conteo ("Cotizaciones recibidas: 2") y los importes se ven solo por el enlace con token. 4 tests que fijan que el HTML no contenga ningún monto, verificados fallando contra el código anterior. Nota: el hallazgo citaba **RN-06** como razón, pero RN-06 es "nunca se inventan cifras" — el porqué real es privacidad, y está en `user-flows.md:181` |
| **4.8.12** | **La base de Supabase estaba expuesta con la `anon` key** | crítica | Ver **B5** (§1). PostgREST servía `public` con RLS desactivado y `anon`/`authenticated` con privilegios por defecto: lectura y escritura anónimas de **todas** las tablas, con una clave que **se envía al navegador**. Verificado: `usuario` daba 7 filas y un `POST` anónimo daba 201. Cierre: `migrations/020_rls_deny_all.sql` (RLS deny-all en 18/18 tablas + revocar privilegios + quitar los privilegios por defecto para las tablas futuras). Probado en local. **Pendiente: correrlo en Supabase** |
| ~~**4.8.13**~~ | ~~El servidor no exige el logo cuando hay branding~~ | ✅ **RESUELTO 2026-10-21** | El wizard bloquea el envío en el cliente (`bloqueoB2Activo`), pero `POST /api/solicitudes` y el PATCH de estado **aceptan la solicitud sin logo**: se salta por API. **No es 4.8.6** (esa era validar el contenido de lo que sí se sube, ya resuelto); acá falta la **obligatoriedad**. Decidir si el servidor debe rechazar el envío o solo avisar, porque el logo depende de un paso aparte que puede fallar | ~~**4.8.13**~~ |

### 4.9 Correos — el ciclo tiene huecos

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| ~~**4.9.1**~~ | ~~Correo 1 no debe caer al solicitante~~ | ✅ **RESUELTO 2026-10-03** | Destinatario = coordinador **asignado**, y si no tiene email, el alias `MAIL_COORDINADOR_DEFAULT` (que se agregó a `.env.example`, donde nunca había estado). Si no hay ninguno, **no se envía el correo 1** y queda registrado: es preferible que Compras no reciba nada a que el solicitante reciba su propio RFQ. El correo 2 (acuse al solicitante) sigue saliendo siempre. 5 tests, 4 verificados fallando contra el código anterior |
| ~~**4.9.2**~~ | ~~Correo 4 (decisión registrada)~~ | ✅ **RESUELTO 2026-10-03** | `tipoCorreo: "4"` ya se invoca en `decision/route.ts`, **después** de cerrar la solicitud (si el correo saliera antes y la transacción fallara, se notificaría una decisión que no ocurrió). Destinatario: el coordinador asignado de la solicitud, o el alias. Nunca el solicitante. 7 tests, incluyendo que un fallo de envío no deshace la decisión ya registrada |
| ~~4.9.3~~ | El correo 3 sin trazabilidad | ✅ **RESUELTO 2026-10-14** | Ya estaba resuelto por la ronda anterior: el evento `envio_correo` se inserta en `registrarCorreo`, y el correo 3 pasa por ahí. Verificado contra el código |
| ~~4.9.4~~ | El correo 5 no llegaba al coordinador | ✅ **RESUELTO 2026-10-14** | Iba solo al destinatario global de `configuracion` —que en la base está vacío, así que **nadie más lo recibía**. Ahora va al coordinador asignado (con caída al alias) **y** a administración, deduplicando buzones. 10 tests de ruta + 3 de integración, 6 verificados fallando |
| ~~4.9.5~~ | ~~Los 8 correos salían como texto plano~~ | ✅ **RESUELTO 2026-10-21** | Ninguno tenía diseño: eran `<p>` sueltos. Ahora los **8** comparten un layout corporativo (`lib/mail/layout.ts`): logo sobre blanco servido por URL absoluta, barra de marca, píldora con la referencia, título, tabla de datos, destacados, botón y pie legal. Todo con **estilos inline y tablas** (Gmail/Outlook descartan el `<style>`). De paso se corrigió el copy: 11 strings en voseo/tú (`encontrarás`, `cargá`, `te enviaremos`, `confirmes`, `pediste`, `tuyo`). Verificado en navegador y con tests (marco, no-voseo, CTA y logo sin `APP_URL`) |

### 4.10 Reglas de negocio y trazabilidad

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| ~~**4.10.1**~~ | ~~Tasa ISV desde configuración~~ | ✅ **RESUELTO 2026-10-14** | La clave `tasa_isv` **sí existía** en `configuracion` (0.15): el problema era que el código tenía `0.15` cableado y nunca la leía. Nuevo `repo.tasaIsv()`, que valida el rango (un `15` en vez de `0.15` es el error humano típico). 2 tests de integración |
| ~~4.10.2~~ | La alerta de inactividad no podía dispararse | ✅ **RESUELTO 2026-10-14** | La condición era `!s.fechaEnvio`, imposible porque toda solicitud del panel ya fue enviada. Ahora el "último movimiento" sale del evento de trazabilidad más reciente, tomando el máximo con los hitos derivables (creación, envío, última carga de cotización). 5 tests, 2 verificados fallando |
| ~~**4.10.13**~~ | ~~Los tests de integración dejan solicitudes con `informacion_pendiente` en la base de desarrollo~~ | ✅ **RESUELTO 2026-10-15** | **Medido antes de arreglar**: 1232 solicitudes `@bia.hn` acumuladas, **262 con `informacion_pendiente = true`** (el cron de recordatorios y el botón de alertas las tomaban como reales, y ensuciaban los KPIs). `lib/db/postgres-repo.test.ts` no tenía `afterAll`. Nuevo `vitest.global-setup.ts`: barre al empezar y borra al terminar, por patrón `%@bia.hn`. **Por qué es seguro**: el dominio real del cliente es `@biabrands.co` (D1/D8) y el staff es `@biafoods.co`; verificado que no existe ningún `usuario @bia.hn` y que **ningún test que escribe en la base usa un correo real**. Residuo tras la corrida: **0**. ⚠️ Si el cliente empezara a usar `@bia.hn`, ese archivo borraría datos reales — está advertido en el propio archivo. **Pendiente menor**: quedan **30 solicitudes de e2e de septiembre** en el dominio real (`mj.e2e@biabrands.co` 29, `qa.obligatorios@` 1), con `informacion_pendiente=false`, así que no disparan correo al solicitante pero sí ensucian el KPI "sin decisión > 5 días". Los spec actuales ya no usan ese correo |
| ~~4.10.3~~ | Eventos que la UI mostraba y nadie insertaba | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.10.4~~ | Descripciones de evento que faltaban | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.10.5~~ | La transición no validaba la máquina de estados | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.10.6~~ | El Excel de comparativa salía vacío | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.10.7~~ | La fusión descartaba los pros y contras deterministas | ✅ **RESUELTO 2026-10-14** | Ver 4.10/§4 (bloque de agentes en paralelo) |
| ~~4.10.8~~ | La detección determinística de discrepancias era inerte | ✅ **RESUELTO 2026-10-14** | La ruta pasaba `especificacionesSolicitadas: {}` cableado, así que el detector iteraba un objeto vacío y **nunca encontraba nada**: sin IA, la comparativa salía siempre sin discrepancias y el coordinador creía que todo coincidía. Ahora se alimenta de lo que el solicitante respondió, con tolerancia de claves. **Verificado de punta a punta**: con una oferta que dice "Base solvente" donde se pidió "Base agua", encuentra 2 discrepancias donde antes daba 0 |
| ~~4.10.9~~ | El KPI "sin decisión" mentía por dos motivos | ✅ **RESUELTO 2026-10-14** | Contaba **borradores** y tenía el umbral cableado en 5, ignorando `/admin/configuracion`. Verificado contra la base: contaba 127 por 16 borradores viejos; ahora 111. La etiqueta sigue la config (probado: con 9 dice "> 9 días") |
| 4.10.10 | Aviso de monedas distintas en la comparativa del coordinador | bajo | La conversión orientativa existe pero solo en la vista pública |
| ~~**4.10.11**~~ | ~~`respuesta_campo` era de solo escritura~~ | ✅ **RESUELTO 2026-10-14** | Resuelto junto con 4.5.6: el coordinador ve todas las respuestas como campos. Se agregó `listarRespuestas` y `guardarRespuestasPorClave` (la lógica de resolver la etiqueta del catálogo estaba duplicada en dos métodos) |

### 4.12 Documentos adjuntos de la solicitud

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| ~~**4.12.1**~~ | ~~Adjuntar documentos (coordinador, admin y solicitante)~~ | ✅ **RESUELTO 2026-10-21** | La tabla `adjunto` existía desde la 004 pero **nunca se usó**: no guardaba contenido ni fecha. Migración 021 agrega `contenido` (bytea) y `creado_en`, y el tipo de evento `adjunto`. **Quién sube**: coordinador, admin y el propio solicitante desde su solicitud. **Tipos**: PDF, Word, PowerPoint e imágenes (hasta 10 MB), validados en el servidor por **extensión + contenido** (magic bytes; ZIP para docx/pptx, OLE para doc/ppt). **Dónde se ven**: en las tres pantallas (panel del coordinador, detalle del admin y portal del solicitante) — **nunca en el enlace público**. **Borrado** con confirmación: Compras borra cualquiera, el solicitante solo los suyos (la API lo verifica y la UI no ofrece un botón que va a fallar). Cada alta/baja deja un **evento**. **Correo 9**: al subir, se avisa al otro lado (Compras → solicitante; solicitante → coordinador asignado). Verificado en navegador en las tres superficies y con 10 tests de ruta |

---

## 4.13 Peticiones urgentes del 2026-10-21 (por precisar antes de codificar)

Pedidas por el cliente para el piloto. **Cada una queda bloqueada por una decisión**; no se
implementa hasta cerrarla (ver la nota de cada fila).

| # | Tarea | Bloqueo / decisión pendiente |
|---|---|---|
| ~~4.13.0~~ | ~~Modo pruebas de correo (desarrollo)~~ | ✅ **RESUELTO 2026-10-21** | Con `MAIL_DRY_RUN=1` **no se envía nada**: se registra `estado_envio = "simulado"` y un aviso en el log. Así un envío desde local nunca llega a un coordinador real. **No está en Vercel**: producción envía normal. Verificado: el correo quedó `simulado` |
| ~~4.13.1~~ | ~~"Doble flecha" y botón alto~~ | ✅ **RESUELTO 2026-10-21** | Era el botón **`Ver recomendación →`** de la comparativa: el carácter `→` **más** un icono de flecha. Se quitó el carácter y se agregó `whitespace-nowrap`. Verificado: 1 línea, 40 px |
| ~~4.13.2~~ | ~~Los documentos no se cargan~~ | ✅ **RESUELTO 2026-10-21** | La subida **funcionaba**; el error rojo era de la **carga de la lista** (y al probar contra Supabase vacío no había nada). Se bajó el tope a **4 MB** (Vercel corta ~4,5 MB y devolvía un 413 sin mensaje), se muestra el error real (incluido el 413) y se agregó **Reintentar** en la lista. Verificado subiendo un PDF desde el coordinador |
| ~~4.13.3~~ | ~~Cotizaciones y respuestas en el detalle del ADMIN~~ | ✅ **RESUELTO 2026-10-21** | El admin veía solo el timeline. Ahora el detalle incluye **respuestas del solicitante**, **cotizaciones con precios** (neto/ISV/total/entrega/pago, con "⚠ no especifica"), **comparativa** (observaciones, recomendación del coordinador, sugerencia del sistema y pros/contras por proveedor) y **decisión** (qué eligió o "ninguna me sirve"). Verificado en navegador: 5 respuestas, 3 cotizaciones y la comparativa completa |
| ~~4.13.4~~ | ~~Respuestas del solicitante en el detalle del COORDINADOR~~ | ✅ **VERIFICADO 2026-10-21** | Ya funcionaba: con la solicitud de prueba muestra **"Respuestas del solicitante (5)"** y las 5 respuestas. El reporte anterior se explicaba porque el dev apuntaba a Supabase (vacío) |
| 4.13.5 | **Rediseño del dashboard admin** (sistema de la referencia) | 🟢 **F0–F4 HECHOS (2026-10-21)**. Plan y valores con fuente en **`DESIGN.md`**. **F0** fundación bajo `.bia-ds`; **F1** kit; **F2** shell + dashboard admin; **F3** todo el admin (procesos, detalle, coordinadores, campos, configuración, perfil) con `requireAuth` intacto; **F4** coordinador con **navegación por etapas**: sidebar con `Todas / Por cotizar / Comparativas / Esperando / Cerradas` y contadores (el ítem activo es el más específico), dashboard de triage (banda «pulso», cola ordenada por acción y urgencia, riel con prioridad y carga por etapa), rutas `/panel/{cotizaciones,comparativas,decisiones,cerradas}`, `/panel/perfil`, y detalle con el header del sistema. **617 tests**, `tsc` y lint limpios; verificado en navegador (bandeja, etapa, detalle, admin sin regresión). **Pendiente F5–F7**: wizard del solicitante, acceso/público y limpieza de `ui-ext`. El detalle del coordinador y del admin quedaron rediseñados y sus componentes de etapa (CargaCotizaciones, Comparativa, Recomendación) pasaron al sistema. |
| ~~4.13.6~~ | ~~Quitar la card de "Alertas" del home~~ | ✅ **RESUELTO 2026-10-21** | Se quitó la card y su código muerto (estado y handlers). La ruta `/api/admin/alertas/ejecutar` y su lógica siguen existiendo. La card de **Recordatorios** se conserva |
| ~~4.13.7~~ | ~~Quitar "Umbrales y alertas" del sidebar~~ | ✅ **RESUELTO 2026-10-21** | Se quitó del `NAV_ADMIN` (desktop y móvil). La ruta `/admin/configuracion` y su lógica siguen funcionando |
| ~~4.13.8~~ | ~~"Mi perfil" con datos reales~~ | ✅ **RESUELTO 2026-10-21** | Mostraba "Gestionado por el proveedor de identidad" en **todos** los campos. Ahora lee la sesión y muestra **nombre, correo y rol** reales, en solo lectura. Verificado: "Admin BIA · admin@biafoods.co · Administración" |
| ~~4.13.9~~ | ~~Alta de cuentas + invitación por correo~~ | ✅ **RESUELTO 2026-10-21** | Se quitó la contraseña: la cuenta se crea con `generateLink({type:"invite"})` de Supabase y el enlace se envía con **Resend** y el template corporativo (el correo propio de Supabase rechazaba direcciones válidas y no permite el diseño). La persona define su contraseña al activar. Si el envío falla, se borra la cuenta y el reintento es limpio. Verificado: "Invitación enviada" y la cuenta aparece en la lista |
| ~~4.13.10~~ | ~~Administrar roles desde el admin~~ | ✅ **RESUELTO 2026-10-21** | El alta y la edición permiten elegir **Coordinador o Administrador**; la tabla muestra el rol y el total de admins activos. Guards: **no puede cambiarse el rol a sí mismo** (se quedaría sin acceso) y **no se puede dejar el sistema sin admins activos**. Verificado en navegador: el intento de auto-cambio responde con el mensaje y no altera nada |
| ~~4.13.11~~ | ~~El botón del correo 9 debe llevar al documento~~ | ✅ **RESUELTO 2026-10-21** | Nuevo **token HMAC firmado** (`lib/descargas/token.ts`, 7 días, atado al adjunto y a la solicitud) con `DOWNLOAD_SECRET`/`CRON_SECRET`. El correo 9 trae **"Descargar documento"** (baja el archivo sin sesión) y **"Ver la solicitud"** (va a la plataforma). Verificado E2E: sin token → 401, con token → 200, manipulado → 401 |
| ~~**4.13.14**~~ | ~~Voseo restante (D11 incompleto)~~ | ✅ **RESUELTO 2026-10-21** | Se corrigieron los 11 strings de UI (`Cargá/adjuntá`, `Agregá`, `Mirá`, `Escribí`, `Seleccioná`, `Volvé`, `Revisá`, `Intentá`) en las 7 pantallas. Queda **solo** el prompt interno de IA (`lib/ai/prompts.ts`), cuya salida ya verifica "usted" |
| 4.13.12 | **B4 — confirmación escrita del cliente** | No es código: lo cierra el cliente |
| ~~**4.13.15**~~ | ~~Subir cotizaciones en Word y PowerPoint~~ | ✅ **RESUELTO 2026-10-21** | El input aceptaba `.doc/.docx` pero `/api/convertir` solo PDF/imágenes → **415** (la causa del "no deja subir"). Ahora `.docx` y `.pptx` se extraen **sin IA** (ZIP + XML, determinístico) y PDF/imágenes siguen por el modelo multimodal. `.doc/.ppt` (binarios viejos) se rechazan con la instrucción de guardarlos como `.docx/.pptx`. Verificado: Word y PowerPoint de punta a punta (la cotización queda con neto/ISV/total) |
| ~~**4.13.16**~~ | ~~Adjuntar archivo duplicaba / no había botón para subir~~ | ✅ **RESUELTO 2026-10-21** (opción B) | Se quitó el "Adjuntar archivo" de cada tarjeta y se agregó **un botón a nivel de sección: "Subir cotización desde archivo"**, que crea la cotización con lo extraído. Antes, **sin cotizaciones no había forma de subir un archivo** (solo el alta manual). Verificado con un Word: crea la tarjeta con neto y total. Se agregó `pptx` al enum de formato (migración 023) |
| ~~**4.13.17**~~ | ~~Guardrail: «este documento no parece una cotización»~~ | ✅ **RESUELTO 2026-10-21** | La extracción ahora **clasifica primero**: `esCotizacion` + `motivoNoCotizacion`. Si es `false`, la ruta responde **422** con un mensaje claro y **no crea la cotización** (antes se creaba la fila y luego se extraía). Si el modelo omite el campo, se asume `true` (fail-open: no bloquear una cotización válida). Verificado: un contrato → 422 y el mensaje en la UI; una cotización real → se crea. De paso se corrigió el `catch` de la UI, que ocultaba el error del servidor, y `pptx` faltaba en el zod de la ruta |
| ~~**4.13.18**~~ | ~~Un archivo rechazado creaba una cotización vacía~~ | ✅ **RESUELTO 2026-10-21** | En las pruebas manuales, un `.doc` (415) o un archivo >4 MB (413) **dejaban una cotización "Proveedor por definir" con montos vacíos**. Ahora `convertirDocumento` devuelve el `status` y la UI **no crea nada** con 400/413/415/422; solo degrada a carga manual con fallos transitorios (500/503). Verificado: 4 cotizaciones, 0 huérfanas |
| ~~**4.13.19**~~ | ~~Decisión pública: 500, sin refresco y copy en tú~~ | ✅ **RESUELTO 2026-10-21** | (a) Si ya existía una decisión, el `INSERT` chocaba con el unique y devolvía **500**: ahora es **409** con mensaje, el GET marca `puedeDecidir=false` y el error se registra en el log. (b) Tras confirmar, la pantalla seguía ofreciendo "Elegir esta opción" hasta recargar: ahora pasa a **"DECISIÓN REGISTRADA"** en el acto. (c) El diálogo y los avisos estaban en **tú/voseo** ("Estás por elegir", "tu decisión", "Comparás", "Pedile", "Decidí"): pasados a **usted** (ADR 0008). Verificado en navegador: decisión, cierre y correo 4 simulado |
| ~~**4.13.20**~~ | ~~Historial completo de preguntas y respuestas en el detalle del coordinador~~ | ✅ **RESUELTO 2026-10-21** | Antes solo se veía la **última ronda**: `respuesta_campo` pisa por `campo_key` y las rondas vivían en columnas de `solicitud` que se sobrescriben (en RFQ-2026-0036 hubo 4 y quedaba la 2). Ahora: tabla **`ronda_preguntas`** (migración **024**) + backfill de la ronda vigente; `pedirInformacion`/`responderInformacion` la escriben en la **misma transacción** y guardan el payload completo en `evento.metadata`. UI compartida `FormularioYRespuestas`: **formulario original** (plantilla congelada por `plantilla_id` + assessment, con "No especificado") al final de la **columna derecha** y **una card por ronda** debajo, en panel del coordinador **y** detalle del admin. Fallback `completarRondas` para una ronda abierta sin fila. Las rondas anteriores a la migración **no son recuperables** (solo quedaba el resumen). Las rondas **anteriores a la migración** se reconstruyen desde el evento y se muestran como cards incompletas ("el detalle no se guardó"), sin inventar preguntas. Verificado con rondas 1–4 (marcador + detalle) en ambas vistas; **604 tests**, `tsc` y lint limpios. ⚠ **Falta aplicar la 024 en Supabase producción antes del push** (Vercel marca `DATABASE_URL` como `SENSITIVE` y no la exporta: hace falta la cadena de conexión) |
| ~~**4.13.21**~~ | ~~Login único y rediseño del detalle (coordinador y admin)~~ | ✅ **RESUELTO 2026-10-21** | **Login único** para admin y coordinador en `/login`, portado de la pantalla de acceso de la referencia (banda oscura + listón + formulario): enruta por rol, **rechaza solicitantes** (cierra la sesión), `/login/admin` y `/login/coordinador` redirigen, el middleware manda a `/login?next=…` y `requireAuth` también. **Detalle del coordinador**: toolbar (Bandeja + acciones; «Más» en móvil), **stepper 07/08/09** con `aria-current`, cotizaciones/comparativa/recomendación restilizadas, riel con Solicitante/Detalles/Documentos/Formulario. **Detalle del admin**: `SummaryStrip` (estado, tiempo, entrega, coordinador) + el mismo stepper en lectura. Verificado en navegador (1440 y 390); **622 tests**, `tsc`, lint y build locales limpios. |
| ~~**4.13.22**~~ | ~~Rediseño del flujo del solicitante (F5)~~ | ✅ **RESUELTO 2026-10-21** | **Home** (`/`), **wizard** (`/solicitud/nueva`) y **mis-solicitudes** (+ detalle) pasaron al sistema: `PublicShell` sin sidebar, campos y botones del kit, stepper del wizard con rail de progreso, `TrackerEtapas` restilizado (sin emojis), tarjetas con hairline, badges de estado y retraso, y avisos de decisión. Se eliminó el `AmbientBackground`/glass y el contenedor `max-w` duplicado de la página del wizard. `ResponderPreguntas` y `CTADecision` al sistema (y trato de usted). Verificado en navegador (1440 y 390); **622 tests**, `tsc`, lint y build locales limpios. |
| ~~**4.13.23**~~ | ~~F5b · estilizado del flujo del solicitante~~ | ✅ **RESUELTO 2026-10-21** | **Home** partido con banda oscura + listón y el formulario a la derecha (reutiliza `AuthLayout` parametrizado). **Wizard**: rail oscuro con listón y pasos 1–5 (mint/activo), transición entre pasos, **resumen vivo** en la columna derecha (título, necesidad, documento, fecha, área, respuestas, avance) y **pantalla de enviada** con banda oscura, “Qué sigue” y documento. **Mis solicitudes**: franja de KPIs (total, en curso, esperando, cerradas), pulso accionable con CTA mint, acento de color por estado y skeletons. **Detalle**: `SummaryStrip` (estado, tiempo, entrega, categoría) + tracker sin emojis. Verificado en navegador (1440 y 390); 622 tests, `tsc`, lint y build limpios. **Fix de foco**: los campos dibujaban dos halos (outline del input + borde del contenedor); ahora el input no dibuja outline y el foco lo muestra el wrapper. |
| **4.13.13** | **§6 deuda menor** | Pendiente: es mayormente documental (6.1 casillas, 6.2 verification, 6.4 Spec Kit de 009, 6.8 "comprador", 6.12 credenciales en QA, 6.13 test de moneda) |

**Decisión transversal (afecta a todas):** con la migración hecha, `DATABASE_URL` de `.env.local`
apunta a Supabase y el **dev escribe en la base del piloto** (hoy vacía). Propuesta: dejar el dev
en la base **local** y que Supabase sea solo producción (Vercel). Ver la respuesta del 2026-10-21.

---

## 5. Decisiones pendientes del cliente — NO son trabajo mío hasta que respondan

Esto no es "pendiente" en el sentido de tarea. Es **esperar**. Si lo trato como tarea, invento
requisitos.

### 5.1 Los 5 insumos de Lady (PARTE 5 del doc 16)
| Insumo | Afecta a |
|---|---|
| Criterio formal RFI/RFQ/RFP | `clasificar_solicitud` |
| **Plantillas oficiales por categoría** | `assessment_requerimiento` (cambia el catálogo, no el prompt) |
| Reglas fiscales completas (exenciones/retenciones) | `validar_fiscal` |
| Criterios de evaluación de Compras | `generar_pros_contras` |
| **Ejemplos reales de cotizaciones** | `extraer_cotizacion` |

### 5.2 Preguntas del PRD (Q1–Q9) con propuesta pero sin confirmar
Q1 regla de asignación · Q2 visibilidad cruzada entre coordinadores (define RLS) · Q7 reglas
fiscales. Las otras (Q3 umbral de inactividad, Q4 dominios, Q5 formato de referencia, Q8 tamaño
de archivo, Q9 registro de la interfaz) **ya tienen respuesta propuesta** en
`propuesta-decisiones-piloto.md`, pero el documento sigue `En revisión`.

✅ **Cerrado el 2026-10-15 (ADR 0008).** D11 fija el trato en *"Usted"*. De los 3 strings que
quedaban, **uno era copy real** (`panel/page.tsx:316` → "Pruebe con otro filtro o vea todas.") y
**dos eran comentarios**. El barrido inicial se quedó corto: aparecieron **3 mensajes reales de UI**
más en `lib/domain/archivos.ts` ("Expórtelo más liviano…", "Vuelva a exportarlo…", "Vuelva a
generarlo…"). Los specs **e2e no tenían voseo**.

Queda **a propósito** el prompt de IA (`lib/ai/prompts.ts`) escrito en voseo: su **salida real ya
usa "usted"** —verificado en vivo contra OpenRouter el 2026-10-15 ("Entendí que **usted** necesita
pintar…", "¿Qué tipo de pintura **prefiere**…?", "¿Qué color… **necesita**?")— y su propia REGLA lo
exige de forma explícita. Reescribir el prompt arriesgaría el comportamiento sin ganancia.

### 5.3 Insumos de infraestructura
- Dominio de la aplicación (subdominio vs. dominio propio) — "prioridad #1 de Lady".
- Migración a Supabase Cloud.
- 5 escenarios complejos de prueba — "Ladi enviará".
- Confirmar que `lberrios@biabrands.co` corresponde a `lramirez` antes de crear la cuenta.

---

## 6. Deuda de proceso y documental — lo que hace ruido en el día a día

Nada de esto rompe el producto. Todo esto hace que sea imposible saber si algo está bien.

| # | Problema | Tamaño | Acción propuesta |
|---|---|---|---|
| 6.1 | **132 casillas `[ ]` sin marcar** en 000–005 |alto | Marcar como `[x]` con evidencia, o archiving. Hoy el tablero miente en 132 filas. |
| 6.2 | **5 `verification.md` dicen "implementación prohibida hasta G4"** | medio | Reescribir con el estado real. Hoy contradicen al código. |
| 6.3 | **`003` sin `plan.md` ni `verification.md`**; se cerró G5/G6 con commits que solo tocaron `STATE.md` | medio | Crear los artefactos o marcar la carpeta como histórica. |
| 6.4 | **`009` sin Spec Kit**: solo tiene `assessment.md` | **alto** | 8+ commits de feature sin pasar por G2/G3/G4/G5. Es la feature más avanzada y la única sin gates. |
| 6.5 | ~~`STATE.md` 18 commits viejo; `HANDOFF.md` con estado inexistente~~ | — | ✅ **Resuelto** en esta sesión, ver §8 |
| 6.6 | `assessment.md:18` dice "2.2 Pendiente" pero se implementó en `9c75891` | bajo | Actualizar la tabla. |
| 6.7 | `008/verification.md:75` dice "8/8 checkboxes"; `tasks.md` tiene 15 | bajo | Corregir el número. |
| 6.8 | **`docs/guias/` y la UI usan "comprador"**, prohibido por ADR 0002 y el glossary | medio | Corrección de copy en 3 manuales + ~5 strings de UI. |
| 6.9 | `references/index.md:19` dice "8 claves de config pendientes"; el doc 15 marca 6 + 1 propuesta | bajo | Corregir el conteo. |
| 6.10 | Etiqueta `P3-d` citada en código sin existir en el audit (los headings terminan en `P3-c`) | bajo | Verificar a qué hallazgo se refiere. |
| 6.11 | Nombre del cliente inconsistente: "Lady Matute" / "Ladi Isabel Matute" / "Ladisabel" / "Ladi" | bajo | Fijar una forma y propagar. |
| 6.12 | **Credenciales de panel hardcodeadas en 4 scripts de QA** (`qa/checklist-piloto-3-roles.md`, `qa/evidencia-piloto/{d-fase-admin,e-vercel-smoke,probe-admin}.mjs`). Los dejé **sin trackear** a propósito; `secret-scan.sh` solo busca patrones de API key y no los detecta | medio | Leerlas de `.env.local`. Agregar el patrón al escaner. |
| 6.13 | `lib/domain/moneda.ts` es el único módulo nuevo sin test propio (la tasa 24.7 está fija y fechada en el código) | bajo | Test de formato y del equivalente; si la tasa cambia, que avise que está vieja |
| 6.14 | **`docs/doc-references/` sin trackear** (33 MB de RFQ/RFP/fichas del cliente). Añadido a `.gitignore` en `b28c5cd` | bajo | Confirmar que se consultan solo desde disco. Si deben versionarse, tiene que ser decisión explícita del cliente |
| 6.15 | 5 specs (000–005) sin gates · `003` sin plan/verification · `009` sin Spec Kit | **alto** | Decidir: documentar en retrospectiva, o marcar esas carpetas como históricas. Este archivo ya es la lista oficial; los `tasks.md` quedan como archivo histórico |

---

## 7. Hallazgos de QA — corregidos por verificación contra código

Este bloque cambió después de una verificación de cada hallazgo **leyendo el código, no la
documentación**. Cuatro estaban mal. La columna de la derecha es la nueva fuente de verdad.

| Ref | Hallazgo | Lo que decía antes | Verificado |
|---|---|---|---|
| **A8** | Re-cotización sin UI | ❌ "ningún botón la invoca" | **REFUTADO.** Hay botón: "Reabrir cotizaciones" (`DetalleSolicitud.tsx:291-300`) con invocación en `:97-115`, y cubre `ENVIADA_A_SOLICITANTE → EN_COTIZACION`. Lo que **sí** falta es la UI del **solicitante**, y por diseño: `guardApi(["coordinador","admin"])` lo excluye. Ver 4.3.1 |
| **B5** | Ahorro potencial no aparece con los pros de la IA | ⚠️ "`comparativa.ts:226` reemplaza los pros" | **REFUTADO en su forma original y RESUELTO**: esa línea es `especificacionesSolicitadas`. La fusión real es `fusionarProsContras` y **reinyecta todos** los pros y contras deterministas (4.10.7, cerrado) |
| **A7** | Card muestra "SIN FECHA LÍMITE" pese a tener fecha | ⚠️ abierto | **RESUELTO.** `listarPorEmail` ya incluye `fecha_requerida` (`postgres-repo.ts:428,439`) y la card la pasa al semáforo. Confirmado en `qa/checklist-piloto-3-roles.md:80` |
| **A7b** | Tracker solo en el detalle, no en las cards | ⚠️ abierto | **REFUTADO.** Está en ambos: `mis-solicitudes/page.tsx:172` (`TrackerEtapes compacto`) y `[id]/page.tsx:89`. Por eso 4.6.1/§4.6 estaba obsoleta |
| **A6** | La referencia real no se muestra en la confirmación | ⚠️ abierto | **RESUELTO.** `SolicitanteWizard.tsx:1376-1380` muestra `envio.referencia` |
| **D2** | Eventos duplicados en la timeline | ⚠️ "duplicados" | **REFUTADO, pero invertido.** No hay duplicados: **faltan eventos**. `creacion`, `carga_cotizacion`, `generacion_comparativa`, `envio_correo` y `acceso_link` se renderizan en la UI y nunca se insertan. Ver 4.10.3 |
| **D2b** | Descripción genérica "al estado actual" | ⚠️ confirmado | **PARCIAL.** Faltan 4 `case` en `descripcionEvento`. Ver 4.10.4 |
| **B3** | PDF descarga como `application/octet-stream` | ⚠️ abierto | Plausible, **no re-verificado**. Queda pendiente |
| **A4** | Sin sección "Información comercial" para mercadeo+RFQ | ⚠️ abierto | **Esperado, no bug.** No hay plantilla RFQ para mercadeo. Verificado en DB: las plantillas son `RFQ/servicio`, `RFQ/mixto`, `RFP/mixto` |
| **H6** | `gemini-2.5-flash-lite` cae a fallback | ⚠️ conocido | Correcto: `ejecutarUna` reintenta con `openai/gpt-4o-mini`. Monitorear coste |

**Los que siguen abiertos sin re-verificar:** B3 (content-type). Todo lo de esta tabla es de
`qa/checklist-piloto-3-roles.md` del 2026-09-22, **sin re-correr**. Ese archivo quedó **sin
trackear** por las credenciales (ver 6.12): leelo de disco.

### 7.1 Hallazgos nuevos de la auditoría — **estado en §4**

La auditoría de §11 contra código encontró doce ítems que ninguna lista tenía. **Su estado
vive en §4 y en ningún otro lado.** Antes esta tabla lo repetía, y las tres copias (§4, acá y
§11) se desincronizaron hasta contradecirse: esta decía que el correo 4 faltaba mientras §4.9.2
lo daba por resuelto.

Los ítems, para no perder el rastro de dónde salieron:

| # | Hallazgo | Gravedad |
|---|---|---|
| 4.7.1 | B3 no validado en servidor | crítica |
| 4.7.2 | Correo 4 nunca se envía | crítica |
| 4.7.3 | "Ninguna me sirve" cerraba la solicitud | crítica |
| 4.7.4 | `guardarComparativa` devolvía un id inexistente | alta |
| 4.7.5 | Los tests del assessment fallan con `OPENROUTER_API_KEY` en el entorno | media |
| 4.8.1 | `GET /api/solicitudes/[id]` sin auth | crítica |
| 4.8.2 | `/documento` y `/logo` sin chequeo de pertenencia | crítica |
| 4.8.3 | Aislamiento horizontal entre coordinadores | crítica |
| 4.9.1 | Correo 1 cae al solicitante | crítica |
| 4.10.1 | Tasa ISV hardcodeada | alta |
| 4.10.2 | La alerta de inactividad no puede dispararse | alta |
| 4.10.5 | `transicionarEstado` del repo no valida la máquina de estados | media |
| 4.10.6 | Excel comparativo siempre "—" en pros/contras | media |
| 4.10.7 | `fusionarProsContras` descarta pros y contras deterministas | media |

**Para saber si alguna sigue abierta, buscar su número en §4.** Acá no se repite el estado.

---

## 8. `.harness/` ya unificado — RESUELTO

Estaba así: `AGENTS.md` mandaba a leer `STATE.md` y `HANDOFF.md`, y los dos mentían.
Un agente que arrancaba mañana leía que no había feature activa y que todo estaba cerrado.

**Hecho en esta sesión:**
1. `AGENTS.md` ahora manda a leer **este archivo primero**, y declara que es la lista oficial.
2. `STATE.md` reducido a un puntero: estado de una línea + orden de lectura.
3. `HANDOFF.md` **reescrito con la sesión de hoy**.

⚠️ **Corrección posterior:** primero marqué `HANDOFF.md` como "histórico, no usar". Fue un
error de diseño: confundí "documento que se quedó viejo" con "documento redundante". No es lo
mismo. `session-start` lo lee como input obligatorio (`.agents/skills/session-start/SKILL.md:18`),
así que dejarlo descartado le rompe el mecanismo de continuidad.

Los tres archivos sirven cosas distintas y por eso conviven sin contradecirse:
- **`TASKS.md`** — qué hay que hacer. Durable, lista oficial.
- **`STATE.md`** — qué es el proyecto y cómo arrancar. Puntero, una pantalla.
- **`HANDOFF.md`** — dónde quedó *esta* sesión y cuál es el primer movimiento. Efímero, se
  reescribe al cerrar cada sesión.

La solución a la obsolescencia es refrescarlo, no retirarlo.

Verificá que no queden contradicciones: `grep -rn "HANDOFF" AGENTS.md .harness/*.md`.

---

## 9. Explícitamente diferido con acuerdo — NO hacer

Para que nadie lo re-propononga como si fuera un olvido. Todas tienen justificación escrita.

| Tema | Por qué no |
|---|---|
| Reportería KPI desde sistemas actuales (COM-2) | Diferida, sin fecha. Debe cotizarse aparte. |
| Integración con presupuesto de Finanzas (COM-4) | Requiere coordinación con Finanzas y Tecnología. |
| Motor SNOP / Plan de Compras (COM-3) | Fase 2, requiere alineación previa. |
| Memoria histórica / reconocimiento de patrones | "Se acordó explícitamente dejarlo como mejora posterior". |
| RAG con embeddings / pgvector | El MVP no lo requiere; se pospone hasta que haya data. |
| Cualquier lectura/escritura del ERP | ADR 0005, decisión consciente del cliente. |
| Órdenes de compra y pagos | El ciclo cierra en la decisión, no en la compra. |
| App móvil nativa | La web adaptable cubre el caso. |
| Firma electrónica | No solicitado. |
| Materia prima y abastecimiento (70% del gasto) | Fuera del piloto, sigue en sistemas actuales. |
| Copiloto en Teams | Reemplazado por la aplicación web. |

---

## 10. Próxima sesión — orden sugerido

> **El plan completo y el porqué del orden viven en `docs/references/plan-desarrollo.md`.**
> Acá queda solo el primer movimiento.

**Cerrado recientemente:** la feature **010** (ciclo de preguntas al solicitante), el **CRUD de
coordinadores** (4.4.2), la **plantilla de origen** (4.4.1a) y la **higiene de la base de tests**
(4.10.13, que además barrió 1232 filas de prueba acumuladas). Los 6 críticos de la auditoría y la
tanda de §4.7–§4.10 también están cerrados.

**Lo que se puede hacer ya**, sin esperar al cliente, por valor:

1. ~~**OCR en serverless (4.5.1)**~~ → ✅ **Hecho 2026-10-17**: la conversión ya no usa Python; la
   hace un modelo multimodal de OpenRouter (PDF e imágenes). Verificado en vivo.
2. ~~**`POST /logo` sin autorización (4.8.11)**~~ → ✅ **Hecho 2026-10-15**: se le aplicó el mismo
   guard que al GET (rol de Compras o el correo dueño), antes de leer el cuerpo. Ver §4.8.
3. **Alertas por tipo y preview (4.4.10)**: 4 tipos detectados, solo `inactividad` se notifica, y
   `discrepancia` nunca se emite.
4. **Correr los e2e y probar el ciclo 010 a mano**: los e2e **no se han corrido** con los cambios
   recientes.
5. ~~**Cerrar el idioma (D11)**~~ → ✅ **Hecho 2026-10-15**: 4 mensajes reales de UI corregidos (uno de ellos, `lib/domain/archivos.ts`, el barrido inicial no lo vio). Ver §5.2.
6. **Deuda documental (§6)**, en especial 6.4 (`009` sin Spec Kit), 6.1 (132 casillas) y 6.12
   (credenciales hardcodeadas en los scripts de QA).
7. Lo demás de §4 por valor: 4.8.13, 4.5.4, 4.10.10, 4.5.5, 4.7.6, 4.1.1-b/c.

**Lo que hay que esperar:**
- **Migrar a Supabase Cloud (B1)**: depende del cliente (reset de contraseña + connection string
  del pooler). Al hacerlo hay que rehacer el supuesto de `vitest.global-setup.ts`, que **borra por
  patrón**; contra una base de producción eso sería peligroso.
- **4.4.1b** (versionar plantillas): falta la UI de edición de plantillas.
- **4.4.3** (RLS): era política, no bug (Q2 resuelta).

Los bloqueantes **B1 y B4** (§1) no dependen del equipo interno: van por correo al cliente.

---

## 11. Inventario funcional por rol

| Rol | LISTO | A MEDIAS | FALTA | Total |
|---|---|---|---|---|
| Solicitante | 19 | 16 | 5 | 40 |
| Coordinador | 18 | 14 | 5 | 37 |
| Administrador | 13 | 13 | 6 | 32 |

**Ningún rol está "terminado":** entre 45 y 55% de las funciones están a medias o faltan.
Lo que sí está claro es que **el camino feliz de los tres roles funciona de punta a punta**
— por eso el producto se usó en piloto sin que se notara.

Verificado **leyendo el código**, no la documentación. Donde `user-flows.md` y el código
discrepan, **gana el código**: `user-flows.md` es de 2026-08-12 y el código llega a octubre.
Cada fila dice su estado y qué falta. Los IDs de §4 son la tarea a abrir.

### 11.1 SOLICITANTE

**LISTO (el flujo completo funciona de punta a punta)**
| Funcionalidad | Evidencia |
|---|---|
| P1 identificación: correo + nombre + área | `app/page.tsx:27-138` |
| P2 captura: título, categoría, producto/servicio, fecha, descripción | `hooks/useSolicitudWizard.ts:667-701` |
| P3 clasificación IA con confianza y corrección en un clic (RN-04) | `SolicitanteWizard.tsx:724-828` |
| P4 assessment con catálogo vigente del servidor (RN-02) | `assessment/route.ts:47-64` — el cliente manda `catalogo: []` y el server carga de DB |
| P4 opción "No lo sé" por pregunta, no bloquea | `SolicitanteWizard.tsx:1137-1145` |
| P4 **aviso de obligatorios al enviar** (commit `6dc64d5`) | `hook:770-781`; modal `SolicitanteWizard.tsx:353-424` |
| P4 **aviso si el assessment falló** | `hook:795-802` — distingue `error` de `sin_preparar` |
| P4 "Qué entendimos de tu solicitud" (`contexto_investigado`) | `SolicitanteWizard.tsx:978-987` |
| P5 envío con fases visibles y timeout que **aborta** | `hook:281-303`, `SolicitanteWizard.tsx:1341-1362` |
| P5 **idempotencia del envío** | `claveEnvio` → `ON CONFLICT (email, key)`; `repo:101-137` |
| P5 elección de comprador con preselección por categoría | `hook:356-376` |
| P6 confirmación con referencia definitiva | `SolicitanteWizard.tsx:1375-1383` |
| Consulta por correo, sin montos en el listado | `repo:424-431` |
| Semáforo de atención con fecha real | `page.tsx:167,183-185` + `semaforo.ts:37-74` |
| Tracker de etapas en cards **y** en detalle | `page.tsx:172` (compacto), `[id]/page.tsx:89` |
| Seguridad del detalle: sin `?email=` hay `notFound()` | `[id]/page.tsx:28-31` |
| CTA "Decidir ahora" honesto (no promete enlace no abierto) | `CTADecision.tsx:26-43` |
| Manual de uso servido desde el producto | `/guias/manual-solicitante`, 5 puntos de entrada |
| Anti-subida de logo: magic bytes, sin `.svg`, 4 MB | `archivos.ts:36-99` |

**A MEDIAS**
| Funcionalidad | Qué falta | Tarea |
|---|---|---|
| Validación de email | Cliente: `includes("@") && includes(".")` acepta `a@b.`. El `z.string().email()` del server solo llega en P5. El aviso de dominio institucional usa `/bia\.(com\|hn)$/` **sin flag `i`** → `juan@BIA.COM` recibe aviso falso y `x@notbia.com` pasa limpio | — |
| Nombre obligatorio | Se exige `!== ""`, sin mínimo de 3 caracteres ni en cliente ni en servidor | — |
| Fecha requerida no admite fechas pasadas | `<input type="date">` **sin `min`**. Se puede elegir cualquier fecha pasada, sin validación en ningún lado | 4.5.2 |
| Aviso de plazo < 5 días | Usa `Math.abs()` → una fecha 10 días en el pasado **también** dispara "plazo muy corto". Y calcula días calendario, no hábiles | — |
| Descripción breve obligatoria | La doc la marca obligatoria; **no está en `pasoValido` ni en `faltantes`**, y la API la acepta como optional. Sin ella la IA no puede clasificar bien | 4.5.3 |
| Clasificación con confianza < 0.70 | El encabezado y la confianza cambian, pero `clasificacion` **conserva el default "RFQ"** → el radio sigue marcado. El propio test lo documenta (`clasificacion-hook.test.tsx:75`) | — |
| Reanudar borrador | El modal existe, pero `app/page.tsx:22` **borra el borrador** antes de navegar con `?nuevo=1` → desde P1 el modal es inalcanzable por ese camino | 4.5.4 |
| B2 (logo obligatorio si hay branding) | Cliente bloquea bien. **El servidor NO**: `POST /api/solicitudes` y el PATCH de estado aceptan el envío sin logo. Se puede saltar por API. ⚠️ **Es otra cosa que 4.8.6** (esa era validar el contenido de lo que sí se sube, ya resuelta): acá lo que falta es **exigir** el logo cuando hay branding | ~~**4.8.13**~~ |
| B1 (obligatorios de plantilla) | **No bloquea**: avisa y deja "Enviar de todos modos". Contradice la doc, pero es decisión deliberada y argumentada | — |
| Máximo de preguntas | `MAX_PEGUNTAS = 10`, la doc pide 6. Y `consolidarPreguntas` puede exceder 10 porque los obligatorios nunca se recortan (deliberado) | 4.5.5 |
| Respuestas del assessment persistidas | Viajan al PDF de Compras pero **nunca se guardan en `respuesta_campo`**. Como dato estructurado no existen: solo se persisten por la ruta de re-cotización | 4.5.6 |
| PDF del paso 6 | Se regenera con `respuestas: {}`, o sea sin las respuestas del assessment (la parte de acceso público ya se cerró: ver 4.8.2 resuelto) | 4.5.6 |
| Referencia en P5 antes de enviar | La doc la pide antes; el código muestra un placeholder `RFQ-2026-XXXX` y recién la asigna al transicionar. **No lo cubre 4.1.1** (que era la pantalla del admin inventando `SOL-XXXX`) | 4.1.1-c |
| Nombre del comprador en P6 | Muestra texto fijo "Equipo Compras BIA" aunque el solicitante **eligió** comprador y el servidor lo asignó. El nombre real está en `estado.coordinadorId` y no se usa | — |
| CTA "Decidir ahora" | Solo funciona si el token se guardó en **ese** navegador. Si se decidió en otro dispositivo, solo queda "abrilo desde el correo". Decisión de privacidad explícita, pero no documentada | — |
| Barra de progreso | El rail tiene **5** pasos, la doc dice "paso 2 de 4" | — |

| **Responder preguntas de Compras** (010) | ✅ Hecho: la tarjeta va arriba de todo y muestra lo respondido | — |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| Autocompletar nombre/área desde el histórico del correo | No existe endpoint. Debería haber uno tipo `GET /api/solicitudes/ultima?email=` | — |
| Botón "Atrás" en P2 | `<PasoAcciones>` sin prop `atras`. **No hay forma de volver a P1** | — |
| Re-cotización del solicitante | No hay UI ni permiso (`guardApi` la excluye por diseño) | ~~4.3.1~~ **DECIDIDO no implementar** |
| Tras decidir, el enlace no se revoca | La solicitud ya vuelve bien a Compras (4.7.3 resuelto), pero el enlace sigue vivo: al recargarlo muestra las tarjetas otra vez. El 409 solo aparece **después** de intentar decidir de nuevo | 4.7.8 |
| ~~Notificación al decidir~~ | ✅ **Resuelto**: el correo 4 se envía al coordinador | — |

### 11.2 COORDINADOR

**LISTO**
| Funcionalidad | Evidencia |
|---|---|
| Bandeja: filtros por estado, contadores, filas clicables | `panel/page.tsx:129-394` |
| Indicador de inactividad / semáforo | `panel/page.tsx:380-382` + `semaforo.ts:37-74` |
| Estados vacíos y de carga, y **error de red ≠ bandeja vacía** | `panel/page.tsx:249-331` + test |
| Detalle: pestañas 07/08/09, encabezado, panel lateral, bloque solicitante | `DetalleSolicitud.tsx:21-523` |
| Carga manual de cotización + adjuntar PDF/Word/imagen | `CargaCotizaciones.tsx:184-369` |
| Extracción IA de los datos de la cotización | `cotizaciones/route.ts:95-128` |
| Botón generar comparativa deshabilitado con <2 + nota | `CargaCotizaciones.tsx:437-462` |
| Servidor exige ≥2 cotizaciones | `comparativa/route.ts:22-27` |
| Comparativa: neto arriba, impuestos abajo, total, entrega, forma de pago, garantía, vigencia | `Comparativa.tsx:64-124` |
| "⚠ no especifica" sin desglose · "no especificado" nunca 0 | `Comparativa.tsx:78-120` |
| Bloqueo **B3 en cliente** + mensaje que explica | `Recomendacion.tsx:24,116-121` |
| Sugerencia IA etiquetada y subordinada a la humana (RN-01) | `Recomendacion.tsx:88-103` |
| **Re-cotización: botón "Reabrir cotizaciones"** con modal y advertencia | `DetalleSolicitud.tsx:291-300`, invocación `:97-115` |
| Enlace público con token criptográfico (12 bytes) y expiración de config | `estado/route.ts:30-34`, `:111-118` |
| Correo 3 con cotizaciones originales adjuntas | `estado/route.ts:167-195` |
| Cancelar solicitud con modal propio | `DetalleSolicitud.tsx:530-576` |
| Editar datos para re-cotizar, con evento `edicion` | `DetalleSolicitud.tsx:357-391` → `repo:196-207` |
| Exportar comparativo a Excel (4.10.6 corregido) | `comparativa/excel/route.ts` |

**A MEDIAS**
| Funcionalidad | Qué falta | Tarea |
|---|---|---|
| ~~Ver solo solicitudes asignadas~~ | ✅ **Resuelto 2026-10-03**: la bandeja sale de la sesión, y sin cuenta dada de alta se responde 403 en vez de mostrar la de otro | — |
| **Aislamiento por solicitud (escrituras)** | Sigue abierto y **bloqueado por decisión de negocio**: es la pregunta Q2 del PRD (¿los coordinadores ven solicitudes de otros?), pendiente de Lady. Aparte: el `PATCH` de cotizaciones ignora el `id` de la ruta y usa el del body — eso sí es bug | 4.8.3 |
| Navegación entre etapas | Solo el paso **08** se bloquea sin 2 cotizaciones. El **09 sigue accesible** con 0 → se llega a una pantalla vacía y se puede pulsar "Enviar" (el server responde 409, pero es un callejón sin salida) | — |
| Panel lateral del detalle | **Falta `fecha de creación`** y **falta el tipo RFI/RFQ/RFP** (muestra la categoría en su lugar) | — |
| Orden de la bandeja | La doc pide `fecha requerida ASC`; el código usa `fecha_creacion DESC` | — |
| ~~Conversión del archivo a Markdown~~ | ✅ **Resuelto 2026-10-17** (4.5.1): la hace un modelo multimodal de OpenRouter. Ya no depende de Python ni descarga nada al cliente. Verificado en vivo con PDF e imagen | — |
| Slots de proveedor | Hay que **crear la cotización manual primero** y solo después adjuntar. El archivo no se puede subir antes de tener los datos | — |
| Estados del archivo | Faltan "Sin archivo aún" / "convertido a Markdown ✓" | — |
| Editar/borrar cotización | El servidor **ignora el `id`** de la ruta y usa el del body, sin verificar pertenencia | 4.8.3 |
| Confirmación de borrado | `borrandoId === borrandoId` siempre true → nunca muestra "Eliminando…" | — |
| ~~Observación fiscal antes de precios~~ | ✅ **Resuelto 2026-10-14** (4.10.8): la ruta ya **no** pasa `especificacionesSolicitadas: {}`; se alimenta de lo que respondió el solicitante. Verificado de punta a punta (2 discrepancias donde antes 0). **Queda** que solo se muestra `[0]` | 4.10.8 |
| Aviso de monedas distintas | La conversión orientativa existe pero **solo en la vista pública**. En la del coordinador no hay ninguna observación | **4.10.10** (antes citaba 4.10.7 por error) |
| Obs. fiscal por cotización | Se muestra en etapa **07**, la doc la ubica en la comparativa (08) | — |
| ~~Corregir el ahorro con la IA~~ | ✅ **Resuelto 2026-10-14** (4.10.7): la fusión ya reinyecta **todos** los pros y contras deterministas, no solo los de "Ahorro" | — |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| ~~B3 en servidor~~ | ✅ **Resuelto 2026-10-03**: sin recomendación, 409 y no envía | — |
| Marcador "Nueva" para recién asignadas | El tone `nueva` existe en `Badge.tsx:21` pero está asignado a la categoría `capex_indirectos` | — |
| Bloque "Registro de solicitud en proceso" | Está en la doc, **cero coincidencias** en el código | — |
| **Correo 4** | El ciclo cierra sin notificar al coordinador | 4.7.2 |
| Re-cotización por el **solicitante** | El backend tiene `PATCH`; el solicitante no tiene UI ni permiso | ~~4.3.1~~ **DECIDIDO no implementar** |

### 11.3 ADMINISTRADOR

**LISTO**
| Funcionalidad | Evidencia |
|---|---|
| Dashboard: 4 tarjetas de métricas | `admin/page.tsx:224-240` |
| **Métricas desde la DB — cero números mágicos** | 7 agregados SQL reales en `repo:803-869`. `grep` de `84%` / `4.2d` → 0 resultados |
| Conversión excluye borradores · tiempo de ciclo `fecha_cierre − fecha_envio` | `repo:828-829,838-845` |
| Volumen por coordinador · distribución por tipo | `repo:847-859` |
| Filtro por coordinador (lista real, no mock) | `admin/page.tsx:335-350` → `listarCoordinadores()` |
| Tabla de procesos con badges, paginación, orden, búsqueda | `admin/page.tsx:410-561` |
| Estados vacíos sin ceros engañosos (`null` → "—") | `admin/page.tsx:227,233` |
| Exportar métricas a Excel (respeta rango y coordinador) | `metricas/excel/route.ts` → `excel/dashboard.ts` |
| **Reasignación de coordinador de punta a punta** | `ReasignarCoordinador.tsx` → `admin/solicitudes/[id]/reasignar` → `repo:399-422`, con doble auth y evento `reasignacion` |
| Campos de catálogo: listar, crear, activar/desactivar (persiste de verdad) | `admin/campos/page.tsx:82-140` → `repo:922-950` |
| Coordinadores: listar, alta, editar (nombre + categorías), activar/desactivar | `admin/coordinadores` → `api/admin/coordinadores` (+`[id]`) → `lib/supabase/admin.ts`. La baja **quita el rol en Auth** (verificado) y la bandeja responde 403 por el filtro `activo` |
| Configuración: umbral, expiración de enlace, destinatario (upsert real) | `admin/configuracion/page.tsx:49-86` |
| Perfil admin: **read-only y lo declara** | `admin/ajustes/page.tsx:15-48` — correcto, honesto |
| `/admin/procesos` kanban por tipo | `admin/procesos/page.tsx:29-74` |

**A MEDIAS**
| Funcionalidad | Qué falta | Tarea |
|---|---|---|
| ~~KPI "Sin decisión > 5 días"~~ | ✅ **Resuelto 2026-10-14** (4.10.9): ya no cuenta borradores ni tiene el umbral cableado. Verificado contra la base: contaba 127 por 16 borradores viejos, ahora 111 | — |
| Filtro "Hoy" | Mapea a `rango=dia` = `now() − 1 día`, o sea **las últimas 24h**, no el día calendario. Además el `minIso` del filtrado client-side se calcula en el `.finally()` del fetch de procesos: hay una ventana con el filtro aplicado sin `minIso` | — |
| Tabla de procesos | La doc pide columna "tipo"; la tabla muestra **categoría** y no hay columna de tipo | — |
| Detalle de coordinador en `/admin/coordinadores` | **Dos definiciones distintas de "tiempo de proceso" en el mismo rol**: aquí `fechaCierre − fechaCreacion`, en el KPI `fechaCierre − fechaEnvio` | — |
| ~~Editar un campo de catálogo~~ | ✅ **Resuelto 2026-10-14** (4.4.7): la edición parcial ya no destruye el resto de los atributos | — |
| ~~Crear campo con `campoKey` existente~~ | ✅ **Resuelto 2026-10-14** (4.4.8): ahora responde **409** en vez de sobrescribir en silencio | — |
| `guardApi` en las rutas admin | 6 rutas dependen **solo del middleware**. Inconsistente con las que sí lo tienen | 4.8.5 |
| Alertas: ejecutar y registrar | Carga **todas** las solicitudes + cotizaciones (N+1, sin filtro). La UI ya **no** lee `d.alertas.length`: informa los correos realmente enviados (4.4.10) | — |
| Alertas: la UI confunde estados | Si `destinatario_alertas` está vacío, se calculan alertas y la UI dice **"Sin alertas que enviar"** — confunde "nada que alertar" con "no hay destinatario" | — |
| Alertas: automatismo | **No hay cron.** Solo se ejecutan si un humano aprieta el botón. La doc describe un disparador por umbral | — |
| ~~Correo 5~~ | ✅ **Resuelto 2026-10-14** (4.9.4): va al coordinador asignado y a administración, deduplicando | — |
| ~~Timeline~~ | ✅ **Resuelto 2026-10-14** (4.10.3 y 4.10.4): los eventos se insertan y faltaban las descripciones, ya agregadas | — |
| ~~Referencia de la solicitud~~ | ✅ **Resuelto 2026-10-14** (4.1.1): las 5 pantallas dicen lo mismo y ninguna inventa `SOL-XXXX` | — |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| ~~Borrar un campo de catálogo~~ | ✅ **Resuelto 2026-10-14** (4.4.9): existe `DELETE` | — |
| ~~Selección de alertas por tipo~~ | ✅ **Resuelto 2026-10-18** (4.4.10): hay checkboxes por tipo y previsualización; `discrepancia` ya se emite. Solo `inactividad` envía correo | — |
| ~~El botón de alertas manda recordatorios~~ | ✅ **Resuelto 2026-10-19** (4.4.11): los recordatorios tienen su propia acción con preview y confirmación | — |
| ~~Que la alerta de inactividad pueda dispararse~~ | ✅ **Resuelto 2026-10-14** (4.10.2): el "último movimiento" sale del evento de trazabilidad más reciente | — |
| Formato de referencia: UI y unicidad | Se lee de `configuracion` con default `{{TIPO}}-{{ANIO}}-{{SECUENCIA}}` pero **no hay UI**, solo SQL. Y la secuencia por `MAX(regexp_match)+1` **puede duplicar** entre transacciones: **no hay constraint UNIQUE** (esto **no** lo cubrió 4.1.1, que era solo la pantalla) | 4.1.1-b |
| ~~Tasa ISV configurable~~ | ✅ **Resuelto 2026-10-14** (4.10.1): la clave **sí existía**; el código tenía `0.15` cableado. Ahora `repo.tasaIsv()` la lee y valida el rango | — |

### 11.4 Lo que cruza los tres roles

| Tema | Estado | Tarea |
|---|---|---|
| ~~Correo 1 con PDF al coordinador~~ | ✅ **Resuelto**: va al coordinador asignado o al alias; nunca al solicitante | — |
| Correos 2 y 3 | LISTO | — |
| ~~Correo 4 (decisión registrada)~~ | ✅ **Resuelto 2026-10-03** | — |
| ~~Correo 5 (alerta)~~ | ✅ **Resuelto 2026-10-14** (4.9.4 y 4.10.2): va al coordinador asignado (con caída al alias) y a administración, deduplicando; y la alerta de inactividad ya puede dispararse | — |
| Registro de correos en DB | LISTO — `enviado`/`fallido` + `intentos` + `errorDetalle` | — |
| Trazabilidad de transiciones (RF-49) | LISTO — evento en la misma transacción | — |
| ~~Eventos de creación/cotización/comparativa/correo/acceso~~ | ✅ **Resuelto 2026-10-14** (4.10.3): ya se insertan | — |
| ~~Exposición de montos al solicitante en `/mis-solicitudes/[id]`~~ | ✅ **Resuelto 2026-10-14** — el detalle muestra el conteo, no los importes. Ver 4.8.7 | — |
| OCR serverless | **A MEDIAS** — degrada a carga manual en Vercel | 4.5.1 |
| ~~Referencia real~~ | ✅ **Resuelto 2026-10-14** (4.1.1) | — |
| PDF con el diseño oficial | **FALTA** — hay membrete BIA, no el formato de Ladi | 4.1.2 |

---

## Registro de cambios de este documento

| Fecha | Qué cambió |
|---|---|
| 2026-10-02 | Creación. Auditoría de `specs/`, `docs/`, `qa/`, `.harness/`, migraciones y working tree. Tests verificados: 230/7. e2e no re-corridos. |
| 2026-10-02 | **Verificación funcional por rol contra código** (§11): inventario completo de los 3 roles con estado LISTO / A MEDIAS / FALTA. Agregadas §4.7 (integridad RN-01), §4.8 (seguridad), §4.9 (correos), §4.10 (reglas y trazabilidad). **§7 reescrito**: 4 hallazgos refutados (A8, B5, A7, D2) y 12 nuevos, 6 de ellos críticos. §10 reordenado por gravedad real |
| 2026-10-02 | Post-commit `b28c5cd`: §3 reescrito como resuelto (con la tabla de las 9 piezas), §8 marcada resuelta tras unificar `.harness/`, §10 reordenada, tareas 6.12–6.15 agregadas (credenciales en QA, test de moneda, `doc-references`, specs históricos). Nombrada lista oficial de tareas en `AGENTS.md`. |
| 2026-10-15 | **Corrección de deriva del documento** (el tablero mentía en ~15 filas). §0: los 6 críticos figuran como cerrados. §1: **B3 resuelto** (ADR 0007). §2: calidad real medida (`146e20f`): **505 tests / 58 archivos**, **19/19 migraciones**, higiene 0. §4.2: 4.2.1 resuelto, 4.2.2 verificado pendiente. §5.2: contradicción de D11 resuelta por ADR 0008. §10: reordenada a lo que de verdad queda. §11: filas de 4.10.1, 4.10.2, 4.10.3/4, 4.10.6–4.10.9, 4.4.7/8/9, 4.1.1 y 4.3.1 alineadas con §4; el aviso de monedas (4.10.10) tenía mal la referencia (decía 4.10.7). Se separan dos cosas que 4.1.1 no cubría: `4.1.1-b` (UI y unicidad del formato de referencia) y `4.1.1-c` (la referencia antes de enviar) |
| 2026-10-15 | **D11 cerrado** (idioma). El barrido encontró **4 mensajes reales de UI** en voseo, no 1: `panel/page.tsx` y **3 en `lib/domain/archivos.ts`** (que el conteo inicial no vio). Los otros 2 strings eran comentarios; los e2e no tenían voseo. Se decide **no** reescribir el prompt de IA (su salida ya es "usted", verificado en vivo). Además: **4.7.5 no reproducible** (505/505 con la clave puesta) y se documenta su causa real — el cliente de IA no funciona bajo jsdom (`AbortSignal`), por lo que `vitest.setup.ts` dejó de asumir DOM |
| 2026-10-15 | **4.8.11 cerrado** (seguridad). `POST /logo` no validaba nada: cualquiera con el UUID reemplazaba el logo de una solicitud ajena —peor que el GET, que sí estaba protegido—. Se le aplica el mismo guard (rol de Compras o el correo dueño), **antes** de leer el cuerpo. El cliente manda el correo; se verificó en rojo contra el código anterior y de punta a punta con curl (401 sin correo, 401 ajeno, 200 dueño y archivo escrito). Decisión registrada: no se hizo el "token de un solo uso" que pedía la nota, porque el correo es la identidad de todo el flujo sin login |
| 2026-10-16 | **B5 / 4.8.12 — la base de Supabase estaba abierta con la `anon` key** (crítico). El linter de Supabase avisaba de RLS desactivado; al verificarlo resultó peor: con la `anon` key (que **se envía al navegador**) se podía **leer y escribir** todo `public` —`usuario` devolvía 7 filas reales y un `POST` anónimo devolvía 201—. Se escribió `migrations/020_rls_deny_all.sql` (RLS deny-all sin políticas + revocar `anon`/`authenticated` + quitar los privilegios por defecto de las tablas futuras) y se **probó en local**: 18/18 tablas con RLS, un rol con `GRANT` pasó de ver 13 filas a 0, y 510/510 tests siguen pasando. **Falta correrlo en Supabase** (dashboard): es lo único que no puedo cerrar yo |
| 2026-10-17 | **4.5.1 cerrado** (OCR serverless). `/api/convertir` dependía de `python3` + `markitdown`, que no existen en Vercel: en producción fallaba **siempre** y el coordinador cargaba a mano; además el helper ejecutaba el script **dos veces**. Ahora convierte un **modelo multimodal de OpenRouter** (PDF e imágenes, sin binarios ni temporales), elegido así porque la app acepta también PNG/JPG y las cotizaciones suelen venir escaneadas. Verificado en vivo (PDF y PNG → 200 con todos los montos) y en rojo contra la versión anterior. Se borraron `lib/pdf/convert.ts`, `scripts/convert-document.py` y el paso de Python de `docs/guia-pruebas-local.md`. De paso se corrigieron 2 strings de UI en tú ("Revisa…", "Intenta…") que el barrido de D11 no vio |
| 2026-10-18 | **4.4.10 cerrado** (alertas) por un subagente, con revisión mía. Tres cosas: `discrepancia` dejó de ser código muerto (la ruta nunca pasaba `discrepanciasPorSolicitud`; ahora lo arma desde `comparativa.discrepancias_detectadas`), el panel dejó de decir "N enviadas" cuando contaba **detectadas**, y hay selección por tipo + previsualización. Decisión del usuario: **solo `inactividad` envía correo**. Se descubrió **4.4.11**: ese botón **también** manda los recordatorios RF-62 de todas las solicitudes — durante la prueba en navegador salió un **correo real a `bbonilla@biabrands.co`** (registrado en `correo_enviado` tipo 8; no se borró porque es un registro verdadero y borrarlo provocaría un reenvío). Los "3 fallos preexistentes" que reportó el subagente **no eran reales**: en `main` pasan 27/27 y la suite completa quedó en **529/529** |
| 2026-10-19 | **4.4.11 cerrado.** La lógica de recordatorios (correo 8) estaba **duplicada** y escondida dentro de la ruta de alertas. Se extrajo a `lib/mail/recordatorios.ts`, el cron pasó a usarla, y el admin tiene una **acción separada** con preview, confirmación y botón deshabilitado si no hay pendientes. Tests: el de la ruta de alertas **fallaba con `['5','5','8']`** y ahora pasa; 5 tests nuevos de la ruta de recordatorios. Verificado en navegador (preview "No hay recordatorios pendientes", botón apagado; **cero correos enviados**). 535 tests |
| 2026-10-19 | **4.8.6 cerrado** (validación del logo). El cliente validaba los magic bytes, pero el servidor solo miraba el tamaño: con curl se guardaba un ejecutable renombrado a `.png` o un PDF truncado. Ahora valida **extensión + contenido** y responde 415; decide por extensión y bytes, **no** por el `Content-Type` declarado (un `application/octet-stream` rechazaría archivos válidos). El tope de 4 MB se sigue mirando antes de leer. Verificado con curl: renombrado 415, `.txt` 415, PNG válido 200 (y escrito en la base). De paso se separa **4.8.13**: que el servidor **exija** el logo cuando hay branding es otra cosa y sigue abierta |
| 2026-10-20 | **4.2.2 cerrado** (producto/servicio en la comparativa). El glosario la define como "el producto/servicio a la izquierda y un proveedor por columna", pero ni la pantalla del coordinador, ni la hoja "Comparativo" del Excel, ni el enlace público decían qué se comparaba. Los tres encabezan ahora con tipo + título + detalle (`etiquetaSubtipo`); sin subtipo dicen "No especificado". La API pública devuelve solo esos tres campos (no la solicitud completa). 5 tests en rojo contra el código anterior; verificado en navegador en las dos superficies |
| 2026-10-21 | **Correos con diseño** (4.9.5). Los 8 salían como texto plano. Layout corporativo compartido (logo, barra, píldora, tabla, destacados, CTA, pie) con estilos inline; logo por URL absoluta desde `public/`. Copy migrado a usted (11 strings). Verificado en navegador y con tests. Además: **PDF rediseñado** (Carta, Geist, logo limpio, tabla y paginación real) — ver commit `70eee5c` |
| 2026-10-21 | **Documentos adjuntos (4.12.1)**. La tabla `adjunto` estaba sin usar. Migración 021 (contenido + fecha + evento). Suben coordinador, admin y solicitante; tipos PDF/Word/PowerPoint/imágenes con validación de contenido en servidor; visibles en los tres portales y **no** en el enlace público; borrado con confirmación y permisos por autor; evento de trazabilidad; **correo 9** al otro lado. Verificado en navegador en las 3 superficies y con 10 tests |
| 2026-10-21 | **Migración a Supabase ejecutada** (B1). Esquema limpio (`DROP SCHEMA public CASCADE`) + 21 migraciones: 18 tablas, RLS 18/18, 7 usuarios, 24 campos y 3 plantillas. PostgREST sigue cerrado (401). Verificado en la nube: login real, dashboard y un alta escrita y borrada. La suite corre contra la base local con `TEST_DATABASE_URL`. Queda cargar las variables en Vercel al desplegar |