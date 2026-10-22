import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, ButtonLink, Panel, type BadgeTone } from "@/components/ui/primitives";
import { cn } from "@/lib/design/cn";
import { SummaryStrip } from "@/components/ui/forms";
import { Icon } from "@/components/ui/Icon";
import { CancelarSolicitudButton } from "@/components/CancelarSolicitudButton";
import { ReasignarCoordinador } from "@/components/ReasignarCoordinador";
import { DocumentosAdjuntos } from "@/components/shared/DocumentosAdjuntos";
import { FormularioYRespuestas } from "@/components/shared/FormularioYRespuestas";
import { armarFormularioOriginal, completarRondas, rondasDesdeEventos } from "@/lib/domain/formulario";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { nombreCategoria } from "@/lib/domain/categorias";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { formato } from "@/lib/domain/comparativa";

export const dynamic = "force-dynamic";

const repo = new PostgresRepositorio();
const TERMINALES = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"];

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

  // Formulario original + historial de rondas (4.13.20). La plantilla se lee congelada
  // (`plantilla_id` de la solicitud) para no mostrar preguntas que el solicitante no vio.
  const [rondasGuardadas, camposPlantilla] = await Promise.all([
    repo.listarRondasPreguntas(id),
    s.plantillaId ? repo.listarCamposDePlantillaPorId(s.plantillaId) : Promise.resolve([]),
  ]);
  const rondas = completarRondas(rondasDesdeEventos(id, eventos, rondasGuardadas), s);
  const formulario = armarFormularioOriginal(camposPlantilla, respuestas);

  // El admin ve TODO: lo que respondió el solicitante, las cotizaciones con precios, la
  // comparativa, la sugerencia del sistema y lo que el solicitante decidió.
  const proveedorElegido = decision?.cotizacionSeleccionadaId
    ? cotizaciones.find((c) => c.id === decision.cotizacionSeleccionadaId)?.proveedorNombre
    : undefined;

  const timeline = eventos.map((ev) => ({
    titulo: tituloEvento(ev),
    fecha: ev.timestamp,
    descripcion: descripcionEvento(ev, coordinador?.nombre ?? "Compras"),
  }));

  // 4.1.1: la referencia la asigna el sistema al enviarse a Compras. Si no existe, se
  // dice «Sin referencia» (igual que el panel del coordinador). Antes se fabricaba
  // `SOL-<id>`: una cadena que no existe en ningún documento y que no se puede buscar.
  const referencia = s.numeroReferencia ?? null;
  const tipoCategoria =
    [
      s.tipo ? TIPO_LEGIBLE[s.tipo] ?? s.tipo : null,
      s.categoria ? nombreCategoria(s.categoria) : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Por definir";
  const retraso = diasDeRetraso(s);
  const cerrada = TERMINALES.includes(s.estado);
  const etapaActual = etapaDe(s.estado);
  const dur = duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre });

  return (
    <>
      <PageHeader
        title={s.titulo}
        subtitle={`${tipoCategoria} · ${s.solicitanteNombre} · ${s.areaSolicitante ?? "Área por definir"}`}
        titleExtra={
          <span className="flex flex-wrap items-center gap-2">
            {referencia ? (
              <span className="mono-label rounded-xs px-2 py-1 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                {referencia}
              </span>
            ) : (
              <span className="text-caption italic text-body" title={`Sin referencia asignada · id interno ${s.id}`}>
                Sin referencia
              </span>
            )}
            <Badge tone={tonoEstado(s.estado)}>{estadoLegible(s.estado)}</Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {TERMINALES.includes(s.estado) ? null : (
              <CancelarSolicitudButton solicitudId={s.id} rol="admin" />
            )}
            <ButtonLink href="/admin" icon="chevron-left">
              Volver
            </ButtonLink>
          </div>
        }
      />

      <SummaryStrip
        items={[
          {
            label: "Estado",
            value: <Badge tone={tonoEstado(s.estado)}>{estadoLegible(s.estado)}</Badge>,
            sub: s.fechaCierre ? "Ciclo cerrado" : "Ciclo en curso",
          },
          { label: "Tiempo de atención", value: dur.texto, sub: "desde la creación" },
          {
            label: "Entrega requerida",
            value: s.fechaRequerida ? formatoFechaLegible(s.fechaRequerida) : "—",
            sub: retraso !== null ? `Retrasada ${retraso} d` : "Dentro de plazo",
          },
          { label: "Coordinador", value: coordinador?.nombre ?? "Sin asignar", sub: coordinador?.email ?? "—" },
        ]}
      />

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Etapas del ciclo">
        {PASOS.map((p, i) => {
            const activo = !cerrada && i === etapaActual;
            const completado = cerrada || i < etapaActual;
            return (
              <li key={p.n}>
                <div
                  aria-current={activo ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-3",
                    activo
                      ? "bg-primary text-on-dark"
                      : "text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
                  )}
                >
                  <span
                    className={cn(
                      "mono-label grid size-6 shrink-0 place-items-center rounded-xs",
                      activo ? "bg-mint text-ink" : "bg-surface-soft text-ink"
                    )}
                  >
                    {completado && !activo ? <Icon name="check" size={13} /> : `0${p.n}`}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-caption font-medium">{p.label}</span>
                    <span className="block text-caption opacity-70">
                      {completado ? "Completado" : activo ? "Actual" : "Pendiente"}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
      </ol>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_388px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Documentos adjuntos (4.4.12): el admin ve y gestiona lo mismo que Compras. */}
          <DocumentosAdjuntos solicitudId={s.id} />

          {cotizaciones.length > 0 ? (
            <Panel title="Cotizaciones" subtitle={`${cotizaciones.length} ofertas cargadas`}>
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="bg-surface-soft text-left">
                      {["Proveedor", "Neto", "ISV", "Total", "Entrega", "Pago"].map((h) => (
                        <th key={h} scope="col" className="eyebrow px-3 py-3 font-medium text-ink">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((c) => (
                      <tr key={c.id} className="border-b border-hairline">
                        <td className="px-3 py-3 text-body-md text-ink">{c.proveedorNombre}</td>
                        <td className="px-3 py-3 text-caption text-ink">
                          {c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorNeto)}` : "no especificado"}
                        </td>
                        <td className="px-3 py-3 text-caption text-ink">
                          {c.impuestosDesglosados === false
                            ? "⚠ no especifica"
                            : c.montoIsv !== undefined
                              ? formato(c.montoIsv)
                              : "no especificado"}
                        </td>
                        <td className="px-3 py-3 text-caption font-medium text-ink">
                          {c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorTotal)}` : "no especificado"}
                        </td>
                        <td className="px-3 py-3 text-caption text-ink">{c.plazoEntrega ?? "—"}</td>
                        <td className="px-3 py-3 text-caption text-ink">{c.formaPago ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {comparativa ? (
            <Panel title="Comparativa y recomendación" subtitle="Observaciones, recomendación y pros y contras">
              {comparativa.discrepanciasDetectadas.length > 0 ? (
                <div className="rounded-sm bg-surface-soft px-4 py-3">
                  <p className="eyebrow text-critical">Observaciones de especificación</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {comparativa.discrepanciasDetectadas.map((d, i) => (
                      <li key={i} className="text-caption text-ink">
                        {d.explicacion}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="eyebrow text-body">Recomendación del coordinador</p>
                <p className="mt-1 text-caption text-ink">{comparativa.recomendacionComprador ?? "Sin recomendación escrita."}</p>
              </div>
              {comparativa.sugerenciaIA ? (
                <div className="rounded-sm bg-surface-soft px-4 py-3">
                  <p className="eyebrow text-body">Sugerencia del sistema</p>
                  <p className="mt-1 text-caption text-ink">{comparativa.sugerenciaIA}</p>
                </div>
              ) : null}
              {Object.keys(comparativa.prosContras).length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {cotizaciones
                    .filter((c) => comparativa.prosContras[c.id])
                    .map((c) => (
                      <div key={c.id} className="rounded-sm px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                        <p className="text-caption font-medium text-ink">{c.proveedorNombre}</p>
                        <ul className="mt-1 flex flex-col gap-0.5 text-caption text-success">
                          {comparativa.prosContras[c.id].pros.map((p, i) => (
                            <li key={i}>✓ {p}</li>
                          ))}
                        </ul>
                        <ul className="mt-1 flex flex-col gap-0.5 text-caption text-critical">
                          {comparativa.prosContras[c.id].contras.map((p, i) => (
                            <li key={i}>✗ {p}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              ) : null}
            </Panel>
          ) : null}

          {decision ? (
            <Panel title="Decisión del solicitante" subtitle="Registrada desde el enlace público">
              {decision.ningunaOpcion ? (
                <p className="text-caption text-ink">
                  <strong>Ninguna opción le sirvió.</strong> La solicitud vuelve a Compras.
                </p>
              ) : (
                <p className="text-caption text-ink">
                  Eligió: <strong>{proveedorElegido ?? "proveedor no identificado"}</strong>
                </p>
              )}
              <p className="text-caption text-body">
                {new Date(decision.fechaDecision).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {decision.decididoPorEmail}
              </p>
              {decision.comentario ? <p className="text-caption text-ink">«{decision.comentario}»</p> : null}
            </Panel>
          ) : null}

          <Panel title="Línea de tiempo" subtitle="Trazabilidad de la solicitud">
            {timeline.length ? (
              <ol className="relative flex flex-col gap-5 border-l border-hairline pl-4">
                {timeline.map((t, i) => (
                  <li key={`${t.titulo}-${i}`} className="relative">
                    <span
                      className={
                        "absolute -left-[21px] top-1 size-2 " +
                        (i === 0 ? "bg-primary" : "bg-canvas shadow-[inset_0_0_0_1px_var(--color-text-body)]")
                      }
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-caption font-medium text-ink">{t.titulo}</span>
                      <span className="mono-caption text-body">
                        {new Date(t.fecha).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption text-body">{t.descripcion}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-caption text-body">Sin eventos registrados.</p>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title="Contexto">
            <dl className="flex flex-col gap-4">
              <div>
                <dt className="eyebrow text-body">Solicitante</dt>
                <dd className="mt-1 text-caption text-ink">
                  {s.solicitanteNombre} ({s.areaSolicitante ?? "Área por definir"})
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Coordinador</dt>
                <dd className="mt-1 text-caption text-ink">{coordinador?.nombre ?? "Sin asignar"}</dd>
                {TERMINALES.includes(s.estado) ? null : (
                  <div className="mt-2 border-t border-hairline pt-2">
                    <ReasignarCoordinador
                      solicitudId={s.id}
                      actualId={s.coordinadorId}
                      coordinadores={todosCoordinadores.map((c) => ({ id: c.id, nombre: c.nombre }))}
                    />
                  </div>
                )}
              </div>
              <div>
                <dt className="eyebrow text-body">Tipo y categoría</dt>
                <dd className="mt-1 text-caption text-ink">{tipoCategoria}</dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Ciclo actual</dt>
                <dd className="mt-1 text-caption text-ink">{s.fechaCierre ? "Cerrado" : "En curso"}</dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Tiempo de atención</dt>
                <dd className="mt-1 text-caption text-ink">
                  {duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Semáforo</dt>
                <dd className="mt-1">
                  {retraso !== null ? (
                    <Badge tone="critical">Retrasada · {retraso} d</Badge>
                  ) : (
                    <span className="text-caption text-body">En plazo</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <FormularioYRespuestas
            preguntas={formulario}
            rondas={rondas}
            rondaAbierta={s.informacionPendiente ? (s.informacionPreguntas?.ronda ?? null) : null}
          />
        </aside>
      </div>
    </>
  );
}

const PASOS = [
  { n: 7, label: "Cotizaciones" },
  { n: 8, label: "Comparativa" },
  { n: 9, label: "Recomendación" },
];

function etapaDe(estado: string): number {
  if (["ENVIADA_A_SOLICITANTE", "CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(estado)) return 2;
  if (estado === "COMPARATIVA_LISTA") return 1;
  return 0;
}

const TIPO_LEGIBLE: Record<string, string> = {
  RFI: "RFI · Información",
  RFQ: "RFQ · Cotización",
  RFP: "RFP · Propuesta",
};

function diasDeRetraso(s: { fechaRequerida?: string; fechaCierre?: string }): number | null {
  if (s.fechaCierre || !s.fechaRequerida) return null;
  const req = new Date(`${s.fechaRequerida}T23:59:59`).getTime();
  if (!Number.isFinite(req) || req >= Date.now()) return null;
  return Math.max(1, Math.round((Date.now() - req) / 86_400_000));
}

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
  const actor =
    ev.actorTipo === "solicitante"
      ? "El solicitante"
      : ev.actorTipo === "coordinador"
        ? nombreCoordinador
        : ev.actorTipo === "admin"
          ? "Administración"
          : "El sistema";
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

function tonoEstado(e: string): BadgeTone {
  if (e === "EN_COTIZACION") return "periwinkle";
  if (e === "COMPARATIVA_LISTA" || e === "ENVIADA_A_SOLICITANTE") return "mint";
  if (e === "CERRADA_CON_DECISION") return "success";
  if (e === "CANCELADA") return "critical";
  if (e === "CERRADA_SIN_DECISION") return "neutral";
  return "dark";
}
