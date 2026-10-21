// 4.1.1 · La referencia de una solicitud se lee igual en el panel y en el admin.
// El detalle de admin fabricaba `SOL-<id>` cuando la solicitud no tenía
// numero_referencia: una cadena que no existe en ningún documento y que alguien
// podría intentar buscar sin encontrarla. Debe decir «Sin referencia», como el
// panel del coordinador (P3-10), y nunca inventar un número.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const repo = vi.hoisted(() => ({
  obtenerSolicitud: vi.fn(),
  listarCoordinadores: vi.fn(),
  listarEventos: vi.fn(),
  // El detalle ahora también muestra respuestas, cotizaciones, comparativa y decisión.
  listarRespuestas: vi.fn().mockResolvedValue([]),
  listarCotizaciones: vi.fn().mockResolvedValue([]),
  obtenerComparativaPorSolicitudId: vi.fn().mockResolvedValue(null),
  obtenerDecisionPorSolicitud: vi.fn().mockResolvedValue(null),
  // 4.13.20: formulario original + historial de rondas.
  listarRondasPreguntas: vi.fn().mockResolvedValue([]),
  listarCamposDePlantillaPorId: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = repo.obtenerSolicitud;
    listarCoordinadores = repo.listarCoordinadores;
    listarEventos = repo.listarEventos;
    listarRespuestas = repo.listarRespuestas;
    listarCotizaciones = repo.listarCotizaciones;
    obtenerComparativaPorSolicitudId = repo.obtenerComparativaPorSolicitudId;
    obtenerDecisionPorSolicitud = repo.obtenerDecisionPorSolicitud;
    listarRondasPreguntas = repo.listarRondasPreguntas;
    listarCamposDePlantillaPorId = repo.listarCamposDePlantillaPorId;
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/sesion-context", () => ({
  useSesion: () => ({ nombre: "Admin", rol: "admin" }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import AdminSolicitudDetallePage from "./page";
import type { Solicitud } from "@/lib/domain/types";

function sol(over: Partial<Solicitud> & { id: string }): Solicitud {
  return {
    titulo: "Solicitud de agosto",
    estado: "ENVIADA_A_COMPRAS",
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "Ana Reyes",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-08-10T10:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  repo.obtenerSolicitud.mockReset();
  repo.listarCoordinadores.mockReset();
  repo.listarEventos.mockReset();
  repo.listarCoordinadores.mockResolvedValue([]);
  repo.listarEventos.mockResolvedValue([]);
});

async function renderizar(s: Solicitud) {
  repo.obtenerSolicitud.mockResolvedValue(s);
  const ui = await AdminSolicitudDetallePage({ params: Promise.resolve({ id: s.id }) });
  render(ui);
}

describe("Admin · detalle de solicitud: referencia honesta (4.1.1)", () => {
  it("sin numero_referencia dice «Sin referencia» y no fabrica SOL-<id>", async () => {
    await renderizar(sol({ id: "a1b2c3d4-0000-4000-8000-000000000000" }));
    expect(screen.getByText("Sin referencia")).toBeInTheDocument();
    // La cadena fabricada del bug: `SOL-` + primeros 8 chars del id.
    expect(screen.queryByText("SOL-A1B2C3D4")).toBeNull();
    expect(document.body.textContent).not.toContain("SOL-");
  });

  it("con numero_referencia lo muestra tal cual (igual que el panel)", async () => {
    await renderizar(
      sol({ id: "a1b2c3d4-0000-4000-8000-000000000000", numeroReferencia: "RFQ-2026-0042" })
    );
    expect(screen.getByText("RFQ-2026-0042")).toBeInTheDocument();
    expect(screen.queryByText("Sin referencia")).toBeNull();
  });
});
