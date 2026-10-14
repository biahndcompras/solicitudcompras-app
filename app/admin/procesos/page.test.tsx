// 4.1.1 · La referencia de una solicitud se lee igual en el panel y en el admin.
// El tablero de procesos fabricaba `SOL-<id>` cuando la solicitud no tenía
// numero_referencia. Debe decir «Sin referencia», como el panel del coordinador
// (P3-10), y nunca inventar un número.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const repo = vi.hoisted(() => ({ listarTodas: vi.fn() }));

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarTodas = repo.listarTodas;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/procesos",
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

import AdminProcesosPage from "./page";
import type { Solicitud } from "@/lib/domain/types";

function sol(over: Partial<Solicitud> & { id: string }): Solicitud {
  return {
    titulo: "Solicitud de agosto",
    estado: "ENVIADA_A_COMPRAS",
    tipo: "RFQ",
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "Ana Reyes",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-08-10T10:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  repo.listarTodas.mockReset();
});

async function renderizar(todas: Solicitud[]) {
  repo.listarTodas.mockResolvedValue(todas);
  const ui = await AdminProcesosPage();
  render(ui);
}

describe("Admin · procesos: referencia honesta (4.1.1)", () => {
  it("sin numero_referencia dice «Sin referencia» y no fabrica SOL-<id>", async () => {
    await renderizar([sol({ id: "a1b2c3d4-0000-4000-8000-000000000000" })]);
    expect(screen.getByText("Sin referencia")).toBeInTheDocument();
    expect(screen.queryByText("SOL-A1B2C3D4")).toBeNull();
    expect(document.body.textContent).not.toContain("SOL-");
  });

  it("con numero_referencia lo muestra tal cual (igual que el panel)", async () => {
    await renderizar([
      sol({ id: "a1b2c3d4-0000-4000-8000-000000000000", numeroReferencia: "RFQ-2026-0042" }),
    ]);
    expect(screen.getByText("RFQ-2026-0042")).toBeInTheDocument();
    expect(screen.queryByText("Sin referencia")).toBeNull();
  });
});
