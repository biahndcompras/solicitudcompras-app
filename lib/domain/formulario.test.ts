import { describe, it, expect } from "vitest";
import { armarFormularioOriginal, completarRondas } from "./formulario";
import type { CampoCatalogo, RespuestaCampo, RondaPreguntas, Solicitud } from "./types";

function campo(campoKey: string, label: string, orden = 0): CampoCatalogo {
  return {
    campoKey,
    label,
    tipoDato: "texto",
    obligatorio: false,
    origen: "plantilla",
    orden,
    activo: true,
  } as CampoCatalogo;
}

function respuesta(campoKey: string, campoLabel: string, valor?: string): RespuestaCampo {
  return { id: campoKey, solicitudId: "s1", campoKey, campoLabel, valor, origen: "assessment" };
}

describe("armarFormularioOriginal", () => {
  it("muestra TODAS las preguntas de la plantilla, incluso las no respondidas", () => {
    const out = armarFormularioOriginal(
      [campo("forma_pago", "Forma de pago", 1), campo("garantia", "Garantía", 2)],
      [respuesta("forma_pago", "Forma de pago", "Contado")]
    );

    expect(out.map((p) => p.campoKey)).toEqual(["forma_pago", "garantia"]);
    expect(out[0].valor).toBe("Contado");
    // Sin valor: la UI debe decir "No especificado", no desaparecer.
    expect(out[1].valor).toBeUndefined();
  });

  it("agrega las respuestas del assessment que no están en la plantilla, sin duplicar", () => {
    const out = armarFormularioOriginal(
      [campo("materiales", "Materiales")],
      [
        respuesta("materiales", "Materiales", "Base agua"),
        respuesta("cantidad", "Cantidad", "45 galones"),
        respuesta("color_acabado", "Color y acabado", "Gris"),
      ]
    );

    expect(out.map((p) => p.campoKey)).toEqual(["materiales", "cantidad", "color_acabado"]);
    expect(out.find((p) => p.campoKey === "materiales")?.valor).toBe("Base agua");
    expect(out.find((p) => p.campoKey === "materiales")?.origen).toBe("plantilla");
  });

  it("usa el numérico cuando no hay texto", () => {
    const out = armarFormularioOriginal([], [
      { ...respuesta("monto", "Monto"), valorNumerico: 1500, origen: "assessment" },
    ]);

    expect(out[0].valor).toBe("1500");
  });
});

describe("completarRondas", () => {
  const base = {
    id: "s1",
    titulo: "t",
    solicitanteEmail: "e@x.co",
    solicitanteNombre: "N",
    estado: "COMPARATIVA_LISTA",
    fechaCreacion: "2026-10-01T00:00:00Z",
  } as Solicitud;

  it("agrega la ronda abierta que no está en la tabla", () => {
    const s = {
      ...base,
      informacionPendiente: true,
      informacionPreguntas: {
        ronda: 3,
        pedidaEn: "2026-10-21T10:00:00Z",
        pedidaPor: "c@b.co",
        preguntas: [{ campoKey: "garantia", pregunta: "¿Garantía?" }],
      },
    } as Solicitud;

    const out = completarRondas([], s);

    expect(out).toHaveLength(1);
    expect(out[0].ronda).toBe(3);
    expect(out[0].preguntas[0].pregunta).toBe("¿Garantía?");
    expect(out[0].respuestas).toBeUndefined();
  });

  it("no duplica si la ronda ya está en la tabla", () => {
    const existente: RondaPreguntas = {
      id: "r3",
      solicitudId: "s1",
      ronda: 3,
      preguntas: [{ campoKey: "garantia", pregunta: "¿Garantía?" }],
      pedidaEn: "2026-10-21T10:00:00Z",
    };
    const s = {
      ...base,
      informacionPendiente: true,
      informacionPreguntas: { ronda: 3, pedidaEn: "2026-10-21T10:00:00Z", preguntas: [] },
    } as Solicitud;

    expect(completarRondas([existente], s)).toHaveLength(1);
  });
});
