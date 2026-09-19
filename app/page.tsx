"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { guardarBorradorEmail, limpiarBorrador } from "@/lib/cookie";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [emailWarning, setEmailWarning] = useState(false);

  // Inicia una solicitud NUEVA: descarta cualquier borrador anterior y actualiza la
  // cookie de continuidad, así el wizard no retoma la solicitud previa del mismo correo.
  function nuevaSolicitud(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    limpiarBorrador();
    guardarBorradorEmail(email);
    router.push(`/solicitud/nueva?nuevo=1&email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre)}&area=${encodeURIComponent(area)}`);
  }

  const valido = email.includes("@") && email.includes(".") && nombre.trim() !== "" && area.trim() !== "";

  function onEmail(input: string) {
    setEmail(input);
    if (input.length > 0) {
      const okFormato = input.includes("@") && input.includes(".");
      setEmailError(!okFormato);
      const dominio = input.split("@")[1];
      setEmailWarning(okFormato && !!dominio && !/bia\.(com|hn)$/.test(dominio) && !dominio.includes("institucional"));
    } else {
      setEmailError(false);
      setEmailWarning(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[540px]">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 sm:p-12 shadow-2xl shadow-slate-200/20 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-r from-sky-500/10 to-emerald-200/15 blur-[50px]" />
          <div className="relative">
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center shadow-md">
                    <span className="text-white text-xs font-semibold tracking-tight">BIA</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-slate-900">Compras</span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Solicitudes
                  </span>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Nueva solicitud de cotización</h2>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">Ingresá tus datos básicos para comenzar. Sin contraseñas.</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={nuevaSolicitud}>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Tu correo institucional</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => onEmail(e.target.value)}
                    placeholder="ejemplo@bia.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
                {emailError ? (
                  <p className="text-[11px] text-rose-500 mt-1.5 font-medium">El formato del correo es inválido.</p>
                ) : null}
                {emailWarning ? (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-start gap-1">
                    <span>Este correo no parece institucional. Podés continuar, pero Compras lo va a revisar.</span>
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Tu nombre completo</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Área / departamento</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21V9l6-4 6 4v12"/><path d="M9 9v3M15 21V11h6v10"/></svg>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Marketing"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-3">
                <Link
                  href={email.includes("@") ? `/mis-solicitudes?email=${encodeURIComponent(email)}` : "/mis-solicitudes"}
                  className="text-xs font-medium text-slate-500 hover:text-sky-600 transition-colors flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                  Mis solicitudes
                </Link>
                <button
                  type="submit"
                  disabled={!valido}
                  className="bg-slate-900 text-white text-sm px-8 py-3.5 rounded-full font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Continuar
                  <svg className="text-sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}