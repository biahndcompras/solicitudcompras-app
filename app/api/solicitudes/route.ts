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

const crearSchema = z.object({
  titulo: z.string().min(1).max(MAX_TITULO),
  solicitanteEmail: z.string().email().max(320),
  solicitanteNombre: z.string().min(1).max(MAX_NOMBRE),
  areaSolicitante: z.string().max(MAX_AREA).optional(),
  descripcion: z.string().max(MAX_DESCRIPCION).optional(),
  categoria: z.string().max(80).optional(),
  tipo: z.enum(["RFI", "RFQ", "RFP"]).optional(),
  subtipo: z.enum(["producto", "servicio", "mixto"]).optional(),
  fechaRequerida: z.string().max(10).optional(),
  // Opcional y sin efecto si no viene: la API pública no exige idempotencia, la aprovecha
  // cuando el cliente la manda. Un valor con forma rara se ignora en vez de rechazar el envío.
  idempotencyKey: z.string().max(MAX_CLAVE_IDEMPOTENCIA).optional(),
});

export async function POST(request: Request) {
  try {
    const body = crearSchema.parse(await request.json());
    const clave = body.idempotencyKey ?? "";
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
        idempotencyKey: CLAVE_IDEMPOTENCIA_RE.test(clave) ? clave : undefined,
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
    if (!coordinadorId) {
      return NextResponse.json(
        { error: "Falta coordinadorId" },
        { status: 400 }
      );
    }
    const solicitudes = soloEnviadasACompras(await repo.listarPorCoordinador(coordinadorId));
    return NextResponse.json(solicitudes);
  } catch {
    return NextResponse.json(
      { error: "Error al listar solicitudes" },
      { status: 500 }
    );
  }
}