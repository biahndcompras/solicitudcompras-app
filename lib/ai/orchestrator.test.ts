import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clasificar, assessment, extraerCotizacion, comparativa, validarFiscal } from "./orchestrator";

function mockOpenRouterResponde(contenido: unknown, _status = 200) {
  return vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 1));
    return {
      ok: _status >= 200 && _status < 300,
      status: _status,
      text: async () => (_status >= 200 && _status < 300 ? "" : JSON.stringify({ error: "boom" })),
      json: async () => ({ choices: [{ message: { content: JSON.stringify(contenido) } }] }),
    } as Response;
  });
}

describe("Orquestador IA", () => {
  let prevKey: string | undefined;
  let prevModel: string | undefined;

  beforeEach(() => {
    prevKey = process.env.OPENROUTER_API_KEY;
    prevModel = process.env.IA_MODEL;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.IA_TIMEOUT_CLASIFICAR = "500";
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = prevKey;
    process.env.IA_MODEL = prevModel;
    vi.restoreAllMocks();
  });

  it("clasificar devuelve salida tipada con JSON válido", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      tipo: "RFQ",
      subtipo: "producto",
      confianza: 0.92,
      razonamiento_breve: "Producto estándar con precio definido.",
    }));
    const res = await clasificar({ titulo: "Camisetas", descripcion: "5000 unidades", categoria: "empaque" });
    expect(res?.tipo).toBe("RFQ");
    expect(res?.subtipo).toBe("producto");
    expect(res?.confianza).toBeCloseTo(0.92);
  });

  it("clasificar devuelve null si la salida no es JSON válido", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde("esto no es json"));
    const res = await clasificar({ titulo: "x", descripcion: "", categoria: "" });
    expect(res).toBeNull();
  });

  it("intenta el modelo fallback si el principal falla", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        return { ok: false, status: 500, text: async () => "error", json: async () => ({}) } as Response;
      })
      .mockImplementationOnce(mockOpenRouterResponde({
        tipo: "RFP",
        subtipo: "servicio",
        confianza: 0.8,
        razonamiento_breve: "Servicio a medida.",
      }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await clasificar({ titulo: "Auditoría", descripcion: "", categoria: "" });
    expect(res?.tipo).toBe("RFP");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("assessment filtra campoKey fuera del catálogo", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      preguntas: [
        { campoKey: "material", pregunta: "¿Material?", por_que: "Para cotizar", critica: false },
        { campoKey: "inventado_fuera", pregunta: "¿?", por_que: "?", critica: false },
      ],
      contexto_investigado: "test",
      sin_preguntas_pendientes: false,
    }));
    const res = await assessment({
      titulo: "Pelota de fútbol",
      descripcion: "Pelota de futbol para una actividad de marketing",
      tipo: "RFQ",
      subtipo: "producto",
      categoria: "materia_prima",
      camposCapturados: {},
      catalogo: [{
        campoKey: "material", label: "Material", tipoDato: "texto", obligatorio: false,
        origen: "assessment", orden: 1, activo: true,
      }],
    });
    expect(res?.preguntas.map((p) => p.campoKey)).toEqual(["material"]);
  });

  it("assessment propaga contexto_insuficiente y trunca sugerencias largas", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      preguntas: [
        {
          campoKey: "material",
          pregunta: "¿Material?",
          por_que: "Para cotizar",
          critica: false,
          sugerencias: ["x".repeat(200), "cuero sintético TPU"],
        },
      ],
      contexto_investigado: "",
      sin_preguntas_pendientes: false,
      contexto_insuficiente: true,
      preguntas_contexto: ["¿Para qué se usará?", "¿Qué tamaño necesitás?"],
    }));
    const res = await assessment({
      titulo: "???",
      descripcion: "una cosa",
      tipo: "RFQ",
      subtipo: "producto",
      categoria: "otra",
      camposCapturados: {},
      catalogo: [{
        campoKey: "material", label: "Material", tipoDato: "texto", obligatorio: false,
        origen: "assessment", orden: 1, activo: true,
      }],
    });
    expect(res?.contexto_insuficiente).toBe(true);
    expect(res?.preguntas_contexto).toHaveLength(2);
    expect(res?.preguntas[0].sugerencias?.[0].length).toBeLessThanOrEqual(80);
  });

  it("extraerCotizacion extrae los campos con confianza", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      proveedorNombre: "CostaPrint",
      valorNeto: 86000,
      moneda: "HNL",
      impuestosDesglosados: true,
      montoIsv: 12900,
      valorTotal: 98900,
      plazoEntrega: "12 días",
      especificacionesOfertadas: { material: "poliéster" },
      ilegible: false,
      confianzaPorCampo: { valorNeto: 0.95, valorTotal: 0.94 },
    }));
    const res = await extraerCotizacion({
      markdown: "Cotización 1",
      especificacionesSolicitadas: {},
    });
    expect(res?.proveedorNombre).toBe("CostaPrint");
    expect(res?.valorTotal).toBe(98900);
    expect(res?.confianzaPorCampo.valorNeto).toBeGreaterThan(0.5);
  });

  it("comparativa devuelve sugerencia razonada", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      discrepanciasDetectadas: [],
      prosContras: {},
      sugerenciaIA: "CostaPrint ofrece el menor total.",
      cotizacionSugeridaId: "c1",
      advertenciaGeneral: null,
    }));
    const res = await comparativa({
      tituloSolicitud: "Sombrillas",
      especificacionesSolicitadas: {},
      cotizaciones: [
        { proveedorNombre: "CostaPrint", valorNeto: 86000, moneda: "HNL", montoIsv: null, valorTotal: 98900, plazoEntrega: "12 días", especificacionesOfertadas: {} },
        { proveedorNombre: "PlayaPromo", valorNeto: 3150, moneda: "USD", montoIsv: null, valorTotal: 3150, plazoEntrega: "10 días", especificacionesOfertadas: {} },
      ],
    });
    expect(res?.cotizacionSugeridaId).toBe("c1");
    expect(res?.sugerenciaIA).toContain("CostaPrint");
  });

  it("devuelve null sin excepción cuando la clave no está", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(clasificar({ titulo: "x", descripcion: "", categoria: "" })).resolves.toBeNull();
  });

  it("validarFiscal devuelve la coherencia tipada con JSON válido", async () => {
    vi.stubGlobal("fetch", mockOpenRouterResponde({
      tratamiento_declarado: "incluye",
      coherencia_aritmetica: "correcta",
      observacion: null,
      requiere_aclaracion: false,
    }));
    const res = await validarFiscal({
      valorNeto: 100,
      montoIsv: 15,
      valorTotal: 115,
      impuestosDesglosados: true,
      tasaIsv: 0.15,
    });
    expect(res?.tratamiento_declarado).toBe("incluye");
    expect(res?.coherencia_aritmetica).toBe("correcta");
    expect(res?.requiere_aclaracion).toBe(false);
  });
});