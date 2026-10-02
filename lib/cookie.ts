// Cookie de continuidad del solicitante (30 días) — sin autenticación.
// Fuente: user-flows.md §2.3. No es autenticación: solo asocia borrador/email.
import { envolverBorrador, desenvolverBorrador, CLAVE_BORRADOR, type SobreBorrador } from "@/lib/domain/borrador";

export const COOKIE_NOMBRE = "bia_session";

export function leerCookie(nombre = COOKIE_NOMBRE): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nombre}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function escribirCookie(
  valor: string,
  opts: { nombre?: string; dias?: number } = {}
): void {
  if (typeof document === "undefined") return;
  const nombre = opts.nombre ?? COOKIE_NOMBRE;
  const dias = opts.dias ?? 30;
  const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${nombre}=${encodeURIComponent(
    valor
  )}; expires=${expira}; path=/; samesite=lax`;
}

export function limpiarCookie(nombre = COOKIE_NOMBRE): void {
  if (typeof document === "undefined") return;
  document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function guardarBorradorEmail(email: string): void {
  escribirCookie(JSON.stringify({ borradorEmail: email }));
}

export function leerBorradorEmail(): string | null {
  const raw = leerCookie();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { borradorEmail?: string };
    return parsed.borradorEmail ?? null;
  } catch {
    return null;
  }
}

export { CLAVE_BORRADOR };

// Guarda el estado completo del borrador en localStorage para retomarlo, con versión y
// marca de tiempo (sin eso, "Borrador activo" era una mentira que se pierde al recargar).
// Devuelve si la escritura REALMENTE ocurrió: si localStorage no existe o la cuota está
// llena (modo privado, cuota agotada), la UI debe decirlo en vez de prometer que guarda.
export function escribirBorrador<T>(estado: T, guardadoEn: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sobre: SobreBorrador = envolverBorrador(estado, guardadoEn);
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(sobre));
    return true;
  } catch {
    return false;
  }
}

/** @deprecated usar escribirBorrador (mismo comportamiento, nombre explícito). */
export const guardarBorrador = escribirBorrador;

/**
 * Lee el borrador tolerando sobre nuevo, objeto plano legado, JSON inválido, array o
 * cualquier basura escrita a mano. Devuelve null si no hay nada aprovechable.
 */
export function leerBorradorSeguro(): {
  estado: Record<string, unknown>;
  guardadoEn: number | null;
  version: number | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    return desenvolverBorrador(localStorage.getItem(CLAVE_BORRADOR));
  } catch {
    return null;
  }
}

/** @deprecated usar leerBorradorSeguro. */
export function leerBorrador<T>(): T | null {
  const sobre = leerBorradorSeguro();
  return sobre ? (sobre.estado as T) : null;
}

export function limpiarBorrador(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLAVE_BORRADOR);
}