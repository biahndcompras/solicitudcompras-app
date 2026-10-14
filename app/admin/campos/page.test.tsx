// Catálogo de campos · UI de edición y borrado.
// 4.4.7: faltaba el control de UI para editar; el endpoint se llamaba con atributos
// hardcodeados. La UI debe prellenar el formulario y enviar SOLO lo que cambió.
// 4.4.9: faltaba borrar. Debe pedir confirmación en un diálogo (no window.confirm) y
// llamar al DELETE, que desactiva para no dejar respuestas huérfanas.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/campos",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import AdminCamposPage from "./page";

const CAMPO = {
  campoKey: "plazo",
  label: "Plazo de entrega",
  tipoDato: "numero",
  origen: "plantilla",
  obligatorio: true,
  orden: 42,
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
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/admin/campos" && !init) return Promise.resolve(json([CAMPO]));
    if (url.startsWith("/api/admin/campos/")) return Promise.resolve(json({ ok: true }));
    return Promise.resolve(json([]));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

async function renderizar() {
  render(<AdminCamposPage />);
  await screen.findByText("Plazo de entrega");
}

describe("AdminCamposPage · editar un campo sin destruir sus atributos (4.4.7)", () => {
  it("prellena el formulario y envía solo la etiqueta cambiada", async () => {
    const user = userEvent.setup();
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Editar" }));

    const etiqueta = screen.getByLabelText(/etiqueta/i) as HTMLInputElement;
    expect(etiqueta.value).toBe("Plazo de entrega");

    await user.clear(etiqueta);
    await user.type(etiqueta, "Plazo");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([u, i]) =>
          String(u).includes("/api/admin/campos/plazo") &&
          (i as RequestInit | undefined)?.method === "PATCH"
      );
      expect(llamada).toBeTruthy();
      const body = JSON.parse((llamada![1] as RequestInit).body as string);
      expect(body.label).toBe("Plazo");
      // Lo que no se tocó NO viaja: así ninguna edición parcial puede pisarlo.
      expect(body).not.toHaveProperty("tipoDato");
      expect(body).not.toHaveProperty("origen");
      expect(body).not.toHaveProperty("orden");
    });
  });
});

describe("AdminCamposPage · borrar un campo pide confirmación (4.4.9)", () => {
  it("abre un diálogo de confirmación y llama a DELETE", async () => {
    const user = userEvent.setup();
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /eliminar campo/i }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([u, i]) =>
          String(u).includes("/api/admin/campos/plazo") &&
          (i as RequestInit | undefined)?.method === "DELETE"
      );
      expect(llamada).toBeTruthy();
    });
  });
});
