// `getSession` resuelve el ROL de la sesión. Es el punto donde un cambio descuidado escala
// privilegios, así que se prueba contra el módulo real (no en `api-guard.test.ts`, que mockea
// `@/lib/auth` y por eso no puede verlo).
import { describe, it, expect, vi, afterEach } from "vitest";

function mockSupabase(usuario: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getSession: async () => ({ data: { session: usuario } }) } }),
  }));
}

async function sesion() {
  const { getSession } = await import("@/lib/auth");
  return getSession();
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/supabase/server");
});

describe("getSession · el rol", () => {
  it("sin rol de staff la sesión es de SOLICITANTE, no nula", async () => {
    mockSupabase({ user: { id: "u1", email: "alguien@biabrands.co", app_metadata: {} } });

    const s = await sesion();

    // Antes devolvía null: un solicitante autenticado quedaba tratado como anónimo.
    expect(s).not.toBeNull();
    expect(s?.rol).toBe("solicitante");
    expect(s?.email).toBe("alguien@biabrands.co");
  });

  it("el rol de staff se conserva tal cual", async () => {
    mockSupabase({ user: { id: "u2", email: "c@biafoods.co", app_metadata: { rol: "coordinador" } } });

    expect((await sesion())?.rol).toBe("coordinador");
  });

  it("el admin también", async () => {
    mockSupabase({ user: { id: "u3", email: "a@biafoods.co", app_metadata: { rol: "admin" } } });

    expect((await sesion())?.rol).toBe("admin");
  });

  it("sin usuario sigue siendo null: no hay sesión que interpretar", async () => {
    mockSupabase(null);

    expect(await sesion()).toBeNull();
  });

  it("si Supabase falla, se degrada a sin sesión en vez de romper", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => {
        throw new Error("Supabase no responde");
      },
    }));

    expect(await sesion()).toBeNull();
  });
});
