"use client";

// Reasignación de una solicitud a otro comprador (3.4) — solo admin.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/forms";

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
  const porNombre = new Map(opciones.map((c) => [c.nombre, c.id]));

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

  const seleccionado = opciones.find((c) => c.id === valor)?.nombre ?? "Seleccionar comprador…";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-medium text-ink">Reasignar comprador</span>
      <SelectField
        label="Reasignar comprador"
        value={seleccionado}
        onChange={(v) => setValor(porNombre.get(v) ?? "")}
        options={["Seleccionar comprador…", ...opciones.map((c) => c.nombre)]}
      />
      <Button size="sm" variant="outline" onClick={reasignar} disabled={!valor || guardando}>
        {guardando ? "…" : "Reasignar"}
      </Button>
      {error ? <p className="text-caption text-critical">{error}</p> : null}
      {ok ? <p className="text-caption text-success">{ok}</p> : null}
    </div>
  );
}
