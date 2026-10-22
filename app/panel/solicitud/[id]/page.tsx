import { notFound } from "next/navigation";
import { DetalleSolicitud } from "@/components/coordinador/DetalleSolicitud";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/primitives";
import { nombreCategoria } from "@/lib/domain/categorias";
import { armarFormularioOriginal, completarRondas, rondasDesdeEventos } from "@/lib/domain/formulario";

const repo = new PostgresRepositorio();

export default async function SolicitudDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const solicitud = await repo.obtenerSolicitud(id);
  if (!solicitud) notFound();
  // Catálogo vigente para atar una pregunta a un campo (spec 010). Solo los de assessment:
  // los de plantilla ya se responden en el wizard y no tiene sentido preguntarlos de nuevo.
  // Campos que el solicitante respondió: durante el wizard y al contestar preguntas de
  // Compras. Antes solo existían dentro del PDF.
  const respuestas = await repo.listarRespuestas(id);
  // Las rondas previas a la migración 024 no tienen texto: se reconstruyen del resumen del
  // evento para al menos mostrarlas como incompletas (no inventar ni esconder).
  const eventos = await repo.listarEventos(id);
  const rondas = completarRondas(rondasDesdeEventos(id, eventos, await repo.listarRondasPreguntas(id)), solicitud);
  // El cuestionario original se lee de la plantilla CONGELADA de la solicitud (RF-55), no de
  // la vigente: si el admin la edita, el detalle no debe mostrar preguntas que no se hicieron.
  const camposPlantilla = solicitud.plantillaId
    ? await repo.listarCamposDePlantillaPorId(solicitud.plantillaId)
    : [];
  const formulario = armarFormularioOriginal(camposPlantilla, respuestas);
  const campos = (await repo.listarCampoCatalogo(true))
    .filter((c) => c.activo && c.origen === "assessment")
    .map((c) => ({ campoKey: c.campoKey, label: c.label }));
  const decision = await repo.obtenerDecisionPorSolicitud(id);
  // Nombre del proveedor elegido (para mostrar la decisión en lenguaje usuario).
  const proveedorElegido =
    decision && !decision.ningunaOpcion && decision.cotizacionSeleccionadaId
      ? (await repo.listarCotizaciones(id)).find((c) => c.id === decision.cotizacionSeleccionadaId)?.proveedorNombre
      : undefined;

  const referencia = solicitud.numeroReferencia ?? null;
  const tipoCategoria =
    [
      solicitud.tipo ? TIPO_LEGIBLE[solicitud.tipo] ?? solicitud.tipo : null,
      solicitud.categoria ? nombreCategoria(solicitud.categoria) : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Por definir";

  return (
    <>
      <PageHeader
        title={solicitud.titulo}
        subtitle={`${tipoCategoria} · ${solicitud.solicitanteNombre} · ${solicitud.areaSolicitante ?? "Área por definir"}`}
        titleExtra={
          <span className="flex flex-wrap items-center gap-2">
            {referencia ? (
              <span className="mono-label rounded-xs px-2 py-1 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                {referencia}
              </span>
            ) : (
              <span className="text-caption italic text-body" title={`Sin referencia asignada · id interno ${solicitud.id}`}>
                Sin referencia
              </span>
            )}
            <Badge tone={toneDe(solicitud.estado)}>{estadoLegible(solicitud.estado)}</Badge>
          </span>
        }
      />

      <DetalleSolicitud
        solicitud={solicitud}
        decision={decision ?? undefined}
        proveedorElegido={proveedorElegido}
        campos={campos}
        formulario={formulario}
        rondas={rondas}
      />
    </>
  );
}

const TIPO_LEGIBLE: Record<string, string> = {
  RFI: "RFI · Información",
  RFQ: "RFQ · Cotización",
  RFP: "RFP · Propuesta",
};

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    ENVIADA_A_COMPRAS: "Activa",
    EN_COTIZACION: "Cotizando",
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
