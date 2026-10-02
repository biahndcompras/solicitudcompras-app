// Validación de archivos adjuntos del solicitante (logo / arte del producto) — puro.
// Espeja el límite del servidor (POST /api/solicitudes/[id]/logo): 4 MB. Validar en el
// cliente evita subir 12 MB para que el servidor los rechace con un error técnico.

/** Tope en bytes, alineado con el 413 del servidor. */
export const MAX_BYTES_ARCHIVO = 4 * 1024 * 1024;
export const MAX_MB_ARCHIVO = MAX_BYTES_ARCHIVO / (1024 * 1024);

export const EXTENSIONES_ACEPTADAS = [".png", ".jpg", ".jpeg", ".pdf"] as const;
export const TIPOS_ACEPTADOS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "application/pdf",
] as const;

/** Atributo `accept` sin .svg: un vector activo servido desde nuestro dominio es un riesgo. */
export const ACCEPT_ARCHIVO = ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf";

export type ResultadoValidacionArchivo =
  | { ok: true }
  | { ok: false; motivo: "tipo" | "tamano" | "contenido" | "vacio"; mensaje: string };

function extension(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i === -1 ? "" : nombre.slice(i).toLowerCase();
}

function magicBytes(b: ArrayBuffer | Uint8Array): number[] {
  const b8 = b instanceof Uint8Array ? b : new Uint8Array(b);
  return [b8[0], b8[1], b8[2], b8[3]].filter((n) => n !== undefined);
}

/** Verifica que el contenido real corresponda al extensión declarada (archivo renombrado). */
export function contenidoCoincide(extensionActual: string, bytes: ArrayBuffer | Uint8Array): boolean {
  const m = magicBytes(bytes);
  if (m.length < 4) return false;
  if (extensionActual === ".png") return m[0] === 0x89 && m[1] === 0x50 && m[2] === 0x4e && m[3] === 0x47;
  if (extensionActual === ".jpg" || extensionActual === ".jpeg") {
    return m[0] === 0xff && m[1] === 0xd8 && m[2] === 0xff;
  }
  if (extensionActual === ".pdf") return m[0] === 0x25 && m[1] === 0x50 && m[2] === 0x44 && m[3] === 0x46;
  return false;
}

/** Un PDF truncado no termina en %%EOF: lo detectamos sin parsearlo entero. */
export function pdfLooksCompleto(bytes: ArrayBuffer | Uint8Array): boolean {
  const b8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const cola = new TextDecoder("latin1").decode(b8.subarray(Math.max(0, b8.length - 2048)));
  return cola.includes("%%EOF");
}

export function validarArchivoAdjunto(
  archivo: { name: string; size: number; type?: string },
  contenido?: ArrayBuffer | Uint8Array
): ResultadoValidacionArchivo {
  const ext = extension(archivo.name);
  if (archivo.size === 0) {
    return { ok: false, motivo: "vacio", mensaje: "El archivo está vacío. Elegí uno con contenido." };
  }
  if (!(EXTENSIONES_ACEPTADAS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      motivo: "tipo",
      mensaje: `Formato no admitido (${ext || "sin extensión"}). Aceptamos ${EXTENSIONES_ACEPTADAS.join(", ")}.`,
    };
  }
  if (archivo.type && !(TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) {
    return {
      ok: false,
      motivo: "tipo",
      mensaje: `El navegador reportó el archivo como ${archivo.type}, que no está permitido. Aceptamos ${EXTENSIONES_ACEPTADAS.join(", ")}.`,
    };
  }
  if (archivo.size > MAX_BYTES_ARCHIVO) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      motivo: "tamano",
      mensaje: `El archivo pesa ${mb} MB y el máximo son 4 MB. Exportalo más liviano (PNG o JPG) e intentá de nuevo.`,
    };
  }
  if (contenido) {
    if (!contenidoCoincide(ext, contenido)) {
      return {
        ok: false,
        motivo: "contenido",
        mensaje: "El contenido del archivo no corresponde a su extensión. Volvé a exportarlo o tomá una captura en PNG.",
      };
    }
    if (ext === ".pdf" && !pdfLooksCompleto(contenido)) {
      return {
        ok: false,
        motivo: "contenido",
        mensaje: "El PDF parece estar incompleto o corrupto. Volvé a generarlo e intentá de nuevo.",
      };
    }
  }
  return { ok: true };
}
