import { describe, it, expect } from "vitest";
import { PostgresRepositorio } from "./postgres-repo";
import type { Pool } from "pg";
import { urlDeTests } from "@/lib/db/test-url";

const DATABASE_URL = urlDeTests() ?? "";
const describeDb = DATABASE_URL ? describe : describe.skip;

// Mock de pool realista: distingue por SQL y devuelve filas coherentes para
// cada agregación de metricsDashboard. Refleja el comportamiento SQL real.
function mockPool(respuestas: Record<string, () => Record<string, unknown>[]>): Pool {
  const q = async (sql: string, ..._args: unknown[]) => {
    let filas: Record<string, unknown>[] = [];
    for (const [fragmento, factory] of Object.entries(respuestas)) {
      if (sql.includes(fragmento)) {
        filas = factory();
        break;
      }
    }
    return { rows: filas, rowCount: filas.length };
  };
  return { query: q } as unknown as Pool;
}

describe("metricsDashboard (mock pool)", () => {
  it("calcula conversión, activas y sin decisión sin filtros", async () => {
    const repo = new PostgresRepositorio(mockPool({
      // count escalar (n)
      "SELECT count(*)": () => [{ n: 5 }],
      // AVG tiempo ciclo → null (sin CERRADAS con fechas)
      "EXTRACT(EPOCH": () => [{ d: null }],
      // volumen por coordinador
      "GROUP BY coordinador_id": () => [
        { c: "u1", k: 3 },
        { c: "u2", k: 2 },
      ],
      // distribución por tipo
      "GROUP BY t": () => [
        { t: "RFQ", k: 4 },
        { t: "RFP", k: 1 },
      ],
    }));
    const m = await repo.metricasDashboard();
    expect(m.tasaConversion).toBe(100); // 5 cerradas / 5 enviadas
    expect(m.solicitudesActivas).toBe(5);
    expect(m.solicitudesSinDecision).toBe(5);
    expect(m.tiempoCicloPromedioDias).toBeNull();
    expect(m.volumenPorCoordinador).toEqual({ u1: 3, u2: 2 });
    expect(m.distribucionPorTipo).toEqual({ RFQ: 4, RFP: 1 });
  });

  it("devuelve null en conversión cuando no hay solicitudes", async () => {
    const repo = new PostgresRepositorio(mockPool({
      "SELECT count(*)": () => [{ n: 0 }],
      "EXTRACT(EPOCH)": () => [{ d: null }],
      "GROUP BY coordinador_id": () => [],
      "GROUP BY t": () => [],
    }));
    const m = await repo.metricasDashboard();
    expect(m.tasaConversion).toBeNull();
    expect(m.solicitudesActivas).toBe(0);
    expect(m.solicitudesSinDecision).toBe(0);
    expect(m.volumenPorCoordinador).toEqual({});
    expect(m.distribucionPorTipo).toEqual({});
  });
});

// Igual que mockPool pero además guarda cada SQL y sus parámetros, para poder
// auditar la consulta real (no solo el número que devuelve el mock).
function mockPoolEspia(
  respuestas: Record<string, () => Record<string, unknown>[]>,
  capturadas: { sql: string; args: unknown[] }[]
): Pool {
  const q = async (sql: string, ...args: unknown[]) => {
    capturadas.push({ sql, args });
    let filas: Record<string, unknown>[] = [];
    for (const [fragmento, factory] of Object.entries(respuestas)) {
      if (sql.includes(fragmento)) {
        filas = factory();
        break;
      }
    }
    return { rows: filas, rowCount: filas.length };
  };
  return { query: q } as unknown as Pool;
}

const BASE_MOCK: Record<string, () => Record<string, unknown>[]> = {
  "GROUP BY etapa": () => [{ etapa: "EN_COTIZACION", d: 4.5 }],
  "GROUP BY st": () => [
    { st: "servicio", k: 2 },
    { st: "producto", k: 1 },
  ],
  "GROUP BY t": () => [],
  "GROUP BY coordinador_id": () => [],
  "EXTRACT(EPOCH": () => [{ d: null }],
  "SELECT count(*)": () => [{ n: 3 }],
};

// 4.10.9 — El KPI "sin decisión" mentía por dos motivos: contaba BORRADOR y usaba
// un umbral cableado en 5 en vez del configurado en /admin/configuracion.
describe("4.10.9 — KPI sin decisión honra borradores y umbral configurado", () => {
  it("excluye BORRADOR del conteo de 'sin decisión'", async () => {
    const capturadas: { sql: string; args: unknown[] }[] = [];
    const repo = new PostgresRepositorio(mockPoolEspia({ ...BASE_MOCK }, capturadas));
    await repo.metricasDashboard();
    const q = capturadas.find((c) => c.sql.includes("fecha_creacion < now()"));
    expect(q).toBeTruthy();
    // La lista excluida del KPI debe contener BORRADOR: un borrador de 8 días no está
    // "esperando decisión", nunca se envió.
    expect(q!.sql).toMatch(/NOT IN \([^)]*'BORRADOR'[^)]*\)/);
  });

  it("lee el umbral de configuracion cuando no se pasa filtro", async () => {
    const capturadas: { sql: string; args: unknown[] }[] = [];
    const repo = new PostgresRepositorio(
      mockPoolEspia({ ...BASE_MOCK, "FROM configuracion": () => [{ valor: 12 }] }, capturadas)
    );
    const m = await repo.metricasDashboard();
    expect(m.umbralDias).toBe(12);
    const q = capturadas.find((c) => c.sql.includes("fecha_creacion < now()"));
    expect(q!.args[0]).toEqual([12]);
  });

  it("el umbral del filtro manda sobre la configuración", async () => {
    const capturadas: { sql: string; args: unknown[] }[] = [];
    const repo = new PostgresRepositorio(
      mockPoolEspia({ ...BASE_MOCK, "FROM configuracion": () => [{ valor: 12 }] }, capturadas)
    );
    const m = await repo.metricasDashboard({ umbralDias: 7 });
    expect(m.umbralDias).toBe(7);
  });

  it("configuración nula o inválida cae a 5, nunca a 0", async () => {
    const capturadas: { sql: string; args: unknown[] }[] = [];
    const repo = new PostgresRepositorio(
      mockPoolEspia({ ...BASE_MOCK, "FROM configuracion": () => [{ valor: null }] }, capturadas)
    );
    const m = await repo.metricasDashboard();
    expect(m.umbralDias).toBe(5);
  });
});

// 4.4.4 — El dashboard solo mostraba distribución por tipo; faltan subtipo y tiempo por etapa.
describe("4.4.4 — distribución por subtipo y tiempo por etapa", () => {
  it("agrega distribución por subtipo", async () => {
    const repo = new PostgresRepositorio(mockPool({ ...BASE_MOCK }));
    const m = await repo.metricasDashboard();
    expect(m.distribucionPorSubtipo).toEqual({ servicio: 2, producto: 1 });
  });

  it("agrega tiempo promedio por etapa desde evento_trazabilidad", async () => {
    const repo = new PostgresRepositorio(mockPool({ ...BASE_MOCK }));
    const m = await repo.metricasDashboard();
    expect(m.tiempoPorEtapa).toEqual({ EN_COTIZACION: 4.5 });
  });

  it("sin eventos, tiempo por etapa queda vacío (no cae en 0)", async () => {
    const repo = new PostgresRepositorio(mockPool({ ...BASE_MOCK, "GROUP BY etapa": () => [] }));
    const m = await repo.metricasDashboard();
    expect(m.tiempoPorEtapa).toEqual({});
  });
});

// El mock no ejecuta SQL: esto corre la agregación real (make_interval y la CTE de etapas)
// contra Postgres local cuando hay DATABASE_URL, para que un error de sintaxis no pase.
describeDb("metricsDashboard (base real)", () => {
  it("ejecuta la agregación y honra el umbral pedido", async () => {
    const repo = new PostgresRepositorio();
    const m = await repo.metricasDashboard({ umbralDias: 7 });
    expect(m.umbralDias).toBe(7);
    expect(typeof m.distribucionPorSubtipo).toBe("object");
    expect(typeof m.tiempoPorEtapa).toBe("object");
    expect(Number.isFinite(m.solicitudesSinDecision)).toBe(true);
  }, 30000);

  it("la CTE de etapas y el umbral parametrizado funcionan con filtros", async () => {
    const repo = new PostgresRepositorio();
    const m = await repo.metricasDashboard({
      umbralDias: 3,
      coordinador: "00000000-0000-4000-8000-000000000001",
      categoria: "administrativa",
      desde: "2020-01-01",
      hasta: "2030-01-01",
    });
    expect(m.umbralDias).toBe(3);
    expect(typeof m.tiempoPorEtapa).toBe("object");
  }, 30000);
});