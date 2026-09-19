// Máquina de estados de solicitud — Portal de Compras BIA
// Fuente: diccionario de datos (doc 15, §3.1). Sin dependencias.
import type { EstadoSolicitud, EventoTrazabilidad, Solicitud } from "./types";

const TRANSICIONES: Partial<Record<EstadoSolicitud, EstadoSolicitud[]>> = {
  BORRADOR: ["ENVIADA_A_COMPRAS", "CANCELADA"],
  ENVIADA_A_COMPRAS: ["EN_COTIZACION", "CANCELADA"],
  EN_COTIZACION: ["COMPARATIVA_LISTA", "CERRADA_SIN_DECISION", "ENVIADA_A_COMPRAS"],
  COMPARATIVA_LISTA: ["ENVIADA_A_SOLICITANTE", "EN_COTIZACION"],
  ENVIADA_A_SOLICITANTE: ["CERRADA_CON_DECISION", "EN_COTIZACION", "CERRADA_SIN_DECISION"],
};

export function esTransicionValida(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud
): boolean {
  return (TRANSICIONES[desde] ?? []).includes(hacia);
}

export function transicionesDesde(estado: EstadoSolicitud): EstadoSolicitud[] {
  return TRANSICIONES[estado] ?? [];
}

export type ResultadoTransicion =
  | { ok: true; solicitud: Solicitud; evento: EventoTrazabilidad }
  | { ok: false; error: string };

export function aplicarTransicion(
  solicitud: Solicitud,
  hacia: EstadoSolicitud,
  options?: {
    actorTipo?: EventoTrazabilidad["actorTipo"];
    actorIdentificador?: string;
    nota?: string;
    now?: string;
  }
): ResultadoTransicion {
  const nowo = options?.now ?? new Date().toISOString();
  if (!esTransicionValida(solicitud.estado, hacia)) {
    return {
      ok: false,
      error: `Transición inválida: ${solicitud.estado} → ${hacia}`,
    };
  }
  const esTerminal = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(
    hacia
  );
  return {
    ok: true,
    solicitud: {
      ...solicitud,
      estado: hacia,
      fechaEnvio:
        hacia === "ENVIADA_A_COMPRAS" ? (solicitud.fechaEnvio ?? nowo) : solicitud.fechaEnvio,
      fechaCierre: esTerminal ? ahora(nowo) : solicitud.fechaCierre,
    },
    evento: {
      id: `evt-${nowo}-${Math.random().toString(36).slice(2, 8)}`,
      solicitudId: solicitud.id,
      tipoEvento: "cambio_estado",
      estadoAnterior: solicitud.estado,
      estadoNuevo: hacia,
      actorTipo: options?.actorTipo ?? "sistema",
      actorIdentificador: options?.actorIdentificador,
      nota: options?.nota,
      timestamp: nowo,
    },
  };
}

function ahora(iso: string): string {
  return iso;
}