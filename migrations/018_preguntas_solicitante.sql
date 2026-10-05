-- Preguntas al solicitante (spec 010, RF-59…RF-62).
--
-- Es una BANDERA y no un estado nuevo, a propósito: un estado nuevo obligaría a revisar
-- todos los filtros de la bandeja y los KPI, y esas solicitudes dejarían de aparecer
-- bajo "esperando cotizaciones". Un cambio en lo que significan los números es un cambio
-- de producto, no un detalle de implementación. La solicitud conserva su estado real y
-- esta marca dice que encima hay algo esperando al solicitante.
--
-- El ciclo se repite: solo importa la ronda abierta. El historial de rondas vive en
-- `evento_trazabilidad`, que ya existe para eso.
ALTER TABLE solicitud
  ADD COLUMN IF NOT EXISTS informacion_pendiente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS informacion_preguntas jsonb,
  ADD COLUMN IF NOT EXISTS informacion_desde timestamp,
  ADD COLUMN IF NOT EXISTS informacion_respuesta jsonb;

-- `IF NOT EXISTS` no existe para ADD VALUE en versiones antiguas de Postgres; el bloque
-- DO lo hace idempotente sin romper.
DO $$ BEGIN
  ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'pregunta_solicitante';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'respuesta_solicitante';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- El recordatorio de los 3 días filtra por antigüedad; sin índice es un seq scan sobre
-- todas las solicitudes.
CREATE INDEX IF NOT EXISTS idx_solicitud_informacion_pendiente
  ON solicitud (informacion_desde)
  WHERE informacion_pendiente;
