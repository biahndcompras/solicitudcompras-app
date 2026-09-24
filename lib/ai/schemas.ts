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
  titulo: z.string().default(""),
  descripcion: z.string().default(""),
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

// Schema tolerante: algunos modelos devuelven la pregunta con otra clave (campo/nombre/id)
// u omiten por_que. Normalizamos antes de validar para no descartar la llamada IA completa
// por una clave renombrada (antes: ZodError y caída al fallback determinístico).
const normalizarPregunta = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const o = raw as Record<string, unknown>;
  const campo = o.campoKey ?? o.campo ?? o.nombre ?? o.id ?? o.campo_key ?? o.campo_clave ?? o.clave;
  if (campo !== undefined && o.campoKey === undefined) {
    return { ...o, campoKey: campo };
  }
  return o;
};

// Las sugerencias vienen como strings, pero algunos modelos devuelven objetos
// ({texto} / {valor} / {sugerencia}) o strings vacíos. Normalizamos y limpiamos
// sin descartar la pregunta entera.
const normalizarSugerencias = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) return raw;
  return raw
    .map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        const o = s as Record<string, unknown>;
        return String(o.texto ?? o.valor ?? o.sugerencia ?? o.label ?? o.text ?? "");
      }
      return String(s ?? "");
    })
    .filter((s) => s.trim().length > 0);
};

// Booleanos tolerantes: "true"/"false"/1/0 → boolean.
const booleanoTolerante = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v === 1 ? true : v === 0 ? false : v),
  z.boolean()
);

export const PreguntaAssessmentSchema = z.object({
  campoKey: z.string().min(1),
  pregunta: z.string().default(""),
  por_que: z.string().default(""),
  critica: booleanoTolerante.default(false),
  ejemplo_respuesta: z.string().optional(),
  sugerencias: z.preprocess(normalizarSugerencias, z.array(z.string()).max(6)).optional(),
}).transform((p) => ({
  ...p,
  sugerencias: p.sugerencias
    ?.map((s) => s.trim().slice(0, 80))
    .filter((s) => s.length > 0)
    .slice(0, 3),
}));

export const AssessmentOutputSchema = z.object({
  preguntas: z.array(z.preprocess(normalizarPregunta, PreguntaAssessmentSchema)).max(10),
  contexto_investigado: z.string().default(""),
  sin_preguntas_pendientes: booleanoTolerante.optional(),
  // F2: si la descripción no alcanza para razonar sobre el producto/rubro, el modelo
  // lo declara en vez de inventar sugerencias genéricas; el wizard pide más contexto.
  contexto_insuficiente: booleanoTolerante.default(false),
  preguntas_contexto: z.preprocess(
    (v) => (Array.isArray(v) ? v.map((s) => String(s)).filter((s) => s.trim().length > 0) : v),
    z.array(z.string()).max(5)
  ).default([]),
}).transform((d) => ({
  preguntas: d.preguntas,
  contexto_investigado: d.contexto_investigado,
  sin_preguntas_pendientes: d.sin_preguntas_pendientes ?? d.preguntas.length === 0,
  contexto_insuficiente: d.contexto_insuficiente,
  preguntas_contexto: d.preguntas_contexto,
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