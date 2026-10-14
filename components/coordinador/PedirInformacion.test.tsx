// Compras pide información al solicitante (spec 010, RF-59). Lo que se fija acá es lo que
// puede molestar al usuario real: mandar preguntas vacías, perder lo escrito al cerrar, o
// creer que se envió cuando el servidor lo rechazó.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { PedirInformacion } from "./PedirInformacion";

const CAMPOS = [
  { campoKey: "materiales", label: "Materiales" },
  { campoKey: "plazo_entrega", label: "Plazo de entrega" },
];

function montar(props: Partial<Parameters<typeof PedirInformacion>[0]> = {}) {
  return render(
    <PedirInformacion solicitudId="sol-1" campos={CAMPOS} abierto onCerrar={vi.fn()} {...props} />
  );
}

beforeEach(() => {
  refresh.mockReset();
  vi.restoreAllMocks();
});

describe("PedirInformacion", () => {
  it("arranca con una pregunta y permite agregar más", () => {
    montar();
    expect(screen.getByText("Pregunta 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agregar otra pregunta/i }));
    expect(screen.getByText("Pregunta 2")).toBeInTheDocument();
  });

  it("no deja enviar sin ninguna pregunta escrita", () => {
    montar();
    expect(screen.getByRole("button", { name: /Enviar preguntas/i })).toBeDisabled();
  });

  it("envía las preguntas escritas, y solo esas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "¿De qué material?" } });
    fireEvent.click(screen.getByRole("button", { name: /Agregar otra pregunta/i }));
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "   " } }); // vacía
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    // La vacía no viaja: el servidor la rechazaría y el usuario vería un 400 sin entender.
    expect(body.preguntas).toEqual([{ pregunta: "¿De qué material?" }]);
  });

  it("cuando se elige un campo, la respuesta se guardará ahí", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "¿De qué material?" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "materiales" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.preguntas[0].campoKey).toBe("materiales");
  });

  it("sin campo elegido, la pregunta igual se puede mandar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "¿Tenés una foto?" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    // No toda pregunta corresponde a un campo del catálogo, y eso no debe bloquear.
    expect(body.preguntas[0]).toEqual({ pregunta: "¿Tenés una foto?" });
  });

  it("muestra el motivo del servidor cuando rechaza (p. ej. ya hay una ronda)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Ya hay una ronda de preguntas esperando respuesta del solicitante." }),
      })
    );
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "¿Material?" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Ya hay una ronda/i));
  });

  it("tras enviar, refresca el detalle para que se vea la ronda abierta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "¿Material?" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("quitar una fila la saca del envío", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Primera" } });
    fireEvent.click(screen.getByRole("button", { name: /Agregar otra pregunta/i }));
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Segunda" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Quitar/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Enviar preguntas/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.preguntas).toHaveLength(1);
    expect(body.preguntas[0].pregunta).toBe("Segunda");
  });
});
