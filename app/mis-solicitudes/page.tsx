"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { TrackerEtapas } from "@/components/TrackerEtapas";
import { duracionAtencion } from "@/lib/domain/semaforo";
import { api, type SalidaCorta } from "@/lib/api-client";
import type { Cotizacion, Solicitud } from "@/lib/domain/types";
import { nombreCategoria } from "@/lib/domain/categorias";

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
  const [detalle, setDetalle] = useState<{ solicitud: Solicitud; cotizaciones: Cotizacion[] } | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);

  async function abrirDetalle(id: string) {
    setDetalleCargando(true);
    try {
      const d = await api.obtenerSolicitudDetalle(id);
      setDetalle(d);
    } catch {
      // fallback: solo el id
      const s = resultados.find((x) => x.id === id);
      if (s) setDetalle({ solicitud: { ...s } as Solicitud, cotizaciones: [] });
    } finally {
      setDetalleCargando(false);
    }
  }

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
      <div className="w-full max-w-[900px] bg-white/70 backdrop-blur-3xl rounded-3xl md:rounded-[2.5rem] border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden relative z-10 p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Mis solicitudes</h1>
            <p className="text-xs text-slate-500 mt-1">Revisá el estado de tus pedidos y comparativas.</p>
          </div>
          <Link href="/" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-sky-600 transition-colors flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Nueva Solicitud
          </Link>
        </div>

        <form onSubmit={buscar} className="mb-8 flex items-end gap-3">
          <div className="flex-1 max-w-[480px]">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Tu correo institucional</label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@bia.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <button type="submit" disabled={!email.includes("@")} className="bg-slate-900 text-white text-xs px-6 py-3 rounded-full font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Ver mis solicitudes
          </button>
        </form>

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
              <Link href="/" className="mt-3 inline-block text-xs font-medium text-sky-600 hover:text-sky-700">Crear una solicitud</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {resultados.map((s) => (
                <button
                  key={s.id}
                  onClick={() => abrirDetalle(s.id)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.numeroReferencia ?? "—"}</div>
                      <h3 className="text-base font-medium text-slate-900">{s.titulo}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SemParoBadge solicitud={s} />
                      <Badge tone={toneDe(s.estado)} label={estadoLegible(s.estado)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Creada: {s.fechaCreacion ? new Date(s.fechaCreacion).toLocaleDateString("es-HN") : "—"}
                    </p>
                    <span className="text-sky-600 text-xs font-semibold flex items-center gap-1">
                      Ver detalle
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Atención: {duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {/* Modal de detalle */}
        {detalle ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetalle(null)} />
            <div className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-lg relative z-10 overflow-hidden step-enter">
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">{detalle.solicitud.numeroReferencia ?? "—"}</span>
                    <SemParoBadge solicitud={detalle.solicitud} />
                    <Badge tone={toneDe(detalle.solicitud.estado)} label={estadoLegible(detalle.solicitud.estado)} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-2">{detalle.solicitud.titulo}</h3>
                </div>
                <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="px-6 py-5 max-h-[60vh] overflow-y-auto no-scrollbar">
                {detalleCargando ? (
                  <p className="text-xs text-slate-500">Cargando detalle…</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-[12px]">
                      <DetalleCampo label="Solicitante" valor={detalle.solicitud.solicitanteNombre} />
                      <DetalleCampo label="Área" valor={detalle.solicitud.areaSolicitante} />
                      <DetalleCampo label="Tipo" valor={detalle.solicitud.tipo ?? "—"} />
                      <DetalleCampo label="Subtipo" valor={detalle.solicitud.subtipo ?? "—"} />
                      <DetalleCampo label="Categoría" valor={nombreCategoria(detalle.solicitud.categoria)} />
                      <DetalleCampo label="Fecha requerida" valor={detalle.solicitud.fechaRequerida ?? "—"} />
                    </div>
                    {detalle.solicitud.descripcion ? (
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Descripción</span>
                        <p className="text-xs text-slate-600 leading-relaxed">{detalle.solicitud.descripcion}</p>
                      </div>
                    ) : null}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">Progreso</span>
                      <TrackerEtapas estado={detalle.solicitud.estado as Parameters<typeof TrackerEtapas>[0]["estado"]} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">Cotizaciones ({detalle.cotizaciones.length})</span>
                      {detalle.cotizaciones.length === 0 ? (
                        <p className="text-xs text-slate-500">Aún no hay cotizaciones cargadas.</p>
                      ) : (
                        <div className="space-y-2">
                          {detalle.cotizaciones.map((c) => (
                            <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg border border-slate-100 px-3 py-2">
                              <span className="text-xs font-medium text-slate-900">{c.proveedorNombre}</span>
                              <span className="text-xs font-mono text-slate-600">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${c.valorTotal}` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setDetalle(null)} className="w-full py-3 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function DetalleCampo({ label, valor }: { label: string; valor?: string }) {
  return (
    <div>
      <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 font-semibold">{label}</span>
      <span className="text-xs font-medium text-slate-900">{valor || "—"}</span>
    </div>
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