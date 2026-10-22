"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

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
        throw new Error(d.error ?? "No pudimos guardar su respuesta");
      }
      setEnviado(true);
      // La bandera ya está apagada en el servidor; el refresco hace que el bloque desaparezca
      // al recargar, así que no se puede responder dos veces desde esta pantalla.
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && /failed to fetch|networkerror|load failed/i.test(e.message)
          ? "Se cortó la conexión y no sabemos si se guardó. Vuelva a intentar: si ya había quedado, no se duplica."
          : e instanceof Error
            ? e.message
            : "No pudimos guardar su respuesta"
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div
        className="flex items-start gap-3 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-text-success)]"
        role="status"
        aria-live="polite"
      >
        <Icon name="check-circle" size={18} className="mt-0.5 shrink-0 text-success" />
        <div>
          <p className="text-body-md font-medium text-ink">Listo, ya le llegó a Compras.</p>
          <p className="mt-0.5 text-caption text-body">
            Su respuesta fue al coordinador que está viendo su solicitud. No tiene que hacer nada más.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-text-critical)]"
      aria-labelledby={`${prefijo}-titulo`}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 id={`${prefijo}-titulo`} className="text-body-md font-medium text-ink">
          Compras necesita un dato suyo
        </h2>
        <Badge tone={ronda > 1 ? "periwinkle" : "neutral"}>{ronda > 1 ? `Ronda ${ronda}` : "Pendiente"}</Badge>
      </div>
      <p className="mb-4 text-caption text-body">
        Conteste lo que pueda: con eso Compras puede seguir con su solicitud.
      </p>

      <div className="flex flex-col gap-3">
        {preguntas.map((p, i) => {
          const idCampo = `${prefijo}-${i}`;
          const esNoSe = noSe[p.campoKey] === true;
          return (
            <div key={p.campoKey} className="rounded-sm bg-surface-soft p-4">
              <label htmlFor={idCampo} className="mb-2.5 block text-caption font-medium text-ink">
                {p.pregunta}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id={idCampo}
                  type="text"
                  value={valores[p.campoKey] ?? ""}
                  onChange={(e) => set(p.campoKey, e.target.value, false)}
                  disabled={esNoSe}
                  placeholder="Escriba su respuesta"
                  className={
                    "min-h-[44px] w-full rounded-sm bg-canvas px-3 py-2 text-body-md text-ink outline-none transition-shadow " +
                    (esNoSe
                      ? "opacity-50 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
                      : "shadow-[inset_0_0_0_1px_var(--color-border-hairline)] focus:shadow-[inset_0_0_0_1px_#000]")
                  }
                />
                <label
                  className={
                    "inline-flex min-h-[44px] shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-sm px-3.5 text-caption font-medium transition-colors " +
                    (esNoSe
                      ? "bg-mint text-ink shadow-[inset_0_0_0_1px_#000]"
                      : "bg-canvas text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:text-ink")
                  }
                >
                  <input
                    type="checkbox"
                    checked={esNoSe}
                    onChange={(e) => set(p.campoKey, "", e.target.checked)}
                    className="size-4 rounded-xs accent-[var(--color-bg-primary)]"
                  />
                  No lo sé
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-sm px-3 py-2 text-caption font-medium text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]"
        >
          {error}
        </p>
      ) : null}

      <Button type="button" onClick={enviar} disabled={enviando} className="mt-4 w-full">
        {enviando ? "Enviando…" : "Enviar respuesta a Compras"}
      </Button>
    </section>
  );
}
