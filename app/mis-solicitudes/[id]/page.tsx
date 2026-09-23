import Link from "next/link";
import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { TrackerEtapas } from "@/components/TrackerEtapas";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { nombreCategoria } from "@/lib/domain/categorias";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import type { EstadoSolicitud } from "@/lib/domain/types";

const repo = new PostgresRepositorio();

export default async function DetalleSolicitudSolicitantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id } = await params;
  const { email } = await searchParams;
  const solicitud = await repo.obtenerSolicitud(id);
  if (!solicitud) notFound();
  // Si viene con email del listado, debe corresponder al solicitante de la solicitud.
  if (email && email.toLowerCase() !== solicitud.solicitanteEmail.toLowerCase()) notFound();

  const cotizaciones = await repo.listarCotizaciones(id);
  const volverA = `/mis-solicitudes?email=${encodeURIComponent(email ?? solicitud.solicitanteEmail)}`;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 md:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[900px] bg-white/70 backdrop-blur-3xl rounded-3xl md:rounded-[2.5rem] border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden relative z-10 p-8">
        <Link
          href={volverA}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/70 hover:bg-white transition-all mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
          Volver
        </Link>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">{solicitud.numeroReferencia ?? "—"}</span>
          <SemParoBadge solicitud={solicitud} />
          <Badge tone={toneDe(solicitud.estado)} label={estadoLegible(solicitud.estado)} />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">{solicitud.titulo}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Creada: {formatoFechaLegible(solicitud.fechaCreacion)} · Atención: {duracionAtencion({ fechaCreacion: solicitud.fechaCreacion, fechaCierre: solicitud.fechaCierre }).texto}
        </p>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-[12px] bg-white rounded-2xl border border-slate-200 p-5">
          <DetalleCampo label="Solicitante" valor={solicitud.solicitanteNombre} />
          <DetalleCampo label="Área" valor={solicitud.areaSolicitante} />
          <DetalleCampo label="Tipo" valor={solicitud.tipo ?? "—"} />
          <DetalleCampo label="Subtipo" valor={solicitud.subtipo ?? "—"} />
          <DetalleCampo label="Categoría" valor={nombreCategoria(solicitud.categoria)} />
          <DetalleCampo label="Fecha requerida" valor={formatoFechaLegible(solicitud.fechaRequerida)} />
        </div>

        {solicitud.descripcion ? (
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Descripción</span>
            <p className="text-xs text-slate-600 leading-relaxed">{solicitud.descripcion}</p>
          </div>
        ) : null}

        {solicitud.archivoLogoNombre ? (
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700">Logo / arte del producto</span>
            <a
              href={`/api/solicitudes/${solicitud.id}/logo`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-sky-700 hover:bg-sky-50 border border-sky-200"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Descargar {solicitud.archivoLogoNombre}
            </a>
          </div>
        ) : null}

        <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-3 font-semibold">Progreso</span>
          <TrackerEtapas estado={solicitud.estado as EstadoSolicitud} />
        </div>

        <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-3 font-semibold">
            Cotizaciones ({cotizaciones.length})
          </span>
          {cotizaciones.length === 0 ? (
            <p className="text-xs text-slate-500">Aún no hay cotizaciones cargadas.</p>
          ) : (
            <div className="space-y-2">
              {cotizaciones.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-xs font-medium text-slate-900">{c.proveedorNombre}</span>
                  <span className="text-xs font-mono text-slate-600">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${c.valorTotal}` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DetalleCampo({ label, valor }: { label: string; valor?: string }) {
  return (
    <div>
      <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 font-semibold">{label}</span>
      <span className="text-xs font-medium text-slate-900">{valor || "—"}</span>
    </div>
  );
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    BORRADOR: "Borrador",
    ENVIADA_A_COMPRAS: "Enviada a Compras",
    EN_COTIZACION: "En cotización",
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
  if (e === "CERRADA_CON_DECISION") return "cerrada";
  if (e === "CERRADA_SIN_DECISION" || e === "CANCELADA") return "error";
  return "activa";
}
