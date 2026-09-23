"use client";

// Mini-tracker de etapas de una solicitud (estilo "pedido": creada → en cotización
// → comparativa → espera decisión → cerrada). Para solicitante/coordinador/admin.
import type { EstadoSolicitud } from "@/lib/domain/types";

export const ETAPAS: { estado: EstadoSolicitud[]; label: string; icono: string }[] = [
  { estado: ["BORRADOR", "ENVIADA_A_COMPRAS"], label: "Creada", icono: "📝" },
  { estado: ["EN_COTIZACION"], label: "En cotización", icono: "🧾" },
  { estado: ["COMPARATIVA_LISTA"], label: "Comparativa", icono: "⚖️" },
  { estado: ["ENVIADA_A_SOLICITANTE"], label: "Tu decisión", icono: "🗳️" },
  { estado: ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"], label: "Cerrada", icono: "✅" },
];

function indiceEtapa(estado: EstadoSolicitud): number {
  return ETAPAS.findIndex((e) => e.estado.includes(estado));
}

export function TrackerEtapas({ estado, compacto = false }: { estado: EstadoSolicitud; compacto?: boolean }) {
  const actual = Math.max(0, indiceEtapa(estado));
  const cancelada = estado === "CANCELADA";
  const cerrada = !cancelada && (estado === "CERRADA_CON_DECISION" || estado === "CERRADA_SIN_DECISION");

  if (compacto) {
    return (
      <div className="w-full flex items-center gap-1" aria-label={`Etapa ${actual + 1} de ${ETAPAS.length}: ${cancelada ? "Cancelada" : ETAPAS[actual]?.label ?? ""}`}>
        {ETAPAS.map((e, i) => {
          const completada = i < actual && !cancelada;
          const esActual = (i === actual && !cerrada) || (cancelada && i === ETAPAS.length - 1);
          const etiqueta = cancelada && i === ETAPAS.length - 1 ? "Cancelada" : e.label;
          return (
            <div key={e.label} className="flex-1 flex flex-col items-center gap-1">
              <span
                className={
                  "h-1.5 w-full rounded-full " +
                  (cancelada && i === ETAPAS.length - 1
                    ? "bg-rose-400"
                    : completada
                      ? "bg-sky-500"
                      : esActual
                        ? "bg-sky-300"
                        : "bg-slate-200")
                }
                title={etiqueta}
              />
              <span className={"text-[8px] leading-none " + (cancelada && i === ETAPAS.length - 1 ? "text-rose-600 font-bold" : esActual ? "text-sky-700 font-bold" : completada ? "text-slate-600" : "text-slate-400")}>
                {etiqueta}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center">
        {ETAPAS.map((e, i) => {
          const completada = i < actual && !cancelada;
          const esActual = (i === actual && !cerrada) || (cancelada && i === ETAPAS.length - 1);
          const etiqueta = cancelada && i === ETAPAS.length - 1 ? "Cancelada" : e.label;
          return (
            <div key={e.label} className="flex-1 flex flex-col items-center relative">
              {/* línea conectora */}
              {i > 0 ? (
                <span className={"absolute top-3 right-1/2 w-full h-0.5 " + (completada || (cerrada && i <= ETAPAS.length - 1) ? "bg-sky-400" : cancelada && i === ETAPAS.length - 1 ? "bg-rose-300" : "bg-slate-200")} />
              ) : null}
              <span
                className={
                  "relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] " +
                  (cancelada && i === ETAPAS.length - 1
                    ? "bg-rose-50 border-rose-400 text-rose-600"
                    : completada
                      ? "bg-sky-500 border-sky-500 text-white"
                      : esActual
                        ? "bg-white border-sky-500 text-sky-600 ring-2 ring-sky-500/20"
                        : "bg-white border-slate-300 text-slate-400")
                }
              >
                {cancelada && i === ETAPAS.length - 1 ? "✕" : completada ? "✓" : e.icono}
              </span>
              <span className={"mt-1.5 text-[9px] text-center px-0.5 leading-tight " + (cancelada && i === ETAPAS.length - 1 ? "text-rose-600 font-bold" : esActual ? "text-sky-700 font-bold" : completada ? "text-slate-700" : "text-slate-400")}>
                {etiqueta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}