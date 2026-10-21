"use client";

// Documentos adjuntos de una solicitud (4.4.12), compartido por los tres portales.
//
// Los sube Compras (coordinador/admin) y también el solicitante desde su solicitud ya enviada.
// No se muestran en el enlace público: ese enlace solo debe mostrar la comparativa.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { Adjunto } from "@/lib/domain/types";

const ACEPTA = ".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg";
const MAX_MB = 10;

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
        if (vivo) setError("No se pudieron cargar los documentos.");
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
    <section className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Documentos de la solicitud
          </span>
          <p className="text-[11px] text-slate-500 mt-1">
            PDF, Word, PowerPoint o imágenes · hasta {MAX_MB} MB.
          </p>
        </div>
        {puedeSubir ? (
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
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={subiendo}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 min-h-[40px] rounded-xl text-sky-700 hover:bg-sky-50 border border-sky-200 disabled:opacity-60"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12m0-12 4 4m-4-4-4 4" />
              </svg>
              {subiendo ? "Subiendo…" : "Adjuntar documento"}
            </button>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="mt-4" aria-live="polite">
        {cargando ? (
          <p className="text-xs text-slate-400">Cargando documentos…</p>
        ) : adjuntos.length === 0 ? (
          <p className="text-xs text-slate-500">Todavía no hay documentos adjuntos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {adjuntos.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center gap-3">
                <span className="text-slate-400" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={api.urlAdjunto(solicitudId, a.id, email)}
                    className="block text-xs font-semibold text-slate-800 hover:text-sky-700 truncate"
                    download
                  >
                    {a.nombreArchivo}
                  </a>
                  <p className="text-[11px] text-slate-500">
                    {fecha(a.creadoEn)}
                    {a.tamanoBytes ? ` · ${tamano(a.tamanoBytes)}` : ""}
                    {a.subidoPorEmail ? ` · ${a.subidoPorEmail}` : ""}
                  </p>
                </div>
                {puedeBorrar(a) ? (
                  <button
                    type="button"
                    onClick={() => void borrar(a)}
                    className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 px-2 py-1.5 rounded-lg hover:bg-rose-50"
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
    </section>
  );
}
