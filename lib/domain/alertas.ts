// Motor de alertas — Portal de Compras BIA
// Fuente: doc 17 H4.4 + RF-57. Reglas determinísticas (sin IA). Puras, sin dependencias de IO.
import type { Cotizacion, EventoTrazabilidad, Solicitud } from "./types";

export type AlertaCompras = {
  tipo: "inactividad" | "sin_desglose_fiscal" | "una_sola_cotizacion" | "discrepancia";
  solicitudId: string;
  titulo: string;
  detalle: string;
  criticidad: "alta" | "media";
};

const TERMINALES = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"];

/**
 * Instante del último movimiento REAL de una solicitud, en ms.
 *
 * Se toma el máximo entre:
 *  - el último evento de trazabilidad (la actividad real: cambio de estado, carga de
 *    cotización, correo, reasignación, pregunta/respuesta, edición), y
 *  - los hitos derivables de la propia solicitud y sus cotizaciones (creación, envío,
 *    fecha de carga más reciente), como respaldo cuando no hay eventos.
 *
 * Tomar el máximo evita falsos positivos: cualquier señal reciente de actividad cuenta,
 * aunque otra fuente esté desactualizada o falte.
 */
function fechaUltimoMovimiento(
  s: Solicitud,
  cotizaciones: Cotizacion[],
  eventos: EventoTrazabilidad[]
): number {
  let max = new Date(s.fechaCreacion).getTime();
  const considerar = (ms: number) => {
    if (Number.isFinite(ms) && (!Number.isFinite(max) || ms > max)) max = ms;
  };
  if (s.fechaEnvio) considerar(new Date(s.fechaEnvio).getTime());
  for (const e of eventos) considerar(new Date(e.timestamp).getTime());
  for (const c of cotizaciones) if (c.fechaCarga) considerar(new Date(c.fechaCarga).getTime());

  // Si ninguna fecha fuera válida se devuelve NaN para NO alertar: sin datos de movimiento
  // no se inventa una inactividad.
  return max;
}

export function detectarAlertas(opts: {
  solicitudes: Solicitud[];
  cotizacionesPorSolicitud: Record<string, Cotizacion[]>;
  /** Eventos de trazabilidad por solicitud. Es la referencia de "último movimiento":
   *  la actividad real (cambios de estado, cargas, correos, reasignaciones, preguntas).
   *  Si falta, se cae a los hitos derivables de la propia solicitud y sus cotizaciones. */
  eventosPorSolicitud?: Record<string, EventoTrazabilidad[]>;
  discrepanciasPorSolicitud?: Record<string, boolean>;
  umbralDias?: number;
  hoy?: string;
}): AlertaCompras[] {
  const {
    solicitudes,
    cotizacionesPorSolicitud,
    eventosPorSolicitud = {},
    discrepanciasPorSolicitud = {},
    umbralDias = 5,
    hoy = new Date().toISOString(),
  } = opts;
  const alertas: AlertaCompras[] = [];
  const umbralMs = umbralDias * 24 * 60 * 60 * 1000;

  for (const s of solicitudes) {
    if (TERMINALES.includes(s.estado)) continue;
    const cotizaciones = cotizacionesPorSolicitud[s.id] ?? [];

    // 1. Inactividad: sin movimiento real desde hace más del umbral.
    //    Antes se miraba `!s.fechaEnvio`, que en el panel es siempre falso (los borradores
    //    no llegan), así que la alerta era imposible. Ahora el último movimiento es la
    //    actividad real: el evento de trazabilidad más reciente, y como respaldo los hitos
    //    derivables (creación, envío y última carga de cotización).
    const ultimoMovimientoMs = fechaUltimoMovimiento(s, cotizaciones, eventosPorSolicitud[s.id] ?? []);
    const antiguedadMs = new Date(hoy).getTime() - ultimoMovimientoMs;
    if (antiguedadMs > umbralMs) {
      alertas.push({
        tipo: "inactividad",
        solicitudId: s.id,
        titulo: s.titulo,
        detalle: `Sin avance hace más de ${umbralDias} días.`,
        criticidad: "media",
      });
    }

    // 2. Sin desglose fiscal (hay monto total pero impuestos no desglosados ni declarados).
    cotizaciones.forEach((c) => {
      if (c.valorTotal === undefined) return;
      if (c.impuestosDesglosados !== true) {
        alertas.push({
          tipo: "sin_desglose_fiscal",
          solicitudId: s.id,
          titulo: s.titulo,
          detalle: `La cotización de ${c.proveedorNombre} no desglosa impuestos.`,
          criticidad: "alta",
        });
      }
    });

    // 3. Una sola cotización (no comparable).
    if (cotizaciones.length === 1) {
      alertas.push({
        tipo: "una_sola_cotizacion",
        solicitudId: s.id,
        titulo: s.titulo,
        detalle: "Solo hay una cotización; se necesita al menos una más para comparar.",
        criticidad: "media",
      });
    }

    // 4. Discrepancia de especificación detectada.
    if (discrepanciasPorSolicitud[s.id]) {
      alertas.push({
        tipo: "discrepancia",
        solicitudId: s.id,
        titulo: s.titulo,
        detalle: "Los proveedores ofertaron especificaciones distintas.",
        criticidad: "alta",
      });
    }
  }

  return alertas;
}