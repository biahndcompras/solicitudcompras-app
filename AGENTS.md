<!-- ADF:START -->
# ADF Project Instructions

## Project Lifecycle Router

On every new session:

1. Read `.harness/TASKS.md` — **fuente única de estado y lista oficial de tareas**. Toda tarea
   nueva, sin excepción, se registra ahí; ningún otro archivo las sostiene.
2. Read `.harness/manifest.yml` and `.harness/STATE.md` (puntero a TASKS.md).
3. Read only the lessons relevant to the current mode.
4. Route from lifecycle state:
   - `intake` → invoke `project-intake`.
   - active handoff → invoke `session-start`.
   - project ready with no feature → guide feature selection.
   - active feature → load its Spec Kit artifacts.

Inspect before asking the user for information. Never implement before Gate G4 and an explicit `GO`.

## Sources of Truth

- Agent rules: `AGENTS.md`
- Harness versions and ownership: `.harness/manifest.yml`
- Current global state + **official task list**: `.harness/TASKS.md`
- Harness pointers: `.harness/STATE.md` (summary) · `.harness/HANDOFF.md` (historical, not a source)
- Product requirements: approved documents under `docs/product/`
- Feature scope and execution: `specs/NNN-feature/`

Drafts, observations, and references do not silently become approved requirements.

## Gates

- G0 — Harness Integrity
- G1 — Project Intake
- G2 — Specification Ready
- G3 — Plan Ready
- G4 — Implementation Authorized
- G5 — Slice Verified
- G6 — Feature Closed

A successful validation is evidence, not human approval.

## Safety

- Never commit, push, deploy, publish, or mutate external systems without explicit authorization for that action.
- Preserve user-owned files and stop on unresolved conflicts.
- Keep the authorized diff minimal.
- Record verification evidence before declaring work complete.

Load detailed procedures from `.agents/skills/` only when relevant to the current lifecycle and task.

## Validación adversarial obligatoria

- Después de CADA bloque de trabajo con código nuevo (un slice, una tarea sustancial, o un commit con lógica), invoca la skill **`validate`** (QA adversarial).
- La skill revisa el bloque con escepticismo duro contra los invariantes del proyecto: determinismo, guardrails de IA, RN-01 (decisión humana), auth/roles/link público, datos reales vs mock, edge cases, fallos silenciosos, integridad de la máquina de estados.
- Si `validate` reporta críticos: corregir ANTES de continuar, con test nuevo si aplica, y volver a correr QA. Medios: corregir o documentar la decisión. No continuar el bloque hasta el OK de QA.
- Antes de cerrar cualquier feature (G5/G6) y al terminar la implementación de una feature completa, `validate` se ejecuta SIEMPRE y su resultado se referencia en el `verification.md`.
- La skill `validate` es complemento de `verify-work` (evidencia vs DoD) y `code-review` (dos ejes); no la reemplaza.
<!-- ADF:END -->
