// Autorización de recursos que tienen dos lectores legítimos: el equipo de Compras (con
// sesión) y el solicitante dueño (sin sesión — este flujo no tiene login, su identidad es el
// correo). El caso que motiva el guard: `GET /api/solicitudes/[id]` devolvía la solicitud y
// las cotizaciones con precios a cualquiera que conociera el UUID.
//
// Invariante: sin sesión Y sin correo que coincida, no hay acceso. Un UUID no es un token:
// viaja por la URL y se comparte en enlaces.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));

import { guardRecursoDeSolicitud } from "./api-guard";

const SOLICITUD = { solicitanteEmail: "mj.e2e@biabrands.co" };

function pedir(email?: string) {
  const url = email === undefined ? "http://localhost/api/x" : `http://localhost/api/x?email=${encodeURIComponent(email)}`;
  return new Request(url);
}

async function autorizado(email?: string) {
  const r = await guardRecursoDeSolicitud(pedir(email), SOLICITUD);
  return r;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue(null);
});

describe("guardRecursoDeSolicitud", () => {
  it("coordinador con sesión: pasa, con su rol", async () => {
    getSession.mockResolvedValue({ rol: "coordinador", email: "c@biafoods.co" });
    expect(await autorizado()).toEqual({ autorizado: true, rol: "coordinador" });
  });

  it("admin con sesión: pasa", async () => {
    getSession.mockResolvedValue({ rol: "admin", email: "a@biafoods.co" });
    expect((await autorizado()).autorizado).toBe(true);
  });

  it("el solicitante dueño pasa con su correo, sin sesión", async () => {
    expect(await autorizado("mj.e2e@biabrands.co")).toEqual({ autorizado: true, rol: "solicitante" });
  });

  it("el correo no tiene que coincidir en mayúsculas ni espacios", async () => {
    expect((await autorizado("  MJ.E2E@BiaBrands.CO ")).autorizado).toBe(true);
  });

  it("NEGA el correo de otra persona", async () => {
    const r = await autorizado("otro@biabrands.co");
    expect(r.autorizado).toBe(false);
    if (!r.autorizado) expect(r.negada.status).toBe(401);
  });

  it("NEGA sin sesión y sin correo", async () => {
    const r = await autorizado();
    expect(r.autorizado).toBe(false);
    if (!r.autorizado) expect(r.negada.status).toBe(401);
  });

  it("NEGA un correo vacío: `?email=` no es identidad", async () => {
    expect((await autorizado("")).autorizado).toBe(false);
  });

  it("una sesión con rol no permitido devuelve 403, no 401", async () => {
    // Distinguir 401 de 403 dice si el problema es "no sé quién sos" o "sabés pero no podés".
    getSession.mockResolvedValue({ rol: "solicitante", email: "s@biabrands.co" });
    const r = await autorizado();
    expect(r.autorizado).toBe(false);
    if (!r.autorizado) expect(r.negada.status).toBe(403);
  });

  it("la sesión tiene prioridad: un coordinador no queda reclasificado como solicitante", async () => {
    getSession.mockResolvedValue({ rol: "admin", email: "a@biafoods.co" });
    const r = await autorizado("mj.e2e@biabrands.co");
    expect(r).toEqual({ autorizado: true, rol: "admin" });
  });
});