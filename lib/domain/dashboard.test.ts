import { describe, it, expect } from "vitest";
import { rellenarSerie, serieDashboard, ultimoValor } from "./dashboard";
import type { Solicitud } from "./types";

function sol(over: Partial<Solicitud> & { id: string }): Solicitud {
  return {
    titulo: "Solicitud",
    estado: "ENVIADA_A_COMPRAS",
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "Ana",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-10-20T10:00:00.000Z",
    ...over,
  } as Solicitud;
}

const HOY = new Date("2026-10-21T15:00:00.000Z");

describe("serieDashboard", () => {
  it("cuenta creadas, cerradas y activas por día", () => {
    const serie = serieDashboard(
      [
        sol({ id: "1", fechaCreacion: "2026-10-21T18:00:00.000Z" }),
        sol({ id: "2", fechaCreacion: "2026-10-20T18:00:00.000Z" }),
        sol({
          id: "3",
          fechaCreacion: "2026-10-19T18:00:00.000Z",
          fechaCierre: "2026-10-20T20:00:00.000Z",
          estado: "CERRADA_CON_DECISION",
        }),
      ],
      3,
      5,
      HOY
    );

    expect(serie.map((d) => d.fecha)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(serie.map((d) => d.creadas)).toEqual([1, 1, 1]);
    expect(serie.map((d) => d.cerradas)).toEqual([0, 1, 0]);
    // El 19: solo la 3 (la 1 y la 2 aún no existían). El 20: solo la 2 (la 3 cerró ese día).
    // El 21: la 1 y la 2.
    expect(serie.map((d) => d.activas)).toEqual([1, 1, 2]);
  });

  it("conversión es 0% si hay enviadas sin aceptar y null si aún no hay enviadas", () => {
    const serie = serieDashboard([sol({ id: "1", fechaCreacion: "2026-10-21T18:00:00.000Z" })], 2, 5, HOY);
    // El 20 la solicitud todavía no existía: no hay denominador.
    expect(serie[0].conversion).toBeNull();
    // El 21 hay 1 enviada y 0 aceptadas: 0%, no null (el KPI también diría 0%).
    expect(serie[1].conversion).toBe(0);
    expect(serie.every((d) => d.tiempo === null)).toBe(true);
  });

  it("conversión usa el estado de las que cerraron y el tiempo el ciclo real", () => {
    const serie = serieDashboard(
      [
        sol({
          id: "1",
          fechaCreacion: "2026-10-10T18:00:00.000Z",
          fechaCierre: "2026-10-20T18:00:00.000Z",
          estado: "CERRADA_CON_DECISION",
        }),
        sol({
          id: "2",
          fechaCreacion: "2026-10-12T18:00:00.000Z",
          fechaCierre: "2026-10-20T18:00:00.000Z",
          estado: "CANCELADA",
        }),
      ],
      2,
      5,
      HOY
    );
    // El 20 cerraron dos: una con decisión y una cancelada → 50%.
    const dia20 = serie.find((d) => d.fecha === "2026-10-20")!;
    expect(dia20.conversion).toBe(50);
    expect(dia20.tiempo).toBe(9); // (10 + 8) / 2 días de calendario
    // El 21 no cerró ninguna nueva: la conversión acumulada sigue 50%, el tiempo sigue 9.
    const dia21 = serie.find((d) => d.fecha === "2026-10-21")!;
    expect(dia21.conversion).toBe(50);
    expect(dia21.tiempo).toBe(9);
  });

  it("sin decisión usa 'más de N días' (>) y no '>='", () => {
    const esperando = sol({
      id: "1",
      estado: "ENVIADA_A_SOLICITANTE",
      fechaCreacion: "2026-10-15T18:00:00.000Z",
    });
    // Al 20 de octubre pasaron 5 días exactos: con umbral 5 NO entra. Al 21 pasaron 6.
    const serie = serieDashboard([esperando], 2, 5, HOY);
    expect(serie[0].fecha).toBe("2026-10-20");
    expect(serie[0].sinDecision).toBe(0);
    expect(serie[1].sinDecision).toBe(1);
  });
});

describe("rellenarSerie", () => {
  it("arrastra el último valor y retro-rellena el inicio", () => {
    expect(rellenarSerie([null, null, 40, null, 60, null])).toEqual([40, 40, 40, 40, 60, 60]);
  });

  it("si no hay ningún valor devuelve ceros", () => {
    expect(rellenarSerie([null, null])).toEqual([0, 0]);
  });

  it("ultimoValor devuelve el último no nulo", () => {
    expect(ultimoValor([null, 3, 4, null])).toBe(4);
    expect(ultimoValor([null, null])).toBeNull();
  });
});
