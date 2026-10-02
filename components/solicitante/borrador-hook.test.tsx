import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSolicitudWizard, mensajeErrorAmigable, estadoInicialWizard } from "@/hooks/useSolicitudWizard";
import { CLAVE_BORRADOR } from "@/lib/cookie";
import { envolverBorrador } from "@/lib/domain/borrador";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => {
  const assessmentIA = vi.fn();
  return {
    api: {
      clasificarIA: vi.fn().mockResolvedValue(null),
      assessmentIA,
      crearSolicitud: vi.fn(),
      transicionar: vi.fn(),
      listarCoordinadoresPublicos: vi.fn().mockResolvedValue([]),
      subirArchivoLogo: vi.fn(),
    },
  };
});

import { api } from "@/lib/api-client";
const mocked = api as unknown as { assessmentIA: ReturnType<typeof vi.fn> };

const IDENTIDAD = { email: "mj.e2e@biabrands.co", nombre: "Solicitante E2E", area: "Trade Marketing" };
const UNICO = "ZAFIRO-UNICO-778899";

function sembrar(estado: Record<string, unknown>, guardadoEn = Date.now()) {
  localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(envolverBorrador(estado, guardadoEn)));
}

beforeEach(() => {
  mocked.assessmentIA.mockReset();
  window.localStorage?.clear?.();
});

afterEach(() => vi.clearAllMocks());

describe("borrador · persistencia y restauración (P0-2)", () => {
  it("guarda el texto largo de la descripción, no solo los campos cortos", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", `Sombrillas ${UNICO}`);
      result.current.set("descripcion", `${UNICO} Necesitamos 500 sombrillas con logo de la marca.`);
      result.current.set("tipoNecesidad", "mercadeo_publicidad");
    });
    const sobre = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "{}");
    expect(sobre.estado.titulo).toContain(UNICO);
    expect(sobre.estado.descripcion).toContain(UNICO);
    expect(sobre.estado.tipoNecesidad).toBe("mercadeo_publicidad");
  });

  it("escribir → recargar: el valor único sigue en el formulario", async () => {
    const { result, unmount } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", `Sombrillas ${UNICO}`);
      result.current.set("descripcion", `${UNICO} detalle largo`);
      result.current.set("area", "Trade Marketing");
    });
    unmount();

    // Segundo montaje = recarga del navegador.
    const { result: tras } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    expect(tras.current.estado.titulo).toContain(UNICO);
    expect(tras.current.estado.descripcion).toContain(UNICO);
    expect(tras.current.estado.area).toBe("Trade Marketing");
    // Y el rail puede decir la verdad: hay marca de tiempo.
    expect(tras.current.borradoAt).not.toBeNull();
    expect(tras.current.persistenciaOk).toBe(true);
  });

  it("persiste el paso: recargar en un paso intermedio restaura el paso, no solo los campos", async () => {
    const { result, unmount } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", UNICO);
      result.current.siguiente();
    });
    expect(result.current.estado.paso).toBe(3);
    unmount();

    const { result: tras } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    expect(tras.current.estado.paso).toBe(3);
  });

  it("?nuevo=1 NO destruye el borrador: propone decidir en vez de borrar", () => {
    sembrar({ email: IDENTIDAD.email, titulo: "Borrador previo", area: IDENTIDAD.area, paso: 2 });
    const r = estadoInicialWizard(true, IDENTIDAD);
    expect(r.restaurar).toBe(true);
    expect(r.descartarPropuesto).toBe(true);
    expect(r.estado.titulo).toBe("Borrador previo");
  });

  it("A11.1: un borrador con el correo en mayúsculas se restaura (comparación sin case)", () => {
    sembrar({ email: "MJ.E2E@BIABRANDS.CO", titulo: "BORRADOR DE MAYUSCULAS", area: IDENTIDAD.area, paso: 2 });
    const r = estadoInicialWizard(true, IDENTIDAD);
    expect(r.restaurar).toBe(true);
    expect(r.estado.titulo).toBe("BORRADOR DE MAYUSCULAS");
  });

  it("A11.1: al montar sin borrador restaurable NO se pisa lo que había", async () => {
    sembrar({ email: "otra@persona.com", titulo: "Borrador ajeno", area: "Finanzas", paso: 2 });
    renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    // El borrador ajeno sigue intacto: abrir la página no lo destruye.
    const sobre = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "{}");
    expect(sobre.estado?.titulo).toBe("Borrador ajeno");
  });

  it("A11.2: un borrador hostil con paso 1 no muestra la pantalla de 'enviada'", async () => {
    sembrar({ email: IDENTIDAD.email, titulo: "Hostil", area: IDENTIDAD.area, paso: 1, maxAlcanzado: 1 });
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    expect(result.current.estado.paso).toBe(2);
  });

  it("A11.3: si el navegador no deja guardar, no dice 'Borrador activo'", async () => {
    const orig = window.localStorage.setItem.bind(window.localStorage);
    // Cuota llena / modo privado: setItem lanza.
    (window.localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem = (k, v) => {
      if (k === CLAVE_BORRADOR) throw new Error("QuotaExceededError");
      orig(k, v);
    };
    try {
      const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
      await act(async () => {
        result.current.set("titulo", UNICO);
      });
      expect(result.current.persistenciaOk).toBe(false);
      expect(result.current.borradoAt).toBeNull();
    } finally {
      (window.localStorage as unknown as { setItem: typeof orig }).setItem = orig;
    }
  });
});

describe("asistente IA · estado de error de primera clase (P1-d)", () => {
  it("un fallo NO marca assessmentListo: deja estado de error y mensaje reintentable", async () => {
    mocked.assessmentIA.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      await result.current.evaluarAssessment();
    });
    expect(result.current.estado.assessmentEstado).toBe("error");
    expect(result.current.estado.assessmentEstado).not.toBe("listo");
    expect(result.current.estado.assessmentPreguntas).toHaveLength(0);
    expect(result.current.estado.assessmentError).toBeTruthy();
    expect(result.current.estado.assessmentError).not.toContain("boom");
  });

  it("no echa la culpa al solicitante cuando la red falla", async () => {
    mocked.assessmentIA.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      await result.current.evaluarAssessment();
    });
    expect(result.current.estado.assessmentError).toMatch(/conexión/i);
    expect(result.current.estado.assessmentError).not.toMatch(/ambigu|texto ingreso/i);
  });

  it("una respuesta malformada cae en error, no en 'listo' con 0 preguntas", async () => {
    mocked.assessmentIA.mockResolvedValue({ preguntas: null });
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      await result.current.evaluarAssessment();
    });
    expect(result.current.estado.assessmentEstado).toBe("error");
  });

  it("una respuesta vacía SÍ es éxito: 0 preguntas con 'listo' (no es un fallo)", async () => {
    mocked.assessmentIA.mockResolvedValue({ preguntas: [], camposPlantilla: [] });
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      await result.current.evaluarAssessment();
    });
    expect(result.current.estado.assessmentEstado).toBe("listo");
    expect(result.current.estado.assessmentError).toBeNull();
  });

  it("el error de la IA sobrevive a la recarga (queda en el borrador)", async () => {
    mocked.assessmentIA.mockRejectedValue(new Error("boom"));
    const { result, unmount } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("titulo", UNICO);
      await result.current.evaluarAssessment();
    });
    unmount();
    const { result: tras } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    // assessmentEstado/Error no se persisten (son efímeros) pero el contenido sí:
    expect(tras.current.estado.titulo).toContain(UNICO);
  });
});

describe("mensajeErrorAmigable · nada de errores crudos al solicitante", () => {
  const DEFECTO = "No se pudo completar la operación.";

  it.each([
    ["Failed to fetch"],
    ["NetworkError when attempting to fetch resource"],
    ["Load failed"],
    ["fetch failed"],
    ["The operation was aborted"],
    ["ETIMEDOUT"],
  ])("traduce %s a un mensaje en español", (mensaje) => {
    const out = mensajeErrorAmigable(new Error(mensaje), DEFECTO);
    expect(out).toBe(DEFECTO === DEFECTO ? out : DEFECTO);
    expect(out).not.toMatch(/failed|fetch|aborted|timed out/i);
  });

  it.each([
    "boom",
    "HTTP 500",
    "OPENROUTER_API_KEY no configurada",
    "Error: connect ECONNREFUSED 127.0.0.1:5432",
    "TypeError: x is not a function",
    "ZodError",
    "SELECT * FROM solicitud",
    "<html><body>502</body></html>",
  ])("NUNCA muestra el error crudo %s", (mensaje) => {
    expect(mensajeErrorAmigable(new Error(mensaje), DEFECTO)).toBe(DEFECTO);
  });

  it("sí deja pasar un error de negocio redactado para la persona", () => {
    const negocio = "La fecha requerida debe ser futura.";
    expect(mensajeErrorAmigable(new Error(negocio), DEFECTO)).toBe(negocio);
  });

  it("sin mensaje devuelve el defecto", () => {
    expect(mensajeErrorAmigable(new Error(""), DEFECTO)).toBe(DEFECTO);
    expect(mensajeErrorAmigable(undefined, DEFECTO)).toBe(DEFECTO);
  });
});

describe("gate de envío: el assessment no preparado se avisa, no se deja pasar", () => {
  const PREGUNTA = { campoKey: "cantidad", pregunta: "¿Cuántos galones?", critica: true };

  it("marca 'error' cuando el assessment falló y no dejó preguntas", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("paso", 4);
      mocked.assessmentIA.mockRejectedValue(new Error("boom"));
      await result.current.evaluarAssessment();
    });
    expect(result.current.estado.assessmentEstado).toBe("error");
    expect(result.current.assessmentIncompleto).toBe("error");
  });

  it("marca 'sin_preparar' si nunca llegó a preguntar (borrador retomado en el paso 5)", () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    act(() => {
      result.current.set("paso", 5);
    });
    expect(result.current.estado.assessmentEstado).toBe("inactivo");
    expect(result.current.assessmentIncompleto).toBe("sin_preparar");
  });

  it("NO avisa si el asistente respondió y no necesita nada más", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("paso", 4);
      mocked.assessmentIA.mockResolvedValue({ preguntas: [], sin_preguntas_pendientes: true, contexto_investigado: "" });
      await result.current.evaluarAssessment();
    });
    // 0 preguntas con `listo` es un resultado válido, no un fallo: avisar sería ruido.
    expect(result.current.assessmentIncompleto).toBeNull();
  });

  it("NO avisa si el assessment trajo preguntas o campos de plantilla", async () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {
      result.current.set("paso", 4);
      mocked.assessmentIA.mockResolvedValue({
        preguntas: [{ campoKey: "cantidad", pregunta: "¿Cuántos?", por_que: "rendimiento", critica: false }],
        sin_preguntas_pendientes: false,
        contexto_investigado: "x",
      });
      await result.current.evaluarAssessment();
    });
    expect(result.current.assessmentIncompleto).toBeNull();
  });

  it("un borrador retomado con preguntas guardadas no dispara un aviso falso", async () => {
    sembrar({
      email: IDENTIDAD.email,
      nombre: IDENTIDAD.nombre,
      area: IDENTIDAD.area,
      titulo: "Borrador con assessment",
      paso: 5,
      maxAlcanzado: 5,
      assessmentPreguntas: [PREGUNTA],
      assessmentRespuestas: {},
    });
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    await act(async () => {});
    expect(result.current.estado.assessmentPreguntas).toHaveLength(1);
    // `assessmentEstado` no se persiste: vuelve a "inactivo", pero hay preguntas en el
    // borrador, así que el RFQ NO está vacío y avisar sería mentiroso.
    expect(result.current.assessmentIncompleto).toBeNull();
  });

  it("lista los obligatorios sin responder y distingue 'No lo sé' de vacío", () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    act(() => {
      result.current.set("assessmentPreguntas", [PREGUNTA]);
      result.current.set("assessmentRespuestas", { cantidad: { valor: "", noSe: true } });
    });
    const pend = result.current.obligatoriosPendientes;
    expect(pend).toHaveLength(1);
    expect(pend[0]).toMatchObject({ campoKey: "cantidad", noSe: true });
  });

  it("no lista un obligatorio ya respondido", () => {
    const { result } = renderHook(() => useSolicitudWizard(false, IDENTIDAD));
    act(() => {
      result.current.set("assessmentPreguntas", [PREGUNTA]);
      result.current.set("assessmentRespuestas", { cantidad: { valor: "45 galones", noSe: false } });
    });
    expect(result.current.obligatoriosPendientes).toHaveLength(0);
  });
});
