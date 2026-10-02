"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { duracionAtencion } from "@/lib/domain/semaforo";
import { api } from "@/lib/api-client";
import type { MetricasDashboard } from "@/lib/domain/metrics";
import type { Solicitud } from "@/lib/domain/types";
import { nombreCategoria } from "@/lib/domain/categorias";
import { cn } from "@/lib/design/cn";

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
};

export default function AdminDashboardPage() {
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
  const [alertasInfo, setAlertasInfo] = useState<string | null>(null);
  const [alertasEstado, setAlertasEstado] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const desdem = rango === "all" ? undefined : rango === "hoy" ? "dia" : rango;

  // Los datos se piden desde un efecto (sincronizar con la red), pero el estado
  // de carga / error / página se actualiza en los handlers que disparan la
  // petición, no dentro del efecto: setState síncrono en un efecto provoca
  // renders en cascada (react-hooks/set-state-in-effect).
  useEffect(() => {
    let vivo = true;
    api
      .metricas({
        rango: desdem,
        coordinador: coordinador === "all" ? undefined : coordinador,
      })
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

  // Cada cambio de filtro vuelve a la primera página: si no, al aterrizar en la
  // página 4 con un filtro nuevo se ve una tabla vacía y parece que no hay datos.
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
  function aplicarBusqueda(q: string) {
    setBusqueda(q);
    setPagina(1);
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

  const barrasVolumen = Object.entries(metricas.volumenPorCoordinador).map(([id, v]) => ({ id, label: nombreCoord(id), value: v }));
  const maxVolumen = Math.max(1, ...barrasVolumen.map((b) => b.value));

  const distribucion = Object.entries(metricas.distribucionPorTipo);
  const distribucionTotal = Math.max(1, distribucion.reduce((a, [, v]) => a + v, 0));

  function ejecutarAlertas() {
    setAlertasEstado("loading");
    setAlertasInfo(null);
    fetch("/api/admin/alertas/ejecutar", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setAlertasInfo(d.alertas?.length ? `${d.alertas.length} alerta${d.alertas.length === 1 ? "" : "s"} enviada${d.alertas.length === 1 ? "" : "s"}` : "Sin alertas que enviar");
        setAlertasEstado("ok");
      })
      .catch(() => {
        setAlertasInfo("No se pudieron ejecutar las alertas");
        setAlertasEstado("error");
      });
  }

  const exportUrl = `/api/metricas/excel?rango=${rango === "all" ? "todo" : rango === "hoy" ? "dia" : rango}${coordinador !== "all" ? `&coordinador=${coordinador}` : ""}`;

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

  // Orden: el servidor entrega por fecha desc, así que el orden inicial solo
  // necesita ser explícito para que cambiar de columna sea predecible.
  const procesosOrdenados = useMemo(() => {
    const col = orden.col;
    const signo = orden.dir === "asc" ? 1 : -1;
    const copia = [...procesosFiltrados];
    copia.sort((a, b) => {
      switch (col) {
        case "referencia":
          return signo * (a.numeroReferencia ?? "").localeCompare(b.numeroReferencia ?? "", "es");
        case "solicitante":
          return signo * (a.solicitanteNombre ?? "").localeCompare(b.solicitanteNombre ?? "", "es");
        case "coordinador":
          return signo * nombreCoord(a.coordinadorId ?? "").localeCompare(nombreCoord(b.coordinadorId ?? ""), "es");
        case "estado":
          return signo * a.estado.localeCompare(b.estado, "es");
        case "tiempo":
          return signo * (duracionAtencion({ fechaCreacion: a.fechaCreacion, fechaCierre: a.fechaCierre }).dias ?? 0) -
            (duracionAtencion({ fechaCreacion: b.fechaCreacion, fechaCierre: b.fechaCierre }).dias ?? 0);
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

  return (
    <AdminShell title="Panel de Trazabilidad" subtitle="Control y métricas del ciclo de compras, rendimiento y estado de procesos.">
      {cargando ? (
        <div className="text-[13px] text-slate-500">Calculando métricas…</div>
      ) : (
        <>
          {/* Los KPIs responden a rango y coordinador, NO a la búsqueda de la tabla.
              Se declara explícitamente para que el número no se lea como filtrado. */}
          {filtrando && (
            <div className="mb-4 text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              KPIs y gráficas:{" "}
              <span className="font-semibold">
                {rango !== "all" ? `rango ${rango === "hoy" ? "hoy" : rango === "semana" ? "esta semana" : "este mes"}` : "todo el histórico"}
                {coordinador !== "all" ? ` · ${nombreCoord(coordinador)}` : ""}
              </span>
              {busqueda.trim() !== "" && (
                <>
                  {" "}
                  — no incluyen la búsqueda de la tabla.
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Conversión (Aceptación)"
              value={errorMetricas ? "—" : metricas.tasaConversion === null ? "—" : `${metricas.tasaConversion.toFixed(0)}%`}
              tone="emerald"
              error={errorMetricas}
            />
            <StatCard
              label="Tiempo Promedio"
              value={errorMetricas ? "—" : metricas.tiempoCicloPromedioDias === null ? "—" : metricas.tiempoCicloPromedioDias.toFixed(1)}
              unit="días"
              hint="envío → cierre"
              error={errorMetricas}
            />
            <StatCard label="Procesos Activos" value={errorMetricas ? "—" : String(metricas.solicitudesActivas)} sub="en curso" tone="sky" />
            <StatCard label="Sin decisión > 5 días" value={errorMetricas ? "—" : String(metricas.solicitudesSinDecision)} sub="alertas" tone="rose" danger />
          </div>

          {errorMetricas && (
            <div className="mb-4 text-[13px] px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
              No se pudieron calcular las métricas. Los valores puede que no estén disponibles.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col">
              <div className="text-[12px] font-semibold text-slate-700 mb-3">Volumen por Coordinador</div>
              <div className="flex-1 flex items-end gap-4 h-48 pt-1">
                {barrasVolumen.length ? (
                  barrasVolumen.map((b) => (
                    <div key={b.id} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                      <span className="text-[11px] font-semibold text-slate-700 mb-1 tabular-nums">{b.value}</span>
                      <div
                        className="w-full max-w-[72px] rounded-t bg-sky-500 shrink-0"
                        style={{ height: `${Math.max(2, (b.value / maxVolumen) * 76)}%` }}
                        title={`${b.label}: ${b.value}`}
                      />
                      {/* h-8 fijo: sin reserva de altura la etiqueta se recorta
                          contra el borde inferior del panel. */}
                      <div className="mt-1.5 h-8 w-full flex items-start justify-center shrink-0">
                        <span className="text-[11px] text-slate-500 leading-tight text-center line-clamp-2" title={b.label}>
                          {b.label}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-400 self-center">Sin datos</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col">
              <div className="text-[12px] font-semibold text-slate-700 mb-3">Distribución por Tipo</div>
              <div className="flex-1 flex flex-col justify-center gap-3">
                {distribucion.length ? (
                  distribucion.map(([tipo, v]) => (
                    <div key={tipo}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span>{tipoLegible(tipo)}</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {v} · {Math.round((v / distribucionTotal) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            tipo === "RFQ" ? "bg-emerald-500" : tipo === "RFI" ? "bg-sky-500" : tipo === "RFP" ? "bg-indigo-500" : "bg-slate-400"
                          )}
                          style={{ width: `${(v / distribucionTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-400 self-center">Sin datos</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div
              role="group"
              aria-label="Filtrar por rango de fecha"
              className="inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5"
            >
              {(
                [
                  ["all", "Todo"],
                  ["hoy", "Hoy"],
                  ["semana", "Esta semana"],
                  ["mes", "Este mes"],
                ] as [Rango, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={rango === k}
                  onClick={() => aplicarRango(k)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    rango === k ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="filtro-coordinador">
              Filtrar por coordinador
            </label>
            <select
              id="filtro-coordinador"
              value={coordinador}
              onChange={(e) => aplicarCoordinador(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Todos los coordinadores</option>
              {coordinadores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <a
              href={exportUrl}
              className="text-[12px] font-semibold text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
              title="Exporta el rango y coordinador seleccionados (no la búsqueda de la tabla)"
            >
              Exportar
            </a>

            <button
              type="button"
              onClick={ejecutarAlertas}
              disabled={alertasEstado === "loading"}
              className="text-[12px] font-semibold text-rose-700 hover:text-rose-800 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
            >
              {alertasEstado === "loading" ? "Enviando…" : alertasInfo ?? "Ejecutar alertas"}
            </button>

            {alertasEstado === "error" && <span className="text-[12px] text-rose-700">Error al enviar</span>}
          </div>

          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-slate-700">
                Tabla de Procesos
                <span className="font-normal text-slate-500 ml-2 tabular-nums">
                  {procesosOrdenados.length === 0
                    ? "sin resultados"
                    : `${desde + 1}–${Math.min(desde + POR_PAGINA, procesosOrdenados.length)} de ${procesosOrdenados.length}`}
                </span>
              </div>
              <div className="relative">
                <label className="sr-only" htmlFor="buscar-solicitud">
                  Buscar solicitud
                </label>
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  id="buscar-solicitud"
                  value={busqueda}
                  onChange={(e) => aplicarBusqueda(e.target.value)}
                  placeholder="Buscar por referencia, solicitante o área…"
                  className="w-full sm:w-72 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Solicitudes del sistema. Ordenable por columna.</caption>
                <thead className="bg-slate-50">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <ThOrden col="referencia" orden={orden} onSort={alternarOrden} className="w-[130px]">
                      Referencia
                    </ThOrden>
                    <ThOrden col="solicitante" orden={orden} onSort={alternarOrden}>
                      Solicitante
                    </ThOrden>
                    <ThOrden col="coordinador" orden={orden} onSort={alternarOrden} className="w-[150px]">
                      Coordinador
                    </ThOrden>
                    <ThOrden col="estado" orden={orden} onSort={alternarOrden} className="w-[250px]">
                      Estado
                    </ThOrden>
                    <ThOrden col="tiempo" orden={orden} onSort={alternarOrden} className="w-[110px]">
                      Tiempo
                    </ThOrden>
                    <ThOrden col="creacion" orden={orden} onSort={alternarOrden} className="w-[120px]">
                      Creación
                    </ThOrden>
                    <th className="px-4 py-2.5 font-semibold text-right w-[110px]">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px]">
                  {visibles.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-mono font-semibold text-slate-900">{s.numeroReferencia ?? "—"}</div>
                        {/* truncate: sin esto la categoría envuelve a 2 líneas y la fila
                            pasa de 56px a 74px. El texto completo queda en el title. */}
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[150px]" title={nombreCategoria(s.categoria)}>
                          {nombreCategoria(s.categoria)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{s.solicitanteNombre || "—"}</div>
                        <div className="text-[11px] text-slate-500">{s.areaSolicitante ?? "—"}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-700">{nombreCoord(s.coordinadorId ?? "")}</div>
                      </td>
                      {/* whitespace-nowrap: sin esto el texto del SemParoBadge envuelve
                          dentro de la celda y la fila pasa de ~56px a 74px. */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-nowrap">
                          <Badge tone={toneDe(s.estado)} label={estadoLegible(s.estado)} />
                          <SemParoBadge solicitud={s} compact />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {new Date(s.fechaCreacion).toLocaleDateString("es-HN")}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/solicitud/${s.id}`}
                          className="text-sky-700 hover:text-sky-900 font-semibold px-2.5 py-2 inline-block rounded-md hover:bg-sky-50 transition-colors whitespace-nowrap"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {visibles.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-[13px] font-semibold text-slate-700">Sin resultados</p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    {filtrando
                      ? "Ningún proceso coincide con los filtros aplicados."
                      : "Todavía no hay solicitudes registradas."}
                  </p>
                  {filtrando && (
                    <button
                      type="button"
                      onClick={limpiarFiltros}
                      className="mt-3 text-[12px] font-semibold text-sky-700 hover:text-sky-900"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {procesosOrdenados.length > POR_PAGINA && (
              <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12px] text-slate-500 tabular-nums">
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
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}

function ThOrden({
  col,
  orden,
  onSort,
  children,
  className,
}: {
  col: Orden["col"];
  orden: Orden;
  onSort: (c: Orden["col"]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const activa = orden.col === col;
  return (
    <th
      scope="col"
      aria-sort={activa ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-2.5 font-semibold", className)}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
      >
        {children}
        <span aria-hidden="true" className={cn("text-[9px]", activa ? "text-slate-700" : "text-slate-300")}>
          {activa ? (orden.dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
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
      className="px-2.5 py-1.5 text-[12px] font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
  hint,
  tone,
  danger,
  error,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  hint?: string;
  tone?: "emerald" | "sky" | "rose";
  danger?: boolean;
  error?: boolean;
}) {
  const valColor = error ? "text-slate-400" : tone === "emerald" ? "text-emerald-600" : tone === "sky" ? "text-sky-700" : tone === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1", danger && "text-rose-600")}>{label}</div>
      <div className="flex items-baseline justify-between gap-2">
        <div className={cn("text-2xl font-semibold tabular-nums", valColor)}>
          {value}
          {unit && !error ? <span className="text-sm text-slate-500 font-medium ml-1">{unit}</span> : null}
        </div>
        {hint ? <span className="text-[11px] text-slate-400 text-right">{hint}</span> : sub ? <span className="text-[11px] text-slate-500">{sub}</span> : null}
      </div>
    </div>
  );
}

function tipoLegible(t: string): string {
  const m: Record<string, string> = { RFI: "RFI · Información", RFQ: "RFQ · Cotización", RFP: "RFP · Propuesta", SIN_TIPO: "Sin clasificar" };
  return m[t] ?? t;
}

function estadoLegible(e: string): string {
  const m: Record<string, string> = {
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

function toneDe(e: string): BadgeTone {
  if (e === "EN_COTIZACION" || e === "COMPARATIVA_LISTA") return "cotizaciones";
  if (e === "ENVIADA_A_SOLICITANTE") return "decision";
  if (e === "CERRADA_CON_DECISION") return "cerrada";
  if (e === "CERRADA_SIN_DECISION" || e === "CANCELADA") return "error";
  return "activa";
}
