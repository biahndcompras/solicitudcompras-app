// Recordatorio de preguntas sin responder (spec 010, RF-62), compartido por el cron y por la
// acción manual del administrador.
//
// Antes esta lógica vivía **duplicada**: en `/api/cron/recordatorios` y, además, dentro de
// `/api/admin/alertas/ejecutar`. Eso hacía que el botón "Enviar alertas" mandara también los
// recordatorios de *todas* las solicitudes, sin relación con los tipos de alerta elegidos:
// durante una prueba salió un correo real a una persona sin que nadie lo esperara (4.4.11).
//
// Ahora hay una sola implementación y cada acción la invoca cuando corresponde:
//  · el cron la corre solo (sin que nadie apriete nada);
//  · el administrador tiene su propio botón, con preview, para dispararla a mano.
import type { Repositorio } from "@/lib/db/repositorio";

export type ResultadoRecordatorios = { vencidas: number; enviados: number };

async function destinatarioDe(repo: Repositorio, coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}

/**
 * Envía el correo 8 a las solicitudes cuya ronda de preguntas superó el umbral sin respuesta.
 * Con `preview: true` solo cuenta cuántas hay: no envía ni marca nada.
 */
export async function enviarRecordatoriosPendientes(
  repo: Repositorio,
  opts: { preview?: boolean } = {}
): Promise<ResultadoRecordatorios> {
  const umbral = Number(await repo.leerConfig("recordatorio_informacion_dias")) || 3;
  const vencidas = await repo.informacionVencida(umbral);
  if (opts.preview) return { vencidas: vencidas.length, enviados: 0 };

  const { enviarCorreo } = await import("@/lib/mail/enviar");
  let enviados = 0;
  for (const v of vencidas) {
    const destinatario = await destinatarioDe(repo, v.solicitud.coordinadorId);
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
  return { vencidas: vencidas.length, enviados };
}
