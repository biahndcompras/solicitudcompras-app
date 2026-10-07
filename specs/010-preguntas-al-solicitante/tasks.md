# Tareas · 010

Estado: `- [ ]` pendiente · `- [x]` hecha con evidencia

## Bloque 1 — Migración

- [x] T001 Migración `018_preguntas_solicitante.sql` con las 4 columnas y los 2 tipos de evento
- [x] T002 Idempotente (`ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`)
- [x] T003 Verificar con `psql` que quedó aplicada y que una solicitud vieja tiene la bandera en `false`

## Bloque 2 — Pedir información (coordinador)

- [x] T004 Repo: `pedirInformacion`, `informacionVencida`, `responderInformacion`, `marcarRecordatorioInformacion`
- [x] T005 Ruta `POST /api/solicitudes/[id]/informacion` — exige rol, valida que la solicitud no sea terminal
- [x] T006 Correo 6 al solicitante con el enlace a "mis solicitudes"
- [x] T007 Tests: rechaza sin rol · rechaza si ya hay una ronda abierta · no hace nada en terminal (9 tests)
- [x] T008 Los 2 tests de 409 cubren el rechazo por regla de negocio, no por caída

## Bloque 3 — Pantalla de respuesta (solicitante)

- [x] T009 `mis-solicitudes/[id]`: bloque de preguntas cuando hay bandera
- [x] T010 Sin sesión: el correo es la identidad, como ya pasa con esa pantalla
- [x] T011 Verificación en navegador del recorrido completo
- [x] T012 La pantalla no cambia cuando no hay preguntas (no se toca lo que ya funciona)

## Bloque 4 — Responder

- [x] T013 Ruta `POST /api/solicitudes/[id]/informacion/respuesta`
- [x] T014 Idempotencia por ronda (doble clic o refresh no duplica)
- [x] T015 Escribe las respuestas en los campos y guarda el original con procedencia (D4)
- [x] T016 Correo 7 al coordinador con las respuestas
- [x] T017 Un fallo de correo no deshace la respuesta ya registrada

## Bloque 5 — Recordatorio de 3 días

- [ ] T018 Repo: pendientes cuya antigüedad supera el umbral
- [ ] T019 Correo 8 al coordinador
- [ ] T020 Atado al botón "Ejecutar alertas" del admin (funciona hoy)
- [ ] T021 Ruta `GET /api/cron/recordatorios` protegida por secreto, lista para el cron
- [ ] T022 `crons` en `vercel.json`
- [ ] T023 No se marca como "recordado" para no reenviar cada día

## Bloque 6 — Distintivo en el panel

- [ ] T024 Panel: distintivo "Esperando respuesta del solicitante · hace N días"
- [ ] T025 La bandeja y los KPI no cambian (es una bandera, no un estado)
- [ ] T026 El botón de re-cotizar sigue funcionando con una ronda abierta (se avisa)

## Bloque 7 — Documentación

- [x] T027 PRD: RF-59…RF-65 y nomenclatura de 8 correos — commit pendiente
- [ ] T028 `user-flows.md`: el flujo en el diagrama de estados y en los correos
- [ ] T029 `TASKS.md`: registrar el trabajo y mover lo resuelto
- [ ] T030 `specs/010/verification.md` con la evidencia
