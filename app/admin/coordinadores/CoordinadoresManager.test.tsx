// Manager de coordinadores · alta y baja con confirmación (RF-56, 4.4.2).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/coordinadores",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CoordinadoresManager } from "./CoordinadoresManager";

const COORDINADOR = {
  id: "u-1",
  nombre: "Bryan Bonilla",
  email: "bbonilla@biabrands.co",
  rol: "coordinador" as const,
  categoriasAsignadas: ["servicios_logisticos"],
  activo: true,
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(json({ ok: true })));
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("CoordinadoresManager · alta (RF-56)", () => {
  it("envía el alta con nombre, correo, contraseña y categorías del catálogo", async () => {
    const user = userEvent.setup();
    render(<CoordinadoresManager inicial={[]} />);

    await user.click(screen.getByRole("button", { name: /nuevo coordinador/i }));

    await user.type(screen.getByLabelText(/nombre/i), "Ana López");
    await user.type(screen.getByLabelText(/correo/i), "ana@biabrands.co");
    await user.type(screen.getByLabelText(/contraseña/i), "Secreta123!");
    await user.click(screen.getByRole("checkbox", { name: "Tecnología" }));

    await user.click(screen.getByRole("button", { name: /crear coordinador/i }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([u, i]) =>
          String(u) === "/api/admin/coordinadores" && (i as RequestInit | undefined)?.method === "POST"
      );
      expect(llamada).toBeTruthy();
      const body = JSON.parse((llamada![1] as RequestInit).body as string);
      expect(body).toMatchObject({
        nombre: "Ana López",
        email: "ana@biabrands.co",
        password: "Secreta123!",
        categoriasAsignadas: ["tecnologia"],
      });
    });
  });
});

describe("CoordinadoresManager · desactivar pide confirmación (RF-56)", () => {
  it("abre un diálogo y llama al PATCH con activo=false", async () => {
    const user = userEvent.setup();
    render(<CoordinadoresManager inicial={[COORDINADOR]} />);

    await user.click(screen.getByRole("button", { name: /^desactivar$/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /desactivar coordinador/i }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([u, i]) =>
          String(u).includes("/api/admin/coordinadores/u-1") &&
          (i as RequestInit | undefined)?.method === "PATCH"
      );
      expect(llamada).toBeTruthy();
      expect(JSON.parse((llamada![1] as RequestInit).body as string)).toEqual({ activo: false });
    });
  });

  it("muestra el estado inactivo y ofrece reactivar", () => {
    render(<CoordinadoresManager inicial={[{ ...COORDINADOR, activo: false }]} />);

    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activar$/i })).toBeInTheDocument();
  });
});
