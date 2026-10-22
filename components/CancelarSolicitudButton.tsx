"use client";

// Botón de cancelación de una solicitud (3.5) — usable desde admin y coordinador.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";

export function CancelarSolicitudButton({
  solicitudId,
  rol = "admin",
}: {
  solicitudId: string;
  rol?: "admin" | "coordinador";
  variante?: "borde" | "texto";
}) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    if (!window.confirm("¿Cancelar esta solicitud? El proceso se cerrará y quedará registrado como CANCELADA.")) return;
    setCancelando(true);
    setError(null);
    try {
      await api.transicionar({
        solicitudId,
        hacia: "CANCELADA",
        actorTipo: rol,
        nota: `Cancelada desde el panel por ${rol === "admin" ? "el administrador" : "el coordinador"}`,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la solicitud");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={cancelar} disabled={cancelando} className="text-critical">
        {cancelando ? "Cancelando…" : "Cancelar solicitud"}
      </Button>
      {error ? <span className="text-caption text-critical">{error}</span> : null}
    </span>
  );
}
