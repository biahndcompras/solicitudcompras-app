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
  Adjunto,
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
  /**
   * Crea la solicitud. Si `opciones.idempotencyKey` viene repeats, NO crea una segunda fila:
   * devuelve la que ya existe con esa clave. Es la garantía de que un reintento, un doble clic
   * o un refresh en pleno envío no duplican la solicitud (ver migration 016).
   */
  crearSolicitud(
    datos: Pick<
      Solicitud,
      "titulo" | "solicitanteEmail" | "solicitanteNombre" | "estado"
    >,
    opciones?: { areaSolicitante?: string; descripcion?: string; tipo?: string; subtipo?: string; categoria?: string; fechaRequerida?: string; clasificacionCorregida?: boolean; idempotencyKey?: string; plantillaId?: string; llevaBranding?: boolean; coordinadorId?: string }
  ): Promise<Solicitud>;

  /**
   * Marca que la notificación/documento de una solicitud ya enviada no se pudo generar.
   * La transición ya ocurrió: esto registra el fallo del aviso, no lo revierte (RF-25).
   */
  marcarNotificacionFallida(solicitudId: string): Promise<void>;

  guardarRespuestas(solicitudId: string, respuestas: RespuestaCampo[]): Promise<void>;
  listarRespuestas(solicitudId: string): Promise<RespuestaCampo[]>;

  /** Borra una fila local recién creada (rollback de un alta cuya invitación falló). */
  eliminarUsuario(id: string): Promise<void>;

  /** Coordinadores y admins (para administrar cuentas y roles desde el panel). */
  listarEquipo(opciones?: { incluirInactivos?: boolean }): Promise<Usuario[]>;

  /** Documentos adjuntos (migración 021). */
  crearAdjunto(input: {
    solicitudId: string;
    nombreArchivo: string;
    mimeType?: string;
    contenido: Uint8Array;
    subidoPorEmail?: string;
    actorTipo?: "coordinador" | "admin" | "solicitante";
  }): Promise<Adjunto>;
  listarAdjuntos(solicitudId: string): Promise<Adjunto[]>;
  obtenerAdjunto(solicitudId: string, adjuntoId: string): Promise<Adjunto | null>;
  eliminarAdjunto(input: {
    solicitudId: string;
    adjuntoId: string;
    actorTipo?: string;
    actorIdentificador?: string;
  }): Promise<boolean>;
  guardarRespuestasPorClave(solicitudId: string, respuestas: Record<string, string>): Promise<void>;

  transicionarEstado(input: {
    solicitudId: string;
    hacia: Solicitud["estado"];
    actorTipo: string;
    actorIdentificador?: string;
    nota?: string;
  }): Promise<TransicionResultado>;

  /**
   * Coordinadores para asignación, alertas y filtros. Por defecto solo activos: un
   * coordinador desactivado no debe recibir nuevas asignaciones. La pantalla de
   * administración pide `{ incluirInactivos: true }` para poder reactivarlos.
   */
  listarCoordinadores(opciones?: { incluirInactivos?: boolean }): Promise<Usuario[]>;

  listarPorCoordinador(coordinadorId: string): Promise<Solicitud[]>;

  listarTodas(): Promise<Solicitud[]>;

  asignarCoordinador(solicitudId: string, coordinadorId: string): Promise<void>;

  reasignarCoordinador(solicitudId: string, nuevoCoordinadorId: string, actorIdentificador?: string): Promise<void>;

  listarPorEmail(email: string): Promise<Solicitud[]>;
  /**
   * Usuario local ACTIVO por correo de la sesión de Supabase. La sesión trae el email pero
   * las solicitudes se asignan por id local: sin esta traducción, cada lugar que necesite el
   * id reimplementa la búsqueda y empiezan a aparecer bandejas ajenas.
   *
   * Filtra `activo = true`: un coordinador dado de baja no debe resolver su bandeja. Para
   * administración (alta, verificar duplicados, reactivar) usar `buscarUsuarioPorEmail`.
   */
  usuarioLocalPorEmail(email: string): Promise<Usuario | null>;

  /** Usuario por id, ACTIVO o INACTIVO. Para la gestión de administración. */
  usuarioPorId(id: string): Promise<Usuario | null>;

  /** Cualquier usuario por correo, ACTIVO o INACTIVO (alta y detección de duplicados). */
  buscarUsuarioPorEmail(email: string): Promise<Usuario | null>;

  /** Alta de un usuario local (la fila en `usuario`; el Auth se crea aparte). */
  crearUsuario(datos: {
    nombre: string;
    email: string;
    rol: Usuario["rol"];
    categoriasAsignadas: string[];
  }): Promise<Usuario>;

  /** Edición parcial: solo se pisa lo que llega. null si el id no existe. */
  actualizarUsuario(
    id: string,
    cambios: { nombre?: string; rol?: "coordinador" | "admin"; categoriasAsignadas?: string[]; activo?: boolean }
  ): Promise<Usuario | null>;

  /** Tasa de ISV vigente desde `configuracion`; 0.15 solo si la clave falta o es inválida. */
  tasaIsv(): Promise<number>;

  /** Ronda de preguntas abierta al solicitante (spec 010). */
  pedirInformacion(input: {
    solicitudId: string;
    preguntas: { campoKey: string; pregunta: string }[];
    pedidaPor?: string;
  }): Promise<{ ronda: number; pedidaEn: string }>;
  responderInformacion(input: {
    solicitudId: string;
    respuestas: Record<string, string>;
    respondidoPor?: string;
  }): Promise<{ yaRespondida: boolean; ronda?: number }>;
  informacionVencida(umbralDias: number): Promise<{ solicitud: Solicitud; ronda: number; dias: number }[]>;
  marcarRecordatorioInformacion(solicitudId: string, ronda: number): Promise<void>;

  obtenerSolicitud(id: string): Promise<Solicitud | null>;

  guardarCotizacion(cotizacion: Omit<Cotizacion, "id">): Promise<Cotizacion>;

  obtenerArchivoCotizacion(id: string): Promise<{ bytea: Uint8Array; nombre: string } | null>;
  guardarArchivoLogo(solicitudId: string, nombre: string, bytea: Uint8Array): Promise<void>;
  obtenerArchivoLogo(solicitudId: string): Promise<{ bytea: Uint8Array; nombre: string } | null>;

  listarCotizacionesConArchivo(solicitudId: string): Promise<{ id: string; proveedorNombre: string; archivoNombreOriginal?: string; bytea: Uint8Array }[]>;

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
  /** La plantilla que aplica a (tipo, subtipo, categoría), con su versión (RF-55). */
  obtenerPlantillaPara(tipo: "RFI" | "RFQ" | "RFP", subtipo?: string, categoria?: string): Promise<{ id: string; version: number } | null>;

  actualizarCamposSolicitud(
    solicitudId: string,
    cambios: { descripcion?: string; fechaRequerida?: string; respuestas?: Record<string, string> },
    actor?: { tipo: "coordinador" | "admin"; identificador?: string }
  ): Promise<void>;

  guardarConfig(clave: string, valor: unknown): Promise<void>;

  /**
   * Marcador del correo 5 (plan 4.11.7): guarda hasta qué movimiento se avisó la inactividad,
   * para que un segundo clic en "Ejecutar alertas" no vuelva a molestar por lo mismo. Un
   * movimiento posterior al avisado re-arma la alerta.
   */
  marcarAlertaInactividad(solicitudId: string, movimientoAvisadoMs: number): Promise<void>;

  /**
   * Último movimiento por el que ya se avisó la inactividad, por solicitud, en ms. Una
   * solicitud sin entrada nunca fue avisada.
   */
  alertasInactividadAvisadas(): Promise<Record<string, number>>;
}

export type FiltrosMetricas = {
  rango?: "dia" | "semana" | "mes" | "todo";
  desde?: string;
  hasta?: string;
  coordinador?: string;
  categoria?: string;
  umbralDias?: number;
};