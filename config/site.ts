/**
 * Marca del portal. Lo que no es dato de negocio y se repite en la UI vive acá
 * (mismo patrón que `config/site.ts` de la referencia).
 */
export const site = {
  name: "Compras BIA",
  fullName: "Portal de Compras BIA",
  tagline: "Solicitudes, comparativas y decisiones en un tablero.",
  url: "https://compras.biahnd.website",
  currency: { code: "HNL", locale: "es-HN" },
  portalAdmin: { label: "Administración", sub: "Trazabilidad" },
} as const;
