"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui-ext/Modal";

export type CampoParaPreguntar = { campoKey: string; label: string };

type Fila = { campoKey: string; pregunta: string };

/**
 * Compras pide información al solicitante (spec 010, RF-59).
 *
 * Cada pregunta puede atarse a un campo del catálogo o no. Atarla hace que la respuesta caiga
 * en el campo que el RFQ ya usa; no atarla permite preguntar cualquier cosa ("¿tiene una foto
 * de referencia?"), que es la mitad de los casos reales.
 *
 * El modal arranca con una fila y se pueden agregar más: pedir cinco preguntas de una vez es
 * normal, y obligar a un ida y vuelta por cada una gastaría días del solicitante.
 */
export function PedirInformacion({
  solicitudId,
  campos,
  abierto,
  onCerrar,
}: {
  solicitudId: string;
  campos: CampoParaPreguntar[];
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>([{ campoKey: "", pregunta: "" }]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFila = (i: number, cambio: Partial<Fila>) =>
    setFilas((f) => f.map((fila, idx) => (idx === i ? { ...fila, ...cambio } : fila)));

  const validas = filas.filter((f) => f.pregunta.trim().length > 0);

  function cerrarYLimpiar() {
    setFilas([{ campoKey: "", pregunta: "" }]);
    setError(null);
    onCerrar();
  }

  async function enviar() {
    if (validas.length === 0) {
      setError("Escriba al menos una pregunta.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitudes/${solicitudId}/informacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preguntas: validas.map((f) => ({
            ...(f.campoKey ? { campoKey: f.campoKey } : {}),
            pregunta: f.pregunta.trim(),
          })),
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "No se pudo pedir la información");
      }
      cerrarYLimpiar();
      // El detalle tiene que mostrar la ronda abierta: sin esto el coordinador no ve que su
      // pedido quedó registrado y lo vuelve a mandar.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo pedir la información");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={abierto}
      onClose={cerrarYLimpiar}
      title="Pedir información al solicitante"
      className="max-w-lg"
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || validas.length === 0}
            className="w-full min-h-[44px] rounded-full bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar preguntas"}
          </button>
          <button
            type="button"
            onClick={cerrarYLimpiar}
            className="w-full min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-slate-500 mb-4">
        El solicitante recibe un correo y responde desde el portal. Su respuesta vuelve acá y
        la solicitud no cambia de estado mientras espera.
      </p>

      <div className="space-y-3">
        {filas.map((fila, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Pregunta {i + 1}
              </span>
              {filas.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setFilas((f) => f.filter((_, idx) => idx !== i))}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <input
              type="text"
              value={fila.pregunta}
              onChange={(e) => setFila(i, { pregunta: e.target.value })}
              placeholder="¿Qué necesita saber?"
              className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
            />
            <label className="block mt-2">
              <span className="block text-[11px] text-slate-500 mb-1">
                Guardar la respuesta en un campo (opcional)
              </span>
              <select
                value={fila.campoKey}
                onChange={(e) => setFila(i, { campoKey: e.target.value })}
                className="w-full min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm"
              >
                <option value="">Sin campo — solo queda en la ronda</option>
                {campos.map((c) => (
                  <option key={c.campoKey} value={c.campoKey}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setFilas((f) => [...f, { campoKey: "", pregunta: "" }])}
        disabled={filas.length >= 10}
        className="mt-3 w-full min-h-[40px] rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        + Agregar otra pregunta
      </button>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
