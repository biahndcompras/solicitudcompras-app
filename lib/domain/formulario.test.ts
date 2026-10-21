import { describe, it, expect } from "vitest";
import { armarFormularioOriginal, completarRondas, rondasDesdeEventos } from "./formulario";
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

  it("mejora un marcador con el detalle de la ronda abierta", () => {
    const s = {
      ...base,
      informacionPendiente: true,
      informacionPreguntas: {
        ronda: 2,
        pedidaEn: "2026-10-14T09:15:00Z",
        preguntas: [{ campoKey: "garantia", pregunta: "¿Garantía?" }],
      },
    } as Solicitud;
    const marcador: RondaPreguntas = {
      id: "e2",
      solicitudId: "s1",
      ronda: 2,
      preguntas: [],
      pedidaEn: "2026-10-14T09:15:00Z",
      detalleDisponible: false,
      totalPreguntas: 1,
    };

    const out = completarRondas([marcador], s);

    expect(out).toHaveLength(1);
    expect(out[0].detalleDisponible).toBe(true);
    expect(out[0].preguntas[0].pregunta).toBe("¿Garantía?");
  });
});

describe("rondasDesdeEventos", () => {
  it("reconstruye las rondas sin detalle y no pisa las que sí lo tienen", () => {
    const eventos = [
      { tipoEvento: "respuesta_solicitante", nota: "Ronda 1 respondida: 2 campo(s)", timestamp: "2026-10-14T09:03:00Z", actorIdentificador: "s@b.co" },
      { tipoEvento: "pregunta_solicitante", nota: "Ronda 1: 2 pregunta(s) al solicitante", timestamp: "2026-10-14T08:56:00Z", actorIdentificador: "c@b.co" },
      { tipoEvento: "pregunta_solicitante", nota: "Ronda 2: 1 pregunta(s) al solicitante", timestamp: "2026-10-14T09:15:00Z", actorIdentificador: "c@b.co" },
    ];
    const real: RondaPreguntas = {
      id: "r2",
      solicitudId: "s1",
      ronda: 2,
      preguntas: [{ campoKey: "x", pregunta: "¿X?" }],
      pedidaEn: "2026-10-14T09:15:00Z",
      detalleDisponible: true,
    };

    const out = rondasDesdeEventos("s1", eventos, [real]);

    expect(out.map((r) => r.ronda)).toEqual([1, 2]);
    expect(out[0].detalleDisponible).toBe(false);
    expect(out[0].totalPreguntas).toBe(2);
    expect(out[0].totalRespuestas).toBe(2);
    expect(out[0].respondidaEn).toBe("2026-10-14T09:03:00Z");
    expect(out[1].detalleDisponible).toBe(true);
    expect(out[1].preguntas[0].pregunta).toBe("¿X?");
  });

  it("ignora eventos con nota que no se puede interpretar", () => {
    const out = rondasDesdeEventos("s1", [{ tipoEvento: "pregunta_solicitante", nota: "texto libre", timestamp: "2026-10-14T09:15:00Z" }], []);
    expect(out).toEqual([]);
  });
});
