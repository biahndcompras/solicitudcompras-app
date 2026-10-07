import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { enviarCorreo } from "@/lib/mail/enviar";

const repo = new PostgresRepositorio();

const schema = z.object({
  // El correo es la identidad del solicitante: este flujo no tiene login, igual que
  // `/mis-solicitudes?email=` y el envío inicial.
  // `trim()` antes de validar: pegar el correo con un espacio al final no debe dar 400.
  // El resto del flujo ya trata el correo como texto a normalizar, no como dato exacto.
  email: z.string().trim().email(),
  respuestas: z.record(z.string(), z.string().max(2000)).default({}),
});

/**
 * El solicitante responde las preguntas de Compras (spec 010, RF-60).
 *
 * Sin sesión, por diseño: el solicitante no tiene login. Su identidad es el correo con el
 * que envió la solicitud, y se compara contra el dueño real de ESA solicitud — no alcanza
 * con conocer el id.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // Mismo criterio que el envío: si el correo no es el del solicitante, 404 y no 403. Un
    // 403 confirmaría que la solicitud existe, que es información que no se le debe a nadie
    // que solo tenga el id.
    if (solicitud.solicitanteEmail.trim().toLowerCase() !== body.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const ronda = solicitud.informacionPreguntas?.ronda ?? 1;
    const preguntas = solicitud.informacionPreguntas?.preguntas ?? [];

    let resultado: { yaRespondida: boolean; ronda?: number };
    try {
      resultado = await repo.responderInformacion({
        solicitudId: id,
        respuestas: body.respuestas,
        respondidoPor: body.email,
      });
    } catch (e) {
      console.error(`[informacion] no se pudo registrar la respuesta de ${id}:`, e);
      return NextResponse.json({ error: "No pudimos guardar tu respuesta" }, { status: 500 });
    }

    // Reintento (doble clic, refresh, envío que perdió la respuesta): el hecho ya ocurrió.
    // Devolver error acá le mostraría un fallo por algo que sí se guardó.
    if (resultado.yaRespondida) {
      return NextResponse.json({ ok: true, yaRespondida: true });
    }

    // Correo 7 al coordinador DESPUÉS de registrar la respuesta: si falla, el dato ya está
    // guardado y visible en el panel. Al revés, el correo avisaría de algo que no pasó.
    const destinatario = await destinatarioDelCoordinador(solicitud.coordinadorId);
    if (destinatario) {
      try {
        await enviarCorreo({
          repo,
          tipoCorreo: "7",
          solicitudId: id,
          destinatario,
          datos: {
            numeroReferencia: solicitud.numeroReferencia,
            titulo: solicitud.titulo,
            solicitanteNombre: solicitud.solicitanteNombre,
            ronda,
            preguntas: preguntas.map((p) => ({
              pregunta: p.pregunta,
              respuesta: body.respuestas[p.campoKey] ?? "",
            })),
            urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel/solicitud/${id}`,
          },
        });
      } catch (e) {
        console.error(`[informacion] respuesta registrada en ${id} pero el correo 7 no salió:`, e);
      }
    } else {
      console.error(
        `[informacion] ${solicitud.numeroReferencia ?? id}: respuesta registrada sin notificar. ` +
          "No hay coordinador con email ni MAIL_COORDINADOR_DEFAULT."
      );
    }

    return NextResponse.json({ ok: true, ronda: resultado.ronda ?? ronda });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al registrar la respuesta" }, { status: 500 });
  }
}

/** A quién avisar: el coordinador asignado, o el alias. Nunca el propio solicitante. */
async function destinatarioDelCoordinador(coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}
