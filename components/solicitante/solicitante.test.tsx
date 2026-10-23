import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SolicitanteWizard } from "./SolicitanteWizard";

// Cada test arranca sin borrador: el hook autoguarda y sin esto el borrador de un test
// se restaura en el siguiente (el wizard lee localStorage al montar).
const PARAMS_IDENTIDAD = "email=maria.reyes@bia.hn&nombre=Maria+Reyes&area=Marketing";
let params = PARAMS_IDENTIDAD;

beforeEach(() => {
  window.localStorage.clear();
  params = PARAMS_IDENTIDAD;
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(params),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("SolicitanteWizard", () => {
  it("muestra el paso de captura inicial (P2) al inicio", () => {
    render(<SolicitanteWizard />);
    expect(screen.getByText("¿Qué necesita?")).toBeInTheDocument();
  });

  it("valida al pulsar Continuar: marca los campos que faltan y no avanza", async () => {
    const user = userEvent.setup();
    render(<SolicitanteWizard />);
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).not.toBeDisabled();

    await user.click(continuar);

    expect(screen.getByText("El título es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Elija una categoría.")).toBeInTheDocument();
    expect(screen.getByText("La fecha es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("La descripción es obligatoria.")).toBeInTheDocument();
    // Sigue en el paso 1 (no avanzó a clasificación).
    expect(screen.getByText("¿Qué necesita?")).toBeInTheDocument();
  });

  it("sin correo en la URL pide el correo y no deja continuar", async () => {
    params = "nombre=Maria+Reyes&area=Marketing";
    const user = userEvent.setup();
    render(<SolicitanteWizard />);

    expect(screen.getByLabelText(/su correo institucional/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("El correo es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("¿Qué necesita?")).toBeInTheDocument();
  });

  it("el sidebar muestra los 5 pasos y no la etiqueta vieja de progreso", () => {
    render(<SolicitanteWizard />);
    expect(screen.getByText("Solicitud")).toBeInTheDocument();
    expect(screen.getByText("Captura Inicial")).toBeInTheDocument();
    expect(screen.getByText("Clasificación")).toBeInTheDocument();
    expect(screen.getByText("Detalles técnicos")).toBeInTheDocument();
    expect(screen.getByText("Documento")).toBeInTheDocument();
    expect(screen.queryByText("Progreso de la solicitud")).toBeNull();
  });

  it("4.5.2: el campo de fecha no permite elegir días pasados (min = hoy)", () => {
    render(<SolicitanteWizard />);
    const fecha = screen.getByLabelText(/para cuándo lo necesita/i);
    const hoy = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const hoyISO = `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}`;
    expect(fecha).toHaveAttribute("min", hoyISO);
  });

  it("4.5.2: una fecha pasada se explica en pantalla y no deja avanzar", async () => {
    const user = userEvent.setup();
    render(<SolicitanteWizard />);
    await user.type(screen.getByLabelText(/título de la solicitud/i), "Sombrillas");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "mercadeo_publicidad");
    await user.type(screen.getByLabelText(/descripción breve/i), "500 sombrillas con logo");
    fireEvent.change(screen.getByLabelText(/para cuándo lo necesita/i), {
      target: { value: "2020-01-01" },
    });
    expect(screen.getByText(/la fecha requerida ya pasó/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("¿Qué necesita?")).toBeInTheDocument();
  });

  it("4.5.3: sin descripción el paso no avanza y lo marca inline", async () => {
    const user = userEvent.setup();
    render(<SolicitanteWizard />);
    await user.type(screen.getByLabelText(/título de la solicitud/i), "Sombrillas");
    await user.selectOptions(screen.getByLabelText(/categoría/i), "mercadeo_publicidad");
    const hoy = new Date(Date.now() + 7 * 86400000);
    const p = (n: number) => String(n).padStart(2, "0");
    fireEvent.change(screen.getByLabelText(/para cuándo lo necesita/i), {
      target: { value: `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}` },
    });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("La descripción es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("¿Qué necesita?")).toBeInTheDocument();
  });
});