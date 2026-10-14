// El ciclo de decisión cierra la solicitud y debe notificar a quien tiene que actuar sobre
// ella. Dos cosas se rompían:
//
// 1. El correo 1 (el que lleva el PDF del RFQ con precios) caía a `solicitud.solicitanteEmail`
//    cuando `MAIL_COORDINADOR_DEFAULT` no estaba definida — que era el camino por defecto,
//    porque la variable no estaba en `.env.example`. El solicitante recibía su propia
//    solicitud y Compras no se enteraba de nada.
// 2. El correo 4 tenía la plantilla escrita desde el principio pero `tipoCorreo: "4"` no se
//    invocaba en ningún lado: la solicitud se cerraba en silencio.
//
// Invariante: el solicitante NUNCA es destinatario del correo 1.
import { describe, it, expect, vi, beforeEach } from "vitest";

const enviarCorreo = vi.fn();
const listarCoordinadores = vi.fn();
const obtenerLinkPorToken = vi.fn();
const obtenerComparativaPorId = vi.fn();
const obtenerSolicitud = vi.fn();
const listarCotizaciones = vi.fn();
const registrarDecisionYCerrar = vi.fn();
const obtenerDecisionPorSolicitud = vi.fn();

vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerLinkPorToken = (...a: unknown[]) => obtenerLinkPorToken(...a);
    obtenerComparativaPorId = (...a: unknown[]) => obtenerComparativaPorId(...a);
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    registrarDecisionYCerrar = (...a: unknown[]) => registrarDecisionYCerrar(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
    obtenerDecisionPorSolicitud = (...a: unknown[]) => obtenerDecisionPorSolicitud(...a);
  },
}));

import { POST as decidir, GET as estado } from "./route";

const SOLICITUD = {
  id: "sol-1",
  numeroReferencia: "RFQ-2026-0042",
  solicitanteEmail: "mj.e2e@biabrands.co",
  solicitanteNombre: "Solicitante E2E",
  estado: "ENVIADA_A_SOLICITANTE",
  fechaEnvio: "2026-09-25T10:00:00Z",
  coordinadorId: "coord-1",
};
const COMPARATIVA = { id: "cmp-1", solicitudId: "sol-1" };
const COTIZACIONES = [
  { id: "c1", proveedorNombre: "Proveedor Alfa", moneda: "HNL", valorNeto: 10000, valorTotal: 11500, plazoEntrega: "15 días" },
  { id: "c2", proveedorNombre: "Proveedor Beta", moneda: "HNL", valorNeto: 12000, valorTotal: 13800, plazoEntrega: "30 días" },
];

function params() {
  return { params: Promise.resolve({ token: "AAAA-BBBB-CCCC" }) };
}
function pedirEstado() {
  return estado(new Request("http://localhost/api/comparativas/AAAA-BBBB-CCCC/decision"), params());
}
function pedir(body: Record<string, unknown>) {
  return decidir(
    new Request("http://localhost/api/comparativas/AAAA-BBBB-CCCC/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params()
  );
}
const correo4 = () =>
  enviarCorreo.mock.calls.find((c) => (c[0] as { tipoCorreo: string }).tipoCorreo === "4")?.[0] as
    | { destinatario: string; datos: Record<string, unknown> }
    | undefined;

beforeEach(() => {
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
  obtenerLinkPorToken.mockReset().mockResolvedValue({ comparativaId: "cmp-1", revocado: false, fechaExpiracion: null });
  obtenerComparativaPorId.mockReset().mockResolvedValue(COMPARATIVA);
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  listarCotizaciones.mockReset().mockResolvedValue(COTIZACIONES);
  registrarDecisionYCerrar.mockReset().mockResolvedValue(undefined);
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", nombre: "Bryan Bonilla", email: "bbonilla@biabrands.co", activo: true, categoriasAsignadas: [] },
    { id: "coord-2", nombre: "Otro", email: "otro@biabrands.co", activo: true, categoriasAsignadas: [] },
  ]);
  obtenerDecisionPorSolicitud.mockReset().mockResolvedValue(null);
});

describe("correo 4 · la decisión se notifica a quien tiene que actuar", () => {
  it("se envía al coordinador asignado, con los datos de la opción elegida", async () => {
    const res = await pedir({ cotizacionId: "c1" });

    expect(res.status).toBe(200);
    expect(correo4()).toBeDefined();
    expect(correo4()?.destinatario).toBe("bbonilla@biabrands.co");
    expect(correo4()?.datos).toMatchObject({
      numeroReferencia: "RFQ-2026-0042",
      proveedorSeleccionado: "Proveedor Alfa",
      plazoEntrega: "15 días",
    });
  });

  it("NUNCA se envía al solicitante", async () => {
    await pedir({ cotizacionId: "c1" });

    for (const [args] of enviarCorreo.mock.calls) {
      expect((args as { destinatario?: string }).destinatario).not.toBe("mj.e2e@biabrands.co");
    }
  });

  it("con 'ninguna opción' el correo dice explícitamente que no eligió ninguna", async () => {
    await pedir({ ningunaOpcion: true, comentario: "Ninguna me sirve" });

    expect(correo4()?.datos.proveedorSeleccionado).toBe("Ninguna opción");
    expect(correo4()?.destinatario).toBe("bbonilla@biabrands.co");
  });

  it("sin coordinador asignado cae al alias configurado", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@biabrands.co";
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, coordinadorId: undefined });

    await pedir({ cotizacionId: "c1" });

    expect(correo4()?.destinatario).toBe("compras@biabrands.co");
  });

  it("sin nadie a quien notificar, la decisión se registra igual y no se rompe el flujo", async () => {
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, coordinadorId: undefined });

    const res = await pedir({ cotizacionId: "c1" });

    // El solicitante YA decidió: devolverle un error lo induciría a decidir de nuevo.
    expect(res.status).toBe(200);
    expect(registrarDecisionYCerrar).toHaveBeenCalled();
    expect(correo4()).toBeUndefined();
  });

  it("'ninguna me sirve' devuelve la solicitud a Compras y NO la cierra", async () => {
    const res = await pedir({ ningunaOpcion: true, comentario: "Ninguna cumple el plazo" });
    const body = await res.json();

    // El bug: la UI promete "vuelve a revisión" y el sistema la cerraba como
    // CERRADA_SIN_DECISION, que es terminal. La transición ENVIADA_A_SOLICITANTE →
    // EN_COTIZACION ya estaba permitida en la máquina de estados; nadie la invocaba.
    expect(body.estadoFinal).toBe("EN_COTIZACION");
    expect(body.vuelveACompras).toBe(true);
    expect(body.estadoFinal).not.toBe("CERRADA_SIN_DECISION");
  });

  it("elegir una opción sí sigue cerrando la solicitud", async () => {
    const res = await pedir({ cotizacionId: "c1" });
    const body = await res.json();

    expect(body.estadoFinal).toBe("CERRADA_CON_DECISION");
    expect(body.vuelveACompras).toBe(false);
  });

  it("el correo 4 avisa que vuelve a Compras, no que quedó cerrada", async () => {
    await pedir({ ningunaOpcion: true });

    expect(correo4()?.datos.ningunaOpcionAceptada).toBe(true);
  });

  it("eligiendo una opción, el correo 4 no dice que volvió a Compras", async () => {
    await pedir({ cotizacionId: "c1" });

    expect(correo4()?.datos.ningunaOpcionAceptada).toBe(false);
  });

  it("si el envío del correo falla, la decisión sigue registrada", async () => {
    enviarCorreo.mockRejectedValue(new Error("Resend 500"));

    const res = await pedir({ cotizacionId: "c1" });

    expect(res.status).toBe(200);
    expect(registrarDecisionYCerrar).toHaveBeenCalled();
  });

  it("el correo 4 NO se manda antes de cerrar la solicitud", async () => {
    // Si el correo se disparara primero y la transacción fallara, se notificaría una
    // decisión que no ocurrió.
    const orden: string[] = [];
    registrarDecisionYCerrar.mockImplementation(async () => {
      orden.push("cerrar");
    });
    enviarCorreo.mockImplementation(async (args: { tipoCorreo: string }) => {
      orden.push(`correo${args.tipoCorreo}`);
      return { estadoEnvio: "enviado" };
    });

    await pedir({ cotizacionId: "c1" });

    expect(orden).toEqual(["cerrar", "correo4"]);
  });
});

// 4.7.8 — El enlace NO se revoca al decidir (ADR 0007), pero la pantalla no puede seguir
// ofreciendo decidir cuando la solicitud ya no está en espera: el POST lo rechazaría con 409.
// Este GET le dice a la vista pública qué mostrar al recargar (tarjetas, "ya decidió" o
// "volvió a Compras"). Sin él, la pantalla miente hasta que la persona intenta decidir de nuevo.
describe("estado del enlace · la pantalla no ofrece decidir dos veces", () => {
  it("en espera: puede decidir y no hay decisión previa", async () => {
    const res = await pedirEstado();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      estado: "ENVIADA_A_SOLICITANTE",
      puedeDecidir: true,
      vuelveACompras: false,
      decision: null,
    });
  });

  it("ya decidió: no puede decidir y devuelve qué opción eligió", async () => {
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, estado: "CERRADA_CON_DECISION" });
    obtenerDecisionPorSolicitud.mockResolvedValue({
      id: "d1",
      comparativaId: "cmp-1",
      cotizacionSeleccionadaId: "c1",
      decididoPorEmail: "mj.e2e@biabrands.co",
      fechaDecision: "2026-10-01T00:00:00Z",
      ningunaOpcion: false,
    });

    const body = await (await pedirEstado()).json();

    expect(body.puedeDecidir).toBe(false);
    expect(body.vuelveACompras).toBe(false);
    expect(body.decision).toMatchObject({ cotizacionSeleccionadaId: "c1", ningunaOpcion: false });
  });

  it("'ninguna me sirve': la solicitud volvió a Compras y ya no se decide", async () => {
    obtenerSolicitud.mockResolvedValue({ ...SOLICITUD, estado: "EN_COTIZACION" });
    obtenerDecisionPorSolicitud.mockResolvedValue({
      id: "d1",
      comparativaId: "cmp-1",
      decididoPorEmail: "mj.e2e@biabrands.co",
      fechaDecision: "2026-10-01T00:00:00Z",
      ningunaOpcion: true,
    });

    const body = await (await pedirEstado()).json();

    expect(body.puedeDecidir).toBe(false);
    expect(body.vuelveACompras).toBe(true);
  });

  it("enlace inválido → 404", async () => {
    obtenerLinkPorToken.mockResolvedValue(null);
    expect((await pedirEstado()).status).toBe(404);
  });

  it("enlace revocado → 403 (no filtra estado)", async () => {
    obtenerLinkPorToken.mockResolvedValue({ comparativaId: "cmp-1", revocado: true, fechaExpiracion: null });
    expect((await pedirEstado()).status).toBe(403);
  });

  it("enlace expirado → 403", async () => {
    obtenerLinkPorToken.mockResolvedValue({ comparativaId: "cmp-1", revocado: false, fechaExpiracion: "2020-01-01T00:00:00Z" });
    expect((await pedirEstado()).status).toBe(403);
  });
});