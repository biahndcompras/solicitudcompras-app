import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { getSession } from "@/lib/auth";
import { guardRecursoDeSolicitud } from "@/lib/api-guard";
import { urlDescargaAdjunto } from "@/lib/descargas/token";
import {
  MAX_BYTES_DOCUMENTO,
  validarDocumentoAdjunto,
} from "@/lib/domain/archivos";

const repo = new PostgresRepositorio();

/**
 * Documentos adjuntos de la solicitud (4.4.12).
 *
 * Los sube el coordinador/admin, y también el propio solicitante cuando abre su solicitud ya
 * enviada. No se exponen en el enlace público: ese enlace solo debe mostrar la comparativa.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;
    return NextResponse.json({ adjuntos: await repo.listarAdjuntos(id) });
  } catch {
    return NextResponse.json({ error: "Error al listar los documentos" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });

    const auth = await guardRecursoDeSolicitud(request, solicitud);
    if (!auth.autorizado) return auth.negada;

    const form = await request.formData();
    const archivo = form.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    // El tope se mira antes de leer los bytes.
    if (archivo.size > MAX_BYTES_DOCUMENTO) {
      const mb = (MAX_BYTES_DOCUMENTO / (1024 * 1024)).toFixed(0);
      return NextResponse.json({ error: `El archivo supera los ${mb} MB` }, { status: 413 });
    }

    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const validacion = validarDocumentoAdjunto(archivo, bytes);
    if (!validacion.ok) {
      const status = validacion.motivo === "tamano" ? 413 : validacion.motivo === "vacio" ? 400 : 415;
      return NextResponse.json({ error: validacion.mensaje }, { status });
    }

    const sesion = await getSession();
    const emailQuery = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
    const esSolicitante = auth.rol === "solicitante";
    const actorEmail = sesion?.email ?? emailQuery ?? undefined;

    const adjunto = await repo.crearAdjunto({
      solicitudId: id,
      nombreArchivo: archivo.name,
      mimeType: archivo.type || undefined,
      contenido: bytes,
      subidoPorEmail: actorEmail,
      actorTipo: esSolicitante ? "solicitante" : (sesion?.rol ?? "coordinador"),
    });

    // Aviso al OTRO lado: si subió Compras, se entera el solicitante; si subió el solicitante,
    // se entera el coordinador. El alta ya quedó registrada: un fallo de correo no la revierte.
    try {
      const { enviarCorreo } = await import("@/lib/mail/enviar");
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const datosBase = {
        numeroReferencia: solicitud.numeroReferencia,
        titulo: solicitud.titulo,
        documentoNombre: archivo.name,
        // Enlace firmado: el botón del correo baja el archivo sin pedir sesión.
        urlDescarga: urlDescargaAdjunto(base, id, adjunto.id),
      };
      if (esSolicitante) {
        const destinatario = await destinatarioCoordinador(solicitud.coordinadorId);
        if (destinatario) {
          await enviarCorreo({
            repo,
            tipoCorreo: "9",
            solicitudId: id,
            destinatario,
            datos: {
              ...datosBase,
              solicitanteNombre: "Compras",
              subidoPor: solicitud.solicitanteNombre,
              urlDetalle: `${base}/panel/solicitud/${id}`,
            },
          });
        }
      } else {
        await enviarCorreo({
          repo,
          tipoCorreo: "9",
          solicitudId: id,
          destinatario: solicitud.solicitanteEmail,
          datos: {
            ...datosBase,
            solicitanteNombre: solicitud.solicitanteNombre,
            subidoPor: sesion?.nombre ?? "El equipo de Compras",
            urlDetalle: `${base}/mis-solicitudes/${id}?email=${encodeURIComponent(solicitud.solicitanteEmail)}`,
          },
        });
      }
    } catch (e) {
      console.error(`[adjuntos] documento ${adjunto.id} guardado pero el correo 9 no salió:`, e);
    }

    return NextResponse.json({ adjunto }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al subir el documento" }, { status: 500 });
  }
}

async function destinatarioCoordinador(coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}
