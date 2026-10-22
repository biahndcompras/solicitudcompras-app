import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();
const getUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithPassword, signOut, getUser },
  }),
}));

import { LoginUnico } from "./LoginUnico";

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  signInWithPassword.mockReset();
  signOut.mockReset().mockResolvedValue({});
  getUser.mockReset();
});

async function entrar(email: string, password = "Secreta2026!") {
  const user = userEvent.setup();
  render(<LoginUnico />);
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Entrar al panel" }));
}

describe("Login único del equipo", () => {
  it("un admin entra a /admin", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: { rol: "admin" } } }, error: null });
    await entrar("admin@biafoods.co");
    expect(push).toHaveBeenCalledWith("/admin");
  });

  it("un coordinador entra a /panel", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: { rol: "coordinador" } } }, error: null });
    await entrar("coordinador@biafoods.co");
    expect(push).toHaveBeenCalledWith("/panel");
  });

  it("un solicitante NO entra: se cierra la sesión y se explica", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: { rol: "solicitante" } } }, error: null });
    await entrar("solicitante@biabrands.co");
    expect(signOut).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Esta cuenta no tiene acceso al panel\. Si es solicitante/)
    ).toBeInTheDocument();
  });

  it("sin rol confirmado tampoco entra (menor privilegio)", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
    getUser.mockResolvedValue({ data: { user: { app_metadata: {} } } });
    await entrar("raro@biabrands.co");
    expect(signOut).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("credenciales inválidas muestran un mensaje en español", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    await entrar("admin@biafoods.co", "mal");
    expect(screen.getByRole("alert")).toHaveTextContent(/Correo o contraseña incorrectos/);
    expect(push).not.toHaveBeenCalled();
  });
});
