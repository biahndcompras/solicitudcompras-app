// Servicio de envío de correo — Portal de Compras BIA.
// Une Resend + plantillas (doc 13) + registro en correo_enviado. Reintenta ante fallo.
import { enviarConResend } from "./cliente";
import { renderCorreo, type TipoCorreo, type DatosCorreo } from "./plantillas";
import type { CorreoEnviado } from "@/lib/domain/types";
import type { Repositorio } from "@/lib/db/repositorio";

export async function enviarCorreo(opts: {
  repo: Repositorio;
  tipoCorreo: TipoCorreo;
  solicitudId: string;
  destinatario: string;
  datos: DatosCorreo;
  adjuntoPdf?: { filename: string; content: Uint8Array };
  adjuntos?: { filename: string; content: Uint8Array }[];
  reintentos?: number;
}): Promise<CorreoEnviado> {
  const { repo, tipoCorreo, solicitudId, destinatario, datos, adjuntoPdf, adjuntos, reintentos = 2 } = opts;
  const { asunto, html } = renderCorreo(tipoCorreo, datos);

  let intento = 0;
  let error: string | undefined;

  while (intento < reintentos) {
    intento += 1;
    const res = await enviarConResend({
      to: destinatario,
      subject: asunto,
      html,
      attachments: adjuntos
        ? adjuntos
        : adjuntoPdf
          ? [{ filename: adjuntoPdf.filename, content: adjuntoPdf.content }]
          : undefined,
    });
    if (res.ok) {
      return repo.registrarCorreo({
        solicitudId,
        tipoCorreo: String(tipoCorreo),
        destinatario,
        asunto,
        estadoEnvio: "enviado",
        intentos: intento,
      });
    }
    error = res.error;
  }

  return repo.registrarCorreo({
    solicitudId,
    tipoCorreo: String(tipoCorreo),
    destinatario,
    asunto,
    estadoEnvio: "fallido",
    intentos: intento,
    errorDetalle: error,
  });
}