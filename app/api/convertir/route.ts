import { NextResponse } from "next/server";
import { convertirDocumentoAMarkdown } from "@/lib/ai/conversion";
import { extraerTextoOficina } from "@/lib/ai/oficina";

// Conversión de una cotización a texto para que la IA la parsee.
//
// Formatos que llegan de verdad: PDF, imagen (foto o captura), **Word** y **PowerPoint**.
//  · PDF e imágenes → modelo multimodal de OpenRouter (no hay Python en Vercel).
//  · .docx / .pptx → extracción de texto del ZIP, **sin IA**: es determinística y gratis.
//  · .doc / .ppt (binarios viejos) → se rechazan con una instrucción clara.
//
// Si algo falla, la ruta responde 503 y el coordinador carga la cotización a mano (la IA nunca
// bloquea el trabajo).

const MAX_BYTES = 4 * 1024 * 1024;
const EXT_IA = ["pdf", "png", "jpg", "jpeg"];
const EXT_OFICINA = ["docx", "pptx"];
const EXT_VIEJAS = ["doc", "ppt"];

function extension(nombre: string): string {
  const p = nombre.toLowerCase().split(".");
  return p.length > 1 ? p[p.length - 1] : "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const archivo = form.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });
    }
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo supera los 4 MB" }, { status: 413 });
    }

    const ext = extension(archivo.name);
    if (EXT_VIEJAS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Los archivos .${ext} (formato viejo de Office) no se pueden leer. Abralo y guardelo como .${ext === "doc" ? "docx" : "pptx"}, o suba un PDF.`,
        },
        { status: 415 }
      );
    }
    if (!EXT_IA.includes(ext) && !EXT_OFICINA.includes(ext)) {
      return NextResponse.json(
        { error: "Formato no soportado. Se aceptan PDF, imágenes, Word (.docx) y PowerPoint (.pptx)." },
        { status: 415 }
      );
    }

    const bytes = new Uint8Array(await archivo.arrayBuffer());

    if (EXT_OFICINA.includes(ext)) {
      try {
        const texto = await extraerTextoOficina(bytes, ext === "docx" ? ".docx" : ".pptx");
        if (!texto.trim()) {
          return NextResponse.json(
            { error: "El documento no parece contener texto. Si es una imagen, suba una captura." },
            { status: 422 }
          );
        }
        return NextResponse.json({ ok: true, markdown: texto });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "No se pudo leer el documento de Office." },
          { status: 422 }
        );
      }
    }

    // PDF o imagen: modelo multimodal.
    const res = await convertirDocumentoAMarkdown({ bytes, nombre: archivo.name });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true, markdown: res.markdown });
  } catch {
    return NextResponse.json({ error: "Error procesando el archivo" }, { status: 500 });
  }
}
