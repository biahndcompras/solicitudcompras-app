// Compras pide información al solicitante (spec 010, RF-59). Tres invariantes:
//
// 1. Solo Compras: el solicitante no puede abrirse una ronda de preguntas a sí mismo.
// 2. La ronda se abre ANTES de mandar el correo. Al revés, un correo prometería una ronda
//    que no existe; así, si el correo falla, el solicitante la ve igual al entrar.
// 3. El estado no se mueve. Es una bandera, no una transición: los filtros de la bandeja y
//    los KPI no deben enterarse.
import { describe, it, expect, vi, beforeEach } from "vitest";

const pedirInformacion = vi.fn();
const obtenerSolicitud = vi.fn();
const enviarCorreo = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    pedirInformacion = (...a: unknown[]) => pedirInformacion(...a);
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
  },
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));

import { POST } from "./route";

const ID = "22222222-2222-4222-8222-222222222222";
const SOLICITUD = {
  id: ID,
  numeroReferencia: "RFQ-2026-0042",
  titulo: "Pintura epóxica",
  solicitanteEmail: "mj.e2e@biabrands.co",
  solicitanteNombre: "Solicitante E2E",
  estado: "EN_COTIZACION",
  fechaCreacion: "2026-10-01T10:00:00Z",
  clasificacionCorregida: false,
  notificacionFallida: false,
};
const PREGUNTAS = [{ campoKey: "materiales", pregunta: "¿De qué material?" }];

function pedir(body: unknown) {
  return POST(
    new Request(`http://localhost/api/solicitudes/${ID}/informacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ID }) }
  );
}
const correo6 = () =>
  enviarCorreo.mock.calls.map((c) => c[0] as { tipoCorreo: string; destinatario: string })[0];

beforeEach(() => {
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "coordinador", email: "coord@biafoods.co" } });
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  pedirInformacion.mockReset().mockResolvedValue({ ronda: 1, pedidaEn: "2026-10-03T12:00:00Z" });
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
});

describe("POST /api/solicitudes/[id]/informacion", () => {
  it("abre la ronda y avisa al solicitante", async () => {
    const res = await pedir({ preguntas: PREGUNTAS });

    expect(res.status).toBe(200);
    expect(pedirInformacion).toHaveBeenCalledWith(
      expect.objectContaining({ solicitudId: ID, preguntas: PREGUNTAS, pedidaPor: "coord@biafoods.co" })
    );
    expect(correo6().tipoCorreo).toBe("6");
    expect(correo6().destinatario).toBe(SOLICITUD.solicitanteEmail);
  });

  it("sin sesión de Compras no se abre ninguna ronda", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autenticado" }, { status: 401 }) });

    const res = await pedir({ preguntas: PREGUNTAS });

    expect(res.status).toBe(401);
    expect(pedirInformacion).not.toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("exige rol de coordinador o admin, no cualquier sesión", async () => {
    await pedir({ preguntas: PREGUNTAS });
    expect(guardApi).toHaveBeenCalledWith(["coordinador", "admin"]);
  });

  it("rechaza una lista vacía de preguntas", async () => {
    const res = await pedir({ preguntas: [] });

    expect(res.status).toBe(400);
    expect(pedirInformacion).not.toHaveBeenCalled();
  });

  it("rechaza una pregunta sin texto", async () => {
    const res = await pedir({ preguntas: [{ campoKey: "materiales", pregunta: "  " }] });

    expect(res.status).toBe(400);
    expect(pedirInformacion).not.toHaveBeenCalled();
  });

  it("una solicitud cerrada devuelve 409, no 500", async () => {
    pedirInformacion.mockRejectedValue(new Error("La solicitud está cerrada; no se puede pedir información."));

    const res = await pedir({ preguntas: PREGUNTAS });

    // 409 y no 500: es una regla de negocio, no una caída. El coordinador necesita entender
    // que no puede, no que el sistema falló.
    expect(res.status).toBe(409);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("una ronda ya abierta devuelve 409 y no manda un segundo correo", async () => {
    pedirInformacion.mockRejectedValue(new Error("Ya hay una ronda de preguntas esperando respuesta del solicitante."));

    const res = await pedir({ preguntas: PREGUNTAS });

    expect(res.status).toBe(409);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("un fallo del correo NO deshace la ronda ya abierta", async () => {
    enviarCorreo.mockRejectedValue(new Error("Resend 500"));

    const res = await pedir({ preguntas: PREGUNTAS });

    // La ronda es el hecho; el correo es el aviso. El solicitante la ve igual al entrar.
    expect(res.status).toBe(200);
    expect(pedirInformacion).toHaveBeenCalled();
  });

  it("el correo lleva el enlace con el correo del solicitante para que pueda responder", async () => {
    await pedir({ preguntas: PREGUNTAS });

    const datos = (enviarCorreo.mock.calls[0][0] as { datos: { urlDetalle: string; preguntas: unknown[] } }).datos;
    // Sin `?email=` la pantalla de mis-solicitudes no deja entrar: el correo es la identidad.
    expect(datos.urlDetalle).toContain(`/mis-solicitudes/${ID}?email=`);
    expect(datos.urlDetalle).toContain(encodeURIComponent(SOLICITUD.solicitanteEmail));
    expect(datos.preguntas).toHaveLength(1);
  });
});
