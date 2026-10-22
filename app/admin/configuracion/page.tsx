"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Panel } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";

export default function AdminConfiguracionPage() {
  const [descargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [config, setConfig] = useState({ umbral_dias_sin_movimiento: 5, expiracion_link_dias: 90, destinatario_alertas: "" });

  useEffect(() => {
    fetch("/api/admin/configuracion")
      .then((r) => r.json())
      .then((d) => {
        setConfig({
          umbral_dias_sin_movimiento: Number(d.umbral_dias_sin_movimiento ?? 5) || 5,
          expiracion_link_dias: Number(d.expiracion_link_dias ?? 90) || 90,
          destinatario_alertas: String(d.destinatario_alertas ?? ""),
        });
      })
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    setMensaje(null);
    const res = await fetch("/api/admin/configuracion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) setMensaje({ tipo: "ok", texto: "Configuración guardada." });
    else setMensaje({ tipo: "error", texto: "No se pudo guardar." });
  }

  return (
    <>
      <PageHeader title="Ajustes generales" subtitle="Umbrales, expiración de enlaces y destinatarios de alertas." />

      {mensaje ? (
        <p
          role="status"
          className={
            "rounded-sm px-4 py-3 text-caption shadow-[inset_0_0_0_1px_currentColor] " +
            (mensaje.tipo === "ok" ? "text-success" : "text-critical")
          }
        >
          {mensaje.texto}
        </p>
      ) : null}

      {descargando ? (
        <p className="text-caption text-body">Cargando configuración…</p>
      ) : (
        <Panel title="Parámetros del piloto" subtitle="Aplican a las alertas y a los enlaces públicos." className="max-w-xl">
          <TextField
            label="Umbral de inactividad (días)"
            type="number"
            min={1}
            value={config.umbral_dias_sin_movimiento}
            onChange={(e) => setConfig({ ...config, umbral_dias_sin_movimiento: Number(e.target.value) || 5 })}
            helper="Alertar cuando una solicitud activa no avanza más de este tiempo."
          />
          <TextField
            label="Expiración del enlace público (días)"
            type="number"
            min={1}
            value={config.expiracion_link_dias}
            onChange={(e) => setConfig({ ...config, expiracion_link_dias: Number(e.target.value) || 90 })}
            helper="Días de validez del enlace que recibe el solicitante."
          />
          <TextField
            label="Destinatario de alertas (correo)"
            type="email"
            value={config.destinatario_alertas}
            onChange={(e) => setConfig({ ...config, destinatario_alertas: e.target.value })}
            placeholder="compras@bia.hn"
            helper="Recibe los correos de alerta de inactividad."
          />
          <div className="flex justify-end">
            <Button onClick={guardar}>Guardar configuración</Button>
          </div>
        </Panel>
      )}
    </>
  );
}
