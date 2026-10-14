---
status: accepted
authority: security
fecha: 2026-10-14
---

# Riesgo asumido: el enlace público de decisión no tiene contraseña

El enlace que recibe el solicitante para decidir sobre la comparativa (`/comparativa/<token>`) se
abre **sin iniciar sesión**. Quien tenga el enlace ve los precios y las condiciones de todos los
proveedores cotizados. Es una decisión consciente del cliente, no un descuido.

**Aceptado por escrito por Compras (Ladi Matute) el 2026-10-14.**

## Mitigaciones vigentes

- Token de 12 bytes criptográficos (`randomBytes`), que no se adivina.
- Expiración configurable; 90 días por defecto.
- El servidor rechaza una decisión si la solicitud ya no está en `ENVIADA_A_SOLICITANTE`.
- No se indexa en buscadores.

## Lo que el riesgo implica

- **Reenviar el correo equivale a compartir los precios.** El portal no puede distinguir entre el
  solicitante y quien recibió el mensaje reenviado.
- El enlace **no se revoca** al decidir: al recargarlo vuelve a mostrar las tarjetas, aunque el
  servidor rechace una segunda decisión (deuda 4.7.8 en `TASKS.md`).

## Alternativa descartada

Exigir contraseña o sesión para abrir el enlace. Se descartó porque el flujo del solicitante es
deliberadamente sin login (su identidad es el correo), y agregarlo cambiaría el recorrido completo
para un riesgo que Compras decidió asumir. fuente: PRD §riesgos, brief §riesgo asumido, doc 22.
