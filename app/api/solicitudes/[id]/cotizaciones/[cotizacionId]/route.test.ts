// La cotización tiene que ser de la solicitud que dice la URL.
//
// Antes no se comprobaba: el endpoint operaba sobre cualquier cotización por su id. El cliente
// mandaba incluso un `_` literal en lugar del id real de la solicitud, lo que delataba que el
// parámetro no se usaba. Una URL que miente sobre qué modifica es una autorización implícita
// sobre todo lo demás.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarCotizaciones = vi.fn();
const actualizarCotizacion = vi.fn();
const eliminarCotizacion = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    actualizarCotizacion = (...a: unknown[]) => actualizarCotizacion(...a);
    eliminarCotizacion = (...a: unknown[]) => eliminarCotizacion(...a);
  },
}));
vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));

import { PATCH, DELETE } from "./route";

const SOL = "sol-1";
const COT = "cot-1";
const params = Promise.resolve({ id: SOL, cotizacionId: COT });

function patch(body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/solicitudes/${SOL}/cotizaciones/${COT}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  );
}
function del() {
  return DELETE(new Request(`http://localhost/api/solicitudes/${SOL}/cotizaciones/${COT}`, { method: "DELETE" }), { params });
}

beforeEach(() => {
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "coordinador", email: "c@biafoods.co" } });
  listarCotizaciones.mockReset().mockResolvedValue([{ id: COT }, { id: "otra" }]);
  actualizarCotizacion.mockReset().mockResolvedValue(undefined);
  eliminarCotizacion.mockReset().mockResolvedValue(undefined);
});

describe("cotizaciones · la URL dice a qué solicitud pertenece", () => {
  it("PATCH actualiza cuando la cotización es de esa solicitud", async () => {
    const res = await patch({ valorNeto: 100 });

    expect(res.status).toBe(200);
    expect(actualizarCotizacion).toHaveBeenCalledWith(COT, expect.objectContaining({ valorNeto: 100 }));
  });

  it("PATCH rechaza una cotización de OTRA solicitud, y no la toca", async () => {
    listarCotizaciones.mockResolvedValue([{ id: "de-otra-solicitud" }]);

    const res = await patch({ valorNeto: 100 });

    expect(res.status).toBe(404);
    expect(actualizarCotizacion).not.toHaveBeenCalled();
  });

  it("DELETE rechaza una cotización de otra solicitud, y no la borra", async () => {
    listarCotizaciones.mockResolvedValue([{ id: "de-otra-solicitud" }]);

    const res = await del();

    // Sin esta comprobación, un id ajeno en la URL bastaba para borrar la cotización de otro.
    expect(res.status).toBe(404);
    expect(eliminarCotizacion).not.toHaveBeenCalled();
  });

  it("DELETE borra cuando corresponde", async () => {
    const res = await del();

    expect(res.status).toBe(200);
    expect(eliminarCotizacion).toHaveBeenCalledWith(COT);
  });

  it("sin sesión no se llega a la verificación", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autenticado" }, { status: 401 }) });

    expect((await patch({ valorNeto: 1 })).status).toBe(401);
    expect(listarCotizaciones).not.toHaveBeenCalled();
  });

  it("la solicitud que se consulta es la de la URL, no otra", async () => {
    await patch({ valorNeto: 1 });
    expect(listarCotizaciones).toHaveBeenCalledWith(SOL);
  });
});
