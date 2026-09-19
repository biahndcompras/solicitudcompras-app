// Semáforo de estado de solicitud — Portal de Compras BIA
// Evalúa si una solicitud está a tiempo, en riesgo o retrasada respecto a su fecha requerida.
// Sin dependencias (dominio puro). Usado por solicitante, coordinador y admin.
import type { EstadoSolicitud } from "./types";

export type NivelSemaforo = "ok" | "riesgo" | "retraso";

const TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);

export function calcularSemaforo(input: {
  estado: EstadoSolicitud;
  fechaRequerida?: string;
  fechaCreacion?: string;
  now?: string;
}): { nivel: NivelSemaforo; texto: string; diasRestantes: number | null } {
  const { estado, fechaRequerida, now } = input;

  // Solicitudes cerradas/canceladas no tienen semáforo.
  if (TERMINALES.has(estado)) {
    return { nivel: "ok", texto: "Cerrada", diasRestantes: null };
  }

  if (!fechaRequerida) {
    return { nivel: "ok", texto: "Sin fecha límite", diasRestantes: null };
  }

  const hoy = new Date(now ?? new Date().toISOString());
  const hoyIso = hoy.toISOString().slice(0, 10);
  const requeridaIso = fechaRequerida.slice(0, 10);
  const dias = Math.round(
    (new Date(requeridaIso + "T23:59:59").getTime() - new Date(hoyIso + "T00:00:00").getTime()) / 86400000
  );

  if (dias < 0) {
    return { nivel: "retraso", texto: `Retrasada por ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`, diasRestantes: dias };
  }
  if (dias <= 2) {
    return { nivel: "riesgo", texto: dias === 0 ? "Vence hoy" : `Quedan ${dias} día${dias === 1 ? "" : "s"}`, diasRestantes: dias };
  }
  return { nivel: "ok", texto: `${dias} días de margen`, diasRestantes: dias };
}

// Badge de color para la UI (classes Tailwind).
export const SEMAFORO_CLASES: Record<NivelSemaforo, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  riesgo: "bg-amber-50 text-amber-700 border-amber-200",
  retraso: "bg-rose-50 text-rose-700 border-rose-200",
};

export const SEMAFORO_DOT: Record<NivelSemaforo, string> = {
  ok: "bg-emerald-500",
  riesgo: "bg-amber-500",
  retraso: "bg-rose-500",
};

// Tiempo de atención de una solicitud: cuánto lleva abierta (creación → hoy) o
// de punta a punta (creación → cierre). Usado por admin/coordinador (3.1 SLA).
export function duracionAtencion(input: {
  fechaCreacion?: string;
  fechaCierre?: string;
  now?: string;
}): { dias: number | null; texto: string; cerrada: boolean } {
  const inicio = input.fechaCreacion ? new Date(input.fechaCreacion).getTime() : null;
  if (!inicio) return { dias: null, texto: "—", cerrada: false };
  const fin = input.fechaCierre
    ? new Date(input.fechaCierre).getTime()
    : input.now
      ? new Date(input.now).getTime()
      : Date.now();
  const dias = Math.max(0, (fin - inicio) / 86400000);
  const cerrada = Boolean(input.fechaCierre);
  return { dias, texto: formatoDuracion(dias), cerrada };
}

export function formatoDuracion(dias: number): string {
  if (dias < 1) {
    const horas = Math.round(dias * 24);
    return `${horas} h`;
  }
  if (dias < 60) {
    const d = Math.round(dias);
    return `${d} día${d === 1 ? "" : "s"}`;
  }
  const d = Math.floor(dias);
  const m = Math.floor((dias - d) * 30);
  return `${d} d · ${m} m`;
}