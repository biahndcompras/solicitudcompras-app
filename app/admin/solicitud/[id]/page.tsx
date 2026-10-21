import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { CancelarSolicitudButton } from "@/components/CancelarSolicitudButton";
import { ReasignarCoordinador } from "@/components/ReasignarCoordinador";
import { DocumentosAdjuntos } from "@/components/shared/DocumentosAdjuntos";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { nombreCategoria } from "@/lib/domain/categorias";
import { duracionAtencion } from "@/lib/domain/semaforo";
import { formato } from "@/lib/domain/comparativa";

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

  const [coordinador, eventos, todosCoordinadores, respuestas, cotizaciones, comparativa, decision] =
    await Promise.all([
      s.coordinadorId ? repo.listarCoordinadores().then((l) => l.find((u) => u.id === s.coordinadorId)) : Promise.resolve(undefined),
      repo.listarEventos(id),
      repo.listarCoordinadores(),
      repo.listarRespuestas(id),
      repo.listarCotizaciones(id),
      repo.obtenerComparativaPorSolicitudId(id),
      repo.obtenerDecisionPorSolicitud(id),
    ]);

  // El admin ve TODO: lo que respondió el solicitante, las cotizaciones con precios, la
  // comparativa, la sugerencia del sistema y lo que el solicitante decidió.
  const proveedorElegido = decision?.cotizacionSeleccionadaId
    ? cotizaciones.find((c) => c.id === decision.cotizacionSeleccionadaId)?.proveedorNombre
    : undefined;

  const timeline = (eventos.length ? eventos : []).map((ev) => ({
    titulo: tituloEvento(ev),
    fecha: ev.timestamp,
    descripcion: descripcionEvento(ev, coordinador?.nombre ?? "Compras"),
  }));

  // 4.1.1: la referencia la asigna el sistema al enviarse a Compras. Si no existe, se
  // dice «Sin referencia» (igual que el panel del coordinador). Antes se fabricaba
  // `SOL-<id>`: una cadena que no existe en ningún documento y que no se puede buscar.
  const referencia = s.numeroReferencia ?? null;
  const tipoCategoria = [
    s.tipo ? TIPO_LEGIBLE[s.tipo] ?? s.tipo : null,
    s.categoria ? nombreCategoria(s.categoria) : null,
  ].filter(Boolean).join(" · ") || "Por definir";

  return (
    <AdminShell title={s.titulo} subtitle="Línea de tiempo (Trazabilidad) y contexto de la solicitud.">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {referencia ? (
              <span className="font-mono text-xs font-semibold text-slate-700 bg-white/70 border border-white px-2.5 py-1 rounded-xl">{referencia}</span>
            ) : (
              <span className="text-xs italic text-slate-500" title={`Sin referencia asignada · id interno ${s.id}`}>
                Sin referencia
              </span>
            )}
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
          {/* Documentos adjuntos (4.4.12): el admin ve y gestiona lo mismo que Compras. */}
          <DocumentosAdjuntos solicitudId={s.id} />

          {respuestas.length > 0 ? (
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Respuestas del solicitante ({respuestas.length})
              </h3>
              <dl className="divide-y divide-slate-100">
                {respuestas.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-start justify-between gap-6">
                    <dt className="text-[12px] text-slate-500">{r.campoLabel}</dt>
                    <dd className="text-[12px] font-medium text-slate-900 text-right max-w-[60%]">
                      {r.valor ?? (r.valorNumerico !== undefined ? String(r.valorNumerico) : "no especificado")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {cotizaciones.length > 0 ? (
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 overflow-x-auto">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Cotizaciones ({cotizaciones.length})
              </h3>
              <table className="min-w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Proveedor</th>
                    <th className="py-2 pr-4 font-semibold">Neto</th>
                    <th className="py-2 pr-4 font-semibold">ISV</th>
                    <th className="py-2 pr-4 font-semibold">Total</th>
                    <th className="py-2 pr-4 font-semibold">Entrega</th>
                    <th className="py-2 font-semibold">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotizaciones.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{c.proveedorNombre}</td>
                      <td className="py-2.5 pr-4 text-slate-700">{c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorNeto)}` : "no especificado"}</td>
                      <td className="py-2.5 pr-4 text-slate-700">{c.impuestosDesglosados === false ? "⚠ no especifica" : c.montoIsv !== undefined ? formato(c.montoIsv) : "no especificado"}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorTotal)}` : "no especificado"}</td>
                      <td className="py-2.5 pr-4 text-slate-700">{c.plazoEntrega ?? "—"}</td>
                      <td className="py-2.5 text-slate-700">{c.formaPago ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {comparativa ? (
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Comparativa y recomendación</h3>
              {comparativa.discrepanciasDetectadas.length > 0 ? (
                <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <div className="text-[11px] font-semibold text-amber-900">Observaciones de especificación</div>
                  <ul className="mt-1 space-y-1">
                    {comparativa.discrepanciasDetectadas.map((d, i) => (
                      <li key={i} className="text-[12px] text-amber-800">{d.explicacion}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Recomendación del coordinador
                </div>
                <p className="text-[12px] text-slate-800">{comparativa.recomendacionComprador ?? "Sin recomendación escrita."}</p>
              </div>
              {comparativa.sugerenciaIA ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Sugerencia del sistema
                  </div>
                  <p className="text-[12px] text-slate-700">{comparativa.sugerenciaIA}</p>
                </div>
              ) : null}
              {Object.keys(comparativa.prosContras).length > 0 ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cotizaciones
                    .filter((c) => comparativa.prosContras[c.id])
                    .map((c) => (
                      <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-[11px] font-semibold text-slate-900 mb-1">{c.proveedorNombre}</div>
                        <ul className="text-[11px] text-emerald-700 space-y-0.5">
                          {comparativa.prosContras[c.id].pros.map((p, i) => <li key={i}>✓ {p}</li>)}
                        </ul>
                        <ul className="text-[11px] text-rose-700 space-y-0.5 mt-1">
                          {comparativa.prosContras[c.id].contras.map((p, i) => <li key={i}>✗ {p}</li>)}
                        </ul>
                      </div>
                    ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {decision ? (
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Decisión del solicitante</h3>
              {decision.ningunaOpcion ? (
                <p className="text-[12px] text-slate-800">
                  <strong>Ninguna opción le sirvió.</strong> La solicitud vuelve a Compras.
                </p>
              ) : (
                <p className="text-[12px] text-slate-800">
                  Eligió: <strong>{proveedorElegido ?? "proveedor no identificado"}</strong>
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                {new Date(decision.fechaDecision).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })} · {decision.decididoPorEmail}
              </p>
              {decision.comentario ? (
                <p className="text-[12px] text-slate-700 mt-2">«{decision.comentario}»</p>
              ) : null}
            </section>
          ) : null}

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
  if (ev.tipoEvento === "edicion") return "Edición (re-cotización)";
  if (ev.tipoEvento === "cambio_estado") return estadoLegible(ev.estadoNuevo ?? "") || "Cambio de estado";
  return ev.tipoEvento;
}

function descripcionEvento(
  ev: { tipoEvento: string; actorTipo?: string; nota?: string; estadoAnterior?: string; estadoNuevo?: string },
  nombreCoordinador: string
): string {
  const actor = ev.actorTipo === "solicitante" ? "El solicitante" : ev.actorTipo === "coordinador" ? nombreCoordinador : ev.actorTipo === "admin" ? "Administración" : "El sistema";
  if (ev.nota) return `${actor}: ${ev.nota}`;
  switch (ev.tipoEvento) {
    case "creacion":
      return "Solicitud iniciada.";
    case "cambio_estado":
      return estadoLegible(ev.estadoAnterior ?? "") && estadoLegible(ev.estadoNuevo ?? "")
        ? `De «${estadoLegible(ev.estadoAnterior!)}» a «${estadoLegible(ev.estadoNuevo!)}».`
        : "Actualización de estado.";
    case "decision":
      return "El solicitante registró su decisión.";
    case "edicion":
      return "Se editaron datos de la solicitud para re-cotizar.";
    case "carga_cotizacion":
      return "Se cargó una cotización de proveedor.";
    case "generacion_comparativa":
      return "Se generó la comparativa con IA.";
    case "reasignacion":
      return "La solicitud se reasignó a otro comprador.";
    case "cancelacion":
      return "La solicitud fue cancelada.";
    case "envio_correo":
      return "Se envió un correo relacionado con la solicitud.";
    case "acceso_link":
      return "El solicitante accedió al enlace público de la comparativa.";
    default:
      return "Evento sin descripción.";
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
  return m[e] ?? humanizarEstado(e);
}

// Un estado que no está en el mapa (p. ej. uno nuevo) no debe salir como código crudo
// («FOO_BAR»). Se muestra legible: «Foo bar».
function humanizarEstado(e: string): string {
  const t = e.trim();
  if (!t) return "";
  const palabras = t.replace(/_/g, " ").toLowerCase();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

function toneDe(e: string): BadgeTone {
  if (e === "EN_COTIZACION" || e === "COMPARATIVA_LISTA") return "cotizaciones";
  if (e === "ENVIADA_A_SOLICITANTE") return "decision";
  if (e === "CERRADA_CON_DECISION") return "cerrada";
  if (e === "CERRADA_SIN_DECISION" || e === "CANCELADA") return "error";
  return "activa";
}
