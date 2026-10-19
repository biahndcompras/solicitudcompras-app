import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { enviarRecordatoriosPendientes } from "@/lib/mail/recordatorios";

const repo = new PostgresRepositorio();

/**
 * Recordatorio de preguntas sin responder (spec 010, RF-62), pensado para un cron diario.
 *
 * La lógica vive en `lib/mail/recordatorios.ts` porque también la dispara el administrador a
 * mano. Está separada a propósito: el cron no debe poder mandar las otras alertas.
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
    const { vencidas, enviados } = await enviarRecordatoriosPendientes(repo);
    return NextResponse.json({ vencidas, recordatoriosEnviados: enviados });
  } catch {
    return NextResponse.json({ error: "Error al enviar recordatorios" }, { status: 500 });
  }
}
