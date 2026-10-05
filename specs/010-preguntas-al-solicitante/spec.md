---
id: 010
titulo: Preguntas al solicitante y ciclo de re-cotización
estado: borrador
gates: G1 ok · G2 pendiente · G3 pendiente · G4 pendiente
creado: 2026-10-03
---

# 010 · Preguntas al solicitante y ciclo de re-cotización

## Por qué

Hoy el ciclo tiene un hueco real: si al coordinar faltan datos **del solicitante**,
la única vía es que el coordinador los escriba "en nombre de él"
(`PATCH /api/solicitudes/[id]`). Funciona, pero inventa información: el documento
generado dice cosas que el solicitante nunca dijo.

Este pedido agrega la vía honesta —preguntarle al solicitante y que su respuesta
vuelva al flujo— **sin quitar** la existente (decisión del usuario: "dejemos
ambas vías").

Lo que ya existe y **no** se toca (verificado contra el código):

- Cancelar es solo de Compras: el coordinador lo tiene en el panel con confirmación
  (`DetalleSolicitud.tsx:59`) y admin en su detalle. El solicitante **no puede**:
  la ruta de estado sin sesión solo admite `BORRADOR → ENVIADA_A_COMPRAS`.
- Cancelar **no borra** las cotizaciones: solo cambia el estado. Compras conserva
  qué se pidió y cuánto costó cotizar.
- "Ninguna me sirve" ya devuelve la solicitud a `EN_COTIZACION` (commit `f6a545b`).

## El flujo

```
   Compras                         Portal                    Solicitante
     │                                │                            │
     │ "Necesito información"          │                            │
     ├────────────────────────────────┼────────────────────────────►│ correo 6
     │  marca: esperando_al_solicitante│                            │
     │  guarda las preguntas           │                            │
     │                                │◄───────────────────────────┤
     │                                │   responde en "mis solicitudes"
     │◄───────────────────────────────┤                            │
     │  correo 7 con las respuestas    │                            │
     │  vuelve al estado anterior      │                            │
     │                                │                            │
     │  (a los 3 días sin respuesta → correo 8 de recordatorio)      │
```

El ciclo **se repite**: se pueden pedir varias rondas sobre la misma solicitud.

## Decisiones que YA están tomadas (usuario, 2026-10-03)

| # | Decisión |
|---|---|
| 1 | Cancelar conserva las cotizaciones guardadas |
| 2 | **Solo Compras cancela.** El solicitante no puede |
| 3 | El ciclo de preguntas **se repite**. Sin respuesta a los **3 días**, se avisa a Compras |
| 4 | **Se mantienen ambas vías**: el coordinador puede editar en nombre del solicitante, y además puede preguntarle |

## Decisiones que FALTAN (bloquean la implementación)

### D1 · ¿Estado nuevo o bandera?

**Recomendación: bandera** (`informacion_pendiente` + `estado_previo`), no un estado nuevo.

Un estado nuevo tocaría todas las consultas que filtran por estado: la bandeja
dejaría de mostrar esas solicitudes bajo "esperando cotizaciones", los KPI
cambiarían demeaning y las alertas de inactividad empezarían a disparar distinto.
Eso es un cambio de producto escondido dentro de una implementación.

Con una bandera, el panel muestra un distintivo **"Esperando respuesta del
solicitante · hace N días"** y nada más cambia. El estado real sigue siendo el
que era.

Contra: la línea de tiempo del tracker no lo muestra (porque el tracker dibuja
estados), y hay que mirar dos lugares.

### D2 · El aviso de los 3 días: ¿automático de verdad?

**No hay ningún programador en el proyecto.** No hay cron en `vercel.json` y las
alertas de inactividad solo corren si un humano aprieta el botón en admin. Por
hoy no puedo mandar un correo "el solicitante no respondió" sin que alguien lo
pida.

**Recomendación: las dos vías.**
- Una ruta de API que devuelve las preguntas vencidas, y un `cron` diario en
  `vercel.json` que la llame. Automático una vez desplegado.
- La misma consulta enganchada al botón "Ejecutar alertas" que ya existe, para que
  funcione desde hoy y en local.

Así el recordatorio existe siempre, y pasa a ser automático sin tocar código.

### D3 · Estos correos amplían la nomenclatura documentada

El PRD define **5 correos**. Este pedido agrega tres: el de información al
solicitante, el de respuesta recibida y el de recordatorio. Hay que actualizar la
documentación (`prd.md`, `user-flows.md`) porque hoy dice "5 correos" y serían 8.

**Pregunta:** ¿lo dejo asentado en el PRD como ampliación, o preferís que lo
propongas vos a Compras antes?

### D4 · Si el coordinator edita un campo que el solicitante ya respondió

Propuesta: la respuesta **se escribe en el campo**, así el coordinador la usa de
inmediato, y queda marcado de dónde vino. Si después el coordinador lo edita a
mano, se marca como editado por Compras y se conserva la respuesta original en la
trazabilidad. Perder la respuesta original sería perder la voz del solicitante,
que es justo lo que esta funcionalidad existe para recoger.

## Cómo se implementaría (por bloques, con QA al final de cada uno)

| Bloque | Qué | Riesgo |
|---|---|---|
| 1 | Migración: columnas + tipo de evento nuevo para trazabilidad | Bajo |
| 2 | Endpoint "pedir información" (coordinador) + correo al solicitante | Bajo |
| 3 | Pantalla de respuesta en `mis-solicitudes/[id]` | Medio (toca la vista del solicitante) |
| 4 | Endpoint "respondí" + correo al coordinador | Bajo |
| 5 | Recordatorio de 3 días (consulta + botón admin + cron) | Bajo |
| 6 | Distintivo en el panel del coordinador | Bajo |
| 7 | Documentación: PRD, flujos, nomenclatura de correos | Nulo |

## Riesgo que hay que mirar

El punto 3 toca la pantalla que el solicitante usa para ver su solicitud. Es la
pantalla con más tráfico del portal. Un error ahí no rompe el negocio, pero rompe
la confianza. Por eso ese bloque va solo, con verificación en navegador, y sin
mezclarse con los demás.

## Lo que este pedido NO incluye

- Que el solicitante pueda cancelar (decisión 2).
- Re-cotización del solicitante: "ninguna me sirve" ya devuelve a Compras.
- Aviso a proveedores externos: el portal no les escribe, solo entre usuarios internos.
- Adjuntar archivos en las respuestas del solicitante.