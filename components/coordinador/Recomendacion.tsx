"use client";

import { useState } from "react";
import type { Cotizacion, ProsContras } from "@/lib/domain/types";
import { bloqueoB3Activo } from "@/lib/domain/rules";
import { formato } from "@/lib/domain/comparativa";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type RecomendacionProps = {
  cotizaciones: Cotizacion[];
  prosContras: Record<string, ProsContras>;
  sugerenciaIA?: string;
  cotizacionSugeridaId?: string;
  enlace?: { token: string; url: string } | null;
  onEnviar: (recomendacion: string) => Promise<boolean>;
};

export function Recomendacion({ cotizaciones, prosContras, sugerenciaIA, cotizacionSugeridaId, enlace, onEnviar }: RecomendacionProps) {
  const [recomendacion, setRecomendacion] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sugerida = cotizaciones.find((c) => c.id === cotizacionSugeridaId);
  const bloqueado = bloqueoB3Activo(recomendacion);

  if (enviado) {
    return (
      <Panel
        title="Comparativa enviada"
        subtitle="La solicitud queda en espera de la decisión del solicitante. El ciclo del coordinador termina aquí."
        action={<Badge tone="success">ENVIADA_A_SOLICITANTE</Badge>}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-sm bg-surface-soft px-4 py-3">
            <p className="eyebrow text-body">Enlace público (token)</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                defaultValue={enlace?.url ?? "Generando enlace…"}
                title={enlace?.url}
                className="h-10 min-w-0 flex-1 rounded-sm bg-canvas px-3 text-caption text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (enlace) {
                    navigator.clipboard?.writeText(enlace.url);
                    setCopiado(true);
                  }
                }}
              >
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="mt-2 text-caption text-body">Se incluye en el correo al solicitante.</p>
          </div>

          <div className="rounded-sm bg-surface-soft px-4 py-3">
            <p className="eyebrow text-body">Estado</p>
            <p className="mt-2 text-caption text-ink">
              Transición: <span className="font-medium">COMPARATIVA_LISTA → ENVIADA_A_SOLICITANTE</span>
            </p>
            <p className="mt-1 text-caption text-body">
              Siguiente: <span className="font-medium text-ink">decisión del solicitante</span>
            </p>
          </div>

          <div className="rounded-sm bg-surface-soft px-4 py-3">
            <p className="eyebrow text-body">Notificación</p>
            <p className="mt-2 text-caption text-ink">Correo 3 enviado al solicitante con el enlace público.</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-caption text-body">
              <Icon name="check-circle" size={14} />
              Registrado en la bitácora
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-display-md text-ink">09 · Recomendación</h2>
        <p className="mt-1 text-caption text-body">
          Punto de control humano (RN-01). Puede contradecir la sugerencia del sistema sin fricción.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cotizaciones.map((c) => {
          const pc = prosContras[c.id];
          const esSugerida = c.id === cotizacionSugeridaId;
          return (
            <div
              key={c.id}
              className={
                "flex min-w-0 flex-col gap-2 rounded-sm p-4 " +
                (esSugerida
                  ? "bg-mint shadow-[inset_0_0_0_1px_#000]"
                  : "bg-canvas shadow-[inset_0_0_0_1px_var(--color-border-hairline)]")
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-body-md font-medium text-ink">{c.proveedorNombre}</p>
                {esSugerida ? <Badge tone="dark">Sugerido</Badge> : null}
              </div>
              <p className="text-caption text-body">
                Total: <span className="font-medium text-ink">{c.moneda ?? "L"} {formato(c.valorTotal)}</span>
              </p>
              {(pc?.pros.length ?? 0) > 0 || (pc?.contras.length ?? 0) > 0 ? (
                <>
                  {(pc?.pros.length ?? 0) > 0 ? (
                    <div>
                      <p className="eyebrow text-success">Pros</p>
                      <ul className="mt-1 flex flex-col gap-0.5 text-caption text-ink">
                        {(pc?.pros ?? []).map((p) => (
                          <li key={p}>+ {p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(pc?.contras.length ?? 0) > 0 ? (
                    <div>
                      <p className="eyebrow text-critical">Contras</p>
                      <ul className="mt-1 flex flex-col gap-0.5 text-caption text-ink">
                        {(pc?.contras ?? []).map((p) => (
                          <li key={p}>− {p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-caption text-body">Sin pros ni contras registrados.</p>
              )}
            </div>
          );
        })}
      </div>

      {sugerenciaIA ? (
        <div className="rounded-sm bg-surface-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow text-body">Sugerencia del sistema</span>
            <span className="text-caption text-body">Solo un insumo, no la decisión</span>
          </div>
          <p className="mt-2 text-caption font-medium text-ink">
            Proveedor sugerido: {sugerida?.proveedorNombre ?? "—"}
          </p>
          <p className="mt-1 text-caption text-body">{sugerenciaIA}</p>
        </div>
      ) : null}

      <Panel title="Recomendación del coordinador" subtitle="Es obligatoria: el servidor también la exige (B3).">
        <textarea
          value={recomendacion}
          onChange={(e) => setRecomendacion(e.target.value)}
          rows={4}
          placeholder="Escriba su criterio para el solicitante: qué conviene, riesgos, qué falta confirmar…"
          className="w-full resize-none rounded-sm bg-canvas px-3 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none focus:shadow-[inset_0_0_0_1px_#000]"
        />
        {bloqueado ? (
          <p className="text-caption text-body">
            Escriba su recomendación antes de enviar. El solicitante decide, pero su criterio es lo que más le sirve.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-body">El solicitante recibe el enlace y decide.</p>
          <Button
            disabled={bloqueado || enviando}
            onClick={async () => {
              setErrorEnvio(null);
              setEnviando(true);
              const ok = await onEnviar(recomendacion);
              setEnviando(false);
              if (ok) setEnviado(true);
              else setErrorEnvio("No se pudo enviar. Revise la conexión e intente de nuevo.");
            }}
          >
            {enviando ? "Enviando…" : "Enviar comparativa al solicitante"}
          </Button>
        </div>
        {errorEnvio ? (
          <p role="alert" className="text-caption text-critical">
            {errorEnvio}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
