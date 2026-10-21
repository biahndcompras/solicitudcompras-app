// Alta de coordinadores (RF-56, 4.4.2). Antes la ruta solo exportaba GET y no existía
// forma de dar de alta. Estas pruebas fijan las reglas de negocio:
//  - el correo duplicado es 409 (no 500) y NO toca Supabase,
//  - la cuenta se crea por INVITACIÓN (Supabase manda el enlace; no hay contraseña),
//  - el rol se puede elegir (coordinador o admin).
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarCoordinadores = vi.fn();
const buscarUsuarioPorEmail = vi.fn();
const crearUsuario = vi.fn();
const eliminarUsuario = vi.fn();
const guardApi = vi.fn();
const invitarUsuarioAuth = vi.fn();
const buscarUsuarioAuthPorEmail = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
    buscarUsuarioPorEmail = (...a: unknown[]) => buscarUsuarioPorEmail(...a);
    crearUsuario = (...a: unknown[]) => crearUsuario(...a);
    eliminarUsuario = (...a: unknown[]) => eliminarUsuario(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

vi.mock("@/lib/supabase/admin", () => ({
  invitarUsuarioAuth: (...a: unknown[]) => invitarUsuarioAuth(...a),
  buscarUsuarioAuthPorEmail: (...a: unknown[]) => buscarUsuarioAuthPorEmail(...a),
  eliminarUsuarioAuth: vi.fn().mockResolvedValue(undefined),
}));

const enviarConResend = vi.fn();
vi.mock("@/lib/mail/cliente", () => ({
  enviarConResend: (...a: unknown[]) => enviarConResend(...a),
}));

import { GET, POST } from "./route";

const VALIDO = {
  nombre: "Ana López",
  email: "ana@biabrands.co",
  rol: "coordinador",
  categoriasAsignadas: ["tecnologia"],
};

function crear(body: Record<string, unknown> = {}) {
  return POST(
    new Request("http://localhost/api/admin/coordinadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALIDO, ...body }),
    })
  );
}

const USUARIO_CREADO = {
  id: "u-nueva",
  nombre: "Ana López",
  email: "ana@biabrands.co",
  rol: "coordinador",
  categoriasAsignadas: ["tecnologia"],
  activo: true,
};

beforeEach(() => {
  listarCoordinadores.mockReset().mockResolvedValue([]);
  buscarUsuarioPorEmail.mockReset().mockResolvedValue(null);
  crearUsuario.mockReset().mockResolvedValue(USUARIO_CREADO);
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
  invitarUsuarioAuth.mockReset().mockResolvedValue({ id: "auth-1", actionLink: "https://supabase.test/invite" });
  buscarUsuarioAuthPorEmail.mockReset().mockResolvedValue(null);
  eliminarUsuario.mockReset().mockResolvedValue(undefined);
  enviarConResend.mockReset().mockResolvedValue({ ok: true, id: "email-1" });
});

describe("guardApi · /api/admin/coordinadores (4.8.5)", () => {
  it("sin sesión admin el POST no crea nada", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autorizado" }, { status: 403 }) });

    const res = await crear();

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(invitarUsuarioAuth).not.toHaveBeenCalled();
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it("el GET sigue exigiendo admin y listando solo activos", async () => {
    await GET();
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(listarCoordinadores).toHaveBeenCalled();
  });
});

describe("POST /api/admin/coordinadores · alta (RF-56)", () => {
  it("crea la cuenta de acceso y la fila local, y no devuelve la contraseña", async () => {
    const res = await crear();

    expect(res.status).toBe(201);
    // La llamada a Supabase lleva la contraseña inicial y el rol de coordinador.
    expect(invitarUsuarioAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@biabrands.co",
        nombre: "Ana López",
        rol: "coordinador",
      })
    );
    expect(crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@biabrands.co",
        rol: "coordinador",
        categoriasAsignadas: ["tecnologia"],
      })
    );
    expect(enviarConResend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@biabrands.co" })
    );
    const body = await res.json();
    expect(body).not.toHaveProperty("password");
    expect(body.rol).toBe("coordinador");
  });

  it("normaliza el correo a minúsculas", async () => {
    await crear({ email: "Ana@BiaBrands.Co" });

    expect(buscarUsuarioPorEmail).toHaveBeenCalledWith("ana@biabrands.co");
    expect(crearUsuario).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@biabrands.co" }));
  });

  it("un correo ya registrado (aunque esté inactivo) es 409 y no toca Supabase", async () => {
    buscarUsuarioPorEmail.mockResolvedValue({ ...USUARIO_CREADO, activo: false });

    const res = await crear();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ya existe/i);
    expect(invitarUsuarioAuth).not.toHaveBeenCalled();
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it("si la invitación falla, es 502 y se deshace la fila local", async () => {
    invitarUsuarioAuth.mockRejectedValue(new Error("supabase caído"));

    const res = await crear();

    expect(res.status).toBe(502);
    // La fila local se crea primero y se deshace: el reintento arranca limpio.
    expect(crearUsuario).toHaveBeenCalledTimes(1);
    expect(eliminarUsuario).toHaveBeenCalledWith("u-nueva");
  });

  it("si la fila local choca por correo duplicado, es 409 y explica qué hacer", async () => {
    crearUsuario.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));

    const res = await crear();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ya existe/i);
  });

  it("rechaza una categoría que no está en el catálogo (no texto libre)", async () => {
    const res = await crear({ categoriasAsignadas: ["inventada"] });

    expect(res.status).toBe(400);
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it("rechaza el alta sin nombre", async () => {
    const res = await crear({ nombre: "   " });

    expect(res.status).toBe(400);
    expect(invitarUsuarioAuth).not.toHaveBeenCalled();
  });
});


describe("POST /api/admin/coordinadores · roles e invitación (4.13.9)", () => {
  it("puede crear un ADMIN y no le asigna categorías", async () => {
    const res = await crear({ rol: "admin", categoriasAsignadas: ["tecnologia"] });
    expect(res.status).toBe(201);
    expect(invitarUsuarioAuth).toHaveBeenCalledWith(
      expect.objectContaining({ rol: "admin" })
    );
    expect(crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ rol: "admin", categoriasAsignadas: [] })
    );
  });

  it("si el correo ya tiene cuenta de acceso, es 409 y no invita", async () => {
    buscarUsuarioAuthPorEmail.mockResolvedValue({ id: "auth-existente" });
    const res = await crear();
    expect(res.status).toBe(409);
    expect(invitarUsuarioAuth).not.toHaveBeenCalled();
    expect(crearUsuario).not.toHaveBeenCalled();
  });
});
