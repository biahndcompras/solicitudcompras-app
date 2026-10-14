// Recordatorio de preguntas sin responder (spec 010, RF-62).
//
// Dos disparadores para el mismo hecho, a propósito: el proyecto no tiene ningún programador
// automático, así que el botón de admin es el único que funciona hoy. La ruta de cron existe
// para que se vuelva automático al desplegar, sin tocar código.
//
// Lo que se fija acá es lo que puede salir mal sin que nadie lo note: mandar el recordatorio
// todos los días, mandarlo al solicitante, o dejarlo abierto a internet.
import { describe, it, expect, vi, beforeEach } from "vitest";

const informacionVencida = vi.fn();
const marcarRecordatorioInformacion = vi.fn();
const leerConfig = vi.fn();
const listarCoordinadores = vi.fn();
const enviarCorreo = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    informacionVencida = (...a: unknown[]) => informacionVencida(...a);
    marcarRecordatorioInformacion = (...a: unknown[]) => marcarRecordatorioInformacion(...a);
    leerConfig = (...a: unknown[]) => leerConfig(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
  },
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));

import { GET as cron } from "./route";

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

function pedir(headers: Record<string, string> = {}) {
  return cron(new Request("http://localhost/api/cron/recordatorios", { headers }));
}
const correo8 = () => enviarCorreo.mock.calls.map((c) => c[0] as { tipoCorreo: string; destinatario: string; datos: { diasEsperando: number } })[0];

beforeEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  informacionVencida.mockReset().mockResolvedValue([VENCIDA]);
  marcarRecordatorioInformacion.mockReset().mockResolvedValue(undefined);
  leerConfig.mockReset().mockResolvedValue("3");
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", email: "bbonilla@biabrands.co", nombre: "Bryan", activo: true, categoriasAsignadas: [] },
  ]);
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
});

describe("GET /api/cron/recordatorios", () => {
  it("SIN CRON_SECRET la ruta queda deshabilitada: no es una ruta abierta que manda correos", async () => {
    const res = await pedir();

    expect(res.status).toBe(503);
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect((await res.json()).error).toMatch(/CRON_SECRET/);
  });

  it("con el secreto equivocado responde 401 y no manda nada", async () => {
    process.env.CRON_SECRET = "el-correcto";

    const res = await pedir({ authorization: "Bearer el-otro" });

    expect(res.status).toBe(401);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("con el secreto correcto manda el correo 8 al coordinador", async () => {
    process.env.CRON_SECRET = "el-correcto";

    const res = await pedir({ authorization: "Bearer el-correcto" });

    expect(res.status).toBe(200);
    expect(correo8().tipoCorreo).toBe("8");
    expect(correo8().destinatario).toBe("bbonilla@biabrands.co");
    expect(correo8().datos.diasEsperando).toBe(4);
    expect((await res.json()).recordatoriosEnviados).toBe(1);
  });

  it("NUNCA le manda el recordatorio al solicitante", async () => {
    process.env.CRON_SECRET = "el-correcto";

    await pedir({ authorization: "Bearer el-correcto" });

    expect(correo8().destinatario).not.toBe("mj@biabrands.co");
  });

  it("marca la ronda recordada para no repetirlo mañana", async () => {
    process.env.CRON_SECRET = "el-correcto";

    await pedir({ authorization: "Bearer el-correcto" });

    expect(marcarRecordatorioInformacion).toHaveBeenCalledWith("sol-1", 2);
  });

  it("usa el umbral configurado, no un 3 cableado", async () => {
    process.env.CRON_SECRET = "el-correcto";
    leerConfig.mockResolvedValue("7");

    await pedir({ authorization: "Bearer el-correcto" });

    expect(informacionVencida).toHaveBeenCalledWith(7);
  });

  it("sin coordinador asignado cae al alias configurado", async () => {
    process.env.CRON_SECRET = "el-correcto";
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biabrands.co";
    listarCoordinadores.mockResolvedValue([]);

    await pedir({ authorization: "Bearer el-correcto" });

    expect(correo8().destinatario).toBe("compras@biabrands.co");
  });

  it("si el correo FALLA, NO se marca como recordada: se reintenta mañana", async () => {
    process.env.CRON_SECRET = "el-correcto";
    // `enviarCorreo` NO lanza cuando Resend falla: devuelve `estadoEnvio: "fallido"`. Simular
    // un throw haría pasar este test sin probar nada, porque ese catch no se ejecuta en la
    // realidad. El bug real era marcar la ronda igual y apagar el aviso para siempre.
    enviarCorreo.mockResolvedValue({ estadoEnvio: "fallido", errorDetalle: "Resend 500" });

    const res = await pedir({ authorization: "Bearer el-correcto" });

    expect(marcarRecordatorioInformacion).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect((await res.json()).recordatoriosEnviados).toBe(0);
  });

  it("si el correo sale, SÍ se marca", async () => {
    process.env.CRON_SECRET = "el-correcto";
    enviarCorreo.mockResolvedValue({ estadoEnvio: "enviado" });

    await pedir({ authorization: "Bearer el-correcto" });

    expect(marcarRecordatorioInformacion).toHaveBeenCalledWith("sol-1", 2);
  });

  it("sin vencidas no manda nada", async () => {
    process.env.CRON_SECRET = "el-correcto";
    informacionVencida.mockResolvedValue([]);

    const res = await pedir({ authorization: "Bearer el-correcto" });

    expect(enviarCorreo).not.toHaveBeenCalled();
    expect((await res.json()).vencidas).toBe(0);
  });
});
