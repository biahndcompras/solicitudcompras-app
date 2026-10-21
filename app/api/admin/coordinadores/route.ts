import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";
import { buscarUsuarioAuthPorEmail, eliminarUsuarioAuth, invitarUsuarioAuth } from "@/lib/supabase/admin";
import { enviarConResend } from "@/lib/mail/cliente";
import { invitacionCorreo } from "@/lib/mail/invitacion";
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
  // 4.13.9: la cuenta se crea por INVITACIÓN. No se define contraseña: la persona la elige
  // al abrir el enlace que le llega por correo.
  rol: z.enum(["coordinador", "admin"]).default("coordinador"),
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

    // Si ya tiene cuenta de acceso, invitar fallaría con un mensaje crudo de Supabase.
    try {
      if (await buscarUsuarioAuthPorEmail(email)) {
        return NextResponse.json(
          { error: `El correo «${email}» ya tiene una cuenta de acceso. Cambie su rol o reactívela en lugar de invitarla de nuevo.` },
          { status: 409 }
        );
      }
    } catch (e) {
      console.warn(`[coordinadores] no se pudo comprobar la cuenta de ${email}:`, e);
      return NextResponse.json({ error: "No se pudo verificar la cuenta de acceso." }, { status: 502 });
    }

    // 1) La fila local primero: es lo barato y se puede deshacer. Si la invitación falla,
    //    se borra y un reintento arranca limpio.
    let usuario;
    try {
      usuario = await repo.crearUsuario({
        nombre: body.nombre.trim(),
        email,
        rol: body.rol,
        // Los admins no tienen categorías asignadas.
        categoriasAsignadas: body.rol === "admin" ? [] : body.categoriasAsignadas,
      });
    } catch (e) {
      if (esCorreoDuplicado(e)) {
        return NextResponse.json({ error: `Ya existe una cuenta con el correo «${email}».` }, { status: 409 });
      }
      console.error(`[coordinadores] falló el alta local de ${email}:`, e);
      return NextResponse.json({ error: "No se pudo guardar la cuenta." }, { status: 500 });
    }

    // 2) Invitación real de Supabase (genera el enlace) + envío con Resend (dominio
    //    verificado y template corporativo). Si algo falla, se deshace todo.
    let authId: string | undefined;
    try {
      const { id, actionLink } = await invitarUsuarioAuth({
        email,
        nombre: body.nombre.trim(),
        rol: body.rol,
      });
      authId = id;

      const dryRun = ["1", "true", "yes", "si", "sí"].includes(
        String(process.env.MAIL_DRY_RUN ?? "").trim().toLowerCase()
      );
      if (!dryRun) {
        const { asunto, html } = invitacionCorreo({
          nombre: body.nombre.trim(),
          email,
          actionLink,
          esAdmin: body.rol === "admin",
        });
        const envio = await enviarConResend({ to: email, subject: asunto, html });
        if (!envio.ok) throw new Error(envio.error ?? "No se pudo enviar la invitación");
      } else {
        console.warn(`[coordinadores] MODO PRUEBAS: invitación de ${email} NO enviada`);
      }
    } catch (e) {
      console.warn(`[coordinadores] falló la invitación de ${email}:`, e);
      // Rollback: sin cuenta local ni de acceso, el reintento es limpio.
      await repo.eliminarUsuario(usuario.id).catch(() => {});
      if (authId) await eliminarUsuarioAuth(authId).catch(() => {});
      return NextResponse.json(
        { error: "No se pudo enviar la invitación por correo. Intente de nuevo." },
        { status: 502 }
      );
    }


    // Nunca se devuelve la contraseña.
    return NextResponse.json(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        categoriasAsignadas: usuario.categoriasAsignadas,
        activo: usuario.activo,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo crear el coordinador" }, { status: 500 });
  }
}
