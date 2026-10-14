import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import type { FiltrosMetricas } from "@/lib/db/repositorio";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

export async function GET(request: Request) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const url = new URL(request.url);
    const q = url.searchParams;
    const filtros: FiltrosMetricas = {
      rango: (q.get("rango") as FiltrosMetricas["rango"]) ?? undefined,
      desde: q.get("desde") ?? undefined,
      hasta: q.get("hasta") ?? undefined,
      coordinador: q.get("coordinador") ?? undefined,
      categoria: q.get("categoria") ?? undefined,
      umbralDias: q.get("umbralDias") ? Number(q.get("umbralDias")) : undefined,
    };
    const metricas = await repo.metricasDashboard(filtros);
    return NextResponse.json(metricas);
  } catch {
    return NextResponse.json({ error: "Error al calcular métricas" }, { status: 500 });
  }
}