import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const schema = z.object({
  coordinadorId: z.string().min(1),
});

// POST: reasigna una solicitud a otro comprador (3.4). Solo admin (el middleware
// protege /api/admin/* y el guard refuerza el rol). Registra evento de trazabilidad.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const coordinadores = await repo.listarCoordinadores();
    if (!coordinadores.some((c) => c.id === body.coordinadorId)) {
      return NextResponse.json({ error: "El coordinador no existe" }, { status: 400 });
    }

    await repo.reasignarCoordinador(id, body.coordinadorId, auth.sesion.email);
    const actualizada = await repo.obtenerSolicitud(id);
    return NextResponse.json({ solicitud: actualizada });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al reasignar la solicitud" }, { status: 500 });
  }
}