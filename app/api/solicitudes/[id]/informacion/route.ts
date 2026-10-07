import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";
import { enviarCorreo } from "@/lib/mail/enviar";

const repo = new PostgresRepositorio();

const schema = z.object({
  // `campoKey` liga cada pregunta con el campo del catálogo donde se escribirá la respuesta.
  // Sin esa liga, la respuesta llega como texto suelto y el coordinador tendría que copiarla
  // a mano al campo correcto — que es justo el trabajo manual que este flujo evita.
  preguntas: z
    .array(
      z.object({
        campoKey: z.string().min(1),
        // `trim()` ANTES de `min`: una pregunta de solo espacios no es una pregunta, y sin el
        // trim pasaba la validación y llegaba vacía al solicitante.
        pregunta: z.string().trim().min(1).max(400),
      })
    )
    .min(1)
    .max(10),
});

/**
 * Compras pide información al solicitante (spec 010, RF-59). Deja una ronda abierta y avisa
 * por correo. La solicitud NO cambia de estado: la bandera dice que hay algo esperando.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // El repo valida además que no sea terminal y que no haya una ronda abierta. Se deja que
    // lance: son reglas de negocio del mismo hecho, y duplicarlas acá las desincronizaría.
    let ronda: number;
    let pedidaEn: string;
    try {
      const r = await repo.pedirInformacion({ solicitudId: id, preguntas: body.preguntas, pedidaPor: auth.sesion.email });
      ronda = r.ronda;
      pedidaEn = r.pedidaEn;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo pedir la información";
      const esDeNegocio = /cerrada|Ya hay una ronda/i.test(mensaje);
      return NextResponse.json({ error: mensaje }, { status: esDeNegocio ? 409 : 500 });
    }

    // El correo va DESPUÉS de registrar el hecho: si el envío falla, la ronda ya está abierta
    // y el solicitante la ve al entrar a "mis solicitudes". Al revés, un correo prometería una
    // ronda que no existe. Mismo criterio que la transición de envío (RF-25).
    const urlResponder = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mis-solicitudes/${id}?email=${encodeURIComponent(solicitud.solicitanteEmail)}`;
    try {
      await enviarCorreo({
        repo,
        tipoCorreo: "6",
        solicitudId: id,
        destinatario: solicitud.solicitanteEmail,
        datos: {
          numeroReferencia: solicitud.numeroReferencia,
          titulo: solicitud.titulo,
          solicitanteNombre: solicitud.solicitanteNombre,
          ronda,
          preguntas: body.preguntas.map((p) => ({ pregunta: p.pregunta })),
          urlDetalle: urlResponder,
        },
      });
    } catch (e) {
      // La ronda está abierta y el solicitante la va a ver igual; sólo se pierde el aviso.
      // `enviarCorreo` ya registró el fallo en `correo_enviado`.
      console.error(`[informacion] ronda ${ronda} abierta en ${id} pero el correo 6 no salió:`, e);
    }

    return NextResponse.json({ ok: true, ronda, pedidaEn });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al pedir la información" }, { status: 500 });
  }
}
