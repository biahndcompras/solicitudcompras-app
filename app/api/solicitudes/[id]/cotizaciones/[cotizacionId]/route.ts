import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const updateSchema = z.object({
  proveedorNombre: z.string().min(1).optional(),
  formatoOriginal: z.enum(["pdf", "docx", "imagen", "manual"]).optional(),
  valorNeto: z.number().nullable().optional(),
  moneda: z.string().optional(),
  impuestosDesglosados: z.boolean().nullable().optional(),
  montoIsv: z.number().nullable().optional(),
  valorTotal: z.number().nullable().optional(),
  plazoEntrega: z.string().optional(),
  especificacionesOfertadas: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cotizacionId: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id, cotizacionId } = await params;
    // La cotización tiene que ser de ESTA solicitud. Sin esta comprobación el endpoint
    // operaba sobre cualquier cotización por su id, y la URL mentía sobre qué modificaba:
    // el cliente mandaba incluso un `_` en lugar del id real.
    const deLaSolicitud = await repo.listarCotizaciones(id);
    if (!deLaSolicitud.some((c) => c.id === cotizacionId)) {
      return NextResponse.json({ error: "La cotización no pertenece a esta solicitud" }, { status: 404 });
    }
    const body = updateSchema.parse(await request.json());
    await repo.actualizarCotizacion(cotizacionId, {
      proveedorNombre: body.proveedorNombre,
      formatoOriginal: body.formatoOriginal,
      valorNeto: body.valorNeto ?? undefined,
      moneda: body.moneda,
      impuestosDesglosados: body.impuestosDesglosados ?? undefined,
      montoIsv: body.montoIsv ?? undefined,
      valorTotal: body.valorTotal ?? undefined,
      plazoEntrega: body.plazoEntrega,
      especificacionesOfertadas: body.especificacionesOfertadas,
      editadaManualmente: true,
      fechaCarga: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la cotización" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cotizacionId: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id, cotizacionId } = await params;
    // La cotización tiene que ser de ESTA solicitud. Sin esta comprobación el endpoint
    // operaba sobre cualquier cotización por su id, y la URL mentía sobre qué modificaba:
    // el cliente mandaba incluso un `_` en lugar del id real.
    const deLaSolicitud = await repo.listarCotizaciones(id);
    if (!deLaSolicitud.some((c) => c.id === cotizacionId)) {
      return NextResponse.json({ error: "La cotización no pertenece a esta solicitud" }, { status: 404 });
    }
    await repo.eliminarCotizacion(cotizacionId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la cotización" }, { status: 500 });
  }
}