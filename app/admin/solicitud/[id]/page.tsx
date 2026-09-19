import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { CancelarSolicitudButton } from "@/components/CancelarSolicitudButton";
import { ReasignarCoordinador } from "@/components/ReasignarCoordinador";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { nombreCategoria } from "@/lib/domain/categorias";
import { duracionAtencion } from "@/lib/domain/semaforo";

export const dynamic = "force-dynamic";

const repo = new PostgresRepositorio();

export default async function AdminSolicitudDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await repo.obtenerSolicitud(id);
  if (!s) notFound();

  const [coordinador, eventos, todosCoordinadores] = await Promise.all([
    s.coordinadorId ? repo.listarCoordinadores().then((l) => l.find((u) => u.id === s.coordinadorId)) : Promise.resolve(undefined),
    repo.listarEventos(id),
    repo.listarCoordinadores(),
  ]);

  const timeline = (eventos.length ? eventos : []).map((ev) => ({
    titulo: tituloEvento(ev),
    fecha: ev.timestamp,
    descripcion: descripcionEvento(ev, coordinador?.nombre ?? "Compras"),
  }));

  const referencia = s.numeroReferencia ?? `SOL-${s.id.slice(0, 8).toUpperCase()}`;
  const tipoCategoria = [
    s.tipo ? TIPO_LEGIBLE[s.tipo] ?? s.tipo : null,
    s.categoria ? nombreCategoria(s.categoria) : null,
  ].filter(Boolean).join(" · ") || "Por definir";

  return (
    <AdminShell title={s.titulo} subtitle="Línea de tiempo (Trazabilidad) y contexto de la solicitud.">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-700 bg-white/70 border border-white px-2.5 py-1 rounded-xl">{referencia}</span>
            <Badge tone={toneDe(s.estado)} label={estadoLegible(s.estado)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(s.estado) ? null : (
            <CancelarSolicitudButton solicitudId={s.id} rol="admin" variante="borde" />
          )}
          <Link href="/admin" className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 bg-white/70 px-4 py-2 rounded-xl border border-white shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
            Volver
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-6">Línea de tiempo (Trazabilidad)</h3>
            {timeline.length ? (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-sky-200 before:via-slate-200 before:to-transparent">
                {timeline.map((t, i) => (
                  <div key={`${t.titulo}-${i}`} className="relative flex items-start gap-4">
                    <div className={"flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-sm shrink-0 z-10 bg-sky-100 text-sky-600"}>
                      {i === 0 ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                      ) : i === timeline.length - 1 ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      )}
                    </div>
                    <div className="flex-1 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">{t.titulo}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(t.fecha).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <div className="text-[11px] text-slate-600">{t.descripcion}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">Sin eventos registrados.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden p-5">
            <h3 className="text-xs font-semibold text-slate-700 mb-4">Contexto</h3>
            <div className="space-y-4 text-[11px]">
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Solicitante</span>
                <span className="font-medium text-slate-900">{s.solicitanteNombre} ({s.areaSolicitante ?? "Área por definir"})</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Coordinador</span>
                <span className="font-medium text-slate-900">{coordinador?.nombre ?? "Sin asignar"}</span>
                {["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(s.estado) ? null : (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <ReasignarCoordinador
                      solicitudId={s.id}
                      actualId={s.coordinadorId}
                      coordinadores={todosCoordinadores.map((c) => ({ id: c.id, nombre: c.nombre }))}
                    />
                  </div>
                )}
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Tipo y Categoría</span>
                <span className="font-medium text-slate-900">{tipoCategoria}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Ciclo Actual</span>
                <span className="font-medium text-slate-900">{s.fechaCierre ? "Cerrado" : "En curso"}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Tiempo de atención</span>
                <span className="font-medium text-slate-900">{duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[10px] mb-1">Semáforo</span>
                <SemParoBadge solicitud={s} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}

const TIPO_LEGIBLE: Record<string, string> = {
  RFI: "RFI · Información",
  RFQ: "RFQ · Cotización",
  RFP: "RFP · Propuesta",
};

function tituloEvento(ev: { tipoEvento: string; estadoNuevo?: string }): string {
  if (ev.tipoEvento === "creacion") return "Creación";
  if (ev.tipoEvento === "decision") return "Decisión del solicitante";
  if (ev.tipoEvento === "cancelacion") return "Cancelación";
  if (ev.tipoEvento === "reasignacion") return "Reasignación";
  if (ev.tipoEvento === "carga_cotizacion") return "Cotización cargada";
  if (ev.tipoEvento === "generacion_comparativa") return "Comparativa generada";
  if (ev.tipoEvento === "envio_correo") return "Correo enviado";
  if (ev.tipoEvento === "acceso_link") return "Acceso al enlace";
  if (ev.tipoEvento === "cambio_estado") return estadoLegible(ev.estadoNuevo ?? "") || "Cambio de estado";
  return ev.tipoEvento;
}

function descripcionEvento(
  ev: { tipoEvento: string; actorTipo?: string; nota?: string; estadoAnterior?: string },
  nombreCoordinador: string
): string {
  const actor = ev.actorTipo === "solicitante" ? "El solicitante" : ev.actorTipo === "coordinador" ? nombreCoordinador : ev.actorTipo === "admin" ? "Administración" : "El sistema";
  if (ev.nota) return `${actor}: ${ev.nota}`;
  switch (ev.tipoEvento) {
    case "creacion":
      return "Solicitud iniciada.";
    case "cambio_estado":
      return estadoLegible(ev.estadoAnterior ?? "")
        ? `De «${estadoLegible(ev.estadoAnterior!)}» al estado actual.`
        : "Actualización de estado.";
    case "decision":
      return "El solicitante registró su decisión.";
    case "carga_cotizacion":
      return "Se cargó una cotización de proveedor.";
    case "generacion_comparativa":
      return "Se generó la comparativa con IA.";
    default:
      return "";
  }
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
  if (e === "CERRADA_CON_DECISION") return "cerrada";
  if (e === "CERRADA_SIN_DECISION" || e === "CANCELADA") return "error";
  return "activa";
}
