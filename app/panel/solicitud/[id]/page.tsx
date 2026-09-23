import { notFound } from "next/navigation";
import { DetalleSolicitud } from "@/components/coordinador/DetalleSolicitud";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { Badge, type BadgeTone } from "@/components/Badge";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { formatoFechaLegible } from "@/lib/domain/semaforo";
import type { Decision } from "@/lib/domain/types";

const repo = new PostgresRepositorio();

export default async function SolicitudDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const solicitud = await repo.obtenerSolicitud(id);
  if (!solicitud) notFound();
  const decision = await repo.obtenerDecisionPorSolicitud(id);
  // Nombre del proveedor elegido (para mostrar la decisión en lenguaje usuario).
  const proveedorElegido =
    decision && !decision.ningunaOpcion && decision.cotizacionSeleccionadaId
      ? (await repo.listarCotizaciones(id)).find((c) => c.id === decision.cotizacionSeleccionadaId)?.proveedorNombre
      : undefined;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 md:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[1280px] bg-white/70 backdrop-blur-3xl rounded-3xl md:rounded-[2.5rem] border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden relative z-10">
        <div className="px-6 md:px-10 pt-7 pb-4">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-700 bg-white/70 border border-white px-2.5 py-1 rounded-xl">
                    {solicitud.numeroReferencia ?? "—"}
                  </span>
                  <Badge tone={toneDe(solicitud.estado)} label={estadoLegible(solicitud.estado)} />
                </div>
                <h2 className="text-2xl md:text-[2rem] font-semibold tracking-tight text-slate-900 mt-2">{solicitud.titulo}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">{solicitud.solicitanteNombre}</span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">{solicitud.areaSolicitante ?? "Área por definir"}</span>
                  {solicitud.fechaRequerida ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1.5">Entrega requerida: {formatoFechaLegible(solicitud.fechaRequerida)}</span>
                    </>
                  ) : null}
                  {solicitud.fechaCierre ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1.5">Cerrada: {new Date(solicitud.fechaCierre).toLocaleDateString("es-HN")}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 md:px-10 pb-10">
          <DetalleSolicitud solicitud={solicitud} decision={decision ?? undefined} proveedorElegido={proveedorElegido} />
        </div>
      </div>
    </main>
  );
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    ENVIADA_A_COMPRAS: "Activa",
    EN_COTIZACION: "Esperando cotizaciones",
    COMPARATIVA_LISTA: "Comparativa lista",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

function toneDe(e: string): BadgeTone {
  if (e === "EN_COTIZACION" || e === "COMPARATIVA_LISTA") return "cotizaciones";
  if (e === "ENVIADA_A_SOLICITANTE") return "decision";
  if (e === "CERRADA_CON_DECISION" || e === "CERRADA_SIN_DECISION") return "cerrada";
  if (e === "CANCELADA") return "error";
  return "activa";
}