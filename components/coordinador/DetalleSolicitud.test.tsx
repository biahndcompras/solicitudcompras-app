// P0-2 · la barra de acciones es alcanzable en móvil; P2-7 · los pasos se nombran por lo
// que hacen y dicen en qué paso estás; P3-11 · cancelar/reabrir usan modal in-app con la
// consecuencia concreta, no `window.confirm`; P1-5 · un fallo al listar cotizaciones se
// muestra como error con reintento.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarCotizaciones = vi.fn();
const generarComparativa = vi.fn();
const transicionar = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api-client", () => ({
  api: {
    listarCotizaciones: (...a: unknown[]) => listarCotizaciones(...a),
    generarComparativa: (...a: unknown[]) => generarComparativa(...a),
    transicionar: (...a: unknown[]) => transicionar(...a),
  },
}));

import { DetalleSolicitud } from "./DetalleSolicitud";
import type { Cotizacion, Solicitud } from "@/lib/domain/types";

function solicitud(over: Partial<Solicitud> = {}): Solicitud {
  return {
    id: "s-1",
    numeroReferencia: "RFQ-2026-0008",
    titulo: "Papeleria",
    estado: "EN_COTIZACION",
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "Ana Reyes",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-09-01T10:00:00Z",
    ...over,
  };
}

const dosCotizaciones: Cotizacion[] = [
  { id: "c-1", solicitudId: "s-1", proveedorNombre: "Norte", formatoOriginal: "manual" } as Cotizacion,
  { id: "c-2", solicitudId: "s-1", proveedorNombre: "CostaPrint", formatoOriginal: "manual" } as Cotizacion,
];

beforeEach(() => {
  listarCotizaciones.mockReset().mockResolvedValue([]);
  generarComparativa.mockReset().mockResolvedValue(undefined);
  transicionar.mockReset().mockResolvedValue({});
  refresh.mockReset();
  vi.spyOn(window, "confirm").mockImplementation(() => true);
});

describe("DetalleSolicitud · pasos", () => {
  it("P2-7 · los pasos tienen nombre plano, número de apoyo y posición explícita", async () => {
    render(<DetalleSolicitud solicitud={solicitud()} />);
    const pasos = [
      screen.getByRole("button", { name: /07\s*Cotizaciones/ }),
      screen.getByRole("button", { name: /08\s*Comparativa/ }),
      screen.getByRole("button", { name: /09\s*Recomendación/ }),
    ];
    // Sin jerga de numeración: el nombre accesible no empieza por "07 · ".
    expect(pasos[0]).toHaveTextContent("Cotizaciones");
    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(pasos[0]).toHaveAttribute("aria-pressed", "true");
    expect(pasos[1]).toHaveAttribute("aria-pressed", "false");

    const user = userEvent.setup();
    await user.click(pasos[2]);
    expect(screen.getByText("Paso 3 de 3")).toBeInTheDocument();
    expect(pasos[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("P2-7 · el paso de comparativa explica por qué está bloqueado", async () => {
    listarCotizaciones.mockResolvedValue(dosCotizaciones.slice(0, 1));
    render(<DetalleSolicitud solicitud={solicitud()} />);
    const comparar = await screen.findByRole("button", { name: /08\s*Comparativa/ });
    expect(comparar).toBeDisabled();
    expect(screen.getByText(/Comparativa se habilita con 2 cotizaciones cargadas/)).toBeInTheDocument();
  });
});

describe("DetalleSolicitud · confirmaciones in-app", () => {
  it("P3-11 · cancelar pide confirmación en un modal propio, con la consecuencia", async () => {
    const user = userEvent.setup();
    render(<DetalleSolicitud solicitud={solicitud({ estado: "ENVIADA_A_SOLICITANTE" })} />);

    await user.click(await screen.findByRole("button", { name: "Cancelar solicitud" }));
    // No es `window.confirm`: el diálogo del sistema no se usa.
    expect(window.confirm).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveTextContent("¿Cancelar esta solicitud?");
    expect(dialogo).toHaveTextContent(/deja de poder registrar su decisión/);
    expect(dialogo).toHaveTextContent(/No se puede deshacer/);
    expect(transicionar).not.toHaveBeenCalled();

    // Volver no transiciona; confirmar sí.
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(transicionar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancelar solicitud" }));
    await user.click(screen.getByRole("button", { name: "Sí, cancelar la solicitud" }));
    await waitFor(() => expect(transicionar).toHaveBeenCalledTimes(1));
    expect(transicionar.mock.calls[0][0]).toMatchObject({ hacia: "CANCELADA", solicitudId: "s-1" });
  });

  it("P3-11 · reabrir advierte que el enlace ya enviado deja de servir", async () => {
    const user = userEvent.setup();
    listarCotizaciones.mockResolvedValue(dosCotizaciones);
    render(<DetalleSolicitud solicitud={solicitud({ estado: "ENVIADA_A_SOLICITANTE" })} />);

    await user.click(await screen.findByRole("button", { name: "Reabrir cotizaciones" }));
    expect(window.confirm).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent(/vuelve a «Esperando cotizaciones»/);
    expect(dialogo).toHaveTextContent(/deja de permitir decidir/);
    expect(dialogo).toHaveTextContent(/La comparativa generada se descarta/);

    await user.click(screen.getByRole("button", { name: "Sí, reabrir" }));
    await waitFor(() => expect(transicionar).toHaveBeenCalledTimes(1));
    expect(transicionar.mock.calls[0][0]).toMatchObject({ hacia: "EN_COTIZACION" });
  });

  it("P3-11 · en una solicitud terminal no hay acciones ni modal de cancelación", async () => {
    render(<DetalleSolicitud solicitud={solicitud({ estado: "CERRADA_CON_DECISION" })} />);
    await screen.findByText("Solicitud cerrada con decisión");
    expect(screen.queryByRole("button", { name: "Cancelar solicitud" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar datos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reabrir cotizaciones" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DetalleSolicitud · error de carga", () => {
  it("P1-5 · un fallo al listar cotizaciones no se ve como una lista vacía", async () => {
    const user = userEvent.setup();
    listarCotizaciones.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<DetalleSolicitud solicitud={solicitud()} />);

    expect(await screen.findByText("No pudimos cargar las cotizaciones")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay cotizaciones")).toBeNull();
    expect(screen.queryByText("Cotizaciones registradas")).toBeNull();

    listarCotizaciones.mockResolvedValue(dosCotizaciones);
    await user.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("Norte")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos cargar las cotizaciones")).toBeNull();
  });

  it("un fallo al generar la comparativa no se muestra como 'faltan cotizaciones'", async () => {
    const user = userEvent.setup();
    listarCotizaciones.mockResolvedValue(dosCotizaciones);
    generarComparativa.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DetalleSolicitud solicitud={solicitud()} />);

    await user.click(await screen.findByRole("button", { name: /08\s*Comparativa/ }));
    expect(await screen.findByText("No pudimos generar la comparativa")).toBeInTheDocument();
    expect(screen.queryByText(/Se necesitan al menos 2 cotizaciones/)).toBeNull();

    generarComparativa.mockResolvedValue({
      id: "cmp-1",
      solicitudId: "s-1",
      prosContras: {},
      discrepanciasDetectadas: [],
      fechaGeneracion: "2026-09-22T10:00:00Z",
    });
    await user.click(screen.getByRole("button", { name: /Reintentar/ }));
    await waitFor(() => expect(generarComparativa).toHaveBeenCalledTimes(2));
  });
});
