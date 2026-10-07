"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type Pregunta = { campoKey: string; pregunta: string };

/**
 * El solicitante responde lo que Compras le pregunta (spec 010, RF-60).
 *
 * Sin sesión: este flujo no tiene login, así que su identidad viaja en el cuerpo — el correo
 * con el que envió la solicitud. La pantalla que lo monta ya lo verificó contra la solicitud,
 * pero el servidor lo vuelve a comprobar: acá no se confía en el cliente.
 *
 * El bloque se muestra ANTES que todo lo demás de la página: es lo único que la persona tiene
 * que hacer, y enterrarlo abajo del detalle sería esconderle el trabajo.
 */
export function ResponderPreguntas({
  solicitudId,
  email,
  ronda,
  preguntas,
}: {
  solicitudId: string;
  email: string;
  ronda: number;
  preguntas: Pregunta[];
}) {
  const router = useRouter();
  const prefijo = useId();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [noSe, setNoSe] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (clave: string, valor: string, esNoSe: boolean) => {
    setValores((v) => ({ ...v, [clave]: esNoSe ? "" : valor }));
    setNoSe((n) => ({ ...n, [clave]: esNoSe }));
  };

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitudes/${solicitudId}/informacion/respuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, respuestas: valores }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "No pudimos guardar tu respuesta");
      }
      setEnviado(true);
      // La bandera ya está apagada en el servidor; el refresco hace que el bloque desaparezca
      // al recargar, así que no se puede responder dos veces desde esta pantalla.
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message)
          ? "Se cortó la conexión y no sabemos si se guardó. Volvé a intentar: si ya había quedado, no se duplica."
          : e instanceof Error
            ? e.message
            : "No pudimos guardar tu respuesta"
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600 mt-0.5 shrink-0">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Listo, ya le llegó a Compras.</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              Tu respuesta fue al coordinador que está viendo tu solicitud. No tenés que hacer nada más.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border border-amber-300 bg-amber-50/50 p-5"
      aria-labelledby={`${prefijo}-titulo`}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 id={`${prefijo}-titulo`} className="text-sm font-semibold text-amber-900">
          Compras necesita un dato tuyo
        </h2>
        <span className="shrink-0 inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-800">
          {ronda > 1 ? `Ronda ${ronda}` : "Pendiente"}
        </span>
      </div>
      {/* Sin contador de días: calcularlo obliga a leer la hora durante el render, y eso da
          HTML distinto en servidor y cliente. La urgencia la cubren el correo de recordatorio
          y el distintivo del panel del coordinador, que es donde hace falta. */}
      <p className="text-xs text-amber-900/80 leading-relaxed mb-4">
        Contestá lo que puedas: con eso Compras puede seguir con tu solicitud.
      </p>

      <div className="space-y-4">
        {preguntas.map((p, i) => {
          const idCampo = `${prefijo}-${i}`;
          const esNoSe = noSe[p.campoKey] === true;
          return (
            <div key={p.campoKey} className="rounded-xl border border-amber-200 bg-white p-4">
              <label htmlFor={idCampo} className="block text-[13px] font-semibold text-slate-900 mb-2.5">
                {p.pregunta}
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id={idCampo}
                  type="text"
                  value={valores[p.campoKey] ?? ""}
                  onChange={(e) => set(p.campoKey, e.target.value, false)}
                  disabled={esNoSe}
                  placeholder="Escribí tu respuesta"
                  className={
                    "w-full min-h-[44px] bg-white border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all " +
                    (esNoSe ? "opacity-50 border-slate-200" : "border-slate-200 focus:border-sky-500 focus:ring-sky-500")
                  }
                />
                <label
                  className={
                    "shrink-0 inline-flex items-center justify-center gap-2 px-3.5 min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none " +
                    (esNoSe ? "bg-green-100 border-green-300 text-green-800" : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300")
                  }
                >
                  <input
                    type="checkbox"
                    checked={esNoSe}
                    onChange={(e) => set(p.campoKey, "", e.target.checked)}
                    className="w-4 h-4 rounded accent-green-600"
                  />
                  No lo sé
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="mt-4 w-full min-h-[44px] rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-all"
      >
        {enviando ? "Enviando…" : "Enviar respuesta a Compras"}
      </button>
    </section>
  );
}
