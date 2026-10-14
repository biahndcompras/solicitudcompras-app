---
id: 010
titulo: Preguntas al solicitante y ciclo de re-cotización
gate: G5 (slice verificado)
fecha: 2026-10-07
fixPoint: c73e638
resultado: DONE
---

# Verificación · 010

## Alcance

Que Compras pueda devolver la solicitud al solicitante para pedirle un dato que solo él tiene,
que su respuesta vuelva al coordinador, y que el ciclo se repita. Además: que "ninguna me
sirve" devuelva la solicitud a Compras en vez de cerrarla, y que el recordatorio de 3 días
exista.

## DoD → evidencia

| Criterio | Evidencia | Estado |
|---|---|---|
| RF-59 Compras pide información | `POST /api/solicitudes/[id]/informacion`, 9 tests. Navegador: modal, 2 preguntas, campo atado, envío | ✅ |
| RF-60 El solicitante responde sin sesión | `POST .../informacion/respuesta`, 9 tests. Navegador: recorrido completo con la identidad por correo | ✅ |
| RF-61 El ciclo se repite | 7 tests de integración: ronda 2 se numera 2. Navegador: tras responder, el botón vuelve a ofrecerse | ✅ |
| RF-62 Recordatorio a los 3 días | `informacionVencida` + correo 8 + botón de admin + ruta de cron. 3 tests de integración, 10 de la ruta | ✅ |
| RF-63 Cancelar solo Compras, conservando cotizaciones | Ya cumplía antes; verificado contra el código. No requirió cambios | ✅ |
| RF-64 El solicitante no puede cancelar | Ya cumplía: sin sesión, la ruta de estado solo admite `BORRADOR → ENVIADA_A_COMPRAS` | ✅ |
| RF-65 "Ninguna me sirve" no cierra | `f6a545b`. Verificado contra la base real: `ENVIADA_A_SOLICITANTE` → `EN_COTIZACION` con `fecha_cierre` NULL | ✅ |
| El estado no cambia al pedir información | Test de integración: la solicitud sigue en `ENVIADA_A_COMPRAS` con la bandera puesta | ✅ |
| Una ronda abierta a la vez | Test de integración: la segunda devuelve error | ✅ |
| Responder dos veces no duplica | Test de integración + de la ruta | ✅ |
| La pantalla del solicitante no cambia sin preguntas | Verificado con una solicitud sin ronda: no aparece ni el formulario ni el bloque de respuestas | ✅ |

## Batería

| | |
|---|---|
| Tests | **324 pasan · 20 skip** (38 archivos) |
| `tsc --noEmit` | limpio |
| `eslint` | 0 errores |
| Migraciones | **18 en disco, 18 aplicadas** |
| e2e (Playwright) | **NO re-corridos.** Última cifra registrada: 22/22 (`e8ff42b`) |

## Verificación en navegador (con sesión real de coordinador)

Recorrido completo sobre `RFQ-2026-0036`, con el endpoint real contra la base real:

1. Sin ronda → el botón "Pedir información" se ofrece.
2. Se abre el modal, se escriben dos preguntas, se ata un campo del catálogo a la primera.
3. Se envía → el modal cierra y el bloque aparece con las dos preguntas y **"ESPERANDO
   RESPUESTA"**.
4. El solicitante responde → el bloque pasa a **"RESPONDIDA"** con la respuesta a la vista.
5. El botón **vuelve a ofrecerse**: el ciclo se repite.

Evidencia: `qa/evidencia-piloto/critique-solicitante/010-ronda-en-panel-coordinador.png`.

## Lo que NO está verificado

- **Los e2e no se corrieron.** No cubren el flujo de 010; conviene agregar un spec.
- **El correo 8 no se probó disparando de verdad** (Resend no está configurado en local, así
  que todos los envíos quedan registrados como `fallido`). Lo que sí está probado es que la
  consulta trae las vencidas, que el marcado las saca de la lista (9 → 8 contra la base), y
  que un fallo de envío NO las marca.
- **La ruta de cron no se probó con Vercel.** Está probado el 503 sin secreto y el 401 con
  secreto equivocado.

## QA adversarial (skill `validate`, 2026-10-07)

Revisión del feature completo contra los invariantes del proyecto (determinismo, guardrails de
IA, RN-01, fronteras de auth, datos reales, edge cases, fallos silenciosos, integridad).

**1 hallazgo crítico, corregido:**

| Hallazgo | Reproducción | Corrección |
|---|---|---|
| **El solicitante podía escribir campos que nadie le preguntó.** La ronda preguntaba solo por `color_acabado`; un POST con `{"respuestas":{"plazo_entrega":"..."}}` escribía `plazo_entrega` — un campo que Compras no pidió y que **se va en el RFQ a los proveedores**. Cualquiera con el id y el correo podía inyectar valores en cualquier campo del catálogo | Reproducido contra la base real: la respuesta escrita quedó en `respuesta_campo` | `responderInformacion` filtra contra las claves de la ronda. Se ignoran las de más (no se rechaza la respuesta entera: el dato legítimo ya viajó) y se registran en el log para que no sea silencioso. Test verificado **fallando** contra el código anterior |

**Sospechas verificadas y refutadas** (anotadas para que no se re-investiguen):

- `EXTRACT(DAY FROM (now() - informacion_desde))` parecía devolver el componente de días en vez
  del total, lo que habría roto la antigüedad en rondas de más de un mes. **Refutado** contra
  la base: la resta de dos `timestamp` da un intervalo en días, no en meses — 61 días devuelve 61.
- El umbral usa `>` y no `>=`: una ronda de exactamente 3 días al microsegundo no dispara. Es
  correcto (el recordatorio es "más de 3 días").

**Medios anotados, no corregidos en este bloque:**

- El número de ronda sale de contar eventos `pregunta_solicitante`. Una ronda creada fuera del
  repo no contaría.
- Las respuestas se escriben en `respuesta_campo` con `origen: "assessment"`, que semánticamente
  no es exacto: vinieron de una pregunta, no del assessment.
- `responderInformacion` devuelve `yaRespondida: true` también cuando **nunca hubo** ronda, y la
  ruta responde 200. Inofensivo, pero el mensaje al cliente es engañoso.

## Hallazgos encontrados al construir

| Hallazgo | Resolución |
|---|---|
| `respuesta_campo` era una tabla de **solo escritura** | Resuelto para el ciclo de preguntas. Sigue abierto para los campos de la re-cotización (4.10.11, A MEDIAS) |
| `enviarCorreo` **no lanza** cuando Resend falla: devuelve `estadoEnvio: "fallido"` | Marcaba la ronda como recordada sin haber avisado, apagando el recordatorio para siempre. Ahora se marca solo si salió |
| `TipoEvento` no incluía los eventos nuevos de la migración | Agregados |
| Una pregunta de **solo espacios** pasaba la validación | `.trim().min(1)` |
| Un correo con espacios al final daba 400 | `.trim()` en el schema |
| El linter marcó calcular la fecha durante el render (riesgo de hidratación) | Se sacó el contador de días: decorativo, y la urgencia la cubren el correo y el distintivo |

## Deuda declarada

- El número de ronda sale de **contar eventos** `pregunta_solicitante`. En producción todas
  pasan por el repo; una ronda creada fuera de él no contaría.
- Los tests de integración dejan solicitudes con `informacion_pendiente` en la base de
  desarrollo, que el botón de alertas tomaría como reales (4.10.13).
- 24 MB de capturas y la evidencia previa quedaron fuera del repo por `.gitignore`.

## Decisión

**DONE.** El ciclo completo funciona y está verificado en navegador con datos reales. Los
criterios del DoD mapean a evidencia fresca de esta sesión, salvo los e2e, que no se corrieron
y se declaran arriba.

Pendiente antes de producción, ajeno a esta feature: los bloqueantes de `TASKS.md` §1
(contraseña de Postgres, dominio de correo sin verificar, aceptación escrita del link público).