// Cliente de API tipado para el frontend — Portal de Compras BIA.
// Reemplaza el uso de fixtures en runtime; delgado, sobre fetch.
import type {
  CampoCatalogo,
  Comparativa,
  Cotizacion,
  Decision,
  EstadoSolicitud,
  Solicitud,
} from "@/lib/domain/types";
import type { MetricasDashboard as Metricas } from "@/lib/domain/metrics";
import type { FiltrosMetricas } from "@/lib/db/repositorio";
import type { ClasificarOutput } from "@/lib/ai/schemas";
import type { ResultadoAssessment } from "@/lib/domain/assessment";

export type SalidaCorta = Pick<
  Solicitud,
  "id" | "numeroReferencia" | "titulo" | "estado" | "fechaCreacion" | "fechaCierre" | "fechaRequerida" | "areaSolicitante" | "categoria"
>;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  crearSolicitud(payload: {
    titulo: string;
    solicitanteEmail: string;
    solicitanteNombre: string;
    areaSolicitante?: string;
    descripcion?: string;
    categoria?: string;
    tipo?: "RFI" | "RFQ" | "RFP";
    subtipo?: "producto" | "servicio" | "mixto";
    fechaRequerida?: string;
  }): Promise<Solicitud> {
    return fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<Solicitud>(r));
  },

  transicionar(payload: {
    solicitudId: string;
    hacia: EstadoSolicitud;
    actorTipo: string;
    actorIdentificador?: string;
    nota?: string;
    respuestas?: Record<string, string>;
    coordinadorId?: string;
    coordenadorNombre?: string;
  }): Promise<{ solicitud: Solicitud; eventoId: string; pipeline?: unknown; enlace?: { token: string; url: string } }> {
    return fetch(`/api/solicitudes/${payload.solicitudId}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json(r));
  },

  listarSolicitudes(coordinadorId: string): Promise<Solicitud[]> {
    return fetch(`/api/solicitudes?coordinadorId=${encodeURIComponent(coordinadorId)}`).then(
      (r) => json<Solicitud[]>(r)
    );
  },

  listarSolicitudesTodas(): Promise<Solicitud[]> {
    return fetch("/api/solicitudes?coordinadorId=all").then((r) => json<Solicitud[]>(r));
  },

  obtenerSolicitud(id: string): Promise<Solicitud> {
    return fetch(`/api/solicitudes/${encodeURIComponent(id)}`).then((r) =>
      json<{ solicitud: Solicitud }>(r).then((d) => d.solicitud)
    );
  },

  obtenerSolicitudDetalle(id: string): Promise<{ solicitud: Solicitud; cotizaciones: Cotizacion[] }> {
    return fetch(`/api/solicitudes/${encodeURIComponent(id)}`).then((r) =>
      json<{ solicitud: Solicitud; cotizaciones: Cotizacion[] }>(r)
    );
  },

  listarCotizaciones(solicitudId: string): Promise<Cotizacion[]> {
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/cotizaciones`).then(
      (r) => json<Cotizacion[]>(r)
    );
  },

  misSolicitudes(email: string): Promise<SalidaCorta[]> {
    return fetch(`/api/solicitudes/mis-solicitudes?email=${encodeURIComponent(email)}`).then(
      (r) => json<SalidaCorta[]>(r)
    );
  },

  cargarCotizacion(payload: {
    solicitudId: string;
    proveedorNombre: string;
    formatoOriginal: Cotizacion["formatoOriginal"];
    valorNeto?: number | null;
    moneda?: string;
    impuestosDesglosados?: boolean | null;
    montoIsv?: number | null;
    valorTotal?: number | null;
    plazoEntrega?: string;
    especificacionesOfertadas?: Record<string, string>;
    markdownExtraido?: string;
  }): Promise<Cotizacion> {
    return fetch(`/api/solicitudes/${payload.solicitudId}/cotizaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<Cotizacion>(r));
  },

  // 2.2: sube la cotización con su archivo original (multipart) para adjuntarlo al envío de comparativa.
  cargarCotizacionConArchivo(payload: {
    solicitudId: string;
    proveedorNombre: string;
    formatoOriginal: Cotizacion["formatoOriginal"];
    archivo: File;
    markdownExtraido?: string;
  }): Promise<Cotizacion> {
    const form = new FormData();
    form.append("proveedorNombre", payload.proveedorNombre);
    form.append("formatoOriginal", payload.formatoOriginal);
    form.append("archivo", payload.archivo, payload.archivo.name);
    if (payload.markdownExtraido) form.append("markdownExtraido", payload.markdownExtraido);
    return fetch(`/api/solicitudes/${payload.solicitudId}/cotizaciones`, {
      method: "POST",
      body: form,
    }).then((r) => json<Cotizacion>(r));
  },

  crearCotizacionManual(payload: {
    solicitudId: string;
    proveedorNombre: string;
    valorNeto?: number | null;
    moneda?: string;
    impuestosDesglosados?: boolean | null;
    montoIsv?: number | null;
    valorTotal?: number | null;
    plazoEntrega?: string;
  }): Promise<Cotizacion> {
    return fetch(`/api/solicitudes/${payload.solicitudId}/cotizaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorNombre: payload.proveedorNombre,
        formatoOriginal: "manual",
        valorNeto: payload.valorNeto ?? null,
        moneda: payload.moneda,
        impuestosDesglosados: payload.impuestosDesglosados ?? null,
        montoIsv: payload.montoIsv ?? null,
        valorTotal: payload.valorTotal ?? null,
        plazoEntrega: payload.plazoEntrega,
      }),
    }).then((r) => json<Cotizacion>(r));
  },

  actualizarCotizacion(cotizacionId: string, datos: {
    proveedorNombre?: string;
    valorNeto?: number | null;
    moneda?: string;
    montoIsv?: number | null;
    valorTotal?: number | null;
    plazoEntrega?: string;
  }): Promise<void> {
    return fetch(`/api/solicitudes/_/cotizaciones/${encodeURIComponent(cotizacionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    }).then(async (r) => { if (!r.ok) throw new Error("No se pudo guardar"); });
  },

  eliminarCotizacion(cotizacionId: string): Promise<void> {
    return fetch(`/api/solicitudes/_/cotizaciones/${encodeURIComponent(cotizacionId)}`, {
      method: "DELETE",
    }).then(async (r) => { if (!r.ok) throw new Error("No se pudo eliminar"); });
  },

  clasificarIA(payload: { titulo: string; descripcion?: string; categoria?: string }) {
    return fetch("/api/ia/clasificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => {
      if (r.status === 400) return null;
      return json<ClasificarOutput | null>(r);
    });
  },

  assessmentIA(payload: {
    tipo: "RFI" | "RFQ" | "RFP";
    subtipo: "producto" | "servicio" | "mixto";
    categoria: string;
    camposCapturados: { campoKey: string; valor?: string }[];
    catalogo: CampoCatalogo[];
    llevaBranding?: boolean;
    archivoLogo?: string;
  }) {
    return fetch("/api/ia/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => {
      if (r.status === 400) return null;
      return json<ResultadoAssessment | null>(r);
    });
  },

  convertirDocumento(file: File): Promise<{ ok: boolean; markdown?: string; error?: string }> {
    const form = new FormData();
    form.append("archivo", file);
    return fetch("/api/convertir", {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) {
        const detalle = await r.json().catch(() => ({ error: "Error de conversión" }));
        return { ok: false, error: detalle.error ?? "Error de conversión" };
      }
      return r.json();
    });
  },

  listarCoordinadoresPublicos(): Promise<{ id: string; nombre: string; categorias: string[] }[]> {
    return fetch("/api/coordinadores", { method: "GET" }).then((r) => json<{ id: string; nombre: string; categorias: string[] }[]>(r));
  },

  generarComparativa(solicitudId: string): Promise<Comparativa> {
    return fetch(`/api/solicitudes/${solicitudId}/comparativa`, { method: "POST" }).then(
      (r) => json<Comparativa>(r)
    );
  },

  // Decisión por enlace público: se envía al POST /api/comparativas/[token]/decision
  // (la ruta antigua /[id]/decision quedó obsoleta por colisión de rutas dinámicas).
  registrarDecision(payload: {
    token: string;
    solicitudId: string;
    cotizacionSeleccionadaId?: string;
    decididoPorEmail: string;
    ningunaOpcion: boolean;
    comentario?: string;
  }): Promise<Decision> {
    return fetch(`/api/comparativas/${encodeURIComponent(payload.token)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solicitudId: payload.solicitudId,
        cotizacionId: payload.cotizacionSeleccionadaId,
        decididoPorEmail: payload.decididoPorEmail,
        ningunaOpcion: payload.ningunaOpcion,
        comentario: payload.comentario,
      }),
    }).then((r) => json<Decision>(r));
  },

  metricas(filtros?: FiltrosMetricas): Promise<Metricas> {
    const params = new URLSearchParams();
    if (filtros?.rango) params.set("rango", filtros.rango);
    if (filtros?.desde) params.set("desde", filtros.desde);
    if (filtros?.hasta) params.set("hasta", filtros.hasta);
    if (filtros?.coordinador) params.set("coordinador", filtros.coordinador);
    if (filtros?.categoria) params.set("categoria", filtros.categoria);
    const qs = params.toString();
    return fetch(`/api/metricas${qs ? `?${qs}` : ""}`).then((r) => json<Metricas>(r));
  },
};