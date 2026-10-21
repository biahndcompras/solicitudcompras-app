// ¿Contra qué base corren los tests de integración?
//
// El plan de migración a Supabase (`docs/references/migracion-supabase-cloud.md`) marca el
// riesgo: la suite **escribe de verdad** (crea solicitudes, adjuntos, comparativas) y además
// `vitest.global-setup.ts` **borra por patrón**. Si `DATABASE_URL` apunta a la base del piloto,
// un `npm test` la ensucia o la vacía.
//
// Regla:
//  · `TEST_DATABASE_URL` manda. Es la base de tests, sea local o un proyecto aparte.
//  · Si no existe, se usa `DATABASE_URL` **solo si el host es local**.
//  · Si `DATABASE_URL` es remota (Supabase) y no hay `TEST_DATABASE_URL`, esto devuelve `null`:
//    los tests de integración se **omiten** en vez de escribir en la base real.

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function esHostLocal(host: string): boolean {
  return HOSTS_LOCALES.has(host);
}

export function urlDeTests(): string | null {
  const explicita = process.env.TEST_DATABASE_URL?.trim();
  if (explicita) return explicita;

  const principal = process.env.DATABASE_URL?.trim();
  if (!principal) return null;

  try {
    const { hostname } = new URL(principal);
    return esHostLocal(hostname) ? principal : null;
  } catch {
    return null;
  }
}

/**
 * `true` si `DATABASE_URL` existe y apunta a un host remoto sin una `TEST_DATABASE_URL` que la
 * separe. En ese caso la suite debe negarse a usar esa conexión.
 */
export function apuntaALaBaseReal(): boolean {
  const principal = process.env.DATABASE_URL?.trim();
  if (!principal || process.env.TEST_DATABASE_URL?.trim()) return false;
  try {
    return !esHostLocal(new URL(principal).hostname);
  } catch {
    return false;
  }
}
