// Conversión de un documento (PDF o imagen) a Markdown, con un modelo multimodal de OpenRouter.
//
// Antes esto dependía de `python3` + `markitdown` (`lib/pdf/convert.ts` + el script), que **no
// existen en el runtime de Vercel**: en producción la conversión fallaba siempre y el
// coordinador terminaba cargando los datos a mano. Además el helper ejecutaba el script **dos
// veces** y descartaba la primera salida.
//
// Por qué un modelo multimodal y no una librería de extracción de texto en JS:
//  · la app acepta PDF **y también** PNG/JPG, y las cotizaciones suelen llegar **escaneadas o
//    fotografiadas**; un extractor de texto no ve nada ahí y no cubre las imágenes;
//  · es un solo camino para los tres tipos, sin binarios ni `canvas`/workers en serverless;
//  · ya se usaba OpenRouter para el resto de la IA, así que no se agrega infraestructura.
// Verificado en vivo el 2026-10-17: imagen y PDF devuelven Markdown con todos los montos.
//
// El texto nunca decide nada por sí solo (RN-01): esto solo transcribe. El resultado lo revisa
// y corrige el coordinador en la pantalla de carga, que es donde ya se validaba a mano.
import {
  getFallbackModel,
  getModel,
  llamarOpenRouter,
  type OpenRouterContentPart,
} from "./client";

export type ResultadoConversion =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

/** Igual que el tope que aplica la carga de archivos: no se manda más que esto al modelo. */
const MAX_BYTES = 4 * 1024 * 1024;

const MIME_POR_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

const PROMPT =
  "Eres un asistente que transcribe cotizaciones de proveedores. " +
  "Convierte el documento a Markdown conservando TODO el contenido literal: nombres, " +
  "descripciones, cantidades, precios unitarios, subtotales, impuestos, totales, plazos, " +
  "monedas y condiciones. Usa una tabla Markdown si el original tiene columnas. " +
  "No interpretes, no resumas, no completes datos que no estén escritos: si algo está " +
  "ilegible, escribe [ilegible]. Devuelve SOLO el Markdown, sin comentarios ni bloques de código.";

function extensionDe(nombre: string): string {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

/**
 * Transcribe el documento a Markdown. Devuelve `ok: false` (nunca lanza) para que quien llama
 * pueda degradar a la carga manual: la conversión no debe bloquear el trabajo del coordinador.
 */
export async function convertirDocumentoAMarkdown(datos: {
  bytes: Uint8Array;
  nombre: string;
}): Promise<ResultadoConversion> {
  const ext = extensionDe(datos.nombre);
  const mime = MIME_POR_EXTENSION[ext];
  if (!mime) {
    return { ok: false, error: `Tipo de archivo no soportado (.${ext || "sin extensión"})` };
  }
  if (datos.bytes.byteLength === 0) {
    return { ok: false, error: "El archivo está vacío" };
  }
  if (datos.bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: "El archivo supera los 4 MB" };
  }

  const base64 = Buffer.from(datos.bytes).toString("base64");
  const dataUrl = `data:${mime};base64,${base64}`;
  const parte: OpenRouterContentPart =
    mime === "application/pdf"
      ? { type: "file", file: { filename: datos.nombre, file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: PROMPT }, parte] }];
  const timeoutMs = Number(process.env.IA_TIMEOUT_CONVERTIR) || 30000;
  const modelos = [getModel("convertir"), getFallbackModel()];

  for (const modelo of modelos) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await llamarOpenRouter({ model: modelo, messages, temperature: 0 }, controller.signal);
      const contenido = raw.choices?.[0]?.message?.content?.trim();
      if (contenido) return { ok: true, markdown: contenido };
      if (modelo === modelos[modelos.length - 1]) {
        return { ok: false, error: "El documento no contiene texto extraíble" };
      }
      console.warn(`[IA] convertir devolvió vacío con ${modelo}; reintentando con el fallback…`);
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      if (modelo === modelos[modelos.length - 1]) {
        console.warn(`[IA] convertir falló (modelo=${modelo}): ${detalle}`);
        return { ok: false, error: "No se pudo convertir el documento" };
      }
      console.warn(`[IA] convertir falló con ${modelo}: ${detalle} — reintentando…`);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: "No se pudo convertir el documento" };
}
