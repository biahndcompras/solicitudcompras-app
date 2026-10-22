// Cliente Supabase con `service_role` — SOLO para el servidor.
// La `service_role` key salta RLS y administra usuarios de Auth: jamás debe llegar al
// cliente. Este módulo se importa únicamente desde route handlers (p. ej. el alta y la
// baja de coordinadores), nunca desde un componente o un módulo que viaje al navegador.
import { createClient, type User } from "@supabase/supabase-js";

/** Rol de sesión que se guarda en `app_metadata.rol` (mirar `lib/auth.ts`). */
export type RolAuth = "coordinador" | "admin" | null;

export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Busca un usuario de Auth por correo. El admin client no tiene "get by email", así que se
 * pagina `listUsers` (mismo enfoque que `scripts/seed-auth.mjs`). El correo es único en Auth,
 * por eso se corta en la primera coincidencia.
 */
export async function buscarUsuarioAuthPorEmail(email: string): Promise<User | null> {
  const admin = crearClienteAdmin();
  const objetivo = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const usuarios = data?.users ?? [];
    const encontrado = usuarios.find((u) => u.email?.toLowerCase() === objetivo);
    if (encontrado) return encontrado;
    if (usuarios.length < perPage) break;
  }
  return null;
}

/**
 * Crea o actualiza el usuario de Supabase Auth y su rol de sesión. **Idempotente por correo**:
 * si el usuario ya existe, se actualizan sus metadatos en vez de fallar. Es lo que permite
 * reintentar un alta que quedó a medias sin duplicar la cuenta.
 *
 * `rol: null` QUITA el rol: `getSession()` cae al default de menor privilegio (`solicitante`)
 * y la persona pierde el acceso. Es el mecanismo que ya existe; es lo que usa la baja.
 */
export async function sincronizarUsuarioAuth(input: {
  email: string;
  nombre: string;
  rol: RolAuth;
  password?: string;
}): Promise<{ id: string; creado: boolean }> {
  const admin = crearClienteAdmin();
  const email = input.email.trim().toLowerCase();

  const existente = await buscarUsuarioAuthPorEmail(email);
  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      user_metadata: { ...(existente.user_metadata ?? {}), nombre: input.nombre },
      // Se conserva el resto de `app_metadata` y solo se pisa `rol`.
      app_metadata: { ...(existente.app_metadata ?? {}), rol: input.rol },
    });
    if (error) throw new Error(error.message);
    return { id: existente.id, creado: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre: input.nombre },
    app_metadata: { rol: input.rol },
  });
  if (error || !data?.user) {
    throw new Error(error?.message ?? "No se pudo crear el usuario de autenticación");
  }
  return { id: data.user.id, creado: true };
}


/**
 * Invita a una persona por correo (4.13.9). **No** se define contraseña: Supabase manda un
 * enlace y la persona define la suya al primer ingreso, que es justo el requisito.
 *
 * El rol se escribe en `app_metadata` después del invite: `inviteUserByEmail` no lo acepta.
 * Si el correo ya tiene cuenta, Supabase responde con error y se propaga tal cual.
 */
export async function invitarUsuarioAuth(input: {
  email: string;
  nombre: string;
  rol: Exclude<RolAuth, null>;
}): Promise<{ id: string; actionLink: string }> {
  const admin = crearClienteAdmin();
  const email = input.email.trim().toLowerCase();
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  // `generateLink` crea el usuario y devuelve el enlace de invitación, SIN mandar correo.
  // El envío lo hace la app con Resend (dominio verificado y template corporativo): el correo
  // propio de Supabase rechazaba direcciones válidas y no permite nuestro diseño.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { nombre: input.nombre }, redirectTo: `${base}/login` },
  });
  if (error || !data?.user || !data.properties?.action_link) {
    throw new Error(error?.message ?? "No se pudo generar la invitación");
  }

  const { error: errorRol } = await admin.auth.admin.updateUserById(data.user.id, {
    user_metadata: { ...(data.user.user_metadata ?? {}), nombre: input.nombre },
    app_metadata: { ...(data.user.app_metadata ?? {}), rol: input.rol },
  });
  if (errorRol) throw new Error(errorRol.message);

  return { id: data.user.id, actionLink: data.properties.action_link };
}

/** Deshace una invitación que no se pudo entregar. */
export async function eliminarUsuarioAuth(id: string): Promise<void> {
  const admin = crearClienteAdmin();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}
