// Generador del Excel comparativo de cotizaciones — Portal de Compras BIA
// Fuente: doc 13 §5 (formato, regla de oro) + doc 17 H3.5 + RF-36.
// 3 hojas: Comparativo / Detalle de cotizaciones / Requerimiento original.
import * as XLSX from "xlsx";
import type { Comparativa, Cotizacion, Solicitud } from "@/lib/domain/types";

type DatosExcel = {
  solicitud: Solicitud;
  comparativa: Comparativa;
  cotizaciones: Cotizacion[];
  especificacionesSolicitadas?: Record<string, string>;
};

// Hoja 1 — "Comparativo" (bloques A–H: producto a la izquierda, un proveedor por columna)
function hojaComparativo(d: DatosExcel): (string | number)[][] {
  const provs = d.cotizaciones.map((c) => c.proveedorNombre);
  const filas: (string | number)[][] = [];

  const seccion = (titulo: string): void => {
    filas.push([titulo, ...provs]);
    filas.push([]);
  };

  filas.push(["COMPARATIVO DE COTIZACIONES"]);
  filas.push(["Referencia:", d.solicitud.numeroReferencia ?? "—", "Tipo:", d.solicitud.tipo ?? "—"]);
  filas.push(["Solicitud:", d.solicitud.titulo]);
  filas.push(["Solicitante:", d.solicitud.solicitanteNombre, "Área:", d.solicitud.areaSolicitante ?? "—"]);
  filas.push(["Fecha:", new Date().toISOString().split("T")[0]]);
  filas.push([]);

  // A. Identificación
  seccion("A. Identificación");
  filas.push(["Proveedor", ...provs]);
  filas.push(["Vigencia de la oferta", ...d.cotizaciones.map((c) => c.vigenciaOferta ?? "no especificado")]);
  filas.push([]);

  // B. Especificación ofertada
  seccion("B. Especificación ofertada");
  const claves = Array.from(new Set(d.cotizaciones.flatMap((c) => Object.keys(c.especificacionesOfertadas ?? {}))));
  for (const k of claves) {
    filas.push([k, ...d.cotizaciones.map((c) => c.especificacionesOfertadas?.[k] ?? "no especificado")]);
  }
  filas.push([]);

  // C. Valor neto (regla de oro: neto arriba)
  seccion("C. Valor neto");
  filas.push(["VALOR NETO TOTAL", ...d.cotizaciones.map((c) => c.valorNeto ?? "no especificado")]);
  filas.push([]);

  // D. Impuestos
  seccion("D. Impuestos");
  filas.push(["ISV", ...d.cotizaciones.map((c) => c.montoIsv ?? "no especificado")]);
  filas.push(["Otros impuestos", ...d.cotizaciones.map((c) => c.montoOtrosImpuestos ?? "no especificado")]);
  filas.push([
    "¿Impuestos desglosados?",
    ...d.cotizaciones.map((c) =>
      c.impuestosDesglosados === true ? "Sí" : c.impuestosDesglosados === false ? "Precio sin impuestos" : "No declarado"
    ),
  ]);
  filas.push([]);

  // E. Total
  seccion("E. Total");
  filas.push([
    "TOTAL CON IMPUESTOS",
    ...d.cotizaciones.map((c) => (c.valorTotal ?? "no especificado") + (c.moneda ? ` ${c.moneda}` : "")),
  ]);
  filas.push([]);

  // F. Condiciones
  seccion("F. Condiciones");
  filas.push(["Plazo de entrega", ...d.cotizaciones.map((c) => c.plazoEntrega ?? "no especificado")]);
  filas.push(["Forma de pago", ...d.cotizaciones.map((c) => c.formaPago ?? "no especificado")]);
  filas.push(["Garantía", ...d.cotizaciones.map((c) => c.garantia ?? "no especificado")]);
  filas.push([]);

  // G. Análisis
  seccion("G. Análisis");
  for (const c of d.cotizaciones) {
    const pc = d.comparativa.prosContras?.[c.id];
    filas.push([`Pros — ${c.proveedorNombre}`, ...(pc?.pros ?? ["—"])]);
    filas.push([`Contras — ${c.proveedorNombre}`, ...(pc?.contras ?? ["—"])]);
  }
  filas.push(["Observaciones fiscales", ...d.cotizaciones.map((c) => c.observacionesFiscales ?? "—")]);
  filas.push([]);

  // H. Decisión
  seccion("H. Decisión");
  filas.push(["Sugerencia del sistema (IA)", d.comparativa.sugerenciaIA ?? "—"]);
  filas.push(["Recomendación del comprador (obligatoria)", ""]);
  return filas;
}

// Hoja 2 — "Detalle de cotizaciones"
function hojaDetalle(d: DatosExcel): (string | number)[][] {
  const filas: (string | number)[][] = [];
  filas.push(["Detalle de cotizaciones"]);
  filas.push([]);
  filas.push(["Proveedor", "Formato", "Plazo", "Forma de pago", "Vigencia", "Garantía", "Fecha de carga", "Notas de extracción / baja confianza"]);
  for (const c of d.cotizaciones) {
    const nota =
      c.confianzaExtraccion && Object.values(c.confianzaExtraccion).some((v) => v >= 0 && v < 0.5)
        ? "Verificar manualmente (baja confianza en extracción)"
        : "—";
    filas.push([
      c.proveedorNombre,
      c.formatoOriginal,
      c.plazoEntrega ?? "no especificado",
      c.formaPago ?? "no especificado",
      c.vigenciaOferta ?? "no especificado",
      c.garantia ?? "no especificado",
      c.fechaCarga?.split("T")[0] ?? "—",
      nota,
    ]);
  }
  return filas;
}

// Hoja 3 — "Requerimiento original"
function hojaRequerimiento(d: DatosExcel): (string | number)[][] {
  const filas: (string | number)[][] = [];
  filas.push(["Requerimiento original"]);
  filas.push([]);
  filas.push(["Solicitud:", d.solicitud.titulo]);
  filas.push(["Descripción:", d.solicitud.descripcion ?? "—"]);
  filas.push(["Especificaciones solicitadas"]);
  const especificaciones = d.especificacionesSolicitadas ?? {};
  if (Object.keys(especificaciones).length === 0) {
    filas.push(["—", "Sin especificaciones formalizadas a esta fecha"]);
  } else {
    for (const [k, v] of Object.entries(especificaciones)) {
      filas.push([k, v]);
    }
  }
  return filas;
}

export function generarExcelComparativo(d: DatosExcel): Buffer {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(hojaComparativo(d)), "Comparativo");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(hojaDetalle(d)), "Detalle de cotizaciones");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(hojaRequerimiento(d)), "Requerimiento original");
  const wbout = XLSX.write(libro, { bookType: "xlsx", type: "buffer" });
  return wbout as Buffer;
}