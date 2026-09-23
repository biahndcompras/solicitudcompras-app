import { z } from "zod";
import { llamarOpenRouter, getModel, getFallbackModel, getTimeout, type OpenRouterMessage } from "./client";
import { prompts, FUNCIONES, type FuncionLower } from "./prompts";
import {
  ClasificarInputSchema,
  ClasificarOutputSchema,
  AssessmentInputSchema,
  AssessmentOutputSchema,
  ExtraerCotizacionInputSchema,
  ExtraerCotizacionOutputSchema,
  ComparativaInputSchema,
  ComparativaOutputSchema,
  ValidarFiscalInputSchema,
  ValidarFiscalOutputSchema,
  type ClasificarInput,
  type ClasificarOutput,
  type AssessmentInput,
  type AssessmentOutput,
  type ExtraerCotizacionInput,
  type ExtraerCotizacionOutput,
  type ComparativaInput,
  type ComparativaOutput,
  type ValidarFiscalInput,
  type ValidarFiscalOutput,
} from "./schemas";

function reemplazar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, key: string) => vars[key.trim()] ?? "");
}

async function ejecutarUna<I, O>(
  funcion: FuncionLower,
  input: I,
  schemaSalida: z.ZodType<O>,
  renderVars: (input: I) => Record<string, string>,
  timeoutMs: number,
): Promise<O | null> {
  const prompt = prompts[FUNCIONES[funcion]];
  const messages: OpenRouterMessage[] = [
    { role: "system", content: prompt.systemPrompt },
    { role: "user", content: reemplazar(prompt.userPromptTemplate, renderVars(input)) },
  ];

  const modelos = [getModel(), getFallbackModel()];

  for (const modelo of modelos) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await llamarOpenRouter(
        { model: modelo, messages, response_format: { type: "json_object" } },
        controller.signal,
      );
      const contenido = raw.choices?.[0]?.message?.content;
      if (!contenido) continue;
      const parsed = JSON.parse(contenido);
      const validado = schemaSalida.parse(parsed);
      return validado;
    } catch (e) {
      if (modelo === modelos[modelos.length - 1]) {
        console.warn(`[IA] ${funcion} falló (modelo=${modelo}):`, e);
        return null;
      }
      console.warn(`[IA] ${funcion} falló con ${modelo}, reintentando fallback…`);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

export async function clasificar(input: ClasificarInput): Promise<ClasificarOutput | null> {
  const parsed = ClasificarInputSchema.parse(input);
  return ejecutarUna(
    "clasificar",
    parsed,
    ClasificarOutputSchema,
    (i) => ({
      titulo: i.titulo,
      descripcion: i.descripcion ?? "",
      categoria: i.categoria ?? "",
    }),
    getTimeout("clasificar"),
  );
}

export async function assessment(input: AssessmentInput): Promise<AssessmentOutput | null> {
  const parsed = AssessmentInputSchema.parse(input);
  const clavesValidas = new Set(parsed.catalogo.map((c) => c.campoKey));
  const salida = await ejecutarUna(
    "assessment",
    parsed,
    AssessmentOutputSchema,
    (i) => ({
      titulo: i.titulo ?? "",
      descripcion: i.descripcion ?? "",
      tipo: i.tipo,
      subtipo: i.subtipo,
      categoria: i.categoria,
      camposCapturados: JSON.stringify(i.camposCapturados),
      catalogo: JSON.stringify(i.catalogo),
    }),
    getTimeout("assessment"),
  );
  if (!salida) return null;
  // RN-02: filtramos cualquier campoKey devuelto fuera del catálogo vigente.
  const preguntas = salida.preguntas.filter((p) => clavesValidas.has(p.campoKey));
  return { ...salida, preguntas };
}

export async function extraerCotizacion(input: ExtraerCotizacionInput): Promise<ExtraerCotizacionOutput | null> {
  const parsed = ExtraerCotizacionInputSchema.parse(input);
  return ejecutarUna(
    "extraer",
    parsed,
    ExtraerCotizacionOutputSchema,
    (i) => ({
      markdown: i.markdown,
      especificacionesSolicitadas: JSON.stringify(i.especificacionesSolicitadas),
    }),
    getTimeout("extraer"),
  );
}

export async function comparativa(input: ComparativaInput): Promise<ComparativaOutput | null> {
  const parsed = ComparativaInputSchema.parse(input);
  return ejecutarUna(
    "comparativa",
    parsed,
    ComparativaOutputSchema,
    (i) => ({
      tituloSolicitud: i.tituloSolicitud,
      especificacionesSolicitadas: JSON.stringify(i.especificacionesSolicitadas),
      cotizaciones: JSON.stringify(i.cotizaciones),
    }),
    getTimeout("comparativa"),
  );
}

export async function validarFiscal(input: ValidarFiscalInput): Promise<ValidarFiscalOutput | null> {
  const parsed = ValidarFiscalInputSchema.parse(input);
  const vars: Record<string, string> = {
    valorNeto: parsed.valorNeto === null ? "null" : String(parsed.valorNeto),
    montoIsv: parsed.montoIsv === null ? "null" : String(parsed.montoIsv),
    montoOtrosImpuestos: parsed.montoOtrosImpuestos === null ? "null" : String(parsed.montoOtrosImpuestos),
    valorTotal: parsed.valorTotal === null ? "null" : String(parsed.valorTotal),
    impuestosDesglosados: parsed.impuestosDesglosados === null ? "null" : String(parsed.impuestosDesglosados),
    tasaIsv: String(parsed.tasaIsv),
  };
  return ejecutarUna(
    "validar_fiscal",
    parsed,
    ValidarFiscalOutputSchema,
    () => vars,
    getTimeout("validar_fiscal"),
  );
}