// El pipeline (PDF + correos) NO puede decidir si la solicitud se envió.
// Antes: `await pipelineEnvioACompras(...)` y `return 500` si fallaba, o sea que un pdfme que
// no renderaba dejaba al solicitante viendo "no se pudo enviar" sobre una solicitud que ya
// estaba en ENVIADA_A_COMPRAS, y su reintento creaba otra fila.
// Invariante de este archivo: la transición ocurre PRIMERO y un fallo del pipeline se registra
// aparte (`notificacion_fallida`), sin cambiar el status de la respuesta.
import { describe, it, expect, vi, beforeEach } from "vitest";

const obtenerSolicitud = vi.fn();
const transicionarEstado = vi.fn();
const marcarNotificacionFallida = vi.fn();
const obtenerComparativaPorSolicitudId = vi.fn();
const listarCotizacionesConArchivo = vi.fn();
const listarCotizaciones = vi.fn();
const pipeline = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    transicionarEstado = (...a: unknown[]) => transicionarEstado(...a);
    marcarNotificacionFallida = (...a: unknown[]) => marcarNotificacionFallida(...a);
    obtenerComparativaPorSolicitudId = (...a: unknown[]) => obtenerComparativaPorSolicitudId(...a);
    listarCotizacionesConArchivo = (...a: unknown[]) => listarCotizacionesConArchivo(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    crearLinkPublico = vi.fn();
    guardarRecomendacionComprador = vi.fn();
    leerConfig = vi.fn().mockResolvedValue("90");
  },
}));
vi.mock("@/lib/pdf/pipeline", () => ({
  pipelineEnvioACompras: (...a: unknown[]) => pipeline(...a),
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/api-guard", () => ({ guardApi: vi.fn(async () => ({ negada: null })) }));

import { PATCH } from "./route";

const SOLICITUD = {
  id: "22222222-2222-4222-8222-222222222222",
  estado: "BORRADOR",
  titulo: "Sombrillas",
  solicitanteEmail: "mj.e2e@biabrands.co",
  solicitanteNombre: "Solicitante E2E",
  clasificacionCorregida: false,
  notificacionFallida: false,
  fechaCreacion: "2026-09-27T00:00:00Z",
  numeroReferencia: undefined,
};
const CON_REF = { ...SOLICITUD, numeroReferencia: "RFQ-2026-0042", estado: "ENVIADA_A_COMPRAS" };

function pedir(hacia: string, extra: Record<string, unknown> = {}) {
  return PATCH(
    new Request("http://localhost/api/solicitudes/x/estado", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hacia, actorTipo: "solicitante", actorIdentificador: "mj.e2e@biabrands.co", ...extra }),
    }),
    { params: Promise.resolve({ id: SOLICITUD.id }) }
  );
}

beforeEach(() => {
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  transicionarEstado.mockReset().mockResolvedValue({ solicitud: CON_REF, eventoId: "ev-1" });
  marcarNotificacionFallida.mockReset().mockResolvedValue(undefined);
  pipeline.mockReset().mockResolvedValue({ ok: true, documentoId: "d-1" });
});

describe("PATCH /api/solicitudes/[id]/estado · la transición es el hecho de negocio", () => {
  it("si el PDF falla, la solicitud QUEDA enviada y el fallo se registra aparte", async () => {
    pipeline.mockResolvedValue({ ok: false, error: "pdfme explota" });

    const res = await pedir("ENVIADA_A_COMPRAS", { respuestas: { titulo: "x" } });

    expect(res.status).toBe(200);
    // La transición ocurrió igual: ese es el punto.
    expect(transicionarEstado).toHaveBeenCalledTimes(1);
    expect(marcarNotificacionFallida).toHaveBeenCalledWith(SOLICITUD.id);
    const body = await res.json();
    expect(body.solicitud.estado).toBe("ENVIADA_A_COMPRAS");
    expect(body.pipeline.ok).toBe(false);
  });

  it("el pipeline corre DESPUÉS de la transición, con la referencia ya asignada", async () => {
    await pedir("ENVIADA_A_COMPRAS", { respuestas: {} });

    const orden = transicionarEstado.mock.invocationCallOrder[0];
    const ordenPipeline = pipeline.mock.invocationCallOrder[0];
    expect(ordenPipeline).toBeGreaterThan(orden);
    // Sin esto el documento salía con la ruta `documentos/<uuid>/…` en vez de la referencia.
    const arg = pipeline.mock.calls[0][0] as { solicitud: { numeroReferencia?: string }; notificar: boolean };
    expect(arg.solicitud.numeroReferencia).toBe("RFQ-2026-0042");
    expect(arg.notificar).toBe(false);
  });

  it("una solicitud que NO es de este correo no se puede empujar a Compras", async () => {
    // El endpoint es público para el envío del solicitante. Antes no comprobaba la propiedad
    // y cualquiera con un id podía enviar cualquier solicitud.
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, solicitanteEmail: "alguien@otro.co" });
    const res = await pedir("ENVIADA_A_COMPRAS");
    expect(res.status).toBe(404);
    expect(transicionarEstado).not.toHaveBeenCalled();
    expect(pipeline).not.toHaveBeenCalled();
  });

  it("una solicitud ya cerrada no se puede reenviar (404, no 409)", async () => {
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, estado: "CERRADA_CON_DECISION" });
    const res = await pedir("ENVIADA_A_COMPRAS");
    expect(res.status).toBe(404);
    expect(transicionarEstado).not.toHaveBeenCalled();
  });

  it("reenviar lo ya enviado es un ÉXITO idempotente, no un error sobre un envío hecho", async () => {
    // El caso real: el cliente se rinde a los 30 s, la transición sí ocurrió, y al reintentar
    // un 409 le hacía creer al solicitante que su solicitud no se había enviado.
    obtenerSolicitud.mockResolvedValue({ ...CON_REF, solicitanteEmail: "mj.e2e@biabrands.co" });
    const res = await pedir("ENVIADA_A_COMPRAS");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yaEnviada).toBe(true);
    expect(body.solicitud.estado).toBe("ENVIADA_A_COMPRAS");
    // No se re-transiciona ni se re-genera el documento: ya están hechos.
    expect(transicionarEstado).not.toHaveBeenCalled();
    expect(pipeline).not.toHaveBeenCalled();
  });

  it("la transición inválida de un envío ajeno no toca el pipeline", async () => {
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, estado: "CERRADA_CON_DECISION" });
    await pedir("ENVIADA_A_COMPRAS");
    expect(pipeline).not.toHaveBeenCalled();
    expect(transicionarEstado).not.toHaveBeenCalled();
  });
});
