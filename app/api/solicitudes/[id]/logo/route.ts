import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

// POST: sube el logo/archivo real del producto (H2). El solicitante no tiene sesión
// (flujo sin contraseñas), igual que la creación de solicitudes; el id uuid es el token.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const form = await request.formData();
    const archivo = form.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (archivo.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo supera los 4 MB" }, { status: 413 });
    }
    await repo.guardarArchivoLogo(id, archivo.name, new Uint8Array(await archivo.arrayBuffer()));
    return NextResponse.json({ ok: true, nombre: archivo.name });
  } catch {
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}

// GET: descarga del logo/archivo del producto. Coordinador/admin.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await guardApi(["coordinador", "admin"]);
    if (auth.negada) return auth.negada;
    const { id } = await params;
    const archivo = await repo.obtenerArchivoLogo(id);
    if (!archivo) {
      return NextResponse.json({ error: "La solicitud no tiene archivo de logo" }, { status: 404 });
    }
    const nombreSeguro = archivo.nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(Buffer.from(archivo.bytea), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombreSeguro}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al descargar el archivo" }, { status: 500 });
  }
}
