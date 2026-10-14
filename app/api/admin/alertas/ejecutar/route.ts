import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { detectarAlertas } from "@/lib/domain/alertas";
import type { Cotizacion } from "@/lib/domain/types";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

export async function POST() {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const umbral = Number((await repo.leerConfig("umbral_dias_sin_movimiento")) ?? 5);
    const dest = String((await repo.leerConfig("destinatario_alertas")) ?? "");

    const solicitudes = await repo.listarTodas();
    const cotsMap: Record<string, Cotizacion[]> = {};
    for (const s of solicitudes) cotsMap[s.id] = await repo.listarCotizaciones(s.id);

    const alertas = detectarAlertas({ solicitudes, cotizacionesPorSolicitud: cotsMap, umbralDias: umbral });

    // Enviar correo tipo 5 (alerta de inactividad) al destinatario configurado, si existe.
    let enviadas = 0;
    if (dest) {
      const { enviarCorreo } = await import("@/lib/mail/enviar");
      for (const a of alertas.filter((x) => x.tipo === "inactividad")) {
        await enviarCorreo({
          repo,
          tipoCorreo: "5",
          solicitudId: a.solicitudId,
          destinatario: dest,
          datos: {
            diasSinMovimiento: umbral,
            estadoActual: a.titulo,
            urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel/solicitud/${a.solicitudId}`,
          },
        })
          .then(() => { enviadas += 1; })
          .catch(() => undefined);
      }
    }

    // Recordatorio 010 (RF-62): las rondas de preguntas que superaron el umbral sin
    // respuesta. Se engancha acá y no a un programador propio porque el proyecto no tiene
    // ninguno: hoy este botón es el único disparador real. El día que haya cron, la ruta de
    // /api/cron/recordatorios hace lo mismo sin tocar esto.
    const diasRecordatorio = Number(await repo.leerConfig("recordatorio_informacion_dias")) || 3;
    let recordatorios = 0;
    const { enviarCorreo: enviar } = await import("@/lib/mail/enviar");
    for (const v of await repo.informacionVencida(diasRecordatorio)) {
      const destinatario = await destinatarioDe(v.solicitud.coordinadorId);
      if (!destinatario) continue;
      try {
        const r = await enviar({
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
        // Solo se marca si el correo salió: `enviar` devuelve "fallido" en vez de lanzar, y
        // marcarla igual apagaría el recordatorio para esa ronda sin haber avisado.
        if (r.estadoEnvio !== "enviado") continue;
        await repo.marcarRecordatorioInformacion(v.solicitud.id, v.ronda);
        recordatorios += 1;
      } catch {
        // `enviar` ya registra el fallo en `correo_enviado`.
      }
    }

    return NextResponse.json({ alertas, correosEnviados: enviadas, recordatorios });
  } catch {
    return NextResponse.json({ error: "Error al ejecutar alertas" }, { status: 500 });
  }
}

/** A quién va el recordatorio: el coordinador asignado, o el alias. Nunca al solicitante. */
async function destinatarioDe(coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}
