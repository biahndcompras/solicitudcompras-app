// 4.1.1 · La misma solicitud debe leerse igual en el panel del coordinador y en el
// admin. El detalle del coordinador mostraba "—" cuando no había numero_referencia
// mientras el admin (tras el fix) dice «Sin referencia». Se unifica el texto.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const repo = vi.hoisted(() => ({
  obtenerSolicitud: vi.fn(),
  listarRespuestas: vi.fn(),
  listarCampoCatalogo: vi.fn(),
  obtenerDecisionPorSolicitud: vi.fn(),
  listarCotizaciones: vi.fn(),
}));

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = repo.obtenerSolicitud;
    listarRespuestas = repo.listarRespuestas;
    listarCampoCatalogo = repo.listarCampoCatalogo;
    obtenerDecisionPorSolicitud = repo.obtenerDecisionPorSolicitud;
    listarCotizaciones = repo.listarCotizaciones;
  },
}));

// El detalle pesado (tabs de cotizaciones/comparativa) no forma parte de esta prueba:
// se aísla el encabezado de la página, que es donde vive la referencia.
vi.mock("@/components/coordinador/DetalleSolicitud", () => ({
  DetalleSolicitud: () => <div data-testid="detalle" />,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import SolicitudDetallePage from "./page";
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
  repo.listarRespuestas.mockReset();
  repo.listarCampoCatalogo.mockReset();
  repo.obtenerDecisionPorSolicitud.mockReset();
  repo.listarCotizaciones.mockReset();
  repo.listarRespuestas.mockResolvedValue([]);
  repo.listarCampoCatalogo.mockResolvedValue([]);
  repo.obtenerDecisionPorSolicitud.mockResolvedValue(undefined);
  repo.listarCotizaciones.mockResolvedValue([]);
});

async function renderizar(s: Solicitud) {
  repo.obtenerSolicitud.mockResolvedValue(s);
  const ui = await SolicitudDetallePage({ params: Promise.resolve({ id: s.id }) });
  render(ui);
}

describe("Panel · detalle de solicitud: referencia honesta y consistente (4.1.1)", () => {
  it("sin numero_referencia dice «Sin referencia» y no muestra un guion suelto", async () => {
    await renderizar(sol({ id: "a1b2c3d4-0000-4000-8000-000000000000" }));
    expect(screen.getByText("Sin referencia")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SOL-");
  });

  it("con numero_referencia lo muestra tal cual (igual que el admin)", async () => {
    await renderizar(
      sol({ id: "a1b2c3d4-0000-4000-8000-000000000000", numeroReferencia: "RFQ-2026-0042" })
    );
    expect(screen.getByText("RFQ-2026-0042")).toBeInTheDocument();
    expect(screen.queryByText("Sin referencia")).toBeNull();
  });
});
