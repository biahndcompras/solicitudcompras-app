import { describe, it, expect, vi, afterEach } from "vitest";
import { assessment_requerimiento, consolidarPreguntas, type PreguntaAssessment } from "./assessment";
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

const CATALOGO_OBLIGATORIOS: CampoCatalogo[] = [
  { campoKey: "cantidad", label: "Cantidad", tipoDato: "texto", obligatorio: true, origen: "assessment", orden: 1, activo: true },
  { campoKey: "plazo_entrega", label: "Plazo de entrega", tipoDato: "fecha", obligatorio: true, origen: "assessment", orden: 2, activo: true },
  { campoKey: "forma_pago", label: "Forma de pago", tipoDato: "texto", obligatorio: true, origen: "assessment", orden: 3, activo: true },
  { campoKey: "color_acabado", label: "Color y acabado", tipoDato: "texto", obligatorio: false, origen: "assessment", orden: 4, activo: true },
  { campoKey: "garantias", label: "Garantías", tipoDato: "texto", obligatorio: false, origen: "assessment", orden: 5, activo: true },
];

function pIA(campoKey: string, extra: Partial<PreguntaAssessment> = {}): PreguntaAssessment {
  return { campoKey, pregunta: `¿${campoKey}?`, por_que: "porque sí", critica: false, ...extra };
}

describe("consolidarPreguntas", () => {
  const base = {
    titulo: "Pintura epóxica para fachada de almacén",
    subtipo: "producto",
    camposCapturados: [],
    camposDisponiblesCatalogo: CATALOGO_OBLIGATORIOS,
  };

  it("pregunta los obligatorios que el modelo se saltó", () => {
    // El caso real: la IA Marrakech devolvió 4 preguntas y omitió plazo_entrega y forma_pago
    // por considerarlos derivables del texto.
    const r = consolidarPreguntas(
      [pIA("cantidad"), pIA("color_acabado"), pIA("garantias")],
      base
    );
    const keys = r.map((p) => p.campoKey);
    expect(keys).toContain("plazo_entrega");
    expect(keys).toContain("forma_pago");
  });

  it("no duplica un obligatorio que el modelo ya preguntó", () => {
    const r = consolidarPreguntas([pIA("cantidad"), pIA("plazo_entrega")], base);
    expect(r.filter((p) => p.campoKey === "plazo_entrega")).toHaveLength(1);
    // Los dos que ya preguntó + el único obligatorio que le faltaba.
    expect(r.map((p) => p.campoKey)).toEqual(["cantidad", "plazo_entrega", "forma_pago"]);
  });

  it("conserva la redacción de la IA: no reemplaza su versión por la de plantilla", () => {
    const ia = pIA("cantidad", { pregunta: "¿Cuántos galones para 800 m²?" });
    const r = consolidarPreguntas([ia], base);
    expect(r.find((p) => p.campoKey === "cantidad")?.pregunta).toBe("¿Cuántos galones para 800 m²?");
  });

  it("no inventa un obligatorio que el solicitante ya respondió", () => {
    const r = consolidarPreguntas(
      [pIA("cantidad")],
      { ...base, camposCapturados: [{ campoKey: "plazo_entrega", valor: "2026-10-01" }] }
    );
    expect(r.map((p) => p.campoKey)).not.toContain("plazo_entrega");
    expect(r.map((p) => p.campoKey)).toContain("forma_pago");
  });

  it("un campo respondido con valor vacío sigue pendiente (respuesta vacía no es respuesta)", () => {
    const r = consolidarPreguntas(
      [pIA("cantidad")],
      { ...base, camposCapturados: [{ campoKey: "plazo_entrega", valor: "" }] }
    );
    expect(r.map((p) => p.campoKey)).toContain("plazo_entrega");
  });

  it("no agrega campos NO obligatorios que el modelo decidió no preguntar", () => {
    const r = consolidarPreguntas([pIA("cantidad")], base);
    expect(r.map((p) => p.campoKey)).not.toContain("color_acabado");
    expect(r.map((p) => p.campoKey)).not.toContain("garantias");
  });

  it("la obligatoriedad la manda el catálogo, no el criterio del modelo", () => {
    // El modelo respondió critica:false sobre un campo obligatorio: el aviso al enviar
    // depende de este flag, así que mandaría al solicitante al RFQ sin dato.
    const r = consolidarPreguntas([pIA("cantidad", { critica: false })], base);
    expect(r.find((p) => p.campoKey === "cantidad")?.critica).toBe(true);
    expect(r.find((p) => p.campoKey === "forma_pago")?.critica).toBe(true);
  });

  it("respeta los filtros por subtipo al forzar los obligatorios", () => {
    const conServicio: CampoCatalogo[] = [
      ...CATALOGO_OBLIGATORIOS,
      { campoKey: "visita_sitio", label: "Visita a sitio", tipoDato: "booleano", obligatorio: true, origen: "assessment", orden: 6, activo: true },
    ];
    const producto = consolidarPreguntas([], { ...base, camposDisponiblesCatalogo: conServicio, subtipo: "producto" });
    expect(producto.map((p) => p.campoKey)).not.toContain("visita_sitio");

    const servicio = consolidarPreguntas([], { ...base, camposDisponiblesCatalogo: conServicio, subtipo: "servicio" });
    expect(servicio.map((p) => p.campoKey)).toContain("visita_sitio");
  });

  it("ignora campos inactivos o que no son del assessment", () => {
    const r = consolidarPreguntas([], {
      ...base,
      camposDisponiblesCatalogo: [
        { campoKey: "plazo_entrega", label: "Plazo", tipoDato: "fecha", obligatorio: true, origen: "assessment", orden: 1, activo: false },
        { campoKey: "forma_pago", label: "Pago", tipoDato: "texto", obligatorio: true, origen: "plantilla", orden: 2, activo: true },
      ],
    });
    expect(r).toHaveLength(0);
  });

  it("respeta el tope de 10 y mete los obligatorios por delante si no caben", () => {
    const muchas = consolidarPreguntas(
      Array.from({ length: 9 }, (_, i) => pIA(`libre_${i}`)),
      {
        ...base,
        camposDisponiblesCatalogo: [
          ...CATALOGO_OBLIGATORIOS,
          ...Array.from({ length: 5 }, (_, i) => ({
            campoKey: `libre_${i}`,
            label: `Libre ${i}`,
            tipoDato: "texto" as const,
            obligatorio: false,
            origen: "assessment" as const,
            orden: 10 + i,
            activo: true,
          })),
        ],
      }
    );
    expect(muchas).toHaveLength(10);
    const obligatorias = muchas.filter((p) => CATALOGO_OBLIGATORIOS.some((c) => c.campoKey === p.campoKey));
    expect(obligatorias).toHaveLength(3);
  });

  it("es idempotente: applied twice no agrega nada nuevo", () => {
    const una = consolidarPreguntas([pIA("cantidad")], base);
    const dos = consolidarPreguntas(una, base);
    expect(dos).toHaveLength(una.length);
  });

  it("descarta la pregunta que la plantilla del RFQ ya renderiza (bug de pantalla duplicada)", () => {
    // Caso real: la IA pidió `visita_sitio` y `plazo_entrega`, que ya salen en el bloque
    // "Información comercial" del mismo RFP. El solicitante las contestaba DOS veces en
    // dos inputs atados al mismo campoKey.
    const r = consolidarPreguntas(
      [pIA("cantidad"), pIA("visita_sitio"), pIA("plazo_entrega"), pIA("color_acabado")],
      { ...base, camposDisponiblesCatalogo: CATALOGO_OBLIGATORIOS, camposYaPreguntados: ["visita_sitio", "plazo_entrega"] }
    );
    // `forma_pago` sí entra: es obligatoria y la plantilla no la cubre.
    expect(r.map((p) => p.campoKey)).toEqual(["cantidad", "color_acabado", "forma_pago"]);
  });

  it("no repite un campo que la IA devolvió dos veces", () => {
    const r = consolidarPreguntas([pIA("cantidad"), pIA("cantidad"), pIA("color_acabado")], base);
    expect(r.map((p) => p.campoKey)).toEqual(["cantidad", "color_acabado", "plazo_entrega", "forma_pago"]);
  });

  it("no duplica en pantalla un obligatorio que la plantilla del RFQ ya pregunta", () => {
    // `plazo_entrega` es un campo del bloque "Información comercial": si fuese obligatorio y
    // lo forzáramos como pregunta, el solicitante vería dos inputs atados al mismo campoKey.
    const r = consolidarPreguntas([pIA("cantidad")], {
      ...base,
      camposDisponiblesCatalogo: CATALOGO_OBLIGATORIOS,
      camposYaPreguntados: ["plazo_entrega"],
    });
    expect(r.map((p) => p.campoKey)).not.toContain("plazo_entrega");
    expect(r.map((p) => p.campoKey)).toContain("forma_pago");
  });

  it("NUNCA descarta un obligatorio por el tope de 10 ( aunque haya más de 10)", () => {
    // El riesgo real del tope: si la IA devuelve 8 y hay 8 obligatorios, un slice ingenuo
    // deja fuera 6 obligatorios. El solicitante no los ve, el aviso no los lista y el
    // coordinador recibe el RFQ sin ellos: el feature pierde su razón de existir.
    const ochoObligatorios: CampoCatalogo[] = Array.from({ length: 8 }, (_, i) => ({
      campoKey: `obl_${i}`,
      label: `Obligatorio ${i}`,
      tipoDato: "texto" as const,
      obligatorio: true,
      origen: "assessment" as const,
      orden: i,
      activo: true,
    }));
    const r = consolidarPreguntas(
      Array.from({ length: 8 }, (_, i) => pIA(`ia_${i}`)),
      { ...base, camposDisponiblesCatalogo: ochoObligatorios }
    );
    const pedidas = new Set(r.map((p) => p.campoKey));
    for (const c of ochoObligatorios) {
      expect(pedidas.has(c.campoKey)).toBe(true);
    }
  });

  it("NUNCA descarta un obligatorio aunque los obligatorios solos superen el tope", () => {
    // 12 campos obligatorios y ninguna pregunta de la IA. Un slice ingenuo devolvería 10 y
    // perdería 2 obligatorios en silencio: el solicitante no los ve, el aviso no los lista.
    const doce = Array.from({ length: 12 }, (_, i) => ({
      campoKey: `obl_${i}`,
      label: `Obligatorio ${i}`,
      tipoDato: "texto" as const,
      obligatorio: true,
      origen: "assessment" as const,
      orden: i,
      activo: true,
    }));
    const r = consolidarPreguntas([], { ...base, camposDisponiblesCatalogo: doce });
    expect(r).toHaveLength(12);
    expect(new Set(r.map((p) => p.campoKey)).size).toBe(12);
  });

  it("los obligatorios agregados salen redactados sobre el producto, no como labels crudos", () => {
    const r = consolidarPreguntas([], base);
    const plazo = r.find((p) => p.campoKey === "plazo_entrega");
    expect(plazo?.pregunta).toMatch(/pintura epóxica/i);
    expect(plazo?.pregunta).toMatch(/[¿?]/);
  });
});

describe("assessment_requerimiento con IA que omite obligatorios", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("agrega los obligatorios aunque la IA devuelva su propia lista", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/orchestrator", () => ({
      assessment: vi.fn(async () => ({
        preguntas: [
          { campoKey: "cantidad", pregunta: "¿Cuántos galones?", por_que: "rendimiento", critica: false },
          { campoKey: "color_acabado", pregunta: "¿Color?", por_que: "estética", critica: false },
        ],
        contexto_investigado: "Investigado",
        sin_preguntas_pendientes: false,
        contexto_insuficiente: false,
        preguntas_contexto: [],
      })),
    }));
    const { assessment_requerimiento: conIA } = await import("./assessment");
    const r = await conIA({
      titulo: "Pintura epóxica para fachada",
      subtipo: "producto",
      camposCapturados: [],
      camposDisponiblesCatalogo: CATALOGO_OBLIGATORIOS,
    });
    const keys = r.preguntas.map((p) => p.campoKey);
    expect(keys).toContain("plazo_entrega");
    expect(keys).toContain("forma_pago");
    expect(r.preguntas.find((p) => p.campoKey === "cantidad")?.pregunta).toBe("¿Cuántos galones?");
    expect(r.sin_preguntas_pendientes).toBe(false);
  });
});