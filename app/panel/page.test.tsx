// Tests del panel del coordinador: acceso por teclado a las filas (P0-1), error de carga
// real con reintento (P1-5), estado vacío ramificado por búsqueda (P2-6), estado anunciado
// en el único control de filtro (P2-8) y referencia honesta (P3-10).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarSolicitudes = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/sesion-context", () => ({
  useSesion: () => ({ nombre: "Carlos Melara", email: "cmelara@biabrands.co", rol: "coordinador", localId: "00000000-0000-4000-8000-000000000002" }),
}));

vi.mock("@/lib/api-client", () => ({
  api: { listarSolicitudes: (...a: unknown[]) => listarSolicitudes(...a) },
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
}));

// `next/link` fuera del runtime de Next: se sustituye por un <a> con el mismo href.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import PanelPage from "./page";
import { PanelBandeja } from "@/components/coordinador/PanelBandeja";
import type { Solicitud } from "@/lib/domain/types";

function sol(over: Partial<Solicitud> & { id: string }): Solicitud {
  return {
    titulo: "Imprenta",
    estado: "ENVIADA_A_COMPRAS",
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "E2E",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-09-01T10:00:00Z",
    ...over,
  };
}

const DOS = [
  sol({ id: "s-1", numeroReferencia: "RFQ-2026-0010", titulo: "Borradores", estado: "ENVIADA_A_COMPRAS", solicitanteNombre: "Ana Reyes" }),
  sol({ id: "s-2", numeroReferencia: "RFQ-2026-0008", titulo: "Papeleria", estado: "COMPARATIVA_LISTA", solicitanteNombre: "Luis Paz" }),
];

beforeEach(() => {
  listarSolicitudes.mockReset();
  push.mockReset();
  refresh.mockReset();
  listarSolicitudes.mockResolvedValue(DOS);
});

describe("Panel del coordinador", () => {
  it("P0-1 · cada fila se abre con un enlace real alcanzable por teclado", async () => {
    render(<PanelPage />);
    const abrir = await screen.findAllByRole("link", { name: /Abrir RFQ-2026-0010/ });
    expect(abrir).toHaveLength(1);
    // Un <a href> es focusable por defecto y se activa con Enter: nada de tabindex="-1".
    expect(abrir[0]).toHaveAttribute("href", "/panel/solicitud/s-1");
    expect(abrir[0].getAttribute("tabindex")).toBeNull();
    // La fila ya no es un target de clic: no hay <tr> con onClick ni role="link" falso.
    const filas = document.querySelectorAll("tbody tr");
    expect(filas).toHaveLength(2);
    expect(document.querySelectorAll('tbody [role="link"]')).toHaveLength(0);
  });

  it("P1-5 · un fallo de red muestra error con Reintentar, no una bandeja vacía", async () => {
    listarSolicitudes.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<PanelPage />);

    expect(await screen.findByText("No pudimos traer su bandeja")).toBeInTheDocument();
    expect(screen.getByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(screen.queryByText("No tiene solicitudes asignadas")).toBeNull();

    // Reintentar vuelve a pedir los datos y, si vuelven, muestra la tabla.
    const user = userEvent.setup();
    listarSolicitudes.mockResolvedValue(DOS);
    await user.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("2 resultados")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos traer su bandeja")).toBeNull();
  });

  it("P1-5 · el mensaje de error del servidor se muestra tal cual", async () => {
    listarSolicitudes.mockRejectedValueOnce(new Error("No autenticado"));
    render(<PanelPage />);
    expect(await screen.findByText("No autenticado")).toBeInTheDocument();
  });

  it("P2-6 · una búsqueda sin resultados ofrece limpiar la búsqueda", async () => {
    const user = userEvent.setup();
    render(<PanelPage />);
    await screen.findByText("2 resultados");

    await user.type(screen.getByPlaceholderText(/Buscar/), "zzzz");
    expect(await screen.findByText("Sin resultados para «zzzz»")).toBeInTheDocument();
    // El estado vacío de "no tenés solicitudes" no aplica cuando hay una búsqueda activa.
    expect(screen.queryByText("No tiene solicitudes asignadas")).toBeNull();
    expect(screen.getByText("0 resultados")).toBeInTheDocument();

    await user.click(screen.getByText("Limpiar búsqueda", { selector: "button" }));
    expect(await screen.findByText("2 resultados")).toBeInTheDocument();
  });

  it("P2-6 · sin búsqueda, una bandeja sin filas mantiene el estado vacío propio", async () => {
    listarSolicitudes.mockResolvedValue([]);
    render(<PanelPage />);
    expect(await screen.findByText("No tiene solicitudes asignadas")).toBeInTheDocument();
    expect(screen.queryByText(/Sin resultados para/)).toBeNull();
  });

  it("P2-6 · una etapa sin coincidencias no se presenta como bandeja vacía", async () => {
    render(<PanelBandeja etapa="decisiones" />);
    expect(await screen.findByText("No hay solicitudes en «Esperando decisión»")).toBeInTheDocument();
    expect(screen.queryByText("No tiene solicitudes asignadas")).toBeNull();
    // La salida es un enlace real de vuelta a la bandeja completa.
    expect(screen.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/panel");
  });

  it("P2-8 · la etapa activa se anuncia con aria-current y la cola muestra solo esa etapa", async () => {
    render(<PanelBandeja etapa="comparativas" />);
    expect(await screen.findByText("1 resultado")).toBeInTheDocument();

    // El estado vive en la navegación de etapas (un solo control) y se anuncia.
    expect(screen.getByRole("link", { name: /Comparativas/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Todas/ })).not.toHaveAttribute("aria-current");

    // Solo la solicitud en COMPARATIVA_LISTA está en esta etapa.
    // La referencia aparece en la cola y en «Prioridad de hoy»: misma solicitud, dos
    // contextos. Lo que importa es que la otra etapa no esté.
    expect(screen.getAllByText("RFQ-2026-0008").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("RFQ-2026-0010")).toHaveLength(0);
  });

  it("P3-10 · sin numero_referencia muestra «Sin referencia» y no inventa una", async () => {
    listarSolicitudes.mockResolvedValue([sol({ id: "s-9", titulo: "Pipe Test" })]);
    render(<PanelPage />);
    expect(await screen.findByText("Sin referencia")).toBeInTheDocument();
    expect(screen.getByTitle(/s-9/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SOL-");
  });
});
