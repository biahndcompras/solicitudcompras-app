// Tipos de dominio — Portal de Compras BIA
// Fuente: diccionario de datos (doc 15). Sin dependencias de Next/Supabase.

export type TipoSolicitud = "RFI" | "RFQ" | "RFP";
export type SubtipoSolicitud = "producto" | "servicio" | "mixto";

export const ESTADOS_SOLICITUD = [
  "BORRADOR",
  "ENVIADA_A_COMPRAS",
  "EN_COTIZACION",
  "COMPARATIVA_LISTA",
  "ENVIADA_A_SOLICITANTE",
  "CERRADA_CON_DECISION",
  "CERRADA_SIN_DECISION",
  "CANCELADA",
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADOS_TERMINALES: EstadoSolicitud[] = [
  "CERRADA_CON_DECISION",
  "CERRADA_SIN_DECISION",
  "CANCELADA",
];

export type TipoDatoCampo =
  | "texto"
  | "texto_largo"
  | "numero"
  | "fecha"
  | "seleccion"
  | "seleccion_multiple"
  | "booleano"
  | "archivo"
  | "moneda";

export type OrigenCampo = "plantilla" | "assessment";

export type TipoAdjunto = "logo" | "imagen_referencia" | "anexo" | "otro";
export type FormatoCotizacion = "pdf" | "docx" | "pptx" | "imagen" | "manual";
export type RolUsuario = "coordinador" | "admin";

export type TipoEvento =
  | "creacion"
  | "cambio_estado"
  | "carga_cotizacion"
  | "generacion_documento"
  | "generacion_comparativa"
  | "envio_correo"
  | "acceso_link"
  | "decision"
  | "reasignacion"
  | "edicion"
  | "cancelacion"
  | "error"
  | "pregunta_solicitante"
  | "respuesta_solicitante";

export type CampoCatalogo = {
  campoKey: string;
  label: string;
  ayuda?: string;
  tipoDato: TipoDatoCampo;
  catalogoOpciones?: string;
  obligatorio: boolean;
  origen: OrigenCampo;
  seccionPdf?: string;
  orden: number;
  validacion?: {
    dependeDe?: string;
    valorRequerido?: boolean;
    bloqueante?: boolean;
    formatosPermitidos?: string[];
  };
  activo: boolean;
};

export type Plantilla = {
  id: string;
  nombre: string;
  tipo: TipoSolicitud;
  subtipo?: SubtipoSolicitud;
  categoria?: string;
  version: number;
  activa: boolean;
};

export type Solicitud = {
  id: string;
  numeroReferencia?: string;
  tipo?: TipoSolicitud;
  subtipo?: SubtipoSolicitud;
  categoria?: string;
  estado: EstadoSolicitud;
  titulo: string;
  descripcion?: string;
  solicitanteEmail: string;
  solicitanteNombre: string;
  areaSolicitante?: string;
  coordinadorId?: string;
  plantillaId?: string;
  fechaRequerida?: string;
  fechaCreacion: string;
  fechaEnvio?: string;
  fechaCierre?: string;
  clasificacionConfianza?: number;
  clasificacionCorregida: boolean;
  motivoCancelacion?: string;
  notificacionFallida: boolean;
  archivoLogoNombre?: string;
  /** B2: si lleva marca, el servidor exige el arte adjunto antes de enviar. */
  llevaBranding?: boolean;
  /** Ronda de preguntas abierta al solicitante (spec 010). No es un estado: la solicitud
   *  sigue en su estado real, esto solo dice que encima hay algo que la está esperando. */
  informacionPendiente?: boolean;
  informacionPreguntas?: PreguntaAlSolicitante;
  informacionDesde?: string;
  informacionRespuesta?: RespuestaDelSolicitante;
};

export type PreguntaAlSolicitante = {
  ronda: number;
  pedidaEn: string;
  pedidaPor?: string;
  preguntas: { campoKey: string; pregunta: string }[];
  /** Ronda para la que YA se mandó el recordatorio, para no repetirlo cada día. */
  recordatorioRonda?: number;
};

export type RespuestaDelSolicitante = {
  ronda: number;
  respondidaEn: string;
  /** Se conserva la respuesta original aunque Compras edite el campo después (spec 010, D4). */
  respuestas: Record<string, string>;
};

/**
 * Una ronda de preguntas al solicitante, tal como se le mostró.
 *
 * Antes el historial vivía solo en columnas de `solicitud`: cada ronda nueva sobrescribía la
 * anterior y el coordinador perdía el contexto. Ahora cada ronda es una fila (4.13.20).
 */
export type RondaPreguntas = {
  id: string;
  solicitudId: string;
  ronda: number;
  preguntas: { campoKey: string; pregunta: string }[];
  /** Sin respuestas mientras la ronda está abierta. */
  respuestas?: Record<string, string>;
  pedidaPor?: string;
  pedidaEn: string;
  respondidaEn?: string;
  /**
   * `false` en rondas anteriores a la migración 024: solo queda el resumen del evento
   * ("Ronda N: X pregunta(s)"), no el texto ni las respuestas.
   */
  detalleDisponible?: boolean;
  /** Preguntas que se hicieron cuando el detalle no está disponible. */
  totalPreguntas?: number;
  /** Respuestas registradas cuando el detalle no está disponible. */
  totalRespuestas?: number;
};

export type RespuestaCampo = {
  id: string;
  solicitudId: string;
  campoKey: string;
  campoLabel: string;
  valor?: string;
  valorNumerico?: number;
  origen: OrigenCampo;
};

export type Adjunto = {
  id: string;
  solicitudId: string;
  tipo: TipoAdjunto;
  campoKey?: string;
  nombreArchivo: string;
  mimeType?: string;
  tamanoBytes?: number;
  /** Correo de quien lo subió: dice de qué lado viene (Compras o el solicitante). */
  subidoPorEmail?: string;
  creadoEn?: string;
  /** Solo al descargar: el binario no viaja en los listados. */
  contenido?: Uint8Array;
};

export type Cotizacion = {
  id: string;
  solicitudId: string;
  proveedorNombre: string;
  proveedorIdentificacionFiscal?: string;
  proveedorContacto?: string;
  formatoOriginal: FormatoCotizacion;
  valorNeto?: number;
  moneda?: string;
  impuestosDesglosados?: boolean;
  montoIsv?: number;
  montoOtrosImpuestos?: number;
  valorTotal?: number;
  plazoEntrega?: string;
  formaPago?: string;
  vigenciaOferta?: string;
  garantia?: string;
  especificacionesOfertadas: Record<string, string>;
  observacionesFiscales?: string;
  confianzaExtraccion: Record<string, number>;
  editadaManualmente: boolean;
  fechaCarga: string;
  archivoOriginal?: string; // ruta/identificador del archivo original (2.2)
  archivoNombreOriginal?: string;
  archivoBytea?: Uint8Array; // contenido binario del archivo original (solo lectura/uso interno servidor)
};

/** Documento adjunto de una solicitud (coordinador/admin o el propio solicitante). */
export type Discrepancia = {
  aspecto: string;
  solicitado: string;
  porProveedor: Record<string, string>;
  severidad: "alta" | "media" | "baja";
  explicacion: string;
};

export type ProsContras = {
  pros: string[];
  contras: string[];
};

export type Comparativa = {
  id: string;
  solicitudId: string;
  prosContras: Record<string, ProsContras>;
  discrepanciasDetectadas: Discrepancia[];
  sugerenciaIA?: string;
  cotizacionSugeridaId?: string;
  recomendacionComprador?: string;
  fechaRecomendacion?: string;
  fechaGeneracion: string;
  analysis?: {
    discrepancias: Discrepancia[];
    comparablesEntreSi: boolean;
    advertenciaGeneral: string | null;
    prosContras: Record<string, ProsContras>;
    sugerencia: {
      cotizacionId: string;
      justificacion: string;
      advertencias: string[];
    } | null;
  };
};

export type Decision = {
  id: string;
  comparativaId: string;
  cotizacionSeleccionadaId?: string;
  decididoPorEmail: string;
  fechaDecision: string;
  ningunaOpcion: boolean;
  comentario?: string;
};

export type LinkPublico = {
  id: string;
  comparativaId: string;
  token: string;
  fechaExpiracion?: string;
  vecesAccedido: number;
  revocado: boolean;
};

export type EventoTrazabilidad = {
  id: string;
  solicitudId: string;
  tipoEvento: TipoEvento;
  estadoAnterior?: EstadoSolicitud;
  estadoNuevo?: EstadoSolicitud;
  actorTipo: "solicitante" | "coordinador" | "admin" | "sistema";
  actorIdentificador?: string;
  nota?: string;
  /** Payload completo cuando el resumen no alcanza (rondas de preguntas, por ejemplo). */
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  categoriasAsignadas: string[];
  activo: boolean;
};

export type DocumentoGenerado = {
  id: string;
  solicitudId: string;
  tipo: TipoSolicitud;
  rutaPdf: string;
  version: number;
  plantillaVersion: number;
  fechaGeneracion: string;
};

export type EstadoCorreo = "enviado" | "fallido" | "reintentando" | "simulado";

export type CorreoEnviado = {
  id: string;
  solicitudId: string;
  tipoCorreo: string;
  destinatario: string;
  asunto?: string;
  estadoEnvio: EstadoCorreo;
  intentos: number;
  errorDetalle?: string;
  fechaEnvio: string;
};
