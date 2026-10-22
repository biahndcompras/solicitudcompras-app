/**
 * Roles de sesión y su portal. Módulo puro (sin `next/headers`) para poder usarlo
 * tanto en el servidor como en el cliente (login, middleware).
 */
export type RolSesion = "coordinador" | "admin" | "solicitante";

/** Portal de cada rol. Los solicitantes no tienen panel: vuelven a su entrada pública. */
export function rutaPorRol(rol?: string | null): string {
  if (rol === "admin") return "/admin";
  if (rol === "coordinador") return "/panel";
  return "/";
}

/** El login con contraseña es solo para el equipo de Compras (admin y coordinador). */
export function esStaff(rol?: string | null): boolean {
  return rol === "admin" || rol === "coordinador";
}
