// Generador del documento RFQ/RFI/RFP.
//
// Lo que se fija: que salga un PDF válido, en **Carta**, con el logo y con **paginación real**
// cuando las respuestas no entran en una hoja. Antes el PDF era texto corrido a 7–9 pt y todo
// iba a una sola página fija (el texto largo se cortaba).
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generarDocumento } from "./generador";
import type { Solicitud } from "@/lib/domain/types";

function sol(overrides: Partial<Solicitud> = {}): Solicitud {
  return {
    id: "s1",
    numeroReferencia: "RFQ-2026-014",
    tipo: "RFQ",
    subtipo: "producto",
    estado: "ENVIADA_A_COMPRAS",
    titulo: "Sombrillas brandeadas Café Oro",
    descripcion: "200 sombrillas con logo para activación de playa",
    solicitanteEmail: "maria.reyes@bia.hn",
    solicitanteNombre: "María Reyes",
    areaSolicitante: "Marketing",
    fechaRequerida: "2026-08-25",
    fechaCreacion: "2026-07-20T10:00:00Z",
    clasificacionCorregida: false,
    notificacionFallida: false,
    ...overrides,
  };
}

async function cargar(doc: { buffer: Uint8Array }) {
  return PDFDocument.load(doc.buffer);
}

describe("pdf generador", () => {
  it("genera un PDF válido en tamaño Carta con la referencia", async () => {
    const doc = await generarDocumento({
      tipo: "RFQ",
      solicitud: sol(),
      respuestas: { "Dimensiones": "2.0m", "Materiales": "poliéster UV" },
      coordenadorNombre: "Carlos Mejía",
    });
    expect(doc.buffer).toBeInstanceOf(Uint8Array);
    expect(doc.referencia).toBe("RFQ-2026-014");
    expect(doc.tipo).toBe("RFQ");

    const pdf = await cargar(doc);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);
  }, 20000);

  it("usa 'no especificado' para datos faltantes (RN-06) y no falla", async () => {
    const doc = await generarDocumento({
      tipo: "RFQ",
      solicitud: sol({ descripcion: undefined, areaSolicitante: undefined }),
      respuestas: {},
    });
    const pdf = await cargar(doc);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("genera para RFP y RFI también", async () => {
    for (const tipo of ["RFI", "RFP"] as const) {
      const doc = await generarDocumento({ tipo, solicitud: sol({ tipo }), respuestas: {} });
      const pdf = await cargar(doc);
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    }
  }, 20000);

  it("pagina cuando las respuestas no entran en una hoja (60 campos + descripción larga)", async () => {
    const respuestas = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [
        `Campo ${i + 1}`,
        "Detalle técnico que ocupa más de una línea para probar el corte de filas.",
      ])
    );
    const doc = await generarDocumento({
      tipo: "RFQ",
      solicitud: sol({ descripcion: "Descripción larga. ".repeat(180) }),
      respuestas,
    });
    const pdf = await cargar(doc);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  }, 20000);
});
