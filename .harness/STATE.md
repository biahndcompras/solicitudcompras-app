---
schemaVersion: 1
lifecycle: feature-closed
currentGate: G6
activeFeature: null
ultimaFeatureCerrada: 010-preguntas-al-solicitante
supersedes: "STATE.md y HANDOFF.md como fuente de estado operativo"
fuenteDeEstado: .harness/TASKS.md
ultimaActualizacion: 2026-10-07
commit: 7ad7089
---

# Project State — puntero

**El estado operativo del proyecto vive en [`.harness/TASKS.md`](./TASKS.md).**
Este archivo es deliberadamente corto: si un agente lo lee y después lee `TASKS.md`, no
debe encontrar contradicciones.

## Estado actual

- El ciclo completo funciona de punta a punta y está verificado (**324 tests**, tsc limpio,
  eslint 0 errores). Migraciones 18/18 aplicadas.
- **010 cerrada** (7 bloques, G5): preguntas al solicitante y ciclo de re-cotización. Ver
  `specs/010-preguntas-al-solicitante/verification.md`. Incluye la QA adversarial, que
  encontró y corrigió un crítico (el solicitante podía escribir campos que nadie le preguntó).
- La **remediación de auditoría** cerró los 6 críticos que encontró la verificación por rol.
- **Tres bloqueantes de producción, ninguno resoluble por el equipo interno**: contraseña de
  Postgres expuesta, dominio de correo sin verificar, riesgo del link público sin aceptación
  escrita. Ver `TASKS.md` §1.
- El working tree está **limpio**.

## Approvals

G1..G6 de las features 006/007/008 constan en sus `verification.md`. Las features 000–005
están implementadas pero su documentación de cierre es incorrecta: ver `TASKS.md` §6.

## Orden de lectura al arrancar una sesión

1. `AGENTS.md`
2. **`.harness/TASKS.md`** ← estado real, lista oficial de tareas
3. `.harness/LESSONS.md` — lessons relevantes al modo actual
4. Skill de modo que corresponda

`HANDOFF.md` queda como histórico; no usar para decidir.