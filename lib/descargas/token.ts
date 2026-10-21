// Token firmado para descargar un adjunto desde el correo (4.13.11).
//
// El enlace del correo abre el archivo sin sesión: el solicitante no tiene login y el
// coordinador puede abrirlo desde el móvil. En vez de exponer el id (que no es un token), se
// firma con HMAC-SHA256 y caduca. El token solo sirve para ESE adjunto de ESA solicitud.
import { createHmac, timingSafeEqual } from "node:crypto";

const DIAS = 7;

function secreto(): string | null {
  return process.env.DOWNLOAD_SECRET || process.env.CRON_SECRET || null;
}

function firma(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export type TokenDescarga = { adjuntoId: string; solicitudId: string; exp: number };

/** Devuelve el token, o `null` si no hay secreto configurado (el correo omite el botón). */
export function firmarDescarga(adjuntoId: string, solicitudId: string, ttlSegundos = DIAS * 86400): string | null {
  const key = secreto();
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSegundos;
  const payload = `${adjuntoId}.${solicitudId}.${exp}`;
  return Buffer.from(JSON.stringify({ adjuntoId, solicitudId, exp, sig: firma(payload, key) })).toString("base64url");
}

/** Verifica el token y que corresponda a este adjunto y esta solicitud. */
export function verificarDescarga(
  token: string,
  adjuntoId: string,
  solicitudId: string
): TokenDescarga | null {
  const key = secreto();
  if (!key) return null;
  try {
    const raw = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as TokenDescarga & { sig?: string };
    if (!raw?.sig || raw.adjuntoId !== adjuntoId || raw.solicitudId !== solicitudId) return null;
    if (!Number.isFinite(raw.exp) || raw.exp * 1000 < Date.now()) return null;
    const esperado = firma(`${raw.adjuntoId}.${raw.solicitudId}.${raw.exp}`, key);
    const a = Buffer.from(raw.sig);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { adjuntoId: raw.adjuntoId, solicitudId: raw.solicitudId, exp: raw.exp };
  } catch {
    return null;
  }
}

/** URL absoluta de descarga para el correo. */
export function urlDescargaAdjunto(
  base: string,
  solicitudId: string,
  adjuntoId: string
): string | null {
  const token = firmarDescarga(adjuntoId, solicitudId);
  if (!token) return null;
  const limpia = base.replace(/\/+$/, "");
  return `${limpia}/api/solicitudes/${encodeURIComponent(solicitudId)}/adjuntos/${encodeURIComponent(adjuntoId)}?token=${encodeURIComponent(token)}`;
}
