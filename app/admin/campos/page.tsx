"use client";

import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import type { CampoCatalogo } from "@/lib/domain/types";
import { cn } from "@/lib/design/cn";

const VACIO = { campoKey: "", label: "", tipoDato: "texto", origen: "assessment", obligatorio: false, orden: 100 };

export default function AdminCamposPage() {
  const [campos, setCampos] = useState<CampoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoError, setCargandoError] = useState(false);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [pendiente, setPendiente] = useState<CampoCatalogo | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Guarda de cambios sin guardar: avisa antes de perder la configuración.
  const sucio = form.campoKey.trim() !== "" || form.label.trim() !== "";
  const avisoRef = useRef(false);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (sucio && !avisoRef.current) {
        avisoRef.current = true;
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sucio]);

  async function recargar() {
    try {
      const r = await fetch("/api/admin/campos");
      if (!r.ok) throw new Error(String(r.status));
      setCampos(await r.json());
      setCargandoError(false);
    } catch {
      setCampos([]);
      setCargandoError(true);
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/campos");
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (vivo) {
          setCampos(d);
          setCargandoError(false);
        }
      } catch {
        if (vivo) {
          setCampos([]);
          setCargandoError(true);
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  function cerrarForm(forzado = false) {
    if (!forzado && sucio) {
      const ok = window.confirm("Hay cambios sin guardar en el formulario. ¿Salir de todos modos?");
      if (!ok) return;
    }
    setMostrandoForm(false);
    setForm(VACIO);
  }

  async function crearCampo() {
    if (!form.campoKey.trim() || !form.label.trim() || guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/campos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: `Campo "${form.label.trim()}" creado.` });
        setForm(VACIO);
        setMostrandoForm(false);
        await recargar();
      } else {
        const d = await res.json().catch(() => ({}));
        setMensaje({ tipo: "error", texto: d.error ?? "No se pudo crear el campo." });
      }
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo crear el campo: error de red." });
    } finally {
      setGuardando(false);
    }
  }

  // Desactivar un campo quita preguntas al assessment de toda la empresa:
  // pide confirmación y nunca se solapa consigo mismo.
  function pedirToggle(c: CampoCatalogo) {
    if (ocupado) return;
    setPendiente(c);
  }

  async function confirmarToggle() {
    const c = pendiente;
    if (!c || ocupado) return;
    const activar = !c.activo;
    setOcupado(c.campoKey);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/campos/${encodeURIComponent(c.campoKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: activar }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMensaje({ tipo: "error", texto: d.error ?? `No se pudo ${activar ? "activar" : "desactivar"} "${c.label}".` });
      } else {
        setMensaje({ tipo: "ok", texto: `Campo "${c.label}" ${activar ? "activado" : "desactivado"}.` });
        await recargar();
      }
    } catch {
      setMensaje({ tipo: "error", texto: `No se pudo ${activar ? "activar" : "desactivar"} "${c.label}": error de red.` });
    } finally {
      setOcupado(null);
      setPendiente(null);
    }
  }

  return (
    <AdminShell title="Catálogo de campos" subtitle="Gestión de campos que el sistema pide y que la IA usa para completar cotizaciones.">
      {mensaje && (
        <div
          role="status"
          className={cn(
            "mb-4 text-[13px] px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3",
            mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          )}
        >
          <span>{mensaje.texto}</span>
          <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar aviso" className="shrink-0 text-current hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-slate-600 tabular-nums">
          {campos.filter((c) => c.activo).length} campos activos · {campos.length} en total
        </div>
        <button
          type="button"
          onClick={() => (mostrandoForm ? cerrarForm() : setMostrandoForm(true))}
          className="bg-sky-600 text-white text-[12px] font-semibold px-3 py-2 rounded-lg hover:bg-sky-700 transition-colors"
        >
          {mostrandoForm ? "Cancelar" : "Nuevo campo"}
        </button>
      </div>

      {mostrandoForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-5">
          <div className="text-[14px] font-semibold text-slate-900 mb-4">Nuevo campo del catálogo</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Clave interna</span>
              <input
                value={form.campoKey}
                onChange={(e) => setForm({ ...form, campoKey: e.target.value })}
                placeholder="ej. dimensiones"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Etiqueta (visible al usuario)</span>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="ej. Dimensiones"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Tipo de dato</span>
              <select
                value={form.tipoDato}
                onChange={(e) => setForm({ ...form, tipoDato: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {["texto", "texto_largo", "numero", "fecha", "seleccion", "booleano", "archivo", "moneda"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Origen</span>
              <select
                value={form.origen}
                onChange={(e) => setForm({ ...form, origen: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="assessment">Assessment (asistente)</option>
                <option value="plantilla">Plantilla (formulario base)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Orden</span>
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.obligatorio} onChange={(e) => setForm({ ...form, obligatorio: e.target.checked })} className="w-4 h-4" />
              <span className="text-[13px] text-slate-700">Obligatorio</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => cerrarForm()} className="text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg">
              Cancelar
            </button>
            <button
              type="button"
              onClick={crearCampo}
              disabled={!form.campoKey.trim() || !form.label.trim() || guardando}
              className="bg-slate-900 text-white text-[13px] px-4 py-2 rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              {guardando ? "Guardando…" : "Guardar campo"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        {cargando ? (
          <div className="px-4 py-10 text-[13px] text-slate-500">Cargando campos…</div>
        ) : cargandoError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-slate-700">No se pudo cargar el catálogo</p>
            <p className="text-[12px] text-slate-500 mt-1">Revisa la conexión e inténtalo de nuevo.</p>
            <button type="button" onClick={recargar} className="mt-3 text-[12px] font-semibold text-sky-700 hover:text-sky-900">
              Reintentar
            </button>
          </div>
        ) : campos.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-slate-700">Catálogo vacío</p>
            <p className="text-[12px] text-slate-500 mt-1">Crea el primer campo para que el assessment pueda completarlo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Clave</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Etiqueta</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Origen</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Orden</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12.5px]">
                {campos.map((c) => (
                  <tr key={c.campoKey} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-slate-700">{c.campoKey}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{c.label}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.tipoDato}</td>
                    <td className="px-4 py-2.5">
                      {/* Texto del mismo tono que el fondo: gris sobre color washes out. */}
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                          c.origen === "assessment" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {c.origen}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 tabular-nums">{c.orden}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                          c.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => pedirToggle(c)}
                        disabled={ocupado === c.campoKey}
                        className="text-[12px] font-semibold text-slate-600 hover:text-sky-700 disabled:opacity-50 transition-colors"
                      >
                        {ocupado === c.campoKey ? "…" : c.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendiente && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40">
          <div role="dialog" aria-modal="true" aria-labelledby="conf-titulo" className="w-full max-w-md bg-white rounded-lg border border-slate-200 p-5 shadow-xl">
            <h2 id="conf-titulo" className="text-[15px] font-semibold text-slate-900">
              {pendiente.activo ? "Desactivar" : "Activar"} «{pendiente.label}»
            </h2>
            <p className="text-[13px] text-slate-600 mt-2">
              {pendiente.activo
                ? `El assessment dejará de pedir «${pendiente.label}» en las solicitudes nuevas. Esta acción afecta a todo el equipo y no se puede deshacer desde aquí.`
                : `El assessment volverá a pedir «${pendiente.label}» en las solicitudes nuevas.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendiente(null)}
                disabled={ocupado !== null}
                className="text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarToggle}
                disabled={ocupado !== null}
                className={cn(
                  "text-[13px] px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-60 transition-colors",
                  pendiente.activo ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {ocupado ? "Aplicando…" : pendiente.activo ? "Desactivar campo" : "Activar campo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
