import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

const repo = new PostgresRepositorio();

// Resuelve un token de link público → comparativa + cotizaciones para la vista pública.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await repo.obtenerLinkPorToken(token);
    if (!link) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
    }
    if (link.revocado) {
      return NextResponse.json({ error: "Este enlace fue revocado" }, { status: 403 });
    }
    if (link.fechaExpiracion && new Date(link.fechaExpiracion).getTime() < Date.now()) {
      return NextResponse.json({ error: "Este enlace expiró" }, { status: 403 });
    }

    await repo.registrarAccesoLink(token);

    const comparativa = await repo.obtenerComparativaPorId(link.comparativaId);
    if (!comparativa) {
      return NextResponse.json({ error: "Comparativa no encontrada" }, { status: 404 });
    }
    const cotizaciones = await repo.listarCotizaciones(comparativa.solicitudId);

    return NextResponse.json({
      comparativa,
      cotizaciones,
      solicitudId: comparativa.solicitudId,
      // La vista pública dice "este enlace vence el X": sin esto el solicitante no
      // puede saber si tiene tiempo para decidir.
      fechaExpiracion: link.fechaExpiracion ?? null,
      vecesAccedido: link.vecesAccedido ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Error al resolver el enlace" }, { status: 500 });
  }
}