import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

const repo = new PostgresRepositorio();

/**
 * Recordatorio de preguntas sin responder (spec 010, RF-62), pensado para un cron diario.
 *
 * Hace lo mismo que el botón "Ejecutar alertas" del panel, pero sin que nadie lo apriete.
 * Está separado a propósito: el botón no debe depender de que exista un cron, y el cron no
 * debe poder mandar las otras alertas.
 *
 * Protegido por `CRON_SECRET` en el header `Authorization`, que es como Vercel firma sus
 * crons. Sin la variable configurada la ruta NO hace nada y lo dice: una ruta que manda
 * correos abierta a internet es peor que una que no existe.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurado: la ruta queda deshabilitada por seguridad." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const umbral = Number(await repo.leerConfig("recordatorio_informacion_dias")) || 3;
    const vencidas = await repo.informacionVencida(umbral);
    const { enviarCorreo } = await import("@/lib/mail/enviar");

    let enviados = 0;
    for (const v of vencidas) {
      const destinatario = await destinatarioDe(v.solicitud.coordinadorId);
      if (!destinatario) continue;
      try {
        const r = await enviarCorreo({
          repo,
          tipoCorreo: "8",
          solicitudId: v.solicitud.id,
          destinatario,
          datos: {
            numeroReferencia: v.solicitud.numeroReferencia,
            titulo: v.solicitud.titulo,
            solicitanteNombre: v.solicitud.solicitanteNombre,
            coordinadorNombre: "Compras",
            diasEsperando: v.dias,
            preguntas: (v.solicitud.informacionPreguntas?.preguntas ?? []).map((p) => ({ pregunta: p.pregunta })),
            urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel/solicitud/${v.solicitud.id}`,
          },
        });
        // Se marca SOLO si el correo salió de verdad. `enviarCorreo` no lanza cuando Resend
        // falla: devuelve `estadoEnvio: "fallido"`. Marcarla igual apagaría el recordatorio
        // para esa ronda para siempre, y nadie se habría enterado de nada.
        if (r.estadoEnvio !== "enviado") continue;
        await repo.marcarRecordatorioInformacion(v.solicitud.id, v.ronda);
        enviados += 1;
      } catch {
        // `enviarCorreo` ya registra el fallo en `correo_enviado`.
      }
    }

    return NextResponse.json({ vencidas: vencidas.length, recordatoriosEnviados: enviados });
  } catch {
    return NextResponse.json({ error: "Error al enviar recordatorios" }, { status: 500 });
  }
}

async function destinatarioDe(coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}
