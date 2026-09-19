import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemParoBadge } from "./Semaforo";

describe("SemParoBadge", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-09-16T12:00:00Z")));
  afterEach(() => vi.useRealTimers());

  const base = { id: "s1", titulo: "t", estado: "ENVIADA_A_COMPRAS", fechaCreacion: "2026-09-10T10:00:00Z" };

  it("marca como retrasada cuando la fecha requerida ya venció", () => {
    render(<SemParoBadge solicitud={{ ...base, fechaRequerida: "2026-09-10" }} />);
    expect(screen.getByText(/Retrasada/)).toBeInTheDocument();
  });

  it("no muestra badge en solicitudes cerradas", () => {
    render(<SemParoBadge solicitud={{ ...base, estado: "CERRADA_CON_DECISION", fechaRequerida: "2026-09-10" }} />);
    expect(screen.queryByText(/Retrasada/)).toBeNull();
  });

  it("muestra margen amplio en ok", () => {
    render(<SemParoBadge solicitud={{ ...base, fechaRequerida: "2026-10-09" }} />);
    expect(screen.getByText(/días de margen/)).toBeInTheDocument();
  });
});