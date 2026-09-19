"use client";

// Reasignación de una solicitud a otro comprador (3.4) — solo admin.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReasignarCoordinador({
  solicitudId,
  actualId,
  coordinadores,
}: {
  solicitudId: string;
  actualId?: string;
  coordinadores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const opciones = coordinadores.filter((c) => c.id !== actualId);

  async function reasignar() {
    if (!valor) return;
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/solicitudes/${solicitudId}/reasignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinadorId: valor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo reasignar");
        return;
      }
      setValor("");
      setOk("Solicitud reasignada. La vista se actualizará.");
      router.refresh();
    } catch {
      setError("No se pudo reasignar la solicitud");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1.5">Reasignar comprador</label>
      <div className="flex items-center gap-2">
        <select
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="">Seleccionar comprador…</option>
          {opciones.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={reasignar}
          disabled={!valor || guardando}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-colors"
        >
          {guardando ? "…" : "Reasignar"}
        </button>
      </div>
      {error ? <p className="mt-1 text-[11px] text-rose-600">{error}</p> : null}
      {ok ? <p className="mt-1 text-[11px] text-emerald-700">{ok}</p> : null}
    </div>
  );
}