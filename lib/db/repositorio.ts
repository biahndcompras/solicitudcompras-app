// Puerto del repositorio de datos — Portal de Compras BIA.
// Define lo que el dominio necesita persistir; el adaptador Postgres lo implementa.
// Esto permite migrar a Supabase Cloud con un adaptador nuevo (misma interfaz).
import type {
  Comparativa,
  CorreoEnviado,
  Cotizacion,
  Decision,
  DocumentoGenerado,
  EventoTrazabilidad,
  LinkPublico,
  RespuestaCampo,
  Solicitud,
  Usuario,
  CampoCatalogo,
} from "@/lib/domain/types";
import type { MetricasDashboard } from "@/lib/domain/metrics";

export type TransicionResultado = {
  solicitud: Solicitud;
  eventoId: string;
};

export interface Repositorio {
  crearSolicitud(
    datos: Pick<
      Solicitud,
      "titulo" | "solicitanteEmail" | "solicitanteNombre" | "estado"
    >,
    opciones?: { areaSolicitante?: string; descripcion?: string; tipo?: string; subtipo?: string; categoria?: string; fechaRequerida?: string }
  ): Promise<Solicitud>;

  guardarRespuestas(solicitudId: string, respuestas: RespuestaCampo[]): Promise<void>;

  transicionarEstado(input: {
    solicitudId: string;
    hacia: Solicitud["estado"];
    actorTipo: string;
    actorIdentificador?: string;
    nota?: string;
  }): Promise<TransicionResultado>;

  listarCoordinadores(): Promise<Usuario[]>;

  listarPorCoordinador(coordinadorId: string): Promise<Solicitud[]>;

  listarTodas(): Promise<Solicitud[]>;

  asignarCoordinador(solicitudId: string, coordinadorId: string): Promise<void>;

  listarPorEmail(email: string): Promise<Solicitud[]>;

  obtenerSolicitud(id: string): Promise<Solicitud | null>;

  guardarCotizacion(cotizacion: Omit<Cotizacion, "id">): Promise<Cotizacion>;

  listarCotizaciones(solicitudId: string): Promise<Cotizacion[]>;

  guardarComparativa(solicitudId: string, comparativa: Comparativa): Promise<Comparativa>;

  guardarRecomendacionComprador(solicitudId: string, recomendacion: string): Promise<void>;

  registrarDecision(
    decision: Omit<Decision, "id" | "fechaDecision">
  ): Promise<Decision>;

  // Última decisión registrada para la comparativa de una solicitud (null si no hay).
  obtenerDecisionPorSolicitud(solicitudId: string): Promise<Decision | null>;
  // Eventos de trazabilidad de una solicitud, del más antiguo al más reciente.
  listarEventos(solicitudId: string): Promise<EventoTrazabilidad[]>;

  registrarDecisionYCerrar(input: {
    comparativaId: string;
    solicitudId: string;
    cotizacionSeleccionadaId?: string;
    decididoPorEmail: string;
    ningunaOpcion: boolean;
    comentario?: string;
  }): Promise<void>;

  obtenerComparativaPorId(id: string): Promise<Comparativa | null>;

  obtenerComparativaPorSolicitudId(solicitudId: string): Promise<Comparativa | null>;

  crearLinkPublico(comparativaId: string, token: string, fechaExpiracion?: string): Promise<LinkPublico>;

  obtenerLinkPorToken(token: string): Promise<LinkPublico | null>;

  registrarAccesoLink(token: string): Promise<void>;

  metricasDashboard(filtros?: FiltrosMetricas): Promise<MetricasDashboard>;

  persistirDocumento(input: {
    solicitudId: string;
    tipo: string;
    rutaPdf: string;
    plantillaVersion?: number;
  }): Promise<DocumentoGenerado>;

  registrarCorreo(input: {
    solicitudId: string;
    tipoCorreo: string;
    destinatario: string;
    asunto?: string;
    estadoEnvio: CorreoEnviado["estadoEnvio"];
    intentos?: number;
    errorDetalle?: string;
  }): Promise<CorreoEnviado>;

  leerConfig(clave: string): Promise<unknown>;

  listarCamposDePlantilla(tipo: "RFI" | "RFQ" | "RFP", subtipo?: string, categoria?: string): Promise<CampoCatalogo[]>;

  actualizarCamposSolicitud(
    solicitudId: string,
    cambios: { descripcion?: string; fechaRequerida?: string; resupuestas?: Record<string, string> }
  ): Promise<void>;

  guardarConfig(clave: string, valor: unknown): Promise<void>;
}

export type FiltrosMetricas = {
  rango?: "dia" | "semana" | "mes" | "todo";
  desde?: string;
  hasta?: string;
  coordinador?: string;
  categoria?: string;
  umbralDias?: number;
};