# Session Handoff

**Histórico.** Este archivo dejó de ser fuente de estado. La lista oficial de tareas es
**`.harness/TASKS.md`** y el estado resumido es `.harness/STATE.md`.

## Por qué quedó obsoleto

El handoff anterior (2026-08-21) decía que había que commitear la ronda post-cierre. Eso se
resolvió en `e8ff42b`, y después vinieron tres bloques más de trabajo. Mantener un segundo
documento de estado garantizó que divergiera.

## Credenciales de desarrollo (solo local)

No volver a escribirlas en scripts ni en markdown versionado: ya quedaron 4 archivos de QA sin
trackear por eso (tarea 6.12 en `TASKS.md`). Leelas de `.env.local` o de `HANDOFF` local.

- Panel coordinador: cuenta real en Supabase Auth (rol `coordinador`), la que usa el equipo.
- Panel admin: cuenta con rol `admin`.

Las cuentas ficticias "Coordinador 1–4" que quedaron en la tabla `usuario` son residuo del
seed y se pueden limpiar.