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

  // Modo pruebas (desarrollo): NO se envía nada. Se registra como "simulado" para que el
  // historial lo muestre y los llamadores no lo cuenten como enviado. Sin esto, un envío de
  // prueba desde local podía llegarle a un coordinador real.
  const dryRun = ["1", "true", "yes", "si", "sí"].includes(
    String(process.env.MAIL_DRY_RUN ?? "").trim().toLowerCase()
  );
  if (dryRun) {
    console.warn(`[mail] MODO PRUEBAS: no se envía el correo ${tipoCorreo} a ${destinatario} («${asunto}»)`);
    return repo.registrarCorreo({
      solicitudId,
      tipoCorreo: String(tipoCorreo),
      destinatario,
      asunto,
      estadoEnvio: "simulado",
      intentos: 0,
      errorDetalle: "MAIL_DRY_RUN: no se envió (modo pruebas)",
    });
  }

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