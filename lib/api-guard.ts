// Guard de autorización para rutas API — Portal de Compras BIA.
// Valida la sesión real del usuario (cookie Supabase) y que su rol esté permitido.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export type ApiRol = "coordinador" | "admin";

// Retorna la sesión si el usuario autenticado tiene un rol permitido; si no, una
// respuesta 401 (sin sesión) o 403 (rol no autorizado). Si está autorizado, undefined.
export async function guardApi(roles: ApiRol[]): Promise<
  { sesion: NonNullable<Awaited<ReturnType<typeof getSession>>>; negada?: undefined } | { negada: NextResponse; sesion?: undefined }
> {
  const sesion = await getSession();
  if (!sesion) {
    return { negada: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (!roles.includes(sesion.rol)) {
    return { negada: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { sesion };
}

/**
 * Autorización para recursos que tienen DOS lectores legítimos: el equipo de Compras (con
 * sesión) y el propio solicitante (sin sesión — este flujo no tiene login, su identidad es el
 * correo con el que se registró). Por eso no alcanza `guardApi`: cerraría el PDF y el logo que el
 * solicitante tiene derecho a ver de su propia solicitud.
 *
 * El correo es la misma identidad que ya usa `/mis-solicitudes?email=`, así que no se
 * inventó un mecanismo nuevo. Sin correo, o con el de otra persona, no hay acceso: un `<a
 * href>` con el UUID de alguien más no debe devolver nada.
 *
 * Ojo: esto autoriza a leer **esa** solicitud, no las de otros. No reemplaza el aislamiento
 * horizontal entre coordinadores, que es otro problema.
 */
export async function guardRecursoDeSolicitud(
  request: Request,
  solicitud: { solicitanteEmail: string },
  roles: ApiRol[] = ["coordinador", "admin"]
): Promise<{ autorizado: true; rol: "solicitante" | ApiRol } | { autorizado: false; negada: NextResponse }> {
  const sesion = await getSession();
  if (sesion) {
    if (!roles.includes(sesion.rol)) {
      return { autorizado: false, negada: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
    }
    return { autorizado: true, rol: sesion.rol };
  }
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (email && email === solicitud.solicitanteEmail.trim().toLowerCase()) {
    return { autorizado: true, rol: "solicitante" };
  }
  return {
    autorizado: false,
    negada: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
  };
}