"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { nombreCategoria } from "@/lib/domain/categorias";
import { duracionAtencion } from "@/lib/domain/semaforo";
import { ESTADOS_ABIERTOS, rellenarSerie, serieDashboard } from "@/lib/domain/dashboard";
import type { MetricasDashboard } from "@/lib/domain/metrics";
import type { Solicitud } from "@/lib/domain/types";
import { Reveal, revealChild } from "@/lib/design/motion";
import { PageHeader, SearchField } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LiveBand } from "@/components/dashboard/LiveBand";
import { SolicitudesChart } from "@/components/charts/SolicitudesChart";
import { Icon } from "@/components/ui/Icon";
import { Badge, Button, Panel, Segmented, type BadgeTone, cx } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/forms";

type Rango = "all" | "hoy" | "semana" | "mes";
type CoordinadorLite = { id: string; nombre: string; email: string };
type Orden = { col: "referencia" | "solicitante" | "coordinador" | "estado" | "tiempo" | "creacion"; dir: "asc" | "desc" };

const POR_PAGINA = 25;

const METRICAS_VACIAS: MetricasDashboard = {
  tasaConversion: null,
  tiempoCicloPromedioDias: null,
  solicitudesActivas: 0,
  solicitudesSinDecision: 0,
  volumenPorCoordinador: {},
  distribucionPorTipo: {},
  distribucionPorSubtipo: {},
  tiempoPorEtapa: {},
};

function promedio(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null);
  if (!validos.length) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

function conSigno(n: number, sufijo = ""): string {
  // Sin cambio no se muestra delta: «+0» en verde o rojo inventa una tendencia.
  if (Math.abs(n) < 0.05) return "";
  const v = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
  return `${n > 0 ? "+" : "−"}${v}${sufijo}`;
}

export function AdminDashboard() {
  const router = useRouter();
  const [rango, setRango] = useState<Rango>("all");
  const [coordinador, setCoordinador] = useState("all");
  const [busqueda, setBusqueda] = useState("");
  const [metricas, setMetricas] = useState<MetricasDashboard>(METRICAS_VACIAS);
  const [coordinadores, setCoordinadores] = useState<CoordinadorLite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMetricas, setErrorMetricas] = useState(false);
  const [procesos, setProcesos] = useState<Solicitud[]>([]);
  const [minIso, setMinIso] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<Orden>({ col: "creacion", dir: "desc" });
  const [recEstado, setRecEstado] = useState<"idle" | "preview" | "loading" | "ok" | "error">("idle");
  const [recMensaje, setRecMensaje] = useState<string | null>(null);
  const [recPendientes, setRecPendientes] = useState<number | null>(null);

  const desdem = rango === "all" ? undefined : rango === "hoy" ? "dia" : rango;

  useEffect(() => {
    let vivo = true;
    api
      .metricas({ rango: desdem, coordinador: coordinador === "all" ? undefined : coordinador })
      .then((m) => {
        if (!vivo) return;
        setMetricas(m);
        setErrorMetricas(false);
      })
      .catch(() => {
        if (!vivo) return;
        setMetricas(METRICAS_VACIAS);
        setErrorMetricas(true);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    api
      .listarSolicitudesTodas()
      .then((s) => {
        if (vivo) setProcesos(s);
      })
      .catch(() => {
        if (vivo) setProcesos([]);
      })
      .finally(() => {
        const atras = rango === "hoy" ? 1 : rango === "semana" ? 7 : rango === "mes" ? 30 : -1;
        if (vivo) setMinIso(atras > 0 ? new Date(Date.now() - atras * 86400000).toISOString() : null);
      });
    fetch("/api/admin/coordinadores")
      .then((r) => (r.ok ? r.json() : []))
      .then((c) => {
        if (vivo) setCoordinadores(c);
      })
      .catch(() => {
        if (vivo) setCoordinadores([]);
      });
    return () => {
      vivo = false;
    };
  }, [rango, coordinador, desdem]);

  function aplicarRango(r: Rango) {
    setRango(r);
    setPagina(1);
    setCargando(true);
  }
  function aplicarCoordinador(id: string) {
    setCoordinador(id);
    setPagina(1);
    setCargando(true);
  }
  function limpiarFiltros() {
    setBusqueda("");
    setCoordinador("all");
    setRango("all");
    setPagina(1);
    setCargando(true);
  }

  const nombreCoord = useCallback(
    (id: string) => coordinadores.find((c) => c.id === id)?.nombre ?? "Sin asignar",
    [coordinadores]
  );

  const umbralSinDecision = metricas.umbralDias ?? 5;

  const procesosCoord = useMemo(
    () => (coordinador === "all" ? procesos : procesos.filter((s) => s.coordinadorId === coordinador)),
    [procesos, coordinador]
  );
  const serie = useMemo(
    () => serieDashboard(procesosCoord, 14, umbralSinDecision),
    [procesosCoord, umbralSinDecision]
  );

  // Los valores del KPI son los OFICIALES del backend (misma regla que 4.10.9); la serie
  // diaria solo dibuja la tendencia.
  // Los conteos del hero y el panel de seguimiento respetan el RANGO (igual que la API de
  // métricas); si no, al elegir «Hoy» el KPI diría 0 y el panel mostraría las de hace 2 meses.
  const procesosRango = useMemo(
    () => (rango === "all" || !minIso ? procesosCoord : procesosCoord.filter((s) => s.fechaCreacion >= minIso)),
    [procesosCoord, rango, minIso]
  );
  const activas = errorMetricas ? 0 : metricas.solicitudesActivas;
  const sinDecision = errorMetricas ? 0 : metricas.solicitudesSinDecision;
  const esperandoCot = procesosRango.filter((s) => s.estado === "EN_COTIZACION").length;
  const comparativa = procesosRango.filter((s) => s.estado === "COMPARATIVA_LISTA").length;

  const activasPrev = serie[serie.length - 8]?.activas ?? activas;
  const sinDecisionPrev = serie[serie.length - 8]?.sinDecision ?? sinDecision;
  const conv7 = promedio(serie.slice(-7).map((d) => d.conversion));
  const convPrev = promedio(serie.slice(-14, -7).map((d) => d.conversion));
  const tiempo7 = promedio(serie.slice(-7).map((d) => d.tiempo));
  const tiempoPrev = promedio(serie.slice(-14, -7).map((d) => d.tiempo));

  const tendenciaConversion = rellenarSerie(serie.map((d) => d.conversion));
  const tendenciaTiempo = rellenarSerie(serie.map((d) => d.tiempo));

  const barrasVolumen = Object.entries(metricas.volumenPorCoordinador ?? {})
    .map(([id, v]) => ({ id, label: nombreCoord(id), value: v }))
    .sort((a, b) => b.value - a.value);
  const maxVolumen = Math.max(1, ...barrasVolumen.map((b) => b.value));

  const distribucion = Object.entries(metricas.distribucionPorTipo ?? {}).sort((a, b) => b[1] - a[1]);
  const distribucionTotal = Math.max(1, distribucion.reduce((a, [, v]) => a + v, 0));
  const distribucionSubtipo = Object.entries(metricas.distribucionPorSubtipo ?? {}).sort((a, b) => b[1] - a[1]);
  const distribucionSubtipoTotal = Math.max(1, distribucionSubtipo.reduce((a, [, v]) => a + v, 0));

  const etapas = Object.entries(metricas.tiempoPorEtapa ?? {}).sort(
    ([a], [b]) => ORDEN_ETAPAS.indexOf(a) - ORDEN_ETAPAS.indexOf(b)
  );

  const envejecidas = useMemo(
    () =>
      procesosRango
        // Misma regla que el KPI del backend: abiertas (no BORRADOR, no terminales).
        .filter((s) => ESTADOS_ABIERTOS.has(s.estado))
        .map((s) => ({ s, dias: duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).dias ?? 0 }))
        .filter((x) => x.dias > umbralSinDecision)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 5),
    [procesosRango, umbralSinDecision]
  );

  async function previsualizarRecordatorios() {
    setRecEstado("preview");
    setRecMensaje(null);
    try {
      const r = await fetch("/api/admin/recordatorios/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { vencidas: number };
      setRecPendientes(d.vencidas);
      setRecEstado("idle");
      setRecMensaje(
        d.vencidas === 0
          ? "No hay recordatorios pendientes: ninguna ronda de preguntas superó el umbral sin respuesta."
          : `Hay ${d.vencidas} recordatorio${d.vencidas === 1 ? "" : "s"} pendiente${d.vencidas === 1 ? "" : "s"} de enviar.`
      );
    } catch {
      setRecEstado("error");
      setRecMensaje("No se pudieron revisar los recordatorios.");
    }
  }

  async function enviarRecordatorios() {
    if (
      !window.confirm(
        "Se enviará el recordatorio de información pendiente (correo 8) al coordinador asignado de cada solicitud. Es un correo real y se envía una sola vez por ronda. ¿Continuar?"
      )
    ) {
      return;
    }
    setRecEstado("loading");
    setRecMensaje(null);
    try {
      const r = await fetch("/api/admin/recordatorios/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { vencidas: number; recordatoriosEnviados: number };
      const plural = (n: number) => (n === 1 ? "" : "s");
      setRecEstado("ok");
      setRecPendientes(0);
      setRecMensaje(
        `Se enviaron ${d.recordatoriosEnviados} recordatorio${plural(d.recordatoriosEnviados)} de ${d.vencidas} pendiente${plural(d.vencidas)}.`
      );
    } catch {
      setRecEstado("error");
      setRecMensaje("No se pudieron enviar los recordatorios.");
    }
  }

  const exportUrl = `/api/metricas/excel?rango=${rango === "all" ? "todo" : rango === "hoy" ? "dia" : rango}${
    coordinador !== "all" ? `&coordinador=${coordinador}` : ""
  }`;

  const procesosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return procesos.filter((s) => {
      if (rango !== "all" && minIso && s.fechaCreacion < minIso) return false;
      if (coordinador !== "all" && s.coordinadorId !== coordinador) return false;
      if (q === "") return true;
      return [s.numeroReferencia, s.solicitanteNombre, s.titulo, s.areaSolicitante].some((v) =>
        (v ?? "").toLowerCase().includes(q)
      );
    });
  }, [procesos, rango, minIso, coordinador, busqueda]);

  const procesosOrdenados = useMemo(() => {
    const signo = orden.dir === "asc" ? 1 : -1;
    const copia = [...procesosFiltrados];
    copia.sort((a, b) => {
      switch (orden.col) {
        case "referencia":
          return signo * (a.numeroReferencia ?? "").localeCompare(b.numeroReferencia ?? "", "es");
        case "solicitante":
          return signo * (a.solicitanteNombre ?? "").localeCompare(b.solicitanteNombre ?? "", "es");
        case "coordinador":
          return signo * nombreCoord(a.coordinadorId ?? "").localeCompare(nombreCoord(b.coordinadorId ?? ""), "es");
        case "estado":
          return signo * a.estado.localeCompare(b.estado, "es");
        case "tiempo":
          return (
            signo *
            ((duracionAtencion({ fechaCreacion: a.fechaCreacion, fechaCierre: a.fechaCierre }).dias ?? 0) -
              (duracionAtencion({ fechaCreacion: b.fechaCreacion, fechaCierre: b.fechaCierre }).dias ?? 0))
          );
        case "creacion":
        default:
          return signo * (a.fechaCreacion < b.fechaCreacion ? -1 : a.fechaCreacion > b.fechaCreacion ? 1 : 0);
      }
    });
    return copia;
  }, [procesosFiltrados, orden, nombreCoord]);

  const totalPaginas = Math.max(1, Math.ceil(procesosOrdenados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const desde = (paginaSegura - 1) * POR_PAGINA;
  const visibles = procesosOrdenados.slice(desde, desde + POR_PAGINA);
  const filtrando = busqueda.trim() !== "" || coordinador !== "all" || rango !== "all";

  function alternarOrden(col: Orden["col"]) {
    setOrden((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }

  const deltaConversion = conv7 !== null && convPrev !== null ? conSigno(conv7 - convPrev, " pts") : undefined;
  const deltaTiempo = tiempo7 !== null && tiempoPrev !== null ? conSigno(tiempo7 - tiempoPrev, " d") : undefined;
  const deltaActivas = serie.length >= 8 ? conSigno(activas - activasPrev) : undefined;
  const deltaSinDecision = serie.length >= 8 ? conSigno(sinDecision - sinDecisionPrev) : undefined;

  const ahora = new Date();
  const hoyTexto = `${ahora.toLocaleDateString("es-HN", { day: "2-digit", month: "short" })} ${ahora.getFullYear()}`;

  return (
    <>
      <PageHeader
        title="Panel de compras"
        subtitle={`${hoyTexto} · ${procesos.length} solicitudes · ${activas} en curso.`}
        actions={
          <>
            <SearchField
              placeholder="Buscar referencia, solicitante o área"
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              className="max-xl:hidden"
            />
            <Segmented
              id="rango"
              label="Rango de fecha"
              value={rango}
              onChange={aplicarRango}
              options={[
                { value: "all", label: "Todo" },
                { value: "hoy", label: "Hoy" },
                { value: "semana", label: "Semana" },
                { value: "mes", label: "Mes" },
              ]}
            />
            <Button variant="outline" icon="download" className="max-xl:hidden" onClick={() => {
                // Descarga: la ruta devuelve un archivo, no una página.
                const a = document.createElement("a");
                a.href = exportUrl;
                a.rel = "noopener";
                a.click();
              }}>
              Exportar
            </Button>
            <Button icon="arrow-up-right" onClick={() => router.push("/admin/procesos")}>
              <span className="hidden sm:inline">Procesos</span>
              <span className="sm:hidden">Procesos</span>
            </Button>
          </>
        }
      />

      <LiveBand
        headline={
          sinDecision > 0
            ? `${activas} solicitudes en curso. ${sinDecision} llevan más de ${umbralSinDecision} días sin decisión.`
            : `${activas} solicitudes en curso. Ninguna supera el umbral de ${umbralSinDecision} días sin decisión.`
        }
        stats={[
          { label: "Activas", value: activas, format: (n) => String(Math.round(n)), sub: "en curso ahora" },
          { label: "En cotización", value: esperandoCot, format: (n) => String(Math.round(n)), sub: "esperando ofertas" },
          { label: "Comparativa lista", value: comparativa, format: (n) => String(Math.round(n)), sub: "listas para revisar" },
          { label: "Sin decisión", value: sinDecision, format: (n) => String(Math.round(n)), sub: `más de ${umbralSinDecision} días` },
        ]}
        actions={
          <>
            <Button variant="mint" onClick={() => router.push("/admin/procesos")}>
              Ver procesos
            </Button>
            <Button variant="white" onClick={() => document.getElementById("recordatorios")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Revisar recordatorios
            </Button>
          </>
        }
      />

      {cargando ? (
        <p className="text-caption text-body">Calculando métricas…</p>
      ) : (
        <>
          {filtrando ? (
            <p className="text-caption text-body">
              KPIs y gráficas:{" "}
              <span className="font-medium text-ink">
                {rango !== "all" ? `rango ${rango === "hoy" ? "hoy" : rango === "semana" ? "esta semana" : "este mes"}` : "todo el histórico"}
                {coordinador !== "all" ? ` · ${nombreCoord(coordinador)}` : ""}
              </span>
              {busqueda.trim() !== "" ? " — no incluyen la búsqueda de la tabla." : ""}
            </p>
          ) : null}

          {errorMetricas ? (
            <p role="alert" className="rounded-sm border border-[var(--color-text-critical)] bg-canvas px-4 py-3 text-caption text-critical">
              No se pudieron calcular las métricas. Los valores no están disponibles.
            </p>
          ) : null}

          <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Conversión"
              value={metricas.tasaConversion}
              format={(n) => `${Math.round(n)}%`}
              delta={deltaConversion || undefined}
              good={deltaConversion ? !deltaConversion.startsWith("−") : undefined}
              comparison="sobre enviadas"
              trend={tendenciaConversion}
              icon="reports"
              tone="periwinkle"
              index={0}
              error={errorMetricas}
            />
            <KpiCard
              label="Tiempo promedio"
              value={metricas.tiempoCicloPromedioDias}
              format={(n) => n.toFixed(1)}
              unit="días"
              delta={deltaTiempo || undefined}
              good={deltaTiempo ? deltaTiempo.startsWith("−") : undefined}
              comparison="envío → cierre"
              trend={tendenciaTiempo}
              icon="clock"
              index={1}
              error={errorMetricas}
            />
            <KpiCard
              label="Procesos activos"
              value={activas}
              format={(n) => String(Math.round(n))}
              delta={deltaActivas || undefined}
              comparison="en curso"
              trend={serie.map((d) => d.activas)}
              icon="orders"
              tone="mint"
              index={2}
              error={errorMetricas}
            />
            <KpiCard
              label={`Sin decisión > ${umbralSinDecision} días`}
              value={sinDecision}
              format={(n) => String(Math.round(n))}
              delta={deltaSinDecision || undefined}
              good={deltaSinDecision ? deltaSinDecision.startsWith("−") : undefined}
              comparison="requieren acción"
              trend={serie.map((d) => d.sinDecision)}
              icon="alert"
              index={3}
              error={errorMetricas}
            />
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_388px]">
            <motion.div variants={revealChild} className="min-w-0">
              <Panel title="Solicitudes por día" subtitle="Creadas y cerradas, últimos 14 días">
                <SolicitudesChart serie={serie} />
              </Panel>
            </motion.div>
            <motion.div variants={revealChild} className="min-w-0">
              <Panel
                title={`Sin decisión hace más de ${umbralSinDecision} días`}
                subtitle={envejecidas.length ? `${envejecidas.length} de ${sinDecision} · las más antiguas` : "Ninguna"}
              >
                {envejecidas.length ? (
                  <ul className="divide-y divide-hairline">
                    {envejecidas.map(({ s, dias }) => (
                      <li key={s.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="min-w-0 flex-1">
                          <Link href={`/admin/solicitud/${s.id}`} className="block truncate text-body-md text-ink hover:underline">
                            {s.numeroReferencia ?? s.titulo}
                          </Link>
                          <span className="block truncate text-caption text-body">
                            {s.solicitanteNombre}
                            {s.numeroReferencia ? "" : " · sin referencia"}
                          </span>
                        </span>
                        <span className="mono-label shrink-0 text-critical">{Math.round(dias)} d</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-caption text-body">Ninguna solicitud supera el umbral.</p>
                )}
              </Panel>
            </motion.div>
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_388px]">
            <motion.div variants={revealChild} className="min-w-0">
              <Panel title="Carga por coordinador" subtitle="Solicitudes del rango y coordinador seleccionados">
                {barrasVolumen.length ? (
                  <ul className="flex flex-col gap-4">
                    {barrasVolumen.map((b) => (
                      <li key={b.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-body-md text-ink">{b.label}</span>
                          <span className="mono-label shrink-0 text-ink tabular-nums">{b.value}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-soft">
                          <div className="h-1.5 bg-primary" style={{ width: `${(b.value / maxVolumen) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-caption text-body">Sin datos para el filtro.</p>
                )}
              </Panel>
            </motion.div>
            <motion.div variants={revealChild} className="min-w-0">
              <Panel title="Tiempo por etapa" subtitle="Días promedio en cada estado">
                {etapas.length ? (
                  <dl className="divide-y divide-hairline">
                    {etapas.map(([etapa, d]) => (
                      <div key={etapa} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                        <dt className="text-caption text-ink">{estadoLegible(etapa)}</dt>
                        <dd className="mono-label text-ink tabular-nums">{d == null ? "—" : `${d.toFixed(1)} d`}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-caption text-body">Sin datos.</p>
                )}
              </Panel>
            </motion.div>
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_388px]">
            <motion.div variants={revealChild} className="min-w-0">
              <Panel title="Distribución" subtitle="Por tipo y subtipo de solicitud">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-3 text-body">Tipo</p>
                    {distribucion.length ? (
                      <ul className="flex flex-col gap-3">
                        {distribucion.map(([tipo, v]) => (
                          <li key={tipo}>
                            <div className="mb-1 flex justify-between text-caption">
                              <span className="text-ink">{tipoLegible(tipo)}</span>
                              <span className="text-body tabular-nums">
                                {v} · {Math.round((v / distribucionTotal) * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-soft">
                              <div className="h-1.5 bg-primary" style={{ width: `${(v / distribucionTotal) * 100}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-body">Sin datos.</p>
                    )}
                  </div>
                  <div>
                    <p className="eyebrow mb-3 text-body">Subtipo</p>
                    {distribucionSubtipo.length ? (
                      <ul className="flex flex-col gap-3">
                        {distribucionSubtipo.map(([subtipo, v]) => (
                          <li key={subtipo}>
                            <div className="mb-1 flex justify-between text-caption">
                              <span className="text-ink">{subtipoLegible(subtipo)}</span>
                              <span className="text-body tabular-nums">
                                {v} · {Math.round((v / distribucionSubtipoTotal) * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-soft">
                              <div className="h-1.5 bg-periwinkle" style={{ width: `${(v / distribucionSubtipoTotal) * 100}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-body">Sin datos.</p>
                    )}
                  </div>
                </div>
              </Panel>
            </motion.div>
            <motion.div variants={revealChild} className="min-w-0" id="recordatorios">
              <Panel title="Recordatorios" subtitle="Rondas de preguntas sin responder pasado el umbral">
                <p className="text-caption text-body">
                  Avisa al coordinador asignado. Es independiente de las alertas y manda correos reales.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={previsualizarRecordatorios} disabled={recEstado === "preview" || recEstado === "loading"}>
                    Revisar pendientes
                  </Button>
                  <Button variant="outline" size="sm" onClick={enviarRecordatorios} disabled={recEstado === "loading" || recPendientes === 0}>
                    Enviar recordatorios
                  </Button>
                </div>
                {recMensaje ? (
                  <p
                    role="status"
                    className={cx("rounded-sm px-3 py-2 text-caption", recEstado === "error" ? "text-critical" : "text-success")}
                  >
                    {recMensaje}
                  </p>
                ) : null}
              </Panel>
            </motion.div>
          </Reveal>

          <Panel
            title="Procesos"
            subtitle={
              procesosOrdenados.length === 0
                ? "Sin resultados"
                : `${desde + 1}–${Math.min(desde + POR_PAGINA, procesosOrdenados.length)} de ${procesosOrdenados.length}`
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-56">
                  <SelectField
                    label="Filtrar por coordinador"
                    value={coordinador === "all" ? "Todos" : nombreCoord(coordinador)}
                    onChange={(v) => {
                      const c = v === "Todos" ? undefined : coordinadores.find((x) => x.nombre === v);
                      aplicarCoordinador(c?.id ?? "all");
                    }}
                    options={["Todos", ...coordinadores.map((c) => c.nombre)]}
                  />
                </div>
                {filtrando ? (
                  <button type="button" onClick={limpiarFiltros} className="text-caption font-medium text-body underline underline-offset-4 hover:text-ink">
                    Limpiar
                  </button>
                ) : null}
                <div className="xl:hidden">
                  <Link href={`/admin/procesos`} className="mono-label text-ink underline underline-offset-4">
                    Ver todos
                  </Link>
                </div>
              </div>
            }
          >
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[880px] border-collapse">
                <caption className="sr-only">Solicitudes del sistema. Ordenable por columna.</caption>
                <thead>
                  <tr className="bg-surface-soft text-left">
                    <ThOrden col="referencia" orden={orden} onSort={alternarOrden}>
                      Referencia
                    </ThOrden>
                    <ThOrden col="solicitante" orden={orden} onSort={alternarOrden}>
                      Solicitante
                    </ThOrden>
                    <ThOrden col="coordinador" orden={orden} onSort={alternarOrden}>
                      Coordinador
                    </ThOrden>
                    <ThOrden col="estado" orden={orden} onSort={alternarOrden}>
                      Estado
                    </ThOrden>
                    <ThOrden col="tiempo" orden={orden} onSort={alternarOrden}>
                      Tiempo
                    </ThOrden>
                    <ThOrden col="creacion" orden={orden} onSort={alternarOrden}>
                      Creación
                    </ThOrden>
                    <th className="eyebrow px-3 py-3 text-right font-medium text-ink">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((s) => {
                    const dur = duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre });
                    const retraso = diasDeRetraso(s);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => router.push(`/admin/solicitud/${s.id}`)}
                        className="group/row cursor-pointer border-b border-hairline transition-colors hover:bg-surface-soft/60"
                      >
                        <td className="px-3 py-3">
                          {s.numeroReferencia ? (
                            <span className="mono-label block text-ink">{s.numeroReferencia}</span>
                          ) : (
                            <span className="block text-caption italic text-body" title={`Sin referencia asignada · id interno ${s.id}`}>
                              Sin referencia
                            </span>
                          )}
                          <span className="mt-0.5 block max-w-[160px] truncate text-caption text-body" title={nombreCategoria(s.categoria)}>
                            {nombreCategoria(s.categoria)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="block text-body-md text-ink">{s.solicitanteNombre || "—"}</span>
                          <span className="block text-caption text-body">{s.areaSolicitante ?? "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-body-md text-ink">{nombreCoord(s.coordinadorId ?? "")}</td>
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={tonoEstado(s.estado)}>{estadoLegible(s.estado)}</Badge>
                            {retraso !== null ? (
                              <span className="mono-label text-critical">Retrasada · {retraso} d</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-caption text-ink whitespace-nowrap">{dur.texto}</td>
                        <td className="px-3 py-3 text-caption text-body whitespace-nowrap">
                          {new Date(s.fechaCreacion).toLocaleDateString("es-HN")}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/admin/solicitud/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Ver detalle de ${s.numeroReferencia ?? s.titulo}`}
                            className="inline-grid size-8 max-sm:size-11 place-items-center rounded-xs text-body hover:bg-surface-soft hover:text-ink"
                          >
                            <Icon name="chevron-left" size={16} className="rotate-180 transition-transform group-hover/row:translate-x-1" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {visibles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <p className="text-body-lg font-medium text-ink">Sin resultados</p>
                <p className="text-caption text-body">
                  {filtrando ? "Ningún proceso coincide con los filtros aplicados." : "Todavía no hay solicitudes registradas."}
                </p>
                {filtrando ? (
                  <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </Button>
                ) : null}
              </div>
            ) : null}

            {procesosOrdenados.length > POR_PAGINA ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <span className="text-caption text-body tabular-nums">
                  Página {paginaSegura} de {totalPaginas} · {POR_PAGINA} por página
                </span>
                <div className="flex items-center gap-1.5">
                  <BotonPagina onClick={() => setPagina(1)} disabled={paginaSegura === 1}>
                    Primera
                  </BotonPagina>
                  <BotonPagina onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaSegura === 1}>
                    Anterior
                  </BotonPagina>
                  <BotonPagina onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}>
                    Siguiente
                  </BotonPagina>
                  <BotonPagina onClick={() => setPagina(totalPaginas)} disabled={paginaSegura === totalPaginas}>
                    Última
                  </BotonPagina>
                </div>
              </div>
            ) : null}
          </Panel>
        </>
      )}
    </>
  );
}

const ORDEN_ETAPAS = [
  "BORRADOR",
  "ENVIADA_A_COMPRAS",
  "EN_COTIZACION",
  "COMPARATIVA_LISTA",
  "ENVIADA_A_SOLICITANTE",
  "CERRADA_CON_DECISION",
  "CERRADA_SIN_DECISION",
  "CANCELADA",
];

function diasDeRetraso(s: Solicitud): number | null {
  if (s.fechaCierre || !s.fechaRequerida) return null;
  const req = new Date(`${s.fechaRequerida}T23:59:59`).getTime();
  const hoy = Date.now();
  if (!Number.isFinite(req) || req >= hoy) return null;
  return Math.max(1, Math.round((hoy - req) / 86_400_000));
}

function ThOrden({
  col,
  orden,
  onSort,
  children,
}: {
  col: Orden["col"];
  orden: Orden;
  onSort: (c: Orden["col"]) => void;
  children: React.ReactNode;
}) {
  const activa = orden.col === col;
  return (
    <th
      scope="col"
      aria-sort={activa ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}
      className="eyebrow px-3 py-3 font-medium text-ink"
    >
      <button type="button" onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-ink transition-colors">
        {children}
        <Icon
          name="chevron-down"
          size={12}
          className={cx("transition-transform", activa ? "text-ink" : "text-body/60", activa && orden.dir === "asc" && "rotate-180")}
        />
      </button>
    </th>
  );
}

function BotonPagina({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mono-label rounded-xs px-2.5 py-1.5 max-sm:min-h-11 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

function tipoLegible(t: string): string {
  const m: Record<string, string> = { RFI: "RFI · Información", RFQ: "RFQ · Cotización", RFP: "RFP · Propuesta", SIN_TIPO: "Sin clasificar" };
  return m[t] ?? t;
}

function subtipoLegible(s: string): string {
  const m: Record<string, string> = { producto: "Producto", servicio: "Servicio", mixto: "Mixto", SIN_SUBTIPO: "Sin clasificar" };
  return m[s] ?? s;
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
    BORRADOR: "Borrador",
    ENVIADA_A_COMPRAS: "Activa",
    EN_COTIZACION: "Esperando cotizaciones",
    COMPARATIVA_LISTA: "Comparativa lista",
    ENVIADA_A_SOLICITANTE: "Esperando decisión",
    CERRADA_CON_DECISION: "Cerrada",
    CERRADA_SIN_DECISION: "Cerrada",
    CANCELADA: "Cancelada",
  };
  return m[e] ?? e;
}

/** Mapa de estados → tonos (DESIGN.md §5). */
function tonoEstado(e: string): BadgeTone {
  if (e === "EN_COTIZACION") return "periwinkle";
  if (e === "COMPARATIVA_LISTA" || e === "ENVIADA_A_SOLICITANTE") return "mint";
  if (e === "CERRADA_CON_DECISION") return "success";
  if (e === "CANCELADA") return "critical";
  if (e === "CERRADA_SIN_DECISION") return "neutral";
  return "dark";
}
