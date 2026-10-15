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
  categoriasAsignadas: z
    .array(z.string())
    .refine((arr) => arr.every((c) => CLAVES_CATEGORIA.has(c)), "Categoría no reconocida en el catálogo")
    .optional(),
  activo: z.boolean().optional(),
});

// PATCH: editar nombre y categorías, y desactivar/reactivar (RF-56).
//
// Desactivar NO es solo `activo = false`: hay que QUITAR el rol en Supabase Auth
// (`app_metadata.rol`), porque `getSession()` lo usa para decidir el acceso. Sin eso, el
// coordinador seguiría entrando por API y panel hasta que refrescara su token. Al reactivar se
// devuelve el rol `coordinador`. Es el mecanismo que ya existe; no se inventa otro.
//
// Orden: primero Supabase (lo crítico al desactivar es quitar el rol), después la fila local.
// Si falla Supabase, no se toca lo local y se devuelve 502. Si fallara lo local después de
// Supabase: al desactivar, la persona ya perdió el acceso (fallo seguro); al reactivar, aún
// tendría `activo = false` (403 en la bandeja). En ambos casos, reintentar lo repara.
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
    // Solo coordinadores: no se desactiva a un admin desde esta pantalla.
    if (!existente || existente.rol !== "coordinador") {
      return NextResponse.json({ error: `No existe un coordinador con el id «${id}».` }, { status: 404 });
    }

    const cambios: { nombre?: string; categoriasAsignadas?: string[]; activo?: boolean } = {};
    if (body.nombre !== undefined) cambios.nombre = body.nombre.trim();
    if (body.categoriasAsignadas !== undefined) cambios.categoriasAsignadas = body.categoriasAsignadas;
    if (body.activo !== undefined) cambios.activo = body.activo;

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "No hay cambios que aplicar." }, { status: 400 });
    }

    // El rol de sesión debe reflejar la actividad pedida. Si el nombre cambió, también se
    // sincroniza para que la cabecera del panel no quede con el nombre viejo.
    if (body.nombre !== undefined || body.activo !== undefined) {
      const activoFinal = body.activo ?? existente.activo;
      try {
        await sincronizarUsuarioAuth({
          email: existente.email,
          nombre: cambios.nombre ?? existente.nombre,
          rol: activoFinal ? "coordinador" : null,
        });
      } catch (e) {
        console.warn(`[coordinadores] falló la sincronización del acceso de ${existente.email}:`, e);
        return NextResponse.json(
          { error: "No se pudo actualizar el acceso del coordinador en el proveedor de autenticación." },
          { status: 502 }
        );
      }
    }

    const actualizado = await repo.actualizarUsuario(id, cambios);
    if (!actualizado) {
      return NextResponse.json({ error: `No existe un coordinador con el id «${id}».` }, { status: 404 });
    }

    return NextResponse.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      email: actualizado.email,
      categoriasAsignadas: actualizado.categoriasAsignadas,
      activo: actualizado.activo,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el coordinador" }, { status: 500 });
  }
}
