-- 014: logo/archivo real del producto en la solicitud (H2 — antes era mock en el wizard).
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS archivo_logo_nombre text;
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS archivo_logo_bytea bytea;
