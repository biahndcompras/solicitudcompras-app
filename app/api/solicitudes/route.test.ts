// P1-3 · la bandeja del coordinador no puede leer borradores no enviados. La exclusión es
// del endpoint, no de la UI: cualquier cliente que llame a /api/solicitudes?coordinadorId=
// recibe solo solicitudes ya enviadas a Compras.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarPorCoordinador = vi.fn();
const listarTodas = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarPorCoordinador = (...a: unknown[]) => listarPorCoordinador(...a);
    listarTodas = (...a: unknown[]) => listarTodas(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: vi.fn(async () => ({ sesion: { rol: "coordinador" } })),
}));

import { GET } from "./route";
import type { EstadoSolicitud, Solicitud } from "@/lib/domain/types";

function sol(estado: EstadoSolicitud, id = `id-${estado}`): Solicitud {
  return {
    id,
    titulo: "T",
    estado,
    solicitanteEmail: "a@b.hn",
    solicitanteNombre: "N",
    clasificacionCorregida: false,
    notificacionFallida: false,
    fechaCreacion: "2026-08-13T10:00:00Z",
  };
}

function pedir(coordinadorId: string) {
  return GET(new Request(`http://localhost/api/solicitudes?coordinadorId=${coordinadorId}`));
}

beforeEach(() => {
  listarPorCoordinador.mockReset();
  listarTodas.mockReset();
});

describe("GET /api/solicitudes (bandeja del coordinador)", () => {
  it("excluye los estados previos al envío a Compras", async () => {
    listarPorCoordinador.mockResolvedValue([
      sol("BORRADOR", "borrador-1"),
      sol("BORRADOR", "borrador-2"),
      sol("ENVIADA_A_COMPRAS"),
      sol("EN_COTIZACION"),
      sol("COMPARATIVA_LISTA"),
      sol("ENVIADA_A_SOLICITANTE"),
      sol("CERRADA_CON_DECISION"),
      sol("CERRADA_SIN_DECISION"),
      sol("CANCELADA"),
    ]);

    const res = await pedir("00000000-0000-4000-8000-000000000002");
    const body = (await res.json()) as Solicitud[];

    expect(res.status).toBe(200);
    expect(listarPorCoordinador).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000002");
    expect(body.map((s) => s.estado)).toEqual([
      "ENVIADA_A_COMPRAS",
      "EN_COTIZACION",
      "COMPARATIVA_LISTA",
      "ENVIADA_A_SOLICITANTE",
      "CERRADA_CON_DECISION",
      "CERRADA_SIN_DECISION",
      "CANCELADA",
    ]);
    expect(body.some((s) => s.estado === "BORRADOR")).toBe(false);
  });

  it("no filtra nada más: las terminales y las activas se conservan", async () => {
    listarPorCoordinador.mockResolvedValue([sol("ENVIADA_A_COMPRAS"), sol("CANCELADA")]);
    const body = (await (await pedir("c-1")).json()) as Solicitud[];
    expect(body).toHaveLength(2);
  });

  it("la vista de admin (coordinadorId=all) sí incluye borradores", async () => {
    listarTodas.mockResolvedValue([sol("BORRADOR"), sol("ENVIADA_A_COMPRAS")]);
    const body = (await (await pedir("all")).json()) as Solicitud[];
    expect(listarTodas).toHaveBeenCalled();
    expect(body).toHaveLength(2);
  });
});
