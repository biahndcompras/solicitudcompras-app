import type { CampoCatalogo, RespuestaCampo, RondaPreguntas, Solicitud } from "@/lib/domain/types";

/**
 * Una pregunta del formulario original, con la respuesta del solicitante si la dio.
 *
 * El detalle de Compras debe mostrar TODO lo que se preguntó, no solo lo que se respondió:
 * un campo en blanco también es información (dice qué faltó). `valor === undefined` se
 * renderiza como "No especificado".
 */
export type PreguntaOriginal = {
  campoKey: string;
  label: string;
  ayuda?: string;
  valor?: string;
  /** `plantilla` si vino del cuestionario del tipo; `assessment` si la generó la IA. */
  origen: "plantilla" | "assessment" | string;
};

/**
 * Une el cuestionario que se le mostró al solicitante con sus respuestas.
 *
 * - Primero los campos de la plantilla congelada, en su orden (incluye los no respondidos).
 * - Después las preguntas del assessment que no estén ya en la plantilla.
 *
 * Antes el detalle solo listaba `respuesta_campo`, así que un campo que el solicitante dejó
 * vacío desaparecía de la vista y el coordinador no sabía que se había preguntado.
 */
export function armarFormularioOriginal(
  camposPlantilla: CampoCatalogo[],
  respuestas: RespuestaCampo[]
): PreguntaOriginal[] {
  const porClave = new Map(respuestas.map((r) => [r.campoKey, r]));
  const vistas = new Set<string>();
  const salida: PreguntaOriginal[] = [];

  for (const campo of camposPlantilla) {
    vistas.add(campo.campoKey);
    const r = porClave.get(campo.campoKey);
    salida.push({
      campoKey: campo.campoKey,
      label: campo.label,
      ayuda: campo.ayuda,
      valor: r?.valor ?? (r?.valorNumerico !== undefined ? String(r.valorNumerico) : undefined),
      origen: "plantilla",
    });
  }

  for (const r of respuestas) {
    if (vistas.has(r.campoKey)) continue;
    salida.push({
      campoKey: r.campoKey,
      label: r.campoLabel,
      valor: r.valor ?? (r.valorNumerico !== undefined ? String(r.valorNumerico) : undefined),
      origen: r.origen ?? "assessment",
    });
  }

  return salida;
}

/**
 * Completa el historial con la ronda que sigue viva en `solicitud` si no está en la tabla.
 *
 * Cubre la ventana entre aplicar la migración y desplegar el código (o un backfill que no
 * pudo recuperar la ronda): sin esto, una ronda ABIERTA desaparecería de la vista y el
 * coordinador no podría leer la pregunta que está esperando respuesta.
 */
export function completarRondas(rondas: RondaPreguntas[], solicitud: Solicitud): RondaPreguntas[] {
  const actual = solicitud.informacionPreguntas;
  if (!actual) return rondas;
  if (rondas.some((r) => r.ronda === actual.ronda)) return rondas;

  const respuesta = solicitud.informacionRespuesta?.ronda === actual.ronda ? solicitud.informacionRespuesta : undefined;
  return [
    ...rondas,
    {
      id: `solicitud-${solicitud.id}-ronda-${actual.ronda}`,
      solicitudId: solicitud.id,
      ronda: actual.ronda,
      preguntas: actual.preguntas,
      respuestas: respuesta?.respuestas,
      pedidaPor: actual.pedidaPor,
      pedidaEn: actual.pedidaEn,
      respondidaEn: respuesta?.respondidaEn,
    },
  ];
}
