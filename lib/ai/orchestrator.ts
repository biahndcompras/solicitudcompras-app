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

  const modelos = [getModel(funcion), getFallbackModel()];

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
      const detalle = e instanceof Error ? e.message : String(e);
      if (modelo === modelos[modelos.length - 1]) {
        console.warn(`[IA] ${funcion} falló (modelo=${modelo}): ${detalle}`);
        return null;
      }
      console.warn(`[IA] ${funcion} falló con ${modelo}: ${detalle} — reintentando con ${getFallbackModel()}…`);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

// Re-mapea un campoKey devuelto por la IA al catálogo vigente (tolerante a variantes
// como "Material" vs "materiales" o "color" vs "color_acabado"). Antes, un solo campoKey
// no exacto hacía descartar la pregunta EN SILENCIO y el usuario caía al fallback genérico.
export function resolverCampoKey(clave: string, catalogo: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const exacta = catalogo.find((c) => c === clave);
  if (exacta) return exacta;
  const n = norm(clave);
  const porNorm = catalogo.find((c) => norm(c) === n);
  if (porNorm) return porNorm;
  const porContencion = catalogo.find((c) => {
    const cn = norm(c);
    return cn.includes(n) || n.includes(cn);
  });
  return porContencion ?? null;
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
  // RN-02: todo campoKey debe existir en el catálogo vigente — pero se intenta
  // re-mapear variantes antes de descartar, y lo descartado queda en el log.
  const catalogoClaves = [...clavesValidas];
  const preguntas: typeof salida.preguntas = [];
  const descartadas: string[] = [];
  for (const p of salida.preguntas) {
    const resuelta = resolverCampoKey(p.campoKey, catalogoClaves);
    if (resuelta) {
      preguntas.push({ ...p, campoKey: resuelta });
    } else {
      descartadas.push(p.campoKey);
    }
  }
  if (descartadas.length > 0) {
    console.warn(`[IA] assessment: ${descartadas.length} pregunta(s) descartada(s) por campoKey fuera del catálogo: ${descartadas.join(", ")}`);
  }
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