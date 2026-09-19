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
export type FormatoCotizacion = "pdf" | "docx" | "imagen" | "manual";
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
  | "cancelacion"
  | "error";

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

export type EstadoCorreo = "enviado" | "fallido" | "reintentando";

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
