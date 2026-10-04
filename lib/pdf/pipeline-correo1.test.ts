// El correo 1 lleva el PDF del RFQ: cotizaciones, precios, ISV. Su destinatario es la
// decisión de seguridad más silenciosa del pipeline, porque el síntoma —"nadie recibe
// nada"— no delata el error.
//
// El bug: `process.env.MAIL_COORDINADOR_DEFAULT ?? solicitud.solicitanteEmail`. La variable
// no estaba en `.env.example`, así que el segundo término era el camino por defecto: el
// solicitante recibía su propia solicitud y Compras nunca se enteraba.
//
// Invariante: el solicitante NUNCA es destinatario del correo 1.
import { describe, it, expect, vi, beforeEach } from "vitest";

const enviarCorreo = vi.fn();
const listarCoordinadores = vi.fn();
const asignarCoordinador = vi.fn();
const persistirDocumento = vi.fn();

vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/pdf/generador", () => ({
  generarDocumento: async () => ({ buffer: Buffer.from("%PDF-1.4"), tipo: "RFQ", referencia: "RFQ-2026-0001" }),
}));

import { pipelineEnvioACompras } from "./pipeline";

const SOLICITUD = {
  id: "sol-1",
  numeroReferencia: "RFQ-2026-0001",
  titulo: "Sombrillas",
  tipo: "RFQ" as const,
  solicitanteEmail: "solicitante@biabrands.co",
  solicitanteNombre: "Solicitante",
  categoria: "mercadeo",
  descripcion: "desc",
  estado: "ENVIADA_A_COMPRAS" as const,
  fechaCreacion: "2026-10-01T10:00:00Z",
  clasificacionCorregida: false,
  notificacionFallida: false,
};

function repoFalso(coordinadores: Array<{ id: string; email: string; nombre: string; categoriasAsignadas: string[] }>) {
  listarCoordinadores.mockResolvedValue(coordinadores);
  return {
    listarCoordinadores,
    asignarCoordinador,
    persistirDocumento,
  } as never;
}

const correo1 = () =>
  enviarCorreo.mock.calls
    .map((c) => c[0] as { tipoCorreo: string; destinatario: string })
    .find((a) => a.tipoCorreo === "1");

beforeEach(() => {
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
  asignarCoordinador.mockReset().mockResolvedValue(undefined);
  persistirDocumento.mockReset().mockResolvedValue({ id: "doc-1" });
});

describe("destinatario del correo 1", () => {
  it("respeta la elección explícita del solicitante y notifica a ese", async () => {
    // El solicitante puede elegir a quién va su solicitud (1.1) y esa elección gana sobre la
    // regla por categoría. El correo 1 tiene que seguir a la asignación, no a la categoría.
    await pipelineEnvioACompras({
      repo: repoFalso([
        { id: "c1", email: "asignado@biabrands.co", nombre: "Asignado", categoriasAsignadas: ["mercadeo"] },
        { id: "c2", email: "elegido@biabrands.co", nombre: "Elegido", categoriasAsignadas: [] },
      ]),
      solicitud: SOLICITUD,
      respuestas: {},
      // El solicitante pidió que fuera a "c2"; la regla de categoría manda "c1".
      coordinadorIdSolicitado: "c2",
      notificar: true,
    });

    expect(asignarCoordinador).toHaveBeenCalledWith(SOLICITUD.id, "c2");
    expect(correo1()?.destinatario).toBe("elegido@biabrands.co");
  });

  it("el correo 2 (acuse) SÍ va al solicitante — el 1 nunca", async () => {
    await pipelineEnvioACompras({
      repo: repoFalso([{ id: "c1", email: "c@biabrands.co", nombre: "C", categoriasAsignadas: ["mercadeo"] }]),
      solicitud: SOLICITUD,
      respuestas: {},
      notificar: true,
    });

    const c2 = enviarCorreo.mock.calls
      .map((c) => c[0] as { tipoCorreo: string; destinatario: string })
      .find((a) => a.tipoCorreo === "2");
    expect(c2?.destinatario).toBe("solicitante@biabrands.co");
    expect(correo1()?.destinatario).not.toBe("solicitante@biabrands.co");
  });

  it("sin coordinador con email y sin MAIL_COORDINADOR_DEFAULT: NO se envía el correo 1", async () => {
    const res = await pipelineEnvioACompras({
      repo: repoFalso([{ id: "c1", email: "", nombre: "Sin email", categoriasAsignadas: ["mercadeo"] }]),
      solicitud: SOLICITUD,
      respuestas: {},
      notificar: true,
    });

    // No enviar el correo 1 es correcto: la alternativa es mandarle su propio RFQ.
    expect(correo1()).toBeUndefined();
    expect(res.correoCoordinador).toBe("sin-destinatario");
    // Y el acuse al solicitante sale igual: su derecho a saber que se envió no depende de
    // que Compras tenga buzón.
    expect(enviarCorreo.mock.calls.map((c) => (c[0] as { tipoCorreo: string }).tipoCorreo)).toContain("2");
  });

  it("cae al alias configurado cuando no hay coordinador con email", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biabrands.co";

    await pipelineEnvioACompras({
      repo: repoFalso([{ id: "c1", email: "", nombre: "Sin email", categoriasAsignadas: ["mercadeo"] }]),
      solicitud: SOLICITUD,
      respuestas: {},
      notificar: true,
    });

    expect(correo1()?.destinatario).toBe("compras@biabrands.co");
  });

  it("con el alias definido, un coordinador con email tiene prioridad sobre el alias", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biabrands.co";

    await pipelineEnvioACompras({
      repo: repoFalso([{ id: "c1", email: "real@biabrands.co", nombre: "Real", categoriasAsignadas: ["mercadeo"] }]),
      solicitud: SOLICITUD,
      respuestas: {},
      notificar: true,
    });

    expect(correo1()?.destinatario).toBe("real@biabrands.co");
  });
});