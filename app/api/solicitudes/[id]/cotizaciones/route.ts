import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;
    const cotizaciones = await repo.listarCotizaciones(id);
    return NextResponse.json(cotizaciones);
  } catch {
    return NextResponse.json({ error: "Error al listar cotizaciones" }, { status: 500 });
  }
}

const schema = z.object({
  proveedorNombre: z.string().min(1),
  formatoOriginal: z.enum(["pdf", "docx", "imagen", "manual"]),
  valorNeto: z.number().nullable().optional(),
  moneda: z.string().optional(),
  impuestosDesglosados: z.boolean().nullable().optional(),
  montoIsv: z.number().nullable().optional(),
  valorTotal: z.number().nullable().optional(),
  plazoEntrega: z.string().optional(),
  especificacionesOfertadas: z.record(z.string(), z.string()).default({}),
  confianzaExtraccion: z.record(z.string(), z.number()).default({}),
  markdownExtraido: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;

    // Soporta dos formatos: JSON (compat, sin archivo) y FormData (con archivo original).
    const contentType = request.headers.get("content-type") ?? "";
    let body: z.infer<typeof schema>;
    let archivoBytea: Uint8Array | undefined;
    let archivoNombre: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const archivo = form.get("archivo");
      if (archivo instanceof File) {
        archivoBytea = new Uint8Array(await archivo.arrayBuffer());
        archivoNombre = archivo.name;
      }
      body = schema.parse({
        proveedorNombre: form.get("proveedorNombre"),
        formatoOriginal: form.get("formatoOriginal") ?? "manual",
        valorNeto: maybeNum(form.get("valorNeto")),
        moneda: form.get("moneda") ?? undefined,
        impuestosDesglosados: boolOrUndef(form.get("impuestosDesglosados")),
        montoIsv: maybeNum(form.get("montoIsv")),
        valorTotal: maybeNum(form.get("valorTotal")),
        plazoEntrega: form.get("plazoEntrega") ?? undefined,
        markdownExtraido: form.get("markdownExtraido") ?? undefined,
      });
    } else {
      body = schema.parse(await request.json());
    }

    const cotizacion = await repo.guardarCotizacion({
      solicitudId: id,
      proveedorNombre: body.proveedorNombre,
      formatoOriginal: body.formatoOriginal,
      valorNeto: body.valorNeto ?? undefined,
      moneda: body.moneda,
      impuestosDesglosados: body.impuestosDesglosados ?? undefined,
      montoIsv: body.montoIsv ?? undefined,
      valorTotal: body.valorTotal ?? undefined,
      plazoEntrega: body.plazoEntrega,
      especificacionesOfertadas: body.especificacionesOfertadas,
      confianzaExtraccion: body.confianzaExtraccion,
      editadaManualmente: false,
      fechaCarga: new Date().toISOString(),
      // 2.2: persistir el archivo original para adjuntarlo al envío de comparativa.
      archivoOriginal: archivoBytea ? `cotizacion/${cotizacionRef(id, archivoNombre)}` : undefined,
      archivoNombreOriginal: archivoNombre,
      archivoBytea,
    });

    // Si se incluyó markdown extraído, ejecutar extracción IA y actualizar.
    if (body.markdownExtraido) {
      try {
        const { extraerCotizacion } = await import("@/lib/ai/orchestrator");
        const extraida = await extraerCotizacion({
          markdown: body.markdownExtraido,
          especificacionesSolicitadas: {},
        });
        if (extraida) {
          await repo.actualizarCotizacion(cotizacion.id, {
            proveedorNombre: extraida.proveedorNombre ?? cotizacion.proveedorNombre,
            proveedorIdentificacionFiscal: extraida.proveedorIdentificacionFiscal ?? undefined,
            proveedorContacto: extraida.proveedorContacto ?? undefined,
            valorNeto: extraida.valorNeto ?? undefined,
            moneda: extraida.moneda ?? undefined,
            impuestosDesglosados: extraida.impuestosDesglosados ?? undefined,
            montoIsv: extraida.montoIsv ?? undefined,
            montoOtrosImpuestos: extraida.montoOtrosImpuestos ?? undefined,
            valorTotal: extraida.valorTotal ?? undefined,
            plazoEntrega: extraida.plazoEntrega ?? undefined,
            formaPago: extraida.formaPago ?? undefined,
            vigenciaOferta: extraida.vigenciaOferta ?? undefined,
            garantia: extraida.garantia ?? undefined,
            especificacionesOfertadas: extraida.especificacionesOfertadas,
            observacionesFiscales: extraida.observacionesFiscales ?? undefined,
            confianzaExtraccion: extraida.confianzaPorCampo,
            fechaCarga: new Date().toISOString(),
          });
          // Validación fiscal tras extraer (asíncrona, no bloqueante).
          void validarCotizacion(cotizacion.id, extraida).catch(() => undefined);
        }
      } catch {
        // Si la extracción IA falla, se guarda con los datos originales (no bloqueante).
      }
    }

    // Releer para devolver datos actualizados.
    const actualizada = body.markdownExtraido
      ? (await repo.listarCotizaciones(id)).find((c) => c.id === cotizacion.id) ?? cotizacion
      : cotizacion;

    return NextResponse.json(actualizada, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al guardar la cotización" }, { status: 500 });
  }
}

type DatosExtraidos = {
  valorNeto?: number | null;
  montoIsv?: number | null;
  montoOtrosImpuestos?: number | null;
  valorTotal?: number | null;
  impuestosDesglosados?: boolean | null;
  observacionesFiscales?: string | null;
};

function maybeNum(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function boolOrUndef(v: FormDataEntryValue | null): boolean | undefined {
  if (v === null || v === "") return undefined;
  return v === "true" || v === "1";
}

function cotizacionRef(id: string, nombre?: string): string {
  const nombreOk = nombre ? `_${nombre.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40)}` : "";
  return `${id}${nombreOk}`;
}

// Validación fiscal: determinística primero, luego IA si está disponible. Nunca bloquea.
async function validarCotizacion(cotizacionId: string, extraida: DatosExtraidos): Promise<void> {
  const { detectarTratamientoFiscal } = await import("@/lib/domain/rules");
  const det = detectarTratamientoFiscal({
    valorNeto: extraida.valorNeto ?? undefined,
    montoIsv: extraida.montoIsv ?? undefined,
    montoOtrosImpuestos: extraida.montoOtrosImpuestos ?? undefined,
    valorTotal: extraida.valorTotal ?? undefined,
    impuestosDesglosados: extraida.impuestosDesglosados ?? undefined,
  });

  // Intento con IA (si hay clave), con la determinística como observación base.
  let observacion = det.observacion ?? extraida.observacionesFiscales;
  let requiereAclaracion = det.requiere_aclaracion;
  try {
    const { validarFiscal } = await import("@/lib/ai/orchestrator");
    const ia = await validarFiscal({
      valorNeto: extraida.valorNeto ?? null,
      montoIsv: extraida.montoIsv ?? null,
      montoOtrosImpuestos: extraida.montoOtrosImpuestos ?? null,
      valorTotal: extraida.valorTotal ?? null,
      impuestosDesglosados: extraida.impuestosDesglosados ?? null,
      tasaIsv: 0.15,
    });
    if (ia) {
      // Preferir la coherencia de la IA, pero nunca inventar: si dice no_verificable usamos la determinística.
      if (ia.coherencia_aritmetica !== "no_verificable" || det.coherencia === "no_verificable") {
        observacion = ia.observacion ?? observacion;
        requiereAclaracion = ia.requiere_aclaracion;
        if (det.coherencia !== "no_verificable" && ia.coherencia_aritmetica === "no_verificable") {
          observacion = det.observacion ?? observacion;
          requiereAclaracion = det.requiere_aclaracion;
        }
      }
    }
  } catch {
    // Sin clave o error de IA → queda la determinística.
  }

  const notaFinal = requiereAclaracion
    ? observacion
      ? `${observacion} Requiere aclaración con el proveedor antes de comparar.`
      : "Requiere aclaración con el proveedor antes de comparar (impuestos no verificados)."
    : observacion;

  await repo.actualizarCotizacion(cotizacionId, {
    observacionesFiscales: notaFinal ?? undefined,
    fechaCarga: new Date().toISOString(),
  });
}