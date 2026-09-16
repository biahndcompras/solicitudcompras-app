// Plantilla declarativa de pdfme para RFI/RFQ/RFP con membrete corporativo BIA.
// Reemplazable por la oficial de Compras sin recodificar (solo cambiar esta definición).
// Estructura pdfme 6:
//  - Textos estáticos (membrete, rótulos, secciones): readOnly=true + content literal (se dibujan tal cual).
//  - Textos dinámicos (referencia, áreas, valores): readOnly=false y schema.name = clave del input
//    (pdfme toma el valor de input[name]; en v6 el resolver de {{placeholders}} no embebe correctamente).
//  - La fuente se registra vía options.font en lib/pdf/generador.ts.

export type PlantillaPdf = {
  basePdf: { width: number; height: number; padding: [number, number, number, number]; staticSchema?: unknown[] };
  schemas: Record<string, unknown>[][];
};

const ANCHO = 595;
const ALTO = 842;
const MX = 40; // margen x
const ANCHO_CONTENIDO = ANCHO - MX * 2;

function textSchema(name: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    type: "text",
    position: { x, y },
    width: w,
    height: h,
    fontSize: 9,
    lineHeight: 1.3,
    fontName: "Roboto",
    readOnly: true,
    content: String(extra.content ?? ""),
    ...extra,
  };
}

// Texto dinámico: su valor viene del input por nombre (no de content).
function field(name: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    type: "text",
    position: { x, y },
    width: w,
    height: h,
    fontSize: 9,
    lineHeight: 1.3,
    fontName: "Roboto",
    ...extra,
  };
}

function linea(x1: number, y1: number, x2: number, y2: number, color = "D1D5DB"): Record<string, unknown> {
  return { name: `l_${x1}_${y1}`, type: "line", position: { x: x1, y: y1 }, width: x2 - x1, height: y2 - y1, color };
}

// Título del documento según tipo (paralelo a los encabezados de BIA: "SOLICITUD DE COTIZACIÓN (RFQ)").
const TITULO_DOC: Record<string, string> = {
  RFQ: "SOLICITUD DE COTIZACIÓN (RFQ)",
  RFP: "SOLICITUD DE PROPUESTA (RFP)",
  RFI: "SOLICITUD DE INFORMACIÓN (RFI)",
};

const SUBTITULO_DOC: Record<string, string> = {
  RFQ: "Estamos solicitando cotización de proveedores para la siguiente necesidad.",
  RFP: "Solicitamos propuestas técnicas y económicas para el siguiente proyecto.",
  RFI: "Solicitamos información de mercado para la siguiente necesidad.",
};

export function createTemplate(tipo: "RFI" | "RFQ" | "RFP"): PlantillaPdf {
  // Encabezado corporativo (membrete) alineado al estilo de los formatos de BIA.
  const header: Record<string, unknown>[] = [
    textSchema("bia_marca", MX, 36, 140, 16, { fontSize: 13, fontWeight: 800, content: "BIA" }),
    textSchema("bia_slogan", MX + 30, 50, 200, 10, { fontSize: 7, content: "BIA Foods Honduras · Compras" }),
    textSchema("doc_tipo", MX + 150, 36, 300, 16, { fontSize: 12, fontWeight: 700, content: TITULO_DOC[tipo] }),
    textSchema("doc_subtipo", MX + 150, 52, 300, 12, { fontSize: 8, content: SUBTITULO_DOC[tipo] }),
    linea(MX, 72, ANCHO - MX, 72),
    textSchema("referencia_lbl", ANCHO - 190, 82, 90, 10, { fontSize: 7, content: "Nº DE REFERENCIA" }),
    field("referencia", ANCHO - 190, 93, 90, 12, { fontSize: 9, fontWeight: 700, alignment: "right" }),
    textSchema("fecha_lbl", ANCHO - 95, 82, 90, 10, { fontSize: 7, alignment: "right", content: "FECHA" }),
    field("fechaLimiteHeader", ANCHO - 95, 93, 90, 12, { fontSize: 8, alignment: "right" }),
  ];

  // Bloques de identificación (como la "Información General" / "Alcance" de los formatos).
  const bloqueInfo: Record<string, unknown>[] = [
    textSchema("secc_1", MX, 124, 120, 12, { fontSize: 9, fontWeight: 700, content: "1. INFORMACIÓN GENERAL" }),
    linea(MX, 136, ANCHO - MX, 136, "E2E8F0"),
    textSchema("k_area", MX, 146, 120, 14, { fontSize: 8, fontWeight: 600, content: "Área solicitante:" }),
    field("area", MX + 125, 146, 330, 14, { fontSize: 8 }),
    textSchema("k_soli", MX, 164, 120, 14, { fontSize: 8, fontWeight: 600, content: "Solicitante:" }),
    field("solicitante", MX + 125, 164, 330, 14, { fontSize: 8 }),
    textSchema("k_coord", MX, 182, 120, 14, { fontSize: 8, fontWeight: 600, content: "Coordinador:" }),
    field("coordinadorAsignado", MX + 125, 182, 330, 14, { fontSize: 8 }),
    textSchema("k_fecha", MX, 200, 120, 14, { fontSize: 8, fontWeight: 600, content: "Fecha límite:" }),
    field("fechaLimite", MX + 125, 200, 330, 14, { fontSize: 8 }),
  ];

  const bloqueProyecto: Record<string, unknown>[] = [
    textSchema("secc_2", MX, 232, 120, 12, { fontSize: 9, fontWeight: 700, content: "2. DESCRIPCIÓN DE LA NECESIDAD" }),
    linea(MX, 244, ANCHO - MX, 244, "E2E8F0"),
    field("titulo", MX, 254, ANCHO_CONTENIDO, 18, { fontSize: 14, fontWeight: 700 }),
    field("descripcion", MX, 276, ANCHO_CONTENIDO, 120, { fontSize: 9, lineHeight: 1.5 }),
  ];

  const bloqueCampos: Record<string, unknown>[] = [
    textSchema("secc_3", MX, 404, 360, 12, { fontSize: 9, fontWeight: 700, content: "3. ESPECIFICACIONES Y CONDICIONES" }),
    linea(MX, 416, ANCHO - MX, 416, "E2E8F0"),
    field("campos", MX, 426, ANCHO_CONTENIDO, 330, { fontSize: 9, lineHeight: 1.6 }),
  ];

  const footer: Record<string, unknown>[] = [
    linea(MX, ALTO - 60, ANCHO - MX, ALTO - 60, "CBB7E0"),
    textSchema("secrepcion", MX, ALTO - 44, ANCHO_CONTENIDO, 10, {
      fontSize: 7,
      content: "Documento generado por el Portal de Compras BIA · Confidencial · El precio y condiciones de esta solicitud son para uso exclusivo de los proveedores invitados.",
    }),
    textSchema("firma_lbl", MX, ALTO - 34, 300, 10, { fontSize: 7, content: "BIA Foods Honduras · Departamento de Compras" }),
  ];

  return {
    basePdf: { width: ANCHO, height: ALTO, padding: [0, 0, 0, 0] },
    schemas: [[...header, ...bloqueInfo, ...bloqueProyecto, ...bloqueCampos, ...footer]],
  };
}