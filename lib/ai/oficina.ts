// Extracción de texto de Word (.docx) y PowerPoint (.pptx) — 4.5.1 ampliado.
//
// Una cotización puede llegar en Word o PowerPoint, no solo en PDF o imagen. Los formatos
// modernos son ZIP con XML dentro, así que se extrae el texto **sin IA**: es determinístico y
// no cuesta una llamada al modelo.
//
// Los formatos viejos (.doc / .ppt) son binarios OLE y no se pueden leer de forma confiable
// sin un conversor; la ruta los rechaza con una instrucción clara (guardar como .docx/.pptx).
import JSZip from "jszip";

function numeroDeSlide(nombre: string): number {
  const m = nombre.match(/slide(\d+)\.xml$/);
  return m ? Number(m[1]) : 0;
}

/** Convierte el XML de un documento en texto plano legible, conservando párrafos. */
function xmlATexto(xml: string): string {
  return xml
    // Saltos de párrafo (Word) y de párrafo (PowerPoint `a:p`).
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    // Tabulaciones y saltos de línea explícitos.
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<a:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<a:br\/>/g, "\n")
    // Fuera etiquetas.
    .replace(/<[^>]+>/g, "")
    // Entidades XML.
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // Espacios sobrantes por línea y líneas vacías repetidas.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extraerTextoOficina(
  bytes: Uint8Array,
  ext: ".docx" | ".pptx"
): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);

  if (ext === ".docx") {
    const doc = zip.file("word/document.xml");
    if (!doc) throw new Error("El archivo no parece un .docx válido (falta word/document.xml).");
    return xmlATexto(await doc.async("string"));
  }

  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => numeroDeSlide(a) - numeroDeSlide(b));
  if (slides.length === 0) {
    throw new Error("El archivo no parece un .pptx válido (no tiene diapositivas).");
  }

  const partes: string[] = [];
  for (const nombre of slides) {
    const f = zip.file(nombre);
    if (!f) continue;
    const texto = xmlATexto(await f.async("string"));
    if (texto) partes.push(`## Diapositiva ${numeroDeSlide(nombre)}\n\n${texto}`);
  }
  return partes.join("\n\n");
}
