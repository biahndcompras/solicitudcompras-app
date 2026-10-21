-- 022 · B2 en el servidor: si la solicitud lleva marca, exige el arte adjunto.
--
-- La regla B2 se validaba **solo en el cliente**: `POST /api/solicitudes` y la transición a
-- ENVIADA_A_COMPRAS aceptaban una solicitud con marca y sin logo. Un cliente que hable
-- directo con la API se saltaba el bloqueo.
--
-- Para poder exigirlo hay que saber si la solicitud lleva marca: hasta ahora eso vivía solo en
-- el wizard y nunca se guardaba.
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS lleva_branding boolean NOT NULL DEFAULT false;
