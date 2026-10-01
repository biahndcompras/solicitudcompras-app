-- Marca `forma_pago` como obligatorio. Ningún otro paso del wizard la pide y sin ella el
-- coordinador no puede comparar cotizaciones: sin condiciones de pago, una propuesta más
-- barata no es equivalente a otra.
--
-- No se marca `plazo_entrega` aunque comparte bloque con esta: el paso 2 del wizard ya pide
-- "¿Para cuándo lo necesitás?" (`fechaRequerida`), y obligarlo sería pedir lo mismo dos
-- veces — el solicitante respondería y el aviso lo seguiría reclamando.
--
-- Efecto esperado en el flujo (sin preguntas nuevas): `forma_pago` vive en las plantillas
-- RFQ/RFP, así que el bloque "Información comercial" lo muestra con asterisco y el aviso
-- previo al envío lo lista si quedó sin responder. En un subtipo SIN plantilla (producto)
-- sí se convierte en pregunta del assessment, porque ya no hay otro lugar donde se pida.
UPDATE campo_catalogo
   SET obligatorio = true
 WHERE campo_key = 'forma_pago'
   AND obligatorio IS DISTINCT FROM true;