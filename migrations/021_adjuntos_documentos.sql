-- 021 · Documentos adjuntos de la solicitud
--
-- La tabla `adjunto` existía desde la 004 pero **nunca se usó**: no guardaba el contenido ni la
-- fecha, así que no había forma de subir un archivo ni de listarlo con su fecha. Se completa
-- para los documentos que suben el coordinador/admin y el propio solicitante.
--
-- Se guarda el binario en `contenido` (bytea), igual que el logo del producto. Es el enfoque
-- que ya tiene el proyecto y no agrega almacenamiento externo; el tamaño se limita en la API.

ALTER TABLE adjunto ADD COLUMN IF NOT EXISTS contenido bytea;
ALTER TABLE adjunto ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS adjunto_solicitud_fecha_idx ON adjunto (solicitud_id, creado_en);

-- Trazabilidad: cada alta/baja deja un evento. El enum no tenía este tipo.
ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'adjunto';
