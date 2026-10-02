---
schemaVersion: 1
lifecycle: feature-en-curso
currentGate: G5
activeFeature: remediacion-auditoria-piloto
supersedes: "STATE.md y HANDOFF.md como fuente de estado operativo"
fuenteDeEstado: .harness/TASKS.md
ultimaActualizacion: 2026-10-02
commit: b28c5cd
---

# Project State — puntero

**El estado operativo del proyecto vive en [`.harness/TASKS.md`](./TASKS.md).**
Este archivo es deliberadamente corto: si un agente lo lee y después lee `TASKS.md`, no
debe encontrar contradicciones.

## Estado actual

- El ciclo completo funciona de punta a punta y está verificado (230 tests, tsc limpio,
  eslint 0 errores).
- Hay una **remediación de auditoría UX piloto** abierta y recién commiteada
  (`b28c5cd`): el código está en git, pero su registro administrativo está incompleto
  (ver `TASKS.md` §3.1 y §6.4).
- **Tres bloqueantes de producción, ninguno resoluble por el equipo interno**: contraseña de
  Postgres expuesta, dominio de correo sin verificar, riesgo del link público sin aceptación
  escrita. Ver `TASKS.md` §1.
- El working tree está **limpio**. Las 4 tareas de §3.2 de `TASKS.md` que estaban sueltas se
  resolvieron en `b28c5cd`.

## Approvals

G1..G6 de las features 006/007/008 constan en sus `verification.md`. Las features 000–005
están implementadas pero su documentación de cierre es incorrecta: ver `TASKS.md` §6.

## Orden de lectura al arrancar una sesión

1. `AGENTS.md`
2. **`.harness/TASKS.md`** ← estado real, lista oficial de tareas
3. `.harness/LESSONS.md` — lessons relevantes al modo actual
4. Skill de modo que corresponda

`HANDOFF.md` queda como histórico; no usar para decidir.