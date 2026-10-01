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
  /**
   * Campos que la plantilla del RFQ ya renderiza en su propio bloque ("Información
   * comercial"). Si uno de ellos fuese obligatorio, forzarlo como pregunta lo duplicaría
   * en pantalla: dos inputs atados al mismo `campoKey`.
   */
  camposYaPreguntados?: string[];
  tipo?: string;
  subtipo?: string;
  llevaBranding?: boolean;
  archivoLogo?: string;
};

const MAX_PREGUNTAS = 10;

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

const PLANTILLA_PREGUNTA: Record<string, (p: string) => string> = {
  dimensiones: (p) => `¿Qué dimensiones debe tener ${p} (alto x ancho x fondo o medidas estándar)?`,
  materiales: (p) => `¿De qué material o composición debe ser ${p}?`,
  cantidad: (p) => `¿Cuántas unidades de ${p} necesitás?`,
  color_acabado: (p) => `¿Qué color o acabado debe tener ${p}?`,
  calidad: (p) => `¿Qué nivel de calidad esperás de ${p} (estándar o premium)?`,
  plazo_entrega: (p) => `¿Para cuándo necesitás recibir ${p}?`,
  forma_pago: () => `¿Qué forma de pago preferís para esta compra?`,
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

/** El producto/servicio en contexto: las preguntas se redactan sobre ÉL, no como labels. */
function queEsDe(input: AssessmentInput): string {
  return (input.titulo || input.descripcion || "").trim().split(/[.\n]/)[0]?.trim().slice(0, 60) || "lo que necesitás";
}

/** Campos del catálogo que le aplican a esta solicitud, según subtipo y cobertura de la UI. */
function camposAplicables(campos: CampoCatalogo[], subtipo?: string): CampoCatalogo[] {
  return campos.filter((c) => {
    if (!c.activo || c.origen !== "assessment") return false;
    if (CUBIERTOS_POR_UI.has(c.campoKey)) return false;
    if (subtipo === "producto" && SOLO_SERVICIO.has(c.campoKey)) return false;
    if (subtipo === "servicio" && SOLO_PRODUCTO.has(c.campoKey)) return false;
    return true;
  });
}

function sugerenciasDe(campo: CampoCatalogo): string[] {
  return (campo.catalogoOpciones ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

function preguntaDeCampo(campo: CampoCatalogo, queEs: string): PreguntaAssessment {
  return {
    campoKey: campo.campoKey,
    pregunta: PLANTILLA_PREGUNTA[campo.campoKey]?.(queEs) ?? `¿Podrías detallar ${campo.label.toLowerCase()} para ${queEs}?`,
    por_que: campo.ayuda ?? "Determina que los proveedores coticen de forma comparable.",
    critica: campo.obligatorio,
    sugerencias: sugerenciasDe(campo).length > 0 ? sugerenciasDe(campo) : undefined,
  };
}

/**
 * La IA decide QUÉ es relevante, pero no manda sobre lo que ya se preguntó ni sobre lo
 * obligatorio. Tres reglas, en este orden:
 *
 * 1. Un `campoKey` que la plantilla del RFQ ya renderiza ("Información comercial") se
 *    descarta: si no, el solicitante ve la misma pregunta dos veces, con dos inputs
 *    atados al mismo `assessmentRespuestas[campoKey]`.
 * 2. `critica` se recalcula contra el catálogo: la obligatoriedad la define la
 *    configuración, no el criterio del modelo.
 * 3. Todo campo `obligatorio` sin responder se pregunta, aunque el modelo lo omitiera por
 *    considerarlo derivable del texto. Sin esto el coordinador recibía RFQs sin fecha de
 *    entrega ni condiciones de pago.
 */
export function consolidarPreguntas(
  preguntas: PreguntaAssessment[],
  input: AssessmentInput
): PreguntaAssessment[] {
  const queEs = queEsDe(input);
  const respondidos = new Set(input.camposCapturados.filter((c) => c.valor).map((c) => c.campoKey));
  const porClave = new Map(camposAplicables(input.camposDisponiblesCatalogo, input.subtipo).map((c) => [c.campoKey, c]));
  const enPlantilla = new Set(input.camposYaPreguntados ?? []);

  // La IA puede devolver la misma clave dos veces: la primera gana.
  const vistas = new Set<string>();
  const normalizadas = preguntas
    .filter((p) => {
      if (enPlantilla.has(p.campoKey) || vistas.has(p.campoKey)) return false;
      vistas.add(p.campoKey);
      return true;
    })
    .map((p) => {
      const campo = porClave.get(p.campoKey);
      if (!campo) return p;
      const opciones = sugerenciasDe(campo);
      return {
        ...p,
        critica: campo.obligatorio,
        sugerencias: p.sugerencias?.length ? p.sugerencias : opciones.length ? opciones : undefined,
      };
    });

  const agregadas = [...porClave.values()]
    .filter((c) => c.obligatorio && !respondidos.has(c.campoKey) && !vistas.has(c.campoKey) && !enPlantilla.has(c.campoKey))
    .map((c) => preguntaDeCampo(c, queEs));

  // El tope de 10 es una cortesía de pantalla, no una regla de datos: se recorta lo que la IA
  // pidió de más y NUNCA a un obligatorio. Recortar un obligatorio lo vuelve invisible —el
  // solicitante no lo ve y el aviso no lo lista— y el RFQ llega sin él en silencio.
  const presupuestoIA = Math.max(0, MAX_PREGUNTAS - agregadas.length);
  return [...normalizadas.slice(0, presupuestoIA), ...agregadas];
}

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
      const preguntas = consolidarPreguntas(
        iaResultado.preguntas.map((p) => ({
          campoKey: p.campoKey,
          pregunta: p.pregunta,
          por_que: p.por_que,
          critica: p.critica,
          ejemplo_respuesta: p.ejemplo_respuesta || undefined,
          sugerencias: p.sugerencias?.length ? p.sugerencias : undefined,
        })),
        input
      );
      return {
        preguntas,
        contexto_investigado: iaResultado.contexto_investigado,
        sin_preguntas_pendientes: preguntas.length === 0,
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
  const { camposCapturados, camposDisponiblesCatalogo, titulo, descripcion } = input;
  const respondidos = new Set(camposCapturados.map((c) => c.campoKey));
  const preguntas: PreguntaAssessment[] = [];

  const queEs = (titulo || descripcion || "").trim().split(/[.\n]/)[0]?.trim().slice(0, 60) || "lo que necesitás";

  const ordenados = [...camposAplicables(camposDisponiblesCatalogo, input.subtipo)].sort((a, b) => {
    const peso = (k: CampoCatalogo) =>
      (k.obligatorio ? 0 : 1) + (k.validacion?.bloqueante ? 0 : 10);
    return peso(a) - peso(b);
  });

  for (const campo of ordenados) {
    if (preguntas.length >= MAX_PREGUNTAS) break;
    if (respondidos.has(campo.campoKey)) continue;
    preguntas.push(preguntaDeCampo(campo, queEs));
  }

  return {
    preguntas,
    contexto_investigado: "Assessment por reglas del catálogo.",
    sin_preguntas_pendientes: preguntas.length === 0,
    contexto_insuficiente: false,
    preguntas_contexto: [],
  };
}
