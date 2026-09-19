"use client";

import { useRef, useState } from "react";
import type { Cotizacion } from "@/lib/domain/types";
import { api } from "@/lib/api-client";

type CargaCotizacionesProps = {
  solicitudId: string;
  cotizaciones: Cotizacion[];
  onCotizacionCargada: () => void;
  onGenerar: () => void;
  // Solicitud cerrada/cancelada: se muestra solo lectura (sin agregar/editar/eliminar ni generar).
  soloLectura?: boolean;
};

type FormCotizacion = {
  proveedorNombre: string;
  moneda: string;
  valorNeto: string;
  montoIsv: string;
  valorTotal: string;
  plazoEntrega: string;
};

const FORM_VACIO: FormCotizacion = {
  proveedorNombre: "",
  moneda: "HNL",
  valorNeto: "",
  montoIsv: "",
  valorTotal: "",
  plazoEntrega: "",
};

export function CargaCotizaciones({ solicitudId, cotizaciones, onCotizacionCargada, onGenerar, soloLectura = false }: CargaCotizacionesProps) {
  const [form, setForm] = useState<FormCotizacion>(FORM_VACIO);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borradorEdit, setBorradorEdit] = useState<Partial<Cotizacion> | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faseSubida, setFaseSubida] = useState<string | null>(null);
  const [confirmarGenerar, setConfirmarGenerar] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const count = cotizaciones.length;

  function set<K extends keyof FormCotizacion>(key: K, valor: FormCotizacion[K]) {
    setForm((f) => ({ ...f, [key]: valor }));
  }

  function formValido() {
    return form.proveedorNombre.trim().length > 0;
  }

  async function crearManual() {
    if (!formValido()) return;
    setCreando(true);
    setError(null);
    try {
      await api.crearCotizacionManual({
        solicitudId,
        proveedorNombre: form.proveedorNombre.trim(),
        moneda: form.moneda || "HNL",
        valorNeto: numero(form.valorNeto),
        montoIsv: numero(form.montoIsv),
        valorTotal: numero(form.valorTotal),
        plazoEntrega: form.plazoEntrega.trim() || undefined,
      });
      setForm(FORM_VACIO);
      setMostrandoForm(false);
      onCotizacionCargada();
    } catch {
      setError("No se pudo crear la cotización.");
    } finally {
      setCreando(false);
    }
  }

  // Sube el archivo real → conversión markitdown → extracción IA. Nunca bloquea.
  async function onFileSeleccionado(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const c = cotizaciones[idx];
    if (!file || !c) return;
    setFaseSubida(c.id ?? `${idx}`);
    setError(null);
    try {
      const conv = await api.convertirDocumento(file);
      await api.cargarCotizacionConArchivo({
        solicitudId,
        proveedorNombre: c.proveedorNombre,
        formatoOriginal: extFormato(file.name),
        archivo: file,
        markdownExtraido: conv.ok ? conv.markdown : undefined,
      });
      onCotizacionCargada();
      if (!conv.ok) setError(conv.error ?? "No se pudo extraer datos automáticamente.");
    } catch {
      setError("No se pudo subir. Intenta de nuevo.");
    } finally {
      setFaseSubida(null);
    }
    if (fileInputs.current[c.id]?.value !== undefined) fileInputs.current[c.id]!.value = "";
  }

  async function guardarEdicion() {
    if (!editandoId || !borradorEdit) return;
    setError(null);
    try {
      await api.actualizarCotizacion(editandoId, {
        proveedorNombre: borradorEdit.proveedorNombre,
        moneda: borradorEdit.moneda,
        valorNeto: borradorEdit.valorNeto,
        montoIsv: borradorEdit.montoIsv,
        valorTotal: borradorEdit.valorTotal,
        plazoEntrega: borradorEdit.plazoEntrega,
      });
      setEditandoId(null);
      setBorradorEdit(null);
      onCotizacionCargada();
    } catch {
      setError("No se pudo guardar la edición.");
    }
  }

  async function borrar(c: Cotizacion) {
    setBorrandoId(c.id);
    setError(null);
    try {
      await api.eliminarCotizacion(c.id);
      setBorrandoId(null);
      onCotizacionCargada();
    } catch {
      setBorrandoId(null);
      setError("No se pudo eliminar la cotización.");
    }
  }

  return (
    <div className="step-enter">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Cotizaciones de proveedores</h3>
          <p className="text-sm text-slate-500 mt-1">Cargá cada oferta con sus datos, o adjuntá el archivo del proveedor para que la IA la lea.</p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">Mínimo 2 para comparativa</div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {error}
        </div>
      ) : null}

      {!soloLectura ? (
          <button
            type="button"
            onClick={() => { setMostrandoForm((v) => !v); setError(null); }}
            className="w-full mb-5 border-2 border-dashed border-slate-300 rounded-2xl py-5 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/40 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            {mostrandoForm ? "Cancelar" : "Agregar cotización manual"}
          </button>
        ) : null}

      {mostrandoForm ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 step-enter">
          <div className="text-base font-semibold text-slate-900 mb-5">Nueva cotización</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block md:col-span-3">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Proveedor</span>
              <input
                type="text"
                value={form.proveedorNombre}
                onChange={(e) => set("proveedorNombre", e.target.value)}
                placeholder="Ej. Imprenta CostaPrint S. de R.L."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Moneda</span>
              <select
                value={form.moneda}
                onChange={(e) => set("moneda", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer"
              >
                <option>HNL</option>
                <option>USD</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Valor neto</span>
              <input
                type="number"
                value={form.valorNeto}
                onChange={(e) => set("valorNeto", e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">ISV</span>
              <input
                type="number"
                value={form.montoIsv}
                onChange={(e) => set("montoIsv", e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Total</span>
              <input
                type="number"
                value={form.valorTotal}
                onChange={(e) => set("valorTotal", e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Plazo de entrega</span>
              <input
                type="text"
                value={form.plazoEntrega}
                onChange={(e) => set("plazoEntrega", e.target.value)}
                placeholder="Ej. 12 días"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </label>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setMostrandoForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!formValido() || creando}
              onClick={crearManual}
              className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {creando ? "Guardando…" : "Guardar cotización"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {cotizaciones.map((c, idx) => {
          const esEditando = editandoId === c.id;
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={"px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border " + (c.formatoOriginal === "manual" ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-sky-50 text-sky-700 border-sky-200")}>
                      {c.formatoOriginal === "manual" ? "Manual" : c.formatoOriginal.toUpperCase()}
                    </span>
                    <span className="text-base font-semibold text-slate-900">{c.proveedorNombre}</span>
                    {c.plazoEntrega ? <span className="text-sm text-slate-500">· entrega {c.plazoEntrega}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-1">
                    <span><span className="text-slate-400">Neto:</span> <span className="font-semibold text-slate-900">{c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${numeroFmt(c.valorNeto)}` : "—"}</span></span>
                    {c.montoIsv !== undefined ? <span><span className="text-slate-400">ISV:</span> <span className="font-semibold text-slate-900">{numeroFmt(c.montoIsv)}</span></span> : null}
                    <span><span className="text-slate-400">Total:</span> <span className="font-semibold text-slate-900">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${numeroFmt(c.valorTotal)}` : "—"}</span></span>
                    {c.fechaCarga ? <span className="text-xs text-slate-400">({new Date(c.fechaCarga).toLocaleDateString("es-HN")})</span> : null}
                  </div>

                  {camposBajaConfianza(c).length > 0 ? (
                    <div className="mt-3 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      <span className="text-sm">
                        Revisión manual requerida: campos con baja confianza de extracción — <span className="font-semibold">{camposBajaConfianza(c).join(", ")}</span>. Verificá estos datos antes de generar la comparativa.
                      </span>
                    </div>
                  ) : null}

                  {mostrarConfianza(c) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="uppercase tracking-wider text-slate-400 font-semibold">Confianza IA:</span>
                      {Object.entries(c.confianzaExtraccion ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => (
                        <span key={k} className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full border " + (v! < 0.5 ? "bg-amber-50 border-amber-200 text-amber-700" : v! < 0.8 ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-emerald-50 border-emerald-200 text-emerald-700")}>
                          {nombreCampo(k)} {Math.round(v! * 100)}%
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {c.observacionesFiscales ? (
                    <div className="mt-3 flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                      <span className="text-sm"><span className="font-semibold">Revisión fiscal:</span> {c.observacionesFiscales}</span>
                    </div>
                  ) : null}

                  {faseSubida === c.id ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      Extrayendo datos con IA…
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {!soloLectura ? (
                    <>
                      <label
                        htmlFor={`file-${c.id}`}
                        className={"inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border shadow-sm transition-colors cursor-pointer " + (c.formatoOriginal !== "manual" ? "text-green-700 bg-green-50/60 border-green-200" : "text-slate-700 hover:text-slate-900 bg-white border-slate-200")}
                      >
                        {c.formatoOriginal !== "manual" ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                            Con archivo
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05a10 10 0 1 1-18.88 0A10 10 0 0 1 12 2a9.7 9.7 0 0 1 6.36 2.4M22 2l-2.5 4.5M16 6.5 22 2"/></svg>
                            Adjuntar archivo
                          </>
                        )}
                      </label>
                      <input
                        id={`file-${c.id}`}
                        type="file"
                        hidden
                        ref={(el) => { fileInputs.current[c.id] = el; }}
                        onChange={(e) => onFileSeleccionado(idx, e)}
                        accept=".pdf,.doc,.docx,image/*"
                      />
                      {esEditando ? (
                        <button type="button" onClick={guardarEdicion} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                          Guardar
                        </button>
                      ) : (
                        <>
                          {c.archivoNombreOriginal ? (
                            <a
                              href={`/api/solicitudes/${solicitudId}/cotizaciones/${c.id}/archivo`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-sky-700 hover:bg-sky-50 border border-sky-200 transition-colors"
                              title="Descargar el archivo original de esta cotización"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                              PDF
                            </a>
                          ) : null}
                          <button type="button" onClick={() => { setEditandoId(c.id); setBorradorEdit({ ...c }); }} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                            Editar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setBorrandoId(c.id)}
                        className="inline-flex items-center p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        aria-label={`Eliminar ${c.proveedorNombre}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {esEditando && borradorEdit ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 pb-5 border-t border-slate-100 pt-4 bg-slate-50/50">
                  {(["proveedorNombre", "moneda", "valorNeto", "valorTotal", "plazoEntrega"] as const).map((campo) => (
                    <CampoEdicion key={campo} campo={campo} borrador={borradorEdit} setBorrador={setBorradorEdit} />
                  ))}
                  <div className="col-span-2 md:col-span-5 text-xs text-slate-400 mt-1">La edición se guarda al presionar &quot;Guardar&quot;.</div>
                </div>
              ) : null}
            </div>
          );
        })}

        {cotizaciones.length === 0 ? (
          <div className="text-center py-12 bg-white/60 rounded-2xl border border-slate-200/60">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 12h6M9 16h6M9 8h1"/></svg>
            </div>
            <div className="text-base font-semibold text-slate-900">Todavía no hay cotizaciones</div>
            <div className="text-sm text-slate-500 mt-1">Agregá la primera con el botón de arriba, o adjuntá el archivo de un proveedor.</div>
          </div>
        ) : null}
      </div>

      {!soloLectura ? (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">Generar comparativa</div>
              {count < 2 ? (
                <div className="text-sm text-amber-700 mt-1 flex items-start gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-[1px]"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  Se necesitan al menos 2 cotizaciones para generar una comparativa.
                </div>
              ) : (
                <div className="text-sm text-slate-500 mt-1">La IA analizará las {count} cotizaciones y generará la comparativa.</div>
              )}
            </div>
            <button
              type="button"
              disabled={count < 2}
              onClick={() => setConfirmarGenerar(true)}
              className="bg-slate-900 text-white text-sm px-6 py-3 rounded-full font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              Generar comparativa
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* Confirmación de borrado */}
      {borrandoId ? (
        <Modal onCerrar={() => setBorrandoId(null)}>
          <div className="text-base font-semibold text-slate-900">¿Eliminar esta cotización?</div>
          <p className="text-sm text-slate-500 mt-2">La oferta de {cotizaciones.find((c) => c.id === borrandoId)?.proveedorNombre} se quitará de la solicitud. No se puede deshacer.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setBorrandoId(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => borrar(cotizaciones.find((c) => c.id === borrandoId)!).then(() => setBorrandoId(null))} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors">
              {borrandoId === borrandoId ? "Sí, eliminar" : "Eliminando…"}
            </button>
          </div>
        </Modal>
      ) : null}

      {/* Confirmación de generar comparativa */}
      {confirmarGenerar ? (
        <Modal onCerrar={() => setConfirmarGenerar(false)}>
          <div className="text-base font-semibold text-slate-900">Generar comparativa?</div>
          <p className="text-sm text-slate-500 mt-2">La IA analizará las {count} cotizaciones cargadas. Podés volver a esta vista y seguir editando después.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmarGenerar(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => { setConfirmarGenerar(false); onGenerar(); }} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors">
              Sí, generar
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md relative z-10 p-6 step-enter">
        {children}
      </div>
    </div>
  );
}

function CampoEdicion({
  campo, borrador, setBorrador,
}: {
  campo: "proveedorNombre" | "moneda" | "valorNeto" | "valorTotal" | "plazoEntrega";
  borrador: Partial<Cotizacion>;
  setBorrador: (b: Partial<Cotizacion>) => void;
}) {
  const labels: Record<string, string> = {
    proveedorNombre: "Proveedor",
    moneda: "Moneda",
    valorNeto: "Valor neto",
    valorTotal: "Total",
    plazoEntrega: "Plazo",
  };
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{labels[campo]}</span>
      {campo === "moneda" ? (
        <select
          value={borrador.moneda ?? "HNL"}
          onChange={(e) => setBorrador({ ...borrador, moneda: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
        >
          <option>HNL</option>
          <option>USD</option>
        </select>
      ) : campo === "proveedorNombre" || campo === "plazoEntrega" ? (
        <input
          type="text"
          value={borrador[campo] ?? ""}
          onChange={(e) => setBorrador({ ...borrador, [campo]: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
        />
      ) : (
        <input
          type="number"
          value={borrador[campo] ?? ""}
          onChange={(e) => setBorrador({ ...borrador, [campo]: e.target.value === "" ? undefined : Number(e.target.value) })}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
        />
      )}
    </label>
  );
}

function numero(s?: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function camposBajaConfianza(c: Cotizacion): string[] {
  const conf = c.confianzaExtraccion ?? {};
  return Object.entries(conf)
    .filter(([, v]) => typeof v === "number" && v >= 0 && v < 0.5)
    .map(([k]) => nombreCampo(k));
}

function mostrarConfianza(c: Cotizacion): boolean {
  const conf = c.confianzaExtraccion ?? {};
  const claves = Object.entries(conf).filter(([, v]) => typeof v === "number" && v >= 0);
  return claves.length > 0;
}

function nombreCampo(clave: string): string {
  const nombres: Record<string, string> = {
    proveedorNombre: "Proveedor",
    valorNeto: "Valor neto",
    montoIsv: "ISV",
    valorTotal: "Total",
    plazoEntrega: "Plazo",
    moneda: "Moneda",
    impuestosDesglosados: "Impuestos",
  };
  return nombres[clave] ?? clave;
}

function numeroFmt(n: number): string {
  return n.toLocaleString("es-HN", { maximumFractionDigits: 2 });
}

function extFormato(nombre: string): "pdf" | "docx" | "imagen" {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "docx";
  return "imagen";
}