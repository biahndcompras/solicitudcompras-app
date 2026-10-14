import { describe, it, expect } from "vitest";
import {
  construirComparativa,
  detectarDiscrepancias,
  especificacionesSolicitadasDesdeRespuestas,
  fusionarProsContras,
  generarProsContras,
} from "./comparativa";
import type { Cotizacion, RespuestaCampo } from "./types";

function cot(id: string, nombre: string, ofertado: Record<string, string>, precios: {
  neto?: number; total?: number; montoIsv?: number; desglosado?: boolean; moneda?: string;
} = {}): Cotizacion {
  return {
    id,
    solicitudId: "s1",
    proveedorNombre: nombre,
    formatoOriginal: "pdf",
    especificacionesOfertadas: ofertado,
    valorNeto: precios.neto,
    valorTotal: precios.total,
    montoIsv: precios.montoIsv,
    impuestosDesglosados: precios.desglosado,
    moneda: precios.moneda ?? "HNL",
    confianzaExtraccion: {},
    editadaManualmente: false,
    fechaCarga: "2026-07-21",
  };
}

describe("comparativa — caso melamina vs madera", () => {
  it("detecta discrepancia alta de material", () => {
    const r = detectarDiscrepancias({
      especificacionesSolicitadas: { material: "madera maciza" },
      cotizaciones: [
        cot("c1", "Muebles A", { material: "melamina" }),
        cot("c2", "Muebles B", { material: "madera con superficie de aluminio" }),
      ],
    });
    expect(r.discrepancias.some((d) => d.aspecto === "material" && d.severidad === "alta")).toBe(true);
    expect(r.comparablesEntreSi).toBe(false);
    expect(r.advertenciaGeneral).toBeTruthy();
  });

  it("no inventa discrepancias cuando coinciden", () => {
    const r = detectarDiscrepancias({
      especificacionesSolicitadas: { material: "madera" },
      cotizaciones: [
        cot("c1", "A", { material: "madera" }),
        cot("c2", "B", { material: "madera" }),
      ],
    });
    expect(r.discrepancias).toEqual([]);
    expect(r.comparablesEntreSi).toBe(true);
  });
});

describe("pros/contras y sugerencia", () => {
  it("marca falta de desglose fiscal como contra", () => {
    const { prosContras } = generarProsContras({
      requerimiento: "Sombrillas",
      cotizaciones: [cot("c1", "GrafiMax", { material: "poliester" }, { neto: 100, total: 100, desglosado: false })],
    });
    expect(prosContras.c1.contras.some((c) => c.includes("impuestos"))).toBe(true);
  });

  it("sugiere la opción de mejor precio total cuando hay >1", () => {
    const { sugerencia } = generarProsContras({
      requerimiento: "Sombrillas",
      cotizaciones: [
        cot("c1", "A", { material: "x" }, { total: 100, desglosado: true }),
        cot("c2", "B", { material: "x" }, { total: 80, desglosado: true }),
      ],
    });
    expect(sugerencia?.cotizacionId).toBe("c2");
  });

  it("invierte ahorro potencial en pros de la opción más cara", () => {
    const { prosContras } = generarProsContras({
      requerimiento: "Sombrillas",
      cotizaciones: [
        cot("c1", "A", { material: "x" }, { total: 100, desglosado: true }),
        cot("c2", "B", { material: "x" }, { total: 80, desglosado: true }),
      ],
    });
    const ahorro = prosContras.c1.pros.find((p) => p.startsWith("Ahorro potencial"));
    expect(ahorro).toBeTruthy();
    expect(ahorro).toContain("20");
    // La opción más barata no menciona ahorro
    expect(prosContras.c2.pros.some((p) => p.startsWith("Ahorro"))).toBe(false);
  });

  it("no genera sugerencia con una sola cotización", () => {
    const { sugerencia } = generarProsContras({
      requerimiento: "Sombrillas",
      cotizaciones: [cot("c1", "A", { material: "x" }, { total: 100 })],
    });
    expect(sugerencia).toBeNull();
  });
});

describe("fusionarProsContras (2.1/3.2 — H7)", () => {
  it("conserva la línea de ahorro determinista junto a los pros de la IA", () => {
    const fusion = fusionarProsContras(
      { pros: ["Entrega: 10 días"], contras: ["Sin desglose"] },
      { pros: ["Ahorro potencial de 20 HNL frente a la opción más cara", "Total claro"], contras: [] }
    );
    expect(fusion.pros).toContain("Entrega: 10 días");
    expect(fusion.pros.some((p) => p.startsWith("Ahorro potencial"))).toBe(true);
    expect(fusion.contras).toEqual(["Sin desglose"]);
  });

  it("no duplica el ahorro si la IA ya lo menciona", () => {
    const linea = "Ahorro potencial de 20 HNL frente a la opción más cara";
    const fusion = fusionarProsContras(
      { pros: [linea], contras: [] },
      { pros: [linea], contras: [] }
    );
    expect(fusion.pros.filter((p) => p === linea)).toHaveLength(1);
  });

  it("conserva TODOS los pros y contras deterministas junto a los de la IA (4.10.7/RN-06)", () => {
    const fusion = fusionarProsContras(
      { pros: ["Impresión con mejor resolución"], contras: ["Más caro"] },
      {
        pros: ["Total con impuestos claro", "Ahorro potencial de 20 HNL frente a la opción más cara"],
        contras: ["No confirma el tratamiento de impuestos"],
      }
    );
    expect(fusion.pros).toEqual(
      expect.arrayContaining([
        "Impresión con mejor resolución",
        "Total con impuestos claro",
        "Ahorro potencial de 20 HNL frente a la opción más cara",
      ])
    );
    expect(fusion.contras).toEqual(
      expect.arrayContaining(["Más caro", "No confirma el tratamiento de impuestos"])
    );
  });

  it("mantiene el ahorro potencial determinista aunque la IA responda (4.2.1)", () => {
    const linea = "Ahorro potencial de 20 HNL frente a la opción más cara";
    const fusion = fusionarProsContras(
      { pros: ["Mejor acabado"], contras: ["Sin garantía extendida"] },
      { pros: [linea], contras: [] }
    );
    expect(fusion.pros).toContain(linea);
  });

  it("usa deterministas si la IA no responde, y vacío si no hay nada", () => {
    expect(fusionarProsContras(undefined, { pros: ["A"], contras: ["B"] })).toEqual({ pros: ["A"], contras: ["B"] });
    expect(fusionarProsContras(undefined, undefined)).toEqual({ pros: [], contras: [] });
    expect(fusionarProsContras({ pros: ["IA"], contras: [] }, undefined)).toEqual({ pros: ["IA"], contras: [] });
  });
});

describe("construirComparativa", () => {
  it("ensambla la comparativa completa", () => {
    const cmp = construirComparativa({
      solicitudId: "s1",
      especificacionesSolicitadas: { material: "madera" },
      requerimiento: "Sombrillas",
      cotizaciones: [
        cot("c1", "A", { material: "melamina" }, { neto: 100, total: 115, desglosado: true }),
        cot("c2", "B", { material: "madera" }, { neto: 80, total: 92, desglosado: true }),
      ],
      now: "2026-07-22T10:00:00Z",
    });
    expect(cmp.id).toContain("cmp-");
    expect(cmp.cotizacionSugeridaId).toBe("c2");
    expect(cmp.sugerenciaIA).toBeTruthy();
  });
});

describe("4.10.8 — especificaciones solicitadas desde las respuestas", () => {
  function resp(
    campoKey: string,
    campoLabel: string,
    valor?: string,
    valorNumerico?: number
  ): RespuestaCampo {
    return { id: `${campoKey}-1`, solicitudId: "s1", campoKey, campoLabel, valor, valorNumerico, origen: "assessment" };
  }

  it("usa campoKey como aspecto y toma el valor respondido", () => {
    const specs = especificacionesSolicitadasDesdeRespuestas([
      resp("materiales", "Materiales", "melamina"),
      resp("dimensiones", "Dimensiones", "2.0 m"),
    ]);
    expect(specs).toEqual({ materiales: "melamina", dimensiones: "2.0 m" });
  });

  it("cae al valorNumérico y omite respuestas vacías", () => {
    const specs = especificacionesSolicitadasDesdeRespuestas([
      resp("cantidad", "Cantidad", undefined, 25),
      resp("color_acabado", "Color y acabado", "   "),
      resp("calidad", "Calidad"),
    ]);
    expect(specs).toEqual({ cantidad: "25" });
  });

  it("con datos reales (respuestas + ofertas con clave variante) encuentra la discrepancia", () => {
    const specs = especificacionesSolicitadasDesdeRespuestas([
      resp("materiales", "Materiales", "melamina"),
    ]);
    const r = detectarDiscrepancias({
      especificacionesSolicitadas: specs,
      cotizaciones: [
        // La IA suele devolver "material" en singular, no el campoKey del catálogo.
        cot("c1", "Muebles A", { material: "madera maciza" }),
        cot("c2", "Muebles B", { material: "melamina" }),
      ],
    });
    expect(r.discrepancias.map((d) => d.aspecto)).toContain("materiales");
    expect(r.comparablesEntreSi).toBe(false);
  });

  it("la tolerancia de claves no inventa discrepancias si los valores coinciden", () => {
    const r = detectarDiscrepancias({
      especificacionesSolicitadas: { materiales: "melamina" },
      cotizaciones: [
        cot("c1", "A", { material: "melamina" }),
        cot("c2", "B", { material: "melamina" }),
      ],
    });
    expect(r.discrepancias).toEqual([]);
  });
});