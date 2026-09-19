import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

const repo = new PostgresRepositorio();

// GET público: lista de coordinadores activos (id + nombre + categorías legibles) para que
// el solicitante elija a qué comprador va dirigida su solicitud (sin exponer emails).
// Es información no sensible; el wizard la consume sin sesión.
export async function GET() {
  try {
    const coordinadores = await repo.listarCoordinadores();
    return NextResponse.json(
      coordinadores.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        categorias: (c.categoriasAsignadas ?? []).map((cat) => String(cat)),
      }))
    );
  } catch {
    return NextResponse.json({ error: "Error al listar coordinadores" }, { status: 500 });
  }
}