// 4.1.1 · La misma solicitud debe leerse igual en el panel del coordinador y en el
// admin. El dashboard de admin mostraba "—" mientras el panel del coordinador dice
// «Sin referencia»; se unifica el texto y nunca se fabrica una referencia.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
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

const api = vi.hoisted(() => ({ metricas: vi.fn(), listarSolicitudesTodas: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ api }));

import AdminDashboardPage from "./page";
import type { Solicitud } from "@/lib/domain/types";

const METRICAS_VACIAS = {
  tasaConversion: null,
  tiempoCicloPromedioDias: null,
  solicitudesActivas: 0,
  solicitudesSinDecision: 0,
  volumenPorCoordinador: {},
  distribucionPorTipo: {},
};

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
  api.metricas.mockReset();
  api.listarSolicitudesTodas.mockReset();
  api.metricas.mockResolvedValue(METRICAS_VACIAS);
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
  ) as unknown as typeof fetch;
});

describe("Admin · dashboard: referencia honesta y consistente (4.1.1)", () => {
  it("sin numero_referencia dice «Sin referencia» y no fabrica SOL-<id>", async () => {
    api.listarSolicitudesTodas.mockResolvedValue([sol({ id: "a1b2c3d4-0000-4000-8000-000000000000" })]);
    render(<AdminDashboardPage />);
    expect(await screen.findByText("Sin referencia")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SOL-");
  });

  it("con numero_referencia lo muestra tal cual (igual que el panel)", async () => {
    api.listarSolicitudesTodas.mockResolvedValue([
      sol({ id: "a1b2c3d4-0000-4000-8000-000000000000", numeroReferencia: "RFQ-2026-0042" }),
    ]);
    render(<AdminDashboardPage />);
    expect(await screen.findByText("RFQ-2026-0042")).toBeInTheDocument();
    expect(screen.queryByText("Sin referencia")).toBeNull();
  });
});
