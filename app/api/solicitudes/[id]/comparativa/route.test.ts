// 4.10.8 — La detección determinística de discrepancias no puede estar inerte.
//
// El motor compara `especificacionesSolicitadas` contra `especificacionesOfertadas` de cada
// cotización. Si la ruta pasa `{}` (como hacía), el detector recorre cero aspectos y NUNCA
// encuentra una discrepancia: sin IA configurada, el coordinador cree que todo coincide.
//
// Estos tests fijan que la ruta construye las especificaciones reales desde las respuestas
// del solicitante y que, con datos reales, el detector sí encuentra la discrepancia.
import { describe, it, expect, vi, beforeEach } from "vitest";

const obtenerSolicitud = vi.fn();
const listarCotizaciones = vi.fn();
const listarRespuestas = vi.fn();
const guardarComparativa = vi.fn();
const transicionarEstado = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    listarRespuestas = (...a: unknown[]) => listarRespuestas(...a);
    guardarComparativa = (...a: unknown[]) => guardarComparativa(...a);
    transicionarEstado = (...a: unknown[]) => transicionarEstado(...a);
  },
}));
vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));
// Sin IA: fuerza el camino determinístico (que es justo el que estaba inerte).
vi.mock("@/lib/ai/orchestrator", () => ({ comparativa: async () => null }));

import { POST } from "./route";

const SOL = "sol-1";
const params = Promise.resolve({ id: SOL });

function cot(id: string, nombre: string, ofertado: Record<string, string>) {
  return {
    id,
    solicitudId: SOL,
    proveedorNombre: nombre,
    formatoOriginal: "manual",
    especificacionesOfertadas: ofertado,
    confianzaExtraccion: {},
    editadaManualmente: false,
    fechaCarga: "2026-07-21T09:00:00Z",
  };
}

function post() {
  return POST(new Request(`http://localhost/api/solicitudes/${SOL}/comparativa`, { method: "POST" }), {
    params,
  });
}

beforeEach(() => {
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "coordinador", email: "c@bia.hn" } });
  obtenerSolicitud.mockReset().mockResolvedValue({ id: SOL, titulo: "Sombrillas", estado: "EN_COTIZACION" });
  guardarComparativa.mockReset().mockImplementation(async (_id: string, c: unknown) => c);
  transicionarEstado.mockReset().mockResolvedValue(undefined);
  listarRespuestas.mockReset().mockResolvedValue([
    { id: `${SOL}-materiales`, solicitudId: SOL, campoKey: "materiales", campoLabel: "Materiales", valor: "melamina", origen: "assessment" },
    { id: `${SOL}-dimensiones`, solicitudId: SOL, campoKey: "dimensiones", campoLabel: "Dimensiones", valor: "2.0 m", origen: "assessment" },
  ]);
  listarCotizaciones.mockReset().mockResolvedValue([
    // El proveedor declara "madera" con la clave variante que la IA suele devolver ("material").
    cot("c1", "Muebles A", { material: "madera maciza", dimensiones: "2.0 m" }),
    cot("c2", "Muebles B", { material: "melamina", dimensiones: "2.0 m" }),
  ]);
});

describe("comparativa · especificaciones reales del solicitante (4.10.8)", () => {
  it("encuentra la discrepancia entre lo pedido y lo ofrecido con datos reales", async () => {
    const res = await post();
    expect(res.status).toBe(200);

    const guardada = guardarComparativa.mock.calls[0][1] as {
      discrepanciasDetectadas: { aspecto: string }[];
    };
    // Con `especificacionesSolicitadas: {}` esta lista venía siempre vacía.
    expect(guardada.discrepanciasDetectadas.length).toBeGreaterThan(0);
    expect(guardada.discrepanciasDetectadas.map((d) => d.aspecto)).toContain("materiales");
  });

  it("lee las respuestas de la solicitud de la URL", async () => {
    await post();
    expect(listarRespuestas).toHaveBeenCalledWith(SOL);
  });

  it("sin respuestas guardadas no rompe ni inventa discrepancias", async () => {
    listarRespuestas.mockResolvedValue([]);

    const res = await post();

    expect(res.status).toBe(200);
    const guardada = guardarComparativa.mock.calls[0][1] as { discrepanciasDetectadas: unknown[] };
    expect(guardada.discrepanciasDetectadas).toEqual([]);
  });
});
