"use client";

// Documentos adjuntos de una solicitud (4.4.12), compartido por los tres portales.
//
// Los sube Compras (coordinador/admin) y también el solicitante desde su solicitud ya enviada.
// No se muestran en el enlace público: ese enlace solo debe mostrar la comparativa.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { Adjunto } from "@/lib/domain/types";
import { Icon } from "@/components/ui/Icon";
import { Button, Panel } from "@/components/ui/primitives";

const ACEPTA = ".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg";
const MAX_MB = 4;

function fecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

function tamano(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosAdjuntos({
  solicitudId,
  email,
  puedeSubir = true,
}: {
  solicitudId: string;
  /** Correo del solicitante. Para Compras va vacío: manda la cookie de sesión. */
  email?: string;
  puedeSubir?: boolean;
}) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Compras puede borrar cualquiera; el solicitante, solo los que subió él. La API ya lo
  // rechaza, pero ofrecer un botón que va a fallar es peor que no mostrarlo.
  const puedeBorrar = (a: Adjunto) =>
    !email || (a.subidoPorEmail ?? "").toLowerCase() === email.toLowerCase();

  // Se recarga subiendo un contador (mismo patrón que la bandeja): el estado se escribe en
  // callbacks de la promesa, no en el cuerpo del efecto.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    api
      .listarAdjuntos(solicitudId, email)
      .then(({ adjuntos: lista }) => {
        if (vivo) setAdjuntos(lista);
      })
      .catch(() => {
        if (vivo) setError("No se pudieron cargar los documentos. Reintente en unos segundos.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [solicitudId, email, recarga]);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      await api.subirAdjunto(solicitudId, archivo, email);
      setError(null);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el documento.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  async function borrar(a: Adjunto) {
    if (!window.confirm(`¿Eliminar «${a.nombreArchivo}»? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      await api.eliminarAdjunto(solicitudId, a.id, email);
      setAdjuntos((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el documento.");
    }
  }

  return (
    <Panel
      title="Documentos"
      subtitle={`PDF, Word, PowerPoint o imágenes · hasta ${MAX_MB} MB.`}
      action={
        puedeSubir ? (
          <>
            <input
              ref={input}
              type="file"
              accept={ACEPTA}
              className="sr-only"
              aria-label="Adjuntar documento"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subir(f);
              }}
            />
            <Button variant="outline" size="sm" icon="upload" onClick={() => input.current?.click()} disabled={subiendo}>
              {subiendo ? "Subiendo…" : "Adjuntar"}
            </Button>
          </>
        ) : null
      }
    >
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-caption text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setCargando(true);
              setRecarga((n) => n + 1);
            }}
            className="shrink-0 font-medium underline underline-offset-2 hover:opacity-80"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <div aria-live="polite">
        {cargando ? (
          <p className="text-caption text-body">Cargando documentos…</p>
        ) : adjuntos.length === 0 ? (
          <p className="text-caption text-body">Todavía no hay documentos adjuntos.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {adjuntos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Icon name="paperclip" size={15} className="shrink-0 text-body" />
                <div className="min-w-0 flex-1">
                  <a
                    href={api.urlAdjunto(solicitudId, a.id, email)}
                    className="block truncate text-caption font-medium text-ink hover:underline"
                    download
                  >
                    {a.nombreArchivo}
                  </a>
                  <p className="text-caption text-body">
                    {fecha(a.creadoEn)}
                    {a.tamanoBytes ? ` · ${tamano(a.tamanoBytes)}` : ""}
                    {a.subidoPorEmail ? ` · ${a.subidoPorEmail}` : ""}
                  </p>
                </div>
                {puedeBorrar(a) ? (
                  <button
                    type="button"
                    onClick={() => void borrar(a)}
                    className="shrink-0 rounded-xs px-2 py-1.5 text-caption font-medium text-critical hover:bg-surface-soft"
                    aria-label={`Eliminar ${a.nombreArchivo}`}
                  >
                    Eliminar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
