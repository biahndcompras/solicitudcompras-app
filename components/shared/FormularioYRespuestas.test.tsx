import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormularioYRespuestas } from "./FormularioYRespuestas";
import type { RondaPreguntas } from "@/lib/domain/types";

const rondas: RondaPreguntas[] = [
  {
    id: "r1",
    solicitudId: "s1",
    ronda: 1,
    preguntas: [{ campoKey: "materiales", pregunta: "¿De qué material?" }],
    respuestas: { materiales: "Acero" },
    pedidaPor: "coordinador@biafoods.co",
    pedidaEn: "2026-10-07T11:00:00Z",
    respondidaEn: "2026-10-07T11:48:00Z",
  },
  {
    id: "r2",
    solicitudId: "s1",
    ronda: 2,
    preguntas: [{ campoKey: "plazo_entrega", pregunta: "¿Para cuándo lo necesita?" }],
    pedidaPor: "coordinador@biafoods.co",
    pedidaEn: "2026-10-14T09:15:00Z",
  },
];

describe("FormularioYRespuestas", () => {
  it("muestra el formulario completo, con 'No especificado' en lo que no se respondió", () => {
    render(
      <FormularioYRespuestas
        preguntas={[
          { campoKey: "cantidad", label: "Cantidad", valor: "45 galones", origen: "assessment" },
          { campoKey: "garantia", label: "Garantía", origen: "plantilla" },
        ]}
        rondas={[]}
      />
    );

    expect(screen.getByText("Formulario original")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("45 galones")).toBeInTheDocument();
    expect(screen.getByText("Garantía")).toBeInTheDocument();
    expect(screen.getByText("No especificado")).toBeInTheDocument();
    expect(screen.getByText("2 preguntas")).toBeInTheDocument();
  });

  it("muestra TODAS las rondas: la respondida con su respuesta y la abierta sin responder", () => {
    render(
      <FormularioYRespuestas
        preguntas={[{ campoKey: "cantidad", label: "Cantidad", valor: "45", origen: "assessment" }]}
        rondas={rondas}
        rondaAbierta
      />
    );

    expect(screen.getByText("Preguntas adicionales · ronda 1")).toBeInTheDocument();
    expect(screen.getByText("Preguntas adicionales · ronda 2")).toBeInTheDocument();
    expect(screen.getByText("¿De qué material?")).toBeInTheDocument();
    expect(screen.getByText("Acero")).toBeInTheDocument();
    expect(screen.getByText("¿Para cuándo lo necesita?")).toBeInTheDocument();
    // La ronda 2 es la última y está abierta.
    expect(screen.getByText("Esperando respuesta")).toBeInTheDocument();
    expect(screen.getByText("Respondida")).toBeInTheDocument();
    expect(screen.getByText("Sin responder todavía")).toBeInTheDocument();
  });

  it("sin preguntas ni rondas lo dice explícitamente (no deja un hueco)", () => {
    render(<FormularioYRespuestas preguntas={[]} rondas={[]} />);
    expect(screen.getByText(/no tiene preguntas adicionales/i)).toBeInTheDocument();
  });
});
