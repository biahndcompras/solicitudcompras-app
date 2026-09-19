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

export function TrackerEtapas({ estado }: { estado: EstadoSolicitud }) {
  const actual = Math.max(0, indiceEtapa(estado));
  const cerrada = estado === "CERRADA_CON_DECISION" || estado === "CERRADA_SIN_DECISION" || estado === "CANCELADA";

  return (
    <div className="w-full">
      <div className="flex items-center">
        {ETAPAS.map((e, i) => {
          const completada = i < actual || (cerrada && i === ETAPAS.length - 1);
          const esActual = i === actual && !cerrada;
          return (
            <div key={e.label} className="flex-1 flex flex-col items-center relative">
              {/* línea conectora */}
              {i > 0 ? (
                <span className={"absolute top-3 right-1/2 w-full h-0.5 " + (i <= actual || (cerrada && i <= ETAPAS.length - 1) ? "bg-sky-400" : "bg-slate-200")} />
              ) : null}
              <span
                className={
                  "relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] " +
                  (completada
                    ? "bg-sky-500 border-sky-500 text-white"
                    : esActual
                      ? "bg-white border-sky-500 text-sky-600 ring-2 ring-sky-500/20"
                      : "bg-white border-slate-300 text-slate-400")
                }
              >
                {completada ? "✓" : e.icono}
              </span>
              <span className={"mt-1.5 text-[9px] text-center px-0.5 leading-tight " + (esActual ? "text-sky-700 font-bold" : completada ? "text-slate-700" : "text-slate-400")}>
                {e.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}