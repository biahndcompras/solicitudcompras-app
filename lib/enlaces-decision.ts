// Mapa local de enlaces de decisión que el solicitante YA abrió en este navegador.
// Existe para que "Mis solicitudes" pueda ofrecer el CTA de decisión sin exponer el token
// por la API: el token solo se devuelve a quien ya lo tenía (el propio solicitante, en su
// navegador). Si se decide desde otro dispositivo, la UI dice que revise su correo.

const CLAVE = "bia_decision_links";
const MAX = 20;

export type MapaDecision = Record<string, { token: string; vistoEn: number }>;

function leer(): MapaDecision {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null || Array.isArray(o)) return {};
    const out: MapaDecision = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "object" && v !== null) {
        const t = (v as { token?: unknown }).token;
        if (typeof t === "string" && t.length > 0 && t.length < 200) {
          out[k] = { token: t, vistoEn: Number((v as { vistoEn?: unknown }).vistoEn) || 0 };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function leerMapaDecision(): MapaDecision {
  return leer();
}

/* --- Integración con useSyncExternalStore: snapshot estable (misma referencia mientras no
   cambie) y suscripción a cambios, para leer localStorage sin setState dentro de un effect. --- */

let cache: MapaDecision | null = null;

export function snapshotDecision(): MapaDecision {
  if (cache === null) cache = leer();
  return cache;
}

export function servidorDecision(): MapaDecision {
  return VACIO;
}

const VACIO: MapaDecision = {};

const listeners = new Set<() => void>();

export function suscribirDecision(cb: () => void): () => void {
  listeners.add(cb);
  const enStorage = () => {
    cache = null;
    cb();
  };
  window.addEventListener("storage", enStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", enStorage);
  };
}

function avisar(): void {
  cache = null;
  for (const cb of listeners) cb();
}

export function guardarDecisionToken(solicitudId: string, token: string): void {
  if (typeof window === "undefined" || !solicitudId || !token) return;
  try {
    const actual = leer();
    const entradas = Object.entries({ ...actual, [solicitudId]: { token, vistoEn: Date.now() } })
      .sort((a, b) => b[1].vistoEn - a[1].vistoEn)
      .slice(0, MAX);
    window.localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(entradas)));
    avisar();
  } catch {
    /* sin almacenamiento: la UI simplemente no ofrezca el CTA */
  }
}

/** Estados en los que la decisión del solicitante es el siguiente paso. */
export function esperandoDecision(estado: string): boolean {
  return estado === "ENVIADA_A_SOLICITANTE";
}
