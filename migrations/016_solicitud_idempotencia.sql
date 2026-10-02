-- 016: clave de idempotencia en la creación de la solicitud.
-- El envío del solicitante son TRES llamadas encadenadas (crear → logo → transicionar). Con
-- un timeout de cliente que no aborta, un reintento o un refresh a mitad de envío creaban una
-- fila nueva cada vez: borradores huérfanos que el panel del coordinador ni siquiera ve
-- (excluye todo estado previo a ENVIADA_A_COMPRAS).
--
-- El índice es sobre (correo, clave) y NO solo sobre la clave, a propósito: `POST
-- /api/solicitudes` es público (el solicitante no tiene sesión) y en un conflicto devuelve la
-- fila existente. Con la clave sola, un tercero que reutilizara la clave de otra persona
-- recibía su solicitud completa —correo, nombre y descripción—. [MEDIDO] reproducido antes
-- de cerrar esto. El correo es la identidad de este flujo (ver `mis-solicitudes?email=`), así
-- que acotar por correo mantiene la garantía sin abrir la fuga.
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS idempotency_key text;

DROP INDEX IF EXISTS idx_solicitud_idempotencia;

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_idempotencia
  ON solicitud (solicitante_email, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
