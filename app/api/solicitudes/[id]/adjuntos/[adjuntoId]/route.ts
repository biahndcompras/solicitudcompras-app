import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { getSession } from "@/lib/auth";
import { guardRecursoDeSolicitud } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

/** Descarga de un documento adjunto (4.4.12). Misma regla que el PDF: Compras o el dueño. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; adjuntoId: string }> }
) {
  try {
    const { id, adjuntoId } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;

    const adjunto = await repo.obtenerAdjunto(id, adjuntoId);
    if (!adjunto || !adjunto.contenido) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const nombreSeguro = adjunto.nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(Buffer.from(adjunto.contenido), {
      headers: {
        "Content-Type": adjunto.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombreSeguro}"`,
        "Content-Length": String(adjunto.contenido.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al descargar el documento" }, { status: 500 });
  }
}

/**
 * Borrado con confirmación (la confirmación es de la UI) y trazabilidad.
 *
 * Compras puede borrar cualquiera; el solicitante solo los que él mismo subió. Así no puede
 * eliminar un documento que mandó Compras.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; adjuntoId: string }> }
) {
  try {
    const { id, adjuntoId } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;

    const adjunto = await repo.obtenerAdjunto(id, adjuntoId);
    if (!adjunto) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    const sesion = await getSession();
    const emailQuery = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
    const esSolicitante = auth.rol === "solicitante";

    if (esSolicitante) {
      const suyo = (adjunto.subidoPorEmail ?? "").toLowerCase() === emailQuery;
      if (!suyo) {
        return NextResponse.json(
          { error: "Solo puede eliminar los documentos que usted subió." },
          { status: 403 }
        );
      }
    }

    const borrado = await repo.eliminarAdjunto({
      solicitudId: id,
      adjuntoId,
      actorTipo: esSolicitante ? "solicitante" : (sesion?.rol ?? "coordinador"),
      actorIdentificador: sesion?.email ?? emailQuery ?? undefined,
    });
    if (!borrado) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Error al eliminar el documento" }, { status: 500 });
  }
}
