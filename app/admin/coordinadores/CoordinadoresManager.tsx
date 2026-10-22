"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@/lib/domain/types";
import { CATEGORIAS, nombreCategoria } from "@/lib/domain/categorias";
import { Badge, Button, Panel, cx } from "@/components/ui/primitives";
import { Checkbox, Modal, SelectField, TextField } from "@/components/ui/forms";

type Props = { inicial: Usuario[] };

type Formulario = { nombre: string; email: string; rol: "coordinador" | "admin"; categorias: string[] };
const VACIO: Formulario = { nombre: "", email: "", rol: "coordinador", categorias: [] };

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
    setForm({
      nombre: c.nombre,
      email: c.email,
      rol: c.rol === "admin" ? "admin" : "coordinador",
      categorias: c.categoriasAsignadas,
    });
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
    if (!editando && !form.email.trim()) return;

    setGuardando(true);
    setMensaje(null);
    try {
      const editandoAhora = editando;
      const res = editandoAhora
        ? await fetch(`/api/admin/coordinadores/${encodeURIComponent(editandoAhora.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre,
              rol: form.rol,
              categoriasAsignadas: form.rol === "coordinador" ? form.categorias : [],
            }),
          })
        : await fetch("/api/admin/coordinadores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre,
              email: form.email.trim(),
              rol: form.rol,
              categoriasAsignadas: form.rol === "coordinador" ? form.categorias : [],
            }),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: data.error ?? "No se pudo guardar el coordinador." });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: editandoAhora ? `Cuenta de «${nombre}» actualizada.` : `Invitación enviada a «${nombre}».`,
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

  const puedeGuardar = form.nombre.trim().length > 0 && (editando !== null || form.email.trim().length > 0) && !guardando;

  return (
    <div className="flex flex-col gap-4">
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
          title={editando ? `Editar a «${editando.nombre}»` : "Nueva cuenta"}
          subtitle="La cuenta se crea por invitación: la persona define su contraseña desde el enlace del correo."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre y apellido"
            />
            <TextField
              label="Correo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nombre@biabrands.co"
              disabled={editando !== null}
              helper={editando ? "El correo identifica la cuenta y no se puede cambiar." : undefined}
            />
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-caption font-medium text-ink">Rol</span>
              <SelectField
                label="Rol"
                value={form.rol === "admin" ? "Administrador" : "Coordinador de Compras"}
                onChange={(v) => setForm({ ...form, rol: v === "Administrador" ? "admin" : "coordinador" })}
                options={["Coordinador de Compras", "Administrador"]}
              />
              <p className="text-caption text-body">
                {editando
                  ? "Cambiar el rol actualiza el acceso. No puede quitarse el suyo ni dejar el sistema sin administradores."
                  : "La cuenta se crea por invitación: la persona define su contraseña al abrir el enlace del correo."}
              </p>
            </div>
            {form.rol === "coordinador" ? (
              <div className="md:col-span-2">
                <span className="mb-2 block text-caption font-medium text-ink">Categorías asignadas</span>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {CATEGORIAS.map((c) => (
                    <Checkbox
                      key={c.clave}
                      label={c.etiqueta}
                      checked={form.categorias.includes(c.clave)}
                      onChange={() => alternarCategoria(c.clave)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-caption text-body">Sin categorías, el coordinador aplica a todas.</p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={cerrarForm}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!puedeGuardar}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Enviar invitación"}
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Equipo"
        subtitle="Cuentas de coordinación y administración."
        action={
          !mostrandoForm ? (
            <Button size="sm" onClick={abrirNuevo}>
              Nueva cuenta
            </Button>
          ) : null
        }
      >
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-surface-soft text-left">
                {["Nombre", "Correo", "Rol", "Categorías", "Estado"].map((h) => (
                  <th key={h} scope="col" className="eyebrow px-3 py-3 font-medium text-ink">
                    {h}
                  </th>
                ))}
                <th scope="col" className="eyebrow px-3 py-3 text-right font-medium text-ink">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-caption text-body">
                    Todavía no hay cuentas. Cree la primera.
                  </td>
                </tr>
              ) : (
                lista.map((c) => (
                  <tr key={c.id} className="border-b border-hairline hover:bg-surface-soft/60">
                    <td className="px-3 py-3 text-body-md whitespace-nowrap text-ink">{c.nombre}</td>
                    <td className="px-3 py-3 text-caption whitespace-nowrap text-body">{c.email}</td>
                    <td className="px-3 py-3">
                      <Badge tone={c.rol === "admin" ? "periwinkle" : "neutral"}>
                        {c.rol === "admin" ? "Admin" : "Coordinador"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-caption text-body">
                      {c.categoriasAsignadas.length > 0
                        ? c.categoriasAsignadas.map((cat) => nombreCategoria(cat)).join(" · ")
                        : "Todas"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={c.activo ? "success" : "neutral"}>{c.activo ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirEditar(c)}
                          disabled={ocupado === c.id}
                        >
                          Editar
                        </Button>
                        <Button
                          variant={c.activo ? "outline" : "mint"}
                          size="sm"
                          onClick={() => pedirToggle(c)}
                          disabled={ocupado === c.id}
                          className={c.activo ? "text-critical" : undefined}
                        >
                          {ocupado === c.id ? "…" : c.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        title={`${pendiente?.activo ? "Desactivar" : "Activar"} a ${pendiente?.nombre ?? ""}`}
        description={
          pendiente?.activo
            ? "Se le quitará el acceso: no podrá iniciar sesión como coordinador ni ver su bandeja. Si tiene una sesión abierta, la perderá al refrescar. Puede reactivarlo cuando quiera."
            : "Volverá a tener acceso al panel y aparecerá de nuevo entre los coordinadores asignables."
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
              {ocupado ? "Aplicando…" : pendiente?.activo ? "Desactivar coordinador" : "Activar coordinador"}
            </Button>
          </>
        }
      >
        <p className="text-caption text-body">Esta acción queda registrada en la cuenta de acceso.</p>
      </Modal>
    </div>
  );
}
