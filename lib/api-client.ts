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
  /**
   * `idempotencyKey` hace que el reintento no cree una segunda solicitud: el servidor
   * devuelve la fila que ya creó esa clave. Sin él, un timeout que el cliente no aborta
   * deja la fila creada igual y el siguiente intento agrega otra.
   * `signal` permite cancelar de verdad la petición en vez de solo dejar de esperarla.
   */
  crearSolicitud(
    payload: {
      titulo: string;
      solicitanteEmail: string;
      solicitanteNombre: string;
      areaSolicitante?: string;
      descripcion?: string;
      categoria?: string;
      tipo?: "RFI" | "RFQ" | "RFP";
      subtipo?: "producto" | "servicio" | "mixto";
      fechaRequerida?: string;
      /** RN-04: el solicitante corrigió el tipo sugerido por la IA. Alimenta la métrica de
       *  precisión del clasificador (doc 16); sin este campo el dato se perdía. */
      clasificacionCorregida?: boolean;
      /** B2: si lleva marca, el servidor exige el arte antes de enviar. */
      llevaBranding?: boolean;
      idempotencyKey?: string;
    },
    opts?: { signal?: AbortSignal }
  ): Promise<Solicitud> {
    return fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
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
  }, opts?: { signal?: AbortSignal }): Promise<{ solicitud: Solicitud; eventoId: string; pipeline?: unknown; enlace?: { token: string; url: string } }> {
    return fetch(`/api/solicitudes/${payload.solicitudId}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    }).then((r) => json(r));
  },

  // Re-cotización (2.3/H12): edita campos clave de una solicitud activa.
  editarSolicitud(
    solicitudId: string,
    cambios: { descripcion?: string; fechaRequerida?: string; respuestas?: Record<string, string> }
  ): Promise<{ solicitud: Solicitud }> {
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    }).then((r) => json(r));
  },

  // H2: logo/archivo real del producto. El correo es la identidad del solicitante (el flujo no
  // tiene sesión), así que viaja como `?email=` igual que en la descarga y en `/mis-solicitudes`.
  // El servidor lo exige: sin él, cualquiera con el UUID reemplazaría el logo de otra solicitud.
  subirArchivoLogo(
    solicitudId: string,
    archivo: File,
    opts?: { signal?: AbortSignal; email?: string }
  ): Promise<{ ok: boolean; nombre: string }> {
    const form = new FormData();
    form.append("archivo", archivo);
    const query = opts?.email ? `?email=${encodeURIComponent(opts.email)}` : "";
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/logo${query}`, {
      method: "POST",
      body: form,
      signal: opts?.signal,
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

  actualizarCotizacion(solicitudId: string, cotizacionId: string, datos: {
    proveedorNombre?: string;
    valorNeto?: number | null;
    moneda?: string;
    montoIsv?: number | null;
    valorTotal?: number | null;
    plazoEntrega?: string;
  }): Promise<void> {
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/cotizaciones/${encodeURIComponent(cotizacionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    }).then(async (r) => { if (!r.ok) throw new Error("No se pudo guardar"); });
  },

  eliminarCotizacion(solicitudId: string, cotizacionId: string): Promise<void> {
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/cotizaciones/${encodeURIComponent(cotizacionId)}`, {
      method: "DELETE",
    }).then(async (r) => { if (!r.ok) throw new Error("No se pudo eliminar"); });
  },

  clasificarIA(payload: { titulo: string; descripcion?: string; categoria?: string }, opts?: { signal?: AbortSignal }) {
    return fetch("/api/ia/clasificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    }).then((r) => {
      if (r.status === 400) return null;
      return json<ClasificarOutput | null>(r);
    });
  },

  assessmentIA(payload: {
    titulo?: string;
    descripcion?: string;
    tipo: "RFI" | "RFQ" | "RFP";
    subtipo: "producto" | "servicio" | "mixto";
    categoria: string;
    camposCapturados: { campoKey: string; valor?: string }[];
    catalogo: CampoCatalogo[];
    llevaBranding?: boolean;
    archivoLogo?: string;
  }, opts?: { signal?: AbortSignal }) {
    return fetch("/api/ia/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    }).then((r) => {
      if (r.status === 400) return null;
      return json<ResultadoAssessment | null>(r);
    });
  },

  convertirDocumento(file: File): Promise<{ ok: boolean; markdown?: string; error?: string; status?: number }> {
    const form = new FormData();
    form.append("archivo", file);
    return fetch("/api/convertir", {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) {
        const detalle = await r.json().catch(() => ({ error: "Error de conversión" }));
        // `status` permite distinguir un rechazo del archivo (413/415/422: no crear nada) de
        // un fallo transitorio de la IA (503: se sube el archivo y se carga a mano).
        return { ok: false, error: detalle.error ?? "Error de conversión", status: r.status };
      }
      return r.json();
    });
  },

  // Documentos adjuntos (4.4.12). El correo es la identidad del solicitante (no tiene sesión);
  // para Compras va vacío y manda la cookie de sesión.
  listarAdjuntos(solicitudId: string, email?: string): Promise<{ adjuntos: import("@/lib/domain/types").Adjunto[] }> {
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/adjuntos${q}`).then((r) => json(r));
  },

  subirAdjunto(solicitudId: string, archivo: File, email?: string): Promise<{ adjunto: import("@/lib/domain/types").Adjunto }> {
    const form = new FormData();
    form.append("archivo", archivo);
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    return fetch(`/api/solicitudes/${encodeURIComponent(solicitudId)}/adjuntos${q}`, {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) {
        const detalle = await r.json().catch(() => null);
        // Vercel corta los cuerpos grandes ANTES de la función y responde 413 sin JSON.
        if (r.status === 413) {
          throw new Error("El archivo es demasiado grande. El máximo es 4 MB.");
        }
        throw new Error(
          detalle?.error ??
            `No se pudo subir el documento (error ${r.status}). Reintente o use otro archivo.`
        );
      }
      return r.json();
    });
  },

  eliminarAdjunto(solicitudId: string, adjuntoId: string, email?: string): Promise<void> {
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    return fetch(
      `/api/solicitudes/${encodeURIComponent(solicitudId)}/adjuntos/${encodeURIComponent(adjuntoId)}${q}`,
      { method: "DELETE" }
    ).then(async (r) => {
      if (!r.ok) {
        const detalle = await r.json().catch(() => ({ error: "No se pudo eliminar el documento" }));
        throw new Error(detalle.error ?? "No se pudo eliminar el documento");
      }
    });
  },

  urlAdjunto(solicitudId: string, adjuntoId: string, email?: string): string {
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    return `/api/solicitudes/${encodeURIComponent(solicitudId)}/adjuntos/${encodeURIComponent(adjuntoId)}${q}`;
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