import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { enviarCorreo } from "@/lib/mail/enviar";
import { formatoMoneda } from "@/lib/domain/moneda";

const repo = new PostgresRepositorio();

const schema = z.object({
  cotizacionId: z.string().optional(),
  ningunaOpcion: z.boolean().default(false),
  decididoPorEmail: z.string().email().optional(),
  comentario: z.string().optional(),
});

// Registra la decisión del solicitante por token y cierra la solicitud.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = schema.parse(await request.json());

    const link = await repo.obtenerLinkPorToken(token);
    if (!link) return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
    if (link.revocado) return NextResponse.json({ error: "Enlace revocado" }, { status: 403 });
    if (link.fechaExpiracion && new Date(link.fechaExpiracion).getTime() < Date.now()) {
      return NextResponse.json({ error: "Enlace expirado" }, { status: 403 });
    }

    const comparativa = await repo.obtenerComparativaPorId(link.comparativaId);
    if (!comparativa) return NextResponse.json({ error: "Comparativa no encontrada" }, { status: 404 });

    const solicitud = await repo.obtenerSolicitud(comparativa.solicitudId);
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    if (solicitud.estado !== "ENVIADA_A_SOLICITANTE") {
      return NextResponse.json(
        { error: "Esta solicitud ya no está en espera de decisión" },
        { status: 409 }
      );
    }

    // Validar que la cotización elegida pertenezca a esta solicitud.
    if (!body.ningunaOpcion && body.cotizacionId) {
      const cotizaciones = await repo.listarCotizaciones(comparativa.solicitudId);
      if (!cotizaciones.some((c) => c.id === body.cotizacionId)) {
        return NextResponse.json({ error: "Cotización no válida para esta solicitud" }, { status: 400 });
      }
    }

    // Datos del correo 4, recogidos ANTES de cerrar: después el estado ya
    // es terminal y no se vuelve a leer. `cotizaciones` viene del paso de validación de
    // arriba o se pide aquí cuando no hubo opción elegida.
    const cotizaciones = await repo.listarCotizaciones(comparativa.solicitudId);
    const elegida = body.ningunaOpcion
      ? undefined
      : cotizaciones.find((c) => c.id === body.cotizacionId);
    const duracionMs = solicitud.fechaEnvio ? Date.now() - new Date(solicitud.fechaEnvio).getTime() : null;
    const datosCorreo = {
      numeroReferencia: solicitud.numeroReferencia ?? undefined,
      solicitanteNombre: solicitud.solicitanteNombre,
      solicitanteEmail: solicitud.solicitanteEmail,
      proveedorSeleccionado: elegida?.proveedorNombre ?? "Ninguna opción",
      ningunaOpcionAceptada: body.ningunaOpcion,
      valorNeto: elegida ? formatoMoneda(elegida.moneda ?? "HNL", elegida.valorNeto ?? null) : "—",
      valorTotal: elegida ? formatoMoneda(elegida.moneda ?? "HNL", elegida.valorTotal ?? null) : "—",
      plazoEntrega: elegida?.plazoEntrega ?? "—",
      fechaDecision: new Date().toLocaleDateString("es-HN"),
      tiempoCiclo: duracionMs === null ? "—" : `${Math.max(1, Math.round(duracionMs / 86400000))} días`,
      urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel`,
    };

    await repo.registrarDecisionYCerrar({
      comparativaId: comparativa.id,
      solicitudId: comparativa.solicitudId,
      cotizacionSeleccionadaId: body.ningunaOpcion ? undefined : body.cotizacionId,
      decididoPorEmail: body.decididoPorEmail ?? solicitud.solicitanteEmail,
      ningunaOpcion: body.ningunaOpcion,
      comentario: body.comentario,
    });

    // Correo 4: la decisión le llega a quien tiene que actuar sobre ella. Antes la plantilla
    // existía pero `tipoCorreo: "4"` no se invocaba en ningún lado: la solicitud se cerraba
    // en silencio y el coordinador se enteraba solo si miraba la bandeja.
    const destinatario = await destinatarioDeDecision(solicitud.coordinadorId);
    if (destinatario) {
      try {
        await enviarCorreo({ repo, tipoCorreo: "4", solicitudId: solicitud.id, destinatario, datos: datosCorreo });
      } catch (e) {
        // La decisión ya está registrada y es el hecho de negocio (RF-25): un fallo de
        // notificación no la revierte ni puede devolver un error al solicitante que ya
        // decidió. `enviarCorreo` ya dejó su propio registro en `correo_enviado`.
        console.error(`[correo4] no se pudo notificar la decisión de ${solicitud.id}:`, e);
      }
    } else {
      console.error(
        `[correo4] ${solicitud.numeroReferencia ?? solicitud.id}: decisión registrada sin notificar. ` +
          "La solicitud no tiene coordinador asignado con email, o la solicitud no trae MAIL_COORDINADOR_DEFAULT."
      );
    }

    // "Ninguna me sirve" devuelve la solicitud a Compras; no la cierra.
    return NextResponse.json({
      ok: true,
      estadoFinal: body.ningunaOpcion ? "EN_COTIZACION" : "CERRADA_CON_DECISION",
      vuelveACompras: body.ningunaOpcion,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al registrar la decisión" }, { status: 500 });
  }
}

/**
 * A quién va el correo 4: el coordinador asignado de la solicitud, o el alias configurado.
 * Nunca el solicitante — ya recibió el correo 2 y el correo con el enlace.
 */
async function destinatarioDeDecision(coordinadorId?: string): Promise<string | null> {
  const coordinadores = await repo.listarCoordinadores();
  const asignado = coordinadorId ? coordinadores.find((c) => c.id === coordinadorId) : undefined;
  return asignado?.email ?? process.env.MAIL_COORDINADOR_DEFAULT ?? null;
}
