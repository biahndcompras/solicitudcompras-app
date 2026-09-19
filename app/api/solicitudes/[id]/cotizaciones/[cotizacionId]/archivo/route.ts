import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

// GET: descarga el archivo original de una cotización (2.2). Solo coordinador/admin.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cotizacionId: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { cotizacionId } = await params;
    const archivo = await repo.obtenerArchivoCotizacion(cotizacionId);
    if (!archivo) {
      return NextResponse.json(
        { error: "La cotización no tiene archivo original" },
        { status: 404 }
      );
    }
    const nombreSeguro = archivo.nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(Buffer.from(archivo.bytea), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombreSeguro}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al descargar el archivo" }, { status: 500 });
  }
}