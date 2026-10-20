import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { generarExcelComparativo } from "./comparativo";
import type { Comparativa, Cotizacion, Solicitud } from "@/lib/domain/types";

const solicitud: Solicitud = {
  id: "s1",
  numeroReferencia: "RFQ-2026-014",
  titulo: "Sombrillas corporativas",
  descripcion: "Sombrillas con logo",
  estado: "COMPARATIVA_LISTA",
  solicitanteEmail: "maria@bia.hn",
  solicitanteNombre: "María",
  areaSolicitante: "Marketing",
  fechaCreacion: "2026-08-15",
  clasificacionCorregida: false,
  notificacionFallida: false,
};

function cot(id: string, nombre: string, precios: { moneda?: string; neto?: number; isv?: number; total?: number; desglosado?: boolean }): Cotizacion {
  return {
    id,
    solicitudId: "s1",
    proveedorNombre: nombre,
    formatoOriginal: "manual",
    valorNeto: precios.neto,
    moneda: precios.moneda ?? "HNL",
    montoIsv: precios.isv,
    valorTotal: precios.total,
    impuestosDesglosados: precios.desglosado,
    especificacionesOfertadas: { material: "lona impermeable" },
    confianzaExtraccion: {},
    editadaManualmente: false,
    fechaCarga: "2026-08-15",
  };
}

const comparativa: Comparativa = {
  id: "cmp-1",
  solicitudId: "s1",
  // Se persiste indexado por cotizacion.id, no por nombre (ver postgres-repo.guardarComparativa).
  prosContras: { c1: { pros: ["Lona impermeable"], contras: ["Más caro"] }, c2: { pros: ["Menor precio"], contras: [] } },
  discrepanciasDetectadas: [],
  sugerenciaIA: "Generada por el sistema: PlayaPromo ofrece el menor total.",
  cotizacionSugeridaId: "PlayaPromo",
  fechaGeneracion: "2026-08-15",
};

describe("generarExcelComparativo", () => {
  it("produce un .xlsx con las 3 hojas", () => {
    const buffer = generarExcelComparativo({
      solicitud,
      comparativa,
      cotizaciones: [
        cot("c1", "CostaPrint", { neto: 86000, isv: 12900, total: 98900, desglosado: true }),
        cot("c2", "PlayaPromo", { moneda: "USD", neto: 3000, total: 3000, desglosado: false }),
      ],
      especificacionesSolicitadas: { material: "lona impermeable 600d" },
    });

    const libro = XLSX.read(buffer, { type: "buffer" });
    expect(libro.SheetNames).toEqual(["Comparativo", "Detalle de cotizaciones", "Requerimiento original"]);
  });

  it("incluye 'no especificado' en lugar de cero cuando falta el ISV", () => {
    const buffer = generarExcelComparativo({
      solicitud,
      comparativa,
      cotizaciones: [
        cot("c1", "CostaPrint", { neto: 100, total: 100, desglosado: false }),
        cot("c2", "PlayaPromo", { neto: 90, total: 90, desglosado: false }),
      ],
    });
    const libro = XLSX.read(buffer, { type: "buffer" });
    const hoja = XLSX.utils.sheet_to_json(libro.Sheets["Comparativo"], { header: 1 }) as unknown[][];
    // Buscar la fila de ISV: debe decir "no especificado" (nunca 0).
    const filaIsv = hoja.find((f) => String(f[0]).includes("ISV"));
    expect(filaIsv).toBeDefined();
    expect(filaIsv!.slice(1).every((v) => String(v).toLowerCase().includes("no especificado"))).toBe(true);
  });

  it("muestra pros y contras reales en G. Análisis (indexados por cotizacion.id)", () => {
    const buffer = generarExcelComparativo({
      solicitud,
      comparativa,
      cotizaciones: [
        cot("c1", "CostaPrint", { neto: 86000, isv: 12900, total: 98900, desglosado: true }),
        cot("c2", "PlayaPromo", { moneda: "USD", neto: 3000, total: 3000, desglosado: false }),
      ],
      especificacionesSolicitadas: { material: "lona impermeable 600d" },
    });
    const libro = XLSX.read(buffer, { type: "buffer" });
    const hoja = XLSX.utils.sheet_to_json(libro.Sheets["Comparativo"], { header: 1 }) as unknown[][];
    const filaPros = hoja.find((f) => String(f[0]) === "Pros — CostaPrint");
    const filaContras = hoja.find((f) => String(f[0]) === "Contras — CostaPrint");
    expect(filaPros).toBeDefined();
    expect(filaContras).toBeDefined();
    expect(filaPros!.slice(1)).toContain("Lona impermeable");
    expect(filaContras!.slice(1)).toContain("Más caro");
  });
});
// 4.2.2 — el glosario define la comparativa como "el producto/servicio a la izquierda y un
// proveedor por columna". Sin estas filas el Excel comparaba precios sin declarar qué se compra.
describe("4.2.2 · producto/servicio y detalle en la hoja Comparativo", () => {
  it("encabeza con el producto/servicio y el detalle de la solicitud", () => {
    const buffer = generarExcelComparativo({
      solicitud: { ...solicitud, subtipo: "producto" },
      comparativa,
      cotizaciones: [
        cot("c1", "CostaPrint", { neto: 100, total: 100, desglosado: false }),
        cot("c2", "PlayaPromo", { neto: 90, total: 90, desglosado: false }),
      ],
    });
    const libro = XLSX.read(buffer, { type: "buffer" });
    const filas = XLSX.utils.sheet_to_json(libro.Sheets["Comparativo"], { header: 1 }) as unknown[][];
    const texto = filas.flat().map((v) => String(v ?? ""));
    expect(texto).toContain("Producto/Servicio:");
    expect(texto).toContain("Producto");
    expect(texto).toContain("Detalle:");
    expect(texto).toContain("Sombrillas con logo");
  });

  it("sin subtipo no inventa: dice 'No especificado'", () => {
    const buffer = generarExcelComparativo({ solicitud, comparativa, cotizaciones: [
      cot("c1", "CostaPrint", { neto: 100, total: 100, desglosado: false }),
      cot("c2", "PlayaPromo", { neto: 90, total: 90, desglosado: false }),
    ] });
    const libro = XLSX.read(buffer, { type: "buffer" });
    const texto = (XLSX.utils.sheet_to_json(libro.Sheets["Comparativo"], { header: 1 }) as unknown[][]).flat().map((v) => String(v ?? ""));
    expect(texto).toContain("No especificado");
  });
});
