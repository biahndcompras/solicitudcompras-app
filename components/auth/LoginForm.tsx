"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  titulo: string;
  descripcion: string;
  rol: string;
  tono: "coord" | "admin";
};

export function LoginForm({ titulo, descripcion, rol, tono }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const bgBrand = tono === "admin" ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20" : "bg-slate-900 hover:bg-slate-800";
  const logoBg = tono === "admin" ? "bg-sky-600 shadow-sky-600/20" : "bg-slate-900";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Traducir errores comunes de Supabase a español.
        const msg =
          error.message.includes("Invalid login credentials")
            ? "Correo o contraseña incorrectos. Verifique los datos e intente de nuevo."
            : error.message.includes("Email not confirmed")
              ? "El correo no está confirmado. Revise su bandeja de entrada."
              : error.message.includes("rate_limit")
                ? "Demasiados intentos. Espere un momento y vuelva a intentar."
                : `Error al iniciar sesión: ${error.message}`;
        setError(msg);
        setCargando(false);
        return;
      }
      // Redirige al portal según rol (el middleware refuerza la protección).
      router.push(rol === "admin" ? "/admin" : "/panel");
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Revise su conexión e intente de nuevo.");
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8">
      {/* Blobs ambientales */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-r from-sky-200/40 to-emerald-100/40 mix-blend-multiply blur-[80px] animate-fluid-blob pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-r from-sky-500/10 to-emerald-200/20 mix-blend-multiply blur-[80px] animate-fluid-blob pointer-events-none" style={{ animationDelay: "-4s" }} />

      <div className="w-full max-w-[540px] relative z-10">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 sm:p-12 shadow-2xl shadow-slate-200/20 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-r from-sky-500/10 to-emerald-200/15 blur-[50px]" />
          <div className="relative">
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={"w-11 h-11 rounded-2xl flex items-center justify-center shadow-md " + logoBg}>
                    <span className="text-white text-xs font-semibold tracking-tight">BIA</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-slate-900">Compras</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Enterprise
                </span>
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{titulo}</h2>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{descripcion}</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@compras.bia.local"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                  <svg className="mt-0.5 shrink-0 text-rose-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={cargando}
                  className={"text-white text-sm px-8 py-3.5 rounded-full font-medium transition-all flex items-center gap-2 disabled:opacity-60 shadow-lg " + bgBrand}
                >
                  {cargando ? "Entrando..." : "Entrar al panel"}
                  <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}