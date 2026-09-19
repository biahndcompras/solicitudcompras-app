// Pipeline de documento y notificación al enviar a Compras — Portal de Compras BIA.
// Al transicionar a ENVIADA_A_COMPRAS: asigna coordinador → genera PDF → persiste documento → envía correos 1 y 2.
import { generarDocumento } from "./generador";
import { enviarCorreo } from "@/lib/mail/enviar";
import { asignarCoordinadorPorCategoria } from "@/lib/domain/rules";
import type { Repositorio } from "@/lib/db/repositorio";
import type { Solicitud } from "@/lib/domain/types";

export type ResultadoPipeline = {
  ok: boolean;
  error?: string;
  documentoId?: string;
  coordinadorId?: string;
  correoCoordinador?: string;
  correoSolicitante?: string;
};

export async function pipelineEnvioACompras(opts: {
  repo: Repositorio;
  solicitud: Solicitud;
  respuestas?: Record<string, string>;
  coordinadorIdSolicitado?: string;
}): Promise<ResultadoPipeline> {
  const { repo, solicitud, respuestas = {}, coordinadorIdSolicitado } = opts;
  const tipo = solicitud.tipo ?? "RFQ";

  // 0. Asignar coordinador. Si el solicitante eligió uno explícito (1.1), respetar esa elección;
  //    si no, regla por categoría con respaldo (Q1).
  const coordinadores = await repo.listarCoordinadores();
  let coordinadorId = coordinadorIdSolicitado;
  if (!coordinadorId || !coordinadores.some((c) => c.id === coordinadorId)) {
    const coordinadoresPorCategoria: Record<string, string> = {};
    for (const c of coordinadores) {
      for (const cat of c.categoriasAsignadas) {
        coordinadoresPorCategoria[cat] = c.id;
      }
    }
    // Respaldo: el coordinador de mayor cobertura (catch-all).
    const respaldoId =
      [...coordinadores].sort(
        (a, b) => (b.categoriasAsignadas?.length ?? 0) - (a.categoriasAsignadas?.length ?? 0)
      )[0]?.id ?? "";
    coordinadorId = asignarCoordinadorPorCategoria({
      categoria: solicitud.categoria,
      coordinadoresPorCategoria,
      respaldoId,
    });
  }
  if (coordinadorId) {
    await repo.asignarCoordinador(solicitud.id, coordinadorId);
  }
  const coordenadorNombre = coordinadores.find((c) => c.id === coordinadorId)?.nombre;

  // 1. Generar PDF (si falla, la solicitud NO cambia de estado — RF-24)
  let pdf;
  try {
    pdf = await generarDocumento({ tipo, solicitud, respuestas, coordenadorNombre });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al generar el PDF" };
  }

  // 2. Persistir documento con versión
  const doc = await repo.persistirDocumento({
    solicitudId: solicitud.id,
    tipo,
    rutaPdf: `documentos/${solicitud.numeroReferencia ?? solicitud.id}/solicitud-v${1}.pdf`,
    plantillaVersion: 1,
  });

  const baseDatos = {
    numeroReferencia: solicitud.numeroReferencia,
    titulo: solicitud.titulo,
    tipo,
    area: solicitud.areaSolicitante,
    solicitanteNombre: solicitud.solicitanteNombre,
    solicitanteEmail: solicitud.solicitanteEmail,
    fechaRequerida: solicitud.fechaRequerida,
    resumen: solicitud.descripcion,
  };

  // 3. Correo 1 al coordinador (con PDF adjunto). Si falla: avanza marcada notificacion_fallida (RF-25)
  const correoCoordinadorDest = process.env.MAIL_COORDINADOR_DEFAULT ?? solicitud.solicitanteEmail;
  const c1 = await enviarCorreo({
    repo,
    tipoCorreo: "1",
    solicitudId: solicitud.id,
    destinatario: correoCoordinadorDest,
    datos: { ...baseDatos, coordinadorNombre: coordenadorNombre, urlPanel: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel` },
    adjuntoPdf: { filename: `${solicitud.numeroReferencia ?? "solicitud"}.pdf`, content: pdf.buffer },
  });

  // 4. Correo 2 al solicitante (acuse)
  const c2 = await enviarCorreo({
    repo,
    tipoCorreo: "2",
    solicitudId: solicitud.id,
    destinatario: solicitud.solicitanteEmail,
    datos: { ...baseDatos, coordinadorNombre: coordenadorNombre },
  });

  return {
    ok: true,
    documentoId: doc.id,
    coordinadorId: coordinadorId || undefined,
    correoCoordinador: c1.estadoEnvio,
    correoSolicitante: c2.estadoEnvio,
  };
}