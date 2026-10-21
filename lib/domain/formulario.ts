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

  const respuesta = solicitud.informacionRespuesta?.ronda === actual.ronda ? solicitud.informacionRespuesta : undefined;
  const detallada: RondaPreguntas = {
    id: `solicitud-${solicitud.id}-ronda-${actual.ronda}`,
    solicitudId: solicitud.id,
    ronda: actual.ronda,
    preguntas: actual.preguntas,
    respuestas: respuesta?.respuestas,
    pedidaPor: actual.pedidaPor,
    pedidaEn: actual.pedidaEn,
    respondidaEn: respuesta?.respondidaEn,
    detalleDisponible: true,
  };

  const indice = rondas.findIndex((r) => r.ronda === actual.ronda);
  if (indice === -1) return [...rondas, detallada];
  // Si la ronda abierta llegó como marcador desde el evento (sin detalle), se mejora con
  // el texto real: es la única que sí sabemos completa.
  if (rondas[indice].detalleDisponible === false) {
    const copia = [...rondas];
    copia[indice] = {
      ...detallada,
      respuestas: rondas[indice].respuestas ?? detallada.respuestas,
      respondidaEn: rondas[indice].respondidaEn ?? detallada.respondidaEn,
    };
    return copia;
  }
  return rondas;
}

type EventoResumen = {
  tipoEvento: string;
  nota?: string;
  timestamp: string;
  actorIdentificador?: string;
};

/**
 * Reconstruye las rondas ANTERIORES a la migración 024 a partir de los eventos.
 *
 * De esas rondas no queda el texto (el evento solo guarda "Ronda N: X pregunta(s)"), pero el
 * número, la fecha y si se respondió sí. Se muestran como cards incompletas, avisando que el
 * detalle no se guardó: preferimos un historial honesto a uno que finja estar completo.
 */
export function rondasDesdeEventos(
  solicitudId: string,
  eventos: EventoResumen[],
  rondas: RondaPreguntas[]
): RondaPreguntas[] {
  const porRonda = new Map(rondas.map((r) => [r.ronda, r]));
  const pedidas = new Map<number, { en: string; por?: string; total: number }>();
  const respondidas = new Map<number, { en: string; total: number }>();

  for (const ev of eventos) {
    if (ev.tipoEvento === "pregunta_solicitante") {
      const m = /^Ronda (\d+):\s*(\d+)\s*pregunta/i.exec(ev.nota ?? "");
      if (m) pedidas.set(Number(m[1]), { en: ev.timestamp, por: ev.actorIdentificador, total: Number(m[2]) });
    } else if (ev.tipoEvento === "respuesta_solicitante") {
      const m = /^Ronda (\d+)\s*respondida:\s*(\d+)/i.exec(ev.nota ?? "");
      if (m) respondidas.set(Number(m[1]), { en: ev.timestamp, total: Number(m[2]) });
    }
  }

  const numeros = new Set<number>([...pedidas.keys(), ...respondidas.keys()]);
  for (const n of numeros) {
    if (porRonda.has(n)) continue;
    const pedida = pedidas.get(n);
    const respondida = respondidas.get(n);
    porRonda.set(n, {
      id: `evento-${solicitudId}-ronda-${n}`,
      solicitudId,
      ronda: n,
      preguntas: [],
      pedidaEn: pedida?.en ?? respondida!.en,
      pedidaPor: pedida?.por,
      respondidaEn: respondida?.en,
      detalleDisponible: false,
      totalPreguntas: pedida?.total ?? 0,
      totalRespuestas: respondida?.total,
    });
  }

  return [...porRonda.values()].sort((a, b) => a.ronda - b.ronda);
}
