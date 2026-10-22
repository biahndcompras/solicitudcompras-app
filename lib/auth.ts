// Helpers de autenticación — Portal de Compras BIA.
// Extrae la sesión y el rol del usuario autenticado en Supabase.
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { rutaPorRol } from "@/lib/roles";

/**
 * Roles de SESIÓN. No confundir con `RolUsuario` (la tabla `usuario`), que solo tiene staff:
 * un solicitante se autentica pero **no** tiene fila en `usuario`, porque no es del equipo.
 */
export type Rol = "coordinador" | "admin" | "solicitante";

export type SesionAutenticada = {
  session: Session;
  rol: Rol;
  nombre: string;
  email: string;
};

// Lee la sesión actual sin lanzar (para usos no bloqueantes).
export async function getSession(): Promise<SesionAutenticada | null> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Sin rol de staff, la sesión es de un SOLICITANTE. Antes esto devolvía `null`, así que
    // un solicitante autenticado quedaba tratado como anónimo — y con el login por código en
    // camino, esa confusión habría sido el bug de fondo.
    //
    // El default es el de MENOR privilegio: un usuario sin rol solo puede ver lo suyo, por
    // correo. Si a un coordinador le faltara el `app_metadata.rol` por un error de
    // configuración, quedaría como solicitante — igual que antes quedaba sin acceso: nunca
    // escala privilegios.
    const rol = (session.user.app_metadata?.rol as Rol) ?? "solicitante";
    const nombre =
      (session.user.user_metadata?.nombre as string) ||
      session.user.email?.split("@")[0] ||
      "Usuario";
    return { session, rol, nombre, email: session.user.email ?? nombre };
  } catch {
    return null;
  }
}

// Requiere autenticación con uno de los roles dados; si no, redirige.
export async function requireAuth(roles: Rol[]): Promise<SesionAutenticada> {
  const sesion = await getSession();
  if (!sesion) {
    // Un solo login para todo el equipo (admin y coordinador).
    redirect("/login");
  }
  if (!roles.includes(sesion.rol)) {
    // Rol no permitido: a SU portal. Un solicitante vuelve a la entrada pública (`/`) y
    // nunca al panel — antes caía en `/panel`, que a su vez lo redirigía a `/panel`.
    redirect(rutaPorRol(sesion.rol));
  }
  return sesion;
}

// Se mantiene la exportación histórica; la implementación vive en `lib/roles.ts`.
export { rutaPorRol };
