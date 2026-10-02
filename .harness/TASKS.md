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
> **Regla de actualización:** al cerrar un bloque de trabajo, se mueve la fila de
> "Por hacer" a "Listo" con la evidencia concreta (commit, test, captura). Sin evidencia, no
> se marca. Los `specs/*/tasks.md` y `specs/009/assessment.md` son **históricos**, no fuentes.
>
> **Regla de honestidad:** distingo siempre entre *verificado hoy* (lo corrí), *reportado por
> documentación* (puede estar viejo) y *inferido*. No marco nada como listo sin haberlo visto.

---

## 0. Estado real en una línea

El producto **funciona de punta a punta** y está verificado. Pero una verificación de cada
función contra el código (§11) encontró **6 problemas críticos** que ninguna lista tenía:

- **B3 no se valida en el servidor** y la UI afirma que sí → se puede enviar la comparativa al
  solicitante sin recomendación humana. Rompe RN-01.
- **`GET /api/solicitudes/[id]` sin autenticación** → fuga precios, ISV y PII a cualquiera con
  el UUID.
- **Sin aislamiento entre coordinadores** → cualquier coordinador toca cualquier solicitud.
- **Correo 4 nunca se envía** → el ciclo cierra sin notificar a Compras.
- **"Ninguna me sirve" cierra la solicitud** en vez de reabrirla, y la UI promete lo contrario.
- **El correo 1 cae al propio solicitante** si falta `MAIL_COORDINADOR_DEFAULT`.

Los tres últimos son bugs de integridad del ciclo, los tres primeros son de seguridad/RN-01.
Detalle y evidencia en §4.7, §4.8, §4.9 y §11.

`.harness/STATE.md` y `.harness/HANDOFF.md` ya no son fuente de estado: el primero es un
puntero a este archivo y el segundo quedó marcado como histórico.

---

## 1. BLOQUEANTES — hacer antes de producción

Ordenados por gravedad. Ninguno es código nuestro: dos son del cliente, uno es higiene nuestra.

| # | Tarea | Quién | Por qué importa | Dónde está registrado |
|---|---|---|---|---|
| **B1** | **Rotar la contraseña de Postgres** y actualizar `DATABASE_URL` al pooler | **Cliente** 🔴 | La contraseña está expuesta en chat. Es el activo más sensible del proyecto. | `specs/009.../assessment.md:127` |
| **B2** | **Verificar el dominio de correo en Resend** | **Cliente** 🔴 | Hoy el remitente es un placeholder (`no-reply@compras.bia`) → todos los correos quedan registrados como `fallido`. El ciclo notifica a nadie. | `specs/009.../assessment.md:125` |
| **B3** | **Aceptación por escrito del riesgo del link público** | **Cliente** 🔴 | El enlace expone precios de proveedores a cualquiera que lo tenga. Aparece 4 veces en la documentación como *"debe quedar aceptado por escrito antes de producción"* y **no consta que se haya obtenido**. | `prd.md:244`, `brief.md:45`, `architecture.md:98` |
| **B4** | Obtener confirmación escrita de las 6 decisiones D1/D2/D3/D7/D9/D10 | **Cliente** 🟠 | Sin esto el piloto arranca sobre base no aprobada. El documento mismo dice *"se requiere confirmación por escrito"*. | `propuesta-decisiones-piloto.md:5, 26-38` |

**Ninguno de los 4 lo puedo cerrar yo.** Los tres primeros necesitan una acción del cliente.
Decí explícitamente si querés que los persiga con un correo redactado o los dejamos anotados.

---

## 2. Lo que está listo y verificado

Verificado hoy por mí salvo donde se indica otra cosa.

### Ciclo completo (una solicitud real, de punta a punta)
- Solicitante crea → clasifica (IA) → assessment → genera PDF → envía → llega a la bandeja del coordinador.
- Coordinador ve bandeja, carga cotizaciones, extrae con IA, genera comparativa, recomienda, manda enlace.
- Solicitante decide por token público; la solicitud cierra.
- Admin ve KPIs reales, alertas, exporta Excel.

### Calidad actual (medido hoy, `6dc64d5`)
| Batería | Resultado |
|---|---|
| Tests unitarios | **230 pasan · 7 skip** (29 archivos, 2 skip) |
| `tsc --noEmit` | limpio |
| `eslint` | **0 errores** |
| Migraciones | **17 en disco, 17 aplicadas** — sin divergencia |
| e2e (Playwright) | 5 specs existen. **NO los re-corrí**; la última cifra registrada es 22/22 (`e8ff42b`) |

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
| 4.1.1 | **Generar `numero_referencia` real** (`{TIPO}-{AÑO}-{SECUENCIA}`) en backend | RF-20 | Hoy el panel usa un fallback `SOL-XXXXXXXX` derivado del id. El tipo ya se persiste, así que es viable. Deuda declarada dentro de la 008 cerrada. |
| 4.1.2 | **PDF con el diseño vertical oficial** | — | `plantilla-generica.ts` tiene membrete BIA pero no el formato exacto del RFQ de Ladi. Depende de insumos del cliente. |

### 4.2 Comparativa y ahorro
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.2.1 | **Ahorro potencial en los pros** | — | ❌ **Hallazgo abierto**: cuando la IA responde los pros, reemplazan a los determinísticos y el ahorro desaparece (`comparativa.ts:226`). Registrado como `B5 ❌` en el checklist 3-roles. |
| 4.2.2 | **Producto/servicio + detalle en la comparativa** | 2.1 / 3.2 | Mismo ítem, marcado dos veces. |
| 4.2.3 | Alertas por tipo (sin desglose, discrepancia, una sola cotización) | RF-54 / H4.4 | Diferido a Fase 3. |

### 4.3 Flujo de re-cotización
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.3.1 | **UI de re-cotización del solicitante** | 2.3 | ❌ **Hallazgo abierto**: los endpoints y las transiciones `COMPARATIVA_LISTA↔EN_COTIZACION` existen, pero **ningún botón los invoca**. Registrado como `A8 ❌`. |

### 4.4 Administración (Sprint 4 residual)
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.4.1 | **RF-54/RF-55 — versionado de plantillas y campos**; la solicitud debe conservar su versión de origen | RF-54, RF-55 | Explicitamente "queda para otra feature" en el spec de la 008. |
| 4.4.2 | **RF-56 — CRUD de coordinadores/categorías/reglas** desde la UI de admin | RF-56 | Parcial: las reglas por categoría existen; el CRUD no. |
| 4.4.3 | **H4.5 — RLS, seguridad por fila** | H4.5 | Pospuesto. **Además depende de una decisión abierta de Lady** (Q2: ¿los coordinadores ven solicitudes ajenas?). |
| 4.4.4 | Dashboard: distribución por subtipo, tiempo por etapa, rango personalizado | RF-51, RF-52 | "H4.1 menor". |
| 4.4.5 | Indicador de inactividad en la bandeja del coordinador | — | `user-flows.md:170` lo marca "(pendiente)". |
| 4.4.6 | Área como catálogo en vez de texto libre | — | Depende de la lista oficial de áreas de BIA. |
| **4.4.7** | **Editar un campo de catálogo por UI** | medio | El endpoint acepta `label` pero ninguna UI lo llama. Si se llamara, el handler manda atributos **hardcodeados** y el upsert total **destruye** el resto del campo |
| **4.4.8** | **409 al crear un campo con `campoKey` existente** | bajo | Hoy `ON CONFLICT DO UPDATE` sobrescribe en silencio y devuelve 201 |
| **4.4.9** | **Borrar un campo de catálogo** | bajo | No hay `DELETE` en ninguna de las dos rutas |
| **4.4.10** | **Alertas: selección por tipo y preview** | medio | 4 tipos detectados, **solo `inactividad` se notifica**. `discrepancia` nunca se emite (no se pasa `discrepanciasPorSolicitud`). Un botón único que lo dispara todo, sin preview |

### 4.5 OCR y conversión
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.5.1 | **OCR funcional en serverless** | — | `/api/convertir` sin Python en Vercel → **degrada a carga manual**. Además `convert.ts:36` ejecuta el script dos veces y descarta la primera salida |
| 4.5.2 | **Fecha requerida no admite fechas pasadas** | medio | `<input type="date">` sin `min`; sin validación en cliente ni servidor |
| 4.5.3 | **Descripción breve obligatoria** | medio | La doc la marca obligatoria. No está en `pasoValido` ni en `faltantes`; la API la acepta como optional |
| 4.5.4 | **Retomar borrador desde P1** | medio | `app/page.tsx:22` borra el borrador antes de navegar con `?nuevo=1`, dejando el modal inalcanzable por ese camino |
| 4.5.5 | **Alinear el tope de preguntas con la norma** | bajo | `MAX_PEGUNTAS = 10`, la doc pide 6. Y puede exceder 10 cuando hay obligatorios (deliberado: preferimos exceder que truncar un obligatorio) |
| 4.5.6 | **Persistir las respuestas del assessment** | medio | Viajan al PDF de Compras pero nunca se guardan en `respuesta_campo`. Como dato estructurado no existen |

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
| **4.7.1** | **B3 (recomendación humana obligatoria) validada en el SERVIDOR** | **FALTA** — la UI afirma lo contrario | `app/api/solicitudes/[id]/estado/route.ts:108` → `if (body.nota?.trim()) { await guardarRecomendacionComprador(...) }`. Si la nota viene vacía **no hay 400 ni 409**: simplemente no guarda y sigue, crea el enlace público y manda el correo 3. Un `PATCH` directo **envía la comparativa al solicitante sin recomendación humana**. Mientras tanto `components/coordinador/Recomendacion.tsx:143` dice literalmente *"Bloqueo duro B3: se valida también en el servidor"*. La UI **miente** sobre su propia garantía |
| **4.7.2** | **Correo 4: decisión registrada → coordinador + admin** | **FALTA** | No existe. `grep 'tipoCorreo: "4"'` → 0 resultados. Solo se envían 1, 2, 3 y 5. `decision/route.ts:49-59` cierra la solicitud **sin notificar a nadie**: el coordinador se entera solo si mira la bandeja |
| **4.7.3** | **"Ninguna me sirve" reabre en `EN_COTIZACION`** | **FALTA** — cierra en su lugar | `decision/route.ts:50-59` → `estadoFinal: "CERRADA_SIN_DECISION"`. La UI le dice al solicitante *"la solicitud vuelve a revisión"* (`VistaPublica.tsx:58,224`). La máquina de estados **sí permite** `ENVIADA_A_SOLICITANTE → EN_COTIZACION` (`state-machine.ts:10`) pero **nadie la invoca**. El sistema hace lo contrario de lo que promete en pantalla |
| 4.7.4 | `clasificacion_corregida` se persiste (métrica de precisión del doc 16) | FALTA | El flag existe en estado y borrador pero **no viaja al servidor** y ningún INSERT/UPDATE lo escribe. La métrica de "precisión del clasificador" **no se puede calcular** |

### 4.8 Seguridad — fronteras entre roles ⚠️ CRÍTICO

`docs/product/prd.md` define un rol por persona. Estas rutas lo rompen.

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| **4.8.1** | **`GET /api/solicitudes/[id]` con autenticación** | **FALTA** — fuga abierta | `route.ts:14-29`: el archivo **importa `guardApi`** y el `PATCH` de la misma ruta lo usa, pero el `GET` **no**. Devuelve solicitud + **cotizaciones con precios, ISV y emails** a cualquiera con el UUID. Viola RN-06 |
| **4.8.2** | **`GET /api/solicitudes/[id]/documento` y `/logo` verifican pertenencia** | **FALTA** | Con el UUID se descarga el PDF y el logo de **cualquier** solicitud. El solicitante no tiene sesión, así que no se puede verificar por cookie: hay que decidir por otro medio |
| **4.8.3** | **Aislamiento horizontal entre coordinadores** | **FALTA** | Todas estas rutas exigen rol `coordinador` pero **ninguna comprueba que la solicitud sea del coordinador autenticado**: `estado`, `comparativa`, `cotizaciones`, `[cotizacionId]`, `route.ts` PATCH. Cualquier coordinador transiciona, cotiza, edita o borra **cualquier** solicitud. El `PATCH` de cotizaciones además **ignora el `id`** de la ruta y usa el del body |
| **4.8.4** | Bandeja del coordinador: el `coordinadorId` viene de la sesión, no del cliente | **FALTA** | `app/api/solicitudes/route.ts:89` acepta `?coordinadorId=<otro>`. Además `app/panel/layout.tsx:26`: si el email del auth no está en `usuario`, cae a `coordenadores[0].id` y **muestra la bandeja de otro coordinador en silencio** |
| 4.8.5 | `guardApi` en todas las rutas `/api/admin` | **A MEDIAS** | `alertas/ejecutar`, `campos`, `campos/[id]`, `coordinadores`, `metricas`, `metricas/excel` dependen **solo del middleware**. Las que sí lo tienen: `reasignar`, `comparativa`, `estado`, `cotizaciones/*`. Inconsistente |
| 4.8.6 | Validación de tipo/MIME del logo en servidor | **A MEDIAS** | `logo/route.ts:18-27` solo valida tamaño. El cliente sí valida magic bytes (`archivos.ts`), el servidor no |
| **4.8.7** | **`/mis-solicitudes/[id]` no debe exponer montos** | **crítica** | El listado respeta RN-06, pero el **detalle lista proveedores con su monto total** (`[id]/page.tsx:92-111`). El propio repo afirma lo contrario en `postgres-repo.ts:425` ("sin montos") |

### 4.9 Correos — el ciclo tiene huecos

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| **4.9.1** | **Correo 1 no debe caer al solicitante** | **CRÍTICO** | `lib/pdf/pipeline.ts:90` → `process.env.MAIL_COORDINADOR_DEFAULT ?? solicitud.solicitanteEmail`. Sin esa env (**no está en `.env.example`**), el correo 1 —que lleva el PDF de la solicitud— **se le manda al propio solicitante** |
| 4.9.2 | Correo 4 (decisión registrada) | FALTA | ver 4.7.2 |
| 4.9.3 | Correo 3 con trazabilidad | **A MEDIAS** | Se dispara en background y sus excepciones se tragan (`estado/route.ts:191-193`). Sin evento `envio_correo` en la timeline |
| 4.9.4 | Correo 5 al coordinador afectado | **A MEDIAS** | Solo va al `destinatario_alertas` global. La doc dice "coordinador + administración" |

### 4.10 Reglas de negocio y trazabilidad

| # | Tarea | Estado real | Evidencia |
|---|---|---|---|
| **4.10.1** | **Tasa ISV desde `configuracion`, no hardcodeada** | **FALTA** | `cotizaciones/route.ts:191` → `0.15` fijo. La clave `tasa_isv` **no existe** en `configuracion` (solo hay 3: umbral, expiración, destinatario). El doc 16 §2.4 exige explícitamente *"tasa de configuración, no del prompt"*. Además `rules.ts:63-114` valida `neto+isv+otros≈total` pero **ignora la tasa** |
| **4.10.2** | **La alerta de inactividad puede dispararse alguna vez** | **FALTA** | `lib/domain/alertas.ts:37` → `!s.fechaEnvio`. Pero toda solicitud que llega al panel **ya fue enviada**, y la API del panel excluye borradores. **La alerta que el producto promete es inalcanzable** |
| 4.10.3 | Eventos de trazabilidad que faltan | **A MEDIAS** | La UI **renderiza** `creacion`, `carga_cotizacion`, `generacion_comparativa`, `envio_correo` y `acceso_link`, pero **nunca se insertan**. La timeline no muestra la creación, ni cuántas cotizaciones se cargaron, ni cuándo se generó la comparativa. Es un esqueleto |
| 4.10.4 | `descripcionEvento` para todos los tipos | **A MEDIAS** | Faltan los `case` de `reasignacion`, `cancelacion`, `envio_correo`, `acceso_link` → caen a `default: return ""` y la tarjeta sale con el div vacío |
| 4.10.5 | `transicionarEstado` valida la máquina de estados | **A MEDIAS** | `postgres-repo.ts:240-301` **no valida**; la validación vive solo en la ruta HTTP. Si otro endpoint llama al repo directo, puede saltar estados |
| 4.10.6 | Excel comparativo: sección de análisis con pros/contras | **A MEDIAS — bug** | `lib/excel/comparativo.ts:80` lee `prosContras[c.proveedorNombre]`, pero el dato se persiste indexado por **`cotizacion.id`**. La sección siempre sale con "—". El test pasa porque el fixture usa claves por nombre: **el test no detecta el bug** |
| 4.10.7 | `fusionarProsContras` reinyecta todos los pros/contras deterministas | **A MEDIAS** | `comparativa.ts:167-177` solo recupera los que empiezan con "Ahorro". Cuando la IA responde, **se pierden el resto de pros y todos los contras deterministas**: RN-06 queda en manos del modelo |
| 4.10.8 | Detección determinística de discrepancias | **A MEDIAS — inerte** | `comparativa/route.ts:33,100` pasa `especificacionesSolicitadas: {}` hardcodeado, y `comparativa.ts:28-47` itera ese objeto vacío. **Sin IA configurada → cero discrepancias siempre**. Y la UI solo muestra `[0]`, así que aunque la IA devuelva varias, se pierden |
| 4.10.9 | **KPI "Sin decisión" debe leer el umbral configurado** | medio | `repo:835` lo fija en 5 y la UI nunca manda `umbralDias`; el valor de `/admin/configuracion` solo lo lee `alertas/ejecutar`. Además **incluye borradores** y la etiqueta "> 5 días" está cableada al literal |
| 4.10.10 | Aviso de monedas distintas en la comparativa del coordinador | bajo | La conversión orientativa existe pero solo en la vista pública |

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

⚠️ **Contradicción a resolver:** D11 dice que el registro es *"Usted"*, pero **toda la UI usa
voseo** ("necesitás", "podés"). Alguien tiene que elegir.

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
| **B5** | Ahorro potencial no aparece con los pros de la IA | ❌ "`comparativa.ts:226` reemplaza los pros" | **REFUTADO.** Esa línea es `especificacionesSolicidadas`. La fusión real es `fusionarProsContras` (`:167-177`, aplicada en `:240-244`) y **sí reinyecta** el ahorro, con test. **Pero es parcial**: solo los pros con prefijo "Ahorro"; el resto de pros y todos los contras deterministas se pierden. Ver 4.10.7 |
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

### 7.1 Hallazgos NUEVOS que no estaban en ningún checklist

Salieron de la verificación de §11 contra código:

| # | Hallazgo | Gravedad |
|---|---|---|
| 4.7.1 | B3 no validado en servidor + la UI afirma que sí | **crítica** |
| 4.7.2 | Correo 4 (decisión registrada) nunca se envía | **crítica** |
| 4.7.3 | "Ninguna me sirve" cierra la solicitud en vez de reabrirla | **crítica** |
| 4.8.1 | `GET /api/solicitudes/[id]` sin auth: fuga precios + PII | **crítica** |
| 4.8.3 | Sin aislamiento horizontal entre coordinadores | **crítica** |
| 4.9.1 | Correo 1 cae al solicitante si falta `MAIL_COORDINADOR_DEFAULT` | **crítica** |
| 4.10.1 | Tasa ISV hardcodeada, no de configuración (contra doc 16) | alta |
| 4.10.2 | La alerta de inactividad no puede dispararse nunca | alta |
| 4.10.6 | Excel comparativo siempre "—" en pros/contras, y el test lo tapa | media |
| 4.10.7 | `fusionarProsContras` descarta pros y contras deterministas | media |
| 4.10.5 | `transicionarEstado` del repo no valida la máquina de estados | media |
| — | `GET /api/solicitudes/[id]/documento` y `/logo` sin chequeo de pertenencia | alta |


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

**El orden cambió.** La verificación de §11 encontró cosas más graves que todo lo que había en
la lista. Primero lo que rompe la integridad del ciclo.

1. **B3 en el servidor (4.7.1)** y **corregir el texto de la UI que afirma lo contrario**. Es
   RN-01: hoy el sistema puede enviar una comparativa sin decisión humana. Con test de servidor.
2. **`GET /api/solicitudes/[id]` con `guardApi` (4.8.1)** + `/documento` y `/logo` (4.8.2).
   Fuga abierta de precios y PII. Lo más rápido de cerrar y lo más grave por impacto.
3. **Aislamiento entre coordinadores (4.8.3, 4.8.4)** — que el `coordinadorId` venga de la
   sesión y que cada ruta verifique pertenencia.
4. **Correo 4 (4.7.2)** y **corregir el fallback del correo 1 (4.9.1)**. El ciclo no notifica.
5. **"Ninguna me sirve" reabre en `EN_COTIZACION` (4.7.3)** y avisa a Compras. La transición ya
   existe en la máquina de estados, nadie la invoca.
6. **Tasa ISV desde configuración (4.10.1)** y **que la alerta de inactividad pueda dispararse
   (4.10.2)**. El doc 16 lo pide; hoy está hardcodeada e inalcanzable.
7. Prueba manual del bloque de assessment (§2, `6dc64d5`) — lo único con evidencia solo de
   navegador automatizado.
8. Lo demás de §4, por valor: 4.10.6, 4.10.7, 4.10.3, 4.4.2, 4.1.1.

Los bloqueantes B1–B4 (§1) no dependen del equipo interno: van por correo al cliente.

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
| B2 (logo obligatorio si hay branding) | Cliente bloquea bien. **El servidor NO**: `POST /api/solicitudes` y el PATCH de estado aceptan el envío sin logo. Se puede saltar por API | 4.8.6 |
| B1 (obligatorios de plantilla) | **No bloquea**: avisa y deja "Enviar de todos modos". Contradice la doc, pero es decisión deliberada y argumentada | — |
| Máximo de preguntas | `MAX_PEGUNTAS = 10`, la doc pide 6. Y `consolidarPreguntas` puede exceder 10 porque los obligatorios nunca se recortan (deliberado) | 4.5.5 |
| Respuestas del assessment persistidas | Viajan al PDF de Compras pero **nunca se guardan en `respuesta_campo`**. Como dato estructurado no existen: solo se persisten por la ruta de re-cotización | 4.5.6 |
| PDF del paso 6 | Se regenera con `respuestas: {}` (sin las respuestas) y es un endpoint **público** que regenera por id | 4.8.2 |
| Referencia en P5 antes de enviar | La doc la pide antes; el código muestra un placeholder `RFQ-2026-XXXX` y la asigna al transicionar | 4.1.1 |
| Nombre del comprador en P6 | Muestra texto fijo "Equipo Compras BIA" aunque el solicitante **eligió** comprador y el servidor lo asignó. El nombre real está en `estado.coordinadorId` y no se usa | — |
| CTA "Decidir ahora" | Solo funciona si el token se guardó en **ese** navegador. Si se decidió en otro dispositivo, solo queda "abrilo desde el correo". Decisión de privacidad explícita, pero no documentada | — |
| Barra de progreso | El rail tiene **5** pasos, la doc dice "paso 2 de 4" | — |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| Autocompletar nombre/área desde el histórico del correo | No existe endpoint. Debería haber uno tipo `GET /api/solicitudes/ultima?email=` | — |
| Botón "Atrás" en P2 | `<PasoAcciones>` sin prop `atras`. **No hay forma de volver a P1** | — |
| Re-cotización del solicitante | No hay UI ni permiso (`guardApi` la excluye por diseño) | 4.3.1 |
| Cerrar la solicitud tras decidir, en la vista pública | El enlace **no se revoca** y la vista sigue mostrando tarjetas y botones "Elegir esta opción". El 409 solo aparece **después** de intentar enviar | 4.7.3 |
| Notificación al decidir | El correo 4 no existe | 4.7.2 |

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
| Exportar comparativo a Excel (con el bug de 4.10.6) | `comparativa/excel/route.ts` |

**A MEDIAS**
| Funcionalidad | Qué falta | Tarea |
|---|---|---|
| **Ver solo solicitudes asignadas** | El `coordinadorId` lo manda el cliente y el server **no lo cruza con la sesión**: cualquier coordinador pide `?coordinadorId=<otro>` y ve la bandeja ajena. Y si su email no está en `usuario`, cae a `coordenadores[0]` y ve **la bandeja de otro en silencio** | 4.8.4 |
| **Aislamiento por solicitud** | Todas las rutas exigen rol pero **ninguna comprueba pertenencia**. Cualquier coordinador transiciona, cotiza, edita o borra cualquier solicitud | 4.8.3 |
| Navegación entre etapas | Solo el paso **08** se bloquea sin 2 cotizaciones. El **09 sigue accesible** con 0 → se llega a una pantalla vacía y se puede pulsar "Enviar" (el server responde 409, pero es un callejón sin salida) | — |
| Panel lateral del detalle | **Falta `fecha de creación`** y **falta el tipo RFI/RFQ/RFP** (muestra la categoría en su lugar) | — |
| Orden de la bandeja | La doc pide `fecha requerida ASC`; el código usa `fecha_creacion DESC` | — |
| Conversión del archivo a Markdown | Depende de **python3 + markitdown en el runtime**. En Vercel serverless **no funciona** → degrada a carga manual. Además `convert.ts:36` **ejecuta el script dos veces** y descarta la primera salida | 4.5.1 |
| Slots de proveedor | Hay que **crear la cotización manual primero** y solo después adjuntar. El archivo no se puede subir antes de tener los datos | — |
| Estados del archivo | Faltan "Sin archivo aún" / "convertido a Markdown ✓" | — |
| Editar/borrar cotización | El servidor **ignora el `id`** de la ruta y usa el del body, sin verificar pertenencia | 4.8.3 |
| Confirmación de borrado | `borrandoId === borrandoId` siempre true → nunca muestra "Eliminando…" | — |
| Observación fiscal antes de precios | Existe y va antes, pero solo muestra `[0]` (se pierden las demás) y el **detector determinístico nunca producirá nada**: `comparativa/route.ts:33,100` pasa `especificacionesSolicitadas: {}` hardcodeado | 4.10.8 |
| Aviso de monedas distintas | La conversión orientativa existe pero **solo en la vista pública**. En la del coordinador no hay ninguna observación | 4.10.7 |
| Obs. fiscal por cotización | Se muestra en etapa **07**, la doc la ubica en la comparativa (08) | — |
| Corregir el ahorro con la IA | La fusión solo recupera los pros "Ahorro"; **el resto de pros y todos los contras deterministas se pierden** → RN-06 queda en manos del modelo | 4.10.7 |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| **B3 en servidor** | El server no valida; la UI **afirma que sí**. Envío sin recomendación humana por API | 4.7.1 |
| Marcador "Nueva" para recién asignadas | El tone `nueva` existe en `Badge.tsx:21` pero está asignado a la categoría `capex_indirectos` | — |
| Bloque "Registro de solicitud en proceso" | Está en la doc, **cero coincidencias** en el código | — |
| **Correo 4** | El ciclo cierra sin notificar al coordinador | 4.7.2 |
| Re-cotización por el **solicitante** | El backend tiene `PATCH`; el solicitante no tiene UI ni permiso | 4.3.1 |

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
| Configuración: umbral, expiración de enlace, destinatario (upsert real) | `admin/configuracion/page.tsx:49-86` |
| Perfil admin: **read-only y lo declara** | `admin/ajustes/page.tsx:15-48` — correcto, honesto |
| `/admin/procesos` kanban por tipo | `admin/procesos/page.tsx:29-74` |

**A MEDIAS**
| Funcionalidad | Qué falta | Tarea |
|---|---|---|
| **KPI "Sin decisión > 5 días"** | El umbral está **hardcodeado a 5** (`repo:835`) y la UI **nunca manda `umbralDias`**. El valor que el admin guarda en `/admin/configuracion` **solo lo lee `alertas/ejecutar`**. Además **incluye borradores**: un borrador de 8 días cuenta como "sin decisión". Y la etiqueta "> 5 días" está cableada al literal | 4.10.9 |
| Filtro "Hoy" | Mapea a `rango=dia` = `now() − 1 día`, o sea **las últimas 24h**, no el día calendario. Además el `minIso` del filtrado client-side se calcula en el `.finally()` del fetch de procesos: hay una ventana con el filtro aplicado sin `minIso` | — |
| Tabla de procesos | La doc pide columna "tipo"; la tabla muestra **categoría** y no hay columna de tipo | — |
| Detalle de coordinador en `/admin/coordinadores` | **Dos definiciones distintas de "tiempo de proceso" en el mismo rol**: aquí `fechaCierre − fechaCreacion`, en el KPI `fechaCierre − fechaEnvio` | — |
| **Editar un campo de catálogo** | El endpoint acepta `label` pero **ninguna UI lo llama**. Y si se llamara, el handler manda `tipoDato:"texto", origen:"assessment", obligatorio:false, orden:100, activo:true` **hardcodeados** → **destruye el resto de los atributos** (upsert total) | 4.4.7 |
| Crear campo con `campoKey` existente | `ON CONFLICT (campo_key) DO UPDATE` **sobrescribe en silencio** y devuelve 201. Sin 409 ni advertencia | 4.4.8 |
| `guardApi` en las rutas admin | 6 rutas dependen **solo del middleware**. Inconsistente con las que sí lo tienen | 4.8.5 |
| Alertas: ejecutar y registrar | Carga **todas** las solicitudes + cotizaciones (N+1, sin filtro) y devuelve `{alertas, correosEnviados}`. La UI solo lee `d.alertas.length` | — |
| Alertas: la UI confunde estados | Si `destinatario_alertas` está vacío, se calculan alertas y la UI dice **"Sin alertas que enviar"** — confunde "nada que alertar" con "no hay destinatario" | — |
| Alertas: automatismo | **No hay cron.** Solo se ejecutan si un humano aprieta el botón. La doc describe un disparador por umbral | — |
| Correo 5 | Solo al `destinatario_alertas` global; el **coordinador afectado no recibe nada** | 4.9.4 |
| Timeline | Renderiza 5 tipos de evento que **nunca se insertan**. Faltan 4 `case` en `descripcionEvento` | 4.10.3, 4.10.4 |
| Referencia de la solicitud | `admin/solicitud/[id]/page.tsx:37` y `admin/procesos/page.tsx:19` **inventan** `SOL-XXXX`, que es justo lo que el panel del coordinador se empezó a corregir. Inconsistencia entre roles | 4.1.1 |

**FALTA**
| Funcionalidad | Nota | Tarea |
|---|---|---|
| **CRUD de coordinadores** | `/api/admin/coordinadores` **solo exporta `GET`**. Alta, edición, baja y cambio de categorías **no existen**. Los datos no son mock (leen `usuario`) pero es **solo lectura** | 4.4.2 |
| **Borrar un campo de catálogo** | No hay `DELETE` en ninguna de las dos rutas | 4.4.9 |
| **Selección de alertas por tipo** | Un solo botón que lo dispara todo. 4 tipos detectados, **solo `inactividad` se notifica**; `sin_desglose_fiscal`, `una_sola_cotizacion` y `discrepancia` se devuelven y nadie los muestra. Y `discrepancia` **nunca se emite**: la llamada no pasa `discrepanciasPorSolicitud` | 4.4.10 |
| **Que la alerta de inactividad pueda dispararse** | La condición `!s.fechaEnvio` es imposible: toda solicitud en el panel ya fue enviada | 4.10.2 |
| Configurar el formato de referencia | Se lee de `configuracion` con default `{{TIPO}}-{{ANIO}}-{{SECUENCIA}}` pero **no hay UI**, solo SQL. Y la secuencia por `MAX(regexp_match)+1` **puede duplicar** entre transacciones: no hay constraint UNIQUE | 4.1.1 |
| Tasa ISV configurable | La clave `tasa_isv` **no existe** en `configuracion` | 4.10.1 |

### 11.4 Lo que cruza los tres roles

| Tema | Estado | Tarea |
|---|---|---|
| Correo 1 con PDF al coordinador | **FALTA** — cae al solicitante si falta `MAIL_COORDINADOR_DEFAULT`, que no está en `.env.example` | 4.9.1 |
| Correos 2 y 3 | LISTO | — |
| Correo 4 (decisión registrada) | **FALTA** | 4.7.2 |
| Correo 5 (alerta) | A MEDIAS — destinatario único, y la alerta no puede dispararse | 4.9.4, 4.10.2 |
| Registro de correos en DB | LISTO — `enviado`/`fallido` + `intentos` + `errorDetalle` | — |
| Trazabilidad de transiciones (RF-49) | LISTO — evento en la misma transacción | — |
| Eventos de creación/cotización/comparativa/correo/acceso | **FALTA** — se renderizan pero no se insertan | 4.10.3 |
| Exposición de montos al solicitante en `/mis-solicitudes/[id]` | **VIOLACIÓN de RN-06** — el listado no expone montos pero el **detalle lista proveedores con su total** (`[id]/page.tsx:92-111`). El propio repo advierte lo contrario (`postgres-repo.ts:425`) | 4.8.7 |
| OCR serverless | **A MEDIAS** — degrada a carga manual en Vercel | 4.5.1 |
| Referencia real | **FALTA** — fallback `SOL-XXXX` inventado desde el id | 4.1.1 |
| PDF con el diseño oficial | **FALTA** — hay membrete BIA, no el formato de Ladi | 4.1.2 |

---

## Registro de cambios de este documento

| Fecha | Qué cambió |
|---|---|
| 2026-10-02 | Creación. Auditoría de `specs/`, `docs/`, `qa/`, `.harness/`, migraciones y working tree. Tests verificados: 230/7. e2e no re-corridos. |
| 2026-10-02 | **Verificación funcional por rol contra código** (§11): inventario completo de los 3 roles con estado LISTO / A MEDIAS / FALTA. Agregadas §4.7 (integridad RN-01), §4.8 (seguridad), §4.9 (correos), §4.10 (reglas y trazabilidad). **§7 reescrito**: 4 hallazgos refutados (A8, B5, A7, D2) y 12 nuevos, 6 de ellos críticos. §10 reordenado por gravedad real |
| 2026-10-02 | Post-commit `b28c5cd`: §3 reescrito como resuelto (con la tabla de las 9 piezas), §8 marcada resuelta tras unificar `.harness/`, §10 reordenada, tareas 6.12–6.15 agregadas (credenciales en QA, test de moneda, `doc-references`, specs históricos). Nombrada lista oficial de tareas en `AGENTS.md`. |