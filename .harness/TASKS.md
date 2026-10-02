---
schemaVersion: 1
tipo: mapa-vivo
proposito: "Única fuente de verdad de qué está listo, qué está a medias y qué falta."
autoridad: "Este documento reemplaza a STATE.md y HANDOFF.md como fuente de estado operativo."
ultima_verificacion: 2026-10-02
commit_verificado: 6dc64d5
---

# Mapa vivo del Portal de Compras BIA

> **Cómo usar este documento.** Es lo único que hay que leer para saber dónde está el proyecto.
> Si algo no está acá, no existe como tarea. Si algo está acá y ya se hizo, se borra (no se
> tacha: queda en git).
>
> **Regla de actualización:** al cerrar un bloque de trabajo, se mueve la fila de
> "Por hacer" a "Listo" con la evidencia concreta (commit, test, captura). Sin evidencia, no
> se marca.
>
> **Regla de honestidad:** distingo siempre entre *verificado hoy* (lo corrí), *reportado por
> documentación* (puede estar viejo) y *inferido*. No marco nada como listo sin haberlo visto.

---

## 0. Estado real en una línea

El producto **funciona de punta a punta** y está verificado. Lo que pesa hoy no es código: es
**deuda de proceso** (features cerradas sin gates, 132 tareas sin marcar), **trabajo sin
commitear** (30 modificados + 38 sin trackear), y **tres bloqueantes de producción** (uno de
seguridad).

`.harness/STATE.md` está **18 commits desactualizado**: declara `activeFeature: null` y
`nextAction: feature-select`, cuando hay una feature en curso y un working tree sucio.
`.harness/HANDOFF.md` describe un estado que ya no existe (su punto 1 —"commitear la ronda
post-cierre"— se resolvió en `e8ff42b`). **Ambos mienten.** Ver §8.

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
| e2e (Playwright) | 5 specs existen. **NO los re-corrí hoy**; la última cifra registrada es 22/22 (`e8ff42b`) |

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

### Lo que hicimos en esta sesión (sin commitear)
| Bloque | Qué resuelve |
|---|---|
| `6dc64d5` | Campos obligatorios forzados en el assessment, aviso al enviar, `contexto_investigado` visible, dedupe de preguntas duplicadas. **Commiteado.** |
| Migración `017` | `forma_pago` → obligatorio. **Commiteada y aplicada.** |
| *(working tree)* | **Gate de envío** cuando el assessment falla o nunca se preparó. Verificado en navegador con caída simulada. **SIN COMMIT.** |

---

## 3. Trabajo a medias — el working tree

**30 archivos modificados + 38 sin trackear.** Esto es lo primero que hay que resolver: es
trabajo real y funciona, pero no está en git y no tiene respaldo.

### 3.1 Funcionalidad implementada que NO está en ningún spec

Todo esto está **en uso** en producción local, tiene consumidores reales, y **no aparece en ningún
`tasks.md` ni `assessment.md`**. El verdadero registro de este trabajo es
`qa/evidencia-piloto/critique-solicitante/AUDIT-SOLICITANTES.md` — un archivo **sin trackear,
fuera de `specs/`**, de ~800 líneas. Los comentarios del código nuevo citan sus etiquetas
(`P1-b`, `P2-c`, `P3-d`) y **`specs/` no las conoce**.

| Archivo | Qué hace | En uso | Documentado | Commit |
|---|---|---|---|---|
| `lib/domain/moneda.ts` | Formato es-HN + equivalente HNL con tasa declarada y fechada (24.7, 2026-09-01) | sí (2 vistas) | ❌ no | ❌ no |
| `lib/domain/archivos.ts` | Anti-subida: magic bytes, whitelist sin `.svg`, 4 MB, PDF truncado | sí (wizard) | ❌ no | ❌ no |
| `lib/enlaces-decision.ts` | Mapa local de tokens de decisión ya vistos + `useSyncExternalStore` | sí (3 sitios) | ❌ no | ❌ no |
| `components/solicitante/CTADecision.tsx` | CTA "Decidir ahora" honesto: no promete enlace si no lo viste | sí | ❌ no | ❌ no |
| `migrations/016_solicitud_idempotencia.sql` | **El envío son 3 llamadas**: sin idempotencia, un reintento creaba solicitudes duplicadas | sí, extremo a extremo | ❌ no | ❌ no |
| `app/guias/manual-solicitante/page.tsx` | Ruta `/guias/manual-solicitante` servida desde el `.md` | sí (5 enlaces) | ❌ no | ❌ no |
| `app/api/solicitudes/[id]/estado/route.test.ts` | Tests del invariante "la transición es el hecho de negocio" | sí | ❌ no | ❌ no |
| `lib/domain/archivos.test.ts` | Tests de la whitelist de adjuntos | sí | ❌ no | ❌ no |
| `components/solicitante/envio-idempotencia.test.tsx` | Tests de las 3 garantías del envío | sí | ❌ no | ❌ no |
| `components/solicitante/borrador-hook.test.tsx` | Tests del autoguardado/restauración | sí | ❌ no | ❌ no |

**Tarea concreta:** crear un spec retroactivo que registre esto, o al menos un
`specs/010-remediacion-auditoria/` que enlace el `AUDIT-SOLICITANTES.md`. No se puede cerrar
G5 sobre trabajo que no está escrito.

### 3.2 Otras cosas sin commitear
- Rediseño del panel del coordinador, vista pública, trackers, guías, estilos.
- `components/ui-ext/Stepper.tsx` **borrado** sin commitear (código muerto, correcto).
- 24 MB de evidencia visual en `qa/` + `.playwright-mcp/` (no debería entrar al repo).
- Una solicitud de prueba en la DB: `RFP-2026-0001`, `qa.obligatorios@biabrands.co`.

---

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

### 4.5 OCR y conversión
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.5.1 | **OCR funcional en serverless** | — | `/api/convertir` sin Python en Vercel → **degrada a carga manual**. O una función Python en Vercel, o librería JS. |

### 4.6 Otros
| # | Tarea | Ref | Nota |
|---|---|---|---|
| 4.6.1 | Mini-tracker visual compacto para el solicitante | 1.4 | Diferido. |
| 4.6.2 | Exenciones y retenciones fiscales | — | Diferido por acuerdo; **no hay reglas documentadas**. |

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
| 6.5 | **`STATE.md` 18 commits viejo**; `HANDOFF.md` describe un estado inexistente | alto | Este documento los reemplaza (§8). |
| 6.6 | `assessment.md:18` dice "2.2 Pendiente" pero se implementó en `9c75891` | bajo | Actualizar la tabla. |
| 6.7 | `008/verification.md:75` dice "8/8 checkboxes"; `tasks.md` tiene 15 | bajo | Corregir el número. |
| 6.8 | **`docs/guias/` y la UI usan "comprador"**, prohibido por ADR 0002 y el glossary | medio | Corrección de copy en 3 manuales + ~5 strings de UI. |
| 6.9 | `references/index.md:19` dice "8 claves de config pendientes"; el doc 15 marca 6 + 1 propuesta | bajo | Corregir el conteo. |
| 6.10 | Etiqueta `P3-d` citada en código sin existir en el audit (los headings terminan en `P3-c`) | bajo | Verificar a qué hallazgo se refiere. |
| 6.11 | Nombre del cliente inconsistente: "Lady Matute" / "Ladi Isabel Matute" / "Ladisabel" / "Ladi" | bajo | Fijar una forma y propagar. |

---

## 7. Hallazgos de QA abiertos

De `qa/checklist-piloto-3-roles.md` (2026-09-22). **No hay re-ejecución documentada** desde
entonces, así que no puedo afirmar cuáles siguen abiertos.

| Ref | Hallazgo | Estado |
|---|---|---|
| **A8** | Re-cotización sin UI | ❌ abierto → ver 4.3.1 |
| **B5** | Ahorro potencial no aparece con pros de IA | ❌ abierto → ver 4.2.1 |
| D2 | Timeline con eventos duplicados + descripción genérica "al estado actual" | ⚠️ abierto |
| B3 | PDF de cotización descarga como `application/octet-stream` en vez de `application/pdf` | ⚠️ abierto |
| A6 | La referencia real no se muestra en la pantalla de confirmación | ⚠️ abierto |
| A7 | Card de "Mis solicitudes" muestra "SIN FECHA LÍMITE" pese a tener fecha; tracker solo en el detalle | ⚠️ abierto |
| A4 | Sin sección "Información comercial" para mercadeo+RFQ (no hay plantilla) | ⚠️ abierto |
| H6 | `gemini-2.5-flash-lite` cae a fallback — resiliencia correcta, monitorear coste | ⚠️ conocido |

**Tarea:** re-correr el checklist 3-roles y marcar qué se resolvió. Sin eso, esta tabla envejece
como el resto.

---

## 8. Decisión pendiente sobre `.harness/`

`AGENTS.md` dice que el arranque de sesión lee `STATE.md` y `HANDOFF.md`. **Los dos están
mal.** Un agente que arranque mañana leerá que no hay feature activa y que todo está cerrado.

Propuesta, a tu confirmación:
1. **`STATE.md`**: reducir a un puntero a este documento + el estado de una línea.
2. **`HANDOFF.md`**: vaciarlo o marcarlo `superseded`.
3. **`AGENTS.md`**: agregar este archivo al orden de lectura.

No lo toqué porque cambia el router del framework y eso es tu decisión.

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

## 10. Lo que yo haría en este orden (si me das luz verde)

1. **Commitear el working tree** con un spec retroactivo que registre §3.1. Es lo único que
   está en riesgo de perderse.
2. **Re-correr `qa/checklist-piloto-3-roles.md`** y actualizar §7 con lo que sigue abierto.
3. **Arreglar 4.2.1 (ahorro potencial)** — es un bug de una línea en `comparativa.ts:226`, con
   impacto visible en la comparativa que ve el coordinador.
4. **Arreglar 4.3.1 (UI de re-cotización)** — el backend ya está, falta el botón.
5. **Arreglar 4.1.1 (referencia real)** — deuda que la 008 cerró dejando abierta.
6. **Higiene documental de §8** para que el próximo arranque no se pierda.

Los bloqueantes B1–B4 no dependen de mí: van por correo al cliente.

---

## Registro de cambios de este documento

| Fecha | Qué cambió |
|---|---|
| 2026-10-02 | Creación. Auditoría de `specs/`, `docs/`, `qa/`, `.harness/`, migraciones y working tree. HEAD `6dc64d5`. Tests verificados hoy: 230/7. e2e no re-corridos. |