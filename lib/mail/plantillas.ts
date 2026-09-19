// Plantillas de correo 1–5 (documento 13) — Portal de Compras BIA.
// Cuerpos HTML simples. Nomenclatura vigente: 4 del ciclo + 1 alerta configurable.

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
  valorNeto?: string;
  valorTotal?: string;
  plazoEntrega?: string;
  fechaDecision?: string;
  tiempoCiclo?: string;
  urlDetalle?: string;
  diasSinMovimiento?: number;
  estadoActual?: string;
};

export function esc(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const PLANTILLAS_CORREO = {
  // 1 — Nueva solicitud asignada (coordinador)
  "1": {
    asunto: (d: DatosCorreo) => `Nueva solicitud ${esc(d.numeroReferencia)} — ${esc(d.titulo)}`,
    cuerpo: (d: DatosCorreo) => `
      <p>Hola ${esc(d.coordinadorNombre)},</p>
      <p>Se te asignó una nueva solicitud de cotización.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <tr><td><b>Referencia</b></td><td>${esc(d.numeroReferencia)}</td></tr>
        <tr><td><b>Tipo</b></td><td>${esc(d.tipo)}</td></tr>
        <tr><td><b>Necesidad</b></td><td>${esc(d.titulo)}</td></tr>
        <tr><td><b>Solicitante</b></td><td>${esc(d.solicitanteNombre)} — ${esc(d.area)}</td></tr>
        <tr><td><b>Requerida para</b></td><td>${esc(d.fechaRequerida)}</td></tr>
      </table>
      <p>${esc(d.resumen)}</p>
      <p>Adjunto encontrarás el documento listo para enviar a proveedores.</p>
      <p>Cargá las cotizaciones en el portal referenciadas a ${esc(d.numeroReferencia)}: ${esc(d.urlPanel)}</p>
      <p>Portal de Compras BIA</p>`,
  },
  // 2 — Acuse de recibo (solicitante)
  "2": {
    asunto: (d: DatosCorreo) => `Recibimos tu solicitud ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) => `
      <p>Hola ${esc(d.solicitanteNombre)},</p>
      <p>Tu solicitud fue recibida y enviada al equipo de Compras.</p>
      <table cellpadding="6" cellspacing="0" style="font-size:13px">
        <tr><td><b>Referencia</b></td><td>${esc(d.numeroReferencia)}</td></tr>
        <tr><td><b>Necesidad</b></td><td>${esc(d.titulo)}</td></tr>
        <tr><td><b>Atiende</b></td><td>${esc(d.coordinadorNombre)}</td></tr>
      </table>
      <p>A partir de aquí, el equipo de Compras gestiona la cotización. Cuando tengamos las cotizaciones listas, te enviaremos un correo con el comparativo para que elijas.</p>
      <p>Portal de Compras BIA</p>`,
  },
  // 3 — Comparativo listo (solicitante, enlace público)
  "3": {
    asunto: (d: DatosCorreo) => `Tu comparativo está listo — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) => `
      <p>Hola ${esc(d.solicitanteNombre)},</p>
      <p>Ya tenemos las cotizaciones para tu solicitud y preparamos el comparativo.</p>
      <table cellpadding="6" cellspacing="0" style="font-size:13px">
        <tr><td><b>Referencia</b></td><td>${esc(d.numeroReferencia)}</td></tr>
        <tr><td><b>Cotizaciones</b></td><td>${d.cantidadCotizaciones ?? "—"}</td></tr>
      </table>
      ${d.recomendacion ? `<p><b>Recomendación de ${esc(d.coordinadorNombre)}:</b> ${esc(d.recomendacion)}</p>` : ""}
      <p>Revisá el comparativo completo y seleccioná la opción que prefieras desde este enlace:</p>
      <p><a href="${esc(d.urlComparativa)}">${esc(d.urlComparativa)}</a></p>
      <p>Tu selección queda registrada y nos llega de vuelta para continuar con la orden.</p>
      <p>Portal de Compras BIA</p>`,
  },
  // 4 — Decisión registrada (coordinador + admin)
  "4": {
    asunto: (d: DatosCorreo) => `Decisión registrada — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) => `
      <p>Hola ${esc(d.coordinadorNombre)},</p>
      <p>${esc(d.solicitanteNombre)} seleccionó una opción para la solicitud ${esc(d.numeroReferencia)}.</p>
      <table cellpadding="6" cellspacing="0" style="font-size:13px">
        <tr><td><b>Proveedor</b></td><td>${esc(d.proveedorSeleccionado)}</td></tr>
        <tr><td><b>Valor neto</b></td><td>${esc(d.valorNeto)}</td></tr>
        <tr><td><b>Total</b></td><td>${esc(d.valorTotal)}</td></tr>
        <tr><td><b>Plazo</b></td><td>${esc(d.plazoEntrega)}</td></tr>
        <tr><td><b>Fecha</b></td><td>${esc(d.fechaDecision)}</td></tr>
        <tr><td><b>Tiempo de ciclo</b></td><td>${esc(d.tiempoCiclo)}</td></tr>
      </table>
      <p>La solicitud queda cerrada en el portal. Podés continuar con la orden de compra.</p>
      <p>Portal de Compras BIA</p>`,
  },
  // 5 — Alerta de solicitud sin movimiento (configurable)
  "5": {
    asunto: (d: DatosCorreo) => `Solicitud sin movimiento — ${esc(d.numeroReferencia)}`,
    cuerpo: (d: DatosCorreo) => `
      <p>Hola ${esc(d.coordinadorNombre)},</p>
      <p>La solicitud ${esc(d.numeroReferencia)} lleva ${d.diasSinMovimiento ?? "—"} días en estado "${esc(d.estadoActual)}" sin cambios.</p>
      <table cellpadding="6" cellspacing="0" style="font-size:13px">
        <tr><td><b>Necesidad</b></td><td>${esc(d.titulo)}</td></tr>
        <tr><td><b>Solicitante</b></td><td>${esc(d.solicitanteNombre)}</td></tr>
        <tr><td><b>Requerida para</b></td><td>${esc(d.fechaRequerida)}</td></tr>
      </table>
      <p><a href="${esc(d.urlDetalle)}">Ver solicitud</a></p>
      <p>Portal de Compras BIA</p>`,
  },
} as const;

export type TipoCorreo = keyof typeof PLANTILLAS_CORREO;

export function renderCorreo(tipo: TipoCorreo, d: DatosCorreo): { asunto: string; html: string } {
  const t = PLANTILLAS_CORREO[tipo];
  return { asunto: t.asunto(d), html: t.cuerpo(d) };
}