import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";
import { sincronizarUsuarioAuth } from "@/lib/supabase/admin";
import { CATEGORIAS } from "@/lib/domain/categorias";

const repo = new PostgresRepositorio();

const CLAVES_CATEGORIA = new Set(CATEGORIAS.map((c) => c.clave));

const categoriaSchema = z
  .array(z.string())
  .refine((arr) => arr.every((c) => CLAVES_CATEGORIA.has(c)), "Categoría no reconocida en el catálogo")
  .default([]);

const crearSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().email("Correo inválido"),
  // La contraseña inicial la define el admin, igual que en `scripts/seed-auth.mjs`.
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  categoriasAsignadas: categoriaSchema,
});

function esCorreoDuplicado(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "23505";
}

// GET: lista real de coordinadores (id + nombre + email) para filtros y tablas del panel admin.
// El middleware protege /api/admin/*, pero no basta: la ruta refuerza el rol con guardApi.
export async function GET() {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const coordinadores = await repo.listarCoordinadores();
    return NextResponse.json(
      coordinadores.map((c) => ({ id: c.id, nombre: c.nombre, email: c.email }))
    );
  } catch {
    return NextResponse.json({ error: "Error al listar coordinadores" }, { status: 500 });
  }
}

// POST: alta de un coordinador (RF-56). Son DOS escrituras: la cuenta de Supabase Auth
// (service_role, solo en el servidor) y la fila local en `usuario`. Orden e idempotencia:
//
//  1. Se comprueba primero que el correo no exista localmente (409 sin tocar Supabase: un
//     alta rechazada no debe tener efectos secundarios sobre una cuenta ajena).
//  2. Se sincroniza la cuenta de Auth. Es IDEMPOTENTE: si el correo ya existe en Supabase se
//     actualiza el rol en vez de fallar.
//  3. Se inserta la fila local.
//
// Si falla el paso 3, queda una cuenta de Auth con rol coordinador SIN fila local. Es un fallo
// SEGURO: puede iniciar sesión, pero `usuarioLocalPorEmail` no la encuentra, así que la bandeja
// responde 403 y el panel queda vacío. Un reintento del alta la repara (el paso 2 es
// idempotente). El caso contrario (fila local sin Auth) no ocurre con este orden.
export async function POST(request: Request) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;

  let body: z.infer<typeof crearSchema>;
  try {
    body = crearSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = body.email.toLowerCase();

  try {
    const existente = await repo.buscarUsuarioPorEmail(email);
    if (existente) {
      return NextResponse.json(
        {
          error: existente.activo
            ? `Ya existe un coordinador con el correo «${email}». Edite su ficha o use otro correo.`
            : `Ya existe un usuario con el correo «${email}», pero está desactivado. Reactívelo en lugar de crear uno nuevo.`,
        },
        { status: 409 }
      );
    }

    try {
      await sincronizarUsuarioAuth({
        email,
        nombre: body.nombre.trim(),
        rol: "coordinador",
        password: body.password,
      });
    } catch (e) {
      console.warn(`[coordinadores] falló la creación de la cuenta de acceso de ${email}:`, e);
      return NextResponse.json(
        { error: "No se pudo crear la cuenta de acceso en el proveedor de autenticación." },
        { status: 502 }
      );
    }

    let usuario;
    try {
      usuario = await repo.crearUsuario({
        nombre: body.nombre.trim(),
        email,
        rol: "coordinador",
        categoriasAsignadas: body.categoriasAsignadas,
      });
    } catch (e) {
      if (esCorreoDuplicado(e)) {
        return NextResponse.json(
          { error: `Ya existe un coordinador con el correo «${email}».` },
          { status: 409 }
        );
      }
      console.error(`[coordinadores] cuenta de Auth creada pero falló el alta local de ${email}:`, e);
      return NextResponse.json(
        {
          error:
            "Se creó la cuenta de acceso, pero no se pudo guardar el coordinador. Vuelva a intentarlo: no se duplicará.",
        },
        { status: 500 }
      );
    }

    // Nunca se devuelve la contraseña.
    return NextResponse.json(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        categoriasAsignadas: usuario.categoriasAsignadas,
        activo: usuario.activo,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo crear el coordinador" }, { status: 500 });
  }
}
