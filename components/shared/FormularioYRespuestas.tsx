import type { PreguntaOriginal } from "@/lib/domain/formulario";
import type { RondaPreguntas } from "@/lib/domain/types";

type Props = {
  /** Cuestionario completo que se le mostró al solicitante (plantilla + assessment). */
  preguntas: PreguntaOriginal[];
  /** Historial de rondas, en orden. */
  rondas: RondaPreguntas[];
  /** La solicitud tiene una ronda esperando respuesta. */
  rondaAbierta?: boolean;
};

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Formulario original + historial de preguntas adicionales (4.13.20).
 *
 * Va en la columna derecha del detalle (coordinador y admin): primero lo que el solicitante
 * respondió en el formulario, y debajo una card por ronda. Antes solo se veía la última
 * ronda y los campos ya fusionados, así que el contexto de las rondas anteriores se perdía.
 */
export function FormularioYRespuestas({ preguntas, rondas, rondaAbierta = false }: Props) {
  const ultimaRonda = rondas.reduce((max, r) => Math.max(max, r.ronda), 0);

  return (
    <>
      <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Formulario original</h3>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {preguntas.length} {preguntas.length === 1 ? "pregunta" : "preguntas"}
          </span>
        </div>

        {preguntas.length === 0 ? (
          <p className="text-xs text-slate-500">El formulario no tiene preguntas adicionales.</p>
        ) : (
          <dl className="divide-y divide-slate-100">
            {preguntas.map((p) => (
              <div key={p.campoKey} className="py-2 first:pt-0 last:pb-0">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{p.label}</dt>
                <dd className="text-xs text-slate-800 break-words mt-0.5">
                  {p.valor && p.valor.trim() ? p.valor : <em className="text-slate-400">No especificado</em>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {rondas.map((r) => {
        const abierta = rondaAbierta && r.ronda === ultimaRonda;
        return (
          <section key={r.id} className="bg-white rounded-2xl border border-sky-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">Preguntas adicionales · ronda {r.ronda}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fechaCorta(r.pedidaEn)}
                  {r.pedidaPor ? ` · ${r.pedidaPor}` : ""}
                </p>
              </div>
              <span
                className={
                  "shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full " +
                  (abierta ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")
                }
              >
                {abierta ? "Esperando respuesta" : "Respondida"}
              </span>
            </div>

            <ul className="space-y-2">
              {r.preguntas.map((p) => {
                const valor = r.respuestas?.[p.campoKey];
                return (
                  <li key={p.campoKey} className="rounded-xl bg-sky-50/50 border border-sky-100 px-3 py-2">
                    <span className="block text-xs font-semibold text-slate-800">{p.pregunta}</span>
                    {valor && valor.trim() ? (
                      <span className="block text-xs text-slate-700 mt-0.5 break-words">{valor}</span>
                    ) : abierta ? (
                      <span className="block text-[11px] text-slate-400 mt-0.5">Sin responder todavía</span>
                    ) : (
                      <span className="block text-[11px] text-slate-400 mt-0.5">No lo sé</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
