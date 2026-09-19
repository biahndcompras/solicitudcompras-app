import { z } from "zod";

export const ClasificarInputSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().optional().default(""),
  categoria: z.string().optional().default(""),
});

export const ClasificarOutputSchema = z.object({
  tipo: z.enum(["RFI", "RFQ", "RFP"]).nullable(),
  subtipo: z.enum(["producto", "servicio", "mixto"]).nullable(),
  confianza: z.number().min(0).max(1),
  razonamiento_breve: z.string(),
});

export type ClasificarInput = z.infer<typeof ClasificarInputSchema>;
export type ClasificarOutput = z.infer<typeof ClasificarOutputSchema>;

export const AssessmentInputSchema = z.object({
  tipo: z.enum(["RFI", "RFQ", "RFP"]),
  subtipo: z.enum(["producto", "servicio", "mixto"]),
  categoria: z.string(),
  camposCapturados: z.record(z.string(), z.unknown()),
  catalogo: z.array(z.object({
    campoKey: z.string(),
    label: z.string(),
    ayuda: z.string().optional(),
    tipoDato: z.string(),
    obligatorio: z.boolean(),
    origen: z.string(),
    seccionPdf: z.string().optional(),
    orden: z.number(),
    activo: z.boolean(),
  })),
});

export const PreguntaAssessmentSchema = z.object({
  campoKey: z.string(),
  pregunta: z.string(),
  por_que: z.string(),
  critica: z.boolean(),
  ejemplo_respuesta: z.string().optional(),
  sugerencias: z.array(z.string()).max(3).optional(),
});

export const AssessmentOutputSchema = z.object({
  preguntas: z.array(PreguntaAssessmentSchema).max(10),
  contexto_investigado: z.string().default(""),
  sin_preguntas_pendientes: z.boolean().optional(),
}).transform((d) => ({
  preguntas: d.preguntas,
  contexto_investigado: d.contexto_investigado,
  sin_preguntas_pendientes: d.sin_preguntas_pendientes ?? d.preguntas.length === 0,
}));

export type AssessmentInput = z.infer<typeof AssessmentInputSchema>;
export type AssessmentOutput = z.infer<typeof AssessmentOutputSchema>;

export const ExtraerCotizacionInputSchema = z.object({
  markdown: z.string().min(1),
  especificacionesSolicitadas: z.record(z.string(), z.string()).default({}),
});

export const ExtraerCotizacionOutputSchema = z.object({
  proveedorNombre: z.string().nullable(),
  proveedorIdentificacionFiscal: z.string().nullable().optional(),
  proveedorContacto: z.string().nullable().optional(),
  valorNeto: z.number().nullable().optional(),
  moneda: z.string().nullable().optional(),
  impuestosDesglosados: z.boolean().nullable().optional(),
  montoIsv: z.number().nullable().optional(),
  montoOtrosImpuestos: z.number().nullable().optional(),
  valorTotal: z.number().nullable().optional(),
  plazoEntrega: z.string().nullable().optional(),
  formaPago: z.string().nullable().optional(),
  vigenciaOferta: z.string().nullable().optional(),
  garantia: z.string().nullable().optional(),
  especificacionesOfertadas: z.record(z.string(), z.string()).default({}),
  observacionesFiscales: z.string().nullable().optional(),
  ilegible: z.boolean().optional(),
  confianzaPorCampo: z.record(z.string(), z.number()).default({}),
}).transform((d) => ({
  ...d,
  ilegible: d.ilegible ?? false,
}));

export type ExtraerCotizacionInput = z.infer<typeof ExtraerCotizacionInputSchema>;
export type ExtraerCotizacionOutput = z.infer<typeof ExtraerCotizacionOutputSchema>;

export const ComparativaInputSchema = z.object({
  tituloSolicitud: z.string(),
  especificacionesSolicitadas: z.record(z.string(), z.string()),
  cotizaciones: z.array(z.object({
    proveedorNombre: z.string(),
    valorNeto: z.number().nullable(),
    moneda: z.string().nullable(),
    montoIsv: z.number().nullable(),
    montoOtrosImpuestos: z.number().nullable().optional(),
    valorTotal: z.number().nullable(),
    plazoEntrega: z.string().nullable(),
    formaPago: z.string().nullable().optional(),
    vigenciaOferta: z.string().nullable().optional(),
    garantia: z.string().nullable().optional(),
    impuestosDesglosados: z.boolean().nullable().optional(),
    observacionesFiscales: z.string().nullable().optional(),
    proveedorIdentificacionFiscal: z.string().nullable().optional(),
    especificacionesOfertadas: z.record(z.string(), z.string()),
  })),
});

export const ProsContrasSchema = z.object({
  pros: z.array(z.string()),
  contras: z.array(z.string()),
});

export const DiscrepanciaSchema = z.object({
  aspecto: z.string(),
  solicitado: z.string(),
  porProveedor: z.record(z.string(), z.string()),
  severidad: z.enum(["alta", "media", "baja"]),
  explicacion: z.string(),
});

export const ComparativaOutputSchema = z.object({
  discrepanciasDetectadas: z.array(DiscrepanciaSchema).default([]),
  prosContras: z.record(z.string(), ProsContrasSchema).default({}),
  sugerenciaIA: z.string().nullable().optional(),
  cotizacionSugeridaId: z.string().nullable().optional(),
  advertenciaGeneral: z.string().nullable().optional(),
}).transform((d) => ({
  discrepanciasDetectadas: d.discrepanciasDetectadas,
  prosContras: d.prosContras,
  sugerenciaIA: d.sugerenciaIA ?? null,
  cotizacionSugeridaId: d.cotizacionSugeridaId ?? null,
  advertenciaGeneral: d.advertenciaGeneral ?? null,
}));

export type ComparativaInput = z.infer<typeof ComparativaInputSchema>;
export type ComparativaOutput = z.infer<typeof ComparativaOutputSchema>;

export const ValidarFiscalInputSchema = z.object({
  valorNeto: z.number().nullable(),
  montoIsv: z.number().nullable(),
  montoOtrosImpuestos: z.number().nullable().optional(),
  valorTotal: z.number().nullable(),
  impuestosDesglosados: z.boolean().nullable(),
  tasaIsv: z.number().default(0.15),
});

export const ValidarFiscalOutputSchema = z.object({
  tratamiento_declarado: z.enum(["incluye", "no_incluye", "no_declarado"]),
  coherencia_aritmetica: z.enum(["correcta", "inconsistente", "no_verificable"]),
  observacion: z.string().nullable(),
  requiere_aclaracion: z.boolean(),
});

export type ValidarFiscalInput = z.infer<typeof ValidarFiscalInputSchema>;
export type ValidarFiscalOutput = z.infer<typeof ValidarFiscalOutputSchema>;

export const FuncionPromptSchema = z.object({
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
});