"use client";

import { useState } from "react";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";
import { Modal } from "@/components/ui-ext/Modal";
import type { Cotizacion, ProsContras } from "@/lib/domain/types";
import { formato } from "@/lib/domain/comparativa";
import { equivalenteOrientativo, formatoMoneda } from "@/lib/domain/moneda";

type VistaPublicaProps = {
  token: string;
  solicitudId: string;
  cotizaciones: Cotizacion[];
  prosContras: Record<string, ProsContras>;
  recomendacion?: string;
  advertenciaGeneral?: string | null;
  /** El solicitante necesita saber si tiene tiempo: sin esto no se avisaba del vencimiento. */
  fechaExpiracion?: string | null;
};

export function VistaPublica({
  token,
  solicitudId,
  cotizaciones,
  prosContras,
  recomendacion,
  advertenciaGeneral,
  fechaExpiracion,
}: VistaPublicaProps) {
  const [elegida, setElegida] = useState<string | null>(null); // id del proveedor
  const [modal, setModal] = useState<{ id: string; nombre: string } | null>(null);
  const [ningunaSirve, setNingunaSirve] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  // "Ninguna me sirve" devuelve la solicitud a Compras: el enlace deja de invitar a decidir
  // (el servidor ya lo rechaza con 409, pero una pantalla que ofrece botones muertos miente).
  const [vuelveACompras, setVuelveACompras] = useState(false);

  const vencimiento = vencimientoEn(fechaExpiracion);
  // Un solo aviso de referencia de moneda (no repetido bajo cada tarjeta).
  const hayVariasMonedas = nuevasMonedas(cotizaciones).length > 1;
  const referenciaMoneda = notaReferencia(hayVariasMonedas, cotizaciones);

  async function enviarDecision(payload: { cotizacionId?: string; ningunaOpcion?: boolean; comentario?: string }) {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/comparativas/${token}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, ...payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "No se pudo registrar la decisión");
      }
      const d = await res.json();
      if (d.vuelveACompras) {
        setVuelveACompras(true);
        setMensaje({
          tipo: "ok",
          texto: "Se notificó a Compras y tu solicitud vuelve a revisión. No se cerró: Compras la va a evaluar.",
        });
        return true;
      }
      setMensaje({
        tipo: "ok",
        texto: "Tu decisión fue registrada. Compras recibirá la notificación.",
      });
      return true;
    } catch (e) {
      setMensaje({
        tipo: "error",
        texto:
          e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message)
            ? "No pudimos registrar tu decisión por un problema de conexión. Tu elección sigue aquí: intentá de nuevo."
            : e instanceof Error
              ? e.message
              : "Error al enviar",
      });
      return false;
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-3 md:p-8 relative overflow-x-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[900px] bg-white/70 backdrop-blur-3xl rounded-3xl border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden relative z-10 p-5 md:p-8">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span className="bg-white/80 border border-slate-200 rounded-full px-2 py-1">Enlace público · sin iniciar sesión</span>
          </div>
          <h1 className="text-2xl font-medium tracking-tight mb-1">Comparativa lista</h1>
          <p className="text-sm text-slate-500">Revisá las opciones y decidí cuál querés.</p>
        </div>

        {vencimiento ? (
          <div
            className={
              "mb-4 rounded-2xl border p-4 flex items-start gap-3 " +
              (vencimiento.critico ? "bg-rose-50/80 border-rose-200" : "bg-slate-50 border-slate-200")
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={vencimiento.critico ? "text-rose-600 mt-0.5" : "text-slate-500 mt-0.5"}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <p className={"text-[13px] leading-relaxed " + (vencimiento.critico ? "text-rose-800 font-medium" : "text-slate-600")}>
              {vencimiento.texto}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 mb-4">Este enlace no tiene fecha de vencimiento.</p>
        )}

        {advertenciaGeneral ? (
          <div className="mb-5 bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-700"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Advertencia</div>
                <div className="text-[13px] font-medium text-amber-900 leading-relaxed">{advertenciaGeneral}</div>
              </div>
            </div>
          </div>
        ) : null}

        {recomendacion ? (
          <div className="mb-5 bg-gradient-to-br from-white to-sky-50/50 rounded-2xl border border-slate-200/60 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-full translate-x-4 -translate-y-4" />
            <div className="flex items-center gap-2 mb-3 relative z-10 flex-wrap">
              <span className="bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>
                Recomendación de Compras
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Humana</span>
            </div>
            <div className="text-sm text-slate-800 font-medium leading-relaxed relative z-10">{recomendacion}</div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-medium text-slate-900">Opciones cotizadas ({cotizaciones.length})</h2>
              <p className="text-[12px] text-slate-500">{referenciaMoneda}</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {vuelveACompras ? "Devuelta a Compras" : "Pendiente de decisión"}
            </span>
          </div>

          {vuelveACompras ? (
            <p className="text-sm text-slate-600 text-center py-8 px-4">
              Esta solicitud volvió a Compras para que evalúen tu pedido. Cuando haya una nueva
              comparativa te la vamos a mandar por correo.
            </p>
          ) : cotizaciones.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              La comparativa todavía no tiene cotizaciones cargadas.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!vuelveACompras && cotizaciones.map((c) => {
                const pc = prosContras[c.id];
                const equiv = equivalenteOrientativo(c.valorTotal, c.moneda);
                return (
                  <div
                    key={c.id}
                    className={
                      "rounded-2xl border bg-white p-5 shadow-sm transition-all h-full flex flex-col " +
                      (elegida === c.id ? "border-sky-300 ring-1 ring-sky-500/20" : "border-slate-200")
                    }
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Proveedor</div>
                        <div className="text-base font-medium text-slate-900 break-words">{c.proveedorNombre}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Total</div>
                        <div className="text-base font-semibold text-slate-900">
                          {c.moneda ? formatoMoneda(c.moneda, c.valorTotal) : `L ${formato(c.valorTotal)}`}
                        </div>
                        {equiv ? (
                          <div className="text-[11px] text-slate-500" title={equiv.nota}>
                            ≈ {equiv.redondeado}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Pros</div>
                        <div className="text-[12px] text-slate-600">{(pc?.pros ?? []).join(" · ") || "no especificado"}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Contras</div>
                        <div className="text-[12px] text-slate-600">{(pc?.contras ?? []).join(" · ") || "no especificado"}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Plazo de entrega</div>
                        <div className="text-[12px] text-slate-700 font-medium break-words">{c.plazoEntrega ?? "no especificado"}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={elegida !== null && elegida !== c.id}
                      onClick={() => setModal({ id: c.id, nombre: c.proveedorNombre })}
                      className={
                        "w-full mt-auto text-sm px-6 min-h-[44px] rounded-full font-medium transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 " +
                        (elegida === c.id
                          ? "bg-green-600 text-white"
                          : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed")
                      }
                    >
                      {elegida === c.id ? "✓ Opción elegida" : "Elegir esta opción"}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={elegida !== null || ningunaSirve || enviando}
            onClick={async () => {
              const ok = await enviarDecision({ ningunaOpcion: true, comentario: undefined });
              if (ok) {
                setNingunaSirve(true);
              }
            }}
            className="mt-4 w-full bg-white text-slate-700 text-sm px-6 min-h-[44px] rounded-full font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
          >
            {enviando ? "Enviando…" : ningunaSirve ? "Se notificó a Compras — la solicitud vuelve a revisión" : "Ninguna me sirve, necesito hablar con Compras"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>
          </button>

          {mensaje ? (
            <div
              role={mensaje.tipo === "error" ? "alert" : "status"}
              aria-live="polite"
              className={
                "mt-4 rounded-xl px-4 py-3 text-sm " +
                (mensaje.tipo === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200")
              }
            >
              {mensaje.texto}
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal de confirmación — role=dialog, aria-modal y trampa de foco (components/ui-ext/Modal). */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Confirmar selección"
        className="max-w-md"
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={async () => {
                if (!modal) return;
                const ok = await enviarDecision({ cotizacionId: modal.id });
                if (ok) {
                  setElegida(modal.id);
                  setModal(null);
                }
              }}
              className="w-full min-h-[44px] rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Confirmar decisión"}
            </button>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="w-full min-h-[44px] rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Estás por elegir <span className="font-semibold text-slate-900">{modal?.nombre}</span>. Esta acción registra tu
          decisión y notifica a Compras para avanzar.
        </p>
      </Modal>
    </main>
  );
}

function nuevasMonedas(cotizaciones: Cotizacion[]): string[] {
  return [...new Set(cotizaciones.map((c) => (c.moneda ?? "L").toUpperCase()))];
}

function notaReferencia(havarias: boolean, cotizaciones: Cotizacion[]): string {
  if (!havarias) {
    return "Los importes se muestran en la moneda de cada proveedor (sin conversión).";
  }
  const monedas = nuevasMonedas(cotizaciones);
  return `Comparás en ${monedas.join(" y ")}: cada total muestra además su equivalente orientativo.`;
}

function vencimientoEn(fechaExpiracion?: string | null): { texto: string; critico: boolean } | null {
  if (!fechaExpiracion) return null;
  const ms = new Date(fechaExpiracion).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = ms - Date.now();
  if (diff <= 0) {
    return { critico: true, texto: "Este enlace expiró. Pedile a Compras uno nuevo para decidir." };
  }
  const horas = diff / (1000 * 60 * 60);
  const fecha = new Date(ms).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" });
  if (horas < 48) {
    return {
      critico: true,
      texto: `Este enlace vence el ${fecha} (en ${Math.max(1, Math.round(horas))} h). Decidí antes de esa hora o pedile a Compras un enlace nuevo.`,
    };
  }
  return { critico: false, texto: `Este enlace vence el ${fecha}.` };
}
