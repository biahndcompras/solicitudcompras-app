// Generador de PDF con pdfme — Portal de Compras BIA.
// Recibe una plantilla declarativa JSON (genérica/reemplazable) e inputs, y devuelve el Buffer.
import { generate } from "@pdfme/generator";
import { text, line } from "@pdfme/schemas";
import type { Solicitud } from "@/lib/domain/types";
import { createTemplate } from "./plantilla-generica";

export type DocGenerado = {
  buffer: Uint8Array;
  tipo: string;
  referencia: string;
};

// Fuente fallback embebida para que el texto se dibuje en el PDF (pdfme requiere una fuente).
let fontCache: Promise<{ Roboto: { data: Uint8Array<ArrayBuffer>; fallback: boolean } } | null> | null = null;

function getFont() {
  if (!fontCache) {
    fontCache = (async () => {
      const path = process.env.PDF_FONT_PATH || "assets/Geist-Regular.ttf";
      const data = await import("node:fs/promises").then((fs) => fs.readFile(path));
      const u8 = Uint8Array.from(data) as Uint8Array<ArrayBuffer>;
      return { Roboto: { data: u8, fallback: true } };
    })().catch(() => null);
  }
  return fontCache;
}

export async function generarDocumento(opts: {
  tipo: "RFI" | "RFQ" | "RFP";
  solicitud: Solicitud;
  respuestas: Record<string, string>;
  coordenadorNombre?: string;
  fechaLimite?: string;
}): Promise<DocGenerado> {
  const { tipo, solicitud, respuestas, coordenadorNombre, fechaLimite } = opts;

  const campos = Object.entries(respuestas)
    .map(([k, v]) => `${k}: ${v || "no especificado"}`)
    .join("\n") || "Sin campos adicionales";

  const inputs: Record<string, string> = {
    referencia: solicitud.numeroReferencia ?? "SIN-REF",
    tipo,
    area: solicitud.areaSolicitante ?? "no especificado",
    solicitante: solicitud.solicitanteNombre,
    coordinadorAsignado: coordenadorNombre ?? "no especificado",
    fechaLimite: fechaLimite ?? solicitud.fechaRequerida ?? "no especificado",
    fechaLimiteHeader: fechaLimite ?? solicitud.fechaRequerida ?? "no especificado",
    titulo: solicitud.titulo,
    descripcion: solicitud.descripcion ?? "no especificado",
    campos,
  };

  const template = createTemplate(tipo) as unknown as Parameters<typeof generate>[0]["template"];

  // pdfme 6: generate({ template, inputs, plugins, options: { font } })
  const font = await getFont();
  const buffer = await generate({
    template,
    inputs: [inputs],
    plugins: { text, line },
    options: font ? { font } : undefined,
  });

  return { buffer, tipo, referencia: inputs.referencia };
}