import { describe, it, expect } from "vitest";
import { calcularMetricas, tasaConversionTexto } from "./metrics";
import type { Solicitud } from "./types";

function sol(overrides: Partial<Solicitud> = {}): Solicitud {
  return {
    id: Math.random().toString(),
    estado: "ENVIADA_A_COMPRAS",
    titulo: "X",
    solicitanteEmail: "a@bia.hn",
    solicitanteNombre: "A",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

describe("metrics", () => {
  it("retorna null en vacío (sin ceros engañosos)", () => {
    const m = calcularMetricas([], { hoy: "2026-07-27" });
    expect(m.tasaConversion).toBeNull();
    expect(m.tiempoCicloPromedioDias).toBeNull();
    expect(m.solicitudesActivas).toBe(0);
  });

  it("calcula conversión (cerradas-con-decisión ÷ enviadas)", () => {
    const m = calcularMetricas(
      [
        sol({ estado: "CERRADA_CON_DECISION" }),
        sol({ estado: "CERRADA_SIN_DECISION" }),
        sol({ estado: "BORRADOR" }), // excluido del denominador
      ],
      { hoy: "2026-07-27" }
    );
    // enviadas = 2, cerradas con decisión = 1 → 50%
    expect(m.tasaConversion).toBeCloseTo(50);
  });

  it("promedia tiempo de ciclo desde eventos/cierre", () => {
    const m = calcularMetricas(
      [
        sol({ estado: "CERRADA_CON_DECISION", fechaEnvio: "2026-07-01T00:00:00Z", fechaCierre: "2026-07-11T00:00:00Z" }),
        sol({ estado: "CERRADA_CON_DECISION", fechaEnvio: "2026-07-01T00:00:00Z", fechaCierre: "2026-07-05T00:00:00Z" }),
      ],
      { hoy: "2026-07-27" }
    );
    // (10 + 4)/2 = 7 días
    expect(m.tiempoCicloPromedioDias).toBeCloseTo(7, 5);
  });

  it("cuenta activas y volumen por coordinador", () => {
    const m = calcularMetricas(
      [
        sol({ estado: "EN_COTIZACION", coordinadorId: "u1" }),
        sol({ estado: "COMPARATIVA_LISTA", coordinadorId: "u1" }),
        sol({ estado: "CERRADA_CON_DECISION", coordinadorId: "u2" }),
      ],
      { hoy: "2026-07-27" }
    );
    expect(m.solicitudesActivas).toBe(2);
    expect(m.volumenPorCoordinador.u1).toBe(2);
    expect(m.volumenPorCoordinador.u2).toBe(1);
  });

  it("formatea la tasa", () => {
    expect(tasaConversionTexto({ ...calcularMetricas([], { hoy: "" }) })).toBe("sin datos");
    const m = calcularMetricas([sol({ estado: "CERRADA_CON_DECISION" })], { hoy: "2026-07-27" });
    expect(tasaConversionTexto(m)).toBe("100%");
  });

  it("sin decisión no cuenta borradores ni usa un umbral cableado (4.10.9)", () => {
    const hace10 = "2026-07-17T00:00:00Z";
    const m = calcularMetricas(
      [
        sol({ estado: "BORRADOR", fechaCreacion: hace10 }),
        sol({ estado: "ENVIADA_A_COMPRAS", fechaCreacion: hace10 }),
      ],
      { hoy: "2026-07-27T00:00:00Z" }
    );
    // El borrador no espera decisión; la enviada de 10 días sí supera el umbral por defecto (5).
    expect(m.solicitudesSinDecision).toBe(1);
    expect(m.umbralDias).toBe(5);

    const m2 = calcularMetricas([sol({ estado: "ENVIADA_A_COMPRAS", fechaCreacion: hace10 })], {
      hoy: "2026-07-27T00:00:00Z",
      umbralDias: 20,
    });
    expect(m2.solicitudesSinDecision).toBe(0);
    expect(m2.umbralDias).toBe(20);
  });
});