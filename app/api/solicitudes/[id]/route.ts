import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const editarSchema = z.object({
  descripcion: z.string().optional(),
  fechaRequerida: z.string().optional(),
  respuestas: z.record(z.string(), z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const cotizaciones = await repo.listarCotizaciones(id);
    return NextResponse.json({ solicitud, cotizaciones });
  } catch {
    return NextResponse.json({ error: "Error al obtener la solicitud" }, { status: 500 });
  }
}

// PATCH: re-cotización (2.3) — edita campos clave de una solicitud activa (descripción,
// fecha requerida, respuestas como cantidad). Solo admin/coordinador; debe existir y no estar terminal.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await guardApi(["coordinador", "admin"]);
    if (auth.negada) return auth.negada;

    const body = editarSchema.parse(await request.json());
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const terminales = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"];
    if (terminales.includes(solicitud.estado)) {
      return NextResponse.json(
        { error: "La solicitud está cerrada; no se puede editar para re-cotizar." },
        { status: 409 }
      );
    }

    await repo.actualizarCamposSolicitud(id, body);
    const actualizada = await repo.obtenerSolicitud(id);
    return NextResponse.json({ solicitud: actualizada });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error interno al editar la solicitud" }, { status: 500 });
  }
}