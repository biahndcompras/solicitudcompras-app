-- Migración 013 — Persistencia del archivo original de cotizaciones (2.2)
-- Permite adjuntar los PDFs/cotizaciones originales al envío de comparativa y
-- conservar el documento cargado por el coordinador (hoy solo se guardaba el markdown).
ALTER TABLE cotizacion ADD COLUMN IF NOT EXISTS archivo_original_bytea bytea;
ALTER TABLE cotizacion ADD COLUMN IF NOT EXISTS archivo_original_nombre text;