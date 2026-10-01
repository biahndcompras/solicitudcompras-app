// Persistencia del borrador del solicitante — puro, sin dependencias de navegador.
// El borrador vive en localStorage y puede venir de esta versión, de una anterior o de
// escritura manual (ataque hostil). Nada de lo que entre debe romper el render ni el hook.

export const BORRADOR_VERSION = 2;
export const CLAVE_BORRADOR = "bia_borrador";
/** Tope defensivo: un texto de 5000 caracteres es legítimo; 1 MB en localStorage es basura hostil. */
export const MAX_TEXTO_BORRADOR = 20000;
export const MAX_ITEMS_BORRADOR = 60;

export type SobreBorrador = { v: number; guardadoEn: number; estado: unknown };

export type PreguntaBorrador = {
  campoKey: string;
  pregunta: string;
  ejemplo?: string;
  sugerencias?: string[];
  /**
   * El campo viene obligatorio en el catálogo. Sin esto el borrador no puede avisarle al
   * solicitante que le falta un dato obligatorio antes de enviar, y el coordinador recibe
   * un RFQ incompleto sin que nadie lo haya notado.
   */
  critica?: boolean;
};

export type CampoPlantillaBorrador = {
  campoKey: string;
  label: string;
  tipoDato: string;
  ayuda?: string;
  obligatorio: boolean;
  seccionPdf?: string;
};

/**
 * Forma canónica del borrador del solicitante (sin estado efímero de UI).
 * Los dos enums se parametrizan para que el hook los estreche a sus tipos de dominio.
 */
export type CamposBorradorSolicitud<
  Tipo extends string = string,
  Subtipo extends string = string,
> = {
  paso: number;
  maxAlcanzado: number;
  email: string;
  nombre: string;
  titulo: string;
  tipoNecesidad: string;
  subtipo: Subtipo;
  fechaRequerida: string;
  area: string;
  descripcion: string;
  clasificacion: Tipo;
  confianzaClasificacion: number;
  razonamientoBreve: string;
  clasificacionCorregida: boolean;
  llevaBranding: boolean;
  archivoLogo: string;
  assessmentPreguntas: PreguntaBorrador[];
  contextoInsuficiente: boolean;
  /**
   * Qué entendió el asistente de la solicitud y por qué pregunta lo que pregunta. Viaja en el
   * borrador para que el solicitante no se reencuentre con preguntas sin explicación al
   * retomar días después.
   */
  contextoInvestigado?: string;
  preguntasContexto: string[];
  camposPlantilla: CampoPlantillaBorrador[];
  assessmentRespuestas: Record<string, { valor: string; noSe: boolean }>;
  solicitudId: string | null;
  /**
   * Nonce del envío en curso: identifica UN intento de envío y viaja al servidor como clave
   * de idempotencia. Vive en el borrador (y no solo en memoria) porque un reintento tras un
   * timeout, un doble clic o un refresh en pleno envío tienen que reusar la MISMA clave, o
   * cada intento crea una solicitud nueva. Se regenera sola al empezar un borrador nuevo.
   */
  claveEnvio: string;
  coordinadorId: string;
};

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function texto(v: unknown, max = MAX_TEXTO_BORRADOR): string {
  if (typeof v === "string") return v.slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function booleano(v: unknown, porDefecto = false): boolean {
  return typeof v === "boolean" ? v : porDefecto;
}

function numero(v: unknown, min: number, max: number, porDefecto: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, n));
}

function enteroAcotado(v: unknown, min: number, max: number, porDefecto: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function lista(v: unknown, max = MAX_ITEMS_BORRADOR): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

/** Envuelve el estado para persistir versión + marca de tiempo (sobrevivive a la recarga). */
export function envolverBorrador(estado: unknown, guardadoEn: number = Date.now()): SobreBorrador {
  return { v: BORRADOR_VERSION, guardadoEn, estado };
}

/**
 * Lee un borrador de localStorage tolerando: sobre nuevo, objeto plano legado,
 * JSON inválido, array, null, string, otro schema y valores absurdos.
 * Devuelve null cuando no hay nada aprovechable.
 */
export function desenvolverBorrador(raw: string | null | undefined): {
  estado: Record<string, unknown>;
  guardadoEn: number | null;
  version: number | null;
} | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parseado: unknown;
  try {
    parseado = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!esObjeto(parseado)) return null;
  // Sobre actual: { v, guardadoEn, estado }
  if (esObjeto(parseado.estado)) {
    const guardadoEn = typeof parseado.guardadoEn === "number" && Number.isFinite(parseado.guardadoEn)
      ? parseado.guardadoEn
      : null;
    const version = typeof parseado.v === "number" ? parseado.v : null;
    return { estado: parseado.estado, guardadoEn, version };
  }
  // Legacy: el estado se guardaba plano (sin sobre).
  return { estado: parseado, guardadoEn: null, version: null };
}

/**
 * Proyecta un objeto arbitrario sobre la forma canónica del borrador.
 * Campo por campo: nada entra sin coerción, y un campo corrupto cae al valor base
 * en vez de propagar el error al render.
 */
export function sanearBorradorSolicitud<
  Tipo extends string = string,
  Subtipo extends string = string,
>(
  base: CamposBorradorSolicitud<Tipo, Subtipo>,
  raw: Record<string, unknown> | null | undefined
): CamposBorradorSolicitud<Tipo, Subtipo> {
  if (!raw) return base;
  // El piso del paso es 2: el paso 1 (identidad) se fusionó en el paso 2 y no tiene
  // pantalla. Sin este tope, un `paso: 1` escrito a mano caía en la rama de
  // confirmación del render y el solicitante veía "Tu solicitud fue enviada" (A11.2).
  const paso = enteroAcotado(raw.paso, 2, 6, base.paso);
  const preguntas = sanearPreguntas(raw.assessmentPreguntas);
  const plantilla = sanearCamposPlantilla(raw.camposPlantilla);
  return {
    paso,
    maxAlcanzado: enteroAcotado(raw.maxAlcanzado, paso, 6, Math.max(base.maxAlcanzado, paso)),
    email: texto(raw.email, 320).slice(0, 320),
    nombre: texto(raw.nombre, 200).slice(0, 200),
    titulo: texto(raw.titulo, 500).slice(0, 500),
    tipoNecesidad: texto(raw.tipoNecesidad, 80).slice(0, 80),
    subtipo: (texto(raw.subtipo, 20) || base.subtipo) as Subtipo,
    fechaRequerida: fechaISO(raw.fechaRequerida) ?? base.fechaRequerida,
    area: texto(raw.area, 200).slice(0, 200),
    descripcion: texto(raw.descripcion),
    clasificacion: ((["RFI", "RFQ", "RFP"] as string[]).includes(String(raw.clasificacion))
      ? raw.clasificacion
      : base.clasificacion) as Tipo,
    confianzaClasificacion: numero(raw.confianzaClasificacion, 0, 1, base.confianzaClasificacion),
    razonamientoBreve: texto(raw.razonamientoBreve, 600).slice(0, 600),
    clasificacionCorregida: booleano(raw.clasificacionCorregida, base.clasificacionCorregida),
    llevaBranding: booleano(raw.llevaBranding, base.llevaBranding),
    archivoLogo: texto(raw.archivoLogo, 260).slice(0, 260),
    assessmentPreguntas: preguntas,
    contextoInsuficiente: booleano(raw.contextoInsuficiente, false),
    contextoInvestigado: texto(raw.contextoInvestigado, 600).trim() || undefined,
    preguntasContexto: lista(raw.preguntasContexto, 20)
      .map((p) => texto(p, 400))
      .filter((p) => p.length > 0),
    camposPlantilla: plantilla,
    assessmentRespuestas: sanearRespuestas(raw.assessmentRespuestas),
    solicitudId: uuidOpcional(raw.solicitudId),
    claveEnvio: uuidOpcional(raw.claveEnvio) ?? "",
    coordinadorId: uuidOpcional(raw.coordinadorId) ?? "",
  };
}

/** Nonce de envío: uuid v4 si el navegador lo tiene, y un uuid v4-compatible si no. */
export function nuevaClaveEnvio(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Los correos no distinguen mayúsculas: `MJ@x.com` es el mismo buzón que `mj@x.com`. */
export function mismoCorreo(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Un borrador solo se restaura si pertenece a este correo y no está ya enviado.
 * La comparación del correo es insensible a mayúsculas y a espacios: con la comparación
 * exacta, el propio solicitante perdía su borrador por escribir `MJ.E2E@…` y, peor aún,
 * el autoguardado lo sobrescribía con el estado vacío (pérdida silenciosa, A11.1).
 */
export function borradorRestaurable(
  guardado: CamposBorradorSolicitud<string, string>,
  emailActual: string
): boolean {
  if (guardado.solicitudId !== null) return false;
  if (!mismoCorreo(guardado.email, emailActual)) return false;
  return Boolean(
    guardado.titulo.trim() || guardado.descripcion.trim() || guardado.area.trim() || guardado.nombre.trim()
  );
}

function fechaISO(v: unknown): string | null {
  const t = typeof v === "string" ? v.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOpcional(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return UUID_RE.test(t) ? t : null;
}

export function sanearPreguntas(v: unknown): PreguntaBorrador[] {
  const out: PreguntaBorrador[] = [];
  lista(v, 200).forEach((raw, i) => {
    if (!esObjeto(raw)) return;
    const pregunta = texto(raw.pregunta, 600).trim();
    if (!pregunta) return; // una pregunta sin texto no es una pregunta
    const campoKey = texto(raw.campoKey, 80).trim() || `pregunta_${i + 1}`;
    out.push({
      campoKey,
      pregunta,
      ejemplo: texto(raw.ejemplo, 200) || undefined,
      sugerencias: lista(raw.sugerencias, 12)
        .map((s) => texto(s, 120).trim())
        .filter((s) => s.length > 0),
      critica: raw.critica === true || undefined,
    });
  });
  return out;
}

function sanearCamposPlantilla(v: unknown): CampoPlantillaBorrador[] {
  const out: CampoPlantillaBorrador[] = [];
  lista(v, 60).forEach((raw, i) => {
    if (!esObjeto(raw)) return;
    const label = texto(raw.label, 200).trim();
    if (!label) return;
    out.push({
      campoKey: texto(raw.campoKey, 80).trim() || `campo_${i + 1}`,
      label,
      tipoDato: texto(raw.tipoDato, 40) || "texto",
      ayuda: texto(raw.ayuda, 300) || undefined,
      obligatorio: booleano(raw.obligatorio, false),
      seccionPdf: texto(raw.seccionPdf, 120) || undefined,
    });
  });
  return out;
}

function sanearRespuestas(v: unknown): Record<string, { valor: string; noSe: boolean }> {
  if (!esObjeto(v)) return {};
  const out: Record<string, { valor: string; noSe: boolean }> = {};
  let i = 0;
  for (const [k, raw] of Object.entries(v)) {
    if (i++ >= 200) break;
    const clave = k.slice(0, 80);
    if (!clave) continue;
    if (esObjeto(raw)) {
      out[clave] = { valor: texto(raw.valor, 1000).slice(0, 1000), noSe: booleano(raw.noSe, false) };
    } else {
      // Legacy: valor como string plano.
      out[clave] = { valor: texto(raw, 1000).slice(0, 1000), noSe: false };
    }
  }
  return out;
}
