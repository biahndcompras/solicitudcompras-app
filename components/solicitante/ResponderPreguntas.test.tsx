// El solicitante responde las preguntas de Compras (spec 010, RF-60). Es la pantalla con más
// tráfico del portal, así que lo que se fija acá es lo que la persona vive:
//
// - que pueda escribir y enviar,
// - que "No lo sé" mande vacío y no basura,
// - que un fallo de red NO le diga "listo" (le diría que su respuesta llegó cuando no),
// - y que se le avise si hay que reintentar sin asustarlo por algo que quizá sí se guardó.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ResponderPreguntas } from "./ResponderPreguntas";

const PREGUNTAS = [
  { campoKey: "materiales", pregunta: "¿De qué material?" },
  { campoKey: "plazo_entrega", pregunta: "¿Para cuándo?" },
];

function montar(props: Partial<Parameters<typeof ResponderPreguntas>[0]> = {}) {
  return render(
    <ResponderPreguntas
      solicitudId="sol-1"
      email="mj.e2e@biabrands.co"
      ronda={1}
      preguntas={PREGUNTAS}
      {...props}
    />
  );
}

beforeEach(() => {
  refresh.mockReset();
  vi.restoreAllMocks();
});

describe("ResponderPreguntas", () => {
  it("muestra todas las preguntas de Compras", () => {
    montar();
    expect(screen.getByText("¿De qué material?")).toBeInTheDocument();
    expect(screen.getByText("¿Para cuándo?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar respuesta/i })).toBeInTheDocument();
  });

  it("avisa cuando la ronda es la segunda o más", () => {
    montar({ ronda: 3 });
    expect(screen.getByText(/Ronda 3/)).toBeInTheDocument();
  });


  it("envía lo escrito y confirma", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Acero" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar respuesta/i }));

    await waitFor(() => expect(screen.getByText(/ya le llegó a Compras/i)).toBeInTheDocument());

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.respuestas.materiales).toBe("Acero");
    expect(body.email).toBe("mj.e2e@biabrands.co");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/solicitudes/sol-1/informacion/respuesta");
  });

  it("'No lo sé' manda vacío, no el último texto escrito", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();

    const input = screen.getAllByRole("textbox")[0];
    fireEvent.change(input, { target: { value: "algo que escribí" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Enviar respuesta/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    // Si mandara el texto viejo, el coordinador recibiría un dato que la persona descartó.
    expect(body.respuestas.materiales).toBe("");
  });

  it("un fallo de red NO dice 'listo': sería avisarle que su respuesta llegó", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Enviar respuesta/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(/ya le llegó a Compras/i)).not.toBeInTheDocument();
    // Y sin prometer que se perdió: un timeout puede haberla guardado igual.
    expect(screen.getByRole("alert").textContent).toMatch(/no sabemos si se guardó/i);
  });

  it("un error del servidor muestra el mensaje que devolvió, no uno inventado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "No pudimos guardar tu respuesta" }) })
    );
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Enviar respuesta/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/No pudimos guardar/i));
  });

  it("refresca la página tras responder, para que el bloque no siga ofreciéndose", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Enviar respuesta/i }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mientras se está enviando, el botón no admite un segundo envío", async () => {
    let resolver: (v: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((r) => {
        resolver = r;
      }))
    );
    montar();

    const boton = screen.getByRole("button", { name: /Enviar respuesta|Enviando/i });
    fireEvent.click(boton);

    await waitFor(() => expect(screen.getByRole("button", { name: /Enviando/i })).toBeDisabled());
    resolver({ ok: true, json: async () => ({ ok: true }) });
  });
});
