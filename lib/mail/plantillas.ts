// Plantillas de los 8 correos del sistema — Portal de Compras BIA.
//
// Todas comparten el marco de `layout.ts` (logo, barra de marca, título, pie legal) para que
// ninguna comunicación salga como texto plano. El copy está en **usted** (ADR 0008).
import {
  boton,
  destacado,
  escapar as esc,
  layoutCorreo,
  lista,
  parrafo,
  parrafoFinal,
  tablaDatos,
} from "./layout";

export type DatosCorreo = {
  coordinadorNombre?: string;
  coordinadorEmail?: string;
  solicitanteNombre?: string;
  solicitanteEmail?: string;
  numeroReferencia?: string;
  titulo?: string;
  tipo?: string;
  area?: string;
  fechaRequerida?: string;
  resumen?: string;
  urlPanel?: string;
  urlComparativa?: string;
  cantidadCotizaciones?: number;
  recomendacion?: string;
  proveedorSeleccionado?: string;
  /** "Ninguna me sirve": la solicitud vuelve a Compras en vez de cerrarse. */
  ningunaOpcionAceptada?: boolean;
  valorNeto?: string;
  valorTotal?: string;
  plazoEntrega?: string;
  fechaDecision?: string;
  tiempoCiclo?: string;
  urlDetalle?: string;
  diasSinMovimiento?: number;
  estadoActual?: string;
  /** Preguntas de Compras al solicitante (correo 6) o sus respuestas (correo 7). */
  preguntas?: { pregunta: string; respuesta?: string }[];
  ronda?: number;
  diasEsperando?: number;
  /** Correo 9: documento adjunto nuevo. */
  documentoNombre?: string;
  subidoPor?: string;
  /** Enlace firmado para descargar el documento desde el correo (4.13.11). */
  urlDescarga?: string | null;
};

const saludo = (nombre?: string) => (nombre ? `Hola, ${esc(nombre)}:` : "Hola:");

export const PLANTILLAS_CORREO = {
  // 1 — Nueva solicitud asignada (coordinador)
  "1": {
    asunto: (d: DatosCorreo) => `Nueva solicitud ${esc(d.numeroReferencia)} — ${esc(d.titulo)}`,
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Tiene una nueva solicitud asignada",
        etiqueta: d.numeroReferencia ?? "Nueva solicitud",
        preheader: `Solicitud ${d.numeroReferencia} de ${d.solicitanteNombre ?? "un solicitante"}.`,
        contenido:
          parrafo(saludo(d.coordinadorNombre).replace(/:$/, ".")) +
          parrafo("Se le asignó una nueva solicitud de cotización para gestionar.") +
          tablaDatos([
            ["Tipo", d.tipo ?? ""],
            ["Necesidad", d.titulo ?? ""],
            ["Solicitante", `${d.solicitanteNombre ?? ""} — ${d.area ?? ""}`],
            ["Requerida para", d.fechaRequerida ?? ""],
          ]) +
          (d.resumen ? destacado(esc(d.resumen)) : "") +
          parrafo("Adjunto encontrará el documento listo para enviar a proveedores.") +
          boton(d.urlPanel ?? d.urlDetalle ?? "", "Abrir el panel") +
          parrafoFinal(
            `Cargue las cotizaciones en el portal citando la referencia ${esc(d.numeroReferencia)}.`
          ),
      }),
  },

  // 2 — Acuse de recibo (solicitante)
  "2": {
    asunto: (d: DatosCorreo) => `Recibimos su solicitud ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Recibimos su solicitud",
        etiqueta: d.numeroReferencia ?? "Acuse de recibo",
        preheader: "Su solicitud ya está en manos del equipo de Compras.",
        contenido:
          parrafo(saludo(d.solicitanteNombre)) +
          parrafo("Su solicitud fue recibida y enviada al equipo de Compras.") +
          tablaDatos([
            ["Referencia", d.numeroReferencia ?? ""],
            ["Necesidad", d.titulo ?? ""],
            ["Atiende", d.coordinadorNombre ?? ""],
          ]) +
          parrafo(
            "A partir de aquí, el equipo de Compras gestiona la cotización. Cuando tengamos las cotizaciones listas, le enviaremos un correo con el comparativo para que elija."
          ) +
          parrafoFinal("Gracias por usar el Portal de Compras BIA."),
      }),
  },

  // 3 — Comparativo listo (solicitante, enlace público)
  "3": {
    asunto: (d: DatosCorreo) => `Su comparativo está listo — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Su comparativo está listo",
        etiqueta: d.numeroReferencia ?? "Comparativo",
        preheader: "Revise las opciones y elija la que prefiera.",
        contenido:
          parrafo(saludo(d.solicitanteNombre)) +
          parrafo("Ya tenemos las cotizaciones para su solicitud y preparamos el comparativo.") +
          tablaDatos([
            ["Referencia", d.numeroReferencia ?? ""],
            ["Cotizaciones", d.cantidadCotizaciones !== undefined ? String(d.cantidadCotizaciones) : ""],
          ]) +
          (d.recomendacion
            ? destacado(
                `<strong>Recomendación de ${esc(d.coordinadorNombre ?? "Compras")}:</strong> ${esc(d.recomendacion)}`
              )
            : "") +
          parrafo("Revise el comparativo completo y seleccione la opción que prefiera:") +
          boton(d.urlComparativa ?? "", "Ver comparativa y decidir") +
          parrafoFinal(
            "Su selección queda registrada y nos llega de vuelta para continuar con la orden."
          ),
      }),
  },

  // 4 — Decisión registrada (coordinador + admin)
  "4": {
    asunto: (d: DatosCorreo) => `Decisión registrada — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: d.ningunaOpcionAceptada ? "La solicitud vuelve a Compras" : "Decisión registrada",
        etiqueta: d.numeroReferencia ?? "Decisión",
        preheader: d.ningunaOpcionAceptada
          ? "El solicitante indicó que ninguna opción le sirve."
          : `Se eligió ${d.proveedorSeleccionado ?? "una opción"}.`,
        contenido:
          parrafo(saludo(d.coordinadorNombre)) +
          parrafo(
            d.ningunaOpcionAceptada
              ? `${esc(d.solicitanteNombre ?? "El solicitante")} indicó que ninguna opción le sirve para la solicitud ${esc(d.numeroReferencia)}.`
              : `${esc(d.solicitanteNombre ?? "El solicitante")} seleccionó una opción para la solicitud ${esc(d.numeroReferencia)}.`
          ) +
          (d.ningunaOpcionAceptada
            ? ""
            : tablaDatos([
                ["Proveedor", d.proveedorSeleccionado ?? ""],
                ["Valor neto", d.valorNeto ?? ""],
                ["Total", d.valorTotal ?? ""],
                ["Plazo", d.plazoEntrega ?? ""],
                ["Fecha", d.fechaDecision ?? ""],
                ["Tiempo de ciclo", d.tiempoCiclo ?? ""],
              ])) +
          (d.ningunaOpcionAceptada
            ? destacado(
                "La solicitud <strong>vuelve a Compras</strong>: no se cerró. Evalúe por qué ninguna opción le sirve y decida si se re-cotiza o si necesita información adicional del solicitante.",
                "aviso"
              )
            : destacado("La solicitud queda cerrada en el portal. Puede continuar con la orden de compra.")) +
          boton(d.urlDetalle ?? "", "Ver la solicitud") +
          parrafoFinal("Este aviso también llegó a administración."),
      }),
  },

  // 5 — Alerta de solicitud sin movimiento (configurable)
  "5": {
    asunto: (d: DatosCorreo) => `Solicitud sin movimiento — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Solicitud sin movimiento",
        etiqueta: d.numeroReferencia ?? "Alerta",
        preheader: `Lleva ${d.diasSinMovimiento ?? "varios"} días sin cambios.`,
        contenido:
          parrafo(saludo(d.coordinadorNombre)) +
          destacado(
            `La solicitud ${esc(d.numeroReferencia)} lleva <strong>${d.diasSinMovimiento ?? "—"} días</strong> en estado «${esc(d.estadoActual)}» sin cambios.`,
            "aviso"
          ) +
          tablaDatos([
            ["Necesidad", d.titulo ?? ""],
            ["Solicitante", d.solicitanteNombre ?? ""],
            ["Requerida para", d.fechaRequerida ?? ""],
          ]) +
          boton(d.urlDetalle ?? "", "Ver la solicitud") +
          parrafoFinal("Si ya se está gestionando, no hace falta hacer nada."),
      }),
  },

  // 6 — Compras necesita información del solicitante (spec 010, RF-59)
  "6": {
    asunto: (d: DatosCorreo) =>
      `Necesitamos un dato suyo — ${esc(d.numeroReferencia ?? "")}`.trim(),
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Compras necesita un dato suyo",
        etiqueta: d.numeroReferencia ?? "Acción requerida",
        preheader: "Su respuesta permite continuar con la solicitud.",
        contenido:
          parrafo(saludo(d.solicitanteNombre)) +
          parrafo(
            `Para seguir con <strong>${esc(d.titulo)}</strong> (${esc(d.numeroReferencia ?? "")}), Compras necesita que confirme ${
              d.preguntas && d.preguntas.length === 1 ? "un dato" : "algunos datos"
            }:`
          ) +
          lista((d.preguntas ?? []).map((p) => p.pregunta)) +
          boton(d.urlDetalle ?? "", "Responder ahora") +
          parrafoFinal(
            "Su respuesta vuelve directamente al coordinador de Compras que está viendo su solicitud."
          ),
      }),
  },

  // 7 — El solicitante respondió (spec 010, RF-60)
  "7": {
    asunto: (d: DatosCorreo) =>
      `${esc(d.solicitanteNombre ?? "El solicitante")} respondió — ${esc(d.numeroReferencia ?? "")}`.trim(),
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "El solicitante respondió",
        etiqueta: d.numeroReferencia ?? "Respuesta",
        preheader: `Ronda ${d.ronda ?? 1} de preguntas respondida.`,
        contenido:
          parrafo(saludo(d.coordinadorNombre)) +
          parrafo(
            `${esc(d.solicitanteNombre)} respondió las preguntas de la ronda ${d.ronda ?? 1} sobre ${esc(d.titulo)} (${esc(d.numeroReferencia ?? "")}):`
          ) +
          tablaDatos(
            (d.preguntas ?? []).map((p) => [p.pregunta, p.respuesta || "sin responder"])
          ) +
          boton(d.urlDetalle ?? "", "Ver la solicitud") +
          parrafoFinal("Puede responder con una nueva ronda si falta algún dato."),
      }),
  },

  // 8 — Recordatorio: el solicitante no respondió (spec 010, RF-62)
  "8": {
    asunto: (d: DatosCorreo) =>
      `Sin respuesta hace ${d.diasEsperando ?? 3} días — ${esc(d.numeroReferencia ?? "")}`.trim(),
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "El solicitante no ha respondido",
        etiqueta: d.numeroReferencia ?? "Recordatorio",
        preheader: `Lleva ${d.diasEsperando ?? 3} días esperando respuesta.`,
        contenido:
          parrafo(saludo(d.coordinadorNombre)) +
          destacado(
            `Le pidió información a ${esc(d.solicitanteNombre)} hace <strong>${d.diasEsperando ?? 3} días</strong> sobre ${esc(d.titulo)} (${esc(d.numeroReferencia ?? "")}) y todavía no ha respondido.`,
            "aviso"
          ) +
          tablaDatos((d.preguntas ?? []).map((p) => [p.pregunta, "—"])) +
          boton(d.urlDetalle ?? "", "Ver la solicitud") +
          parrafoFinal("Puede insistir por otro medio o seguir con lo que ya tiene."),
      }),
  },
  // 9 — Documento adjunto nuevo (4.4.12): avisa al otro lado del mostrador.
  "9": {
    asunto: (d: DatosCorreo) =>
      `Nuevo documento en la solicitud ${esc(d.numeroReferencia ?? "")}`.trim(),
    cuerpo: (d: DatosCorreo) =>
      layoutCorreo({
        titulo: "Hay un documento nuevo",
        etiqueta: d.numeroReferencia ?? "Documento adjunto",
        preheader: d.documentoNombre
          ? `Se adjuntó «${d.documentoNombre}».`
          : "Se adjuntó un documento a la solicitud.",
        contenido:
          parrafo(saludo(d.solicitanteNombre)) +
          parrafo(
            `${esc(d.subidoPor ?? "El equipo de Compras")} adjuntó un documento a la solicitud ${
              esc(d.numeroReferencia ?? "")
            }${d.titulo ? ` — ${esc(d.titulo)}` : ""}.`
          ) +
          tablaDatos([
            ["Documento", d.documentoNombre ?? ""],
            ["Adjuntado por", d.subidoPor ?? ""],
          ]) +
          boton(d.urlDescarga ?? "", "Descargar documento") +
          boton(d.urlDetalle ?? "", "Ver la solicitud") +
          parrafoFinal("El documento queda disponible dentro de la solicitud."),
      }),
  },
} as const;

export type TipoCorreo = keyof typeof PLANTILLAS_CORREO;

export function renderCorreo(tipo: TipoCorreo, d: DatosCorreo): { asunto: string; html: string } {
  const t = PLANTILLAS_CORREO[tipo];
  return { asunto: t.asunto(d), html: t.cuerpo(d) };
}
