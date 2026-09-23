"use client";

import { useState } from "react";
import type { Cotizacion, ProsContras } from "@/lib/domain/types";
import { bloqueoB3Activo } from "@/lib/domain/rules";
import { formato } from "@/lib/domain/comparativa";

type RecomendacionProps = {
  cotizaciones: Cotizacion[];
  prosContras: Record<string, ProsContras>;
  sugerenciaIA?: string;
  cotizacionSugeridaId?: string;
  enlace?: { token: string; url: string } | null;
  onEnviar: (recomendacion: string) => Promise<boolean>; // real: PATCH a ENVIADA_A_SOLICITANTE, retorna si se envió
};

export function Recomendacion({ cotizaciones, prosContras, sugerenciaIA, cotizacionSugeridaId, enlace, onEnviar }: RecomendacionProps) {
  const [recomendacion, setRecomendacion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sugerida = cotizaciones.find((c) => c.id === cotizacionSugeridaId);
  const bloqueado = bloqueoB3Activo(recomendacion);

  if (enviado) {
    return (
      <div className="step-enter bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-16 -left-20 w-72 h-72 rounded-full bg-gradient-to-r from-emerald-200/30 to-sky-500/10 blur-[70px]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-100 px-2.5 py-1.5 rounded-xl">ENVIADA_A_SOLICITANTE</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-2">Comparativa enviada</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">La solicitud queda en espera de la decisión del solicitante. El ciclo del coordinador termina aquí.</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-900">Enlace público (token)</div>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly defaultValue={enlace?.url ?? "Generando enlace…"} title={enlace?.url} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700" />
                <button onClick={() => { if (enlace) { navigator.clipboard?.writeText(enlace.url); setCopiado(true); } }} className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200">{copiado ? "Copiado" : "Copiar"}</button>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">Se incluye en el correo al solicitante.</div>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-900">Estado</div>
              <div className="mt-2 text-[11px] text-slate-600 leading-relaxed">Transición: <span className="font-semibold text-slate-900">COMPARATIVA_LISTA → ENVIADA_A_SOLICITANTE</span></div>
              <div className="mt-2 text-[11px] text-slate-600">Siguiente: <span className="font-semibold">Decisión del solicitante</span></div>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-900">Notificación</div>
              <div className="mt-2 text-[11px] text-slate-600 leading-relaxed">Correo 3 disparado al solicitante con el enlace público.</div>
              <div className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                Entregado (simulado)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="step-enter">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">09 · Recomendación</h3>
        <p className="text-[11px] text-slate-500 mt-1">Punto de control humano (RN-01). Podés contradecir la sugerencia de la IA sin fricción.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {cotizaciones.map((c) => {
          const pc = prosContras[c.id];
          return (
            <div key={c.id} className={"bg-white rounded-2xl border p-4 shadow-sm " + (c.id === cotizacionSugeridaId ? "border-sky-200 ring-1 ring-sky-500/20" : "border-slate-200/60")}>
              <div className="text-xs font-semibold text-slate-900">{c.proveedorNombre}</div>
              <div className="text-[11px] text-slate-500 mt-1">Total: <span className="font-semibold text-slate-900">{c.moneda ?? "L"} {formato(c.valorTotal)}</span></div>
              <div className="mt-3 text-[11px]">
                <div className="text-green-700 font-semibold">✓ Pros</div>
                <ul className="mt-1 space-y-1 text-slate-600">{(pc?.pros ?? []).map((p) => <li key={p}>{p}</li>)}</ul>
                <div className="mt-2 text-rose-700 font-semibold">✗ Contras</div>
                <ul className="mt-1 space-y-1 text-slate-600">{(pc?.contras ?? []).map((c2) => <li key={c2}>{c2}</li>)}</ul>
              </div>
            </div>
          );
        })}
      </div>

      {sugerenciaIA ? (
        <div className="bg-gradient-to-br from-white to-sky-50/40 rounded-2xl border border-slate-200/60 p-5 shadow-sm mb-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-sky-500/10 blur-[45px]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-sky-500 text-white text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 3 3 5 6 1-4 4 1 6-6-2-6 2 1-6-4-4 6-1z"/></svg>
                Sugerencia del asistente (IA)
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Solo un insumo</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">Proveedor sugerido: {sugerida?.proveedorNombre ?? "—"}</div>
            <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">{sugerenciaIA}</div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <label className="block text-xs font-semibold text-slate-900 mb-2">
          Recomendación del coordinador <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={recomendacion}
          onChange={(e) => setRecomendacion(e.target.value)}
          rows={4}
          placeholder="Escribí tu criterio para el solicitante: qué conviene, riesgos, qué falta confirmar, etc."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all resize-none"
        />
        {bloqueado ? (
          <div className="mt-2 text-[11px] text-amber-700 flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-[1px]"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Escribí tu recomendación antes de enviar. El solicitante decide, pero tu criterio es lo que más le sirve para decidir.
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={bloqueado || enviando}
            onClick={async () => {
              setErrorEnvio(null);
              setEnviando(true);
              const ok = await onEnviar(recomendacion);
              setEnviando(false);
              if (ok) setEnviado(true);
              else setErrorEnvio("No se pudo enviar. Revisá la conexión e intentá de nuevo.");
            }}
            className="bg-sky-500 text-white text-xs px-7 py-3 rounded-full font-medium hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            {enviando ? "Enviando…" : "Enviar comparativa al solicitante"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          </button>
        </div>
        {errorEnvio ? (
          <div className="mt-2 rounded-xl px-3 py-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200">{errorEnvio}</div>
        ) : (
          <div className="mt-2 text-[10px] text-slate-500">Bloqueo duro B3: se valida también en el servidor.</div>
        )}
      </div>
    </div>
  );
}