// Layout corporativo de los correos — Portal de Compras BIA.
//
// Los 8 correos comparten este marco: cabecera con logo sobre blanco, barra azul, título,
// contenido y pie legal. Antes cada plantilla devolvía `<p>` sueltos: en un cliente de correo se
// veían como texto sin diseño.
//
// Reglas de correo que no se pueden ignorar:
//  · **Estilos inline**: Gmail y Outlook descartan buena parte del `<style>`.
//  · **Tablas para la maqueta**: los clientes no soportan flex/grid.
//  · **Logo por URL absoluta**: el cliente de correo no puede leer un archivo local; se sirve
//    desde `public/bia-logo.png` usando `NEXT_PUBLIC_APP_URL`. Si no está configurada, se omite.
//  · Copy en **usted** (ADR 0008).

const NAVY = "#1C3565";
const AZUL = "#4A88FA";
const GRIS_CLARO = "#9CA3AF";
const LINEA = "#E5E7EB";
const FONDO = "#F3F4F6";
const TEXTO = "#374151";

const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapar(s: string | undefined | number): string {
  if (s === undefined || s === null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/** Párrafo del cuerpo. */
export function parrafo(texto: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXTO};">${texto}</p>`;
}

/** Línea de cierre sin margen inferior (la última del cuerpo). */
export function parrafoFinal(texto: string): string {
  return `<p style="margin:0;font-size:15px;line-height:1.6;color:${TEXTO};">${texto}</p>`;
}

/** Tabla de datos etiqueta/valor. */
export function tablaDatos(filas: [string, string][]): string {
  const cuerpo = filas
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid ${LINEA};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${GRIS_CLARO};width:38%;vertical-align:top;">${escapar(k)}</td>
          <td style="padding:10px 0;border-top:1px solid ${LINEA};font-size:14px;color:${NAVY};vertical-align:top;">${escapar(v)}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 20px 0;">${cuerpo}</table>`;
}

/** Lista de viñetas. */
export function lista(items: string[]): string {
  const lis = items
    .map(
      (i) =>
        `<tr><td style="padding:0 0 10px 0;vertical-align:top;width:16px;color:${AZUL};font-size:15px;line-height:1.6;">•</td><td style="padding:0 0 10px 0;font-size:15px;line-height:1.6;color:${TEXTO};">${escapar(i)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 16px 0;">${lis}</table>`;
}

/** Botón (llamada a la acción). */
export function boton(url: string, texto: string): string {
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;">
    <tr><td style="border-radius:999px;background:${AZUL};">
      <a href="${escapar(url)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;font-family:${FUENTE};">${escapar(texto)}</a>
    </td></tr>
  </table>`;
}

/** Recuadro destacado (avisos, recomendaciones, decisiones). */
export function destacado(texto: string, tono: "info" | "aviso" = "info"): string {
  const borde = tono === "aviso" ? "#F59E0B" : AZUL;
  const fondo = tono === "aviso" ? "#FFFBEB" : "#EFF6FF";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
    <tr><td style="background:${fondo};border-left:3px solid ${borde};border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.6;color:${TEXTO};">${texto}</td></tr>
  </table>`;
}

/**
 * Marco del correo. `contenido` es el HTML ya armado con los helpers de arriba.
 */
export function layoutCorreo(opts: {
  titulo: string;
  contenido: string;
  /** Texto de vista previa que muestran Gmail/Outlook junto al asunto. */
  preheader?: string;
  /** Píldora con la referencia o el tipo (opcional). */
  etiqueta?: string;
}): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const logo = base
    ? `<img src="${base}/bia-logo.png" alt="BIA" width="132" style="display:block;border:0;outline:none;text-decoration:none;width:132px;height:auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:${NAVY};letter-spacing:-0.02em;">BIA Compras</span>`;

  const pildora = opts.etiqueta
    ? `<span style="display:inline-block;background:${AZUL};color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.04em;padding:5px 12px;border-radius:999px;margin-bottom:14px;">${escapar(opts.etiqueta)}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapar(opts.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};font-family:${FUENTE};-webkit-font-smoothing:antialiased;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapar(opts.preheader)}</div>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${FONDO};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINEA};">
          <!-- Cabecera: logo sobre blanco -->
          <tr>
            <td style="padding:28px 32px 18px 32px;background:#ffffff;">
              ${logo}
            </td>
          </tr>
          <!-- Barra de marca -->
          <tr><td style="height:3px;background:${AZUL};font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Cuerpo -->
          <tr>
            <td style="padding:30px 32px 8px 32px;">
              ${pildora}
              <h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.3;font-weight:600;color:${NAVY};letter-spacing:-0.01em;">${escapar(opts.titulo)}</h1>
              ${opts.contenido}
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <div style="border-top:1px solid ${LINEA};padding-top:16px;font-size:12px;line-height:1.6;color:${GRIS_CLARO};">
                Este es un correo automático del Portal de Compras BIA. Por favor no responda a este mensaje.<br />
                Departamento de Compras · BIA · Documento confidencial
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
