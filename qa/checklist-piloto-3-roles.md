# Checklist de pruebas — Piloto 3 roles (Portal de Compras BIA)

**Fecha:** 2026-09-22 · **Entorno:** local `http://localhost:3001` (IA + OCR activos) → smoke Vercel
**Evidencia:** `qa/evidencia-piloto/` (capturas por paso, no se commitean)
**Leyenda:** ✅ OK · ❌ FALLO · ⚠️ OK con observación · ⭐ revisión con Ladi 24-sept · ⬜ pendiente

**Preparación:** sesión limpia de navegador · PDFs en `qa/docs-prueba/` · solicitud NUEVA por ciclo (no reusar RFQ-2026-0006).

---

## FASE A · Solicitante (creación)

| ID | Paso | Resultado esperado | Estado | Evidencia |
|----|------|--------------------|--------|-----------|
| A1 ⭐ | Abrir `/` y entrar a crear solicitud | Copy "Nueva solicitud de cotización" (1.6), sin "exigencia" | ✅ | A1-identidad.png |
| A2 | Describir producto (ej. "lapiceros metálicos con logo Vía para canal tradicional") | Clasificación IA RFQ/RFP con % de confianza | ✅ RFQ 90% | A3-clasificacion.png |
| A3 ⭐ | Paso preguntas IA | Mín. 9 preguntas, máx 10 (2.4); chips de sugerencia seleccionables; contexto del producto en las preguntas (1.7) | ✅ 10 preguntas, 9 con chips, contexto "sombrillas de playa" verificado; chip seleccionable | A4b-assessment-con-preguntas.png |
| A4 | Completar "Información comercial" | Campos fijos visibles (uso, cantidades, fecha requerida) | ⚠️ Fecha/cantidad van en el paso de captura; sin sección "Información comercial" para mercadeo+RFQ (plantillas solo RFQ servicio/obra y RFP) | A4b-assessment-con-preguntas.png |
| A5 | Paso 5 · selección de comprador (1.1) | Listado con nombres reales del equipo; se puede elegir (ej. Carlos Melara) | ✅ 5 compradores, selección confirmada "Irá asignada a Carlos Melara" | A5-comprador.png |
| A6 | Enviar solicitud | Nota `RFQ-2026-XXXX` de 4 dígitos + PDF descargable con membrete BIA oficial (4.2) | ✅ RFQ-2026-0007 en DB (4 dígitos) + PDF application/pdf; ⚠️ ref real no se muestra en la confirmación | A6-confirmada.png |
| A7 ⭐ | "Mis solicitudes" | Card con semáforo de atención (1.3), "Atención: X h/d" (3.1) y tracker de etapas (1.4) | ⚠️ "Atención: 0 h" OK; tracker solo en el detalle (no en cards); ⚠️ card muestra "SIN FECHA LÍMITE" pese a fecha en DB ("14 DÍAS DE MARGEN" correcto en detalle) | A7-mis-solicitudes.png, A7b-detalle-tracker.png |
| A8 | Re-cotización solicitante (2.3) | Desde Mis Solicitudes se puede pedir ajustes mientras no esté enviada | ❌ **Sin UI**: el endpoint `PATCH /api/solicitudes/[id]` y las transiciones `COMPARATIVA_LISTA↔EN_COTIZACION` existen, pero ningún botón/pantalla los invoca (ni solicitante ni coordinador) | — |

**Regla B2/RN-03 (extra):** ✅ "Generar documento" bloqueado sin logo cuando hay branding, se desbloquea con logo — pero la "subida" de logo es mock (hallazgo H2).

## FASE B · Coordinador (`coordinador@biafoods.co` / `Coordinador2026!`)

| ID | Paso | Resultado esperado | Estado | Evidencia |
|----|------|--------------------|--------|-----------|
| B1 | Login + panel | Solicitud nueva visible con semáforo + días de gestión | ✅ Login Carlos Melara (`cmelara@biabrands.co`), panel con "X h/d de gestión" | B1-panel.png |
| B2 | 07 · Cotizaciones — manual | Formulario con proveedor, moneda, totales, entrega, pago, garantía, vigencia | ✅ 2 cotizaciones manuales (Proveedora Norte 57,500 / CostaPrint 42,000); el form solo tiene Proveedor/Moneda/Neto/ISV/Total/Plazo (pago/garantía/van por PDF) | B2-cotizaciones.png |
| B3 ⭐ | 07 · Subir PDF (`cotizacion-merchandise.pdf`) (2.2) | Extracción IA por campo con chip de confianza; botón "PDF" descarga el archivo original | ✅ "Extrayendo datos con IA…" → "Con archivo"; PDF descargable (⚠️ content-type `application/octet-stream` en vez de `application/pdf`) | B3-pdf-adjunto.png |
| B4 | 08 · Generar comparativa | Tabla: valor neto, ISV ("⚠ no especifica" RN-06), total, entrega, pago, garantía, vigencia; botón Excel | ✅ Tabla + RN-06 + "Descargar Excel"; se genera sola al entrar (3–4 s, "Generando comparativa…") | B4-comparativa.png |
| B5 ⭐ | 08 · Ahorro potencial (2.1/3.2) | Pros incluyen "Ahorro potencial de X frente a la opción más cara" | ❌ **NO aparece** cuando la IA responde pros (los pros de la IA reemplazan los deterministas — `comparativa.ts:226`) | — |
| B6 ⭐ | 09 · Recomendación (RRN-01) | Botón "Enviar comparativa" BLOQUEADO sin recomendación; se habilita al escribir criterio humano | ✅ Bloqueo + desbloqueo verificados | B6-recomendacion.png |
| B7 ⭐ | Enviar al solicitante | Link público generado + "Correo 3" con las cotizaciones en PDF adjuntas (2.2) | ✅ "Comparativa enviada", transición COMPARATIVA_LISTA→ENVIADA_A_SOLICITANTE, "Correo 3 disparado", token `3C60-B122-AADE` en DB (URL truncada en UI con botón Copiar) | B7-enviada.png |
| B8 | Cancelar solicitud (3.5) | Botón visible y transición a cancelada | ✅ verificado en Fase D (D4) | D4-cancelada.png |

## FASE C · Decisión del solicitante (link público, sin login)

| ID | Paso | Resultado esperado | Estado | Evidencia |
|----|------|--------------------|--------|-----------|
| C1 | Abrir `/comparativa/{token}` sin sesión | Vista "Enlace público · sin iniciar sesión" con opciones, pros/contras y recomendación Humana | ✅ 2 opciones (Proveedora Norte / CostaPrint), pros/contras, recomendación humana | C1-vista-publica.png |
| C2 ⭐ | Importes (RN-03) | Totales en moneda original, sin conversión | ✅ "Los importes se muestran en su moneda original (sin conversión)" | C1-vista-publica.png |
| C3 | "Elegir esta opción" → Confirmar | Mensaje "Tu decisión fue registrada. Compras recibirá la notificación" | ✅ Con diálogo de confirmación previo | C3-decision-registrada.png |
| C4 | Segundo intento de decidir | Botones deshabilitados / decisión única | ✅ "✓ Opción elegida" + 3 botones bloqueados | C3-decision-registrada.png |
| C5 | DB | `CERRADA_CON_DECISION` + `decision.cotizacion_seleccionada_id` + fecha | ✅ CERRADA_CON_DECISION, eligió **Imprenta CostaPrint** (coherente con la recomendación) | DB |

## FASE D · Administrador (`admin@biafoods.co` / `AdminBIA2026!`)

| ID | Paso | Resultado esperado | Estado | Evidencia |
|----|------|--------------------|--------|-----------|
| D1 | Login + dashboard | KPIs: pendientes, en atención, tiempo de atención | ✅ Conversión / Tiempo Promedio / Procesos Activos / Sin decisión > 5 días | D1-dashboard.png |
| D2 ⭐ | Timeline de eventos | Creación, cotizaciones, envío de comparativa, decisión, cierre | ✅ 7 eventos; ⚠️ eventos duplicados ("Esperando cotizaciones → Comparativa lista" ×2) y descripción genérica "al estado actual" | D2-timeline-cerrada.png |
| D3 ⭐ | Reasignar comprador (3.4) | Cambio efectivo + evento "Reasignación" en el timeline | ✅ Reasignado a Bryan Bonilla + evento "Reasignación" | D3-reasignada.png |
| D4 | Cancelar solicitud (3.5) | Transición correcta + visible en timeline | ✅ `window.confirm` → cancelada + evento | D4-cancelada.png |
| D5 | Cierre del ciclo | Solicitud decidida: cierre, fecha y proveedor elegido | ✅ "Cerrada" + "El solicitante eligió Imprenta CostaPrint" | D2-timeline-cerrada.png |
| D6 | Duración de atención en detalle (3.1) | Indicador visible en el detalle | ✅ | D2-timeline-cerrada.png |

## FASE E · Smoke en Vercel (`https://solicitudcompras-app.vercel.app`)

| ID | Paso | Resultado esperado | Estado | Evidencia |
|----|------|--------------------|--------|-----------|
| E1 | Home pública | Carga "Nueva solicitud de cotización" | ✅ | E1-vercel-home.png |
| E2 | Login coordinador | Panel carga contra nube (pooler IPv4) | ✅ Carlos Melara entra a `/panel` con datos de la nube | E2-vercel-coordinador.png |
| E3 | Login admin | Dashboard carga | ✅ Login OK (`/admin` carga; KPIs con métricas vacías en nube) | E3-vercel-admin.png |
| E4 | Correos (Resend) | Registran "fallidos" (dominio no verificado) — documentar, no bloqueante | ✅ documentado | — |

> Nota: los datos de las fases A–D (`RFQ-2026-0006/0007`) viven en la DB **local**; Vercel apunta a la DB **nube** (distinto dataset). Los logins validan Auth compartido (Supabase).

---

## Hallazgos / bugs nuevos — ESTADO FINAL (commit `cf25400`, 22-sept)

| # | Severidad | Descripción | Fix |
|---|-----------|-------------|-----|
| H1 | Media | Paso 5 mostraba "Referencia Única: RFQ-2026-014" hardcodeada y la real no aparecía | ✅ **Corregido** — resumen muestra ref provisional `RFQ-2026-XXXX` ("se asigna al enviar") y la confirmación muestra la real (`RFQ-2026-0009` verificado en vivo) |
| H2 | Media | "Subida" de logo era mock (`logo_oficial.svg` hardcodeado) | ✅ **Corregido** — input file real + migración 014 (`archivo_logo_bytea`) + endpoints POST/GET `/api/solicitudes/[id]/logo` + link de descarga en el detalle (nombre real verificado en vivo) |
| H3 | Media-baja | Paso 4 sin loading del assessment ni bloqueo | ✅ **Corregido** — aviso "Preparando preguntas del asistente…" + "Generar documento" deshabilitado mientras evalúa |
| H4 | Menor | Cards "SIN FECHA LÍMITE" con fecha en DB | ✅ **Corregido** — `listarPorEmail` ahora incluye `fecha_requerida` |
| H5 | Menor | Fecha cruda `Mon Oct 05 2026…` | ✅ **Corregido** — `formatoFechaLegible`/`fechaInput` en cards, detalle, panel y wizard |
| H6 | Bajo | `gemini-2.5-flash-lite` cae a fallback | ⚠️ **Conocido** — resiliencia correcta; monitorear coste/latencia del fallback |
| H7 | **Alta-media** | "Ahorro potencial" (2.1/3.2) se perdía si la IA respondía pros | ✅ **Corregido** — `fusionarProsContras` conserva la línea junto a los pros de IA (verificado en vivo: "Ahorro potencial de 20,000 HNL frente a la opción más cara") |
| H8 | Menor | Eventos duplicados en timeline por doble disparo del efecto | ✅ **Corregido** — `generandoRef` deduplica la generación de comparativa |
| H9 | Menor | Copy "al estado actual" en timeline | ✅ **Corregido** — "De «X» a «Y»" |
| H10 | Bajo | PDF `application/octet-stream` | ✅ **Corregido** — content-type por extensión |
| H11 | Bajo | Enlace público truncado sin tooltip | ✅ **Corregido** — `title` con URL completa |
| H12 | **Media-alta** | Re-cotización (2.3) sin UI | ✅ **Corregido** — botones "Reabrir cotizaciones" y "Editar datos" en el panel del coordinador + evento `edicion` en trazabilidad (migración 015) |
| Q1 | Bajo (QA) | Edición sin trazabilidad (RF-49) | ✅ evento `edicion` con actor |
| Q2 | Bajo (QA) | Límite logo 20MB > límite Vercel | ✅ bajado a 4MB |
| P1 | Decisión pendiente | ¿UI de re-cotización también en panel admin? (hoy solo coordinador) | Para Ladi 24-sept |
| P2 | Decisión pendiente | ¿Logo incrustado en el PDF del RFQ o basta descarga para adjuntar? | Para Ladi 24-sept |
| PX | **Pre-existente, escalar** | `GET /api/solicitudes/[id]` sin auth expone cotizaciones/montos con solo el uuid | Documentado, fuera de este bloque — decisión de seguridad requerida |

## Observaciones para Ladi (24-sept)

- ...
