"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicShell } from "@/components/layout/PublicShell";
import { TrackerEtapas } from "@/components/TrackerEtapas";
import { Badge, Button, ButtonLink, type BadgeTone } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";
import { Icon } from "@/components/ui/Icon";
import { SummaryStrip } from "@/components/ui/forms";
import { Ribbon } from "@/components/brand/Ribbon";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { api, type SalidaCorta } from "@/lib/api-client";
import {
  snapshotDecision,
  servidorDecision,
  suscribirDecision,
  esperandoDecision,
  type MapaDecision,
} from "@/lib/enlaces-decision";

export default function MisSolicitudesPage() {
  return (
    <Suspense fallback={null}>
      <MisSolicitudesInner />
    </Suspense>
  );
}

function MisSolicitudesInner() {
  const searchParams = useSearchParams();
  const qEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(qEmail);
  const [buscado, setBuscado] = useState(!!qEmail);
  const [cargando, setCargando] = useState(!!qEmail);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<SalidaCorta[]>([]);
  // Tokens de decisión que YA se abrieron en este navegador. Snapshot de servidor vacío:
  // el CTA no aparece en el SSR y entra al montar, sin romper la hidratación.
  const tokensDecision = useSyncExternalStore(suscribirDecision, snapshotDecision, servidorDecision) as MapaDecision;

  async function consultar(correo: string) {
    if (!correo.trim()) return;
    setBuscado(true);
    setCargando(true);
    setError(null);
    try {
      setResultados(await api.misSolicitudes(correo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar");
      setResultados([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!qEmail) return;
    let activo = true;
    api
      .misSolicitudes(qEmail)
      .then((r) => {
        if (activo) setResultados(r);
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "Error al consultar");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [qEmail]);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    await consultar(email);
  }

  const enCurso = resultados.filter((s) =>
    ["ENVIADA_A_COMPRAS", "EN_COTIZACION", "COMPARATIVA_LISTA"].includes(s.estado)
  ).length;
  const esperando = resultados.filter((s) => s.estado === "ENVIADA_A_SOLICITANTE").length;
  const cerradas = resultados.filter((s) =>
    ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(s.estado)
  ).length;
  const conDecision = resultados.find((s) => tokensDecision[s.id]);

  return (
    <PublicShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-body">Seguimiento</p>
          <h1 className="mt-2 text-display-lg text-ink">Mis solicitudes</h1>
          <p className="mt-1 text-caption text-body">Revise el estado de sus pedidos y comparativas.</p>
        </div>
        <ButtonLink href="/" variant="primary" icon="plus">
          Nueva solicitud
        </ButtonLink>
      </div>

      <div className="mb-6 max-w-[520px] rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <TextField
              label="Su correo institucional"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@bia.com"
              autoComplete="email"
            />
          </div>
          <Button type="submit" disabled={!email.includes("@")}>
            Ver
          </Button>
        </form>
        <p className="mt-3 text-caption text-body">
          ¿Primera vez?{" "}
          <Link href="/guias/manual-solicitante" className="font-medium text-ink underline underline-offset-4">
            Vea la guía rápida
          </Link>
          .
        </p>
      </div>

      {buscado && !cargando && !error && resultados.length > 0 ? (
        <div className="mb-4 flex flex-col gap-4">
          <SummaryStrip
            items={[
              { label: "Solicitudes", value: String(resultados.length), sub: "en su historial" },
              { label: "En curso", value: String(enCurso), sub: "Compras trabajando" },
              {
                label: "Esperando decisión",
                value: String(esperando),
                sub: esperando ? "requiere su acción" : "nada pendiente",
                tone: esperando ? "bad" : undefined,
              },
              { label: "Cerradas", value: String(cerradas), sub: "archivo" },
            ]}
          />

          {esperando > 0 ? (
            <div className="on-dark relative isolate overflow-hidden rounded-sm bg-canvas-dark px-5 py-4">
              <Ribbon className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30" />
              <div className="relative z-10 flex flex-wrap items-center gap-3">
                <span className="rb-pulse relative size-2 shrink-0 bg-mint" aria-hidden />
                <p className="min-w-0 flex-1 text-body-md text-on-dark">
                  {esperando} {esperando === 1 ? "solicitud espera" : "solicitudes esperan"} su decisión.
                </p>
                {conDecision ? (
                  <ButtonLink
                    href={`/comparativa/${encodeURIComponent(tokensDecision[conDecision.id].token)}`}
                    variant="mint"
                    size="sm"
                  >
                    Decidir ahora
                  </ButtonLink>
                ) : (
                  <span className="text-caption text-on-dark-muted">Abra el enlace que le envió Compras.</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {buscado ? (
        cargando ? (
          <div className="flex flex-col gap-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                <div className="h-3 w-28 bg-surface-soft" />
                <div className="mt-3 h-4 w-2/3 bg-surface-soft" />
                <div className="mt-4 h-1.5 w-full bg-surface-soft" />
                <div className="mt-4 h-3 w-1/3 bg-surface-soft" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-caption text-critical">
            Ocurrió un problema al consultar: {error}
          </p>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-sm bg-canvas px-6 py-12 text-center shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
            <p className="text-body-lg text-ink">No encontramos solicitudes con este correo</p>
            <p className="text-caption text-body">Revise que sea el mismo correo con el que envió la solicitud.</p>
            <ButtonLink href="/" variant="outline">
              Crear una solicitud
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {resultados.map((s) => {
              const retraso = diasDeRetraso(s);
              return (
                // La tarjeta es un <article> (no un <a>): el "Decidir ahora" es otro enlace
                // y un enlace dentro de otro enlace es HTML inválido. El título estira su
                // zona clicable con after:inset-0.
                <article
                  key={s.id}
                  className={"relative rounded-sm bg-canvas p-5 transition-colors hover:bg-surface-soft/30 " + acentoEstado(s.estado)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="mono-label text-body">{s.numeroReferencia ?? "Sin referencia"}</p>
                      <h2 className="mt-1 text-body-md font-medium text-ink">
                        <Link
                          href={`/mis-solicitudes/${s.id}?email=${encodeURIComponent(email)}`}
                          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-border-strong)]"
                        >
                          {s.titulo}
                        </Link>
                      </h2>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {retraso !== null ? <Badge tone="critical">Retrasada · {retraso} d</Badge> : null}
                      <Badge tone={toneDe(s.estado)}>{estadoLegible(s.estado)}</Badge>
                    </div>
                  </div>

                  <div className="mt-3">
                    <TrackerEtapas estado={s.estado} compacto />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-caption text-body">
                      Creada: {formatoFechaLegible(s.fechaCreacion)} · Atención:{" "}
                      {duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}
                    </p>
                    <span className="relative z-10 inline-flex items-center gap-1 text-caption font-medium text-ink">
                      Ver detalle
                      <Icon name="chevron-left" size={14} className="rotate-180" />
                    </span>
                  </div>

                  {tokensDecision[s.id] ? (
                    <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
                      <ButtonLink
                        href={`/comparativa/${encodeURIComponent(tokensDecision[s.id].token)}`}
                        variant="primary"
                        size="sm"
                      >
                        Decidir ahora
                      </ButtonLink>
                      <span className="text-caption text-body">Enlace que abrió en este navegador.</span>
                    </div>
                  ) : esperandoDecision(s.estado) ? (
                    <p className="relative z-10 mt-3 rounded-xs bg-surface-soft px-3 py-2 text-caption text-ink">
                      Su decisión es el siguiente paso: abra el enlace que Compras le envió por correo.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )
      ) : (
        <p className="text-caption text-body">Ingrese el correo con el que envió su solicitud.</p>
      )}
    </PublicShell>
  );
}

const ACENTO: Record<string, string> = {
  ENVIADA_A_SOLICITANTE:
    "shadow-[inset_3px_0_0_var(--color-bg-accent-mint),inset_0_0_0_1px_var(--color-border-hairline)]",
  EN_COTIZACION:
    "shadow-[inset_3px_0_0_var(--color-bg-accent-periwinkle),inset_0_0_0_1px_var(--color-border-hairline)]",
  COMPARATIVA_LISTA:
    "shadow-[inset_3px_0_0_var(--color-bg-accent-periwinkle),inset_0_0_0_1px_var(--color-border-hairline)]",
  CERRADA_CON_DECISION:
    "shadow-[inset_3px_0_0_var(--color-text-success),inset_0_0_0_1px_var(--color-border-hairline)]",
  CERRADA_SIN_DECISION:
    "shadow-[inset_3px_0_0_var(--color-text-body),inset_0_0_0_1px_var(--color-border-hairline)]",
  CANCELADA:
    "shadow-[inset_3px_0_0_var(--color-bg-critical),inset_0_0_0_1px_var(--color-border-hairline)]",
};

function acentoEstado(estado: string): string {
  return ACENTO[estado] ?? "shadow-[inset_3px_0_0_var(--color-bg-primary),inset_0_0_0_1px_var(--color-border-hairline)]";
}

function diasDeRetraso(s: { fechaRequerida?: string; fechaCierre?: string }): number | null {
  if (s.fechaCierre || !s.fechaRequerida) return null;
  const req = new Date(`${s.fechaRequerida}T23:59:59`).getTime();
  if (!Number.isFinite(req) || req >= Date.now()) return null;
  return Math.max(1, Math.round((Date.now() - req) / 86_400_000));
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    BORRADOR: "Borrador",
    ENVIADA_A_COMPRAS: "Enviada a Compras",
    EN_COTIZACION: "En cotización",
    COMPARATIVA_LISTA: "Comparativa lista",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

function toneDe(e: string): BadgeTone {
  if (e === "EN_COTIZACION") return "periwinkle";
  if (e === "COMPARATIVA_LISTA" || e === "ENVIADA_A_SOLICITANTE") return "mint";
  if (e === "CERRADA_CON_DECISION") return "success";
  if (e === "CANCELADA") return "critical";
  if (e === "CERRADA_SIN_DECISION") return "neutral";
  return "dark";
}
