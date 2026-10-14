// El rol `solicitante` en la sesión (preparación del login por código).
//
// El riesgo de agregarlo es de escalada: si "sin rol de staff" se interpretara como algo más
// permisivo, cualquier usuario autenticado sin metadata entraría al panel. Estos tests fijan
// que el default es el de MENOR privilegio y que un solicitante no accede a nada de Compras.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));

import { guardApi } from "./api-guard";

const sesion = (rol?: string) => ({
  session: { user: { id: "u1" } },
  rol,
  nombre: "N",
  email: "alguien@biabrands.co",
});

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("un solicitante no accede a lo de Compras", () => {
  it("guardApi de coordinador/admin lo rechaza con 403, no con 401", async () => {
    getSessionMock.mockResolvedValue(sesion("solicitante"));

    const r = await guardApi(["coordinador", "admin"]);

    // 403 y no 401: sabe quién es, pero no puede. La diferencia importa para depurar.
    expect(r.negada?.status).toBe(403);
  });

  it("guardApi lo acepta si una ruta suya lo pide explícitamente", async () => {
    getSessionMock.mockResolvedValue(sesion("solicitante"));

    const r = await guardApi(["solicitante"]);

    expect(r.negada).toBeUndefined();
    expect(r.sesion?.rol).toBe("solicitante");
  });

  it("un coordinador sigue entrando a lo suyo", async () => {
    getSessionMock.mockResolvedValue(sesion("coordinador"));

    expect((await guardApi(["coordinador", "admin"])).negada).toBeUndefined();
  });

  it("un solicitante NO entra a /api/admin: el guard de admin lo frena", async () => {
    getSessionMock.mockResolvedValue(sesion("solicitante"));

    expect((await guardApi(["admin"])).negada?.status).toBe(403);
  });

  it("un admin SÍ pasa el guard de admin: el cambio de rol no le quitó nada", async () => {
    // El admin llega a /api/metricas por acá. El middleware también protege esa ruta, pero
    // lee el rol de `getUser()` directo: son dos caminos distintos y los dos tienen que andar.
    getSessionMock.mockResolvedValue(sesion("admin"));

    const r = await guardApi(["admin"]);

    expect(r.negada).toBeUndefined();
    expect(r.sesion?.rol).toBe("admin");
  });

  it("un admin también pasa donde se pide coordinador o admin", async () => {
    getSessionMock.mockResolvedValue(sesion("admin"));

    expect((await guardApi(["coordinador", "admin"])).negada).toBeUndefined();
  });
});
