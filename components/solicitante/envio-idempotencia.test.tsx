// El envío del solicitante es lo que bloquea el piloto: si falla, no hay proceso.
// Estos tests fijan las TRES garantías que lo sostienen, porque las tres son invisibles en
// la UI (el síntoma era el mismo: "no se pudo enviar").
//   1. Idempotencia: reintentar/doblar el click NO crea una segunda solicitud.
//   2. La redirección por timeout ABORTA la petición, no solo deja de esperarla.
//   3. El pipeline (PDF + correos) no puede revertir ni tapar la transición.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSolicitudWizard, conTimeout } from "@/hooks/useSolicitudWizard";
import { pipelineEnvioACompras } from "@/lib/pdf/pipeline";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const crearSolicitud = vi.fn();
const transicionar = vi.fn();
const subirArchivoLogo = vi.fn();
const listarCoordinadoresPublicos = vi.fn();

vi.mock("@/lib/api-client", () => ({
  api: {
    clasificarIA: vi.fn().mockResolvedValue(null),
    assessmentIA: vi.fn().mockResolvedValue({ preguntas: [], camposPlantilla: [] }),
    crearSolicitud: (...a: unknown[]) => crearSolicitud(...a),
    transicionar: (...a: unknown[]) => transicionar(...a),
    subirArchivoLogo: (...a: unknown[]) => subirArchivoLogo(...a),
    listarCoordinadoresPublicos: (...a: unknown[]) => listarCoordinadoresPublicos(...a),
  },
}));

const IDENTIDAD = { email: "mj.e2e@biabrands.co", nombre: "Solicitante E2E", area: "Trade Marketing" };

const SOLICITUD = {
  id: "11111111-1111-4111-8111-111111111111",
  numeroReferencia: "RFQ-2026-0001",
  estado: "ENVIADA_A_COMPRAS",
  titulo: "Sombrillas",
  solicitanteEmail: IDENTIDAD.email,
  solicitanteNombre: IDENTIDAD.nombre,
  clasificacionCorregida: false,
  notificacionFallida: false,
  fechaCreacion: "2026-09-27T00:00:00Z",
};

/** Hook con el paso 5 listo para enviar. */
async function wizardListoParaEnviar() {
  const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
  await act(async () => {
    result.current.set("titulo", "Sombrillas");
    result.current.set("descripcion", "500 sombrillas con logo");
    result.current.set("tipoNecesidad", "mercadeo");
    result.current.set("area", IDENTIDAD.area);
  });
  return result;
}

beforeEach(() => {
  crearSolicitud.mockReset();
  transicionar.mockReset();
  subirArchivoLogo.mockReset();
  window.localStorage?.clear?.();
  crearSolicitud.mockResolvedValue(SOLICITUD);
  transicionar.mockResolvedValue({ solicitud: SOLICITUD, eventoId: "e-1" });
});

afterEach(() => vi.clearAllMocks());

describe("envío · idempotencia", () => {
  it("reintentar con la MISMA clave no crea una segunda solicitud", async () => {
    const result = await wizardListoParaEnviar();
    const clave = result.current.estado.claveEnvio;
    expect(clave).toMatch(/^[0-9a-f-]{36}$/i);

    // Primer intento: la transición falla, el solicitante reintenta.
    transicionar.mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(result.current.envio.estado).toBe("error");

    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(result.current.envio.estado).toBe("ok");

    // Dos POST, la misma clave: el servidor devuelve la fila existente.
    expect(crearSolicitud).toHaveBeenCalledTimes(2);
    const claves = crearSolicitud.mock.calls.map((c) => (c[0] as { idempotencyKey?: string }).idempotencyKey);
    expect(claves).toEqual([clave, clave]);
  });

  it("la clave sobrevive a la recarga (se persiste en el borrador)", async () => {
    const result = await wizardListoParaEnviar();
    const clave = result.current.estado.claveEnvio;
    await act(async () => {
      result.current.set("descripcion", "detalle que obliga a autoguardar");
    });
    const sobre = JSON.parse(window.localStorage.getItem("bia_borrador") ?? "{}");
    expect(sobre.estado.claveEnvio).toBe(clave);

    // Montar de nuevo = recargar el navegador: la clave debe ser la misma.
    const { result: tras } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    expect(tras.current.estado.claveEnvio).toBe(clave);
  });

  it("un doble clic no arranca dos envíos", async () => {
    // La guardia es sincrónica al entrar en la función, así que dos llamadas seguidas
    // garantizan que solo una llega al servidor sin importar cuándo resuelva el import.
    const result = await wizardListoParaEnviar();
    await act(async () => {
      await Promise.all([result.current.enviarSolicitud(), result.current.enviarSolicitud()]);
    });
    expect(crearSolicitud).toHaveBeenCalledTimes(1);
    expect(transicionar).toHaveBeenCalledTimes(1);
    expect(result.current.envio.estado).toBe("ok");
  });
});

describe("envío · el techo de espera cancela de verdad", () => {
  it("al agotarse el plazo aborta la petición, no solo deja de esperarla", async () => {
    // El servidor nunca contesta: reproduce el "se tardó mucho" que reportó el solicitante.
    let abortada = false;
    const colgado = conTimeout(
      (signal) =>
        new Promise<never>(() => {
          signal.addEventListener("abort", () => {
            abortada = true;
          });
        }),
      30,
      "El envío tardó demasiado"
    );
    await expect(colgado).rejects.toThrow("El envío tardó demasiado");
    // La pieza que faltaba: sin abort, el fetch seguía vivo y el servidor terminaba la fila.
    expect(abortada).toBe(true);
  });

  it("el envío del wizard usa ese mismo techo con la señal", async () => {
    const result = await wizardListoParaEnviar();
    // Sin esperar el plazo real: la señal se propaga al fetch en el primer paso.
    let señal: AbortSignal | null = null;
    crearSolicitud.mockImplementation((_p, opts) => {
      señal = opts?.signal ?? null;
      return Promise.reject(new Error("aborted"));
    });
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(señal).not.toBeNull();
    expect(result.current.envio.estado).toBe("error");
  });
});

describe("pipeline · no decide si la solicitud se envió", () => {
  const repoBase = {
    listarCoordinadores: vi.fn().mockResolvedValue([{ id: "c-1", nombre: "Compras", categoriasAsignadas: ["mercadeo"] }]),
    asignarCoordinador: vi.fn().mockResolvedValue(undefined),
    persistirDocumento: vi.fn().mockResolvedValue({ id: "d-1" }),
    registrarCorreo: vi.fn().mockResolvedValue({ id: "m-1" }),
  };

  it("con notificar:false devuelve con el documento persistido sin esperar los correos", async () => {
    const correo = vi.fn(() => new Promise(() => {})); // nunca resuelve: si awaited, colgaría
    vi.doMock("@/lib/mail/enviar", () => ({ enviarCorreo: correo }));
    vi.resetModules();
    const { pipelineEnvioACompras: pipeline } = await import("@/lib/pdf/pipeline");
    const res = await pipeline({
      repo: repoBase as never,
      solicitud: SOLICITUD as never,
      notificar: false,
    });
    expect(res.ok).toBe(true);
    expect(res.documentoId).toBe("d-1");
    expect(res.correoCoordinador).toBe("pendiente");
    expect(repoBase.persistirDocumento).toHaveBeenCalled();
    vi.doUnmock("@/lib/mail/enviar");
  });

  it("si el PDF falla lo reporta, sin lanzar (quien llama decide)", async () => {
    vi.doMock("@/lib/pdf/generador", () => ({
      generarDocumento: vi.fn().mockRejectedValue(new Error("pdfme explota")),
    }));
    vi.resetModules();
    const { pipelineEnvioACompras: pipeline } = await import("@/lib/pdf/pipeline");
    const res = await pipeline({
      repo: repoBase as never,
      solicitud: SOLICITUD as never,
      respuestas: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("pdfme");
    vi.doUnmock("@/lib/pdf/generador");
  });
});

// El import está arriba para que el mock de `api-client` aplique a este módulo; se re-limpia
// al final para no arrastrar el mock de `generador` a otros archivos del suite.
afterEach(async () => {
  vi.doUnmock("@/lib/pdf/generador");
  vi.doUnmock("@/lib/mail/enviar");
  void pipelineEnvioACompras;
});
