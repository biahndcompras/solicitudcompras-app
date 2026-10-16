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

/**
 * 4.7.7 / RN-04 — El solicitante puede corregir el tipo que sugirió la IA. Ese hecho (no el
 * tipo en sí) es lo que alimenta la métrica de precisión del clasificador (doc 16); si no
 * viaja en el payload de creación, nadie puede contar cuántas veces el modelo acertó.
 */
describe("envío · la corrección de clasificación viaja al servidor (4.7.7 / RN-04)", () => {
  it("manda clasificacionCorregida=true cuando el solicitante corrigió el tipo de la IA", async () => {
    const result = await wizardListoParaEnviar();
    await act(async () => {
      result.current.set("clasificacionCorregida", true);
    });
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(result.current.envio.estado).toBe("ok");
    expect(crearSolicitud.mock.calls[0][0]).toMatchObject({ clasificacionCorregida: true });
  });

  it("manda clasificacionCorregida=false cuando aceptó la sugerencia", async () => {
    const result = await wizardListoParaEnviar();
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(result.current.envio.estado).toBe("ok");
    expect(crearSolicitud.mock.calls[0][0]).toMatchObject({ clasificacionCorregida: false });
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

describe("envío · no se manda una solicitud vencida o sin descripción (4.5.2 / 4.5.3)", () => {
  it("una fecha requerida ya pasada se explica y no llega al servidor", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", "Sombrillas");
      result.current.set("descripcion", "500 sombrillas con logo");
      result.current.set("fechaRequerida", "2020-01-01");
    });
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(crearSolicitud).not.toHaveBeenCalled();
    expect(result.current.envio.estado).toBe("error");
    expect(JSON.stringify(result.current.envio)).toMatch(/fecha/i);
    expect(JSON.stringify(result.current.envio)).toMatch(/hoy|futur/i);
  });

  it("sin descripción se explica y no llega al servidor", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", "Sombrillas");
      result.current.set("fechaRequerida", "2999-01-01");
    });
    await act(async () => {
      await result.current.enviarSolicitud();
    });
    expect(crearSolicitud).not.toHaveBeenCalled();
    expect(result.current.envio.estado).toBe("error");
    expect(JSON.stringify(result.current.envio)).toMatch(/descripci/i);
  });
});

// El logo viaja DESPUÉS de crear la solicitud, en un POST aparte que antes no validaba nada:
// cualquiera con el UUID podía reemplazar el material de marca ajeno. Ahora el servidor exige
// el correo del solicitante, así que el cliente TIENE que mandarlo; si el hook dejara de
// pasarlo, la subida fallaría con 401 en producción y este test lo caza antes.
describe("envío · el logo viaja con la identidad del solicitante", () => {
  // El `File` de jsdom no implementa `arrayBuffer()`, que es lo que usan tanto la validación
  // del hook como el route. Un `File` real (pasa el `instanceof`) con los bytes de un PNG.
  function archivoPngFalso(): File {
    const f = Object.create(File.prototype) as File;
    Object.defineProperties(f, {
      name: { value: "logo.png" },
      size: { value: 8 },
      // `type` se define como propiedad propia a propósito: el getter de Blob de jsdom hace un
      // brand-check y este objeto no es un Blob real por dentro ("'get type' called on an object
      // that is not a valid instance of Blob").
      type: { value: "image/png" },
      arrayBuffer: {
        value: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer,
      },
    });
    return f;
  }

  it("sube el logo pasando el correo del solicitante", async () => {
    const result = await wizardListoParaEnviar();
    await act(async () => {
      await result.current.elegirArchivoLogo(archivoPngFalso());
    });
    expect(result.current.estado.archivoLogo).toBe("logo.png");

    await act(async () => {
      await result.current.enviarSolicitud();
    });

    expect(subirArchivoLogo).toHaveBeenCalledTimes(1);
    const [id, , opts] = subirArchivoLogo.mock.calls[0] as [string, unknown, { email?: string }];
    expect(id).toBe(SOLICITUD.id);
    expect(opts?.email).toBe(IDENTIDAD.email);
  });
});

// El import está arriba para que el mock de `api-client` aplique a este módulo; se re-limpia
// al final para no arrastrar el mock de `generador` a otros archivos del suite.
afterEach(async () => {
  vi.doUnmock("@/lib/pdf/generador");
  vi.doUnmock("@/lib/mail/enviar");
  void pipelineEnvioACompras;
});
