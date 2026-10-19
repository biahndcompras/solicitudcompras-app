// Conversión de documento a Markdown (4.5.1).
//
// Lo que se fija: que el documento viaje a OpenRouter **como parte multimodal** (imagen o PDF),
// que es lo que reemplaza al `python3` + `markitdown` que no existe en Vercel. Si esto se
// rompiera, en producción la conversión fallaría siempre y el coordinador cargaría todo a mano
// sin que nada avise.
//
// Se intercepta `fetch` (como en `orchestrator.test.ts`) para inspeccionar el cuerpo real que
// se manda, en vez de mockear el módulo: así se prueba la integración con el cliente de IA.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { convertirDocumentoAMarkdown } from "./conversion";

let ultimoCuerpo: Record<string, unknown> | null = null;

function stubFetch(respuesta: unknown, status = 200) {
  return vi.fn(async (_url: string, init: { body: string }) => {
    ultimoCuerpo = JSON.parse(init.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => "",
      json: async () => respuesta,
    } as unknown as Response;
  });
}

const OK = { choices: [{ message: { content: "| Item | Total |\n| --- | --- |\n| Cemento | L 25,000.00 |" } }] };

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  ultimoCuerpo = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function partesEnviadas(): Array<Record<string, unknown>> {
  const msgs = ultimoCuerpo?.messages as Array<{ content: Array<Record<string, unknown>> }>;
  return msgs[0].content;
}

describe("conversión a Markdown · el documento viaja como parte multimodal", () => {
  it("una imagen viaja como image_url con data URL", async () => {
    vi.stubGlobal("fetch", stubFetch(OK));
    const res = await convertirDocumentoAMarkdown({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      nombre: "cotizacion.png",
    });
    expect(res.ok).toBe(true);
    const parte = partesEnviadas().find((p) => p.type === "image_url");
    expect(parte).toBeTruthy();
    expect((parte!.image_url as { url: string }).url).toMatch(/^data:image\/png;base64,/);
  });

  it("un PDF viaja como file (no como imagen)", async () => {
    vi.stubGlobal("fetch", stubFetch(OK));
    await convertirDocumentoAMarkdown({ bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), nombre: "cotizacion.pdf" });
    const parte = partesEnviadas().find((p) => p.type === "file");
    expect(parte).toBeTruthy();
    expect((parte!.file as { file_data: string }).file_data).toMatch(/^data:application\/pdf;base64,/);
  });

  it("devuelve el Markdown tal cual (transcribe, no interpreta)", async () => {
    vi.stubGlobal("fetch", stubFetch(OK));
    const res = await convertirDocumentoAMarkdown({ bytes: new Uint8Array([1, 2, 3]), nombre: "c.jpg" });
    expect(res).toEqual({ ok: true, markdown: expect.stringContaining("L 25,000.00") });
  });
});

describe("conversión a Markdown · no rompe el trabajo del coordinador", () => {
  it("un tipo no soportado falla sin llamar al modelo", async () => {
    const fetchMock = stubFetch(OK);
    vi.stubGlobal("fetch", fetchMock);
    const res = await convertirDocumentoAMarkdown({ bytes: new Uint8Array([1]), nombre: "nota.txt" });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un archivo mayor a 4 MB se rechaza sin llamar al modelo", async () => {
    const fetchMock = stubFetch(OK);
    vi.stubGlobal("fetch", fetchMock);
    const res = await convertirDocumentoAMarkdown({
      bytes: new Uint8Array(4 * 1024 * 1024 + 1),
      nombre: "grande.png",
    });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si el modelo devuelve vacío, reintenta con el fallback y termina en error (no en blanco)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "", json: async () => ({ choices: [{ message: { content: "   " } }] }) }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    const res = await convertirDocumentoAMarkdown({ bytes: new Uint8Array([1]), nombre: "c.png" });
    expect(res.ok).toBe(false);
    // Dos intentos: modelo primario + fallback.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("si la red falla, devuelve error en vez de lanzar (para poder degradar a carga manual)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("sin red"); }));
    const res = await convertirDocumentoAMarkdown({ bytes: new Uint8Array([1]), nombre: "c.png" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBeTruthy();
  });
});
