import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { generarExcelDashboard } from "@/lib/excel/dashboard";
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
      coordinador: q.get("coordinador") ?? undefined,
      categoria: q.get("categoria") ?? undefined,
    };

    const metricas = await repo.metricasDashboard(filtros);
    const desde =
      (filtros?.rango === "dia" ? new Date(Date.now() - 86400000).toISOString()
        : filtros?.rango === "semana" ? new Date(Date.now() - 7 * 86400000).toISOString()
          : filtros?.rango === "mes" ? new Date(Date.now() - 30 * 86400000).toISOString() : null);

    const procesos = (await repo.listarTodas()).filter((s) => {
      if (filtros.coordinador && s.coordinadorId !== filtros.coordinador) return false;
      if (desde && s.fechaCreacion < desde) return false;
      return true;
    });

    const coordinadores = await repo.listarCoordinadores();
    const nombreCoord = (id?: string) =>
      (id && coordinadores.find((u) => u.id === id)?.nombre.split(" ")[0]) ?? "Sin asignar";

    const buffer = generarExcelDashboard({ metricas, procesos, nombreCoordinador: nombreCoord });
    return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="dashboard-metricas.xlsx"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}