// 4.10.8 — Verificación con datos reales (Postgres), no solo mocks.
//
// Siembra respuestas del solicitante + dos cotizaciones que divergen en un campo solicitado,
// llama a la ruta real y comprueba que la comparativa persiste la discrepancia. Requiere
// DATABASE_URL; sin él, el bloque se omite (mismo patrón que los tests de repo).
import { describe, it, expect, vi, beforeAll } from "vitest";

const guardApi = vi.fn();

vi.mock("@/lib/api-guard", () => ({ guardApi: (...a: unknown[]) => guardApi(...a) }));
// Sin IA: probamos el camino determinístico, que era el que estaba inerte.
vi.mock("@/lib/ai/orchestrator", () => ({ comparativa: async () => null }));

import { POST } from "./route";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("comparativa · integración con datos reales (4.10.8)", () => {
  beforeAll(() => {
    guardApi.mockResolvedValue({ sesion: { rol: "coordinador", email: "qa@bia.hn" } });
  });

  it("detecta la discrepancia pedido-vs-ofertado sobre filas reales", async () => {
    const repo = new PostgresRepositorio();
    const solicitud = await repo.crearSolicitud(
      {
        titulo: "QA discrepancias",
        solicitanteEmail: `qa-discrepancia.${Date.now()}@bia.hn`,
        solicitanteNombre: "QA",
        estado: "EN_COTIZACION",
      },
      { descripcion: "lona y mástil", categoria: "materia_prima" }
    );

    await repo.guardarRespuestas(solicitud.id, [
      {
        id: `${solicitud.id}-materiales`,
        solicitudId: solicitud.id,
        campoKey: "materiales",
        campoLabel: "Materiales",
        valor: "melamina",
        origen: "assessment",
      },
    ]);

    for (const [nombre, material] of [
      ["Muebles A", "madera maciza"],
      ["Muebles B", "melamina"],
    ] as const) {
      await repo.guardarCotizacion({
        solicitudId: solicitud.id,
        proveedorNombre: nombre,
        formatoOriginal: "manual",
        especificacionesOfertadas: { material },
        confianzaExtraccion: {},
        editadaManualmente: false,
        fechaCarga: new Date().toISOString(),
      });
    }

    const res = await POST(
      new Request(`http://localhost/api/solicitudes/${solicitud.id}/comparativa`, { method: "POST" }),
      { params: Promise.resolve({ id: solicitud.id }) }
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { discrepanciasDetectadas: { aspecto: string }[] };
    expect(body.discrepanciasDetectadas.map((d) => d.aspecto)).toContain("materiales");
  }, 30000);
});
