"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, IconButton, Panel, cx } from "@/components/ui/primitives";
import { Checkbox, Modal, SelectField, TextField } from "@/components/ui/forms";
import type { CampoCatalogo } from "@/lib/domain/types";

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
  const [porEliminar, setPorEliminar] = useState<CampoCatalogo | null>(null);
  const [editando, setEditando] = useState<CampoCatalogo | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Guarda de cambios sin guardar: avisa antes de perder la configuración.
  // Al editar, solo cuenta como sucio si algo cambió respecto del campo original.
  const sucio = editando
    ? form.label.trim() !== editando.label ||
      form.tipoDato !== editando.tipoDato ||
      form.origen !== editando.origen ||
      form.obligatorio !== editando.obligatorio ||
      Number(form.orden) !== editando.orden
    : form.campoKey.trim() !== "" || form.label.trim() !== "";
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
    setEditando(null);
    setForm(VACIO);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setMensaje(null);
    setMostrandoForm(true);
  }

  function abrirEditar(c: CampoCatalogo) {
    setEditando(c);
    setForm({
      campoKey: c.campoKey,
      label: c.label,
      tipoDato: c.tipoDato,
      origen: c.origen,
      obligatorio: c.obligatorio,
      orden: c.orden,
    });
    setMensaje(null);
    setMostrandoForm(true);
  }

  // Solo viaja lo que cambió: una edición parcial no puede pisar atributos que el
  // formulario no expone (ayuda, sección del PDF, validación…).
  function diffEdicion(): Record<string, unknown> {
    if (!editando) return {};
    const body: Record<string, unknown> = {};
    if (form.label.trim() !== editando.label) body.label = form.label.trim();
    if (form.tipoDato !== editando.tipoDato) body.tipoDato = form.tipoDato;
    if (form.origen !== editando.origen) body.origen = form.origen;
    if (form.obligatorio !== editando.obligatorio) body.obligatorio = form.obligatorio;
    if (Number(form.orden) !== editando.orden) body.orden = Number(form.orden);
    return body;
  }

  async function guardarEdicion() {
    if (!editando || guardando) return;
    const body = diffEdicion();
    if (Object.keys(body).length === 0) {
      setMensaje({ tipo: "ok", texto: "No hay cambios que guardar." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/campos/${encodeURIComponent(editando.campoKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMensaje({ tipo: "ok", texto: `Campo «${form.label.trim()}» actualizado.` });
        cerrarForm(true);
        await recargar();
      } else {
        const d = await res.json().catch(() => ({}));
        setMensaje({ tipo: "error", texto: d.error ?? "No se pudo actualizar el campo." });
      }
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo actualizar el campo: error de red." });
    } finally {
      setGuardando(false);
    }
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

  // Eliminar no borra la fila: la desactiva. Las respuestas guardadas referencian el campo
  // por su clave, así que un borrado físico las dejaría huérfanas. Se confirma igual.
  function pedirEliminar(c: CampoCatalogo) {
    if (ocupado) return;
    setPorEliminar(c);
  }

  async function confirmarEliminar() {
    const c = porEliminar;
    if (!c || ocupado) return;
    setOcupado(c.campoKey);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/campos/${encodeURIComponent(c.campoKey)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMensaje({ tipo: "error", texto: d.error ?? `No se pudo eliminar "${c.label}".` });
      } else {
        setMensaje({ tipo: "ok", texto: `El campo «${c.label}» fue desactivado y ya no se pedirá en solicitudes nuevas.` });
        await recargar();
      }
    } catch {
      setMensaje({ tipo: "error", texto: `No se pudo eliminar "${c.label}": error de red.` });
    } finally {
      setOcupado(null);
      setPorEliminar(null);
    }
  }
  const activos = campos.filter((c) => c.activo).length;

  return (
    <>
      <PageHeader
        title="Campos"
        subtitle="Campos que el sistema pide y que la IA usa para completar cotizaciones."
      />

      {mensaje ? (
        <div
          role="status"
          className={cx(
            "flex items-center justify-between gap-3 rounded-sm px-4 py-3 text-caption",
            mensaje.tipo === "ok"
              ? "text-success shadow-[inset_0_0_0_1px_var(--color-text-success)]"
              : "text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]"
          )}
        >
          <span>{mensaje.texto}</span>
          <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar aviso" className="shrink-0 text-current hover:opacity-70">
            ✕
          </button>
        </div>
      ) : null}

      {mostrandoForm ? (
        <Panel
          title={editando ? `Editar campo «${editando.label}»` : "Nuevo campo del catálogo"}
          subtitle="La clave identifica el campo; la etiqueta es lo que ve el usuario."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <TextField
              label="Clave interna"
              value={form.campoKey}
              onChange={(e) => setForm({ ...form, campoKey: e.target.value })}
              placeholder="ej. dimensiones"
              disabled={editando !== null}
              helper={editando ? "La clave no se puede cambiar: identifica el campo." : undefined}
            />
            <TextField
              label="Etiqueta (visible al usuario)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="ej. Dimensiones"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-ink">Tipo de dato</span>
              <SelectField
                label="Tipo de dato"
                value={form.tipoDato}
                onChange={(v) => setForm({ ...form, tipoDato: v })}
                options={["texto", "texto_largo", "numero", "fecha", "seleccion", "seleccion_multiple", "booleano", "archivo", "moneda"]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-ink">Origen</span>
              <SelectField
                label="Origen"
                value={form.origen === "plantilla" ? "Plantilla (formulario base)" : "Assessment (asistente)"}
                onChange={(v) => setForm({ ...form, origen: v.startsWith("Plantilla") ? "plantilla" : "assessment" })}
                options={["Assessment (asistente)", "Plantilla (formulario base)"]}
              />
            </div>
            <TextField
              label="Orden"
              type="number"
              value={form.orden}
              onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
            />
            <div className="flex items-center pt-6">
              <Checkbox
                label="Obligatorio"
                checked={form.obligatorio}
                onChange={(v) => setForm({ ...form, obligatorio: v })}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => cerrarForm()}>
              Cancelar
            </Button>
            <Button
              onClick={editando ? guardarEdicion : crearCampo}
              disabled={!form.label.trim() || (!editando && !form.campoKey.trim()) || guardando}
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar campo"}
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Catálogo"
        subtitle={`${activos} campos activos · ${campos.length} en total`}
        action={
          !mostrandoForm ? (
            <Button size="sm" onClick={abrirNuevo}>
              Nuevo campo
            </Button>
          ) : null
        }
      >
        {cargando ? (
          <p className="text-caption text-body">Cargando campos…</p>
        ) : cargandoError ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-body-lg text-ink">No se pudo cargar el catálogo</p>
            <p className="text-caption text-body">Revise la conexión e inténtelo de nuevo.</p>
            <Button variant="outline" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        ) : campos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-body-lg text-ink">Catálogo vacío</p>
            <p className="text-caption text-body">Cree el primer campo para que el assessment pueda completarlo.</p>
          </div>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="bg-surface-soft text-left">
                  {["Clave", "Etiqueta", "Tipo", "Origen", "Orden", "Estado"].map((h) => (
                    <th key={h} scope="col" className="eyebrow px-3 py-3 font-medium text-ink">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="eyebrow w-[160px] px-3 py-3 text-right font-medium text-ink">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {campos.map((c) => (
                  <tr key={c.campoKey} className="border-b border-hairline hover:bg-surface-soft/60">
                    <td className="px-3 py-3">
                      <span className="mono-label text-ink">{c.campoKey}</span>
                    </td>
                    <td className="px-3 py-3 text-body-md text-ink">{c.label}</td>
                    <td className="px-3 py-3 text-caption text-body">{c.tipoDato}</td>
                    <td className="px-3 py-3">
                      <Badge tone={c.origen === "assessment" ? "periwinkle" : "neutral"}>{c.origen}</Badge>
                    </td>
                    <td className="px-3 py-3 text-caption text-body tabular-nums">{c.orden}</td>
                    <td className="px-3 py-3">
                      <Badge tone={c.activo ? "success" : "neutral"}>{c.activo ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <IconButton icon="edit" label="Editar" onClick={() => abrirEditar(c)} disabled={ocupado === c.campoKey} />
                        <IconButton
                          icon="power"
                          label={ocupado === c.campoKey ? "Aplicando" : c.activo ? "Desactivar" : "Activar"}
                          onClick={() => pedirToggle(c)}
                          disabled={ocupado === c.campoKey}
                        />
                        <IconButton
                          icon="trash"
                          label="Eliminar"
                          tone="critical"
                          onClick={() => pedirEliminar(c)}
                          disabled={ocupado === c.campoKey}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        title={`${pendiente?.activo ? "Desactivar" : "Activar"} «${pendiente?.label ?? ""}»`}
        description={
          pendiente?.activo
            ? `El assessment dejará de pedir «${pendiente?.label ?? ""}» en las solicitudes nuevas. Esta acción afecta a todo el equipo y no se puede deshacer desde aquí.`
            : `El assessment volverá a pedir «${pendiente?.label ?? ""}» en las solicitudes nuevas.`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setPendiente(null)} disabled={ocupado !== null}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarToggle}
              disabled={ocupado !== null}
              className={pendiente?.activo ? "bg-[var(--color-bg-critical)] text-on-dark hover:bg-[var(--color-bg-critical)]" : undefined}
            >
              {ocupado ? "Aplicando…" : pendiente?.activo ? "Desactivar campo" : "Activar campo"}
            </Button>
          </>
        }
      >
        <p className="text-caption text-body">El cambio aplica a las solicitudes nuevas.</p>
      </Modal>

      <Modal
        open={porEliminar !== null}
        onClose={() => setPorEliminar(null)}
        title={`¿Eliminar «${porEliminar?.label ?? ""}»?`}
        description="El campo se desactivará y dejará de pedirse en las solicitudes nuevas. No se borra por completo para no dejar sin referencia las respuestas que ya se guardaron con él."
        actions={
          <>
            <Button variant="outline" onClick={() => setPorEliminar(null)} disabled={ocupado !== null}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarEliminar}
              disabled={ocupado !== null}
              className="bg-[var(--color-bg-critical)] text-on-dark hover:bg-[var(--color-bg-critical)]"
            >
              {ocupado ? "Eliminando…" : "Eliminar campo"}
            </Button>
          </>
        }
      >
        <p className="text-caption text-body">Esta acción queda registrada en el catálogo.</p>
      </Modal>
    </>
  );
}
