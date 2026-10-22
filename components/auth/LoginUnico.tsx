"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { esStaff, rutaPorRol } from "@/lib/roles";
import { Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";

/**
 * Un solo acceso para el equipo de Compras (admin y coordinador), según la
 * pantalla de acceso de la referencia (DESIGN.md §4.4).
 *
 * Los solicitantes NO usan contraseña: entran con el correo de su solicitud. Si
 * una cuenta de solicitante intenta este login, se cierra la sesión y se explica.
 */
export function LoginUnico() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        const msg =
          authError.message.includes("Invalid login credentials")
            ? "Correo o contraseña incorrectos. Verifique los datos e intente de nuevo."
            : authError.message.includes("Email not confirmed")
              ? "El correo no está confirmado. Revise su bandeja de entrada."
              : authError.message.includes("rate_limit")
                ? "Demasiados intentos. Espere un momento y vuelva a intentar."
                : `No se pudo iniciar sesión: ${authError.message}`;
        setError(msg);
        return;
      }

      // El rol vive en `app_metadata` (lo escribe el admin al crear la cuenta). Si el
      // objeto del login no lo trae, se confirma contra el servidor.
      let rol = data.user?.app_metadata?.rol as string | undefined;
      if (!rol) {
        const { data: confirmado } = await supabase.auth.getUser();
        rol = confirmado.user?.app_metadata?.rol as string | undefined;
      }

      if (!esStaff(rol)) {
        await supabase.auth.signOut();
        setError(
          "Esta cuenta no tiene acceso al panel. Si es solicitante, entre desde el enlace de su solicitud."
        );
        return;
      }

      router.push(rutaPorRol(rol));
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Revise su conexión e intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <p className="eyebrow text-body">Acceso al panel</p>
      <h1 className="mt-3 text-display-xl text-ink">Bienvenido</h1>
      <p className="mt-2 text-caption text-body">Use la cuenta que le asignó Compras.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" aria-describedby="login-ayuda">
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@biabrands.co"
          required
        />

        <TextField
          label="Contraseña"
          type={verPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          suffix={
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              className="mono-caption shrink-0 px-1 text-body hover:text-ink"
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {verPassword ? "Ocultar" : "Mostrar"}
            </button>
          }
        />

        {error ? (
          <p
            role="alert"
            className="rounded-sm px-3 py-2.5 text-caption text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={cargando} className="mt-1 w-full">
          {cargando ? "Entrando…" : "Entrar al panel"}
        </Button>
      </form>

      <p id="login-ayuda" className="mt-6 text-caption text-body">
        Los solicitantes no usan este acceso: entran desde el enlace de su solicitud.
      </p>
    </div>
  );
}
