import type { Solicitud } from "@/lib/domain/types";

/**
 * Series diarias del dashboard del admin.
 *
 * Todas salen de fechas reales de la solicitud (`fechaCreacion` / `fechaCierre`) y del
 * estado actual. No se inventan cifras (RN-06): un día sin cierres devuelve `null` en
 * conversión y tiempo, no 0.
 *
 * Se agrupa por día **UTC** (el ISO que llega de la base) y se etiqueta en es-HN con
 * `timeZone: "UTC"`, para que el bucket y la etiqueta no se desfasen.
 */
export type DiaSerie = {
  /** AAAA-MM-DD (UTC) */
  fecha: string;
  /** Etiqueta corta, p. ej. «21 oct» */
  label: string;
  creadas: number;
  cerradas: number;
  /** Solicitudes abiertas al final de ese día. */
  activas: number;
  /** % acumulado de aceptadas sobre enviadas hasta ese día (misma regla que el backend). */
  conversion: number | null;
  /** Días promedio de ciclo de las cerradas hasta ese día. `null` si no cerró ninguna. */
  tiempo: number | null;
  /** Solicitudes esperando decisión hace más de `umbral` días al final de ese día. */
  sinDecision: number;
};

const DIA_MS = 86_400_000;

/**
 * Estados «abiertos» para el KPI de sin decisión: la MISMA regla que el backend
 * (`postgres-repo.ts`: NOT IN terminales, BORRADOR). Si acá se filtrara solo
 * «ENVIADA_A_SOLICITANTE», el panel diría 0 mientras el KPI dice 9.
 */
export const ESTADOS_ABIERTOS = new Set([
  "ENVIADA_A_COMPRAS",
  "EN_COTIZACION",
  "COMPARATIVA_LISTA",
  "ENVIADA_A_SOLICITANTE",
]);

/** Día LOCAL (AAAA-MM-DD), no UTC: el usuario ve fechas locales en toda la app. */
function claveDia(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function claveDeIso(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : claveDia(d);
}

function diasEntre(desdeIso: string, hastaClave: string): number {
  // Diferencia de DÍAS DE CALENDARIO: se normalizan ambos extremos a medianoche local.
  // Con timestamps crudos, una solicitud creada a las 12:00 «cumple» un día menos.
  const desde = new Date(desdeIso);
  const hasta = new Date(`${hastaClave}T00:00:00`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return 0;
  desde.setHours(0, 0, 0, 0);
  return Math.round((hasta.getTime() - desde.getTime()) / DIA_MS);
}

export function serieDashboard(
  solicitudes: Solicitud[],
  dias = 14,
  umbral = 5,
  hoy = new Date()
): DiaSerie[] {
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const claves: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoyLocal);
    d.setDate(d.getDate() - i);
    claves.push(claveDia(d));
  }

  const porCreacion = new Map<string, number>();
  const cerradasPorDia = new Map<string, Solicitud[]>();
  for (const s of solicitudes) {
    const cre = claveDeIso(s.fechaCreacion);
    if (cre) porCreacion.set(cre, (porCreacion.get(cre) ?? 0) + 1);
    const cie = claveDeIso(s.fechaCierre);
    if (cie) {
      const lista = cerradasPorDia.get(cie) ?? [];
      lista.push(s);
      cerradasPorDia.set(cie, lista);
    }
  }

  return claves.map((fecha) => {
    // Conversión ACUMULADA: aceptadas / enviadas hasta ese día. Es la definición del KPI
    // del backend (`tasaConversion = cerradas / enviadas`), no «cerradas con decisión /
    // cerradas del día»: si no, la tarjeta y su sparkline medirían cosas distintas.
    const enviadasHasta = solicitudes.filter((s) => {
      if (s.estado === "BORRADOR") return false;
      const cre = claveDeIso(s.fechaCreacion);
      return cre !== null && cre <= fecha;
    }).length;
    const aceptadasHasta = solicitudes.filter((s) => {
      if (s.estado !== "CERRADA_CON_DECISION") return false;
      const cie = claveDeIso(s.fechaCierre);
      return cie !== null && cie <= fecha;
    }).length;

    // Tiempo promedio acumulado de las cerradas hasta ese día (misma idea: la cifra grande
    // es la oficial; la serie muestra cómo evoluciona).
    const cerradasHasta = solicitudes.filter((s) => {
      const cie = claveDeIso(s.fechaCierre);
      return cie !== null && cie <= fecha;
    });
    const duraciones = cerradasHasta
      .map((s) => diasEntre(s.fechaCreacion, claveDeIso(s.fechaCierre) ?? ""))
      .filter((n) => Number.isFinite(n) && n >= 0);

    return {
      fecha,
      label: new Date(`${fecha}T00:00:00`).toLocaleDateString("es-HN", {
        day: "2-digit",
        month: "short",
      }),
      creadas: porCreacion.get(fecha) ?? 0,
      cerradas: (cerradasPorDia.get(fecha) ?? []).length,
      activas: solicitudes.filter((s) => {
        if (s.estado === "BORRADOR") return false;
        const cre = claveDeIso(s.fechaCreacion);
        const cie = claveDeIso(s.fechaCierre);
        return cre !== null && cre <= fecha && (!cie || cie > fecha);
      }).length,
      conversion: enviadasHasta ? Math.round((aceptadasHasta / enviadasHasta) * 100) : null,
      tiempo: duraciones.length
        ? Number((duraciones.reduce((a, b) => a + b, 0) / duraciones.length).toFixed(1))
        : null,
      // `>` y no `>=`: «más de N días», igual que el KPI del backend (4.10.9).
      sinDecision: solicitudes.filter(
        (s) => ESTADOS_ABIERTOS.has(s.estado) && diasEntre(s.fechaCreacion, fecha) > umbral
      ).length,
    };
  });
}

/**
 * Rellena los huecos de una serie que solo tiene valor los días con cierre.
 *
 * Conversión y tiempo no existen los días sin cierres; para el sparkline se arrastra el
 * último valor conocido (y se retro-rellena el inicio). La cifra grande del KPI sigue
 * siendo la oficial, no esta serie.
 */
export function rellenarSerie(valores: (number | null)[]): number[] {
  const salida = [...valores];
  let ultimo: number | null = null;
  for (let i = 0; i < salida.length; i++) {
    if (salida[i] !== null) ultimo = salida[i];
    else if (ultimo !== null) salida[i] = ultimo;
  }
  let siguiente: number | null = null;
  for (let i = salida.length - 1; i >= 0; i--) {
    if (salida[i] !== null) siguiente = salida[i];
    else if (siguiente !== null) salida[i] = siguiente;
  }
  return salida.map((v) => v ?? 0);
}

/** Último valor no nulo de una serie (para el sparkline no terminar en 0 artificial). */
export function ultimoValor(valores: (number | null)[]): number | null {
  for (let i = valores.length - 1; i >= 0; i--) if (valores[i] !== null) return valores[i];
  return null;
}
