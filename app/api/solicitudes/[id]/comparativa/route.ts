import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import {
  especificacionesSolicitadasDesdeRespuestas,
  generarComparativaConIA,
} from "@/lib/domain/comparativa";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;
    const solicitud = await repo.obtenerSolicitud(id);
    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const cotizaciones = await repo.listarCotizaciones(id);
    if (cotizaciones.length < 2) {
      return NextResponse.json(
        { error: "Se necesitan al menos 2 cotizaciones para generar la comparativa" },
        { status: 400 }
      );
    }

    // 4.10.8 — "lo que se pidió" son las respuestas del solicitante. Sin esto el motor
    // determinístico recibía `{}` y nunca podía detectar una discrepancia sin IA.
    const respuestas = await repo.listarRespuestas(id);
    const especificacionesSolicitadas = especificacionesSolicitadasDesdeRespuestas(respuestas);

    // IA server-side (la clave OPENROUTER siempre está en el servidor).
    // Fallback determinístico interno: si la IA no responde o expira, no bloquea.
    const comparativa = await generarComparativaConIA({
      solicitudId: id,
      especificacionesSolicitadas,
      requerimiento: solicitud.titulo,
      cotizaciones,
      now: new Date().toISOString(),
    });
    const guardada = await repo.guardarComparativa(id, comparativa);
    // Transición a COMPARATIVA_LISTA: si el coordinador aún no había tomado la solicitud
    // (viene de ENVIADA_A_COMPRAS), primero pasar por EN_COTIZACION para respetar la máquina.
    if (solicitud.estado === "ENVIADA_A_COMPRAS") {
      await repo.transicionarEstado({
        solicitudId: id,
        hacia: "EN_COTIZACION",
        actorTipo: "coordinador",
        nota: "Coordinador comenzó a trabajar la solicitud",
      });
    }
    if (solicitud.estado === "EN_COTIZACION" || solicitud.estado === "ENVIADA_A_COMPRAS") {
      await repo.transicionarEstado({
        solicitudId: id,
        hacia: "COMPARATIVA_LISTA",
        actorTipo: "coordinador",
      });
    }
    return NextResponse.json(guardada);
  } catch {
    return NextResponse.json({ error: "Error al generar la comparativa" }, { status: 500 });
  }
}