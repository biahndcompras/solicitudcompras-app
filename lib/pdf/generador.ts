// Generador del documento RFQ/RFI/RFP — Portal de Compras BIA.
//
// Reemplaza al PDF de pdfme, que salía como texto corrido de 7–9 pt sin jerarquía. Ahora es un
// documento con el sistema visual de BIA: banda de marca, secciones rotuladas, tabla de
// respuestas y paginación real. La referencia de diseño es `docs/formato-referencia.png`
// (solo el estilo); el contenido es el de Compras.
//
// Por qué `pdf-lib` y no pdfme: hace falta control de la paginación (la tabla de respuestas
// puede tener decenas de filas) y de la maqueta. `pdf-lib` es JS puro, corre en Vercel y
// permite calcular dónde cortar sin depender de un navegador.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Solicitud } from "@/lib/domain/types";

export type DocGenerado = {
  buffer: Uint8Array;
  tipo: string;
  referencia: string;
};

// ---------- Paleta (tomada del logo) ----------
const AZUL = rgb(0x4a / 255, 0x88 / 255, 0xfa / 255);
const NAVY = rgb(0x1c / 255, 0x35 / 255, 0x65 / 255);
const GRIS = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const GRIS_CLARO = rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255);
const LINEA = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);
const FONDO = rgb(0xf7 / 255, 0xf8 / 255, 0xfa / 255);
const TEXTO = rgb(0.2, 0.24, 0.31);
const BLANCO = rgb(1, 1, 1);

// ---------- Hoja Carta ----------
const W = 612;
const H = 792;
const M = 44;
const CW = W - M * 2;
const LIMITE_INFERIOR = 78;

const TITULO_DOC: Record<string, string> = {
  RFQ: "SOLICITUD DE COTIZACIÓN",
  RFP: "SOLICITUD DE PROPUESTA",
  RFI: "SOLICITUD DE INFORMACIÓN",
};

// Secciones 4 y 5 por tipo: el RFQ pide precios; el RFI pide información de mercado y aclara
// que no compromete a BIA; el RFP pide propuesta técnica y económica y declara la evaluación.
const CONTENIDO_POR_TIPO: Record<
  string,
  { seccion: string; intro: string; puntos: string[]; verbo: string }
> = {
  RFQ: {
    seccion: "4. CONDICIONES DE LA COTIZACIÓN",
    intro: "Le pedimos incluir en su oferta, de forma explícita:",
    puntos: [
      "Precio unitario y total, con el ISV desglosado por separado (indique si no aplica).",
      "Moneda de la oferta. No se aplicarán conversiones: cada oferta se compara en su moneda.",
      "Plazo de entrega en días calendario y disponibilidad del producto.",
      "Forma de pago y vigencia de la oferta.",
      "Garantía ofrecida y condiciones de devolución por defectos.",
      "Cualquier condición que afecte el precio o el plazo (flete, instalación, mínimos).",
    ],
    verbo: "cotización",
  },
  RFI: {
    seccion: "4. INFORMACIÓN QUE NECESITAMOS",
    intro: "Esta consulta no es un pedido ni compromete a BIA. Buscamos entender el mercado:",
    puntos: [
      "Capacidad de suministro y tiempo de reposición habitual.",
      "Disponibilidad actual y tiempos de entrega estimados.",
      "Condiciones comerciales generales y mínimos de compra.",
      "Alternativas o sustitutos disponibles y sus diferencias.",
      "Restricciones o requisitos que debamos conocer antes de cotizar.",
    ],
    verbo: "información",
  },
  RFP: {
    seccion: "4. ALCANCE, ENTREGABLES Y EVALUACIÓN",
    intro: "Solicitamos una propuesta técnica y económica. Se evaluará:",
    puntos: [
      "Alcance propuesto y entregables concretos (qué incluye y qué no).",
      "Metodología, equipo asignado y cronograma estimado.",
      "Precio total con impuestos desglosados y forma de pago propuesta.",
      "Criterios de evaluación: cumplimiento técnico, plazo, precio y experiencia.",
      "Supuestos y dependencias que condicionen el plazo o el costo.",
    ],
    verbo: "propuesta",
  },
};

// ---------- Assets (cacheados por proceso) ----------
const RAIZ = process.cwd();
let cacheAssets: Promise<{ regular: Uint8Array; semibold: Uint8Array; logo: Uint8Array }> | null =
  null;

function assets() {
  if (!cacheAssets) {
    cacheAssets = (async () => {
      const [regular, semibold, logo] = await Promise.all([
        readFile(path.join(RAIZ, "assets", "Geist-Regular.ttf")),
        readFile(path.join(RAIZ, "assets", "Geist-SemiBold.ttf")),
        readFile(path.join(RAIZ, "public", "bia-logo.png")),
      ]);
      return {
        regular: Uint8Array.from(regular),
        semibold: Uint8Array.from(semibold),
        logo: Uint8Array.from(logo),
      };
    })().catch((e) => {
      cacheAssets = null;
      throw e;
    });
  }
  return cacheAssets;
}

// ---------- Utilidades de maqueta ----------
function envolver(texto: string, font: PDFFont, size: number, maxW: number): string[] {
  const palabras = String(texto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!palabras.length) return [""];
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (font.widthOfTextAtSize(prueba, size) <= maxW) actual = prueba;
    else {
      if (actual) lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

type Fuentes = { regular: PDFFont; semibold: PDFFont };

function crearLienzo(doc: PDFDocument, fonts: Fuentes, logo: PDFImage, datos: DatosDoc) {
  const paginas: PDFPage[] = [];
  let page: PDFPage;
  let y = 0;

  const texto = (
    s: string,
    x: number,
    yy: number,
    o: { size?: number; negrita?: boolean; color?: ReturnType<typeof rgb> } = {}
  ) =>
    page.drawText(String(s ?? ""), {
      x,
      y: yy,
      size: o.size ?? 9,
      font: o.negrita ? fonts.semibold : fonts.regular,
      color: o.color ?? NAVY,
    });

  function pie() {
    page.drawLine({
      start: { x: M, y: 58 },
      end: { x: W - M, y: 58 },
      thickness: 0.8,
      color: LINEA,
    });
    texto(
      "Documento generado por el Portal de Compras BIA · Confidencial · Uso exclusivo de los proveedores invitados.",
      M,
      44,
      { size: 6.5, color: GRIS_CLARO }
    );
  }

  function nueva(compacta: boolean) {
    page = doc.addPage([W, H]);
    paginas.push(page);
    if (compacta) {
      const lw = 74;
      const lh = (lw * logo.height) / logo.width;
      page.drawImage(logo, { x: M, y: H - M - lh, width: lw, height: lh });
      const et = `Continuación · ${datos.referencia}`;
      const ancho = fonts.regular.widthOfTextAtSize(et, 8);
      page.drawText(et, { x: W - M - ancho, y: H - M - 12, size: 8, font: fonts.regular, color: GRIS });
      page.drawLine({
        start: { x: M, y: H - M - 24 },
        end: { x: W - M, y: H - M - 24 },
        thickness: 0.8,
        color: LINEA,
      });
      y = H - M - 44;
    } else {
      const lw = 126;
      const lh = (lw * logo.height) / logo.width;
      page.drawImage(logo, { x: M, y: H - M - lh, width: lw, height: lh });

      const xd = 214;
      texto(datos.tituloDocumento, xd, H - M - 12, { size: 16, negrita: true });
      texto(`Nº ${datos.referencia}`, xd, H - M - 32, { size: 9, color: GRIS });
      texto(`Emitido el ${datos.fecha}`, xd, H - M - 44, { size: 9, color: GRIS });

      const wEt = fonts.semibold.widthOfTextAtSize(datos.sigla, 8) + 18;
      // Píldora: un rectángulo con dos círculos en los extremos (pdf-lib no tiene radio).
      const px = W - M - wEt;
      const py = H - M - 26;
      page.drawRectangle({ x: px + 9, y: py, width: wEt - 18, height: 18, color: AZUL });
      page.drawCircle({ x: px + 9, y: py + 9, size: 9, color: AZUL });
      page.drawCircle({ x: px + wEt - 9, y: py + 9, size: 9, color: AZUL });
      page.drawText(datos.sigla, {
        x: W - M - wEt + 9,
        y: H - M - 20,
        size: 8,
        font: fonts.semibold,
        color: BLANCO,
      });

      page.drawLine({
        start: { x: M, y: H - M - 64 },
        end: { x: W - M, y: H - M - 64 },
        thickness: 2.5,
        color: AZUL,
      });
      y = H - M - 88;
    }
    pie();
  }

  /** Salta de página si el contenido no entra. `reservado` evita títulos huérfanos. */
  function salto(alto: number) {
    if (y - alto < LIMITE_INFERIOR) nueva(true);
  }

  function seccion(titulo: string, reservado = 28) {
    salto(18 + reservado);
    texto(titulo, M, y, { size: 7.5, negrita: true, color: GRIS });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINEA });
    y -= 14;
  }

  function campo(etiqueta: string, valor: string, x: number, ancho: number) {
    texto(etiqueta.toUpperCase(), x, y, { size: 6.5, color: GRIS_CLARO });
    const lineas = envolver(valor || "no especificado", fonts.regular, 10, ancho);
    let yy = y - 12;
    for (const l of lineas.slice(0, 2)) {
      texto(l, x, yy, { size: 10 });
      yy -= 12;
    }
  }

  function parrafos(t: string, size = 9.5, interlinea = 13) {
    for (const l of envolver(t, fonts.regular, size, CW)) {
      salto(interlinea);
      texto(l, M, y, { size, color: TEXTO });
      y -= interlinea;
    }
  }

  function tabla(filas: [string, string][]) {
    const c1 = 175;
    const c2 = CW - c1;
    const cabecera = () => {
      page.drawRectangle({ x: M, y: y - 20, width: CW, height: 20, color: AZUL });
      texto("CAMPO", M + 8, y - 14, { size: 7.5, negrita: true, color: BLANCO });
      texto("RESPUESTA DEL SOLICITANTE", M + c1 + 8, y - 14, {
        size: 7.5,
        negrita: true,
        color: BLANCO,
      });
      y -= 20;
    };

    salto(44);
    cabecera();
    if (!filas.length) {
      page.drawRectangle({ x: M, y: y - 24, width: CW, height: 24, color: FONDO });
      texto("Sin especificaciones registradas.", M + 8, y - 15, { size: 8.5, color: GRIS });
      y -= 24;
      return;
    }
    let i = 0;
    for (const [k, v] of filas) {
      const valorLineas = envolver(v || "no especificado", fonts.regular, 8.5, c2 - 16);
      const alto = Math.max(22, valorLineas.length * 10.5 + 11);
      if (y - alto < LIMITE_INFERIOR) {
        nueva(true);
        cabecera();
      }
      if (i % 2 === 1) {
        page.drawRectangle({ x: M, y: y - alto, width: CW, height: alto, color: FONDO });
      }
      page.drawLine({
        start: { x: M, y: y - alto },
        end: { x: W - M, y: y - alto },
        thickness: 0.5,
        color: LINEA,
      });
      const claveLineas = envolver(k, fonts.semibold, 8.5, c1 - 16);
      let ky = y - 13;
      for (const l of claveLineas.slice(0, 2)) {
        texto(l, M + 8, ky, { size: 8.5, negrita: true });
        ky -= 10.5;
      }
      let vy = y - 13;
      for (const l of valorLineas) {
        texto(l, M + c1 + 8, vy, { size: 8.5, color: TEXTO });
        vy -= 10.5;
      }
      y -= alto;
      i += 1;
    }
  }

  function vinetas(puntos: string[]) {
    for (const p of puntos) {
      const lineas = envolver(p, fonts.regular, 9, CW - 14);
      salto(lineas.length * 12);
      page.drawCircle({ x: M + 2.5, y: y + 3, size: 1.8, color: AZUL });
      let yy = y;
      for (const l of lineas) {
        texto(l, M + 14, yy, { size: 9, color: TEXTO });
        yy -= 12;
      }
      y -= lineas.length * 12 + 3;
    }
  }

  return { nueva, seccion, campo, parrafos, tabla, vinetas, paginas, get y() { return y; }, set y(v: number) { y = v; } };
}

type DatosDoc = {
  referencia: string;
  sigla: string;
  tituloDocumento: string;
  fecha: string;
  fechaLimite: string;
  fechaRequerida: string;
  area: string;
  solicitante: string;
  coordinador: string;
  titulo: string;
  descripcion: string;
  respuestas: [string, string][];
};

function fechaLegible(iso?: string): string {
  if (!iso) return "no especificado";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function generarDocumento(opts: {
  tipo: "RFI" | "RFQ" | "RFP";
  solicitud: Solicitud;
  respuestas: Record<string, string>;
  coordenadorNombre?: string;
  fechaLimite?: string;
}): Promise<DocGenerado> {
  const { tipo, solicitud, respuestas, coordenadorNombre, fechaLimite } = opts;
  const assetsBytes = await assets();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fuentes = {
    regular: await doc.embedFont(assetsBytes.regular, { subset: true }),
    semibold: await doc.embedFont(assetsBytes.semibold, { subset: true }),
  };
  const logo = await doc.embedPng(assetsBytes.logo);

  const contenido = CONTENIDO_POR_TIPO[tipo] ?? CONTENIDO_POR_TIPO.RFQ;
  const datos: DatosDoc = {
    referencia: solicitud.numeroReferencia ?? "SIN-REF",
    sigla: tipo,
    tituloDocumento: TITULO_DOC[tipo] ?? TITULO_DOC.RFQ,
    fecha: fechaLegible(new Date().toISOString()),
    fechaLimite: fechaLegible(fechaLimite),
    fechaRequerida: fechaLegible(solicitud.fechaRequerida),
    area: solicitud.areaSolicitante ?? "no especificado",
    solicitante: solicitud.solicitanteNombre,
    coordinador: coordenadorNombre ?? "no especificado",
    titulo: solicitud.titulo,
    descripcion: solicitud.descripcion ?? "no especificado",
    respuestas: Object.entries(respuestas ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  };

  const c = crearLienzo(doc, fonts, logo, datos);
  c.nueva(false);

  c.seccion("1. DATOS DE LA SOLICITUD", 70);
  {
    const yFila = c.y;
    c.campo("Solicitante", datos.solicitante, M, 225);
    c.campo("Coordinador", datos.coordinador, M + 268, 225);
    c.y = yFila - 30;
    c.campo("Área", datos.area, M, 225);
    c.campo("Fecha requerida", datos.fechaRequerida, M + 268, 225);
    c.y = yFila - 60 + 2;
  }

  c.seccion("2. DESCRIPCIÓN DE LA NECESIDAD", 46);
  c.parrafos(datos.titulo, 13, 18);
  c.parrafos(datos.descripcion);
  c.y -= 8;

  c.seccion("3. ESPECIFICACIONES SOLICITADAS", 54);
  c.tabla(datos.respuestas);
  c.y -= 16;

  c.seccion(contenido.seccion, 46);
  c.parrafos(contenido.intro, 9, 12.5);
  c.y -= 2;
  c.vinetas(contenido.puntos);
  c.y -= 10;

  c.seccion("5. CÓMO RESPONDER", 40);
  c.parrafos(
    `Envíe su ${contenido.verbo} citando la referencia ${datos.referencia}, a más tardar el ${datos.fechaLimite}. Toda aclaración debe hacerse por escrito al coordinador asignado.`,
    9,
    12.5
  );

  // Numeración de páginas (ya se conoce el total).
  c.paginas.forEach((p, i) => {
    const et = `Página ${i + 1} de ${c.paginas.length}`;
    const ancho = fonts.regular.widthOfTextAtSize(et, 7);
    p.drawText(et, { x: W - M - ancho, y: 44, size: 7, font: fonts.regular, color: GRIS_CLARO });
  });

  const bytes = await doc.save();
  return { buffer: bytes, tipo, referencia: datos.referencia };
}
