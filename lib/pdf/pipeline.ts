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
  /**
   * `false` devuelve en cuanto el documento está persistido y deja los correos 1 y 2 en
   * segundo plano. Es lo que usa el endpoint de envío: la transición ya ocurrió y la
   * notificación no puede decidir si la solicitud se envió (RF-25). Los correos registran
   * su propio estado en `correo_enviado` (incluido `fallido`), así que ningún resultado se
   * pierde por no esperar.
   */
  notificar?: boolean;
}): Promise<ResultadoPipeline> {
  const { repo, solicitud, respuestas = {}, coordinadorIdSolicitado, notificar = true } = opts;
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

  // 1. Generar PDF. Si falla, el pipeline lo reporta: la transición ya ocurrió (el envío es
  // un hecho de negocio) y quien llama decide qué hacer con el fallo.
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

  // 3. Correos 1 (al coordinador, con el PDF) y 2 (acuse al solicitante).
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
  const correoCoordinadorDest = process.env.MAIL_COORDINADOR_DEFAULT ?? solicitud.solicitanteEmail;

  const enviarLosDos = async () => {
    // Correo 1 al coordinador (con el PDF adjunto).
    const c1 = await enviarCorreo({
      repo,
      tipoCorreo: "1",
      solicitudId: solicitud.id,
      destinatario: correoCoordinadorDest,
      datos: { ...baseDatos, coordinadorNombre: coordenadorNombre, urlPanel: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel` },
      adjuntoPdf: { filename: `${solicitud.numeroReferencia ?? "solicitud"}.pdf`, content: pdf.buffer },
    });
    // Correo 2 al solicitante (acuse de recibo).
    const c2 = await enviarCorreo({
      repo,
      tipoCorreo: "2",
      solicitudId: solicitud.id,
      destinatario: solicitud.solicitanteEmail,
      datos: { ...baseDatos, coordinadorNombre: coordenadorNombre },
    });
    return { c1, c2 };
  };

  if (!notificar) {
    void enviarLosDos().catch((e) => {
      // `enviarCorreo` ya registra su propio fallo (incluido `fallido`) en `correo_enviado`,
      // pero eso NO cubre una excepción inesperada (p. ej. que `registrarCorreo` reviente).
      // Sin este log, ese fallo se perdería en silencio.
      console.error(
        `[pipeline] correos 1 y 2 no completados para ${solicitud.id} (${solicitud.numeroReferencia ?? "sin ref"}):`,
        e
      );
    });
    return {
      ok: true,
      documentoId: doc.id,
      coordinadorId: coordinadorId || undefined,
      correoCoordinador: "pendiente",
      correoSolicitante: "pendiente",
    };
  }

  const { c1, c2 } = await enviarLosDos();

  return {
    ok: true,
    documentoId: doc.id,
    coordinadorId: coordinadorId || undefined,
    correoCoordinador: c1.estadoEnvio,
    correoSolicitante: c2.estadoEnvio,
  };
}