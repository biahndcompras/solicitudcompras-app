// Edición y baja/alta de un coordinador (RF-56, 4.4.2).
// Lo más importante: desactivar DEBE quitar el rol en Supabase Auth (si no, el
// coordinador sigue entrando por API y panel hasta que refresque la sesión).
// La UI de coordinadores no debe apuntar a admins: 404 si el id no es coordinador.
import { describe, it, expect, vi, beforeEach } from "vitest";

const usuarioPorId = vi.fn();
const actualizarUsuario = vi.fn();
const guardApi = vi.fn();
const sincronizarUsuarioAuth = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    usuarioPorId = (...a: unknown[]) => usuarioPorId(...a);
    actualizarUsuario = (...a: unknown[]) => actualizarUsuario(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

vi.mock("@/lib/supabase/admin", () => ({
  sincronizarUsuarioAuth: (...a: unknown[]) => sincronizarUsuarioAuth(...a),
}));

import { PATCH } from "./route";

const COORDINADOR = {
  id: "u-1",
  nombre: "Bryan Bonilla",
  email: "bbonilla@biabrands.co",
  rol: "coordinador",
  categoriasAsignadas: ["servicios_logisticos"],
  activo: true,
};

function patch(id: string, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/coordinadores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  usuarioPorId.mockReset().mockResolvedValue(COORDINADOR);
  actualizarUsuario.mockReset().mockImplementation((_id: string, cambios: object) =>
    Promise.resolve({ ...COORDINADOR, ...cambios })
  );
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
  sincronizarUsuarioAuth.mockReset().mockResolvedValue({ id: "auth-1", creado: false });
});

describe("guardApi · PATCH /api/admin/coordinadores/[id]", () => {
  it("sin sesión admin no edita", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autorizado" }, { status: 403 }) });

    const res = await patch("u-1", { nombre: "Otro" });

    expect(res.status).toBe(403);
    expect(actualizarUsuario).not.toHaveBeenCalled();
  });
});

describe("PATCH · edición de nombre y categorías", () => {
  it("guarda nombre y categorías y sincroniza el nombre sin cambiar el rol", async () => {
    const res = await patch("u-1", {
      nombre: "Bryan B.",
      categoriasAsignadas: ["tecnologia", "otra"],
    });

    expect(res.status).toBe(200);
    expect(actualizarUsuario).toHaveBeenCalledWith("u-1", {
      nombre: "Bryan B.",
      categoriasAsignadas: ["tecnologia", "otra"],
    });
    // El nombre de sesión se sincroniza, pero el rol se mantiene coordinador.
    expect(sincronizarUsuarioAuth).toHaveBeenCalledWith(
      expect.objectContaining({ email: COORDINADOR.email, nombre: "Bryan B.", rol: "coordinador" })
    );
  });

  it("rechaza categorías fuera del catálogo", async () => {
    const res = await patch("u-1", { categoriasAsignadas: ["inventada"] });

    expect(res.status).toBe(400);
    expect(actualizarUsuario).not.toHaveBeenCalled();
  });

  it("404 si el id no existe", async () => {
    usuarioPorId.mockResolvedValue(null);

    const res = await patch("no-existe", { nombre: "X" });

    expect(res.status).toBe(404);
    expect(actualizarUsuario).not.toHaveBeenCalled();
  });

  it("404 si el id corresponde a un admin (no se desactiva a un admin desde aquí)", async () => {
    usuarioPorId.mockResolvedValue({ ...COORDINADOR, rol: "admin" });

    const res = await patch("u-1", { activo: false });

    expect(res.status).toBe(404);
    expect(sincronizarUsuarioAuth).not.toHaveBeenCalled();
  });
});

describe("PATCH · desactivar quita el acceso", () => {
  it("desactivar deja activo=false y elimina el rol en Supabase (rol null)", async () => {
    const res = await patch("u-1", { activo: false });

    expect(res.status).toBe(200);
    expect(sincronizarUsuarioAuth).toHaveBeenCalledWith(
      expect.objectContaining({ email: COORDINADOR.email, rol: null })
    );
    expect(actualizarUsuario).toHaveBeenCalledWith("u-1", { activo: false });
  });

  it("si no se puede quitar el rol en Supabase, no se marca desactivado localmente", async () => {
    sincronizarUsuarioAuth.mockRejectedValue(new Error("supabase caído"));

    const res = await patch("u-1", { activo: false });

    expect(res.status).toBe(502);
    expect(actualizarUsuario).not.toHaveBeenCalled();
  });

  it("reactivar vuelve a poner el rol coordinador", async () => {
    usuarioPorId.mockResolvedValue({ ...COORDINADOR, activo: false });
    actualizarUsuario.mockResolvedValue({ ...COORDINADOR, activo: true });

    const res = await patch("u-1", { activo: true });

    expect(res.status).toBe(200);
    expect(sincronizarUsuarioAuth).toHaveBeenCalledWith(
      expect.objectContaining({ email: COORDINADOR.email, rol: "coordinador" })
    );
    expect(actualizarUsuario).toHaveBeenCalledWith("u-1", { activo: true });
  });
});
