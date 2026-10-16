import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardRecursoDeSolicitud } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

// POST: sube el logo/archivo real del producto (H2). El solicitante no tiene sesión (flujo
// sin contraseñas), así que la identidad es su correo — el mismo mecanismo que el GET de acá
// abajo y el de `?email=` del resto del flujo del solicitante.
//
// Antes decía "el id uuid es el token" y no validaba nada: cualquiera con el UUID (que viaja
// en la URL y en los enlaces compartidos) podía **reemplazar** el material de marca de una
// solicitud ajena. Era peor que el GET, que sí estaba protegido. Ahora se exige rol de Compras
// o el correo dueño, igual que la descarga.
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
    // Antes de leer el cuerpo: un remitente no autorizado no debe poder enviar 4 MB de archivo.
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;

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

// GET: descarga del logo/archivo del producto. "El id uuid protege el acceso" no era
// protección: los UUID no se adivinan, pero travels por la URL y se comparten en enlaces.
// Es material de marca del solicitante, a veces con precios, así que se exige rol de Compras
// o el correo dueño — la misma regla que el PDF.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;

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
