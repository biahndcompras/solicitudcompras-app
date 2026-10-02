"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { TrackerEtapas } from "@/components/TrackerEtapas";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { api, type SalidaCorta } from "@/lib/api-client";
import {
  snapshotDecision,
  servidorDecision,
  suscribirDecision,
  esperandoDecision,
  type MapaDecision,
} from "@/lib/enlaces-decision";

export default function MisSolicitudesPage() {
  return (
    <Suspense fallback={null}>
      <MisSolicitudesInner />
    </Suspense>
  );
}

function MisSolicitudesInner() {
  const searchParams = useSearchParams();
  const qEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(qEmail);
  const [buscado, setBuscado] = useState(!!qEmail);
  const [cargando, setCargando] = useState(!!qEmail);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<SalidaCorta[]>([]);
  // Tokens de decisión que YA se abrieron en este navegador. Snapshot de servidor vacío:
  // el CTA no aparece en el SSR y entra al montar, sin romper la hidratación.
  const tokensDecision = useSyncExternalStore(
    suscribirDecision,
    snapshotDecision,
    servidorDecision
  ) as MapaDecision;

  async function consultar(correo: string) {
    if (!correo.trim()) return;
    setBuscado(true);
    setCargando(true);
    setError(null);
    try {
      setResultados(await api.misSolicitudes(correo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar");
      setResultados([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!qEmail) return;
    let activo = true;
    api
      .misSolicitudes(qEmail)
      .then((r) => {
        if (activo) setResultados(r);
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "Error al consultar");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [qEmail]);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    await consultar(email);
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-4 md:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[900px] bg-white/70 backdrop-blur-3xl rounded-3xl border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden relative z-10 p-5 md:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Mis solicitudes</h1>
            <p className="text-xs text-slate-500 mt-1">Revisá el estado de tus pedidos y comparativas.</p>
          </div>
          <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-sky-600 transition-colors flex items-center gap-1.5 bg-white px-3 min-h-[44px] rounded-full border border-slate-200 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Nueva Solicitud
          </Link>
        </div>

        <form onSubmit={buscar} className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-[480px]">
            <label htmlFor="email-consulta" className="block text-xs font-medium text-slate-700 mb-1.5">Tu correo institucional</label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" y2="19" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              <input
                id="email-consulta"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@bia.com"
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <button type="submit" disabled={!email.includes("@")} className="bg-slate-900 text-white text-sm px-6 min-h-[44px] rounded-full font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Ver mis solicitudes
          </button>
        </form>

            {/* P3-d: la guía existe y es buena, pero esta pantalla era la única del solicitante
            sin un enlace a ella. `inline-flex` sin más wrapping daba 16px de alto: objetivo
            táctil por debajo de 44px. */}
        <p className="-mt-3 mb-6 md:-mt-4 md:mb-8">
          <Link
            href="/guias/manual-solicitante"
            className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-medium text-slate-500 hover:text-sky-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.25A2.25 2.25 0 0 1 14.25 4h4A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20h-4A2.25 2.25 0 0 1 12 17.75z"/><path d="M12 6.25A2.25 2.25 0 0 0 9.75 4h-4A2.75 2.75 0 0 0 3 6.75v10.5A2.75 2.75 0 0 0 5.75 20h4A2.25 2.25 0 0 0 12 17.75"/></svg>
            ¿Primera vez por acá? Mirá la guía rápida
          </Link>
        </p>

        {buscado ? (
          cargando ? (
            <p className="text-xs text-slate-500">Consultando…</p>
          ) : error ? (
            <p className="text-xs text-rose-600">Ocurrió un problema al consultar: {error}</p>
          ) : resultados.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
              </div>
              <div className="text-sm font-medium text-slate-900">No encontramos solicitudes con este correo</div>
              <Link href="/" className="mt-3 inline-flex items-center justify-center min-h-[44px] px-4 text-sm font-medium text-sky-700 border border-sky-200 rounded-full">Crear una solicitud</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((s) => (
                // La tarjeta es un <article> (no un <a>): el "Decidir ahora" es otro enlace
                // y un enlace dentro de otro enlace es HTML inválido (y no navegable).
                // El link al detalle estira su zona clicable con after:inset-0.
                <article
                  key={s.id}
                  className="relative block w-full text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.numeroReferencia ?? "—"}</div>
                      <h3 className="text-base font-medium text-slate-900 break-words">
                        <Link
                          href={`/mis-solicitudes/${s.id}?email=${encodeURIComponent(email)}`}
                          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500"
                        >
                          {s.titulo}
                        </Link>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <SemParoBadge solicitud={s} />
                      <Badge tone={toneDe(s.estado)} label={estadoLegible(s.estado)} />
                    </div>
                  </div>
                  <div className="mb-3 px-1">
                    <TrackerEtapas estado={s.estado} compacto />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="text-xs text-slate-500">
                      Creada: {formatoFechaLegible(s.fechaCreacion)}
                    </p>
                    <span className="relative z-10 text-sky-600 text-sm font-semibold flex items-center gap-1 min-h-[44px] pl-2">
                      Ver detalle
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 -mt-1.5">
                    Atención: {duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}
                  </div>
                  {tokensDecision[s.id] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/comparativa/${encodeURIComponent(tokensDecision[s.id].token)}`}
                        className="relative z-10 inline-flex items-center justify-center min-h-[44px] px-4 text-sm font-semibold text-white bg-slate-900 rounded-full"
                      >
                        Decidir ahora
                      </Link>
                      <span className="text-[11px] text-slate-400">Enlace que abriste en este navegador.</span>
                    </div>
                  ) : esperandoDecision(s.estado) ? (
                    <p className="relative z-10 mt-2 text-[11px] text-amber-700 bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2">
                      Tu decisión es el siguiente paso: abrí el enlace que Compras te envió por correo.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    BORRADOR: "Borrador",
    ENVIADA_A_COMPRAS: "Enviada a Compras",
    EN_COTIZACION: "En cotización",
    COMPARATIVA_LISTA: "Comparativa lista",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

function toneDe(e: string): BadgeTone {
  if (e === "EN_COTIZACION" || e === "COMPARATIVA_LISTA") return "cotizaciones";
  if (e === "ENVIADA_A_SOLICITANTE") return "decision";
  if (e === "CERRADA_CON_DECISION") return "cerrada";
  if (e === "CERRADA_SIN_DECISION" || e === "CANCELADA") return "error";
  return "activa";
}
