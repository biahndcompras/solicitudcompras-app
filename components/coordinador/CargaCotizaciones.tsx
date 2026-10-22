"use client";

import { useRef, useState } from "react";
import type { Cotizacion } from "@/lib/domain/types";
import { api } from "@/lib/api-client";
import { Modal } from "./Modal";

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
  const [subiendoNueva, setSubiendoNueva] = useState(false);
  const inputNueva = useRef<HTMLInputElement | null>(null);
  const [confirmarGenerar, setConfirmarGenerar] = useState(false);

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

  // Sube un archivo y CREA una cotización con lo que la IA extraiga (4.13.16, opción B).
  // Antes el botón vivía dentro de cada tarjeta y duplicaba; y sin cotizaciones no había
  // ninguna forma de subir un archivo: solo el alta manual.
  async function onArchivoNueva(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoNueva(true);
    setError(null);
    try {
      const conv = await api.convertirDocumento(file);
      // Si el archivo fue RECHAZADO (formato viejo, >4 MB o no es una cotización), no se crea
      // nada: antes quedaba una cotización vacía "Proveedor por definir". Solo se degrada a
      // carga manual cuando el fallo es transitorio (IA caída), para no perder el archivo.
      if (!conv.ok && conv.status !== undefined && [400, 413, 415, 422].includes(conv.status)) {
        setError(conv.error ?? "No se pudo leer el archivo.");
        return;
      }
      await api.cargarCotizacionConArchivo({
        solicitudId,
        // Si la IA no reconoce el proveedor, el coordinador lo corrige con Editar.
        proveedorNombre: "Proveedor por definir",
        formatoOriginal: extFormato(file.name),
        archivo: file,
        markdownExtraido: conv.ok ? conv.markdown : undefined,
      });
      onCotizacionCargada();
      if (!conv.ok) setError(conv.error ?? "No se pudo extraer datos automáticamente.");
    } catch (e) {
      // Mostrar el mensaje REAL del servidor (p. ej. "no parece una cotización"), no uno genérico.
      setError(e instanceof Error && e.message ? e.message : "No se pudo subir. Intente de nuevo.");
    } finally {
      setSubiendoNueva(false);
      if (inputNueva.current) inputNueva.current.value = "";
    }
  }

  async function guardarEdicion() {
    if (!editandoId || !borradorEdit) return;
    setError(null);
    try {
      await api.actualizarCotizacion(solicitudId, editandoId, {
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
      await api.eliminarCotizacion(solicitudId, c.id);
      setBorrandoId(null);
      onCotizacionCargada();
    } catch {
      setBorrandoId(null);
      setError("No se pudo eliminar la cotización.");
    }
  }

  return (
    <div className="step-enter">
      {/* Cabecera: en una solicitud terminal la vista es de consulta. Sin imperativos
          ni umbral de "mínimo 2": el ciclo ya terminó y no hay nada que hacer acá (P1-4). */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-ink">
            {soloLectura ? "Cotizaciones registradas" : "Cotizaciones de proveedores"}
          </h3>
          <p className="text-sm text-body mt-1">
            {soloLectura
              ? count === 0
                ? "No se registraron ofertas de proveedores para comparar. El ciclo está cerrado."
                : `Estas son las ${count} ${count === 1 ? "oferta cargada" : "ofertas cargadas"} con las que se comparó esta solicitud. El ciclo está cerrado.`
              : "Cargue cada oferta con sus datos, o adjunte el archivo del proveedor para que la IA la lea."}
          </p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-body bg-surface-soft border border-hairline px-3 py-2 rounded-sm">
          {soloLectura
            ? count === 0
              ? "Sin ofertas"
              : `${count} ${count === 1 ? "registrada" : "registradas"}`
            : "Mínimo 2 para comparativa"}
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 text-sm text-ink bg-surface-soft border border-hairline rounded-sm px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {error}
        </div>
      ) : null}

      {!soloLectura ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => { setMostrandoForm((v) => !v); setError(null); }}
            className="border border-dashed border-[var(--color-border-hairline)] rounded-sm py-4 min-h-[44px] flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:border-sky-400 hover:text-ink hover:bg-surface-soft/40 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            {mostrandoForm ? "Cancelar" : "Agregar cotización manual"}
          </button>
          <button
            type="button"
            onClick={() => inputNueva.current?.click()}
            disabled={subiendoNueva}
            className="border border-dashed border-[var(--color-border-hairline)] rounded-sm py-4 min-h-[44px] flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:border-sky-400 hover:text-ink hover:bg-surface-soft/40 transition-all disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12m0-12 4 4m-4-4-4 4"/></svg>
            {subiendoNueva ? "Extrayendo datos…" : "Subir cotización desde archivo"}
          </button>
          <input
            ref={inputNueva}
            type="file"
            hidden
            aria-label="Subir cotización desde archivo"
            accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
            onChange={onArchivoNueva}
          />
        </div>
      ) : null}

      {mostrandoForm ? (
        <div className="bg-canvas rounded-sm border border-hairline  p-6 mb-6 step-enter">
          <div className="text-base font-semibold text-ink mb-5">Nueva cotización</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block md:col-span-3">
              <span className="block text-sm font-medium text-ink mb-1.5">Proveedor</span>
              <input
                type="text"
                value={form.proveedorNombre}
                onChange={(e) => set("proveedorNombre", e.target.value)}
                placeholder="Ej. Imprenta CostaPrint S. de R.L."
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-canvas transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">Moneda</span>
              <select
                value={form.moneda}
                onChange={(e) => set("moneda", e.target.value)}
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer"
              >
                <option>HNL</option>
                <option>USD</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">Valor neto</span>
              <input
                type="number"
                value={form.valorNeto}
                onChange={(e) => set("valorNeto", e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-canvas transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">ISV</span>
              <input
                type="number"
                value={form.montoIsv}
                onChange={(e) => set("montoIsv", e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-canvas transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">Total</span>
              <input
                type="number"
                value={form.valorTotal}
                onChange={(e) => set("valorTotal", e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-canvas transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">Plazo de entrega</span>
              <input
                type="text"
                value={form.plazoEntrega}
                onChange={(e) => set("plazoEntrega", e.target.value)}
                placeholder="Ej. 12 días"
                className="w-full bg-surface-soft border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-canvas transition-all"
              />
            </label>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setMostrandoForm(false)} className="px-4 py-2.5 rounded-sm text-sm font-medium text-body hover:bg-surface-soft transition-colors">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!formValido() || creando}
              onClick={crearManual}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm px-6 py-2.5 rounded-sm font-semibold hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {creando ? "Guardando…" : "Guardar cotización"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {cotizaciones.map((c) => {
          const esEditando = editandoId === c.id;
          const bajaConfianza = camposBajaConfianza(c);
          const observacionFiscal = c.observacionesFiscales;
          return (
            <div key={c.id} className="bg-canvas rounded-sm border border-hairline  overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={"px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border " + tonoFormato(c)}>
                      {c.formatoOriginal === "manual" ? "Manual" : c.formatoOriginal.toUpperCase()}
                    </span>
                    <span className="text-base font-semibold text-ink">{c.proveedorNombre}</span>
                    {c.plazoEntrega ? <span className="text-sm text-body">· entrega {c.plazoEntrega}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-body mt-1">
                    <span><span className="text-body">Neto:</span> <span className="font-semibold text-ink">{c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${numeroFmt(c.valorNeto)}` : "—"}</span></span>
                    {c.montoIsv !== undefined ? <span><span className="text-body">ISV:</span> <span className="font-semibold text-ink">{numeroFmt(c.montoIsv)}</span></span> : null}
                    <span><span className="text-body">Total:</span> <span className="font-semibold text-ink">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${numeroFmt(c.valorTotal)}` : "—"}</span></span>
                    {c.fechaCarga ? <span className="text-xs text-body">({new Date(c.fechaCarga).toLocaleDateString("es-HN")})</span> : null}
                  </div>

                  {bajaConfianza.length > 0 ? (
                    /* Aviso accionable solo si la solicitud sigue viva: en una terminal
                       se convierte en registro de lo que se detectó (P1-4). */
                    soloLectura ? (
                      <div className="mt-3 flex items-start gap-2 text-body bg-surface-soft border border-hairline rounded-sm px-3 py-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0 text-body"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        <span className="text-sm">
                          Campos que la IA marcó con baja confianza de extracción: <span className="font-semibold">{bajaConfianza.join(", ")}</span>. El ciclo está cerrado, así que no queda acción pendiente sobre ellos.
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-start gap-2 text-ink bg-surface-soft border border-hairline rounded-sm px-3 py-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        <span className="text-sm">
                          Revisión manual requerida: campos con baja confianza de extracción — <span className="font-semibold">{bajaConfianza.join(", ")}</span>. Verifique estos datos antes de generar la comparativa.
                        </span>
                      </div>
                    )
                  ) : null}

                  {mostrarConfianza(c) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-body">
                      <span className="uppercase tracking-wider text-body font-semibold">Confianza IA:</span>
                      {Object.entries(c.confianzaExtraccion ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => (
                        <span key={k} className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border " + tonoConfianza(v!)}>
                          {nombreCampo(k)} {Math.round(v! * 100)}%
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {observacionFiscal ? (
                    soloLectura ? (
                      <div className="mt-3 flex items-start gap-2 text-body bg-surface-soft border border-hairline rounded-sm px-3 py-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0 text-body"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                        <span className="text-sm">El análisis de esta oferta quedó con una observación fiscal. El detalle está en el historial de la solicitud; como el ciclo está cerrado, no queda ninguna acción pendiente.</span>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-start gap-2 text-critical bg-surface-soft border border-[var(--color-text-critical)] rounded-sm px-3 py-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                        <span className="text-sm"><span className="font-semibold">Revisión fiscal:</span> {observacionFiscal}</span>
                      </div>
                    )
                  ) : null}

                </div>

                <div className="w-full sm:w-auto sm:shrink-0 flex flex-wrap items-center gap-2 sm:justify-end">
                  {!soloLectura ? (
                    <>
                      {esEditando ? (
                        <button type="button" onClick={guardarEdicion} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-sm bg-primary text-white hover:bg-surface-dark-soft transition-colors">
                          Guardar
                        </button>
                      ) : (
                        <>
                          {c.archivoNombreOriginal ? (
                            <a
                              href={`/api/solicitudes/${solicitudId}/cotizaciones/${c.id}/archivo`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-sm text-ink hover:bg-surface-soft border border-hairline transition-colors"
                              title="Descargar el archivo original de esta cotización"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                              PDF
                            </a>
                          ) : null}
                          <button type="button" onClick={() => { setEditandoId(c.id); setBorradorEdit({ ...c }); }} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-sm text-body hover:bg-surface-soft border border-hairline transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                            Editar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setBorrandoId(c.id)}
                        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-sm text-critical hover:text-critical hover:bg-surface-soft transition-colors"
                        aria-label={`Eliminar ${c.proveedorNombre}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {esEditando && borradorEdit ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 pb-5 border-t border-hairline pt-4 bg-surface-soft/50">
                  {(["proveedorNombre", "moneda", "valorNeto", "valorTotal", "plazoEntrega"] as const).map((campo) => (
                    <CampoEdicion key={campo} campo={campo} borrador={borradorEdit} setBorrador={setBorradorEdit} />
                  ))}
                  <div className="col-span-2 md:col-span-5 text-xs text-body mt-1">La edición se guarda al presionar &quot;Guardar&quot;.</div>
                </div>
              ) : null}
            </div>
          );
        })}

        {cotizaciones.length === 0 ? (
          <div className="text-center py-12 bg-canvas/60 rounded-sm border border-hairline/60">
            <div className="mx-auto w-14 h-14 rounded-sm bg-surface-soft border border-hairline flex items-center justify-center mb-3">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 12h6M9 16h6M9 8h1"/></svg>
            </div>
            {soloLectura ? (
              <>
                <div className="text-base font-semibold text-ink">No se registraron cotizaciones</div>
                <div className="text-sm text-body mt-1">Esta solicitud se cerró sin ofertas de proveedores cargadas.</div>
              </>
            ) : (
              <>
                <div className="text-base font-semibold text-ink">Todavía no hay cotizaciones</div>
                <div className="text-sm text-body mt-1">Agregue la primera a mano o súbala desde un archivo (PDF, imagen, Word o PowerPoint).</div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {!soloLectura ? (
        <div className="mt-6 bg-canvas rounded-sm border border-hairline  p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div>
              <div className="text-base font-semibold text-ink">Generar comparativa</div>
              {count < 2 ? (
                <div className="text-sm text-ink mt-1 flex items-start gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-[1px]"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  Se necesitan al menos 2 cotizaciones para generar una comparativa.
                </div>
              ) : (
                <div className="text-sm text-body mt-1">La IA analizará las {count} cotizaciones y generará la comparativa.</div>
              )}
            </div>
            <button
              type="button"
              disabled={count < 2}
              onClick={() => setConfirmarGenerar(true)}
              className="w-full sm:w-auto justify-center bg-primary text-white text-sm px-6 py-3 min-h-[44px] rounded-sm font-semibold hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              Generar comparativa
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* Confirmación de borrado */}
      {borrandoId ? (
        <Modal onCerrar={() => setBorrandoId(null)} titulo="¿Eliminar esta cotización?">
          <p className="text-sm text-body mt-2">La oferta de {cotizaciones.find((c) => c.id === borrandoId)?.proveedorNombre} se quitará de la solicitud. No se puede deshacer.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setBorrandoId(null)} className="px-4 py-2.5 rounded-sm text-sm font-medium text-body hover:bg-surface-soft transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => borrar(cotizaciones.find((c) => c.id === borrandoId)!).then(() => setBorrandoId(null))} className="px-5 py-2.5 rounded-sm bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors">
              {borrandoId === borrandoId ? "Sí, eliminar" : "Eliminando…"}
            </button>
          </div>
        </Modal>
      ) : null}

      {/* Confirmación de generar comparativa */}
      {confirmarGenerar ? (
        <Modal onCerrar={() => setConfirmarGenerar(false)} titulo="Generar comparativa?">
          <p className="text-sm text-body mt-2">La IA analizará las {count} cotizaciones cargadas. Puede volver a esta vista y seguir editando después.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmarGenerar(false)} className="px-4 py-2.5 rounded-sm text-sm font-medium text-body hover:bg-surface-soft transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => { setConfirmarGenerar(false); onGenerar(); }} className="px-5 py-2.5 rounded-sm bg-primary text-white text-sm font-semibold hover:bg-surface-dark-soft transition-colors">
              Sí, generar
            </button>
          </div>
        </Modal>
      ) : null}
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
      <span className="block text-xs font-medium text-body mb-1">{labels[campo]}</span>
      {campo === "moneda" ? (
        <select
          value={borrador.moneda ?? "HNL"}
          onChange={(e) => setBorrador({ ...borrador, moneda: e.target.value })}
          className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
        >
          <option>HNL</option>
          <option>USD</option>
        </select>
      ) : campo === "proveedorNombre" || campo === "plazoEntrega" ? (
        <input
          type="text"
          value={borrador[campo] ?? ""}
          onChange={(e) => setBorrador({ ...borrador, [campo]: e.target.value })}
          className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
        />
      ) : (
        <input
          type="number"
          value={borrador[campo] ?? ""}
          onChange={(e) => setBorrador({ ...borrador, [campo]: e.target.value === "" ? undefined : Number(e.target.value) })}
          className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-sky-500 transition-all"
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

// Tonos de los badges. Cada matiz usa su primer tono sobre su fondo tintado: un
// `text-slate-*` sobre `bg-*-50` se lava (P3-12).
function tonoFormato(c: Cotizacion): string {
  if (c.formatoOriginal === "manual") return "bg-surface-soft text-ink";
  return "bg-mint text-ink";
}

function tonoConfianza(v: number): string {
  if (v < 0.5) return "text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]";
  if (v < 0.8) return "text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)]";
  return "text-success shadow-[inset_0_0_0_1px_var(--color-text-success)]";
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

function extFormato(nombre: string): "pdf" | "docx" | "pptx" | "imagen" {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "docx";
  if (ext === "ppt" || ext === "pptx") return "pptx";
  return "imagen";
}