import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { esTransicionValida } from "@/lib/domain/state-machine";
import { pipelineEnvioACompras } from "@/lib/pdf/pipeline";
import { enviarCorreo } from "@/lib/mail/enviar";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const schema = z.object({
  hacia: z.enum([
    "BORRADOR",
    "ENVIADA_A_COMPRAS",
    "EN_COTIZACION",
    "COMPARATIVA_LISTA",
    "ENVIADA_A_SOLICITANTE",
    "CERRADA_CON_DECISION",
    "CERRADA_SIN_DECISION",
    "CANCELADA",
  ]),
  actorTipo: z.enum(["solicitante", "coordinador", "admin", "sistema"]),
  actorIdentificador: z.string().optional(),
  nota: z.string().optional(),
  respuestas: z.record(z.string(), z.string()).optional(),
  coordinadorId: z.string().optional(),
});

function generarTokenEnlace(): string {
  // 3 grupos de 4 caracteres hexadecimales criptográficos (12 bytes de entropía).
  const g = () => randomBytes(2).toString("hex").toUpperCase();
  return `${g()}-${g()}-${g()}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    // Autorización por rol real (no por actorTipo del cliente):
    // el único tránsito público es el envío del solicitante (BORRADOR → ENVIADA_A_COMPRAS
    // con actorTipo "solicitante" desde una solicitud propia). Todo lo demás exige sesión
    // de coordinador o admin.
    const enviaSolicitante = body.hacia === "ENVIADA_A_COMPRAS" && body.actorTipo === "solicitante";
    if (!enviaSolicitante) {
      const auth = await guardApi(["coordinador", "admin"]);
      if (auth.negada) return auth.negada;
    }

    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // El solicitante solo puede mover SU solicitud. El comentario de arriba ya decía "desde
    // una solicitud propia" pero el código no lo comprobaba: sin sesión, cualquiera que
    // supiera un id podía empujar cualquier solicitud a ENVIADA_A_COMPRAS. El correo es la
    // identidad de este flujo (ver `mis-solicitudes?email=`), así que es lo que se compara.
    if (
      enviaSolicitante &&
      (solicitud.estado !== "BORRADOR" ||
        solicitud.solicitanteEmail.toLowerCase() !== (body.actorIdentificador ?? "").trim().toLowerCase())
    ) {
      // Idempotencia del envío: si YA está en ENVIADA_A_COMPRAS y es del mismo correo, el
      // reintento del cliente (timeout que perdió la respuesta) NO es un error — el hecho de
      // negocio ya ocurrió. Devolver 409 aquí volvía a mostrarle al solicitante un fallo sobre
      // un envío que sí se había hecho, que es exactamente lo que se reportó.
      if (solicitud.estado === "ENVIADA_A_COMPRAS") {
        return NextResponse.json({
          solicitud,
          eventoId: "",
          yaEnviada: true,
          pipeline: { ok: true, documentoId: undefined, correoCoordinador: "no-op", correoSolicitante: "no-op" },
        });
      }
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (!esTransicionValida(solicitud.estado, body.hacia)) {
      return NextResponse.json(
        {
          error: `Transición inválida: ${solicitud.estado} → ${body.hacia}`,
          estadoActual: solicitud.estado,
        },
        { status: 409 }
      );
    }

    // Al enviar la comparativa al solicitante: validar que exista comparativa, persistir
    // la recomendación (RN-01) y generar el link público real con expiración desde config.
    // El link se crea ANTES de transicionar para que un fallo no deje la solicitud en
    // ENVIADA_A_SOLICITANTE sin enlace. Si la transición fallara (race extremo), el link
    // quedaría huérfano pero es inofensivo: sin estado ENVIADA_A_SOLICITANTE el POST de
    // decisión devuelve 409 y la expiración lo invalida. No se revoca explícitamente.
    let enlace: { token: string; url: string } | undefined;
    if (body.hacia === "ENVIADA_A_SOLICITANTE") {
      const comparativa = await repo.obtenerComparativaPorSolicitudId(id);
      if (!comparativa) {
        return NextResponse.json(
          { error: "No hay comparativa generada para enviar al solicitante" },
          { status: 409 }
        );
      }
      if (body.nota?.trim()) {
        await repo.guardarRecomendacionComprador(id, body.nota.trim());
      }
      const diasRaw = Number(await repo.leerConfig("expiracion_link_dias"));
      const dias = Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 90;
      const link = await repo.crearLinkPublico(
        comparativa.id,
        generarTokenEnlace(),
        new Date(Date.now() + dias * 86400000).toISOString()
      );
      enlace = { token: link.token, url: `/comparativa/${link.token}` };
    }

    // La transición es el HECHO DE NEGOCIO: el solicitante completó y Compras ya tiene la
    // solicitud. Por eso ocurre ANTES del PDF y de los correos. Antes este endpoint hacía
    // lo contrario (`await pipelineEnvioACompras` y `return 500` si fallaba): un pdfme que
    // no renderaba, o un Resend que tardaba, dejaba al solicitante viendo "no se pudo
    // enviar" sobre una solicitud que en realidad ya estaba enviada — y su reintento
    // creaba otra. Mismo espíritu que RF-25 en el correo 3, aplicado al pipeline entero.
    const res = await repo.transicionarEstado({
      solicitudId: id,
      hacia: body.hacia,
      actorTipo: body.actorTipo,
      actorIdentificador: body.actorIdentificador,
      nota: body.nota,
    });

    // Ya con `numeroReferencia` definitiva (se asigna en la transición), que es lo que
    // aparece en el PDF y en el asunto de los correos.
    let pipeline: { ok: boolean; error?: string; documentoId?: string } | undefined;
    if (body.hacia === "ENVIADA_A_COMPRAS") {
      const enviado = res.solicitud;
      pipeline = await pipelineEnvioACompras({
        repo,
        solicitud: enviado,
        respuestas: body.respuestas,
        // El solicitante eligió explícitamente a qué comprador va la solicitud (1.1).
        coordinadorIdSolicitado: body.coordinadorId,
        notificar: false,
      });
      if (!pipeline.ok) {
        // La solicitud QUEDÓ enviada. El fallo es del documento, se registra y se reporta
        // aparte; no se devuelve 500 porque eso mentiría sobre el envío.
        try {
          await repo.marcarNotificacionFallida(id);
        } catch (e) {
          // Si ni siquiera el registro del fallo se puede escribir, hay que decirlo: sin esto
          // la solicitud queda enviada y sin rastro de que el documento nunca se generó.
          console.error(`[pipeline] no se pudo marcar notificacion_fallida en ${id}:`, e);
        }
        console.error(
          `[pipeline] solicitud ${id} (${enviado.numeroReferencia}) enviada pero sin documento:`,
          pipeline.error
        );
      }
    }

    // 2.2: enviar correo 3 al solicitante con las cotizaciones ORIGINALES adjuntas.
    // El solicitante siempre quiere ver las ofertas que consiguió Compras, no solo el comparativo.
    if (body.hacia === "ENVIADA_A_SOLICITANTE") {
      void (async () => {
        try {
          const adjuntos = (await repo.listarCotizacionesConArchivo(id)).map((c) => ({
            filename: c.archivoNombreOriginal ?? `${c.id}.pdf`,
            content: c.bytea,
          }));
          const coordNombre = body.actorTipo === "admin" ? undefined : "Compras";
          await enviarCorreo({
            repo,
            tipoCorreo: "3",
            solicitudId: id,
            destinatario: res.solicitud.solicitanteEmail,
            datos: {
              numeroReferencia: res.solicitud.numeroReferencia,
              titulo: res.solicitud.titulo,
              solicitanteNombre: res.solicitud.solicitanteNombre,
              coordinadorNombre: coordNombre ?? "Compras",
              cantidadCotizaciones: adjuntos.length || (await repo.listarCotizaciones(id)).length,
              recomendacion: body.nota,
              urlComparativa: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${enlace?.url}`,
            },
            adjuntos,
          });
        } catch {
          // El envío de correo no debe bloquear la transición (RF-25: notificación no crítica).
        }
      })();
    }

    return NextResponse.json({ ...res, pipeline, enlace });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error interno en la transición" }, { status: 500 });
  }
}