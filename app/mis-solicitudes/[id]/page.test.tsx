// La pantalla de detalle del solicitante se abre SOLO con el correo (`?email=`), sin token.
// Cualquiera que sepa el correo de un compañero entra.
//
// Por eso no puede mostrar los importes de los proveedores: filtraría los precios por un dato
// que no es secreto. El listado ya los ocultaba a propósito (`user-flows.md:181`); el detalle
// mostraba proveedor y total, que es la misma información con otro criterio.
//
// Invariante: el HTML de esta pantalla no contiene ningún monto.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

const obtenerSolicitud = vi.fn();
const listarCotizaciones = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    listarRespuestas = vi.fn().mockResolvedValue([]);
  },
}));

// Los hijos que necesitan runtime de cliente se neutralizan: el invariante es sobre los montos,
// no sobre ellos.
vi.mock("@/components/solicitante/CTADecision", () => ({ CTADecision: () => null }));
vi.mock("@/components/solicitante/ResponderPreguntas", () => ({ ResponderPreguntas: () => null }));
vi.mock("@/components/ui-ext/AmbientBackground", () => ({ AmbientBackground: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));

const EMAIL = "mj.e2e@biabrands.co";
const SOLICITUD = {
  id: "sol-1",
  numeroReferencia: "RFQ-2026-0042",
  titulo: "Pintura",
  estado: "EN_COTIZACION",
  solicitanteEmail: EMAIL,
  solicitanteNombre: "María",
  fechaCreacion: "2026-10-01T10:00:00Z",
  clasificacionCorregida: false,
  notificacionFallida: false,
};

// Montos REALES que el repo devuelve y que NO deben llegar a la pantalla.
const COTIZACIONES = [
  { id: "c1", proveedorNombre: "Proveedor Alfa", moneda: "HNL", valorNeto: 10000, valorTotal: 11500 },
  { id: "c2", proveedorNombre: "Proveedor Beta", moneda: "HNL", valorNeto: 12000, valorTotal: 13800 },
];

async function renderizarPagina() {
  const { default: Page } = await import("./page");
  const el = await Page({
    params: Promise.resolve({ id: "sol-1" }),
    searchParams: Promise.resolve({ email: EMAIL }),
  });
  return render(el as ReactElement);
}

beforeEach(() => {
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  listarCotizaciones.mockReset().mockResolvedValue(COTIZACIONES);
});

describe("detalle del solicitante · nunca expone montos ni proveedores", () => {
  it("no renderiza ningún importe de las cotizaciones", async () => {
    const { container } = await renderizarPagina();
    const html = container.innerHTML;

    // Los tres formatos en que un monto podría aparecer.
    expect(html).not.toContain("11,500");
    expect(html).not.toContain("11500");
    expect(html).not.toContain("13,800");
    expect(html).not.toContain("13800");
  });

  it("no renderiza los nombres de los proveedores", async () => {
    const { container } = await renderizarPagina();
    const html = container.innerHTML;

    expect(html).not.toContain("Proveedor Alfa");
    expect(html).not.toContain("Proveedor Beta");
  });

  it("sí muestra cuántas cotizaciones hay: es progreso, no dato sensible", async () => {
    const { container } = await renderizarPagina();

    expect(container.textContent).toContain("Cotizaciones recibidas");
    expect(container.textContent).toContain("2");
  });

  it("con cero cotizaciones lo dice, sin inventar un número", async () => {
    listarCotizaciones.mockResolvedValue([]);

    const { container } = await renderizarPagina();

    expect(container.textContent).toContain("Todavía no hay cotizaciones");
  });
});
