"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { useSesion } from "@/lib/sesion-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";
import type { Solicitud } from "@/lib/domain/types";
import { nombreCategoria } from "@/lib/domain/categorias";

type Filtro = "todos" | "activa" | "esperando_cot" | "esperando_dec" | "cerrada";

// Colores de métrica por estado (Activas azul, cotizaciones naranja, decisión índigo, cerradas verde).
const META_TONE: Record<Exclude<Filtro, "todos">, { badge: BadgeTone; bg: string; icono: React.ReactNode }> = {
  activa: {
    badge: "activa",
    bg: "bg-sky-500/10 text-sky-600",
    icono: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>,
  },
  esperando_cot: {
    badge: "cotizaciones",
    bg: "bg-amber-500/10 text-amber-600",
    icono: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h4l3 13h9l3-9H8"/><path d="M13 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>,
  },
  esperando_dec: {
    badge: "decision",
    bg: "bg-indigo-500/10 text-indigo-600",
    icono: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>,
  },
  cerrada: {
    badge: "cerrada",
    bg: "bg-emerald-500/10 text-emerald-600",
    icono: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  },
};

const FILTRO_ORDER: [Filtro, string, Exclude<Filtro, "todos"> | null][] = [
  ["todos", "Todos", null],
  ["activa", "Activas", "activa"],
  ["esperando_cot", "Esperando cotizaciones", "esperando_cot"],
  ["esperando_dec", "Esperando decisión", "esperando_dec"],
  ["cerrada", "Cerradas", "cerrada"],
];

// Colores por categoría (paleta estable para cualquier número de categorías).
const COLOR_CATEGORIA: Record<string, BadgeTone> = {
  materia_prima: "activa",
  servicios_logisticos: "warning",
  administrativa: "neutral",
  mercadeo_publicidad: "decision",
  capex_indirectos: "nueva",
  tecnologia: "cerrada",
  otra: "error",
};

function toneCategoria(clave: string | null | undefined): BadgeTone {
  if (!clave) return "neutral";
  return COLOR_CATEGORIA[clave] ?? "neutral";
}

const ESTADO_FILTRO: Record<string, Filtro> = {
  ENVIADA_A_COMPRAS: "activa",
  EN_COTIZACION: "esperando_cot",
  COMPARATIVA_LISTA: "esperando_cot",
  ENVIADA_A_SOLICITANTE: "esperando_dec",
  CERRADA_CON_DECISION: "cerrada",
  CERRADA_SIN_DECISION: "cerrada",
  CANCELADA: "cerrada",
};

export default function PanelPage() {
  const sesion = useSesion();
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);

  async function salir() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // Un fallo de red NO se renderiza como "no tenés solicitudes": va a su propia rama
  // de error con reintento (P1-5). `intentoCarga` fuerza el reintento.
  useEffect(() => {
    const localId = sesion?.localId;
    if (!localId) return;
    let vivo = true;
    api
      .listarSolicitudes(localId)
      .then((d) => {
        if (vivo) setSolicitudes(d);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setSolicitudes([]);
        // Un fallo de red (TypeError) no trae mensaje de producto; un error HTTP sí
        // (p. ej. "No autenticado"), y ese texto sí se muestra tal cual.
        setError(
          e instanceof Error && !(e instanceof TypeError) && e.message
            ? e.message
            : "No se pudo conectar con el servidor para traer tu bandeja. Revisá tu conexión e intentá de nuevo."
        );
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [sesion?.localId, intentoCarga]);

  function reintentar() {
    setError(null);
    setCargando(true);
    setIntentoCarga((n) => n + 1);
  }

  const contadores = useMemo(() => {
    const activa = solicitudes.filter((s) => ["ENVIADA_A_COMPRAS"].includes(s.estado)).length;
    const cot = solicitudes.filter((s) => ["EN_COTIZACION", "COMPARATIVA_LISTA"].includes(s.estado)).length;
    const dec = solicitudes.filter((s) => s.estado === "ENVIADA_A_SOLICITANTE").length;
    const cerrada = solicitudes.filter((s) => ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(s.estado)).length;
    return { activa, cot, dec, cerrada };
  }, [solicitudes]);

  const visibles = solicitudes.filter((s) => {
    if (filtro !== "todos" && ESTADO_FILTRO[s.estado] !== filtro) return false;
    if (busqueda.trim() === "") return true;
    const q = busqueda.toLowerCase();
    return [referenciaDe(s), s.solicitanteNombre, s.titulo, s.categoria].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  const contadoresUI: { key: Exclude<Filtro, "todos">; label: string; valor: number; sub: string }[] = [
    { key: "activa", label: "Activas", valor: contadores.activa, sub: "en curso" },
    { key: "esperando_cot", label: "Esperando cotizaciones", valor: contadores.cot, sub: "pend." },
    { key: "esperando_dec", label: "Esperando decisión", valor: contadores.dec, sub: "solic." },
    { key: "cerrada", label: "Cerradas", valor: contadores.cerrada, sub: "cerradas" },
  ];

  return (
    <main className="min-h-screen flex items-start justify-center p-3 md:p-6 relative overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[1500px] bg-white/70 backdrop-blur-3xl rounded-3xl md:rounded-[2.5rem] border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] flex flex-col min-h-[640px] md:min-h-[720px] overflow-hidden relative z-10">
        {/* Header */}
        <header className="shrink-0 relative overflow-hidden border-b border-white/60">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-100/80 via-white/50 to-emerald-100/50" />
          <div className="relative px-5 md:px-8 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center shadow-sm">
                  <span className="text-white text-[12px] font-semibold tracking-tight">BIA</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">Panel de Compras</h1>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-white/70 border border-white text-slate-600">
                      Coordinador
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Flujo del coordinador: de bandeja a envío de comparativa.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/60 border border-white shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-slate-800">{sesion?.nombre ?? "Coordinador"}</div>
                    <div className="text-xs text-slate-500">Equipo de Compras</div>
                  </div>
                </div>
                <button onClick={salir} className="text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-sky-600 transition-colors flex items-center gap-1.5 bg-white/70 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-2xl border border-white shadow-sm">
                  Salir
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 md:px-8 py-6 md:py-8">
          {/* Contadores. P2-8: son KPI puros, NO un control de filtro — el único control
              de estado son los chips de abajo (con aria-pressed). Un número que además
              actúa de toggle duplica el estado dos veces y confunde a quien navega a
              ciegas o con lector de pantalla. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {contadoresUI.map((c) => {
              const meta = META_TONE[c.key];
              return (
                <div key={c.key} className="text-left bg-white rounded-2xl border border-slate-200/60 p-4 md:p-5 shadow-sm flex items-start gap-3">
                  <div className={"shrink-0 w-10 h-10 rounded-xl flex items-center justify-center " + meta.bg}>{meta.icono}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 leading-snug">{c.label}</div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 leading-none">{c.valor}</div>
                      <div className="text-xs text-slate-500">{c.sub}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filtros + búsqueda */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1 bg-white/60 border border-white shadow-sm rounded-2xl p-1.5 flex-wrap">
              {FILTRO_ORDER.map(([k, label, meta]) => (
                <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={
                  "px-3 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold tracking-tight transition-all " +
                  (filtro === k
                    ? meta
                      ? "text-white " + { activa: "bg-sky-500", esperando_cot: "bg-amber-500", esperando_dec: "bg-indigo-500", cerrada: "bg-emerald-500" }[meta]
                      : "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-white/70")
                }>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto relative w-full sm:w-auto">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por referencia, título o solicitante..." className="w-[280px] max-w-[90vw] sm:w-[320px] bg-white/70 border border-white rounded-2xl pl-10 pr-9 py-2 text-xs font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all" />
              {busqueda ? (
                <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              ) : null}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Solicitudes</div>
              <div className="text-xs text-slate-400">{cargando ? "Cargando…" : `${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"}`}</div>
            </div>

            {cargando && sesion?.localId ? (
              <div className="px-5 py-10">
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-100" />
                    <div className="absolute inset-0 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Cargando bandeja…</div>
                    <div className="text-xs text-slate-500">Sincronizando asignaciones por categoría.</div>
                  </div>
                </div>
              </div>
            ) : !sesion?.localId ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rose-500"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div className="text-sm font-medium text-slate-900">No se pudo cargar tu bandeja</div>
                <div className="text-xs text-slate-500 mt-1">Tu cuenta no está vinculada a un coordinador. Contactá a Compras.</div>
              </div>
            ) : error ? (
              /* Fallo de carga real: nunca se confunde con una bandeja vacía (P1-5). */
              <div className="px-5 py-12 text-center" role="alert">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div className="text-sm font-medium text-slate-900">No pudimos traer tu bandeja</div>
                <div className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{error}</div>
                <button
                  type="button"
                  onClick={reintentar}
                  className="mt-5 inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full hover:bg-slate-800 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                  Reintentar
                </button>
              </div>
            ) : visibles.length === 0 ? (
              /* Estado vacío ramificado: con búsqueda activa el problema es la búsqueda (P2-6). */
              <div className="px-5 py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                </div>
                {busqueda.trim() !== "" ? (
                  <>
                    <div className="text-sm font-medium text-slate-900">
                      Sin resultados para «{busqueda.trim()}»
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Revisá la referencia, el título o el nombre del solicitante.
                    </div>
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      className="mt-5 inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full hover:bg-slate-800 transition-colors"
                    >
                      Limpiar búsqueda
                    </button>
                  </>
                ) : filtro !== "todos" ? (
                  /* Mismo cuidado con el filtro: "Esperando decisión" en 0 no es una
                     bandeja vacía, es un filtro sin coincidencias. */
                  <>
                    <div className="text-sm font-medium text-slate-900">
                      No hay solicitudes en «{etiquetaDeFiltro(filtro)}»
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Probá con otro filtro o mirá todas.</div>
                    <button
                      type="button"
                      onClick={() => setFiltro("todos")}
                      className="mt-5 inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full hover:bg-slate-800 transition-colors"
                    >
                      Ver todas
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-slate-900">No tenés solicitudes asignadas</div>
                    <div className="text-xs text-slate-500 mt-1">Cuando te asignen una categoría, aparecerán acá.</div>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-50/70">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-3 font-semibold">Referencia</th>
                      <th className="px-6 py-3 font-semibold">Solicitante</th>
                      <th className="px-6 py-3 font-semibold">Necesidad</th>
                      <th className="px-6 py-3 font-semibold">Categoría</th>
                      <th className="px-6 py-3 font-semibold">Estado</th>
                      <th className="px-6 py-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibles.map((s) => (
                      /* La fila NO es clicable: el único camino al detalle es el enlace real
                         "Abrir" (P0-1). Un <tr onClick> sin tabindex no lo alcanza ni
                         teclado ni lector de pantalla. */
                      <tr key={s.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {s.numeroReferencia ? (
                              <span className="font-mono text-xs font-semibold text-slate-900">{s.numeroReferencia}</span>
                            ) : (
                              /* P3-10: sin referencia inventada. El id interno va en el
                                 tooltip, que es donde sirve para soporte. */
                              <span className="text-xs italic text-slate-500" title={`Sin referencia asignada · id interno ${s.id}`}>
                                Sin referencia
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-slate-900">{s.solicitanteNombre}</div>
                          <div className="text-xs text-slate-500">{s.areaSolicitante ?? "Área por definir"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-slate-900">{s.titulo}</div>
                          <div className="text-xs text-slate-500">
                            {s.fechaRequerida ? <>Entrega requerida: <span className="font-medium text-slate-600">{formatoFechaLegible(s.fechaRequerida)}</span></> : "Entrega por definir"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge tone={toneCategoria(s.categoria)} label={nombreCategoria(s.categoria)} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={toneEstado(s.estado)} label={estadoLegible(s.estado)} />
                            <SemParoBadge solicitud={s} compact />
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto} de gestión</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/panel/solicitud/${s.id}`}
                            aria-label={`Abrir ${s.numeroReferencia ?? `solicitud ${s.titulo}`}`}
                            className="inline-flex items-center justify-center gap-2 bg-white text-sky-800 text-xs px-4 py-2 min-h-[44px] sm:min-h-[34px] rounded-full font-semibold hover:bg-sky-50 transition-all border border-sky-200"
                          >
                            Abrir
                            <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function etiquetaDeFiltro(f: Filtro): string {
  return FILTRO_ORDER.find(([k]) => k === f)?.[1] ?? f;
}

function referenciaDe(s: Solicitud): string {
  // Sin `numero_referencia` no hay referencia que mostrar: antes se inventaba
  // `SOL-<id>` y el coordinador citaba una cadena que no existe en ningún
  // documento. La celda lo dice ("Sin referencia", id en tooltip) y la búsqueda
  // simplemente no puede coincidir por referencia (P3-10).
  return s.numeroReferencia ?? "";
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    ENVIADA_A_COMPRAS: "Activa",
    EN_COTIZACION: "Esperando cotizaciones",
    COMPARATIVA_LISTA: "Esperando cotizaciones",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

function toneEstado(e: string): BadgeTone {
  if (e === "ENVIADA_A_COMPRAS") return "activa";
  if (e === "EN_COTIZACION" || e === "COMPARATIVA_LISTA") return "cotizaciones";
  if (e === "ENVIADA_A_SOLICITANTE") return "decision";
  if (e === "CERRADA_CON_DECISION" || e === "CERRADA_SIN_DECISION") return "cerrada";
  if (e === "CANCELADA") return "error";
  return "neutral";
}