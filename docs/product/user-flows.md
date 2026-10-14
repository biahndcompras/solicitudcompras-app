---
title: Flujos de Usuario y Estructura de la Plataforma — Portal de Compras BIA
status: review
authority: product
owner: Intelia (build), Lady Matute (domain)
last_reviewed: 2026-08-12
---

# Flujos de Usuario y Estructura de la Plataforma — Portal de Compras BIA

> **Propósito de este documento:** servir de referencia estructural y funcional para replicar las pantallas de la plataforma en cualquier herramienta de diseño o implementación. **Contiene únicamente estructura, pasos, campos, validaciones y reglas de negocio — sin consideraciones de diseño visual.**
> **Modelo de aplicación:** una sola aplicación web con **portales por rol**. "Solicitante" no inicia sesión (usa una cookie de continuidad de 30 días); "Coordinador" y "Administrador" tienen sesión con rol.

---

# 0. Contexto integral de la plataforma

## 0.1 Qué es
Aplicación web que digitaliza el ciclo completo de una solicitud de compra en BIA Honduras: desde que **cualquier colaborador** solicita una compra, hasta que **selecciona una cotización** y el proceso se cierra con métricas. Reemplaza el canal actual (correo, WhatsApp, chats).

## 0.2 Roles
| Rol | Quién | Autenticación | Alcance |
|---|---|---|---|
| **Solicitante** | Cualquier colaborador de BIA | Solo correo + cookie de continuidad (30 días) | Crear solicitud, consultar estado, ver comparativa por enlace, decidir |
| **Coordinador de compras** | Equipo de Compras (4 personas) | Sesión con credenciales | Gestionar solicitudes asignadas, cargar cotizaciones, escribir recomendación, enviar comparativa |
| **Administrador** | Lady Matute | Sesión con rol admin | Ver todas, métricas y configuración |
| **Agente de IA** | Servicio interno | No aplica | Clasificar, assessment, extraer, validar fiscal, sugerir (nunca decide) |

## 0.3 Reglas de negocio no negociables (aplican en todo el sistema)
- **RN-01 — Decisión humana:** la recomendación de la comparativa la escribe una persona; la IA solo sugiere. La recomendación humana y la sugerencia IA se muestran con jerarquías distintas (nunca igual peso).
- **RN-02 — El agente no crea campos:** solo puede pedir campos que existan en el catálogo vigente.
- **RN-03 — Producto con marca sin arte NO avanza (B2):** si `lleva_branding = true` y no hay `archivo_logo`, el flujo se bloquea (cliente y servidor).
- **RN-04 — Clasificación corregible:** el usuario puede corregir la clasificación; no necesita ser infalible.
- **RN-05 — Sin sesión para el solicitante:** la comparativa se comparte por enlace público con token.
- **RN-06 — Nunca inventar cifras:** un dato ausente es nulo o "no especificado", nunca cero; no se convierten monedas.
- **RN-07 — Autocontenido:** no lee/escribe en los sistemas de gestión del cliente ni depende de IT del cliente.
- **RN-08 — Producto y servicio con igual calidad de plantilla** (distribución esperada ~50/50).

## 0.4 Bloqueos duros del sistema (los únicos 3 puntos que impiden avanzar; NO dependen de la IA)
- **B1 — Campo obligatorio de plantilla vacío.**
- **B2 — Producto con marca sin arte adjunto.**
- **B3 — Recomendación del coordinador vacía** antes de enviar la comparativa.

## 0.5 Estados de una solicitud
```
BORRADOR
  → ENVIADA_A_COMPRAS      (se genera PDF, se envían correos 1 y 2)
     → EN_COTIZACION       (coordinador gestiona con proveedores)
        → COMPARATIVA_LISTA (cotizaciones cargadas + comparativa generada)
           → ENVIADA_A_SOLICITANTE (correo con enlace público)
              → CERRADA_CON_DECISION
              → EN_COTIZACION  ("ninguna me sirve": vuelve a Compras, NO se cierra)
Terminales: CANCELADA · CERRADA_SIN_DECISION · CERRADA_CON_DECISION
```
Toda transición escribe un evento de trazabilidad en la misma transacción.

**"Ninguna me sirve" no cierra.** El solicitante rechaza todas las opciones y la solicitud
vuelve a `EN_COTIZACION` con un evento y el correo 4 avisando al coordinador. Antes iba a
`CERRADA_SIN_DECISION`, que es terminal: la solicitud quedaba muerta para siempre aunque la
pantalla prometiera que "vuelve a revisión".

### Preguntas al solicitante (RF-59…RF-62) — no es un estado

Compras puede devolver la solicitud al solicitante para pedirle un dato que solo él tiene:

```
EN_COTIZACION / ENVIADA_A_COMPRAS / COMPARATIVA_LISTA
   │  Compras pide información          → correo 6 al solicitante
   │  + marca `informacion_pendiente`   → el ESTADO NO CAMBIA
   │  ◄── el solicitante responde desde "mis solicitudes"  → correo 7 al coordinador
   │      la bandera se apaga; la solicitud sigue donde estaba
   │  (a los 3 días sin respuesta → correo 8 al coordinador, una vez por ronda)
```

Es una **bandera, no un estado**. Un estado nuevo habría sacado esas solicitudes de
"esperando cotizaciones" en la bandeja y habría cambiado lo que significan los KPI: un cambio
de producto escondido dentro de una implementación. El ciclo se puede repetir por rondas, y
una ronda abierta a la vez.

## 0.6 Navegación / rutas reales de la plataforma
| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | P1 — Identificación del solicitante | Público |
| `/solicitud/nueva` | P2–P7 — Wizard de creación | Público + cookie |
| `/mis-solicitudes` | Consulta de estado por correo | Público |
| `/panel` | C1 — Bandeja del coordinador | Coordinador |
| `/panel/solicitud/[id]` | C2 — Detalle de la solicitud (etapas) | Coordinador |
| `/comparativa/[token]` | L1 — Vista pública / decisión | Público (token) |
| `/admin` | A1 — Dashboard de trazabilidad | Administrador |

---

# 1. FLUJO DEL SOLICITANTE

## 1.1 P1 — Identificación (ruta `/`)
**Propósito:** identificar al solicitante con la menor fricción; sin registro ni contraseña.

**Campos:**
| Campo | Tipo | Obligatorio | Notas / validación |
|---|---|---|---|
| Correo institucional | texto/correo | Sí | Formato válido (regex email). Dominio no institucional → **advertencia no bloqueante** (marca para revisión). Autocompletar nombre/área si el correo ya está en el histórico |
| Nombre completo | texto | Sí | Mín. 3 caracteres |
| Área / departamento | texto | Sí | (en esta versión: texto libre; en producción: catálogo) |

**Acciones:** `Continuar` (habilita solo si el correo es válido), `Ver mis solicitudes` (enlace a `/mis-solicitudes`).

**Al continuar:** se crea la solicitud en `BORRADOR`, se escribe evento de creación, se establece la cookie de continuidad y se pasa a P2.

## 1.2 P2 — Captura inicial (paso 2 del wizard, ruta `/solicitud/nueva`)
**Propósito:** capturar los campos base que orientan la clasificación.

**Campos:**
| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| Título de la solicitud | texto | Sí | — |
| ¿Qué tipo de necesidad? | selección | Sí | Opciones: Empaque y branding · Materia prima · Servicios logísticos · Administrativo · Proyecto o CAPEX · Otro |
| ¿Es un producto o un servicio? | segmentado (2 opciones) | Sí | `producto` / `servicio` |
| ¿Para cuándo lo necesitas? | fecha | Sí | No admite fechas pasadas; plazo < 5 días hábiles → **advertencia no bloqueante** |
| Área / departamento | texto | Sí | — |
| Descripción breve | área de texto | Sí | — |

**Acciones:** `Atrás`, `Continuar` (habilita cuando título+tipo+fecha+área están completos). Barra de progreso (paso 2 de 4). Al continuar: persiste respuestas y se invoca la clasificación → P3.

## 1.3 P3 — Confirma la clasificación (paso 3)
**Propósito:** mostrar la clasificación sugerida y permitir corregirla (RN-04).

**Elementos:** etiqueta de confianza ("Alta confianza"), enunciado "Esto parece una **RFQ** — Solicitud de Cotización" con razón breve, y selector de 3 opciones:
| Opción | Sigla | Significado |
|---|---|---|
| Todavía explorando opciones | RFI | No sabe qué existe en el mercado |
| Ya sé qué necesito, falta precio | RFQ | Necesidad clara, falta el precio |
| Proyecto o solución más amplia | RFP | Problema que requiere solución |

**Regla:** si la confianza del clasificador es baja (< 0.70), las opciones se muestran **sin preselección**. Corregir la clasificación registra `clasificacion_corregida` (alimenta la métrica de precisión).

**Al continuar:** se fija tipo (RFI/RFQ/RFP), subtipo (producto/servicio), y se selecciona la plantilla por tipo+subtipo+categoría → P4.

## 1.4 P4 — Formulario de plantilla / assessment (paso 4)
**Propósito:** capturar los campos definidos por Compras (origen `plantilla`) y, tras el assessment, los faltantes (origen `assessment`).

**Estructura del paso (en esta fase implementada):**
1. **Estado de assessment:** mientras no lista, se muestra un estado de carga ("Revisando referencias de mercado…"). Tras el assessment se muestran las preguntas.
2. **Campos de assessment (ejemplo del catálogo de producto):**
   - Dimensiones (texto)
   - Materiales (texto)
   - Calidad esperada (selección: Premium / Estándar)
   - ¿Lleva logo o branding? (interruptor sí/no)
   - **Logo correcto (archivo) — obligatorio y bloqueante si lleva branding (B2 / RN-03).** Formatos aceptados: PNG, JPG, PDF, SVG, AI, EPS.

**Reglas:**
- El assessment pide **solo campos que existan en el catálogo** (RN-02), máximo 6 preguntas.
- Opción "No lo sé" por pregunta (no bloquea; se registra como no especificado).
- Si el assessment falla o excede el tiempo, el flujo **continúa** sin error visible (P5).
- **B2:** si `lleva_branding = true` y no hay logo, el botón Continuar queda bloqueado (cliente y servidor).
- **B1:** los campos obligatorios de la plantilla no pueden quedar vacíos.

**Al continuar:** valida obligatorios (cliente y servidor) → P5.

## 1.5 P5 — Documento generado (paso 5)
**Propósito:** mostrar el documento formal con número de referencia antes de enviar.

**Elementos:** aviso "Su documento está listo, con número de referencia único", bloque de documento con membrete, tipo de documento (RFI/RFQ/RFP), número de referencia, y datos clave (producto, solicitante). Acción: `Enviar solicitud` (en esta fase reemplaza al botón Continuar en este paso).

**Al enviar (en esta fase):** se persiste la solicitud vía API (crear en BORRADOR → transición a `ENVIADA_A_COMPRAS`), se asigna número de referencia, se disparan correos 1 y 2 → P6. Si falla, mensaje de error y no cambia de estado.

## 1.6 P6 — Confirmación (paso 6)
**Propósito:** confirmar el envío y cerrar el ciclo del solicitante.

**Elementos:** confirmación ("Su solicitud fue enviada a Compras"), correo del solicitante, y datos del coordinador/compras asignado. Acción: volver al portal / ver mis solicitudes.

**Regla de estado:** la solicitud queda en `ENVIADA_A_COMPRAS`; el solicitante no interviene hasta la decisión (excepto consultar estado).

## 1.7 Consulta de estado — `/mis-solicitudes`
**Propósito:** que el solicitante consulte el estado de sus solicitudes sin iniciar sesión.

**Elementos:** campo de correo + acción "Ver mis solicitudes".

**Reglas:**
- Devuelve **solo** las solicitudes de ese correo.
- Muestra referencia, título, estado, fecha de creación (y área en esta versión).
- **Nunca expone precios, cotizaciones ni montos** (privacidad, RN-06).
- Estados vacíos amables; sin resultados → mensaje + acción de crear una nueva.

---

# 2. FLUJO DEL COORDINADOR

## 2.1 C1 — Bandeja (ruta `/panel`)
**Propósito:** el coordinador ve sus solicitudes asignadas.

**Elementos:**
- Contadores/filtros por estado: Todos · Activas · Esperando cotizaciones · Esperando decisión · Cerradas.
- Lista de solicitudes (filas), cada una con: referencia, solicitante + tipo, título, categoría, estado (badge), y marcador "Nueva" para las recién asignadas.
- Orden por fecha requerida ascendente en producción; indicador de inactividad (pendiente).

**Reglas:**
- Cada coordinador ve **solo sus solicitudes asignadas** (asignación por categoría, configurable — Q1).
- Estados vacíos y de carga claros.
- Al hacer clic en una solicitud → C2.

## 2.2 C2 — Detalle de la solicitud (ruta `/panel/solicitud/[id]`)
**Propósito:** el coordinador gestiona la solicitud en 3 etapas.

**Estructura:** encabezado con referencia/título/solicitante/área/fecha requerida/estado + **etapas (pestañas):**
- **07 · Cotizaciones**
- **08 · Comparativa**
- **09 · Recomendación**

**Panel lateral (metadatos de la solicitud):** correo del solicitante, área, tipo, subtipo, fecha requerida, fecha de creación; y bloque "Solicitante" con nombre + descripción.

### Registro manual de la solicitud en proceso
Se muestra un bloque "Registro de solicitud en proceso" con: fecha de registro, área, resumen del solicitante (correo, tipo de trabajo, descripción), número de referencia.

### C2-1 · Etapa 07 — Carga de cotizaciones
**Elementos:**
- Lista de proveedores (slots) donde cada uno tiene: ícono de formato (PDF/DOC/IMG), nombre del proveedor, estado del archivo ("Sin archivo aún" / "convertido a Markdown ✓"), y acción `Adjuntar`/`Cargado`.
- Botón `Generar comparativa` (habilitado con ≥ 2 cotizaciones).

**Reglas:**
- Se acepta PDF, Word (docx) e imagen; cada una se convierte internamente a Markdown antes del análisis.
- Con < 2 cotizaciones, el botón queda deshabilitado con la nota "Se necesitan al menos 2 cotizaciones para generar una comparativa".
- Al generar → etapa 08 (y transición de estado a `COMPARATIVA_LISTA`).

### C2-2 · Etapa 08 — Comparativa generada
**Elementos:**
- Tabla comparativa con **neto arriba, impuestos desglosados abajo**: valor neto, impuestos (ISV), total, entrega — una columna por proveedor.
- Cuando una cotización **no desglosa impuestos**, se marca "⚠ no especifica" (no se calcula ni se asume — RN-06).
- Bloque de observación fiscal cuando hay discrepancia de especificación (se muestra **antes** que los precios).
- Botón `Ver recomendación →`.

**Reglas:**
- **No se convierten monedas** automáticamente; cada cotización en su moneda original con observación si difieren.
- Una sola cotización no genera comparativo (se declara la ausencia de comparación).

### C2-3 · Etapa 09 — Recomendación (punto de control humano, RN-01)
**Elementos:**
- Tarjetas por proveedor: nombre, pros (✓), contras (✗), precio total.
- **Sugerencia del asistente (IA):** bloque etiquetado como sugerencia, con la justificación y el proveedor sugerido. **Siempre subordinado** a la recomendación humana.
- **Campo "Recomendación del coordinador"** (área de texto) — **obligatorio**.
- Botón `Enviar comparativa al solicitante` (deshabilitado mientras la recomendación esté vacía → **B3**), con mensaje explicando qué falta.
- Tras enviar: confirmación "Comparativa enviada — la solicitud queda en espera de decisión" y transición a `ENVIADA_A_SOLICITANTE`.

**Reglas:**
- **B3:** el envío se bloquea (cliente y servidor) si la recomendación está vacía o es solo espacios.
- El coordinador puede **contradecir** la sugerencia de la IA sin fricción adicional (es lo esperado).
- Se genera el enlace público y se dispara el correo 3 al solicitante.

---

# 3. FLUJO DE LA VISTA PÚBLICA / DECISIÓN

## 3.1 L1 — Comparativa y decisión (ruta `/comparativa/[token]`)
**Propósito:** el solicitante ve la comparativa por enlace público (sin sesión) y decide.

**Elementos (en orden de lectura):**
- Contexto: "Enlace público · sin iniciar sesión".
- Título: "Comparativa lista" + referencia/descripción.
- **Advertencia de discrepancia** (si existe) — antes que cualquier precio.
- **Recomendación de Compras (humana)** — bloque destacado, con etiqueta "Recomendación de Compras" (RN-01).
- Tarjetas por proveedor: nombre, pros, contras, total, plazo de entrega; cada una con botón `Elegir esta opción`.
- Botón secundario `Ninguna me sirve, necesito hablar con Compras`.

**Reglas:**
- Token válido y no expirado; token inválido/expirado → mensaje neutro sin filtrar información.
- Al elegir un proveedor → confirmación y registro de la decisión (marca de tiempo) → transición a `CERRADA_CON_DECISION`, correo 4.
- **"Ninguna me sirve"** → notifica a Compras **sin cerrar con decisión** (vuelve a `EN_COTIZACION`).
- Datos faltantes se muestran como "no especificado" (nunca cero — RN-06).
- Ya decidida → modo lectura, sin poder cambiar.

---

# 4. FLUJO DEL ADMINISTRADOR — DASHBOARD DE TRAZABILIDAD

## 4.1 A1 — Dashboard (ruta `/admin`)
**Propósito:** medir el proceso (la "cereza del pastel" de Lady).

**Elementos:**
- **Tarjetas de métricas:** conversión solicitud → aceptación (card principal), tiempo de ciclo promedio, solicitudes activas, solicitudes sin decisión > 5 días.
- **Gráficos/barras:** volumen por coordinador; distribución por tipo (RFI/RFQ/RFP).
- **Filtros por período:** Todo · Hoy · Esta semana · Este mes.
- **Filtro por coordinador** (Todos / cada coordinador).
- Tabla de procesos (referencia, tipo, solicitante, coordinador, estado, fechas) con badges de estado — en producción.

**Reglas de cálculo (desde eventos de trazabilidad):**
- **Conversión** = solicitudes en `CERRADA_CON_DECISION` ÷ solicitudes enviadas (borradores excluidos del denominador).
- **Tiempo de ciclo** = `fecha_cierre` − `fecha_envio`.
- Métricas sobre datos reales; con pocos datos → estados vacíos claros (sin ceros engañosos).

---

# 5. CORREOS DEL SISTEMA

**Nomenclatura vigente:** 5 correos del ciclo + 1 de respuesta + 2 de alerta. La numeración
1–5 no cambió al ampliarse, para no invalidar los registros históricos de `correo_enviado`.

| # | Correo | Disparador | Destinatario |
|---|---|---|---|
| 1 | Nueva solicitud asignada | `ENVIADA_A_COMPRAS` | **Coordinador asignado** (con PDF) |
| 2 | Acuse de recibo | `ENVIADA_A_COMPRAS` | Solicitante |
| 3 | Comparativo listo | `ENVIADA_A_SOLICITANTE` | Solicitante (enlace público) |
| 4 | Decisión registrada — o devuelta a Compras si ninguna le sirvió | Decisión del solicitante | Coordinador asignado + administración |
| 5 | Solicitud sin movimiento (alerta) | Umbral de días superado (configurable) | Destinatario de alertas |
| 6 | Se necesita información del solicitante | Compras pide información (RF-59) | Solicitante |
| 7 | El solicitante respondió | El solicitante responde (RF-60) | Coordinador asignado |
| 8 | El solicitante no respondió en 3 días | Ronda vencida (RF-62) | Coordinador asignado |

- El correo **1 nunca va al solicitante**: lleva el PDF de su propia solicitud con precios.
  Si no hay coordinador con email ni alias configurado, no se envía y se registra el hueco.
- El correo **8 no tiene un programador propio**: se dispara desde el botón "Ejecutar alertas"
  del panel de administración, y además hay una ruta de cron lista para cuando se despliegue.

---

# 6. COMPONENTES DE INTERFAZ (estructura, sin estilo)

Listado de los bloques/reutilizables que componen las pantallas, útiles para replicar de forma consistente:

- **Navegación por rol (shell):** barra lateral de navegación + encabezado contextual (eyebrow + título + subtítulo) + bloque de usuario con "salir al portal". Aplica a Coordinador y Administrador.
- **Cabecera de página** con eyebrow (etiqueta mono), título y subtítulo.
- **Stepper / barra de progreso:** pasos navegables (solo hacia pasos ya alcanzados), estados completado/actual/pendiente, con etiqueta por paso.
- **Campo de formulario:** etiqueta + control + ayuda/error asociados (accesible). Variantes: texto, correo, fecha, selección, área de texto, segmentado (producto/servicio), interruptor (sí/no), selección de chips, carga de archivo.
- **Selector segmentado:** 2 opciones (Producto/Servicio).
- **Selección de chips:** opciones tipo RFI/RFQ/RFP con significado.
- **Interruptor:** sí/no (branding).
- **Badge / etiqueta de estado:** estados de solicitud y severidades (éxito, advertencia, neutro…).
- **Alerta / aviso:** informativa, éxito, advertencia, error (con barra y mensaje claro de qué pasó y qué hacer).
- **Tarjeta de proveedor:** nombre, pros/contras, precio, plazo, acción de elección.
- **Tabla comparativa:** filas de concepto, una columna por proveedor (neto/impuestos/total/entrega).
- **Skeleton / estado de carga** y **estado vacío** (explican qué se verá y por qué está vacío).
- **Confirmación / banner de éxito.**
- **Notificación temporal (toast)** para acciones de confirmación.
- **Etiquetas y datos tabulares** con dígitos tabulares (para que los montos alineen).

---

# 7. NOTAS PARA QUIEN REPLIQUE LAS PANTALLAS

1. **Sin diseño en este documento:** todos los elementos anteriores deben interpretarse como **estructura funcional** (qué hay, en qué orden, qué hace cada control, qué valida). Los colores, tipografía, espaciado y estética se definen aparte (sistema de identidad BIA).
2. **Bloqueos duros:** B1/B2/B3 aparecen en el flujo donde recae la acción (B2 en P4, B3 en la recomendación del coordinador) y **bloquean** la acción con un mensaje que explica qué falta (nunca deshabilitar sin explicación).
3. **RN-01 es estructural:** la recomendación del coordinador y la sugerencia de la IA son bloques distintos y jerárquicamente desiguales; no deben igualarse visualmente.
4. **Datos faltantes = "no especificado"**, nunca cero.
5. Los **estados** siguen la máquina de estados del apartado 0.5; cada pantalla refleja el estado real de la solicitud.
