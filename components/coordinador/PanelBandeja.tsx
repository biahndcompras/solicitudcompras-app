"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { nombreCategoria } from "@/lib/domain/categorias";
import { duracionAtencion, formatoFechaLegible } from "@/lib/domain/semaforo";
import { useSesion } from "@/lib/sesion-context";
import type { Solicitud } from "@/lib/domain/types";
import { PageHeader, SearchField } from "@/components/layout/PageHeader";
import { LiveBand } from "@/components/dashboard/LiveBand";
import { Badge, Button, ButtonLink, IconButton, Panel, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type Etapa = "todas" | "por_cotizar" | "comparativas" | "decisiones" | "cerradas";

const TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);

const ETAPAS: { key: Etapa; label: string; titulo: string; href: string; match: (e: string) => boolean }[] = [
  { key: "todas", label: "Todas", titulo: "Bandeja", href: "/panel", match: () => true },
  {
    key: "por_cotizar",
    label: "Por cotizar",
    titulo: "Por cotizar",
    href: "/panel/cotizaciones",
    match: (e) => e === "ENVIADA_A_COMPRAS" || e === "EN_COTIZACION",
  },
  { key: "comparativas", label: "Comparativas", titulo: "Comparativas", href: "/panel/comparativas", match: (e) => e === "COMPARATIVA_LISTA" },
  { key: "decisiones", label: "Esperando", titulo: "Esperando decisión", href: "/panel/decisiones", match: (e) => e === "ENVIADA_A_SOLICITANTE" },
  { key: "cerradas", label: "Cerradas", titulo: "Cerradas", href: "/panel/cerradas", match: (e) => TERMINALES.has(e) },
];

/** Prioridad de la cola: primero lo que pide acción, después lo que espera, al final el archivo. */
const PRIORIDAD_ESTADO: Record<string, number> = {
  COMPARATIVA_LISTA: 0,
  ENVIADA_A_COMPRAS: 1,
  EN_COTIZACION: 1,
  ENVIADA_A_SOLICITANTE: 2,
};

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    ENVIADA_A_COMPRAS: "Activa",
    EN_COTIZACION: "Cotizando",
    COMPARATIVA_LISTA: "Comparativa lista",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

function tonoEstado(e: string) {
  if (e === "EN_COTIZACION") return "periwinkle" as const;
  if (e === "COMPARATIVA_LISTA" || e === "ENVIADA_A_SOLICITANTE") return "mint" as const;
  if (e === "CERRADA_CON_DECISION") return "success" as const;
  if (e === "CANCELADA") return "critical" as const;
  if (e === "CERRADA_SIN_DECISION") return "neutral" as const;
  return "dark" as const;
}

function diasDeRetraso(s: Solicitud): number | null {
  if (s.fechaCierre || !s.fechaRequerida) return null;
  const req = new Date(`${s.fechaRequerida}T23:59:59`).getTime();
  if (!Number.isFinite(req) || req >= Date.now()) return null;
  return Math.max(1, Math.round((Date.now() - req) / 86_400_000));
}

/**
 * Bandeja del coordinador (F4).
 *
 * Replanteo del panel: la navegación son las ETAPAS del flujo, no un menú
 * genérico. Cada etapa es una ruta con su contador; la bandeja muestra la cola
 * de trabajo y un riel con lo urgente, en vez de cuatro tarjetas que repetían
 * los mismos números.
 */
export function PanelBandeja({ etapa = "todas" }: { etapa?: Etapa }) {
  const sesion = useSesion();
  const [busqueda, setBusqueda] = useState("");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);

  useEffect(() => {
    const localId = sesion?.localId;
    if (!localId) return;
    let vivo = true;
    api
      .listarSolicitudes(localId)
      .then((d) => {
        if (vivo) setSolicitudes(d);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setSolicitudes([]);
        setError(
          e instanceof Error && !(e instanceof TypeError) && e.message
            ? e.message
            : "No se pudo conectar con el servidor para traer su bandeja. Revise su conexión e intente de nuevo."
        );
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [sesion?.localId, intentoCarga]);

  function reintentar() {
    setError(null);
    setCargando(true);
    setIntentoCarga((n) => n + 1);
  }

  const definicion = ETAPAS.find((e) => e.key === etapa) ?? ETAPAS[0];

  const contadores = useMemo(
    () =>
      ETAPAS.map((e) => ({
        ...e,
        count: solicitudes.filter((s) => e.match(s.estado)).length,
      })),
    [solicitudes]
  );

  const deLaEtapa = useMemo(
    () => solicitudes.filter((s) => definicion.match(s.estado)),
    [solicitudes, definicion]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? deLaEtapa.filter((s) =>
          [s.numeroReferencia, s.solicitanteNombre, s.titulo, s.categoria].some((v) =>
            (v ?? "").toLowerCase().includes(q)
          )
        )
      : deLaEtapa;
    // Cola de trabajo: acción primero (comparativa lista, cotizar), luego espera, luego archivo;
    // dentro de cada grupo, lo más retrasado y después lo más antiguo.
    return [...base].sort((a, b) => {
      const pa = PRIORIDAD_ESTADO[a.estado] ?? 3;
      const pb = PRIORIDAD_ESTADO[b.estado] ?? 3;
      if (pa !== pb) return pa - pb;
      const ra = diasDeRetraso(a) ?? 0;
      const rb = diasDeRetraso(b) ?? 0;
      if (ra !== rb) return rb - ra;
      return a.fechaCreacion < b.fechaCreacion ? -1 : a.fechaCreacion > b.fechaCreacion ? 1 : 0;
    });
  }, [deLaEtapa, busqueda]);

  const porCotizar = contadores.find((c) => c.key === "por_cotizar")?.count ?? 0;
  const comparativas = contadores.find((c) => c.key === "comparativas")?.count ?? 0;
  const esperando = contadores.find((c) => c.key === "decisiones")?.count ?? 0;
  const cerradas = contadores.find((c) => c.key === "cerradas")?.count ?? 0;

  const prioridad = useMemo(
    () =>
      [...deLaEtapa]
        // El archivo no es «prioridad»: un cerrado no pide acción.
        .filter((s) => !TERMINALES.has(s.estado))
        .map((s) => ({ s, dias: duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).dias ?? 0 }))
        .sort((a, b) => {
          const ra = diasDeRetraso(a.s) ?? 0;
          const rb = diasDeRetraso(b.s) ?? 0;
          if (ra !== rb) return rb - ra;
          return b.dias - a.dias;
        })
        .slice(0, 5),
    [deLaEtapa]
  );

  const hoy = new Date();
  const hoyTexto = `${hoy.toLocaleDateString("es-HN", { day: "2-digit", month: "short" })} ${hoy.getFullYear()}`;

  const headline =
    porCotizar > 0 && comparativas > 0
      ? `${porCotizar} ${porCotizar === 1 ? "solicitud espera" : "solicitudes esperan"} cotización. ${comparativas} ${
          comparativas === 1 ? "comparativa lista" : "comparativas listas"
        } para enviar.`
      : porCotizar > 0
        ? `${porCotizar} ${porCotizar === 1 ? "solicitud espera" : "solicitudes esperan"} cotización. Ninguna comparativa pendiente de envío.`
        : comparativas > 0
          ? `${comparativas} ${comparativas === 1 ? "comparativa lista" : "comparativas listas"} para enviar. Nada pendiente de cotizar.`
          : `Bandeja al día. ${esperando} ${esperando === 1 ? "solicitud espera" : "solicitudes esperan"} decisión del solicitante.`;

  return (
    <>
      <PageHeader
        title={definicion.titulo}
        subtitle={`${hoyTexto} · ${deLaEtapa.length} ${deLaEtapa.length === 1 ? "solicitud" : "solicitudes"} en esta vista.`}
        actions={
          <>
            <SearchField
              placeholder="Buscar solicitud"
              value={busqueda}
              onChange={setBusqueda}
            />
            <IconButton icon="refresh" label="Actualizar bandeja" onClick={reintentar} />
          </>
        }
      />

      <LiveBand
        eyebrow="Pulso de tu bandeja"
        headline={headline}
        stats={[
          { label: "Por cotizar", value: porCotizar, format: (n) => String(Math.round(n)), sub: "requieren acción" },
          { label: "Comparativas", value: comparativas, format: (n) => String(Math.round(n)), sub: "listas para enviar" },
          { label: "Esperando decisión", value: esperando, format: (n) => String(Math.round(n)), sub: "en manos del solicitante" },
          { label: "Cerradas", value: cerradas, format: (n) => String(Math.round(n)), sub: "archivo" },
        ]}
        actions={
          <>
            <ButtonLink href="/panel/cotizaciones" variant="mint">
              Ver por cotizar
            </ButtonLink>
            <ButtonLink href="/panel/comparativas" variant="white">
              Ver comparativas
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_388px]">
        <Panel
          title="Solicitudes"
          subtitle={`${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"}`}
        >
          <nav
            aria-label="Etapas del flujo"
            className="flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border-hairline)]"
          >
            {contadores.map((c) => {
              const activa = c.key === definicion.key;
              return (
                <Link
                  key={c.key}
                  href={c.href}
                  aria-current={activa ? "page" : undefined}
                  className={cx(
                    "relative flex shrink-0 items-center gap-2 px-1 py-2.5 text-body-md font-medium transition-colors",
                    activa ? "text-ink" : "text-body hover:text-ink"
                  )}
                >
                  {c.label}
                  <span
                    className={cx(
                      "mono-label rounded-sm px-1.5",
                      activa ? "bg-primary text-on-dark" : "bg-surface-soft text-ink"
                    )}
                  >
                    {c.count}
                  </span>
                  {activa ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" aria-hidden /> : null}
                </Link>
              );
            })}
          </nav>

          {cargando && sesion?.localId ? (
            <p className="py-10 text-caption text-body">Cargando bandeja…</p>
          ) : !sesion?.localId ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-body-lg text-ink">No se pudo cargar su bandeja</p>
              <p className="text-caption text-body">
                Su cuenta no está vinculada a un coordinador. Contacte a Compras.
              </p>
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-body-lg text-ink">No pudimos traer su bandeja</p>
              <p className="max-w-md text-caption text-body">{error}</p>
              <Button variant="outline" size="sm" icon="refresh" onClick={reintentar}>
                Reintentar
              </Button>
            </div>
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              {busqueda.trim() !== "" ? (
                <>
                  <p className="text-body-lg text-ink">Sin resultados para «{busqueda.trim()}»</p>
                  <p className="text-caption text-body">Revise la referencia, el título o el nombre del solicitante.</p>
                  <Button variant="outline" size="sm" onClick={() => setBusqueda("")}>
                    Limpiar búsqueda
                  </Button>
                </>
              ) : definicion.key !== "todas" ? (
                <>
                  <p className="text-body-lg text-ink">No hay solicitudes en «{definicion.titulo}»</p>
                  <p className="text-caption text-body">Pruebe con otra etapa o vea todas.</p>
                  <ButtonLink href="/panel" variant="outline">
                    Ver todas
                  </ButtonLink>
                </>
              ) : (
                <>
                  <p className="text-body-lg text-ink">No tiene solicitudes asignadas</p>
                  <p className="text-caption text-body">Cuando te asignen una categoría, aparecerán acá.</p>
                </>
              )}
            </div>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="bg-surface-soft text-left">
                    {["Solicitud", "Estado", "Acción"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className={cx(
                          "eyebrow px-3 py-3 font-medium text-ink",
                          h === "Acción" && "text-right"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((s) => {
                    const retraso = diasDeRetraso(s);
                    const dur = duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre });
                    return (
                      <tr key={s.id} className="border-b border-hairline hover:bg-surface-soft/60">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {s.numeroReferencia ? (
                              <span className="mono-label text-ink">{s.numeroReferencia}</span>
                            ) : (
                              <span
                                className="text-caption italic text-body"
                                title={`Sin referencia asignada · id interno ${s.id}`}
                              >
                                Sin referencia
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-body-md text-ink">{s.titulo}</p>
                          <p className="text-caption text-body">
                            {s.solicitanteNombre} · {nombreCategoria(s.categoria)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={tonoEstado(s.estado)}>{estadoLegible(s.estado)}</Badge>
                          <p className="mt-1 text-caption text-body">
                            {retraso !== null ? (
                              <span className="text-critical">Retrasada · {retraso} d</span>
                            ) : (
                              <>{dur.texto} de gestión</>
                            )}
                          </p>
                          {s.fechaRequerida ? (
                            <p className="text-caption text-body">Entrega: {formatoFechaLegible(s.fechaRequerida)}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/panel/solicitud/${s.id}`}
                            aria-label={`Abrir ${s.numeroReferencia ?? `solicitud ${s.titulo}`}`}
                            className="inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1.5 text-caption font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft"
                          >
                            Abrir
                            <Icon name="chevron-left" size={14} className="rotate-180" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title="Prioridad de hoy" subtitle={definicion.key === "todas" ? "Lo más urgente" : `En «${definicion.titulo}»`}>
            {prioridad.length ? (
              <ul className="divide-y divide-hairline">
                {prioridad.map(({ s, dias }) => {
                  const retraso = diasDeRetraso(s);
                  return (
                    <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link href={`/panel/solicitud/${s.id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="mono-label truncate text-ink">{s.numeroReferencia ?? s.titulo}</span>
                          <span className="mono-label shrink-0 text-critical">
                            {retraso !== null ? `${retraso} d` : `${Math.round(dias)} d`}
                          </span>
                        </div>
                        <p className="truncate text-caption text-body">{s.solicitanteNombre}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-caption text-body">Nada urgente en esta vista.</p>
            )}
          </Panel>

          <Panel title="Carga por etapa" subtitle="Solicitudes en cada etapa">
            <ul className="flex flex-col gap-3">
              {contadores
                .filter((c) => c.key !== "todas")
                .map((c) => {
                  const max = Math.max(1, ...contadores.filter((x) => x.key !== "todas").map((x) => x.count));
                  return (
                    <li key={c.key}>
                      <div className="mb-1 flex justify-between text-caption">
                        <span className="text-ink">{c.label}</span>
                        <span className="text-body tabular-nums">{c.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-soft">
                        <div className="h-1.5 bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Panel>

          <Panel title="Cómo funciona" subtitle="El flujo de una solicitud">
            <ol className="flex flex-col gap-3">
              {[
                ["Cotiza", "Cargue las ofertas de los proveedores en la solicitud."],
                ["Compara y envía", "Revise la comparativa, escriba su recomendación y envíela."],
                ["El solicitante decide", "Compras recibe la decisión y la solicitud se cierra."],
              ].map(([titulo, texto], i) => (
                <li key={titulo} className="flex gap-3">
                  <span className="mono-label grid size-6 shrink-0 place-items-center rounded-xs bg-mint text-ink">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-caption font-medium text-ink">{titulo}</span>
                    <span className="block text-caption text-body">{texto}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
