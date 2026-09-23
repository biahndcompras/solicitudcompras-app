// assessment_requerimiento — Portal de Compras BIA
// Fuente: doc 16 (función del agente) + PRD RF-12…18. Contrato tipado listo para la IA (Sprint 3).
// IA principal con fallback determinístico por reglas de catálogo.
import type { CampoCatalogo } from "./types";
import { bloqueoB2Activo } from "./rules";
import { assessment as assessmentIA } from "@/lib/ai/orchestrator";

export type PreguntaAssessment = {
  campoKey: string;
  pregunta: string;
  por_que: string;
  critica: boolean;
  ejemplo_respuesta?: string;
  sugerencias?: string[];
};

export type ResultadoAssessment = {
  preguntas: PreguntaAssessment[];
  contexto_investigado: string;
  sin_preguntas_pendientes: boolean;
  contexto_insuficiente?: boolean;
  preguntas_contexto?: string[];
  camposPlantilla?: CampoCatalogo[];
};

export type AssessmentInput = {
  titulo?: string;
  descripcion?: string;
  categoria?: string;
  camposCapturados: { campoKey: string; valor?: string }[];
  camposDisponiblesCatalogo: CampoCatalogo[];
  tipo?: string;
  subtipo?: string;
  llevaBranding?: boolean;
  archivoLogo?: string;
};

const MAX_PREGUNTAS = 10;

export async function assessment_requerimiento(input: AssessmentInput): Promise<ResultadoAssessment> {
  // Sin catálogo no hay campos que preguntar; fallback directo (no gasta llamada IA).
  if (!input.camposDisponiblesCatalogo || input.camposDisponiblesCatalogo.length === 0) {
    return assessmentFallback(input);
  }

  try {
    const iaCatalogo = input.camposDisponiblesCatalogo.filter((c) => c.activo && c.origen === "assessment");
    const camposCapturadosObj: Record<string, unknown> = {};
    for (const c of input.camposCapturados) {
      if (c.valor) camposCapturadosObj[c.campoKey] = c.valor;
    }

    const iaResultado = await assessmentIA({
      titulo: input.titulo ?? "",
      descripcion: input.descripcion ?? "",
      tipo: (input.tipo ?? "RFQ") as "RFI" | "RFQ" | "RFP",
      subtipo: (input.subtipo ?? "producto") as "producto" | "servicio" | "mixto",
      // Categoría REAL del pedido (antes se mandaba seccionPdf del primer campo del
      // catálogo y la IA razonaba a ciegas).
      categoria: input.categoria ?? "general",
      camposCapturados: camposCapturadosObj,
      catalogo: iaCatalogo.map((c) => ({
        campoKey: c.campoKey,
        label: c.label,
        ayuda: c.ayuda,
        tipoDato: c.tipoDato,
        obligatorio: c.obligatorio,
        origen: c.origen,
        seccionPdf: c.seccionPdf,
        orden: c.orden,
        activo: c.activo,
      })),
    });

    if (iaResultado && (iaResultado.preguntas.length > 0 || iaResultado.contexto_insuficiente)) {
      return {
        preguntas: iaResultado.preguntas.map((p) => ({
          campoKey: p.campoKey,
          pregunta: p.pregunta,
          por_que: p.por_que,
          critica: p.critica,
          ejemplo_respuesta: p.ejemplo_respuesta || undefined,
          sugerencias: p.sugerencias?.length ? p.sugerencias : undefined,
        })),
        contexto_investigado: iaResultado.contexto_investigado,
        sin_preguntas_pendientes: iaResultado.sin_preguntas_pendientes,
        contexto_insuficiente: iaResultado.contexto_insuficiente,
        preguntas_contexto: iaResultado.preguntas_contexto,
      };
    }
  } catch {
    // IA falló → fallback determinístico
  }

  return assessmentFallback(input);
}

export function assessmentFallback(input: AssessmentInput): ResultadoAssessment {
  const { camposCapturados, camposDisponiblesCatalogo, llevaBranding, archivoLogo } = input;
  const respondidos = new Set(camposCapturados.map((c) => c.campoKey));
  const preguntas: PreguntaAssessment[] = [];

  const validos = camposDisponiblesCatalogo.filter(
    (c) => c.activo && c.origen === "assessment"
  );

  const ordenados = [...validos].sort((a, b) => {
    const peso = (k: CampoCatalogo) =>
      (k.obligatorio ? 0 : 1) + (k.validacion?.bloqueante ? 0 : 10);
    return peso(a) - peso(b);
  });

  for (const campo of ordenados) {
    if (preguntas.length >= MAX_PREGUNTAS) break;
    if (respondidos.has(campo.campoKey)) continue;

    const esLogo = campo.campoKey === "archivo_logo";
    const criticaPorBranding =
      esLogo && bloqueoB2Activo({ llevaBranding, archivoLogo });

    preguntas.push({
      campoKey: campo.campoKey,
      pregunta: campo.label,
      por_que: campo.ayuda ?? "Determina que los proveedores coticen de forma comparable.",
      critica: campo.obligatorio || criticaPorBranding,
    });
  }

  return {
    preguntas,
    contexto_investigado: "Assessment por reglas del catálogo.",
    sin_preguntas_pendientes: preguntas.length === 0,
  };
}