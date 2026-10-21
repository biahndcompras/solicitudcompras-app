-- Historial de rondas de preguntas al solicitante (4.13.20).
--
-- Antes cada ronda vivía en columnas de `solicitud` (`informacion_preguntas` /
-- `informacion_respuesta`): al abrir una ronda nueva se sobrescribía la anterior y el
-- coordinador solo podía leer la última. Los eventos guardaban el resumen ("Ronda 2: 1
-- pregunta(s)"), sin el texto ni la respuesta. Con RFQ-2026-0036 hubo 4 rondas y solo
-- sobrevivió la 2.
--
-- Esta tabla es el registro completo. La UI lee de acá; las columnas de `solicitud` se
-- mantienen porque son el estado de la ronda ABIERTA (la que bloquea pedir otra).
CREATE TABLE IF NOT EXISTS ronda_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES solicitud (id) ON DELETE CASCADE,
  ronda integer NOT NULL,
  -- [{ campoKey, pregunta }] tal como se le mostraron al solicitante.
  preguntas jsonb NOT NULL,
  -- { campoKey: valor } tal como las respondió. NULL mientras la ronda está abierta.
  respuestas jsonb,
  pedida_por text,
  pedida_en timestamptz NOT NULL DEFAULT now(),
  respondida_en timestamptz,
  UNIQUE (solicitud_id, ronda)
);

CREATE INDEX IF NOT EXISTS idx_ronda_preguntas_solicitud
  ON ronda_preguntas (solicitud_id, ronda);

-- Backfill de la ronda que sí sigue viva en `solicitud`. Las anteriores no se pueden
-- recuperar: no queda su texto en ningún lado (solo el resumen del evento).
INSERT INTO ronda_preguntas (solicitud_id, ronda, preguntas, respuestas, pedida_por, pedida_en, respondida_en)
SELECT
  s.id,
  (s.informacion_preguntas->>'ronda')::int,
  s.informacion_preguntas->'preguntas',
  s.informacion_respuesta->'respuestas',
  s.informacion_preguntas->>'pedidaPor',
  COALESCE((s.informacion_preguntas->>'pedidaEn')::timestamptz, s.informacion_desde, now()),
  CASE
    WHEN s.informacion_respuesta IS NOT NULL
      THEN (s.informacion_respuesta->>'respondidaEn')::timestamptz
    ELSE NULL
  END
FROM solicitud s
WHERE s.informacion_preguntas IS NOT NULL
  AND (s.informacion_preguntas->>'ronda') ~ '^[0-9]+$'
  AND jsonb_typeof(s.informacion_preguntas->'preguntas') = 'array'
ON CONFLICT (solicitud_id, ronda) DO NOTHING;
