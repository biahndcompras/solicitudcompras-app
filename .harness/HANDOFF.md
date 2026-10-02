# Active Handoff

**Sesión 2026-10-02 — commit `63dbec5`, `main` sincronizado con `official/main`.**

> Este archivo se **reescribe al cerrar cada sesión**. Es memoria de continuidad: dónde quedó
> el trabajo y cuál es el primer movimiento. **No es la lista de tareas** — esa es
> `.harness/TASKS.md`, y manda sobre cualquier cosa escrita acá.

## Qué se hizo en esta sesión

Partió de una sospecha ("la API key del assessment no funciona, solo manda 4 preguntas") que
resultó **falsa**: la key funciona, el modelo responde 4 preguntas porque son las relevantes, y
decidirlo es suyo. La API key no se tocó.

| Bloque | Commit |
|---|---|
| Obligatorios forzados en el assessment, aviso al enviar, `contexto_investigado` visible, dedupe de preguntas duplicadas en pantalla, migración `017` (`forma_pago` obligatorio) | `6dc64d5` |
| Remediación de auditoría UX acumulada (idempotencia del envío, moneda, anti-subida de adjuntos, CTA de decisión, guías) + gate de envío | `b28c5cd` |
| `.harness/TASKS.md` como lista oficial; `STATE.md` reducido a puntero | `2b62b33` |
| Cuatro lessons generalizables | `bc45a06` |
| Inventario funcional por los 3 roles + 6 críticos que ninguna lista tenía | `63dbec5` |

## Primer movimiento de la próxima sesión

**No arranques por el assessment.** Eso ya está. Arrancá por lo que rompe integridad:

1. **B3 validado en el servidor** (`TASKS.md` 4.7.1) y corregir el texto de la UI que afirma que
   ya se valida (`components/coordinador/Recomendacion.tsx:143`). Hoy se puede enviar la
   comparativa al solicitante sin recomendación humana por API. Con test de servidor.
2. **`GET /api/solicitudes/[id]` con `guardApi`** (4.8.1). Fuga abierta de precios, ISV y PII.
   Lo más rápido de cerrar y lo más grave por impacto.
3. **Aislamiento entre coordinadores** (4.8.3, 4.8.4).

Detalle y evidencia de cada uno en `TASKS.md` §4.7–§4.10 y §11.

## Estado verificado al cerrar

| | |
|---|---|
| Tests | **230 pasan · 7 skip** (29 archivos) |
| `tsc --noEmit` | limpio |
| `eslint` | **0 errores** |
| Migraciones | 17 en disco, 17 aplicadas |
| e2e | **NO re-corridos.** Última cifra registrada: 22/22 (`e8ff42b`) |
| Working tree | limpio salvo 4 archivos de QA con credenciales (intencional) |

## Lo que NO está verificado

- **El bloque `6dc64d5` nunca se probó a mano.** Toda su evidencia es de navegador automatizado.
  Hay un guion de 5 bloques; el caso "assessment caído" requiere apagar Postgres.
- **Los e2e no se corrieron** en ningún commit de esta sesión.
- **La verificación por rol (§11) es estática**: leí código, no ejecuté la app. Los estados
  A MEDIAS y FALTA son de estructura y flujo, no de comportamiento en runtime.
- 4 hallazgos de `qa/checklist-piloto-3-roles.md` (del 22-sep) no se re-verificaron. Ese archivo
  quedó **sin trackear** por tener credenciales hardcodeadas: leelo de disco.

## Cosas que quedaron deliberadamente sin commitear

Cuatro archivos de QA con contraseñas de panel hardcodeadas (`qa/checklist-piloto-3-roles.md`,
`qa/evidencia-piloto/{d-fase-admin,e-vercel-smoke,probe-admin}.mjs`). `secret-scan.sh` no
detecta ese patrón. Está registrado como 6.12. **No los commitees sin sanearlos primero.**

También quedó en la DB una solicitud de prueba: `RFP-2026-0001`, `qa.obligatorios@biabrands.co`,
con eventos de trazabilidad asociados (borrarla requiere cascada).

## Decisiones del usuario tomadas hoy

- Rotar la API key: **no**. Funciona; el contador de preguntas no es un bug.
- Poner 6–8 preguntas en el prompt: **no**. Se dejó el modelo decidir.
- `forma_pago` obligatorio; `plazo_entrega` **no**, porque el paso 2 ya pide la fecha.
- `docs/doc-references/` (33 MB del cliente) y credenciales de QA: **fuera del repo**.

## Bloqueantes que esperan al usuario

No son resolvibles por el equipo interno. Ver `TASKS.md` §1.

1. 🔴 Rotar la contraseña de Postgres (expuesta en chat) y apuntar `DATABASE_URL` al pooler.
2. 🔴 Verificar el dominio de Resend — **hoy ningún correo sale**.
3. 🔴 Aceptación escrita del riesgo del link público.
4. 🟠 Confirmación escrita de las decisiones D1/D2/D3/D7/D9/D10 del piloto.
5. 🟠 Definir si el registro es "Usted" (D11) o voseo. **Toda la UI usa voseo.** Contradicción
   sin resolver.

## Si algo falla al arrancar

En más de una sesión se olvidó commitear el working tree. Antes de hacer nada: `git status` y
`git log --oneline official/main..HEAD`. Si hay commits sin pushear, pushear. Si hay trabajo sin
commitear, **registrarlo en `TASKS.md` antes** de seguir.