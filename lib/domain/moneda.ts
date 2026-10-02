// Equivalente orientativo de moneda para la vista de decisión del solicitante.
// Puras. La tasa es una REFERENCIA FIJA declarada con su fecha: el objetivo es que el
// solicitante pueda comparar "HNL 98.9" contra "USD 31.5" sin que el sistema prometa una
// conversión contractual. El total facturado sigue siendo el de la moneda del proveedor.

export const MONEDA_BASE = "HNL";

/** Tasa de referencia USD→HNL. Actualizarla es una decisión editorial fechada, no un fetch. */
export const TASA_REFERENCIA_USD_HNL = 24.7;
export const FECHA_TASA_REFERENCIA = "2026-09-01";

export const ETIQUETA_MONEDA: Record<string, string> = {
  HNL: "L",
  USD: "US$",
  EUR: "€",
  MXN: "MX$",
  COP: "COL$",
};

/** Tasas expresadas en HNL por 1 unidad de la moneda. */
const TASAS_A_HNL: Record<string, number> = {
  HNL: 1,
  USD: TASA_REFERENCIA_USD_HNL,
  EUR: TASA_REFERENCIA_USD_HNL * 1.08,
  MXN: TASA_REFERENCIA_USD_HNL / 18.2,
  COP: TASA_REFERENCIA_USD_HNL / 3900,
};

export function monedaConocida(moneda: string | undefined | null): boolean {
  return !!moneda && TASAS_A_HNL[moneda.toUpperCase()] !== undefined;
}

export function formatoMoneda(moneda: string, monto: number | null | undefined): string {
  const n = typeof monto === "number" && Number.isFinite(monto) ? monto : null;
  if (n === null) return "—";
  const etiqueta = ETIQUETA_MONEDA[moneda.toUpperCase()] ?? moneda;
  const decimales = Number.isInteger(n) ? 0 : 2;
  return `${etiqueta} ${n.toLocaleString("es-HN", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: 2,
  })}`;
}

export type Equivalente = {
  monto: number;
  redondeado: string;
  nota: string;
};

/**
 * Convierte a la moneda base para comparar entre proveedores. `null` si la moneda no es
 * conocida: es preferible no mostrar equivalente a inventar uno.
 */
export function equivalenteOrientativo(
  monto: number | null | undefined,
  moneda: string | undefined | null
): Equivalente | null {
  if (typeof monto !== "number" || !Number.isFinite(monto) || !monedaConocida(moneda)) return null;
  const tasa = TASAS_A_HNL[moneda!.toUpperCase()];
  if (tasa === 1) return null; // ya está en la moneda base: no hay equivalente que añadir
  const convertido = monto * tasa;
  return {
    monto: convertido,
    redondeado: formatoMoneda(MONEDA_BASE, Math.round(convertido)),
    nota: `Equivalente orientativo a ${MONEDA_BASE} · tasa de referencia del ${FECHA_TASA_REFERENCIA}. El cobro real va en ${moneda!.toUpperCase()}.`,
  };
}
