// Motor de comparativa — Portal de Compras BIA
// Fuente: doc 16 (funciones del agente) + PRD (RF-33…40). Puras, sin dependencias.
import type {
  Comparativa,
  Cotizacion,
  Discrepancia,
  ProsContras,
} from "./types";

export type ResultadoComparativa = {
  discrepancias: Discrepancia[];
  comparablesEntreSi: boolean;
  advertenciaGeneral: string | null;
  prosContras: Record<string, ProsContras>;
  sugerencia: { cotizacionId: string; justificacion: string; advertencias: string[] } | null;
};

export function detectarDiscrepancias(opts: {
  especificacionesSolicitadas: Record<string, string>;
  cotizaciones: Cotizacion[];
}): Pick<
  ResultadoComparativa,
  "discrepancias" | "comparablesEntreSi" | "advertenciaGeneral"
> {
  const { especificacionesSolicitadas, cotizaciones } = opts;
  const discrepancias: Discrepancia[] = [];

  for (const [aspecto, solicitado] of Object.entries(especificacionesSolicitadas)) {
    const valoresPorProveedor: Record<string, string> = {};
    const distintos: string[] = [];
    for (const c of cotizaciones) {
      const ofrecido = c.especificacionesOfertadas[aspecto];
      valoresPorProveedor[c.proveedorNombre] = ofrecido ?? "(no especificado)";
      if (ofrecido !== undefined && !distintos.includes(ofrecido)) {
        distintos.push(ofrecido);
      }
    }
    if (distintos.length > 1) {
      discrepancias.push({
        aspecto,
        solicitado,
        porProveedor: valoresPorProveedor,
        severidad: "alta",
        explicacion: `Los proveedores ofertaron ${distintos.join(" vs ")} para "${aspecto}"`,
      });
    }
  }

  const severidadAlta = discrepancias.some((d) => d.severidad === "alta");
  return {
    discrepancias,
    comparablesEntreSi: !severidadAlta,
    advertenciaGeneral: severidadAlta
      ? "Las ofertas difieren en especificaciones clave; comparar solo por precio sería engañoso."
      : null,
  };
}

// Ahorro potencial (en moneda) de elegir la opción más económica frente a cada alternativa.
// Devuelve map id-cotización → ahorro vs la opción más cara con precio (o null si no calculable).
export function calcularAhorroPotencial(cotizaciones: Cotizacion[]): Record<string, number | null> {
  const conPrecio = cotizaciones.filter((c) => c.valorTotal !== undefined);
  if (conPrecio.length < 2) {
    return Object.fromEntries(cotizaciones.map((c) => [c.id, null]));
  }
  const menor = Math.min(...conPrecio.map((c) => c.valorTotal!));
  return Object.fromEntries(
    cotizaciones.map((c) => [
      c.id,
      c.valorTotal === undefined ? null : Math.round((c.valorTotal - menor) * 100) / 100,
    ])
  );
}

export function generarProsContras(opts: {
  requerimiento: string;
  cotizaciones: Cotizacion[];
}): {
  prosContras: Record<string, ProsContras>;
  sugerencia: ResultadoComparativa["sugerencia"];
} {
  const { cotizaciones } = opts;
  const prosContras: Record<string, ProsContras> = {};
  const conPrecio = cotizaciones.filter((c) => c.valorTotal !== undefined);
  const ahorro = calcularAhorroPotencial(cotizaciones);

  for (const c of cotizaciones) {
    const pros: string[] = [];
    const contras: string[] = [];

    if (typeof c.valorNeto === "number") pros.push("Precio neto especificado");
    if (typeof c.valorTotal === "number") pros.push("Total con impuestos claro");
    if (c.impuestosDesglosados === true) pros.push("Impuestos desglosados");
    if (c.plazoEntrega) pros.push(`Entrega: ${c.plazoEntrega}`);

    const ahorroDe = ahorro[c.id];
    if (typeof ahorroDe === "number" && ahorroDe > 0) {
      pros.push(
        `Ahorro potencial de ${formato(ahorroDe)} ${c.moneda ?? ""} frente a la opción más cara`
      );
    }

    if (c.impuestosDesglosados !== true) {
      contras.push("No confirma el tratamiento de impuestos");
    }
    if (c.especificacionesOfertadas === undefined || Object.keys(c.especificacionesOfertadas).length === 0) {
      contras.push("No declara especificaciones ofertadas");
    }

    prosContras[c.id] = { pros, contras };
  }

  let sugerencia: ResultadoComparativa["sugerencia"] = null;
  if (conPrecio.length > 1) {
    const ordenadas = [...conPrecio].sort((a, b) => (a.valorTotal ?? 0) - (b.valorTotal ?? 0));
    const mejor = ordenadas[0];
    const advertencias: string[] = [];
    if (mejor.impuestosDesglosados !== true) {
      advertencias.push("No confirma tratamiento de impuestos; verificar antes de decidir");
    }
    sugerencia = {
      cotizacionId: mejor.id,
      justificacion: `Mejor relación precio-total entre las ofertas comparadas (${formato(mejor.valorTotal)} ${mejor.moneda ?? ""})`,
      advertencias,
    };
  }

  return { prosContras, sugerencia };
}

export function construirComparativa(opts: {
  solicitudId: string;
  especificacionesSolicitadas: Record<string, string>;
  requerimiento: string;
  cotizaciones: Cotizacion[];
  now?: string;
}): Comparativa & { analysis: ResultadoComparativa } {
  const { cotizaciones, especificacionesSolicitadas, requerimiento, solicitudId, now } =
    opts;
  const disco = detectarDiscrepancias({ especificacionesSolicitadas, cotizaciones });
  const pc = generarProsContras({ requerimiento, cotizaciones });

  return {
    id: `cmp-${now ?? Date.now()}`,
    solicitudId,
    prosContras: pc.prosContras,
    discrepanciasDetectadas: disco.discrepancias,
    sugerenciaIA: pc.sugerencia?.justificacion,
    cotizacionSugeridaId: pc.sugerencia?.cotizacionId,
    fechaGeneracion: now ?? new Date().toISOString(),
    analysis: {
      discrepancias: disco.discrepancias,
      comparablesEntreSi: disco.comparablesEntreSi,
      advertenciaGeneral: disco.advertenciaGeneral,
      prosContras: pc.prosContras,
      sugerencia: pc.sugerencia,
    },
  };
}

export function formato(n: number | undefined): string {
  return typeof n === "number" ? n.toLocaleString("es-HN") : "—";
}

// Ruta IA de la comparativa: usa el orquestador para discrepancias + pros/contras +
// sugerencia razonada. Si falla o no está configurado, cae al motor determinístico.
export async function generarComparativaConIA(opts: {
  solicitudId: string;
  especificacionesSolicitadas: Record<string, string>;
  requerimiento: string;
  cotizaciones: Cotizacion[];
  now?: string;
}): Promise<Comparativa & { analysis: ResultadoComparativa }> {
  const fallback = () =>
    construirComparativa({
      solicitudId: opts.solicitudId,
      especificacionesSolicitadas: opts.especificacionesSolicitadas,
      requerimiento: opts.requerimiento,
      cotizaciones: opts.cotizaciones,
      now: opts.now,
    });

  if (opts.cotizaciones.length < 2) return fallback();

  try {
    const { comparativa: comparativaIA } = await import("@/lib/ai/orchestrator");
    const ia = await comparativaIA({
      tituloSolicitud: opts.requerimiento,
      especificacionesSolicitadas: opts.especificacionesSolicitadas,
      cotizaciones: opts.cotizaciones.map((c) => ({
        proveedorNombre: c.proveedorNombre,
        valorNeto: c.valorNeto ?? null,
        moneda: c.moneda ?? null,
        montoIsv: c.montoIsv ?? null,
        montoOtrosImpuestos: c.montoOtrosImpuestos ?? null,
        valorTotal: c.valorTotal ?? null,
        plazoEntrega: c.plazoEntrega ?? null,
        formaPago: c.formaPago ?? null,
        vigenciaOferta: c.vigenciaOferta ?? null,
        garantia: c.garantia ?? null,
        impuestosDesglosados: c.impuestosDesglosados ?? null,
        observacionesFiscales: c.observacionesFiscales ?? null,
        proveedorIdentificacionFiscal: c.proveedorIdentificacionFiscal ?? null,
        especificacionesOfertadas: c.especificacionesOfertadas ?? {},
      })),
    });

    if (!ia) return fallback();

    const now = opts.now ?? new Date().toISOString();
    const disco = detectarDiscrepancias({
      especificacionesSolicitadas: opts.especificacionesSolicitadas,
      cotizaciones: opts.cotizaciones,
    });
    const pc = generarProsContras({
      requerimiento: opts.requerimiento,
      cotizaciones: opts.cotizaciones,
    });

    const discrepancias = ia.discrepanciasDetectadas.length
      ? ia.discrepanciasDetectadas
      : disco.discrepancias;

    const prosContrasIA: Record<string, ProsContras> = {};
    for (const c of opts.cotizaciones) {
      prosContrasIA[c.id] = ia.prosContras[c.proveedorNombre] ?? pc.prosContras[c.id] ?? { pros: [], contras: [] };
    }

    // RN-01: la IA sugiere, nunca decide. La justificación debe citar datos.
    const cotizacionSugerida = ia.cotizacionSugeridaId
      ? opts.cotizaciones.find((c) => c.id === ia.cotizacionSugeridaId || c.proveedorNombre === ia.cotizacionSugeridaId)
      : undefined;
    const sugerenciaIA = ia.sugerenciaIA
      ? `${ia.sugerenciaIA}${cotizacionSugerida ? " — Generada por el sistema." : ""}`
      : (pc.sugerencia?.justificacion ?? null);

    return {
      id: `cmp-${now}`,
      solicitudId: opts.solicitudId,
      prosContras: prosContrasIA,
      discrepanciasDetectadas: discrepancias,
      sugerenciaIA: sugerenciaIA ?? undefined,
      cotizacionSugeridaId: cotizacionSugerida?.id ?? pc.sugerencia?.cotizacionId ?? undefined,
      fechaGeneracion: now,
      analysis: {
        discrepancias,
        comparablesEntreSi: ia.advertenciaGeneral ? !discrepancias.some((d) => d.severidad === "alta") : disco.comparablesEntreSi,
        advertenciaGeneral: ia.advertenciaGeneral ?? disco.advertenciaGeneral,
        prosContras: prosContrasIA,
        sugerencia: pc.sugerencia,
      },
    };
  } catch {
    return fallback();
  }
}
