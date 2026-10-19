import { NextResponse } from "next/server";
import { convertirDocumentoAMarkdown } from "@/lib/ai/conversion";

// Conversión de documento (PDF/imagen) a Markdown para la carga de cotizaciones del coordinador.
//
// Se hace con un modelo multimodal de OpenRouter. Antes dependía de `python3` + `markitdown`,
// que no existen en Vercel: en producción **siempre** fallaba y el coordinador cargaba a mano.
// Ahora no hay binarios ni archivos temporales: los bytes van directo al modelo.
//
// Si la IA no está disponible o falla, se responde 503 y el frontend degrada a carga manual
// (la IA nunca bloquea el trabajo del coordinador).

const MAX_BYTES = 4 * 1024 * 1024;
const MIMES = ["image/png", "image/jpeg", "application/pdf"];

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
    // El navegador manda el MIME; si viene vacío o raro, el tipo real lo decide la extensión
    // dentro de `convertirDocumentoAMarkdown` (una imagen renombrada no cuela como PDF).
    if (archivo.type && !MIMES.includes(archivo.type)) {
      return NextResponse.json(
        { error: "Formato no soportado. Se aceptan PDF, PNG o JPG." },
        { status: 415 }
      );
    }

    const res = await convertirDocumentoAMarkdown({
      bytes: new Uint8Array(await archivo.arrayBuffer()),
      nombre: archivo.name,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true, markdown: res.markdown });
  } catch {
    return NextResponse.json({ error: "Error procesando el archivo" }, { status: 500 });
  }
}
