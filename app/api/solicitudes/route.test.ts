// P1-3 · la bandeja del coordinador no puede leer borradores no enviados. La exclusión es
// del endpoint, no de la UI: cualquier cliente que llame a /api/solicitudes?coordinadorId=
// recibe solo solicitudes ya enviadas a Compras.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarPorCoordinador = vi.fn();
const listarTodas = vi.fn();
const usuarioLocalPorEmail = vi.fn();
const guardApi = vi.fn();
const crearSolicitud = vi.fn();
const obtenerPlantillaPara = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarPorCoordinador = (...a: unknown[]) => listarPorCoordinador(...a);
    listarTodas = (...a: unknown[]) => listarTodas(...a);
    usuarioLocalPorEmail = (...a: unknown[]) => usuarioLocalPorEmail(...a);
    crearSolicitud = (...a: unknown[]) => crearSolicitud(...a);
    obtenerPlantillaPara = (...a: unknown[]) => obtenerPlantillaPara(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

import { GET, POST } from "./route";
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
  usuarioLocalPorEmail.mockReset().mockResolvedValue({ id: "local-mio", email: "mio@biafoods.co" });
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "coordinador", email: "mio@biafoods.co" } });
  obtenerPlantillaPara.mockReset().mockResolvedValue(null);
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
    // Un coordinador consulta SIEMPRE su propia bandeja: el id sale de su sesión, no del
    // query string (ver "no abre la bandeja de otro coordinador" más abajo).
    expect(listarPorCoordinador).toHaveBeenCalledWith("local-mio");
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

describe("GET /api/solicitudes · la bandeja es la de la sesión, no la del query string", () => {
  it("un coordinador NO puede abrir la bandeja de otro con ?coordinadorId=<otro>", async () => {
    listarPorCoordinador.mockResolvedValue([sol("ENVIADA_A_COMPRAS")]);

    await pedir("local-de-otro-coordinador");

    // El spoofing falla aunque el parámetro sea el de un compañero real.
    expect(listarPorCoordinador).toHaveBeenCalledWith("local-mio");
    expect(listarPorCoordinador).not.toHaveBeenCalledWith("local-de-otro-coordinador");
  });

  it("el admin SÍ puede cruzar: su vista de proceso completo es legítimamente transversal", async () => {
    guardApi.mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
    listarPorCoordinador.mockResolvedValue([sol("ENVIADA_A_COMPRAS")]);

    await pedir("local-de-otro-coordinador");

    expect(listarPorCoordinador).toHaveBeenCalledWith("local-de-otro-coordinador");
  });

  it("sin coordinadorId en la URL tampoco hay bandeja ajena: usa la de la sesión", async () => {
    listarPorCoordinador.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/solicitudes"));

    expect(res.status).toBe(200);
    expect(listarPorCoordinador).toHaveBeenCalledWith("local-mio");
  });

  it("si la cuenta no está dada de alta, lo dice — no muestra la bandeja de otro", async () => {
    // Antes: el layout caía a coordinadores[0] y la bandeja del primero se leacea en
    // silencio. Ahora la bandeja queda vacía y el motivo es explícito.
    usuarioLocalPorEmail.mockResolvedValue(null);

    const res = await pedir("local-que-sea");

    expect(res.status).toBe(403);
    expect(listarPorCoordinador).not.toHaveBeenCalled();
    expect((await res.json()).error).toMatch(/alta/i);
  });
});

/** "YYYY-MM-DD" local a N días de hoy (negativo = pasado). */
function isoEnDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function pedirPost(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/solicitudes · fecha y descripción obligatorias (4.5.2 / 4.5.3)", () => {
  const base: Record<string, unknown> = {
    titulo: "Sombrillas",
    solicitanteEmail: "maria@bia.hn",
    solicitanteNombre: "Maria",
    areaSolicitante: "Marketing",
    descripcion: "500 sombrillas con logo de la marca",
    fechaRequerida: isoEnDias(10),
  };

  beforeEach(() => {
    crearSolicitud.mockReset().mockResolvedValue({ id: "s-1" });
  });

  it("rechaza una fecha requerida en el pasado", async () => {
    const res = await pedirPost({ ...base, fechaRequerida: "2020-01-01" });
    expect(res.status).toBe(400);
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("el rechazo de la fecha se explica en español y dice qué hacer", async () => {
    const res = await pedirPost({ ...base, fechaRequerida: "2020-01-01" });
    const texto = JSON.stringify(await res.json());
    expect(texto).toMatch(/fecha/i);
    expect(texto).toMatch(/hoy|futura|pas/i);
  });

  it("rechaza una fecha requerida con formato inválido", async () => {
    const res = await pedirPost({ ...base, fechaRequerida: "05/06/2020" });
    expect(res.status).toBe(400);
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("rechaza una descripción vacía (solo espacios)", async () => {
    const res = await pedirPost({ ...base, descripcion: "   " });
    expect(res.status).toBe(400);
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("rechaza una solicitud sin descripción", async () => {
    const sinDesc = { ...base };
    delete sinDesc.descripcion;
    const res = await pedirPost(sinDesc);
    expect(res.status).toBe(400);
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it("acepta y crea una solicitud con fecha futura y descripción", async () => {
    const res = await pedirPost(base);
    expect(res.status).toBe(201);
    expect(crearSolicitud).toHaveBeenCalledTimes(1);
  });
});

/**
 * 4.7.7 / RN-04 — Cuando el solicitante corrige el tipo que sugirió la IA, esa corrección
 * debe llegar al repositorio. Sin ella la métrica de precisión del clasificador (doc 16) es
 * incalculable. El schema no puede descartarla como campo desconocido.
 */
describe("POST /api/solicitudes · persiste la corrección de clasificación (4.7.7)", () => {
  const base: Record<string, unknown> = {
    titulo: "Sombrillas",
    solicitanteEmail: "maria@bia.hn",
    solicitanteNombre: "Maria",
    areaSolicitante: "Marketing",
    descripcion: "500 sombrillas con logo de la marca",
    fechaRequerida: isoEnDias(10),
  };

  beforeEach(() => {
    crearSolicitud.mockReset().mockResolvedValue({ id: "s-1" });
  });

  it("reenvía clasificacionCorregida=true al repositorio", async () => {
    const res = await pedirPost({ ...base, tipo: "RFQ", clasificacionCorregida: true });
    expect(res.status).toBe(201);
    expect(crearSolicitud.mock.calls[0][1]).toMatchObject({ clasificacionCorregida: true });
  });

  it("reenvía clasificacionCorregida=false cuando no hubo corrección", async () => {
    const res = await pedirPost({ ...base, tipo: "RFQ", clasificacionCorregida: false });
    expect(res.status).toBe(201);
    expect(crearSolicitud.mock.calls[0][1]).toMatchObject({ clasificacionCorregida: false });
  });
});

describe("POST /api/solicitudes · comprador preferido", () => {
  const base: Record<string, unknown> = {
    titulo: "Sombrillas",
    solicitanteEmail: "maria@bia.hn",
    solicitanteNombre: "Maria",
    areaSolicitante: "Marketing",
    descripcion: "500 sombrillas con logo de la marca",
    fechaRequerida: isoEnDias(10),
  };

  beforeEach(() => {
    crearSolicitud.mockReset().mockResolvedValue({ id: "s-1" });
  });

  it("reenvía el coordinador elegido al repositorio (antes se perdía)", async () => {
    const coordinadorId = "00000000-0000-4000-8000-000000000010";
    const res = await pedirPost({ ...base, coordinadorId });
    expect(res.status).toBe(201);
    expect(crearSolicitud.mock.calls[0][1]).toMatchObject({ coordinadorId });
  });

  it("rechaza un comprador con id que no es UUID", async () => {
    const res = await pedirPost({ ...base, coordinadorId: "carlos" });
    expect(res.status).toBe(400);
    expect(crearSolicitud).not.toHaveBeenCalled();
  });
});

/**
 * RF-55 / 4.4.1 — la solicitud debe conservar la plantilla con la que se creó (y, con ella,
 * su versión). El id NO se recibe del cliente: se resuelve en el servidor a partir de
 * (tipo, subtipo, categoría), porque el wizard podría mentir. Lo que se fija aquí es que el
 * POST lo resuelva y lo reenvíe al repositorio; y que su ausencia no rompa el alta.
 */
describe("POST /api/solicitudes · plantilla de origen (4.4.1)", () => {
  const base: Record<string, unknown> = {
    titulo: "Sombrillas",
    solicitanteEmail: "maria@bia.hn",
    solicitanteNombre: "Maria",
    areaSolicitante: "Marketing",
    descripcion: "500 sombrillas con logo de la marca",
    fechaRequerida: isoEnDias(10),
  };

  beforeEach(() => {
    crearSolicitud.mockReset().mockResolvedValue({ id: "s-1" });
  });

  it("resuelve la plantilla por (tipo, subtipo, categoría) y reenvía su id", async () => {
    obtenerPlantillaPara.mockResolvedValue({ id: "pl-1", version: 3 });
    const res = await pedirPost({ ...base, tipo: "RFQ", subtipo: "servicio", categoria: "Marketing" });
    expect(res.status).toBe(201);
    expect(obtenerPlantillaPara).toHaveBeenCalledWith("RFQ", "servicio", "Marketing");
    expect(crearSolicitud.mock.calls[0][1]).toMatchObject({ plantillaId: "pl-1" });
  });

  it("si no hay plantilla para la combinación, el alta sigue siendo válida (plantillaId sin definir)", async () => {
    obtenerPlantillaPara.mockResolvedValue(null);
    const res = await pedirPost({ ...base, tipo: "RFQ", subtipo: "servicio" });
    expect(res.status).toBe(201);
    expect(crearSolicitud).toHaveBeenCalledTimes(1);
    expect(crearSolicitud.mock.calls[0][1].plantillaId).toBeUndefined();
  });
});
