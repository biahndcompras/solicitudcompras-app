import type { PreguntaOriginal } from "@/lib/domain/formulario";
import type { RondaPreguntas } from "@/lib/domain/types";
import { Badge } from "@/components/ui/primitives";

type Props = {
  /** Cuestionario completo que se le mostró al solicitante (plantilla + assessment). */
  preguntas: PreguntaOriginal[];
  /** Historial de rondas, en orden. */
  rondas: RondaPreguntas[];
  /** La solicitud tiene una ronda esperando respuesta. */
  rondaAbierta?: number | null;
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
export function FormularioYRespuestas({ preguntas, rondas, rondaAbierta = null }: Props) {
  return (
    <>
      <section className="rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-body-md font-medium text-ink">Formulario original</h3>
          <Badge tone="neutral">
            {preguntas.length} {preguntas.length === 1 ? "pregunta" : "preguntas"}
          </Badge>
        </div>

        {preguntas.length === 0 ? (
          <p className="text-caption text-body">El formulario no tiene preguntas adicionales.</p>
        ) : (
          <dl className="divide-y divide-hairline">
            {preguntas.map((p) => (
              <div key={p.campoKey} className="py-2 first:pt-0 last:pb-0">
                <dt className="eyebrow text-body">{p.label}</dt>
                <dd className="mt-0.5 break-words text-caption text-ink">
                  {p.valor && p.valor.trim() ? p.valor : <em className="text-body">No especificado</em>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {rondas.map((r) => {
        const abierta = rondaAbierta != null && r.ronda === rondaAbierta;
        const sinDetalle = r.detalleDisponible === false;
        const respondida = sinDetalle ? Boolean(r.respondidaEn) : !abierta;
        return (
          <section
            key={r.id}
            className="rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-body-md font-medium text-ink">Preguntas adicionales · ronda {r.ronda}</h3>
                <p className="mt-0.5 text-caption text-body">
                  {fechaCorta(r.pedidaEn)}
                  {r.pedidaPor ? ` · ${r.pedidaPor}` : ""}
                </p>
              </div>
              <Badge tone={respondida ? "success" : abierta ? "mint" : "neutral"}>
                {respondida ? "Respondida" : abierta ? "Esperando respuesta" : "Sin respuesta registrada"}
              </Badge>
            </div>

            {sinDetalle ? (
              <div className="rounded-xs bg-surface-soft px-3 py-2.5">
                <p className="text-caption text-ink">
                  {r.totalPreguntas && r.totalPreguntas > 0
                    ? `Se hicieron ${r.totalPreguntas} ${r.totalPreguntas === 1 ? "pregunta" : "preguntas"}.`
                    : "Se registró una respuesta."}{" "}
                  El detalle no se guardó: esta ronda es anterior al 21 de octubre de 2026.
                </p>
                {r.respondidaEn ? (
                  <p className="mt-1 text-caption text-body">
                    Respondida el {fechaCorta(r.respondidaEn)}
                    {r.totalRespuestas !== undefined ? ` · ${r.totalRespuestas} respuesta(s)` : ""}.
                  </p>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {r.preguntas.map((p) => {
                  const valor = r.respuestas?.[p.campoKey];
                  return (
                    <li key={p.campoKey} className="rounded-xs bg-surface-soft px-3 py-2">
                      <span className="block text-caption font-medium text-ink">{p.pregunta}</span>
                      {valor && valor.trim() ? (
                        <span className="mt-0.5 block break-words text-caption text-ink">{valor}</span>
                      ) : abierta ? (
                        <span className="mt-0.5 block text-caption text-body">Sin responder todavía</span>
                      ) : (
                        <span className="mt-0.5 block text-caption text-body">Sin respuesta registrada</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
