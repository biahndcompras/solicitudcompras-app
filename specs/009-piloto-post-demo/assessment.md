# Assessment post-demo Ladi — Acciones para el piloto (01-oct)

**Fecha:** 2026-09-16 · **Origen:** demo en vivo con Ladi Matute (Jefe de Compras, BIA Honduras).
**Objetivo:** listar todos los cambios, mejoras y hallazgos pedidos/descubiertos en el demo, clasificarlos y registrarlos para implementación.

> Criterio de severidad:
> 🔴 **Bloqueante para el piloto** · 🟠 **Importante (deseable antes del 01-oct)** · 🟡 **Mejora (post-piloto o si hay tiempo)** · ✅ **Ya implementado (solo verificar)**

## Estado de implementación (actualizado tras Fase 1)

| Item | Estado |
|---|---|
| 1.1 Selección de comprador | ✅ Implementado (endpoint `/api/coordinadores`, bloque en paso 5, pipeline respeta elección) |
| 1.2 Referencia 4 dígitos | ✅ Verificado (padStart 4) |
| 1.3 Semáforo | ✅ Implementado (`lib/domain/semaforo.ts`, `SemParoBadge` en 3 vistas) |
| 1.6 Renombrado copy | ✅ Aplicado (home + meta + plantillas) |
| 1.7 Preguntas con contexto | ✅ Prompt ASSESSMENT actualizado |
| 2.2 Adjuntar PDFs cotizaciones | 🔄 **Pendiente** — requiere persistir archivos (solo se guarda markdown; falta Storage) |
| 2.3 Re-cotización | ✅ Implementado (`PATCH /api/solicitudes/[id]`, `actualizarCamposSolicitud`, transitions ampliadas) |
| 2.4 Sugerencias seleccionables + 10 preguntas | ✅ Implementado (chips en wizard, MAX_PREGUNTAS=10, schema `sugerencias`) |
| 3.1 Tiempo de atención / SLA | ✅ Implementado (`duracionAtencion`, columna en admin, detalle admin, panel coord, mis-solicitudes) |
| 3.5 Cancelación | ✅ Admin y coordinador (botón + confirm); solicitante: limitado (sin sesión) |

---

## 1. Solicitante — flujo de creación

### 1.1 Selección directa de coordinador (comprador) 🔴
- **Pedido:** al final del wizard, el solicitante elige a qué comprador va dirigida la solicitud (solo uno). Lógica oficial: por categoría — Lester (eventos/actividades), María José (CAPEX), Bryan (contratos). Asignación por categoría existe; falta la **elección visible/obligatoria** en el flujo y su persistencia.
- **Estado código:** el pipeline asigna por categoría (`lib/pdf/pipeline.ts`), pero el wizard no pregunta ni muestra al comprador.
- **Implementación:** campo "¿A qué comprador va dirigida la solicitud?" en el paso final del wizard (paso pre-envío), con la lista de coordinadores activos de la categoría; persistir `coordinador_id` al crear/transicionar; permitir admin reasignar (ver 3.4).

### 1.2 Referencia de 4 dígitos ✅ / verificar
- **Pedido:** Vía tramita ~200 cotizaciones/mes → el correlativo anual debe ser de 4 dígitos (hoy se ve `REQ-2026-014` = 3).
- **Estado código:** `generarNumeroReferenciaTx` ya usa `.padStart(4, "0")` y el formato config es `{{TIPO}}-{{ANIO}}-{{SECUENCIA}}`. **Verificar en producción** que una solicitud nueva genere `RFQ-2026-0001`.

### 1.3 Semáforo de estado en "Mis Solicitudes" 🔴
- **Pedido:** el solicitante debe ver si su solicitud está **a tiempo / en riesgo / retrasada** respecto a la fecha requerida (verde/amarillo/rojo); el comprador también debe verlo. Diseño más compacto en la lista.
- **Estado código:** `app/mis-solicitudes/` muestra detalle pero **sin semáforo ni tracking**.
- **Implementación:** cálculo compartido (fecha requerida vs hoy vs fecha envío), badge con color y texto; reutilizar en panel coordinador y admin.

### 1.4 Mini-tracker visual estilo "pedido de pizza" 🟡
- **Pedido:** tracker de etapas (creada → en cotización → comparativa → espera decisión → cerrada) para el solicitante.
- **Estado:** timeline existe en detalle admin; falta el visual compacto para solicitante.

### 1.5 Manuales de uso (solicitantes / coordinadores / administradores) 🟠
- **Pedido:** material para inducción y capacitación.
- **Estado:** no existen. Crear docs en `docs/`.

### 1.6 Renombrar "solicitud de compra" → "solicitud de cotización" 🔴
- **Pedido:** evitar confusión con la "orden de compra" del ERP. Ladi: no todos los servicios pasan por cotización, pero la denominación debe ser **solicitud de cotización**.
- **Estado código:** aparece "Portal de Compras BIA" / "Solicita una compra" en homepage + plantillas de correo. Cambiar copy.

### 1.7 Preguntas dinámicas: señalar si son del logo o del producto 🟠
- **Pedido:** la pregunta "dimensiones" fue ambigua (¿logo, producto o servicio?).
- **Estado:** el agente preguntó "dimensiones" sin contexto. Ajustar prompt del assessment para prefijo contextual.

---

## 2. Coordinador — flujo de gestión

### 2.1 Comparativa: incluir detalle del producto + ahorro potencial 🟠
- **Pedido:** en la comparativa debe aparecer la información específica del producto cotizado y el ahorro si elige la opción más económica (default por precio).
- **Estado código:** `lib/domain/comparativa.ts` computa `prosContras` y `sugerencia` pero no métricas de ahorro entre opciones.
- **Implementación:** agregar `ahorroVsOpcionMasCara` y mostrar detalle de especificaciones/condiciones por cotización.

### 2.2 Enviar los PDF de cotizaciones originales al solicitante 🔴
- **Pedido:** el solicitante siempre quiere ver las ofertas originales; deben adjuntarse a la respuesta/envío de comparativa.
- **Estado código:** `enviarCorreo` soporta un solo `adjuntoPdf` (el doc de la solicitud); no se adjuntan los PDFs de las cotizaciones cargadas.
- **Implementación:** adjuntar los PDFs de cotizaciones al correo/respuesta de comparativa (múltiples adjuntos según soporte Resend).

### 2.3 Re-cotización (editar cantidad / nueva cotización del mismo proveedor) 🔴
- **Pedido:** ejemplo real: pidieron 100 baterías → tras ver precios quieren 50 → editar la solicitud y recotizar con el mismo proveedor; conservar histórico de cotizaciones previas.
- **Estado código:** **no hay flujo de re-cotización**; estados lineales/terminales; no existe edición posterior de campos clave.
- **Implementación:** permitir en solicitudes "activas" editar campos clave (cantidad, descripción) por el solicitante o admin; crear una **nueva versión/loop** de cotización del proveedor original; conservar cotizaciones anteriores en histórico con flag de versión.

### 2.4 Sugerencias de respuesta seleccionables en preguntas dinámicas 🔴
- **Pedido:** cada pregunta del asistente con **2 campos: sugerencia (seleccionable) + campo abierto**; hasta ~10 preguntas (hoy máximo 6).
- **Estado código:** `lib/domain/assessment.ts` (MAX_PREGUNTAS=6) y el wizard muestra input + "No lo sé". Falta lista de sugerencias y selector.
- **Implementación:** la IA retorna `sugeridas: string[]` por campo; el wizard ofrece opciones clicables + textarea editable; subir límite a 10.

### 2.5 Recomendación del coordinador con PDFs adjuntos (se cubre con 2.2) 🟠

---

## 3. Administración — dashboard

### 3.1 Tiempo de atención / SLA por solicitud 🔴
- **Pedido:** mostrar cuánto lleva abierta cada solicitud (creación → hoy, o → cierre) y SLA del coordinador por categoría (varía por complejidad).
- **Estado código:** dashboard muestra "tiempo promedio"; falta la columna/emv-era por fila y el SLA por categoría.
- **Implementación:** columna "Tiempo de atención" en tablas admin/coord; detalle admin con duración acumulada; luego SLA por categoría/coord.

### 3.2 Ahorro comparativo en decisión (pros) 🟠 (ver 2.1)

### 3.3 Renombre a "cotización" (ver 1.6) 🔴

### 3.4 Reasignación de solicitudes entre coordinadores 🟠
- **Pedido:** si un coordinador se satura (ej. Lester), el admin (o coord.) puede reasignar a otro.
- **Estado código:** existe evento `reasignacion` en `evento_trazabilidad` pero sin UI simple.
- **Implementación:** acción de reasignar en admin (y opcional coord) que cambie `coordinador_id` + registre evento.

### 3.5 Cancelación disponible en los 3 roles 🔴 (verificar)
- **Pedido:** puede cancelar el solicitante, el comprador o el admin.
- **Estado código:** existe `CANCELADA` y eventos; verificar que la UI permite cancelar a los 3 roles.

### 3.6 Alertas por rol (recordatorio decisión / cotizaciones retrasadas) 🔴
- **Estado código:** existe botón "Ejecutar alertas" y métrica "sin decisión >5 días"; falta selección por tipo y mensaje.

---

## 4. Datos y contenido

### 4.1 Cinco escenarios complejos 🔴 (Ladi enviará)
- **Pedido por Ladi** para probar el motor IA: piso epóxico (RFP), mudanza oficinas (RFP), vuelo/viajes, reserva hotel, branding, paquete DHL.
- Uso: como data de test + para capacitación.

### 4.2 Diseño del PDF oficial 🟠
- **Pedido:** usar el diseño vertical de BIA que Ladi compartió.
- **Estado:** `plantilla-generica.ts` tiene membrete BIA pero no el formato exacto del RFQ de Ladi. Implementar con pdfme usando `docs/doc-references`.

---

## 5. Pendientes técnicos (no del demo, pero bloqueantes)

1. 🔴 Email transaccional (Resend): requiere dominio verificado; hoy placeholder `no-reply@compras.bia` → registrado `fallido` si no verifica.
2. 🔴 OCR en serverless: `/api/convertir` sin python en Vercel → degrada a carga manual; resolver (función Python en Vercel o librería JS).
3. 🟠 Regenerar contraseña postgres expuesta en chat y actualizar DATABASE_URL pooler.

---

## Prioridad de implementación sugerida (para cumplir 01-oct)

**Fase 1 — Bloqueantes:**
- 1.1 Selección de comprador + asignación
- 1.3 Semáforo en Mis Solicitudes (y panel coord/admin)
- 1.6 Renombrar a "Solicitud de cotización"
- 1.7 Preguntas con contexto logo/producto
- 2.2 Adjuntar PDFs originales de cotizaciones
- 2.3 Re-cotización
- 2.4 Sugerencias seleccionables + 10 preguntas
- 3.1 Tiempo de atención / SLA
- 3.5 Cancelación en los 3 roles
- (5.1, 5.2) Correo y OCR

**Fase 2 — Importantes:**
- 1.4 tracker visual · 1.5 manuales
- 2.1 ahorro en comparativa · 3.2 (mismo)
- 3.4 reasignación con UI
- 4.2 PDF con diseño oficial de BIA

**Fase 3 — Diferidos / post-piloto:**
- Alertas avanzadas por tipo y mensaje · métricas SLA por coord/categoría · otros.

---

## Referencia código (dónde tocar)

| Item | Archivos |
|---|---|
| Selección de comprador | `components/solicitante/SolicitanteWizard.tsx` + `app/api/solicitudes/.../estado/route.ts` + `lib/pdf/pipeline.ts` |
| Referencia 4 dígitos | `lib/db/postgres-repo.ts:161` (padStart 4) — ya ok |
| Semáforo | `app/mis-solicitudes/*.tsx`, `app/panel/page.tsx`, `app/admin/*` |
| Re-cotización | `lib/domain/state-machine.ts`, `lib/db/postgres-repo.ts` |
| Sugerencias seleccionables | `lib/domain/assessment.ts` + `lib/ai/prompts.ts` + wizard |
| Ahorro | `lib/domain/comparativa.ts` |
| Adjuntar PDFs | `lib/mail/enviar.ts` + pipeline de comparativa |
| Tiempo atención | `app/admin/solicitud/[id]/page.tsx` + dashboard |
| Renombrado | `app/page.tsx`, `lib/mail/plantillas.ts`, copys varios |
| Reasignación | `app/api/admin/...` + repo (evento reasignación) |

---

*Registrado por: Edgar (Intelia) / Ladi (Producto) · próxima revisión: jueves post-demo.*