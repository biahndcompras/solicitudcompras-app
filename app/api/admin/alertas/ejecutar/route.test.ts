// Correo 5 (alerta de inactividad). Dos huecos que se veían recién al apretar "Ejecutar
// alertas" en producción:
//
// 4.9.4 — el correo iba SOLO al `destinatario_alertas` global. El coordinador que tiene la
// solicitud asignada —el único que puede destrabarla— no recibía nada. Debe ir a los dos.
//
// 4.11.7 — el disparador es manual (y hay cron): sin marcador, cada clic reenviaba el correo a
// las mismas solicitudes. Ahora se guarda hasta qué movimiento se avisó y solo se re-avisa si la
// solicitud volvió a moverse y quedó inactiva otra vez.
import { describe, it, expect, vi, beforeEach } from "vitest";

const enviarCorreo = vi.fn();
const leerConfig = vi.fn();
const listarTodas = vi.fn();
const listarCotizaciones = vi.fn();
const listarEventos = vi.fn();
const listarCoordinadores = vi.fn();
const informacionVencida = vi.fn();
const marcarRecordatorioInformacion = vi.fn();
const marcarAlertaInactividad = vi.fn();
const alertasInactividadAvisadas = vi.fn();
const obtenerComparativaPorSolicitudId = vi.fn();

vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/api-guard", () => ({
  guardApi: async () => ({ sesion: { rol: "admin" } }),
}));
vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    leerConfig = (...a: unknown[]) => leerConfig(...a);
    listarTodas = (...a: unknown[]) => listarTodas(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    listarEventos = (...a: unknown[]) => listarEventos(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
    informacionVencida = (...a: unknown[]) => informacionVencida(...a);
    marcarRecordatorioInformacion = (...a: unknown[]) => marcarRecordatorioInformacion(...a);
    marcarAlertaInactividad = (...a: unknown[]) => marcarAlertaInactividad(...a);
    alertasInactividadAvisadas = (...a: unknown[]) => alertasInactividadAvisadas(...a);
    obtenerComparativaPorSolicitudId = (...a: unknown[]) => obtenerComparativaPorSolicitudId(...a);
  },
}));

import { POST as ejecutar } from "./route";

// Movimiento a 20 días: por debajo del umbral de inactividad por defecto (5).
const MOV = new Date(Date.now() - 20 * 86400000).toISOString();
const MOV_MS = new Date(MOV).getTime();

function solicitud(over: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    numeroReferencia: "RFQ-2026-0001",
    titulo: "Sombrillas",
    estado: "ENVIADA_A_COMPRAS",
    solicitanteEmail: "solicitante@bia.hn",
    solicitanteNombre: "Solicitante",
    fechaCreacion: MOV,
    fechaEnvio: MOV,
    coordinadorId: "coord-1",
    clasificacionCorregida: false,
    notificacionFallida: false,
    ...over,
  };
}

const correos5 = () =>
  enviarCorreo.mock.calls
    .map((c) => c[0] as { tipoCorreo: string; destinatario: string })
    .filter((a) => a.tipoCorreo === "5");
const destinatarios5 = () => correos5().map((a) => a.destinatario);

function config(valores: Record<string, unknown>) {
  leerConfig.mockImplementation(async (clave: string) => valores[clave] ?? null);
}

beforeEach(() => {
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
  listarTodas.mockReset().mockResolvedValue([solicitud()]);
  listarCotizaciones.mockReset().mockResolvedValue([]);
  listarEventos.mockReset().mockResolvedValue([]);
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", nombre: "Bryan Bonilla", email: "bbonilla@biabrands.co", activo: true, categoriasAsignadas: [] },
  ]);
  informacionVencida.mockReset().mockResolvedValue([]);
  marcarRecordatorioInformacion.mockReset().mockResolvedValue(undefined);
  marcarAlertaInactividad.mockReset().mockResolvedValue(undefined);
  alertasInactividadAvisadas.mockReset().mockResolvedValue({});
  obtenerComparativaPorSolicitudId.mockReset().mockResolvedValue(null);
  config({ umbral_dias_sin_movimiento: 5, destinatario_alertas: "alertas@bia.hn", recordatorio_informacion_dias: 3 });
});

function ejecutarCon(body: Record<string, unknown>) {
  return ejecutar(
    new Request("http://localhost/api/admin/alertas/ejecutar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

// Sin cuerpo: el default es procesar todos los tipos (compatibilidad con el disparo previo).
function ejecutarSinCuerpo() {
  return ejecutar(new Request("http://localhost/api/admin/alertas/ejecutar", { method: "POST" }));
}

describe("4.9.4 · el correo 5 llega al coordinador afectado y a administración", () => {
  it("se envía al coordinador asignado y al destinatario global", async () => {
    const res = await ejecutarSinCuerpo();
    expect(res.status).toBe(200);

    expect(destinatarios5().sort()).toEqual(["alertas@bia.hn", "bbonilla@biabrands.co"]);
  });

  it("sin coordinador asignado cae al alias y sigue avisando a administración", async () => {
    process.env.MAIL_COORDINADOR_DEFAULT = "compras@bia.hn";
    listarTodas.mockResolvedValue([solicitud({ coordinadorId: undefined })]);

    await ejecutarSinCuerpo();

    expect(destinatarios5().sort()).toEqual(["alertas@bia.hn", "compras@bia.hn"]);
  });

  it("no repite el correo si el coordinador y administración son el mismo buzón", async () => {
    listarCoordinadores.mockResolvedValue([
      { id: "coord-1", nombre: "Compras", email: "alertas@bia.hn", activo: true, categoriasAsignadas: [] },
    ]);

    await ejecutarSinCuerpo();

    expect(destinatarios5()).toEqual(["alertas@bia.hn"]);
  });

  it("sin coordinador ni alias ni administración no se envía el correo 5", async () => {
    delete process.env.MAIL_COORDINADOR_DEFAULT;
    config({ umbral_dias_sin_movimiento: 5, destinatario_alertas: "", recordatorio_informacion_dias: 3 });
    listarTodas.mockResolvedValue([solicitud({ coordinadorId: undefined })]);

    const res = await ejecutarSinCuerpo();
    const body = await res.json();

    expect(destinatarios5()).toEqual([]);
    expect(body.correosEnviados).toBe(0);
  });

  it("el solicitante nunca recibe la alerta", async () => {
    await ejecutarSinCuerpo();
    expect(destinatarios5()).not.toContain("solicitante@bia.hn");
  });

  it("el cuerpo describe el estado real de la solicitud, no el título", async () => {
    await ejecutarSinCuerpo();

    const datos = enviarCorreo.mock.calls[0][0] as { datos: { estadoActual?: string; titulo?: string } };
    expect(datos.datos.estadoActual).toBe("ENVIADA_A_COMPRAS");
    expect(datos.datos.titulo).toBe("Sombrillas");
  });
});

describe("4.11.7 · el aviso no se repite por el mismo movimiento", () => {
  it("un segundo clic sobre la misma solicitud no vuelve a enviar", async () => {
    alertasInactividadAvisadas.mockResolvedValue({ "sol-1": MOV_MS });

    const res = await ejecutarSinCuerpo();
    const body = await res.json();

    expect(destinatarios5()).toEqual([]);
    expect(body.correosEnviados).toBe(0);
    expect(marcarAlertaInactividad).not.toHaveBeenCalled();
  });

  it("marca el aviso con el movimiento actual tras enviar", async () => {
    await ejecutarSinCuerpo();

    expect(marcarAlertaInactividad).toHaveBeenCalledWith("sol-1", MOV_MS);
  });

  it("si la solicitud se movió después del último aviso, vuelve a avisar", async () => {
    // Avisado por un movimiento más viejo: la solicitud se movió y volvió a frenar.
    alertasInactividadAvisadas.mockResolvedValue({ "sol-1": MOV_MS - 1000 });

    await ejecutarSinCuerpo();

    expect(destinatarios5().length).toBeGreaterThan(0);
    expect(marcarAlertaInactividad).toHaveBeenCalledWith("sol-1", MOV_MS);
  });

  it("si todos los envíos fallan, NO marca: el próximo clic reintenta", async () => {
    enviarCorreo.mockResolvedValue({ estadoEnvio: "fallido" });

    const res = await ejecutarSinCuerpo();
    const body = await res.json();

    expect(marcarAlertaInactividad).not.toHaveBeenCalled();
    expect(body.correosEnviados).toBe(0);
  });
});

// 4.4.10 — la alerta de discrepancia nunca se emitía porque la ruta jamás le pasaba a
// `detectarAlertas` el mapa `discrepanciasPorSolicitud`, aunque el dato vive en la tabla
// `comparativa` (`discrepancias_detectadas`). Además el panel decía "N enviadas" contando
// alertas detectadas en vez de correos reales, y no había forma de elegir tipos ni de
// previsualizar antes de disparar.
describe("4.4.10 · discrepancia sale de la comparativa guardada", () => {
  it("emite discrepancia cuando la comparativa registra discrepancias", async () => {
    obtenerComparativaPorSolicitudId.mockResolvedValue({
      discrepanciasDetectadas: [{ aspecto: "material", severidad: "alta" }],
    });

    const res = await ejecutarCon({ tipos: ["discrepancia"], preview: true });
    const body = await res.json();

    expect(body.alertas).toHaveLength(1);
    expect(body.alertas[0].tipo).toBe("discrepancia");
    expect(body.alertas[0].solicitudId).toBe("sol-1");
  });

  it("no emite discrepancia cuando la comparativa no tiene ninguna", async () => {
    obtenerComparativaPorSolicitudId.mockResolvedValue({ discrepanciasDetectadas: [] });

    const res = await ejecutarCon({ tipos: ["discrepancia"], preview: true });
    const body = await res.json();

    expect(body.alertas).toEqual([]);
  });

  it("no consulta la comparativa si el tipo discrepancia no fue elegido", async () => {
    await ejecutarCon({ tipos: ["inactividad"], preview: true });
    expect(obtenerComparativaPorSolicitudId).not.toHaveBeenCalled();
  });
});

describe("4.4.10 · selección por tipo y preview", () => {
  it("filtra lo detectado al tipo elegido", async () => {
    // Solicitud inactiva y, además, con una sola cotización.
    listarCotizaciones.mockResolvedValue([{ id: "c1", proveedorNombre: "A", impuestosDesglosados: true }]);

    const res = await ejecutarCon({ tipos: ["una_sola_cotizacion"], preview: true });
    const body = await res.json();

    expect(body.alertas.every((a: { tipo: string }) => a.tipo === "una_sola_cotizacion")).toBe(true);
    expect(body.alertas.some((a: { tipo: string }) => a.tipo === "inactividad")).toBe(false);
  });

  it("el preview no envía correo ni marca el aviso", async () => {
    const res = await ejecutarCon({ tipos: ["inactividad"], preview: true });
    const body = await res.json();

    expect(body.alertas.length).toBeGreaterThan(0);
    expect(body.correosEnviados).toBe(0);
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(marcarAlertaInactividad).not.toHaveBeenCalled();
  });

  it("los tipos distintos de inactividad no generan correo", async () => {
    listarCotizaciones.mockResolvedValue([{ id: "c1", proveedorNombre: "A", impuestosDesglosados: false }]);
    obtenerComparativaPorSolicitudId.mockResolvedValue({
      discrepanciasDetectadas: [{ aspecto: "material" }],
    });

    const res = await ejecutarCon({
      tipos: ["sin_desglose_fiscal", "una_sola_cotizacion", "discrepancia"],
    });
    const body = await res.json();

    expect(body.alertas.length).toBeGreaterThan(0);
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(body.correosEnviados).toBe(0);
  });

  it("el de-dup sigue evitando el reenvío al reejecutar el mismo tipo", async () => {
    alertasInactividadAvisadas.mockResolvedValue({ "sol-1": MOV_MS });

    const res = await ejecutarCon({ tipos: ["inactividad"] });
    const body = await res.json();

    expect(destinatarios5()).toEqual([]);
    expect(body.correosEnviados).toBe(0);
    expect(marcarAlertaInactividad).not.toHaveBeenCalled();
  });
});
