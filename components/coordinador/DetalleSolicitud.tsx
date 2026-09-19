"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargaCotizaciones } from "./CargaCotizaciones";
import { ComparativaView } from "./Comparativa";
import { Recomendacion } from "./Recomendacion";
import { api } from "@/lib/api-client";
import { nombreCategoria } from "@/lib/domain/categorias";
import type { Cotizacion, Comparativa, Decision, Solicitud } from "@/lib/domain/types";

type Etapa = 7 | 8 | 9;

const ESTADOS_TERMINALES = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"];

type DetalleSolicitudProps = {
  solicitud: Solicitud;
  decision?: Decision;
  proveedorElegido?: string;
};

export function DetalleSolicitud({ solicitud, decision, proveedorElegido }: DetalleSolicitudProps) {
  const router = useRouter();
  const terminal = ESTADOS_TERMINALES.includes(solicitud.estado);
  const [etapa, setEtapa] = useState<Etapa>(7);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [comparativaData, setComparativaData] = useState<Comparativa | undefined>(undefined);
  const [enlaceEnviado, setEnlaceEnviado] = useState<{ token: string; url: string } | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // Cancela la solicitud (3.5): disponible para coordinador y admin; registra evento CANCELADA.
  async function cancelarSolicitud() {
    if (!window.confirm("¿Cancelar esta solicitud? El proceso se cerrará y quedará registrado como CANCELADA.")) return;
    setCancelando(true);
    setErrorEnvio(null);
    try {
      await api.transicionar({
        solicitudId: solicitud.id,
        hacia: "CANCELADA",
        actorTipo: "coordinador",
        nota: "Cancelada desde el panel por el coordinador",
      });
      router.refresh();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo cancelar la solicitud");
    } finally {
      setCancelando(false);
    }
  }

  async function enviarComparativa(recomendacion: string): Promise<boolean> {
    if (!comparativaData) return false;
    setErrorEnvio(null);
    try {
      const res = await api.transicionar({
        solicitudId: solicitud.id,
        hacia: "ENVIADA_A_SOLICITANTE",
        actorTipo: "coordinador",
        nota: recomendacion,
      });
      if (res.enlace) setEnlaceEnviado(res.enlace);
      return true;
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar");
      return false;
    }
  }

  useEffect(() => {
    api
      .listarCotizaciones(solicitud.id)
      .then((c) => setCotizaciones(c))
      .catch(() => setCotizaciones([]))
      .finally(() => setCargando(false));
  }, [solicitud.id]);

  const tieneComparativa = useMemo(
    () => cotizaciones.length >= 2,
    [cotizaciones.length]
  );

  const generandoComparativa = etapa === 8 && !comparativaData;

  // Genera la comparativa con IA en el SERVIDOR (route /api/solicitudes/[id]/comparativa),
  // que hace la llamada a OpenRouter con la clave y cae a fallback determinístico si falla.
  useEffect(() => {
    if (terminal || !tieneComparativa || comparativaData || etapa === 7) return;
    let activo = true;
    api
      .generarComparativa(solicitud.id)
      .then((c) => {
        if (activo) setComparativaData(c);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [tieneComparativa, comparativaData, solicitud.id, etapa, terminal]);

  const tabs: { n: Etapa; label: string }[] = [
    { n: 7, label: "07 · Cotizaciones" },
    { n: 8, label: "08 · Comparativa" },
    { n: 9, label: "09 · Recomendación" },
  ];

  return (
    <div className="pt-2">
      {/* Banda de solicitud cerrada: muestra la decisión y congela el flujo */}
      {terminal ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-emerald-900">
              {solicitud.estado === "CANCELADA"
                ? "Solicitud cancelada"
                : decision?.ningunaOpcion
                  ? "Cerrada sin decisión — el solicitante no eligió ninguna opción"
                  : solicitud.estado === "CERRADA_SIN_DECISION"
                    ? "Cerrada sin decisión"
                    : "Solicitud cerrada con decisión"}
            </div>
            <div className="text-xs text-emerald-800 mt-0.5">
              {decision && !decision.ningunaOpcion
                ? <>El solicitante eligió <span className="font-semibold">{proveedorElegido ?? "una opción"}</span>{solicitud.fechaCierre ? <> · {new Date(solicitud.fechaCierre).toLocaleDateString("es-HN")}</> : null}.</>
                : "El ciclo terminó; no hay acciones pendientes para Compras."}
            </div>
          </div>
        </div>
      ) : null}

      {/* Barra superior con Volver bien posicionado */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/panel" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/70 hover:bg-white transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
          Volver al panel
        </Link>
        <div className="flex items-center gap-2">
          {terminal ? null : (
            <button
              type="button"
              onClick={cancelarSolicitud}
              disabled={cancelando}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold tracking-tight transition-colors text-rose-600 hover:bg-rose-50 border border-rose-200 bg-white/70 disabled:opacity-50"
              title="Cancela la solicitud (queda registrada como CANCELADA)"
            >
              {cancelando ? "Cancelando…" : "Cancelar solicitud"}
            </button>
          )}
          {errorEnvio ? <span className="text-[10px] text-rose-600">{errorEnvio}</span> : null}
          {tabs.map((t) => (
            <button
              key={t.n}
              type="button"
              aria-pressed={etapa === t.n}
              disabled={!tieneComparativa && t.n === 8}
              onClick={() => setEtapa(t.n)}
              className={
                "px-4 py-2.5 rounded-xl text-sm font-semibold tracking-tight transition-colors " +
                (etapa === t.n ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-white/70")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8">
              {errorEnvio ? (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm text-rose-700 bg-rose-50 border border-rose-200">{errorEnvio}</div>
              ) : null}
              {cargando ? (
                <p className="text-sm text-slate-500">Cargando cotizaciones…</p>
              ) : etapa === 7 ? (
                <CargaCotizaciones
                  solicitudId={solicitud.id}
                  cotizaciones={cotizaciones}
                  soloLectura={terminal}
                  onCotizacionCargada={() =>
                    api
                      .listarCotizaciones(solicitud.id)
                      .then((c) => setCotizaciones(c))
                      .catch(() => undefined)
                  }
                  onGenerar={() => setEtapa(8)}
                />
              ) : etapa === 8 ? (
                comparativaData ? (
                  <ComparativaView solicitudId={solicitud.id} comparativa={comparativaData} cotizaciones={cotizaciones} onContinuar={() => setEtapa(9)} />
                ) : (
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    {generandoComparativa ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                        Generando comparativa…
                      </>
                    ) : (
                      "Se necesitan al menos 2 cotizaciones cargadas para generar la comparativa."
                    )}
                  </p>
                )
              ) : (
                <Recomendacion 
                  cotizaciones={cotizaciones} 
                  prosContras={comparativaData?.prosContras ?? {}} 
                  sugerenciaIA={comparativaData?.sugerenciaIA} 
                  cotizacionSugeridaId={comparativaData?.cotizacionSugeridaId} 
                  enlace={enlaceEnviado} 
                  onEnviar={enviarComparativa} 
                />
              )}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 flex items-center gap-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">{solicitud.solicitanteNombre}</div>
                <div className="text-sm text-slate-500">{solicitud.areaSolicitante ?? "—"}</div>
              </div>
            </div>
            <div className="p-5 bg-slate-50/50">
              <div className="text-sm text-slate-600 leading-relaxed">{solicitud.descripcion || "Sin descripción."}</div>
              <div className="mt-3 flex items-center gap-2 text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                <span className="text-sm font-medium text-slate-700">{solicitud.solicitanteEmail}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/></svg>
              Detalles de la solicitud
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Categoría</span>
                <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-right">{nombreCategoria(solicitud.categoria)}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Subtipo</span>
                <span className="font-semibold text-slate-900 text-right">{solicitud.subtipo ? (solicitud.subtipo === "producto" ? "Producto" : "Servicio") : "Por definir"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha requerida</span>
                {solicitud.fechaRequerida ? (
                  <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">{solicitud.fechaRequerida}</span>
                ) : (
                  <span className="text-slate-400 font-medium">Por definir</span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}