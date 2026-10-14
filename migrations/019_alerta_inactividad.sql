-- Marcador de la alerta de inactividad (plan 4.11.7).
--
-- Sin esto, cada clic en "Ejecutar alertas" reenvía el correo 5 a las mismas solicitudes: el
-- disparador es manual (y además hay cron), así que el reenvío es una molestia repetida y no un
-- aviso. Un aviso que se repite deja de leerse.
--
-- El marcador guarda HASTA QUÉ MOVIMIENTO se avisó, no un booleano. Así el aviso se re-arma solo
-- cuando la solicitud vuelve a moverse y después queda inactiva otra vez: una solicitud que ya
-- fue avisada, se movió y volvió a frenar es un problema nuevo y merece un aviso nuevo. Un
-- booleano "avisado" dejaría esa recaída en silencio para siempre.
--
-- `movimiento_avisado` es el mismo valor que usa el detector (`lib/domain/alertas.ts`) como
-- último movimiento real: el máximo entre eventos de trazabilidad, envío, creación y la última
-- carga de cotización.
CREATE TABLE IF NOT EXISTS alerta_inactividad (
  solicitud_id uuid PRIMARY KEY REFERENCES solicitud (id) ON DELETE CASCADE,
  movimiento_avisado timestamptz NOT NULL,
  avisado_en timestamptz NOT NULL DEFAULT now()
);
