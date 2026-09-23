import { describe, it, expect } from "vitest";
import { calcularSemaforo, duracionAtencion, fechaInput, formatoFechaLegible } from "./semaforo";

describe("calcularSemaforo", () => {
  const now = "2026-09-16T12:00:00Z";
  const base = { estado: "ENVIADA_A_COMPRAS" as const, now };

  it("retraso cuando la fecha requerida ya pasó", () => {
    const r = calcularSemaforo({ ...base, fechaRequerida: "2026-09-10" });
    expect(r.nivel).toBe("retraso");
    expect(r.texto).toContain("Retrasada");
  });

  it("riesgo cuando quedan 1-2 días", () => {
    const r = calcularSemaforo({ ...base, fechaRequerida: "2026-09-17" });
    expect(r.nivel).toBe("riesgo");
  });

  it("ok cuando hay margen amplio", () => {
    const r = calcularSemaforo({ ...base, fechaRequerida: "2026-10-09" });
    expect(r.nivel).toBe("ok");
  });

  it("cerradas no generan semáforo", () => {
    const r = calcularSemaforo({ estado: "CERRADA_CON_DECISION", fechaRequerida: "2026-09-10", now });
    expect(r.nivel).toBe("ok");
    expect(r.texto).toBe("Cerrada");
  });

  it("sin fecha requerida no genera semáforo", () => {
    const r = calcularSemaforo({ ...base });
    expect(r.nivel).toBe("ok");
  });

  it("parsea fechas en formato Date.toString() ('Mon Oct 05 2026…')", () => {
    const r = calcularSemaforo({ ...base, fechaRequerida: "Mon Oct 05 2026 00:00:00 GMT-0600 (Central Standard Time)" });
    expect(r.nivel).toBe("ok");
    expect(r.diasRestantes).not.toBeNull();
  });

  it("fecha ilegible no rompe (sin fecha límite)", () => {
    const r = calcularSemaforo({ ...base, fechaRequerida: "no aplica" });
    expect(r.nivel).toBe("ok");
    expect(r.diasRestantes).toBeNull();
  });
});

describe("duracionAtencion", () => {
  const now = "2026-09-16T12:00:00Z";

  it("acumula días en solicitudes abiertas", () => {
    const r = duracionAtencion({ fechaCreacion: "2026-09-10T10:00:00Z", now });
    expect(r.cerrada).toBe(false);
    expect(r.dias).toBeGreaterThan(6);
    expect(r.dias).toBeLessThan(7);
  });

  it("mide punta a punta en cerradas", () => {
    const r = duracionAtencion({ fechaCreacion: "2026-09-01T10:00:00Z", fechaCierre: "2026-09-15T10:00:00Z", now });
    expect(r.cerrada).toBe(true);
    expect(r.dias).toBe(14);
  });

  it("sin fecha de creación devuelve —", () => {
    const r = duracionAtencion({ now });
    expect(r.dias).toBeNull();
    expect(r.texto).toBe("—");
  });
});

describe("formatoFechaLegible / fechaInput", () => {
  it("formatea fechas crudas de Date.toString()", () => {
    expect(formatoFechaLegible("Mon Oct 05 2026 00:00:00 GMT-0600 (Central Standard Time)")).toContain("2026");
    expect(formatoFechaLegible(undefined)).toBe("—");
  });

  it("fechaInput genera YYYY-MM-DD desde cualquier representación (crítico H12)", () => {
    expect(fechaInput("Mon Oct 05 2026 00:00:00 GMT-0600 (Central Standard Time)")).toBe("2026-10-05");
    expect(fechaInput("2026-10-05")).toBe("2026-10-05");
    expect(fechaInput("ilegible")).toBe("");
    expect(fechaInput(undefined)).toBe("");
  });

  it("YYYY-MM-DD se interpreta como fecha local (sin corrimiento de un día)", () => {
    expect(formatoFechaLegible("2026-11-15")).toContain("15");
    expect(formatoFechaLegible("2026-11-15")).not.toContain("14");
    expect(fechaInput("2026-11-15")).toBe("2026-11-15");
  });
});