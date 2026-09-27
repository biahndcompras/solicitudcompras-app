// P1-4 · una solicitud terminal no ordena trabajo: la vista de cotizaciones pasa a copy de
// consulta y los avisos accionables se convierten en registro.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CargaCotizaciones } from "./CargaCotizaciones";
import type { Cotizacion } from "@/lib/domain/types";

vi.mock("@/lib/api-client", () => ({ api: {} }));

function cot(over: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: "c-1",
    solicitudId: "s-1",
    proveedorNombre: "Papelera del Valle",
    formatoOriginal: "pdf",
    moneda: "HNL",
    valorNeto: 399000,
    valorTotal: 399000,
    ...over,
  } as Cotizacion;
}

const props = (extra: Partial<React.ComponentProps<typeof CargaCotizaciones>> = {}) => ({
  solicitudId: "s-1",
  cotizaciones: [] as Cotizacion[],
  onCotizacionCargada: vi.fn(),
  onGenerar: vi.fn(),
  ...extra,
});

const IMPERATIVOS = /Cargá|Agregá|Adjuntá|Verificá|Generar comparativa|Mínimo 2|antes de generar|antes de comparar|Requiere aclaración/i;

describe("CargaCotizaciones · solicitud viva", () => {
  it("pide el trabajo con imperativos y deja las acciones disponibles", () => {
    render(<CargaCotizaciones {...props()} />);
    expect(screen.getByText(/Cargá cada oferta/)).toBeInTheDocument();
    expect(screen.getByText("Mínimo 2 para comparativa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar cotización manual/ })).toBeInTheDocument();
  });

  it("avisa de la baja confianza y de la observación fiscal como algo a revisar", () => {
    render(
      <CargaCotizaciones
        {...props({
          cotizaciones: [
            cot({
              confianzaExtraccion: { valorNeto: 0.2 },
              observacionesFiscales: "No se especifica si el precio incluye el impuesto sobre ventas.",
            }),
          ],
        })}
      />
    );
    expect(screen.getByText(/Verificá estos datos antes de generar la comparativa/)).toBeInTheDocument();
    expect(screen.getByText(/Revisión fiscal:/)).toBeInTheDocument();
  });
});

describe("CargaCotizaciones · solicitud terminal (solo lectura)", () => {
  it("cambia la cabecera a copy de consulta, sin imperativos ni umbral", () => {
    render(<CargaCotizaciones {...props({ cotizaciones: [cot(), cot({ id: "c-2" })], soloLectura: true })} />);
    expect(screen.getByRole("heading", { name: "Cotizaciones registradas" })).toBeInTheDocument();
    expect(screen.getByText("2 registradas")).toBeInTheDocument();
    expect(screen.queryByText(/Cargá cada oferta/)).toBeNull();
    expect(screen.queryByText("Mínimo 2 para comparativa")).toBeNull();
    expect(screen.queryByRole("button", { name: /Agregar cotización manual/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generar comparativa/ })).toBeNull();
  });

  it("reescribe los avisos por cotización como registro, sin órdenes", () => {
    const { container } = render(
      <CargaCotizaciones
        {...props({
          soloLectura: true,
          cotizaciones: [
            cot({
              confianzaExtraccion: { valorNeto: 0.2 },
              observacionesFiscales: "Requiere aclaración con el proveedor antes de comparar.",
            }),
          ],
        })}
      />
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/Campos que la IA marcó con baja confianza/);
    expect(texto).toMatch(/El ciclo está cerrado/);
    expect(texto).toMatch(/observación fiscal/);
    // El texto original de la IA (imperativo) no se muestra en una solicitud cerrada.
    expect(texto).not.toMatch(IMPERATIVOS);
    expect(texto).not.toContain("Requiere aclaración");
  });

  it("el estado vacío de una terminal no inventa el botón de agregar", () => {
    render(<CargaCotizaciones {...props({ soloLectura: true })} />);
    expect(screen.getByText("No se registraron cotizaciones")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay cotizaciones")).toBeNull();
  });

  it("una terminal sin ofertas no dice que se comparó '0 ofertas'", () => {
    const { container } = render(<CargaCotizaciones {...props({ soloLectura: true })} />);
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/No se registraron ofertas de proveedores para comparar/);
    expect(texto).not.toMatch(/Estas son las 0/);
    expect(screen.getByText("Sin ofertas")).toBeInTheDocument();
  });
});
