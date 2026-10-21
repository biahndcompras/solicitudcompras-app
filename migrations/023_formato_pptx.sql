-- 023 · PowerPoint como formato de cotización.
--
-- El enum `formato_cotizacion` solo tenía pdf/docx/imagen/manual: subir un .pptx no se podía
-- registrar con su formato real.
ALTER TYPE formato_cotizacion ADD VALUE IF NOT EXISTS 'pptx';
