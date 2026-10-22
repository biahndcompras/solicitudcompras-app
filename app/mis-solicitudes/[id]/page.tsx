import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge, ButtonLink, Panel, type BadgeTone } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { SummaryStrip } from "@/components/ui/forms";
import { TrackerEtapas } from "@/components/TrackerEtapas";
import { CTADecision } from "@/components/solicitante/CTADecision";
import { ResponderPreguntas } from "@/components/solicitante/ResponderPreguntas";
import { DocumentosAdjuntos } from "@/components/shared/DocumentosAdjuntos";
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
  // El correo NO es opcional: sin él la comprobación se saltaba entera y
  // `/mis-solicitudes/<uuid>` mostraba la solicitud de otra persona (nombre, área,
  // descripción y estado) con solo conocer el id. Ahora sin correo no hay página.
  if (!email) notFound();
  const solicitud = await repo.obtenerSolicitud(id);
  if (!solicitud) notFound();
  if (email.trim().toLowerCase() !== solicitud.solicitanteEmail.trim().toLowerCase()) notFound();

  const cotizaciones = await repo.listarCotizaciones(id);
  const volverA = `/mis-solicitudes?email=${encodeURIComponent(email)}`;
  const retraso = diasDeRetraso(solicitud);

  return (
    <PublicShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {solicitud.numeroReferencia ? (
              <span className="mono-label rounded-xs px-2 py-1 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                {solicitud.numeroReferencia}
              </span>
            ) : (
              <span className="text-caption italic text-body">Sin referencia</span>
            )}
            <Badge tone={toneDe(solicitud.estado)}>{estadoLegible(solicitud.estado)}</Badge>
            {retraso !== null ? <Badge tone="critical">Retrasada · {retraso} d</Badge> : null}
          </div>
          <h1 className="mt-2 text-display-lg text-ink">{solicitud.titulo}</h1>
          <p className="mt-1 text-caption text-body">
            Creada: {formatoFechaLegible(solicitud.fechaCreacion)} · Atención:{" "}
            {duracionAtencion({ fechaCreacion: solicitud.fechaCreacion, fechaCierre: solicitud.fechaCierre }).texto}
          </p>
        </div>
        <ButtonLink href={volverA} variant="outline" icon="chevron-left">
          Volver
        </ButtonLink>
      </div>

      <SummaryStrip
        items={[
          {
            label: "Estado",
            value: <Badge tone={toneDe(solicitud.estado)}>{estadoLegible(solicitud.estado)}</Badge>,
            sub: solicitud.fechaCierre ? "Ciclo cerrado" : "Ciclo en curso",
          },
          {
            label: "Tiempo",
            value: duracionAtencion({
              fechaCreacion: solicitud.fechaCreacion,
              fechaCierre: solicitud.fechaCierre,
            }).texto,
            sub: "desde la creación",
          },
          {
            label: "Entrega",
            value: solicitud.fechaRequerida ? formatoFechaLegible(solicitud.fechaRequerida) : "—",
            sub: retraso !== null ? `Retrasada ${retraso} d` : "Dentro de plazo",
            tone: retraso !== null ? "bad" : undefined,
          },
          {
            label: "Categoría",
            value: nombreCategoria(solicitud.categoria),
            sub: solicitud.subtipo
              ? solicitud.subtipo === "producto"
                ? "Producto"
                : solicitud.subtipo === "servicio"
                  ? "Servicio"
                  : "Mixto"
              : "Por definir",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_388px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Va arriba de todo a propósito: es lo único que la persona tiene que hacer. */}
          {solicitud.informacionPendiente && solicitud.informacionPreguntas ? (
            <ResponderPreguntas
              solicitudId={solicitud.id}
              email={email}
              ronda={solicitud.informacionPreguntas.ronda}
              preguntas={solicitud.informacionPreguntas.preguntas}
            />
          ) : null}

          {solicitud.descripcion ? (
            <Panel title="Descripción" subtitle="Lo que pidió">
              <p className="whitespace-pre-line text-caption text-ink">{solicitud.descripcion}</p>
            </Panel>
          ) : null}

          {solicitud.informacionRespuesta ? (
            <Panel
              title="Lo que respondió a Compras"
              subtitle={`Ronda ${solicitud.informacionRespuesta.ronda}`}
            >
              <ul className="flex flex-col gap-2">
                {(solicitud.informacionPreguntas?.preguntas ?? []).map((p) => (
                  <li key={p.campoKey} className="border-b border-hairline pb-2 last:border-0 last:pb-0">
                    <p className="text-caption font-medium text-ink">{p.pregunta}</p>
                    <p className="mt-0.5 text-caption text-body">
                      {solicitud.informacionRespuesta?.respuestas[p.campoKey] || <em>no lo sé</em>}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Cotizaciones recibidas"
            subtitle="Sin importes: se ven en el enlace de decisión"
            action={<Badge tone="neutral">{cotizaciones.length}</Badge>}
          >
            {cotizaciones.length === 0 ? (
              <p className="text-caption text-body">Todavía no hay cotizaciones cargadas.</p>
            ) : (
              <p className="text-caption text-body">
                Cuando Compras tenga la comparativa lista, va a recibir un correo con el enlace para verlas y decidir.
              </p>
            )}
          </Panel>

          {/* El solicitante también puede adjuntar (4.4.12): aclaraciones, fichas, fotos. */}
          <DocumentosAdjuntos solicitudId={solicitud.id} email={email} puedeSubir />

          {/* P2-c: el detalle también es un lugar desde donde se decide, no solo el listado. */}
          <CTADecision solicitudId={solicitud.id} estado={solicitud.estado} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title="Datos de la solicitud">
            <dl className="flex flex-col gap-3">
              <Dato label="Solicitante" valor={solicitud.solicitanteNombre} />
              <Dato label="Área" valor={solicitud.areaSolicitante} />
              <Dato label="Tipo" valor={solicitud.tipo ?? "—"} />
              <Dato label="Subtipo" valor={solicitud.subtipo ? (solicitud.subtipo === "producto" ? "Producto" : solicitud.subtipo === "servicio" ? "Servicio" : "Mixto") : "—"} />
              <Dato label="Categoría" valor={nombreCategoria(solicitud.categoria)} />
              <Dato label="Fecha requerida" valor={formatoFechaLegible(solicitud.fechaRequerida)} />
              {solicitud.archivoLogoNombre ? (
                <div>
                  <dt className="eyebrow text-body">Logo / arte del producto</dt>
                  <dd className="mt-1">
                    <a
                      href={`/api/solicitudes/${solicitud.id}/logo?email=${encodeURIComponent(email)}`}
                      className="inline-flex items-center gap-1.5 text-caption font-medium text-ink underline underline-offset-4 hover:opacity-80"
                    >
                      <Icon name="download" size={14} />
                      {solicitud.archivoLogoNombre}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Progreso" subtitle="En qué etapa está su solicitud">
            <TrackerEtapas estado={solicitud.estado as EstadoSolicitud} />
          </Panel>

          <p>
            <Link
              href="/guias/manual-solicitante"
              className="inline-flex items-center gap-1.5 text-caption font-medium text-body underline underline-offset-4 hover:text-ink"
            >
              <Icon name="info" size={14} />
              Guía rápida de uso
            </Link>
          </p>
        </aside>
      </div>
    </PublicShell>
  );
}

function Dato({ label, valor }: { label: string; valor?: string }) {
  return (
    <div>
      <dt className="eyebrow text-body">{label}</dt>
      <dd className="mt-1 text-caption text-ink">{valor || "—"}</dd>
    </div>
  );
}

function diasDeRetraso(s: { fechaRequerida?: string; fechaCierre?: string }): number | null {
  if (s.fechaCierre || !s.fechaRequerida) return null;
  const req = new Date(`${s.fechaRequerida}T23:59:59`).getTime();
  if (!Number.isFinite(req) || req >= Date.now()) return null;
  return Math.max(1, Math.round((Date.now() - req) / 86_400_000));
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
  if (e === "EN_COTIZACION") return "periwinkle";
  if (e === "COMPARATIVA_LISTA" || e === "ENVIADA_A_SOLICITANTE") return "mint";
  if (e === "CERRADA_CON_DECISION") return "success";
  if (e === "CANCELADA") return "critical";
  if (e === "CERRADA_SIN_DECISION") return "neutral";
  return "dark";
}
