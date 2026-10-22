import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Badge, Button, Panel, Segmented } from "./primitives";
import { EmptyState, TextField } from "./forms";

describe("kit de UI (DESIGN.md §6)", () => {
  it("Button conserva el texto y aplica la variante primaria", () => {
    render(<Button>Nueva solicitud</Button>);
    const b = screen.getByRole("button", { name: "Nueva solicitud" });
    expect(b.className).toContain("bg-primary");
  });

  it("Badge usa el tono crítico y no inventa color", () => {
    render(<Badge tone="critical">Vencida</Badge>);
    expect(screen.getByText("Vencida").className).toContain("text-critical");
  });

  it("Panel expone su título y subtítulo", () => {
    render(
      <Panel title="Solicitudes por día" subtitle="Últimos 14 días">
        <p>contenido</p>
      </Panel>
    );
    expect(screen.getByRole("heading", { name: "Solicitudes por día" })).toBeInTheDocument();
    expect(screen.getByText("Últimos 14 días")).toBeInTheDocument();
  });

  it("TextField asocia label, error y aria-invalid", () => {
    render(<TextField label="Correo" error="Correo inválido" defaultValue="x" />);
    expect(screen.getByLabelText("Correo")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Correo inválido")).toBeInTheDocument();
  });

  it("Segmented es un radiogroup y avisa el cambio", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        id="rango"
        label="Rango"
        value="hoy"
        onChange={onChange}
        options={[
          { value: "hoy", label: "Hoy" },
          { value: "semana", label: "Semana" },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Semana" }));
    expect(onChange).toHaveBeenCalledWith("semana");
    expect(screen.getByRole("radiogroup", { name: "Rango" })).toBeInTheDocument();
  });

  it("EmptyState dice qué pasó y ofrece la acción", () => {
    render(<EmptyState icon="search" title="Sin resultados" message="Pruebe otro filtro." action="Limpiar" onAction={() => {}} />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeInTheDocument();
  });
});
