// El solicitante responde las preguntas de Compras (spec 010, RF-60).
//
// Invariantes de seguridad: sin sesión (este flujo no tiene login), la identidad es el correo
// y se compara contra el dueño real de ESA solicitud. Un id no es credencial.
//
// Invariante de datos: la respuesta se registra ANTES de mandar el correo. Al revés, el
// coordinador recibiría un aviso de algo que no se guardó.
import { describe, it, expect, vi, beforeEach } from "vitest";

const responderInformacion = vi.fn();
const obtenerSolicitud = vi.fn();
const listarCoordinadores = vi.fn();
const enviarCorreo = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    responderInformacion = (...a: unknown[]) => responderInformacion(...a);
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
  },
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));

import { POST } from "./route";

const ID = "22222222-2222-4222-8222-222222222222";
const EMAIL = "mj.e2e@biabrands.co";
const SOLICITUD = {
  id: ID,
  numeroReferencia: "RFQ-2026-0042",
  titulo: "Pintura epóxica",
  solicitanteEmail: EMAIL,
  solicitanteNombre: "Solicitante E2E",
  estado: "EN_COTIZACION",
  coordinadorId: "coord-1",
  informacionPendiente: true,
  informacionPreguntas: {
    ronda: 2,
    pedidaEn: "2026-10-01T10:00:00Z",
    preguntas: [{ campoKey: "materiales", pregunta: "¿De qué material?" }],
  },
  fechaCreacion: "2026-10-01T10:00:00Z",
  clasificacionCorregida: false,
  notificacionFallida: false,
};

function responder(body: unknown) {
  return POST(
    new Request(`http://localhost/api/solicitudes/${ID}/informacion/respuesta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ID }) }
  );
}
const correo7 = () =>
  enviarCorreo.mock.calls.map((c) => c[0] as { tipoCorreo: string; destinatario: string; datos: { preguntas: unknown[] } })[0];

beforeEach(() => {
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  responderInformacion.mockReset().mockResolvedValue({ yaRespondida: false, ronda: 2 });
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", email: "bbonilla@biabrands.co", nombre: "Bryan", activo: true, categoriasAsignadas: [] },
  ]);
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
  delete process.env.MAIL_COORDINADOR_DEFAULT;
});

describe("POST /api/solicitudes/[id]/informacion/respuesta", () => {
  it("el solicitante dueño responde y el coordinador recibe el correo 7", async () => {
    const res = await responder({ email: EMAIL, respuestas: { materiales: "Acero" } });

    expect(res.status).toBe(200);
    expect(responderInformacion).toHaveBeenCalledWith(
      expect.objectContaining({ solicitudId: ID, respuestas: { materiales: "Acero" }, respondidoPor: EMAIL })
    );
    expect(correo7().tipoCorreo).toBe("7");
    expect(correo7().destinatario).toBe("bbonilla@biabrands.co");
  });

  it("el correo 7 empareja cada pregunta con su respuesta", async () => {
    await responder({ email: EMAIL, respuestas: { materiales: "Acero" } });

    expect(correo7().datos.preguntas).toEqual([{ pregunta: "¿De qué material?", respuesta: "Acero" }]);
  });

  it("NUNCA se responde por otra persona: correo ajeno da 404, no 403", async () => {
    const res = await responder({ email: "curioso@biafoods.co", respuestas: { materiales: "Acero" } });

    // 404 y no 403: un 403 confirmaría que la solicitud existe, y quien solo tiene el id no
    // debería poder averiguarlo.
    expect(res.status).toBe(404);
    expect(responderInformacion).not.toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("el correo no distingue mayúsculas ni espacios", async () => {
    const res = await responder({ email: "  MJ.E2E@BiaBrands.CO  ", respuestas: {} });

    expect(res.status).toBe(200);
  });

  it("reintentar no duplica ni manda un segundo correo", async () => {
    responderInformacion.mockResolvedValue({ yaRespondida: true });

    const res = await responder({ email: EMAIL, respuestas: { materiales: "Acero" } });

    expect(res.status).toBe(200);
    expect((await res.json()).yaRespondida).toBe(true);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("sin correo en el cuerpo se rechaza", async () => {
    const res = await responder({ respuestas: { materiales: "Acero" } });
    expect(res.status).toBe(400);
  });

  it("un fallo del correo NO deshace la respuesta ya guardada", async () => {
    enviarCorreo.mockRejectedValue(new Error("Resend 500"));

    const res = await responder({ email: EMAIL, respuestas: { materiales: "Acero" } });

    // El dato es el hecho; el correo es el aviso. El coordinador lo ve igual en el panel.
    expect(res.status).toBe(200);
    expect(responderInformacion).toHaveBeenCalled();
  });

  it("sin coordinador con email cae al alias, y nunca avisa al solicitante", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biabrands.co";
    listarCoordinadores.mockResolvedValue([]);

    await responder({ email: EMAIL, respuestas: {} });

    expect(correo7().destinatario).toBe("compras@biabrands.co");
    expect(correo7().destinatario).not.toBe(EMAIL);
  });

  it("acepta respuestas vacías: 'no lo sé' es una respuesta legítima", async () => {
    const res = await responder({ email: EMAIL, respuestas: { materiales: "" } });

    expect(res.status).toBe(200);
    expect(responderInformacion).toHaveBeenCalled();
  });
});
