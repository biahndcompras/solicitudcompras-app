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

import { POST } from "./route";

// Se le da al route solo lo que consume (`formData()`), por el choque de realms entre el
// `FormData` de jsdom y el `Request` de Node (el multipart no se puede parsear). El archivo sí
// es un `File` real (la ruta lo exige con `instanceof`), con las propiedades propias porque el
// `File` de jsdom no implementa `arrayBuffer()`, que es lo que la ruta usa para leerlo.
function archivoFalso(nombre: string, size: number, type: string): File {
  const f = Object.create(File.prototype) as File;
  Object.defineProperties(f, {
    name: { value: nombre },
    size: { value: size },
    type: { value: type },
    arrayBuffer: { value: async () => new Uint8Array([1, 2, 3]).buffer },
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
    const res = await pedirCon(archivoFalso("nota.docx", 1200, "application/msword"));
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
