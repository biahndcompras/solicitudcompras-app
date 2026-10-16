import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";
import { ESTADOS_SOLICITUD, type EstadoSolicitud, type Solicitud } from "@/lib/domain/types";

const repo = new PostgresRepositorio();

// La bandeja del coordinador solo debe mostrar solicitudes ya enviadas a Compras.
// Cualquier estado previo a `ENVIADA_A_COMPRAS` es trabajo en curso del solicitante:
// no tiene categoría asignada, no se puede cotizar ni comparar, y en el panel se veía
// como "gestión sana" que nunca avanza. Se excluye en la API (no en la UI) para que
// ningún cliente — panel, export o integración — pueda leer un borrador ajeno (P1-3).
// El conjunto se deriva del orden del ciclo de vida en `ESTADOS_SOLICITUD`, así que un
// estado nuevo insertado antes de `ENVIADA_A_COMPRAS` se excluye solo (hoy: BORRADOR).
const ESTADOS_PRE_ENVIO: EstadoSolicitud[] = ESTADOS_SOLICITUD.slice(
  0,
  ESTADOS_SOLICITUD.indexOf("ENVIADA_A_COMPRAS")
);

function soloEnviadasACompras(solicitudes: Solicitud[]): Solicitud[] {
  return solicitudes.filter((s) => !ESTADOS_PRE_ENVIO.includes(s.estado));
}

// Topes en el límite público: el cliente los aplica, pero esta API es abierta y sin
// sesión (ver POST), así que el techo se vuelve a validar en el servidor para que nadie
// pueda meter un título de 1 MB o un cuerpo enorme.
const MAX_TITULO = 200;
const MAX_NOMBRE = 200;
const MAX_AREA = 200;
const MAX_DESCRIPCION = 5000;
/** La clave de idempotencia es un UUID del cliente; 64 chars es holgado y no abre la puerta a un payload libre. */
const MAX_CLAVE_IDEMPOTENCIA = 64;
const CLAVE_IDEMPOTENCIA_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** La fecha viaja como "YYYY-MM-DD" desde el `<input type="date">` del wizard. */
const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hoy en "YYYY-MM-DD" según el día de calendario del negocio (Honduras), no el del servidor.
 * Si se usara la fecha del servidor (UTC en el despliegue), una solicitud creada por la noche
 * en Honduras —que para el usuario es "hoy"— ya sería "ayer" para el servidor y se rechazaría
 * sin motivo. El offset fijo sería frágil; el formato por zona horaria es determinista.
 */
function hoyISO(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function esFechaPasada(valor: string): boolean {
  return valor < hoyISO();
}

const crearSchema = z.object({
  titulo: z.string().min(1).max(MAX_TITULO),
  solicitanteEmail: z.string().email().max(320),
  solicitanteNombre: z.string().min(1).max(MAX_NOMBRE),
  areaSolicitante: z.string().max(MAX_AREA).optional(),
  // Obligatoria: la doc la marca así y sin ella la IA no puede clasificar bien. Se rechaza
  // el vacío real (solo espacios) después de recortar, no solo la ausencia.
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria: sin ella el asistente no puede clasificar bien la solicitud.")
    .max(MAX_DESCRIPCION),
  categoria: z.string().max(80).optional(),
  tipo: z.enum(["RFI", "RFQ", "RFP"]).optional(),
  subtipo: z.enum(["producto", "servicio", "mixto"]).optional(),
  // RN-04 / 4.7.7: el solicitante corrigió el tipo sugerido por la IA. Opcional (los
  // clientes viejos no lo mandan → default false en la columna), pero si viene hay que
  // persistirlo: es el insumo de la métrica de precisión del clasificador (doc 16).
  clasificacionCorregida: z.boolean().optional(),
  // No admite fechas pasadas: una solicitud no puede vencer antes de existir.
  fechaRequerida: z
    .string()
    .regex(FECHA_ISO_RE, "La fecha requerida debe tener el formato AAAA-MM-DD.")
    .refine((v) => !esFechaPasada(v), {
      message: "La fecha requerida no puede ser anterior a hoy. Elija hoy o una fecha futura.",
    })
    .optional(),
  // Opcional y sin efecto si no viene: la API pública no exige idempotencia, la aprovecha
  // cuando el cliente la manda. Un valor con forma rara se ignora en vez de rechazar el envío.
  idempotencyKey: z.string().max(MAX_CLAVE_IDEMPOTENCIA).optional(),
});

export async function POST(request: Request) {
  try {
    const body = crearSchema.parse(await request.json());
    const clave = body.idempotencyKey ?? "";
    // RF-55 (4.4.1): se registra la plantilla de origen (y con ella su versión). Se resuelve
    // acá, en el servidor, y no viaja desde el cliente: el wizard podría mentir sobre qué
    // plantilla usó, y el POST ya tiene los tres datos que la determinan. Si no hay plantilla
    // para esa combinación, `plantillaId` queda NULL — la solicitud es válida igual.
    const plantilla =
      body.tipo && body.subtipo
        ? await repo.obtenerPlantillaPara(
            body.tipo,
            body.subtipo,
            body.categoria || undefined
          )
        : null;
    const solicitud = await repo.crearSolicitud(
      {
        titulo: body.titulo,
        solicitanteEmail: body.solicitanteEmail,
        solicitanteNombre: body.solicitanteNombre,
        estado: "BORRADOR",
      },
      {
        areaSolicitante: body.areaSolicitante,
        descripcion: body.descripcion,
        categoria: body.categoria,
        tipo: body.tipo,
        subtipo: body.subtipo,
        fechaRequerida: body.fechaRequerida,
        clasificacionCorregida: body.clasificacionCorregida,
        idempotencyKey: CLAVE_IDEMPOTENCIA_RE.test(clave) ? clave : undefined,
        plantillaId: plantilla?.id,
      }
    );
    return NextResponse.json(solicitud, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Error interno al crear la solicitud" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coordinadorId = searchParams.get("coordinadorId");
  // El listado de solicitudes es interno: todos exige admin, por coordinador exige
  // coordinador/admin. La creación (POST) y mis-solicitudes quedan públicos.
  const auth = await guardApi(coordinadorId === "all" ? ["admin"] : ["coordinador", "admin"]);
  if (auth.negada) return auth.negada;
  try {
    if (coordinadorId === "all") {
      // Admin: vista de proceso completo, incluye borradores (los necesita para operar).
      const todas = await repo.listarTodas();
      return NextResponse.json(todas);
    }
    // Para un coordinador, `coordinadorId` NO viene del query string: sale de su propia
    // sesión. Antes el servidor se lo creía y `?coordinadorId=<otro>` bastaba para abrir
    // la bandeja de un compañero. El admin conserva el parámetro: su vista de proceso
    // completo es legítimamente transversal.
    const propio = await repo.usuarioLocalPorEmail(auth.sesion.email);
    if (!propio) {
      // Su correo de Supabase no existe en la tabla `usuario`. Antes el layout del panel
      // caía al primer coordinador activo y le mostraba la bandeja de otro en silencio.
      // Ahora se dice: esta cuenta no está dada de alta.
      return NextResponse.json(
        { error: "Su cuenta no está dada de alta como coordinador." },
        { status: 403 }
      );
    }
    const solicitudDe = auth.sesion.rol === "admin" && coordinadorId ? coordinadorId : propio.id;
    const solicitudes = soloEnviadasACompras(await repo.listarPorCoordinador(solicitudDe));
    return NextResponse.json(solicitudes);
  } catch {
    return NextResponse.json(
      { error: "Error al listar solicitudes" },
      { status: 500 }
    );
  }
}