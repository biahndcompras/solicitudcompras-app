import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { esTransicionValida } from "@/lib/domain/state-machine";
import { pipelineEnvioACompras } from "@/lib/pdf/pipeline";
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
    if (!esTransicionValida(solicitud.estado, body.hacia)) {
      return NextResponse.json(
        {
          error: `Transición inválida: ${solicitud.estado} → ${body.hacia}`,
          estadoActual: solicitud.estado,
        },
        { status: 409 }
      );
    }

    // Pipeline: al transicionar a ENVIADA_A_COMPRAS, generar PDF + correos 1 y 2.
    // Si el PDF falla, la solicitud NO cambia de estado (RF-24).
    let pipeline: Awaited<ReturnType<typeof pipelineEnvioACompras>> | undefined;
    if (body.hacia === "ENVIADA_A_COMPRAS") {
      pipeline = await pipelineEnvioACompras({
        repo,
        solicitud,
        respuestas: body.respuestas,
        // El solicitante eligió explícitamente a qué comprador va la solicitud (1.1).
        coordinadorIdSolicitado: body.coordinadorId,
      });
      if (!pipeline.ok) {
        return NextResponse.json(
          { error: pipeline.error ?? "No se pudo generar el documento" },
          { status: 500 }
        );
      }
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

    const res = await repo.transicionarEstado({
      solicitudId: id,
      hacia: body.hacia,
      actorTipo: body.actorTipo,
      actorIdentificador: body.actorIdentificador,
      nota: body.nota,
    });

    return NextResponse.json({ ...res, pipeline, enlace });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error interno en la transición" }, { status: 500 });
  }
}