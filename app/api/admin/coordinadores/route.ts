import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

// GET: lista real de coordinadores (id + nombre + email) para filtros y tablas del panel admin.
// El middleware protege /api/admin/*, pero no basta: la ruta refuerza el rol con guardApi.
export async function GET() {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const coordinadores = await repo.listarCoordinadores();
    return NextResponse.json(
      coordinadores.map((c) => ({ id: c.id, nombre: c.nombre, email: c.email }))
    );
  } catch {
    return NextResponse.json({ error: "Error al listar coordinadores" }, { status: 500 });
  }
}
