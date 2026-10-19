// Recordatorios manuales (RF-62, correo 8) desde el panel del administrador.
//
// Existen como acción SEPARADA porque antes se disparaban escondidos dentro del botón de
// alertas: marcar solo "Discrepancia" igual mandaba recordatorios de todas las solicitudes, y
// en una prueba salió un correo real a una persona sin que nadie lo esperara (4.4.11).
//
// Lo que se fija: que esté detrás de un admin, que el preview no mande nada, y que marque la
// ronda SOLO si el correo salió (si se marcara igual, el recordatorio se apagaría sin haberse
// enviado y nadie se enteraría).
import { describe, it, expect, vi, beforeEach } from "vitest";

const informacionVencida = vi.fn();
const marcarRecordatorioInformacion = vi.fn();
const leerConfig = vi.fn();
const listarCoordinadores = vi.fn();
const enviarCorreo = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    informacionVencida = (...a: unknown[]) => informacionVencida(...a);
    marcarRecordatorioInformacion = (...a: unknown[]) => marcarRecordatorioInformacion(...a);
    leerConfig = (...a: unknown[]) => leerConfig(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
  },
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));

import { POST } from "./route";

const VENCIDA = {
  solicitud: {
    id: "sol-1",
    numeroReferencia: "RFQ-2026-0042",
    titulo: "Pintura",
    solicitanteNombre: "María",
    solicitanteEmail: "mj@biabrands.co",
    coordinadorId: "coord-1",
    informacionPreguntas: { ronda: 2, preguntas: [{ campoKey: "materiales", pregunta: "¿Material?" }] },
  },
  ronda: 2,
  dias: 4,
};

function pedir(body: unknown = {}) {
  return POST(
    new Request("http://localhost/api/admin/recordatorios/ejecutar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const correos8 = () =>
  enviarCorreo.mock.calls.map((c) => {
    const a = c[0] as { tipoCorreo: string; destinatario: string };
    return { tipoCorreo: a.tipoCorreo, destinatario: a.destinatario };
  });

beforeEach(() => {
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin" } });
  informacionVencida.mockReset().mockResolvedValue([VENCIDA]);
  marcarRecordatorioInformacion.mockReset().mockResolvedValue(undefined);
  leerConfig.mockReset().mockResolvedValue("3");
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", email: "bbonilla@biabrands.co", nombre: "Bryan", activo: true, categoriasAsignadas: [] },
  ]);
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
});

describe("POST /api/admin/recordatorios/ejecutar", () => {
  it("sin ser admin responde la negada del guard y no manda nada", async () => {
    guardApi.mockResolvedValue({ negada: new Response(null, { status: 403 }) });
    const res = await pedir();
    expect(res.status).toBe(403);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("el preview cuenta sin enviar ni marcar", async () => {
    const res = await pedir({ preview: true });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ vencidas: 1, recordatoriosEnviados: 0, preview: true });
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(marcarRecordatorioInformacion).not.toHaveBeenCalled();
  });

  it("envía el correo 8 al coordinador asignado y marca la ronda", async () => {
    const res = await pedir({});
    await expect(res.json()).resolves.toMatchObject({ vencidas: 1, recordatoriosEnviados: 1 });
    expect(correos8()).toEqual([{ tipoCorreo: "8", destinatario: "bbonilla@biabrands.co" }]);
    expect(marcarRecordatorioInformacion).toHaveBeenCalledWith("sol-1", 2);
  });

  it("si el correo falla NO marca la ronda (se reintenta)", async () => {
    enviarCorreo.mockResolvedValue({ estadoEnvio: "fallido" });
    const res = await pedir({});
    await expect(res.json()).resolves.toMatchObject({ recordatoriosEnviados: 0 });
    expect(marcarRecordatorioInformacion).not.toHaveBeenCalled();
  });

  it("sin coordinador asignado cae al alias configurado", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biafoods.co";
    informacionVencida.mockResolvedValue([{ ...VENCIDA, solicitud: { ...VENCIDA.solicitud, coordinadorId: undefined } }]);
    await pedir({});
    expect(correos8()[0].destinatario).toBe("compras@biafoods.co");
  });
});
