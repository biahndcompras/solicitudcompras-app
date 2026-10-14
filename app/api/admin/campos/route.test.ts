// Catálogo de campos · rutas de administración.
// 4.4.8: crear con una `campoKey` existente NO debe sobrescribir en silencio (ON CONFLICT
// DO UPDATE devolvía 201 pisando el campo en uso). Debe ser 409.
// 4.8.5: la ruta debe exigir `guardApi(["admin"])`, no confiar solo en el middleware.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarCampoCatalogo = vi.fn();
const guardarCampoCatalogo = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarCampoCatalogo = (...a: unknown[]) => listarCampoCatalogo(...a);
    guardarCampoCatalogo = (...a: unknown[]) => guardarCampoCatalogo(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

import { GET, POST } from "./route";

function campo(extra: Record<string, unknown> = {}) {
  return {
    campoKey: "dimensiones",
    label: "Dimensiones",
    tipoDato: "texto",
    origen: "assessment",
    obligatorio: false,
    orden: 100,
    activo: true,
    ...extra,
  };
}

function crear(body: Record<string, unknown> = {}) {
  return POST(
    new Request("http://localhost/api/admin/campos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Nuevo", tipoDato: "texto", origen: "assessment", ...body }),
    })
  );
}

beforeEach(() => {
  listarCampoCatalogo.mockReset().mockResolvedValue([]);
  guardarCampoCatalogo.mockReset().mockResolvedValue(undefined);
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
});

describe("guardApi · /api/admin/campos (4.8.5)", () => {
  it("sin sesión admin no lista y exige guardApi(['admin'])", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autorizado" }, { status: 403 }) });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(listarCampoCatalogo).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/campos · una clave existente no se pisa (4.4.8)", () => {
  it("devuelve 409 y NO llama a guardar cuando la clave ya existe", async () => {
    listarCampoCatalogo.mockResolvedValue([campo()]);

    const res = await crear({ campoKey: "dimensiones" });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ya existe/i);
    expect(guardarCampoCatalogo).not.toHaveBeenCalled();
  });

  it("también 409 si el campo existente está inactivo (no revive ni pisa)", async () => {
    listarCampoCatalogo.mockResolvedValue([campo({ activo: false })]);

    const res = await crear({ campoKey: "dimensiones" });

    expect(res.status).toBe(409);
    expect(guardarCampoCatalogo).not.toHaveBeenCalled();
  });

  it("crea con 201 cuando la clave es nueva", async () => {
    const res = await crear({ campoKey: "campo_nuevo" });

    expect(res.status).toBe(201);
    expect(guardarCampoCatalogo).toHaveBeenCalledWith(
      expect.objectContaining({ campoKey: "campo_nuevo", activo: true })
    );
  });
});
