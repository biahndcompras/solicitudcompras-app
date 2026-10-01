"use client";

// Hook del wizard del solicitante — usa la capa de dominio (cerebro) y persiste vía API.
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SubtipoSolicitud, TipoSolicitud } from "@/lib/domain/types";
import { bloqueoB2Activo } from "@/lib/domain/rules";
import { leerBorradorEmail, guardarBorradorEmail, limpiarBorrador, leerBorradorSeguro, escribirBorrador } from "@/lib/cookie";
import {
  sanearBorradorSolicitud,
  borradorRestaurable,
  nuevaClaveEnvio,
  type CamposBorradorSolicitud,
} from "@/lib/domain/borrador";
import { validarArchivoAdjunto, MAX_BYTES_ARCHIVO, type ResultadoValidacionArchivo } from "@/lib/domain/archivos";

export type PasoWizard = 1 | 2 | 3 | 4 | 5 | 6;

/** Fase real del envío: la UI nombra lo que está pasando en vez de un "Enviando…" mudo. */
export type FaseEnvio = "creando" | "archivo" | "enviando";

export type EstadoEnvio =
  | { estado: "inactivo" }
  | { estado: "enviando"; fase: FaseEnvio }
  | { estado: "ok"; referencia?: string }
  | { estado: "error"; mensaje: string };

/** Texto de la fase, en la voz del solicitante. Sin jerga: qué está haciendo el sistema. */
export const TEXTO_FASE_ENVIO: Record<FaseEnvio, string> = {
  creando: "Guardando tu solicitud…",
  archivo: "Subiendo el archivo de marca…",
  enviando: "Enviando a Compras…",
};

/**
 * Techos de espera del envío, en milisegundos. [MEDIDO] el trabajo real son 0.7–1.2 s
 * (crear) + 1–2.7 s (archivo) + ~1.1 s (documento) con el servidor ya compilado, así que
 * estos valores nunca se tocan en producción: son el colchón para el caso real de desarrollo
 * local, donde Next compila la ruta bajo demanda y el primer POST a /api/solicitudes llegó a
 * tardar 101 s. Con el techo anterior (30 s) ese caso moría y —peor— la fila quedaba creada
 * igual: el solicitante veía un error sobre un envío que sí ocurrió.
 */
const MS_CREAR = 120_000;
const MS_ARCHIVO = 90_000;
const MS_TRANSICION = 90_000;

/** Estado de la llamada al asistente. "error" es un estado de primera clase: nunca se
 *  disfraza de éxito (P1-d: antes un fallo marcaba assessmentListo y cero preguntas). */
export type EstadoAsistente = "inactivo" | "cargando" | "listo" | "error";

export type WizardState = Omit<
  CamposBorradorSolicitud<TipoSolicitud, SubtipoSolicitud>,
  "paso" | "maxAlcanzado"
> & {
  paso: PasoWizard;
  maxAlcanzado: PasoWizard;
  assessmentEstado: EstadoAsistente;
  assessmentError: string | null;
  clasificacionError: string | null;
  clasificacionFuente: "ia" | "sin-confianza" | "sin-respuesta";
};

export const ETIQUETAS_PASO: Record<number, string> = {
  1: "Identidad",
  2: "Captura Inicial",
  3: "Clasificación",
  4: "Detalles técnicos",
  5: "Documento",
  6: "Enviada",
};

/**
 * Marcapés de "ya decidí qué hacer con este borrador", con alcance de LA PÁGINA.
 * Antes vivía en sessionStorage, o sea que la decisión sobrevivía a toda la pestaña:
 * con el mismo `guardadoEn`, una visita posterior a `?nuevo=1` (que significa
 * "solicitud nueva") quedaba ignorada en silencio y devolvía al solicitante al
 * borrador viejo. En memoria de módulo, un reload vuelve a preguntar (la persona
 * puede no recordar qué eligió) y una navegación dentro de la misma página no.
 */
let decisionEnEstaPagina: number | null = null;

export type IdentidadUrl = { email?: string; nombre?: string; area?: string };

function baseVacia(identidad?: IdentidadUrl): WizardState {
  return {
    paso: 2,
    maxAlcanzado: 2,
    // La URL manda sobre la cookie: si el solicitante entra con ?email=otro, su identidad
    // es esa y el borrador de otro correo NO puede restaurarse.
    email: identidad?.email || leerBorradorEmail() || "",
    nombre: identidad?.nombre || "",
    titulo: "",
    tipoNecesidad: "",
    subtipo: "producto",
    fechaRequerida: "",
    area: identidad?.area || "",
    descripcion: "",
    clasificacion: "RFQ",
    confianzaClasificacion: 0.9,
    razonamientoBreve: "",
    clasificacionCorregida: false,
    llevaBranding: true,
    archivoLogo: "",
    assessmentPreguntas: [],
    contextoInsuficiente: false,
    contextoInvestigado: "",
    preguntasContexto: [],
    camposPlantilla: [],
    assessmentRespuestas: {},
    solicitudId: null,
    claveEnvio: nuevaClaveEnvio(),
    coordinadorId: "",
    assessmentEstado: "inactivo",
    assessmentError: null,
    clasificacionError: null,
    clasificacionFuente: "sin-respuesta",
  };
}

/** Acota un número a los pasos del wizard (lo que llega de localStorage puede ser 99).
 *  El piso es 2, no 1: el paso 1 (identidad) se fusionó dentro del paso 2 y no tiene
 *  pantalla propia. Un `paso: 1`-hostil caía en el `else` del render y mostraba
 *  "Tu solicitud fue enviada" (A11.2). */
function comoPaso(n: number): PasoWizard {
  return (Math.min(6, Math.max(2, Math.round(n))) as PasoWizard) || 2;
}

/**
 * Proyección explícita de lo que se persiste: TODO el contenido del paso (incluido el texto
 * largo de la descripción y las respuestas del assessment) y nada del estado efímero de UI.
 * Escribirla campo por campo evita que un estado nuevo se guarde sin querer.
 */
function aCamposPersistibles(
  estado: WizardState
): CamposBorradorSolicitud<TipoSolicitud, SubtipoSolicitud> {
  return {
    paso: estado.paso,
    maxAlcanzado: estado.maxAlcanzado,
    email: estado.email,
    nombre: estado.nombre,
    titulo: estado.titulo,
    tipoNecesidad: estado.tipoNecesidad,
    subtipo: estado.subtipo,
    fechaRequerida: estado.fechaRequerida,
    area: estado.area,
    descripcion: estado.descripcion,
    clasificacion: estado.clasificacion,
    confianzaClasificacion: estado.confianzaClasificacion,
    razonamientoBreve: estado.razonamientoBreve,
    clasificacionCorregida: estado.clasificacionCorregida,
    llevaBranding: estado.llevaBranding,
    archivoLogo: estado.archivoLogo,
    assessmentPreguntas: estado.assessmentPreguntas,
    contextoInsuficiente: estado.contextoInsuficiente,
    contextoInvestigado: estado.contextoInvestigado,
    preguntasContexto: estado.preguntasContexto,
    camposPlantilla: estado.camposPlantilla,
    assessmentRespuestas: estado.assessmentRespuestas,
    solicitudId: estado.solicitudId,
    claveEnvio: estado.claveEnvio,
    coordinadorId: estado.coordinadorId,
  };
}

type ResultadoInicial = {
  estado: WizardState;
  guardadoEn: number | null;
  descartarPropuesto: boolean;
  /** El primer render NO puede depender de localStorage: el servidor no lo ve y React
   *  reporta hydration mismatch. Por eso el borrador se aplica tras montar. */
  restaurar: boolean;
};

/**
 * Arranque del wizard. Reglas:
 *  1. Un borrador guardado NUNCA se ignora por `?nuevo=1` (antes sí: recargar la URL
 *     borraba todo lo escrito en silencio).
 *  2. Solo se restaura si es del mismo correo y no está ya enviada.
 *  3. Si venía pidiendo "nueva" y hay un borrador retomable, se propone decidir
 *     (retomar / empezar de cero) en vez de descartar en silencio.
 *  4. Un borrador corrupto o de otro schema se sanea; nunca rompe el render.
 */
export function estadoInicialWizard(nuevo: boolean, identidad?: IdentidadUrl): ResultadoInicial {
  const base = baseVacia(identidad);
  const crudo = leerBorradorSeguro();
  if (!crudo) return { estado: base, guardadoEn: null, descartarPropuesto: false, restaurar: false };

  const saneado = sanearBorradorSolicitud<TipoSolicitud, SubtipoSolicitud>(aCamposPersistibles(base), crudo.estado);
  // La identidad (correo/nombre/área) viene de la URL/cookie; el contenido capturado, del
  // borrador. `solicitudId` nunca se restaura (una solicitud ya enviada no se reenvía).
  // `claveEnvio` sí se restaura y de hecho es lo que hace útil restaurarla: es la clave de
  // idempotencia que ata un reintento a la fila que ya se creó. Un borrador viejo (sin la
  // clave) recibe una nueva en vez de enviar sin idempotencia.
  const conIdentidad: WizardState = {
    ...base,
    ...saneado,
    paso: comoPaso(saneado.paso),
    maxAlcanzado: comoPaso(saneado.maxAlcanzado),
    email: base.email,
    nombre: base.nombre || saneado.nombre,
    area: base.area || saneado.area,
    solicitudId: null,
    claveEnvio: saneado.claveEnvio || base.claveEnvio,
  };
  if (!borradorRestaurable(saneado, conIdentidad.email)) {
    return { estado: conIdentidad, guardadoEn: crudo.guardadoEn, descartarPropuesto: false, restaurar: false };
  }
  if (!nuevo) {
    return { estado: conIdentidad, guardadoEn: crudo.guardadoEn, descartarPropuesto: false, restaurar: true };
  }
  // `?nuevo=1` con borrador retomable: preguntar, salvo que ya se haya decidido en esta
  // misma carga de página.
  if (decisionEnEstaPagina === crudo.guardadoEn) {
    return { estado: conIdentidad, guardadoEn: crudo.guardadoEn, descartarPropuesto: false, restaurar: true };
  }
  return { estado: conIdentidad, guardadoEn: crudo.guardadoEn, descartarPropuesto: true, restaurar: true };
}

function marcarDecisionEnPagina(guardadoEn: number | null): void {
  decisionEnEstaPagina = guardadoEn;
}

export type CoordinadorPublico = { id: string; nombre: string; categorias: string[] };

const ERROR_CONEXION =
  "No pudimos conectarnos con el servidor. Revisá tu conexión a internet e intentá de nuevo.";

/**
 * Traduce fallos técnicos (fetch, red, timeout) a un mensaje que no culpa al usuario.
 * Regla: al solicitante solo se le muestra texto que parece una frase escrita para una
 * persona. Cualquier cosa que parezca un error de servidor crudo ("boom", "Error:
 * connect ECONNREFUSED …", "OPENROUTER_API_KEY no configurada", "HTTP 500") se
 * reemplaza por el mensaje por defecto: antes se filtraba infra al solicitante (A5.2).
 */
export function mensajeErrorAmigable(e: unknown, porDefecto: string): string {
  const crudo = e instanceof Error ? e.message : String(e ?? "");
  if (!crudo) return porDefecto;
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(crudo)) {
    return ERROR_CONEXION;
  }
  if (/aborted|timeout|timed out|etimedout/i.test(crudo)) {
    return "La solicitud tardó demasiado. Intentá de nuevo en un momento.";
  }
  if (!esFraseParaPersona(crudo)) return porDefecto;
  return crudo;
}

/** ¿El texto parece una frase humana destined al solicitante y no un error de servidor? */
function esFraseParaPersona(s: string): boolean {
  const t = s.trim();
  if (t.length < 12 || t.length > 220) return false;
  if (!/^[A-ZÁÉÍÓÚÑ¿¡"]/.test(t)) return false; // las frases empiezan en mayúscula
  if (!/\s/.test(t)) return false; // "boom", "HTTP500": no son frases
  if (/\n/.test(t)) return false;
  // Marcadores técnicos: stack, rutas, códigos, identificadores o cláusulas de infra.
  if (
    /\b(HTTP|ECONN|ETIMEDOUT|ENOENT|SQL|SELECT|INSERT|UPDATE|DELETE FROM|Traceback|undefined|NaN|null)\b/i.test(t) ||
    /\w*(error|exception)\s*:/i.test(t) || // "TypeError:", "Error:", "MyException:"
    /(\/api\/|\/node_modules\/|\.tsx?:|\.js?:)/.test(t) ||
    /[{}[\]<>`|\\]/.test(t) ||
    /\b0x[0-9a-f]+\b/i.test(t) ||
    /\b[A-Za-z_$][\w$]*\s*\(/.test(t) || // llamada a función
    /[A-Z_]{3,}_[A-Z_]{2,}/.test(t) || // CONSTANTE_UPPER
    /\d{3,}/.test(t) // códigos largos: "Error 500", timestamps
  ) {
    return false;
  }
  return true;
}

/**
 * Techo de espera que ABORTA la petición en vez de solo dejar de esperarla.
 * Antes solo hacía `reject`: el fetch seguía vivo, el servidor seguía trabajando y la fila se
 * creaba igual. Eso convertía cada timeout en datos huérfanos y hacía que un reintento
 * duplicara la solicitud. La clave de idempotencia es la segunda mitad de la garantía (por si
 * el servidor ya había INSERTado cuando llega el abort); abortar es la primera.
 *
 * Exportada para poder probar el abort sin esperar 120 s de reloj: es el mecanismo que
 * sostiene la primera mitad del arreglo del envío.
 */
export function conTimeout<T>(
  iniciar: (signal: AbortSignal) => Promise<T>,
  ms: number,
  mensaje: string
): Promise<T> {
  const control = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      control.abort();
      reject(new Error(mensaje));
    }, ms);
    iniciar(control.signal).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function useSolicitudWizard(nuevo = false, identidad?: IdentidadUrl) {
  const router = useRouter();
  const inicialRef = useRef<ResultadoInicial | null>(null);
  // Primer render idéntico al del servidor (solo la cookie, que el servidor también ve).
  const [estado, setEstado] = useState<WizardState>(() => baseVacia(identidad));
  const [envio, setEnvio] = useState<EstadoEnvio>({ estado: "inactivo" });
  const [borradoAt, setBorradoAt] = useState<number | null>(null);
  /** ¿Se pudo escribir de verdad el borrador en este navegador? */
  const [persistenciaOk, setPersistenciaOk] = useState(true);
  /** ¿La persona llegó a tocar algo? Solo entonces se autoriza sobrescribir el borrador. */
  const sucioRef = useRef(false);
  /**
   * ¿Hay un envío en vuelo? Va en un ref y no en el estado porque el estado solo refleja el
   * click anterior: entre el click y el re-render hay una ventana en la que un segundo click
   * (o un Enter sobre el botón) entra igual y arranca un envío paralelo.
   */
  const enviandoRef = useRef(false);
  const marcarSucio = useCallback(() => {
    sucioRef.current = true;
  }, []);
  const [clasificandoIA, setClasificandoIA] = useState(false);
  const [evaluandoAssessment, setEvaluandoAssessment] = useState(false);
  const [coordinadores, setCoordinadores] = useState<CoordinadorPublico[]>([]);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [pendienteBorrador, setPendienteBorrador] = useState<{
    guardadoEn: number | null;
    resumen: string;
  } | null>(null);

  // Tras montar: leemos localStorage y aplicamos el borrador. Antes esto corría en el
  // inicializador del estado y provocaba hydration mismatch en cada recarga con borrador.
  useEffect(() => {
    if (inicialRef.current !== null) return;
    const r = estadoInicialWizard(nuevo, identidad);
    inicialRef.current = r;
    if (r.restaurar) {
      setEstado(r.estado);
      setBorradoAt(r.guardadoEn);
    }
    if (r.descartarPropuesto) {
      setPendienteBorrador({ guardadoEn: r.guardadoEn, resumen: resumenBorrador(r.estado) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // H2: archivo real del logo (File vive en memoria; solo el nombre se persiste en el borrador).
  const archivoLogoFileRef = useRef<File | null>(null);
  const setArchivoLogoFile = useCallback((f: File | null) => {
    archivoLogoFileRef.current = f;
  }, []);

  // Cargar compradores disponibles y preseleccionar por categoría al llegar al paso de documento.
  useEffect(() => {
    if (estado.paso !== 5) return;
    let activo = true;
    (async () => {
      try {
        const { api } = await import("@/lib/api-client");
        const lista = await api.listarCoordinadoresPublicos();
        if (!activo) return;
        setCoordinadores(lista);
        if (!estado.coordinadorId) {
          const porCategoria = lista.filter((c) => c.categorias.includes(estado.tipoNecesidad));
          const sugerido = porCategoria[0] ?? lista[0];
          if (sugerido) setEstado((s) => ({ ...s, coordinadorId: sugerido.id }));
        }
      } catch {
        if (activo) setCoordinadores([]);
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.paso]);

  // Autoguarda TODO el estado del paso (incluido el texto largo) en cada cambio, y también
  // actualiza la marca de tiempo que sostiene el "Borrador activo" del rail. Si la
  // escritura falla (cuota llena, modo privado) se dice: mejor un aviso que un "Borrador
  // activo" que miente (P0-2 / A11.3).
  //
  // Solo se escribe si la persona TOCÓ algo (`sucioRef`). Sin esta condición, montar el
  // wizard guardaba el estado vacío encima del borrador guardado: el de otra persona, el
  // ya enviado o el corrupto quedaban destruidos en silencio al solo abrir la página
  // (A11.1). Y si no hay nada que guardar, se borra el sobre viejo en vez de dejar un
  // borrador resurrected que vuelve con contenido que la persona ya borró.
  useEffect(() => {
    if (estado.paso >= 6 || !sucioRef.current) return;
    if (!tieneContenidoPersistible(estado)) {
      limpiarBorrador();
      setBorradoAt(null);
      setPersistenciaOk(true);
      return;
    }
    const ok = escribirBorrador(aCamposPersistibles(estado));
    setPersistenciaOk(ok);
    if (ok) setBorradoAt(Date.now());
  }, [estado]);

  const siguiente = useCallback(() => {
    marcarSucio();
    setEstado((s) => {
      const paso = Math.min(6, s.paso + 1) as PasoWizard;
      guardarBorradorEmail(s.email);
      return { ...s, paso, maxAlcanzado: Math.max(s.maxAlcanzado, paso) as PasoWizard };
    });
  }, []);

  // Clasificación IA del solicitante (P2→P3). Llamada server-side vía API.
  const clasificarIA = useCallback(async () => {
    marcarSucio();
    setClasificandoIA(true);
    try {
      const { api } = await import("@/lib/api-client");
      const res = await conTimeout(
        (signal) =>
          api.clasificarIA(
            {
              titulo: estado.titulo,
              descripcion: estado.descripcion,
              categoria: estado.tipoNecesidad,
            },
            { signal }
          ),
        45000,
        "La clasificación tardó demasiado"
      );
      if (res && res.confianza >= 0.7) {
        setEstado((s) => ({
          ...s,
          clasificacion: res.tipo ?? "RFQ",
          subtipo: res.subtipo ?? "producto",
          confianzaClasificacion: res.confianza,
          razonamientoBreve: res.razonamiento_breve,
          clasificacionError: null,
          clasificacionFuente: "ia",
        }));
      } else if (res) {
        // Respuesta válida pero poco segura: sin preselección (confianza 0 = "no sugiero
        // nada") y SIN culpar al solicitante. La fuente distingue este caso de un fallo.
        setEstado((s) => ({
          ...s,
          confianzaClasificacion: 0,
          clasificacionError: null,
          clasificacionFuente: "sin-confianza",
        }));
      } else {
        // null = el servidor no pudo clasificar (IA no disponible / entrada inválida).
        setEstado((s) => ({
          ...s,
          confianzaClasificacion: 0,
          clasificacionError: "El asistente automático no está disponible en este momento.",
          clasificacionFuente: "sin-respuesta",
        }));
      }
    } catch (e) {
      setEstado((s) => ({
        ...s,
        confianzaClasificacion: 0,
        clasificacionError: mensajeErrorAmigable(e, "El asistente automático no respondió."),
        clasificacionFuente: "sin-respuesta",
      }));
    } finally {
      setClasificandoIA(false);
    }
  }, [estado.titulo, estado.descripcion, estado.tipoNecesidad]);

  // Assessment IA del solicitante (P3→P4). Llamada server-side vía API.
  // `opts.descripcion` permite re-evaluar con una descripción ampliada (F2: más contexto).
  const evaluarAssessment = useCallback(async (opts?: { descripcion?: string }) => {
    const descripcion = opts?.descripcion ?? estado.descripcion;
    marcarSucio();
    setEvaluandoAssessment(true);
    setEstado((s) => ({ ...s, assessmentEstado: "cargando", assessmentError: null }));
    try {
      const { api } = await import("@/lib/api-client");
      const catalogo: import("@/lib/domain/types").CampoCatalogo[] = [];
      const res = await conTimeout(
        (signal) =>
          api.assessmentIA(
            {
              titulo: estado.titulo,
              descripcion,
              tipo: estado.clasificacion,
              subtipo: estado.subtipo,
              categoria: estado.tipoNecesidad,
              camposCapturados: [
                { campoKey: "titulo", valor: estado.titulo },
                { campoKey: "descripcion", valor: descripcion },
                { campoKey: "tipoNecesidad", valor: estado.tipoNecesidad },
              ],
              catalogo,
              llevaBranding: estado.llevaBranding,
              archivoLogo: estado.archivoLogo,
            },
            { signal }
          ),
        60000,
        "El asistente tardó demasiado en responder"
      );
      // El mapeo ocurre FUERA del setEstado: si la respuesta viene malformada, el error cae
      // en este try (antes reventaba en el render y dejaba la pantalla en blanco).
      if (!res || !Array.isArray(res.preguntas)) {
        throw new Error("El asistente devolvió una respuesta incompleta");
      }
      const { sanearPreguntas } = await import("@/lib/domain/borrador");
      const preguntas = sanearPreguntas(res.preguntas);
      const plantilla = Array.isArray(res.camposPlantilla) ? res.camposPlantilla : [];
      setEstado((s) => ({
        ...s,
        descripcion,
        assessmentPreguntas: preguntas,
        camposPlantilla: plantilla,
        assessmentEstado: "listo",
        assessmentError: null,
        contextoInsuficiente: res.contexto_insuficiente ?? false,
        contextoInvestigado: typeof res.contexto_investigado === "string" ? res.contexto_investigado : "",
        preguntasContexto: Array.isArray(res.preguntas_contexto) ? res.preguntas_contexto : [],
      }));
    } catch (e) {
      // Fallo real: estado de error explícito + reintento. NO se marca "listo".
      setEstado((s) => ({
        ...s,
        descripcion,
        assessmentEstado: "error",
        assessmentError: mensajeErrorAmigable(
          e,
          "El asistente no pudo preparar las preguntas en este momento."
        ),
      }));
    } finally {
      setEvaluandoAssessment(false);
    }
  }, [estado.titulo, estado.descripcion, estado.tipoNecesidad, estado.clasificacion, estado.subtipo, estado.llevaBranding, estado.archivoLogo]);

  // F2: el solicitante amplía la descripción y re-ejecuta el assessment.
  const reintentarConContexto = useCallback(async (extra: string) => {
    const ampliada = `${estado.descripcion ? estado.descripcion.trim() + "\n" : ""}${extra.trim()}`;
    marcarSucio();
    setEstado((s) => ({ ...s, contextoInsuficiente: false, preguntasContexto: [] }));
    await evaluarAssessment({ descripcion: ampliada });
  }, [estado.descripcion, evaluarAssessment]);

  // Persiste la solicitud al pasar del paso 5 (documento) al 6 (confirmación).
  //
  // Tres llamadas encadenadas, y las tres importan:
  //  1. Idempotencia por `claveEnvio` (persistida en el borrador). Un doble clic, un reintento
  //     tras un timeout o un refresh a mitad de envío reusan la misma clave, así que el
  //     servidor devuelve la fila que ya existía en vez de crear otra. Sin esto, cada intento
  //     fallido dejaba un BORRADOR huérfano invisible en la bandeja del coordinador.
  //  2. Guardia de reentrada con un ref, no con el estado de React: entre el click y el
  //     re-render hay una ventana en la que un segundo click entra igual.
  //  3. `conTimeout` aborta de verdad la petición, y las fases se nombran para que la
  //     pantalla diga qué está pasando en vez de un "Enviando..." de 30 s a oscuras.
  const enviarSolicitud = useCallback(async () => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    // Un borrador escrito por una versión anterior no trae clave: se genera una en el acto y
    // se mete al estado (no a una variable local) para que el autoguardado la persista. Si
    // viviera solo en esta llamada, un refresh tras el fallo generaría otra y la idempotencia
    // se perdería justo en el caso para el que existe.
    const claveEnvio = estado.claveEnvio || nuevaClaveEnvio();
    if (claveEnvio !== estado.claveEnvio) {
      marcarSucio();
      setEstado((s) => ({ ...s, claveEnvio }));
    }
    setEnvio({ estado: "enviando", fase: "creando" });
    try {
      const { api } = await import("@/lib/api-client");
      const creada = await conTimeout(
        (signal) =>
          api.crearSolicitud(
            {
              titulo: estado.titulo,
              solicitanteEmail: estado.email,
              solicitanteNombre: estado.nombre || "Colaborador",
              areaSolicitante: estado.area,
              descripcion: estado.descripcion,
              categoria: estado.tipoNecesidad,
              // Persistir la clasificación (antes se perdía: el sidebar y las métricas
              // de distribución por tipo quedaban vacíos).
              tipo: estado.clasificacion,
              subtipo: estado.subtipo,
              fechaRequerida: estado.fechaRequerida,
              idempotencyKey: claveEnvio,
            },
            { signal }
          ),
        MS_CREAR,
        "El envío tardó demasiado"
      );
      // H2: subir el logo/archivo real del producto (si el solicitante lo adjuntó).
      if (archivoLogoFileRef.current) {
        setEnvio({ estado: "enviando", fase: "archivo" });
        await conTimeout(
          (signal) => api.subirArchivoLogo(creada.id, archivoLogoFileRef.current!, { signal }),
          MS_ARCHIVO,
          "El archivo tardó demasiado en subir"
        );
      }
      setEnvio({ estado: "enviando", fase: "enviando" });
      const transicion = await conTimeout(
        (signal) =>
          api.transicionar(
            {
              solicitudId: creada.id,
              hacia: "ENVIADA_A_COMPRAS",
              actorTipo: "solicitante",
              actorIdentificador: estado.email,
              nota: "Solicitud completada por el solicitante",
              coordinadorId: estado.coordinadorId || undefined,
              respuestas: {
                titulo: estado.titulo,
                tipoNecesidad: estado.tipoNecesidad,
                fechaRequerida: estado.fechaRequerida,
                descripcion: estado.descripcion,
                subtipo: estado.subtipo,
                llevaBranding: String(estado.llevaBranding),
                archivoLogo: estado.archivoLogo,
                ...Object.fromEntries(
                  Object.entries(estado.assessmentRespuestas).map(([k, v]) => [
                    `assessment_${k}`,
                    v.noSe ? "(no lo sé)" : (v.valor || ""),
                  ])
                ),
              },
            },
            { signal }
          ),
        MS_TRANSICION,
        "El registro de la solicitud tardó demasiado"
      );
      // La referencia real se genera en la transición a ENVIADA_A_COMPRAS, no al crear.
      setEnvio({ estado: "ok", referencia: transicion.solicitud.numeroReferencia });
      limpiarBorrador();
      setEstado((s) => ({ ...s, paso: 6, maxAlcanzado: 6, solicitudId: creada.id }));
    } catch (e) {
      setEnvio({
        estado: "error",
        mensaje: mensajeErrorAmigable(e, "No se pudo enviar la solicitud. Intentá de nuevo."),
      });
    } finally {
      enviandoRef.current = false;
    }
  }, [estado, marcarSucio]);

  const anterior = useCallback(() => {
    // Piso 2: el paso 1 (identidad) ya no tiene pantalla propia (A11.2).
    marcarSucio();
    setEstado((s) => ({ ...s, paso: Math.max(2, s.paso - 1) as PasoWizard }));
  }, []);

  const irA = useCallback((paso: PasoWizard) => {
    marcarSucio();
    setEstado((s) => (paso <= s.maxAlcanzado ? { ...s, paso } : s));
  }, []);

  const set = useCallback(
    <K extends keyof WizardState>(key: K, valor: WizardState[K]) => {
      marcarSucio();
      setEstado((s) => ({ ...s, [key]: valor }));
    },
    [marcarSucio]
  );

  const pasoValido = useMemo(() => {
    const s = estado;
    switch (s.paso) {
      case 1:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim());
      case 2:
        return Boolean(s.titulo.trim() && s.tipoNecesidad && s.fechaRequerida && s.area.trim());
      case 3:
        return true;
      case 4:
        // B2: branding sin logo bloquea (RN-03)
        return !bloqueoB2Activo({ llevaBranding: s.llevaBranding, archivoLogo: s.archivoLogo });
      case 5:
        return true;
      case 6:
        return true;
    }
  }, [estado]);

  /** Campos que faltan para poder avanzar: el motivo del botón deshabilitado, dicho en claro. */
  const faltantes = useMemo(() => {
    const s = estado;
    if (s.paso === 2) {
      const out: string[] = [];
      if (!s.titulo.trim()) out.push("el título");
      if (!s.tipoNecesidad) out.push("el tipo de necesidad");
      if (!s.fechaRequerida) out.push("la fecha requerida");
      if (!s.area.trim()) out.push("tu área");
      return out;
    }
    if (s.paso === 4 && bloqueoB2Activo({ llevaBranding: s.llevaBranding, archivoLogo: s.archivoLogo })) {
      return ["el archivo de marca (obligatorio porque la solicitud lleva branding)"];
    }
    return [];
  }, [estado]);

  const guardarBorradorActual = useCallback(() => {
    const ahora = Date.now();
    const ok = escribirBorrador(aCamposPersistibles(estado), ahora);
    setPersistenciaOk(ok);
    if (ok) setBorradoAt(ahora);
  }, [estado]);

  const cancelar = useCallback(() => {
    limpiarBorrador();
    router.push("/");
  }, [router]);

  /* ---------- archivo del logo con validación ---------- */
  const elegirArchivoLogo = useCallback(async (archivo: File | null) => {
    setErrorArchivo(null);
    if (!archivo) {
      archivoLogoFileRef.current = null;
      marcarSucio();
      setEstado((s) => ({ ...s, archivoLogo: "" }));
      return { ok: false, motivo: "vacio", mensaje: "" };
    }
    // Leemos el contenido para no aceptar un archivo renombrado (o un PDF corrupto).
    let contenido: ArrayBuffer | undefined;
    if (archivo.size <= MAX_BYTES_ARCHIVO) {
      contenido = await archivo.arrayBuffer().catch(() => undefined);
    }
    const res = validarArchivoAdjunto(archivo, contenido);
    if (!res.ok) {
      archivoLogoFileRef.current = null;
      setEstado((s) => ({ ...s, archivoLogo: "" }));
      setErrorArchivo(res.mensaje);
      return res;
    }
    archivoLogoFileRef.current = archivo;
    marcarSucio();
    setEstado((s) => ({ ...s, archivoLogo: archivo.name }));
    return { ok: true as const };
  }, [marcarSucio]);

  /* ---------- decisión sobre el borrador previo ---------- */
  const retomarBorrador = useCallback(() => {
    marcarDecisionEnPagina(inicialRef.current?.guardadoEn ?? null);
    setPendienteBorrador(null);
  }, []);

  const descartarBorrador = useCallback(() => {
    marcarDecisionEnPagina(inicialRef.current?.guardadoEn ?? null);
    limpiarBorrador();
    // Conserva la identidad que llegó por la URL o por la cookie: descartando el borrador
    // no se descarta quién es la persona (si no, había que volver a escribir nombre y área).
    const base = baseVacia(identidad);
    marcarSucio();
    setEstado(base);
    setBorradoAt(null);
    setPersistenciaOk(true);
    setPendienteBorrador(null);
  }, [identidad]);

  /**
   * Datos que el catálogo marca obligatorios y que el solicitante dejó sin responder. Se
   * calcula, no se bloquea: el aviso al enviar es la frontera de decisión humana — el
   * solicitante sabe cosas que el catálogo no (una fecha se negocia, un pago se coordina
   * con Tesorería) y forzarlo convertiría el formulario en un muro.
   *
   * "No lo sé" NO cuenta como respuesta: para el coordinador el dato sigue faltando, y lo
   * único que cambia es que ahora el RFQ lo declara en vez de callarlo.
   */
  const obligatoriosPendientes = useMemo(() => {
    const s = estado;
    const respondida = (clave: string) => Boolean(s.assessmentRespuestas[clave]?.valor?.trim());
    const dePreguntas = s.assessmentPreguntas
      .filter((q) => q.critica && !respondida(q.campoKey))
      .map((q) => ({ campoKey: q.campoKey, etiqueta: q.pregunta, noSe: Boolean(s.assessmentRespuestas[q.campoKey]?.noSe) }));
    const dePlantilla = (s.camposPlantilla ?? [])
      .filter((c) => c.obligatorio && !respondida(c.campoKey))
      .map((c) => ({ campoKey: c.campoKey, etiqueta: c.label, noSe: Boolean(s.assessmentRespuestas[c.campoKey]?.noSe) }));
    const vistos = new Set<string>();
    return [...dePreguntas, ...dePlantilla].filter((p) => (vistos.has(p.campoKey) ? false : (vistos.add(p.campoKey), true)));
  }, [estado]);

  return {
    estado,
    siguiente,
    anterior,
    irA,
    set,
    pasoValido,
    faltantes,
    obligatoriosPendientes,
    envio,
    enviarSolicitud,
    clasificandoIA,
    clasificarIA,
    evaluandoAssessment,
    evaluarAssessment,
    reintentarConContexto,
    coordinadores,
    setArchivoLogoFile,
    elegirArchivoLogo,
    errorArchivo,
    limpiarErrorArchivo: () => setErrorArchivo(null),
    guardarBorrador: guardarBorradorActual,
    cancelar,
    borradoAt,
    persistenciaOk,
    pendienteBorrador,
    retomarBorrador,
    descartarBorrador,
  };
}

function resumenBorrador(e: WizardState): string {
  const partes: string[] = [];
  if (e.titulo.trim()) partes.push(`«${e.titulo.trim().slice(0, 60)}»`);
  if (e.paso >= 3) partes.push("llegaste a clasificación");
  else if (e.paso >= 2) partes.push("completaste la captura");
  return partes.join(" · ") || "sin datos capturados";
}

/**
 * ¿Hay algo que valga la pena guardar? Solo contenido capturado de la solicitud: nombre y
 * área solos NO cuentan. Si contaran, "Empezar de cero" (que conserva la identidad) volvía
 * a escribir un borrador y la siguiente visita lo daba por restaurable, saltándose el
 * pedido de identidad del deep link. Con esta regla, sin contenido no se escribe nada: un
 * `bia_borrador` vacío haría que la UI dijera "Borrador activo" sobre un formulario vacío.
 */
function tieneContenidoPersistible(e: WizardState): boolean {
  return Boolean(
    e.titulo.trim() ||
      e.descripcion.trim() ||
      e.tipoNecesidad ||
      e.fechaRequerida ||
      e.archivoLogo ||
      e.assessmentPreguntas.length > 0 ||
      e.camposPlantilla.length > 0 ||
      Object.keys(e.assessmentRespuestas).length > 0
  );
}
