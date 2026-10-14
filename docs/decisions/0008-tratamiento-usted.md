---
status: accepted
authority: product
fecha: 2026-10-14
---

# Registro de la interfaz: "usted", nunca voseo

Toda la interfaz del portal se dirige al usuario de **usted**. Se descarta el voseo
("tenés", "podés", "elegí", "escribí") que se había usado hasta ahora.

**Decisión del cliente (Ladi Matute), 2026-10-14.**

## Por qué importa que sea una sola voz

El portal lo usan tres roles de una empresa hondureña con manual de estilo formal, y los correos
que salen del sistema los lee gente de proveedores. Mezclar tratamientos hace que el producto
suene improvisado, y la inconsistencia se notaba: la documentación decía "usted" mientras toda la
pantalla trataba de "vos".

## Alcance

No es solo texto de pantalla. Incluye:

- Las pantallas de los tres roles.
- Los **ocho correos** del sistema.
- Los **manuales** de `docs/guias/`.
- **El prompt de la IA**: `contexto_investigado` estaba instruido explícitamente para hablar de
  "vos", así que el asistente escribía en voseo aunque la pantalla dijera otra cosa.
- `docs/product/user-flows.md`, que es la autoridad de comportamiento.

## Consecuencia

Es un cambio de copy masivo y sin lógica: se hace de una vez y se verifica con una búsqueda de
los patrones de voseo, porque una conversión a medias es peor que ninguna.
