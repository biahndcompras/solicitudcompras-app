// /api/convertir — la conversión que el coordinador usa al cargar una cotización.
//
// Lo que se fija: si la IA no está o falla, la ruta responde 503 y el frontend **degrada a
// carga manual** (la IA nunca bloquea). Y que un archivo de tipo o tamaño inválido se rechace
// antes de gastar una llamada al modelo.
import { describe, it, expect, vi, beforeEach } from "vitest";

const convertir = vi.fn();
vi.mock("@/lib/ai/conversion", () => ({
  convertirDocumentoAMarkdown: (...a: unknown[]) => convertir(...a),
}));

import JSZip from "jszip";
import { POST } from "./route";

// Se le da al route solo lo que consume (`formData()`), por el choque de realms entre el
// `FormData` de jsdom y el `Request` de Node (el multipart no se puede parsear). El archivo sí
// es un `File` real (la ruta lo exige con `instanceof`), con las propiedades propias porque el
// `File` de jsdom no implementa `arrayBuffer()`, que es lo que la ruta usa para leerlo.
function archivoFalso(nombre: string, size: number, type: string, contenido?: Uint8Array): File {
  const f = Object.create(File.prototype) as File;
  const bytes = contenido ?? new Uint8Array([1, 2, 3]);
  Object.defineProperties(f, {
    name: { value: nombre },
    size: { value: size },
    type: { value: type },
    arrayBuffer: {
      value: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    },
  });
  return f;
}

function pedirCon(archivo: File | null) {
  const req = {
    formData: async () => ({ get: (k: string) => (k === "archivo" ? archivo : null) }),
  } as unknown as Request;
  return POST(req);
}

const ARCHIVO = () => archivoFalso("cotizacion.pdf", 1200, "application/pdf");

beforeEach(() => {
  convertir.mockReset().mockResolvedValue({ ok: true, markdown: "| Item |\n| --- |" });
});

describe("POST /api/convertir", () => {
  it("sin archivo responde 400", async () => {
    const res = await pedirCon(null);
    expect(res.status).toBe(400);
    expect(convertir).not.toHaveBeenCalled();
  });

  it("un tipo no soportado responde 415 sin llamar al modelo", async () => {
    const res = await pedirCon(archivoFalso("nota.txt", 1200, "text/plain"));
    expect(res.status).toBe(415);
    expect(convertir).not.toHaveBeenCalled();
  });

  it("un archivo mayor a 4 MB responde 413 sin llamar al modelo", async () => {
    const res = await pedirCon(archivoFalso("cotizacion.pdf", 4 * 1024 * 1024 + 1, "application/pdf"));
    expect(res.status).toBe(413);
    expect(convertir).not.toHaveBeenCalled();
  });

  it("si la conversión falla responde 503 (para que el frontend degrade a carga manual)", async () => {
    convertir.mockResolvedValue({ ok: false, error: "No se pudo convertir el documento" });
    const res = await pedirCon(ARCHIVO());
    expect(res.status).toBe(503);
  });

  it("convierte y devuelve el Markdown", async () => {
    const res = await pedirCon(ARCHIVO());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, markdown: expect.stringContaining("Item") });
  });
});


// 4.5.1 ampliado: Word y PowerPoint no pasan por la IA (son ZIP con XML).
describe("POST /api/convertir · Word y PowerPoint", () => {
  async function docx(parrafos: string[]): Promise<Uint8Array> {
    const zip = new JSZip();
    const body = parrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
    zip.file("word/document.xml", `<w:document><w:body>${body}</w:body></w:document>`);
    return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
  }

  it("extrae el texto de un .docx sin llamar al modelo", async () => {
    const bytes = await docx(["Ferretería La Económica", "Total L 37,030.00"]);
    const res = await pedirCon(
      archivoFalso("cotizacion.docx", bytes.byteLength, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.markdown).toContain("Total L 37,030.00");
    expect(convertir).not.toHaveBeenCalled();
  });

  it("rechaza .doc (formato viejo) con una instrucción clara", async () => {
    const res = await pedirCon(archivoFalso("cotizacion.doc", 100, "application/msword"));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toMatch(/docx/i);
    expect(convertir).not.toHaveBeenCalled();
  });
});
