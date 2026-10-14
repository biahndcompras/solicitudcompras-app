// Métricas derivadas del dashboard — Portal de Compras BIA
// Fuente: diccionario 15 §4. Se calculan desde solicitudes (en prod, desde eventos).
// Puras, sin dependencias.
import type { Solicitud } from "./types";

export type MetricasDashboard = {
  tasaConversion: number | null;
  tiempoCicloPromedioDias: number | null;
  solicitudesActivas: number;
  solicitudesSinDecision: number;
  volumenPorCoordinador: Record<string, number>;
  distribucionPorTipo: Record<string, number>;
  /** Distribución por subtipo (producto/servicio/mixto) — 4.4.4. */
  distribucionPorSubtipo: Record<string, number>;
  /** Días promedio por etapa del ciclo, desde `evento_trazabilidad` — RF-52. Vacío si no hay eventos. */
  tiempoPorEtapa?: Record<string, number | null>;
  /** Umbral en días realmente aplicado al KPI "sin decisión" — 4.10.9. */
  umbralDias?: number;
};

function diasEntre(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return diff / (1000 * 60 * 60 * 24);
}

export function calcularMetricas(
  solicitudes: Solicitud[],
  opts?: { hoy?: string; umbralDias?: number }
): MetricasDashboard {
  const hoy = opts?.hoy ?? new Date().toISOString();
  const umbralDias = opts?.umbralDias && opts.umbralDias > 0 ? Math.floor(opts.umbralDias) : 5;

  const enviadas = solicitudes.filter((s) => s.estado !== "BORRADOR");
  const cerradasConDecision = solicitudes.filter(
    (s) => s.estado === "CERRADA_CON_DECISION"
  );
  const tasaConversModelo =
    enviadas.length === 0 ? null : cerradasConDecision.length / enviadas.length;

  const conTiempo = solicitudes
    .map((s) => diasEntre(s.fechaEnvio, s.fechaCierre))
    .filter((d): d is number => d !== null && d >= 0);
  const tiempoCiclo =
    conTiempo.length === 0 ? null : conTiempo.reduce((a, b) => a + b, 0) / conTiempo.length;

  const activas = solicitudes.filter(
    (s) => !["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA", "BORRADOR"].includes(s.estado)
  );

  // Espejo de la consulta SQL del repo (4.10.9): sin BORRADOR (nunca se envió, no espera
  // decisión) y con el umbral recibido, no un 5 cableado.
  const sinDecision = solicitudes.filter(
    (s) =>
      !["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA", "BORRADOR"].includes(s.estado) &&
      diasEntre(s.fechaCreacion, hoy) !== null &&
      (diasEntre(s.fechaCreacion, hoy) ?? 0) > umbralDias
  );

  const volumenPorCoordinador: Record<string, number> = {};
  const distribucionPorTipo: Record<string, number> = {};
  const distribucionPorSubtipo: Record<string, number> = {};
  for (const s of solicitudes) {
    if (s.coordinadorId) {
      volumenPorCoordinador[s.coordinadorId] =
        (volumenPorCoordinador[s.coordinadorId] ?? 0) + 1;
    }
    const tipo = s.tipo ?? "SIN_TIPO";
    distribucionPorTipo[tipo] = (distribucionPorTipo[tipo] ?? 0) + 1;
    const subtipo = s.subtipo ?? "SIN_SUBTIPO";
    distribucionPorSubtipo[subtipo] = (distribucionPorSubtipo[subtipo] ?? 0) + 1;
  }

  return {
    tasaConversion: tasaConversModelo === null ? null : tasaConversModelo * 100,
    tiempoCicloPromedioDias: tiempoCiclo,
    solicitudesActivas: activas.length,
    solicitudesSinDecision: sinDecision.length,
    volumenPorCoordinador,
    distribucionPorTipo,
    distribucionPorSubtipo,
    umbralDias,
  };
}

export function tasaConversionTexto(m: MetricasDashboard): string {
  return m.tasaConversion === null
    ? "sin datos"
    : `${m.tasaConversion.toFixed(0)}%`;
}