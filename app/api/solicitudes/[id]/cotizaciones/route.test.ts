// Alta de cotización (con archivo o manual) y guardrail de "no es una cotización" (4.13.17).
//
// Lo que se fija: si el texto extraído NO parece una cotización, se responde 422 y **no se
// guarda nada**. Antes se creaba la fila y luego se extraía: un contrato o una factura
// quedaban como una cotización vacía en la comparativa.
import { describe, it, expect, vi, beforeEach } from "vitest";

const guardarCotizacion = vi.fn();
const actualizarCotizacion = vi.fn();
const listarCotizaciones = vi.fn();
const guardApi = vi.fn();
const extraerCotizacion = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    guardarCotizacion = (...a: unknown[]) => guardarCotizacion(...a);
    actualizarCotizacion = (...a: unknown[]) => actualizarCotizacion(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
  },
}));
vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));
vi.mock("@/lib/ai/orchestrator", () => ({
  extraerCotizacion: (...a: unknown[]) => extraerCotizacion(...a),
}));

import { POST } from "./route";

const ID = "22222222-2222-4222-8222-222222222222";
const params = Promise.resolve({ id: ID });
const COT = {
  id: "c1",
  solicitudId: ID,
  proveedorNombre: "Proveedor",
  formatoOriginal: "docx",
  especificacionesOfertadas: {},
  confianzaExtraccion: {},
  editadaManualmente: false,
  fechaCarga: "2026-10-21T00:00:00Z",
};

const EXTRAIDA_OK = {
  proveedorNombre: "Ferretería La Económica",
  valorNeto: 32200,
  valorTotal: 37030,
  especificacionesOfertadas: {},
  confianzaPorCampo: { valorTotal: 0.95 },
  ilegible: false,
  esCotizacion: true,
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request(`http://localhost/api/solicitudes/${ID}/cotizaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  );
}

beforeEach(() => {
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "coordinador", email: "c@biafoods.co" } });
  guardarCotizacion.mockReset().mockResolvedValue(COT);
  actualizarCotizacion.mockReset().mockResolvedValue(COT);
  listarCotizaciones.mockReset().mockResolvedValue([COT]);
  extraerCotizacion.mockReset().mockResolvedValue(EXTRAIDA_OK);
});

describe("POST · guardrail «no parece una cotización» (4.13.17)", () => {
  it("rechaza con 422 y NO guarda si el documento no es una cotización", async () => {
    extraerCotizacion.mockResolvedValue({
      ...EXTRAIDA_OK,
      proveedorNombre: null,
      esCotizacion: false,
      motivoNoCotizacion: "Es un contrato de arrendamiento.",
    });

    const res = await post({ proveedorNombre: "X", formatoOriginal: "docx", markdownExtraido: "CONTRATO..." });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no parece una cotización/i);
    expect(guardarCotizacion).not.toHaveBeenCalled();
  });

  it("una cotización válida se guarda con los datos extraídos", async () => {
    const res = await post({ proveedorNombre: "Proveedor por definir", formatoOriginal: "docx", markdownExtraido: "COTIZACION..." });

    expect(res.status).toBe(201);
    expect(guardarCotizacion).toHaveBeenCalledWith(
      expect.objectContaining({ proveedorNombre: "Ferretería La Económica", valorTotal: 37030 })
    );
  });

  it("el alta manual no llama a la IA", async () => {
    const res = await post({ proveedorNombre: "Manual", formatoOriginal: "manual" });
    expect(res.status).toBe(201);
    expect(extraerCotizacion).not.toHaveBeenCalled();
  });

  it("acepta un PowerPoint como formato", async () => {
    const res = await post({ proveedorNombre: "Proveedor por definir", formatoOriginal: "pptx", markdownExtraido: "..." });
    expect(res.status).toBe(201);
  });
});
