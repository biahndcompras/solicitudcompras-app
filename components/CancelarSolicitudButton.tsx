"use client";

// Botón de cancelación de una solicitud (3.5) — usable desde admin y coordinador.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export function CancelarSolicitudButton({ solicitudId, rol = "admin", variante = "borde" }: { solicitudId: string; rol?: "admin" | "coordinador"; variante?: "borde" | "texto" }) {
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
      <button
        type="button"
        onClick={cancelar}
        disabled={cancelando}
        className={
          variante === "texto"
            ? "text-[11px] font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
            : "px-3 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 bg-white/70 disabled:opacity-50 transition-colors"
        }
      >
        {cancelando ? "Cancelando…" : "Cancelar solicitud"}
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </span>
  );
}