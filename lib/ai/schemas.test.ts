import { describe, it, expect } from "vitest";
import { AssessmentOutputSchema } from "./schemas";

describe("AssessmentOutputSchema · preguntas_contexto", () => {
  it("normaliza objetos {pregunta}/{texto} y no deja «[object Object]»", () => {
    const r = AssessmentOutputSchema.parse({
      preguntas: [],
      preguntas_contexto: [
        { campoKey: "x", pregunta: "¿Para qué se usará?" },
        { texto: "¿Qué tamaño?" },
        "¿Cuántas unidades?",
        { foo: "bar" },
      ],
    });

    expect(r.preguntas_contexto).toEqual(["¿Para qué se usará?", "¿Qué tamaño?", "¿Cuántas unidades?"]);
    expect(JSON.stringify(r)).not.toContain("[object Object]");
  });

  it("acepta strings y descarta vacíos", () => {
    const r = AssessmentOutputSchema.parse({ preguntas: [], preguntas_contexto: ["  ¿X? ", ""] });
    expect(r.preguntas_contexto).toEqual(["¿X?"]);
  });
});
