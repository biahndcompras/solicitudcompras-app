import { describe, it, expect } from "vitest";
import { assessment_requerimiento } from "./assessment";
import type { CampoCatalogo } from "./types";

const catalogo: CampoCatalogo[] = [
  { campoKey: "dimensiones", label: "Dimensiones", tipoDato: "texto", obligatorio: true, origen: "assessment", orden: 1, activo: true },
  { campoKey: "materiales", label: "Materiales", tipoDato: "texto", obligatorio: true, origen: "assessment", orden: 2, activo: true },
  { campoKey: "color_acabado", label: "Color y acabado", tipoDato: "texto", obligatorio: false, origen: "assessment", orden: 3, activo: true },
  { campoKey: "archivo_logo", label: "Archivo del logo", tipoDato: "archivo", obligatorio: false, origen: "assessment", orden: 4, activo: true, validacion: { dependeDe: "lleva_branding", bloqueante: true } },
];

function capturados(keys: string[]) {
  return keys.map((campoKey) => ({ campoKey }));
}

describe("assessment_requerimiento", () => {
  it("pide solo campos faltantes del catálogo", async () => {
    const r = await assessment_requerimiento({
      camposCapturados: capturados(["dimensiones"]),
      camposDisponiblesCatalogo: catalogo,
    });
    const keys = r.preguntas.map((p) => p.campoKey);
    expect(keys).toContain("materiales");
    expect(keys).not.toContain("dimensiones");
    expect(keys.every((k) => catalogo.some((c) => c.campoKey === k))).toBe(true);
  });

  it("respeta el límite de 10 preguntas", async () => {
    const grande: CampoCatalogo[] = Array.from({ length: 20 }, (_, i) => ({
      campoKey: `campo_${i}`,
      label: `Campo ${i}`,
      tipoDato: "texto" as const,
      obligatorio: false,
      origen: "assessment" as const,
      orden: i,
      activo: true,
    }));
    const r = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: grande,
    });
    expect(r.preguntas.length).toBeLessThanOrEqual(10);
  });

  it("no devuelve preguntas si no falta nada", async () => {
    const r = await assessment_requerimiento({
      camposCapturados: capturados(["dimensiones", "materiales", "color_acabado", "archivo_logo"]),
      camposDisponiblesCatalogo: catalogo,
    });
    expect(r.sin_preguntas_pendientes).toBe(true);
  });

  it("no pregunta el logo ni el toggle de branding (los cubre la UI — REGLA 8/B2)", async () => {
    const r = await assessment_requerimiento({
      camposCapturados: capturados(["dimensiones", "materiales"]),
      camposDisponiblesCatalogo: catalogo,
      llevaBranding: true,
    });
    const keys = r.preguntas.map((p) => p.campoKey);
    expect(keys).not.toContain("archivo_logo");
    expect(keys).not.toContain("marca_branding");
  });

  it("descarta campos no existentes en el catálogo (validación dura)", async () => {
    const r = await assessment_requerimiento({
      camposCapturados: capturados(["campo_inventado"]),
      camposDisponiblesCatalogo: catalogo,
    });
    const keys = r.preguntas.map((p) => p.campoKey);
    expect(keys.every((k) => catalogo.some((c) => c.campoKey === k))).toBe(true);
  });

  it("prioriza los campos de plantilla del tipo (H4.2)", async () => {
    const plantilla: CampoCatalogo[] = catalogo.map((c, i) => ({ ...c, orden: 100 + i }));
    const r = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: plantilla,
      tipo: "RFQ",
      subtipo: "producto",
    });
    const keys = r.preguntas.map((p) => p.campoKey);
    // Los campos de plantilla (assessment) lideran el orden de preguntas.
    expect(keys).toContain("dimensiones");
  });

  it("filtra campos por subtipo (producto no ve campos de servicio)", async () => {
    const conServicio: CampoCatalogo[] = [
      ...catalogo,
      { campoKey: "alcance_servicio", label: "Alcance del servicio", tipoDato: "texto_largo", obligatorio: false, origen: "assessment", orden: 5, activo: true },
      { campoKey: "periodicidad", label: "Periodicidad", tipoDato: "seleccion", obligatorio: false, origen: "assessment", orden: 6, activo: true },
    ];
    const producto = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: conServicio,
      titulo: "Pintura de aceite para fachada",
      subtipo: "producto",
    });
    const keys = producto.preguntas.map((p) => p.campoKey);
    expect(keys).not.toContain("alcance_servicio");
    expect(keys).not.toContain("periodicidad");

    const servicio = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: conServicio,
      titulo: "Servicio de limpieza",
      subtipo: "servicio",
    });
    const keysServicio = servicio.preguntas.map((p) => p.campoKey);
    expect(keysServicio).not.toContain("dimensiones");
    expect(keysServicio).toContain("alcance_servicio");
  });

  it("redacta preguntas en lenguaje natural con el producto en contexto (nunca labels crudos)", async () => {
    const r = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: catalogo,
      titulo: "Pintura de aceite para fachada de almacen",
      subtipo: "producto",
    });
    expect(r.preguntas.length).toBeGreaterThan(0);
    for (const p of r.preguntas) {
      expect(p.pregunta).toMatch(/[¿?]/); // es una pregunta, no un label
      expect(p.pregunta.length).toBeGreaterThan(p.campoKey.length + 5);
    }
    expect(r.preguntas.some((p) => /pintura/i.test(p.pregunta))).toBe(true);
  });

  it("ofrece sugerencias del catálogo como chips cuando hay opciones", async () => {
    const conOpciones: CampoCatalogo[] = [
      { campoKey: "calidad", label: "Calidad", tipoDato: "seleccion", catalogoOpciones: "Estándar,Premium", obligatorio: false, origen: "assessment", orden: 1, activo: true },
    ];
    const r = await assessment_requerimiento({
      camposCapturados: [],
      camposDisponiblesCatalogo: conOpciones,
      titulo: "Pintura",
      subtipo: "producto",
    });
    const calidad = r.preguntas.find((p) => p.campoKey === "calidad");
    expect(calidad?.sugerencias).toEqual(["Estándar", "Premium"]);
  });
});