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
