// assessment_requerimiento — Portal de Compras BIA
// Fuente: doc 16 (función del agente) + PRD RF-12…18. Contrato tipado listo para la IA (Sprint 3).
// IA principal con fallback determinístico por reglas de catálogo.
import type { CampoCatalogo } from "./types";
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
  const { camposCapturados, camposDisponiblesCatalogo, subtipo, titulo, descripcion } = input;
  const respondidos = new Set(camposCapturados.map((c) => c.campoKey));
  const preguntas: PreguntaAssessment[] = [];

  // El producto/servicio en contexto: las preguntas se redactan sobre ÉL, no como labels.
  const queEs = (titulo || descripcion || "").trim().split(/[.\n]/)[0]?.trim().slice(0, 60) || "lo que necesitás";

  // Campos que el wizard ya cubre con controles propios (no preguntarlos de nuevo).
  const CUBIERTOS_POR_UI = new Set(["archivo_logo", "marca_branding"]);
  // Campos de rubro: solo aplican según subtipo (antes aparecían "Alcance del servicio,
  // Lugar de prestación, Periodicidad" en solicitudes de PRODUCTO).
  const SOLO_SERVICIO = new Set([
    "alcance_servicio",
    "lugar_prestacion",
    "periodicidad",
    "duracion_contrato",
    "cobertura_geografica",
    "visita_sitio",
  ]);
  const SOLO_PRODUCTO = new Set(["dimensiones", "materiales"]);

  const plantilla: Record<string, (p: string) => string> = {
    dimensiones: (p) => `¿Qué dimensiones debe tener ${p} (alto x ancho x fondo o medidas estándar)?`,
    materiales: (p) => `¿De qué material o composición debe ser ${p}?`,
    cantidad: (p) => `¿Cuántas unidades de ${p} necesitás?`,
    color_acabado: (p) => `¿Qué color o acabado debe tener ${p}?`,
    calidad: (p) => `¿Qué nivel de calidad esperás de ${p} (estándar o premium)?`,
    plazo_entrega: (p) => `¿Para cuándo necesitás recibir ${p}?`,
    forma_pago: (p) => `¿Qué forma de pago preferís para esta compra?`,
    garantias: (p) => `¿Qué garantía debe ofrecer el proveedor de ${p}?`,
    precio_maximo: () => `¿Tenés un precio máximo o presupuesto tope?`,
    credito_dias: () => `¿Cuántos días de crédito necesitás?`,
    opciones_a_cotizar: (p) => `¿Querés que te coticen variantes u opciones de ${p}?`,
    documentacion_solicitada: () => `¿Qué documentación debe adjuntar el proveedor (RTN, ficha técnica, referencias)?`,
    alcance_servicio: (p) => `¿Cuál es el alcance exacto del servicio de ${p} (qué incluye y qué no)?`,
    lugar_prestacion: () => `¿En qué lugar o dirección se debe prestar el servicio?`,
    periodicidad: () => `¿Con qué periodicidad se necesita el servicio?`,
    duracion_contrato: () => `¿Por cuánto tiempo se necesita el servicio?`,
    modalidad_entrega: () => `¿Cómo debe ser la modalidad de entrega (por lotes, única, programada)?`,
    cobertura_geografica: () => `¿En qué zonas o sucursales se debe dar cobertura?`,
    visita_sitio: () => `¿El proveedor debe visitar el sitio o planta antes de cotizar?`,
  };

  const validos = camposDisponiblesCatalogo.filter((c) => {
    if (!c.activo || c.origen !== "assessment") return false;
    if (CUBIERTOS_POR_UI.has(c.campoKey)) return false;
    if (subtipo === "producto" && SOLO_SERVICIO.has(c.campoKey)) return false;
    if (subtipo === "servicio" && SOLO_PRODUCTO.has(c.campoKey)) return false;
    return true;
  });

  const ordenados = [...validos].sort((a, b) => {
    const peso = (k: CampoCatalogo) =>
      (k.obligatorio ? 0 : 1) + (k.validacion?.bloqueante ? 0 : 10);
    return peso(a) - peso(b);
  });

  for (const campo of ordenados) {
    if (preguntas.length >= MAX_PREGUNTAS) break;
    if (respondidos.has(campo.campoKey)) continue;

    // Sugerencias del catálogo (chips) cuando el campo tiene opciones definidas.
    const sugerencias = (campo.catalogoOpciones ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    preguntas.push({
      campoKey: campo.campoKey,
      pregunta: plantilla[campo.campoKey]?.(queEs) ?? `¿Podrías detallar ${campo.label.toLowerCase()} para ${queEs}?`,
      por_que: campo.ayuda ?? "Determina que los proveedores coticen de forma comparable.",
      critica: campo.obligatorio,
      sugerencias: sugerencias.length > 0 ? sugerencias : undefined,
    });
  }

  return {
    preguntas,
    contexto_investigado: "Assessment por reglas del catálogo.",
    sin_preguntas_pendientes: preguntas.length === 0,
    contexto_insuficiente: false,
    preguntas_contexto: [],
  };
}