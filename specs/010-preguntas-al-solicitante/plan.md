---
id: 010
titulo: Preguntas al solicitante y ciclo de re-cotización
estado: aprobado
gates: G1 ok · G2 ok (decisiones del usuario, 2026-10-03) · G3 ok (este plan) · G4 pendiente
spec: ./spec.md
---

# Plan de implementación · 010

## Decisiones tomadas

| # | Decisión | Elegida | Por qué |
|---|---|---|---|
| D1 | Estado nuevo vs bandera | **Bandera** `informacion_pendiente` + `estado_previo` | Un estado nuevo cambiaría el significado de los filtros de la bandeja y de los KPI sin que nadie lo pida |
| D2 | Recordatorio de 3 días | **Las dos vías**: consulta + botón admin existente, y cron cuando haya despliegue | Hoy no hay ningún programador; el recordatorio no puede depender solo de uno |
| D3 | Documentación de los correos | **Actualizo el PRD yo** (decisión del cliente, 2026-10-03) | Los correos 6/7/8 quedan asentados como ampliación de la nomenclatura |
| D4 | Edición posterior del coordinador | La respuesta **se escribe en el campo**, con marca de procedencia, y el original se conserva en trazabilidad | Perder la respuesta original sería perder la voz del solicitante, que es lo que el flujo existe para recoger |

## Forma de los datos

Se añade a `solicitud`:

| Columna | Tipo | Para qué |
|---|---|---|
| `informacion_pendiente` | `boolean not null default false` | La bandera: hay preguntas esperando respuesta |
| `informacion_preguntas` | `jsonb` | `{ ronda, preguntas: [{campoKey, pregunta}], pedidaEn, coordinatorEmail }` |
| `informacion_desde` | `timestamp` | Cuándo se pidieron. La antigüedad alimenta el recordatorio de 3 días |
| `informacion_respuesta` | `jsonb` | Lo que respondió el solicitante, con marca de procedencia |

Y un evento de trazabilidad nuevo: `tipo_evento` += `pregunta_solicitante` y `respuesta_solicitante`,
para que la línea de tiempo muestre las rondas.

**Por qué `jsonb` y no una tabla nueva:** el ciclo se repite sobre la misma solicitud y solo
importa la ronda actual. Un historial completo de rondas vive en `evento_trazabilidad`, que ya
existe para eso. Una tabla nueva obligaría a modelar versión de campos para un dato que se
sobrescribe.

## Orden de construcción

Cada bloque se commitea solo, con su verificación, y no se mezclan con el siguiente.

1. **Migración 018** — columnas + eventos. Verificable con `psql` y sin tocar la app.
2. **Pedir información** (coordinador) → sets la bandera + correo 6.
3. **Pantalla de respuesta** del solicitante. **Aislado**: es la vista de más tráfico.
4. **Responder** → limpia la bandera, escribe los campos + correo 7.
5. **Recordatorio de 3 días** → consulta vencida + botón admin + ruta para cron.
6. **Distintivo** en el panel del coordinador con la antigüedad.
7. **Documentación**: PRD (hecho), `user-flows.md`, `TASKS.md`.

## Verificación por bloque

- Tests unitarios del dominio y de cada ruta nueva.
- Los tests de rechazo se ejecutan **contra el código anterior** para confirmar que atrapan
  el fallo. Es lo que se hizo en los bloques anteriores y evitó dar por bueno un test inútil.
- El bloque 3 se verifica **en navegador**, con recorrido completo de los dos roles.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Tocar la vista del solicitante rompe algo de alto tráfico | Bloque aislado, verificación en navegador antes de seguir |
| El recordatorio nunca se manda sin cron | Va atado al botón que ya existe: hoy funciona, después solo se automatiza |
| Un coordinador edita un campo y se pierde la respuesta del solicitante | El original queda en `evento_trazabilidad` (D4) |
| El solicitante responde dos veces por doble clic | Idempotencia por ronda, como ya se hizo con el envío (migración 016) |