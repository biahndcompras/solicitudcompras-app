import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSolicitudWizard } from "@/hooks/useSolicitudWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => {
  const clasificarIA = vi.fn();
  return {
    api: {
      clasificarIA,
      assessmentIA: vi.fn().mockResolvedValue(null),
      crearSolicitud: vi.fn(),
      transicionar: vi.fn(),
    },
  };
});

import { api } from "@/lib/api-client";

const mockedApi = api as unknown as { clasificarIA: ReturnType<typeof vi.fn> };

async function llenarYClasificar(hook: ReturnType<typeof useSolicitudWizard>) {
  act(() => {
    hook.set("titulo", "5000 camisetas con logo");
    hook.set("tipoNecesidad", "Empaque y branding");
    hook.set("fechaRequerida", "2026-09-30");
    hook.set("area", "Marketing");
  });
  await act(async () => {
    await hook.clasificarIA();
  });
}

beforeEach(() => {
  mockedApi.clasificarIA.mockReset();
  // localStorage puede no existir en jsdom bajo Node con origen opaco (flake ambiental).
  window.localStorage?.clear?.();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Clasificación IA — hook (T008)", () => {
  it("preselecciona el tipo cuando la confianza es alta", async () => {
    mockedApi.clasificarIA.mockResolvedValue({
      tipo: "RFQ",
      subtipo: "producto",
      confianza: 0.92,
      razonamiento_breve: "Producto estándar con precio definido.",
    });

    const { result } = renderHook(() => useSolicitudWizard(true));
    await llenarYClasificar(result.current);

    expect(result.current.estado.clasificacion).toBe("RFQ");
    expect(result.current.estado.confianzaClasificacion).toBeCloseTo(0.92);
    expect(result.current.estado.razonamientoBreve.toLowerCase()).toContain("producto");
  });

  it("no preselecciona cuando la confianza es baja", async () => {
    mockedApi.clasificarIA.mockResolvedValue({
      tipo: null,
      subtipo: null,
      confianza: 0.4,
      razonamiento_breve: "Ambigüedad.",
    });

    const { result } = renderHook(() => useSolicitudWizard(true));
    await llenarYClasificar(result.current);

    // Sin preselección: confianza 0 y mantiene el default RFQ (no se pisa).
    expect(result.current.estado.confianzaClasificacion).toBe(0);
  });

  it("degrade sin error si la IA no responde", async () => {
    mockedApi.clasificarIA.mockResolvedValue(null);

    const { result } = renderHook(() => useSolicitudWizard(true));
    await llenarYClasificar(result.current);

    expect(result.current.estado.confianzaClasificacion).toBe(0);
  });
});