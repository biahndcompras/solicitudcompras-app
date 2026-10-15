"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@/lib/domain/types";
import { CATEGORIAS, nombreCategoria } from "@/lib/domain/categorias";
import { cn } from "@/lib/design/cn";

type Props = { inicial: Usuario[] };

type Formulario = { nombre: string; email: string; password: string; categorias: string[] };
const VACIO: Formulario = { nombre: "", email: "", password: "", categorias: [] };

export function CoordinadoresManager({ inicial }: Props) {
  const router = useRouter();
  // La lista viene del servidor (componente Server). Tras cada mutación, `router.refresh()`
  // vuelve a renderizar la página y llega una lista nueva: una sola fuente de verdad.
  const lista = inicial;
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [pendiente, setPendiente] = useState<Usuario | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setMensaje(null);
    setMostrandoForm(true);
  }

  function abrirEditar(c: Usuario) {
    setEditando(c);
    setForm({ nombre: c.nombre, email: c.email, password: "", categorias: c.categoriasAsignadas });
    setMensaje(null);
    setMostrandoForm(true);
  }

  function cerrarForm() {
    setMostrandoForm(false);
    setEditando(null);
    setForm(VACIO);
  }

  function alternarCategoria(clave: string) {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(clave)
        ? f.categorias.filter((c) => c !== clave)
        : [...f.categorias, clave],
    }));
  }

  async function guardar() {
    if (guardando) return;
    const nombre = form.nombre.trim();
    if (!nombre) return;
    if (!editando && (!form.email.trim() || form.password.length < 8)) return;

    setGuardando(true);
    setMensaje(null);
    try {
      const editandoAhora = editando;
      const res = editandoAhora
        ? await fetch(`/api/admin/coordinadores/${encodeURIComponent(editandoAhora.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, categoriasAsignadas: form.categorias }),
          })
        : await fetch("/api/admin/coordinadores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre,
              email: form.email.trim(),
              password: form.password,
              categoriasAsignadas: form.categorias,
            }),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: data.error ?? "No se pudo guardar el coordinador." });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: editandoAhora ? `Coordinador «${nombre}» actualizado.` : `Coordinador «${nombre}» creado.`,
      });
      cerrarForm();
      router.refresh();
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo guardar el coordinador: error de red." });
    } finally {
      setGuardando(false);
    }
  }

  function pedirToggle(c: Usuario) {
    if (ocupado) return;
    setPendiente(c);
  }

  async function confirmarToggle() {
    const c = pendiente;
    if (!c || ocupado) return;
    const activar = !c.activo;
    setOcupado(c.id);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/coordinadores/${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: activar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: data.error ?? `No se pudo ${activar ? "activar" : "desactivar"} a ${c.nombre}.` });
      } else {
        setMensaje({
          tipo: "ok",
          texto: activar
            ? `${c.nombre} recuperó el acceso al panel.`
            : `${c.nombre} fue desactivado y ya no tiene acceso.`,
        });
        router.refresh();
      }
    } catch {
      setMensaje({ tipo: "error", texto: `No se pudo ${activar ? "activar" : "desactivar"} a ${c.nombre}: error de red.` });
    } finally {
      setOcupado(null);
      setPendiente(null);
    }
  }

  const puedeGuardar =
    form.nombre.trim().length > 0 &&
    (editando !== null || (form.email.trim().length > 0 && form.password.length >= 8)) &&
    !guardando;

  return (
    <div className="mt-8">
      {mensaje && (
        <div
          role="status"
          className={cn(
            "mb-4 text-[13px] px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3",
            mensaje.tipo === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          )}
        >
          <span>{mensaje.texto}</span>
          <button
            type="button"
            onClick={() => setMensaje(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 text-current hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">Gestión del equipo</h2>
        <button
          type="button"
          onClick={() => (mostrandoForm ? cerrarForm() : abrirNuevo())}
          className="bg-sky-600 text-white text-[12px] font-semibold px-3 py-2 rounded-lg hover:bg-sky-700 transition-colors"
        >
          {mostrandoForm ? "Cancelar" : "Nuevo coordinador"}
        </button>
      </div>

      {mostrandoForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-5">
          <div className="text-[14px] font-semibold text-slate-900 mb-4">
            {editando ? `Editar a «${editando.nombre}»` : "Nuevo coordinador"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Nombre</span>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre y apellido"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Correo</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nombre@biabrands.co"
                disabled={editando !== null}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
              {editando && (
                <span className="block text-[11px] text-slate-500 mt-1">
                  El correo identifica la cuenta y no se puede cambiar.
                </span>
              )}
            </label>
            {!editando && (
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Contraseña inicial</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="block text-[11px] text-slate-500 mt-1">
                  La define usted y se entrega al coordinador. No se vuelve a mostrar.
                </span>
              </label>
            )}
            <div className="md:col-span-2">
              <span className="block text-[12px] font-medium text-slate-700 mb-2">Categorías asignadas</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {CATEGORIAS.map((c) => (
                  <label key={c.clave} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.categorias.includes(c.clave)}
                      onChange={() => alternarCategoria(c.clave)}
                      className="w-4 h-4"
                    />
                    <span className="text-[13px] text-slate-700">{c.etiqueta}</span>
                  </label>
                ))}
              </div>
              <span className="block text-[11px] text-slate-500 mt-2">
                Sin categorías, el coordinador aplica a todas.
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cerrarForm}
              className="text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!puedeGuardar}
              className="bg-slate-900 text-white text-[13px] px-4 py-2 rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear coordinador"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2.5 font-semibold">Nombre</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Correo</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Categorías</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[12.5px]">
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-slate-500">
                  Todavía no hay coordinadores. Cree el primero.
                </td>
              </tr>
            ) : (
              lista.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{c.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.categoriasAsignadas.length > 0
                      ? c.categoriasAsignadas.map((cat) => nombreCategoria(cat)).join(" · ")
                      : "Todas"}
                  </td>
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
                    <span className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => abrirEditar(c)}
                        disabled={ocupado === c.id}
                        className="text-[12px] font-semibold text-slate-600 hover:text-sky-700 disabled:opacity-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirToggle(c)}
                        disabled={ocupado === c.id}
                        className={cn(
                          "text-[12px] font-semibold disabled:opacity-50 transition-colors",
                          c.activo ? "text-rose-600 hover:text-rose-800" : "text-emerald-700 hover:text-emerald-900"
                        )}
                      >
                        {ocupado === c.id ? "…" : c.activo ? "Desactivar" : "Activar"}
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pendiente && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="conf-titulo"
            className="w-full max-w-md bg-white rounded-lg border border-slate-200 p-5 shadow-xl"
          >
            <h2 id="conf-titulo" className="text-[15px] font-semibold text-slate-900">
              {pendiente.activo ? "Desactivar" : "Activar"} a {pendiente.nombre}
            </h2>
            <p className="text-[13px] text-slate-600 mt-2">
              {pendiente.activo
                ? "Se le quitará el acceso: no podrá iniciar sesión como coordinador ni ver su bandeja. Si tiene una sesión abierta, la perderá al refrescar. Puede reactivarlo cuando quiera."
                : "Volverá a tener acceso al panel y aparecerá de nuevo entre los coordinadores asignables."}
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
                {ocupado
                  ? "Aplicando…"
                  : pendiente.activo
                    ? "Desactivar coordinador"
                    : "Activar coordinador"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
