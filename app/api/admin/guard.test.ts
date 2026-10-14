// 4.8.5 · rutas de admin/métricas que dependían SOLO del middleware.
// El middleware protege /api/admin/* y /api/metricas, pero eso no basta: si la ruta se
// invoca sin pasar por el matcher (o cambia el prefijo), queda abierta. Cada handler debe
// reforzar el rol con `guardApi(["admin"])`, como ya hace `reasignar`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarCoordinadores = vi.fn();
const metricasDashboard = vi.fn();
const listarTodas = vi.fn();
const listarCotizaciones = vi.fn();
const leerConfig = vi.fn();
const guardarConfig = vi.fn();
const informacionVencida = vi.fn();
const marcarRecordatorioInformacion = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
    metricasDashboard = (...a: unknown[]) => metricasDashboard(...a);
    listarTodas = (...a: unknown[]) => listarTodas(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    leerConfig = (...a: unknown[]) => leerConfig(...a);
    guardarConfig = (...a: unknown[]) => guardarConfig(...a);
    informacionVencida = (...a: unknown[]) => informacionVencida(...a);
    marcarRecordatorioInformacion = (...a: unknown[]) => marcarRecordatorioInformacion(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

vi.mock("@/lib/excel/dashboard", () => ({
  generarExcelDashboard: vi.fn(() => Buffer.from("xlsx")),
}));

import { GET as metricasGET } from "../metricas/route";
import { GET as metricasExcelGET } from "../metricas/excel/route";
import { GET as coordinadoresGET } from "./coordinadores/route";
import { POST as alertasPOST } from "./alertas/ejecutar/route";
import { GET as configuracionGET, PATCH as configuracionPATCH } from "./configuracion/route";

const NEGADA = () => Response.json({ error: "No autorizado" }, { status: 403 });

beforeEach(() => {
  listarCoordinadores.mockReset().mockResolvedValue([]);
  metricasDashboard.mockReset().mockResolvedValue({});
  listarTodas.mockReset().mockResolvedValue([]);
  listarCotizaciones.mockReset().mockResolvedValue([]);
  leerConfig.mockReset().mockResolvedValue(null);
  guardarConfig.mockReset().mockResolvedValue(undefined);
  informacionVencida.mockReset().mockResolvedValue([]);
  marcarRecordatorioInformacion.mockReset().mockResolvedValue(undefined);
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
});

describe("guardApi(['admin']) en las rutas que dependían solo del middleware (4.8.5)", () => {
  it("GET /api/metricas exige admin y no calcula sin sesión", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await metricasGET(new Request("http://localhost/api/metricas"));

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(metricasDashboard).not.toHaveBeenCalled();
  });

  it("GET /api/metricas/excel exige admin y no exporta sin sesión", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await metricasExcelGET(new Request("http://localhost/api/metricas/excel"));

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(metricasDashboard).not.toHaveBeenCalled();
  });

  it("GET /api/admin/coordinadores exige admin", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await coordinadoresGET();

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(listarCoordinadores).not.toHaveBeenCalled();
  });

  it("POST /api/admin/alertas/ejecutar exige admin y no dispara correos sin sesión", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await alertasPOST();

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(listarTodas).not.toHaveBeenCalled();
  });

  it("GET /api/admin/configuracion exige admin", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await configuracionGET();

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(leerConfig).not.toHaveBeenCalled();
  });

  it("PATCH /api/admin/configuracion exige admin y no guarda sin sesión", async () => {
    guardApi.mockResolvedValue({ negada: NEGADA() });

    const res = await configuracionPATCH(
      new Request("http://localhost/api/admin/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinatario_alertas: "compras@biafoods.co" }),
      })
    );

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(guardarConfig).not.toHaveBeenCalled();
  });

  it("un admin legítimo sigue pasando (el guard no rompe el flujo normal)", async () => {
    const res = await coordinadoresGET();

    expect(res.status).toBe(200);
    expect(listarCoordinadores).toHaveBeenCalled();
  });
});
