import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { generarDocumento } from "@/lib/pdf/generador";
import { guardRecursoDeSolicitud } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

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
    // El solicitante ve el PDF de SU solicitud desde la pantalla de confirmación (sin
    // sesión), así que no alcanza `guardApi`. Se acepta el rol de Compras o el correo
    // dueño, que es la misma identidad de `/mis-solicitudes?email=`.
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;
    const tipo = solicitud.tipo ?? "RFQ";
    const pdf = await generarDocumento({ tipo, solicitud, respuestas: {} });
    const nombre = `${solicitud.numeroReferencia ?? solicitud.id}.pdf`;
    return new NextResponse(Buffer.from(pdf.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombre}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al generar el documento" }, { status: 500 });
  }
}