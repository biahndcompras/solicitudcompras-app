import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";
import { sincronizarUsuarioAuth } from "@/lib/supabase/admin";
import { CATEGORIAS } from "@/lib/domain/categorias";

const repo = new PostgresRepositorio();

const CLAVES_CATEGORIA = new Set(CATEGORIAS.map((c) => c.clave));

// Edición parcial: solo se pisa lo que llega.
const patchSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  rol: z.enum(["coordinador", "admin"]).optional(),
  categoriasAsignadas: z
    .array(z.string())
    .refine((arr) => arr.every((c) => CLAVES_CATEGORIA.has(c)), "Categoría no reconocida en el catálogo")
    .optional(),
  activo: z.boolean().optional(),
});

/**
 * PATCH: editar nombre, categorías, ROL y activar/desactivar (RF-56, 4.13.10).
 *
 * Dos fronteras de seguridad:
 *  · un admin **no puede cambiarse el rol a sí mismo**: se quedaría sin acceso al panel;
 *  · **no se puede dejar el sistema sin ningún admin activo** (ni cambiando roles ni
 *    desactivando al último).
 *
 * Desactivar NO es solo `activo = false`: hay que QUITAR el rol en Supabase Auth
 * (`app_metadata.rol`), porque `getSession()` lo usa para decidir el acceso. Al reactivar se
 * devuelve el rol que corresponda. Es el mecanismo que ya existe.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const existente = await repo.usuarioPorId(id);
    if (!existente || (existente.rol !== "coordinador" && existente.rol !== "admin")) {
      return NextResponse.json({ error: `No existe una cuenta con el id «${id}».` }, { status: 404 });
    }

    const cambiaRol = body.rol !== undefined && body.rol !== existente.rol;
    const esUnoMismo = existente.email.toLowerCase() === auth.sesion.email.toLowerCase();

    if (cambiaRol && esUnoMismo) {
      return NextResponse.json(
        { error: "No puede cambiar su propio rol: se quedaría sin acceso. Pídaselo a otro administrador." },
        { status: 400 }
      );
    }

    // ¿La operación deja el sistema sin admins activos?
    const quitaAdmin =
      existente.rol === "admin" &&
      ((body.rol !== undefined && body.rol !== "admin") || body.activo === false);
    if (quitaAdmin) {
      const equipo = await repo.listarEquipo({ incluirInactivos: false });
      const adminsActivos = equipo.filter((u) => u.rol === "admin").length;
      if (adminsActivos <= 1) {
        return NextResponse.json(
          { error: "Debe quedar al menos un administrador activo. Cree o active otro antes de cambiar este." },
          { status: 409 }
        );
      }
    }

    const cambios: {
      nombre?: string;
      rol?: "coordinador" | "admin";
      categoriasAsignadas?: string[];
      activo?: boolean;
    } = {};
    if (body.nombre !== undefined) cambios.nombre = body.nombre.trim();
    if (body.rol !== undefined) cambios.rol = body.rol;
    if (body.categoriasAsignadas !== undefined) cambios.categoriasAsignadas = body.categoriasAsignadas;
    if (body.activo !== undefined) cambios.activo = body.activo;
    // Un admin no lleva categorías: si se promueve, se limpian para no dejar datos engañosos.
    if (body.rol === "admin") cambios.categoriasAsignadas = [];

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "No hay cambios que aplicar." }, { status: 400 });
    }

    const activoFinal = body.activo ?? existente.activo;
    const rolFinal = body.rol ?? (existente.rol as "coordinador" | "admin");

    // El rol de sesión debe reflejar el estado final. Sin esto, el cambio de rol no tendría
    // efecto real: `getSession()` seguiría devolviendo el rol viejo.
    if (body.nombre !== undefined || body.activo !== undefined || cambiaRol) {
      try {
        await sincronizarUsuarioAuth({
          email: existente.email,
          nombre: cambios.nombre ?? existente.nombre,
          rol: activoFinal ? rolFinal : null,
        });
      } catch (e) {
        console.warn(`[coordinadores] falló la sincronización del acceso de ${existente.email}:`, e);
        return NextResponse.json(
          { error: "No se pudo actualizar el acceso de la cuenta en el proveedor de autenticación." },
          { status: 502 }
        );
      }
    }

    const actualizado = await repo.actualizarUsuario(id, cambios);
    if (!actualizado) {
      return NextResponse.json({ error: `No existe una cuenta con el id «${id}».` }, { status: 404 });
    }

    return NextResponse.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      email: actualizado.email,
      rol: actualizado.rol,
      categoriasAsignadas: actualizado.categoriasAsignadas,
      activo: actualizado.activo,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la cuenta" }, { status: 500 });
  }
}
