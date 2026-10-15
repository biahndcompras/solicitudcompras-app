// CRUD de coordinadores contra la base local (RF-56, 4.4.2).
// Lo que se fija aquí:
//  - `usuarioLocalPorEmail` DEBE ignorar a los inactivos: si no, desactivar no
//    bloquea la bandeja (el coordinador seguiría entrando por API/panel).
//  - `listarCoordinadores` por defecto trae solo activos; con `incluirInactivos`
//    los trae todos, que es lo que necesita la pantalla de administración para
//    poder reactivar.
// Requiere DATABASE_URL. Si no está, se omiten.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgresRepositorio } from "./postgres-repo";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const describeDb = DATABASE_URL ? describe : describe.skip;

const PREFIJO = "crud-test-";

async function limpiar() {
  const { Client } = await import("pg");
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  await c.query("DELETE FROM usuario WHERE email LIKE $1", [`${PREFIJO}%`]);
  await c.end();
}

describeDb("repositorio de usuarios · CRUD de coordinadores (4.4.2)", () => {
  let repo: PostgresRepositorio;

  beforeAll(async () => {
    repo = new PostgresRepositorio();
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
  });

  it("crea un coordinador, lo relee por id y por email", async () => {
    const email = `${PREFIJO}crea-${Date.now()}@bia.hn`;
    const creado = await repo.crearUsuario({
      nombre: "Prueba CRUD",
      email,
      rol: "coordinador",
      categoriasAsignadas: ["tecnologia"],
    });

    expect(creado.id).toBeTruthy();
    expect(creado.activo).toBe(true);
    expect(creado.categoriasAsignadas).toEqual(["tecnologia"]);

    expect((await repo.usuarioPorId(creado.id))?.email).toBe(email);
    expect((await repo.buscarUsuarioPorEmail(email))?.id).toBe(creado.id);
  });

  it("normaliza el correo a minúsculas al crear", async () => {
    const email = `${PREFIJO}Mayus-${Date.now()}@BIA.hn`;
    const creado = await repo.crearUsuario({
      nombre: "Mayúsculas",
      email,
      rol: "coordinador",
      categoriasAsignadas: [],
    });

    expect(creado.email).toBe(email.toLowerCase());
    expect((await repo.usuarioLocalPorEmail(email))?.id).toBe(creado.id);
  });

  it("actualiza nombre, categorías y actividad", async () => {
    const email = `${PREFIJO}edita-${Date.now()}@bia.hn`;
    const creado = await repo.crearUsuario({
      nombre: "Antes",
      email,
      rol: "coordinador",
      categoriasAsignadas: ["tecnologia"],
    });

    const actualizado = await repo.actualizarUsuario(creado.id, {
      nombre: "Después",
      categoriasAsignadas: ["otra"],
    });

    expect(actualizado?.nombre).toBe("Después");
    expect(actualizado?.categoriasAsignadas).toEqual(["otra"]);

    expect(await repo.actualizarUsuario("00000000-0000-0000-0000-000000000000", { nombre: "x" })).toBeNull();
  });

  it("un coordinador desactivado deja de resolverse por usuarioLocalPorEmail", async () => {
    const email = `${PREFIJO}inactiva-${Date.now()}@bia.hn`;
    const creado = await repo.crearUsuario({
      nombre: "Se va",
      email,
      rol: "coordinador",
      categoriasAsignadas: [],
    });

    // Activo: se resuelve.
    expect((await repo.usuarioLocalPorEmail(email))?.id).toBe(creado.id);

    await repo.actualizarUsuario(creado.id, { activo: false });

    // Inactivo: ya NO se resuelve (desactivar bloquea la bandeja)…
    expect(await repo.usuarioLocalPorEmail(email)).toBeNull();
    // …pero el registro sigue existiendo para poder reactivarlo.
    expect((await repo.buscarUsuarioPorEmail(email))?.activo).toBe(false);
  });

  it("listarCoordinadores excluye inactivos por defecto y los incluye si se pide", async () => {
    const email = `${PREFIJO}lista-${Date.now()}@bia.hn`;
    const creado = await repo.crearUsuario({
      nombre: "Listado",
      email,
      rol: "coordinador",
      categoriasAsignadas: [],
    });
    await repo.actualizarUsuario(creado.id, { activo: false });

    const soloActivos = await repo.listarCoordinadores();
    expect(soloActivos.some((c) => c.id === creado.id)).toBe(false);

    const todos = await repo.listarCoordinadores({ incluirInactivos: true });
    expect(todos.some((c) => c.id === creado.id)).toBe(true);
  });
});
