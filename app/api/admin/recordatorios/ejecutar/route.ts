import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { enviarRecordatoriosPendientes } from "@/lib/mail/recordatorios";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

/**
 * Envío manual de los recordatorios de información pendiente (RF-62, correo 8).
 *
 * Antes esto se disparaba escondido dentro del botón "Enviar alertas": marcar solo
 * "Discrepancia" igual mandaba recordatorios de todas las solicitudes, y en una prueba salió
 * un correo real a una persona sin que nadie lo esperara (4.4.11). Ahora es una acción
 * explícita y separada, con su propia confirmación y preview.
 *
 * `{ preview: true }` cuenta cuántas hay sin enviar ni marcar nada.
 */
export async function POST(request: Request) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;

  let preview = false;
  try {
    const body = (await request.json()) as { preview?: unknown } | null;
    preview = body?.preview === true;
  } catch {
    preview = false;
  }

  try {
    const { vencidas, enviados } = await enviarRecordatoriosPendientes(repo, { preview });
    if (preview) return NextResponse.json({ vencidas, recordatoriosEnviados: 0, preview: true });
    return NextResponse.json({ vencidas, recordatoriosEnviados: enviados });
  } catch {
    return NextResponse.json({ error: "Error al enviar recordatorios" }, { status: 500 });
  }
}
