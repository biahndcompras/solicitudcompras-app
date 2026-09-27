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

const crearSchema = z.object({
  titulo: z.string().min(1),
  solicitanteEmail: z.string().email(),
  solicitanteNombre: z.string().min(1),
  areaSolicitante: z.string().optional(),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  tipo: z.enum(["RFI", "RFQ", "RFP"]).optional(),
  subtipo: z.enum(["producto", "servicio", "mixto"]).optional(),
  fechaRequerida: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = crearSchema.parse(await request.json());
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