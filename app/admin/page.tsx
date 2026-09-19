"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import { Badge, type BadgeTone } from "@/components/Badge";
import { SemParoBadge } from "@/components/Semaforo";
import { duracionAtencion } from "@/lib/domain/semaforo";
import { api } from "@/lib/api-client";
import type { MetricasDashboard } from "@/lib/domain/metrics";
import type { Solicitud } from "@/lib/domain/types";
import { nombreCategoria } from "@/lib/domain/categorias";

type Rango = "all" | "hoy" | "semana" | "mes";

type CoordinadorLite = { id: string; nombre: string; email: string };

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
  const [procesos, setProcesos] = useState<Solicitud[]>([]);
  const [minIso, setMinIso] = useState<string | null>(null);

  const desdem = rango === "all" ? undefined : rango === "hoy" ? "dia" : rango;

  useEffect(() => {
    api
      .metricas({
        rango: desdem,
        coordinador: coordinador === "all" ? undefined : coordinador,
      })
      .then((m) => setMetricas(m))
      .catch(() => setMetricas(METRICAS_VACIAS))
      .finally(() => setCargando(false));
    api.listarSolicitudesTodas()
      .then(setProcesos)
      .catch(() => setProcesos([]))
      .finally(() => {
        const atras = rango === "hoy" ? 1 : rango === "semana" ? 7 : rango === "mes" ? 30 : -1;
        setMinIso(atras > 0 ? new Date(Date.now() - atras * 86400000).toISOString() : null);
      });
    fetch("/api/admin/coordinadores")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCoordinadores)
      .catch(() => setCoordinadores([]));
  }, [rango, coordinador, desdem]);

  const nombreCoord = (id: string) =>
    coordinadores.find((c) => c.id === id)?.nombre ?? "Sin asignar";

  const barrasVolumen = Object.entries(metricas.volumenPorCoordinador).map(([id, v]) => ({ id, label: nombreCoord(id), value: v }));
  const maxVolumen = Math.max(1, ...barrasVolumen.map((b) => b.value));

  const distribucion = Object.entries(metricas.distribucionPorTipo);
  const distribucionTotal = Math.max(1, distribucion.reduce((a, [, v]) => a + v, 0));

  const [alertasInfo, setAlertasInfo] = useState<string | null>(null);
  function ejecutarAlertas() {
    fetch("/api/admin/alertas/ejecutar", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setAlertasInfo(d.alertas ? `alertas: ${d.alertas.length}` : "sin alertas"))
      .catch(() => setAlertasInfo("error"));
  }
  const exportUrl = `/api/metricas/excel?rango=${rango === "all" ? "todo" : rango === "hoy" ? "dia" : rango}${coordinador !== "all" ? `&coordinador=${coordinador}` : ""}`;

  const procesosFiltrados = procesos.filter((s) => {
    if (rango !== "all" && minIso && s.fechaCreacion < minIso) return false;
    if (coordinador !== "all" && s.coordinadorId !== coordinador) return false;
    if (busqueda.trim() === "") return true;
    const q = busqueda.toLowerCase();
    return [s.numeroReferencia, s.solicitanteNombre, s.titulo].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  return (
    <AdminShell title="Panel de Trazabilidad" subtitle="Control y métricas del ciclo de compras, rendimiento y estado de procesos.">
      {cargando ? (
        <div className="text-xs text-slate-500">Calculando métricas…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Conversión (Aceptación)" value={metricas.tasaConversion === null ? "—" : `${metricas.tasaConversion.toFixed(0)}%`} tone="emerald" />
            <StatCard label="Tiempo Promedio" value={metricas.tiempoCicloPromedioDias === null ? "—" : metricas.tiempoCicloPromedioDias.toFixed(1)} unit="días" />
            <StatCard label="Procesos Activos" value={String(metricas.solicitudesActivas)} sub="en curso" tone="sky" />
            <StatCard label="Sin decisión > 5 días" value={String(metricas.solicitudesSinDecision)} sub="alertas" tone="rose" danger />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm h-64 flex flex-col">
              <div className="text-xs font-semibold text-slate-700 mb-4">Volumen por Coordinador</div>
              <div className="flex-1 flex items-end gap-6 px-4 pb-2">
                {barrasVolumen.length ? barrasVolumen.map((b, i) => (
                  <div key={b.id} className="flex-1 bg-slate-50 rounded-t-lg relative flex items-end justify-center h-full">
                    <div className={"w-full rounded-t-lg transition-all " + (i % 2 === 1 ? "bg-sky-400 shadow-[0_-2px_10px_rgba(56,189,248,0.2)]" : "bg-sky-200")} style={{ height: `${(b.value / maxVolumen) * 100}%` }} />
                    <span className="absolute -bottom-6 text-[10px] text-slate-500 whitespace-nowrap">{b.label}</span>
                  </div>
                )) : <p className="text-[11px] text-slate-400 self-center">Sin datos</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm h-64 flex flex-col">
              <div className="text-xs font-semibold text-slate-700 mb-4">Distribución por Tipo</div>
              <div className="flex-1 flex flex-col justify-center gap-4">
                {distribucion.length ? distribucion.map(([tipo, v]) => (
                  <div key={tipo}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>{tipoLegible(tipo)}</span>
                      <span className="font-semibold text-slate-900">{Math.round((v / distribucionTotal) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100">
                      <div className={"h-2 rounded-full " + (tipo === "RFQ" ? "bg-emerald-400" : tipo === "RFI" ? "bg-sky-400" : tipo === "RFP" ? "bg-indigo-400" : "bg-slate-300")} style={{ width: `${(v / distribucionTotal) * 100}%` }} />
                    </div>
                  </div>
                )) : <p className="text-[11px] text-slate-400 self-center">Sin datos</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-1.5 bg-white/60 border border-white shadow-sm rounded-2xl p-1.5">
              {([["all", "Todo"], ["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"]] as [Rango, string][]).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setRango(k)} className={"px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-colors " + (rango === k ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20" : "text-slate-700 hover:bg-white/70")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select value={coordinador} onChange={(e) => setCoordinador(e.target.value)} className="bg-white/70 border border-white rounded-xl px-4 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-sm">
                <option value="all">Todos los coordinadores</option>
                {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <a href={exportUrl} className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1.5 bg-white/70 px-4 py-2 rounded-xl border border-white shadow-sm">Exportar</a>
              <button type="button" onClick={ejecutarAlertas} className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1.5 bg-white/70 px-4 py-2 rounded-xl border border-white shadow-sm">
                {alertasInfo ?? "Ejecutar alertas"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs font-semibold text-slate-700">Tabla de Procesos</div>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar solicitud..." className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50/70">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-semibold">Referencia</th>
                    <th className="px-5 py-3 font-semibold">Solicitante</th>
                    <th className="px-5 py-3 font-semibold">Coordinador</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Tiempo</th>
                    <th className="px-5 py-3 font-semibold">Creación</th>
                    <th className="px-5 py-3 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {procesosFiltrados.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono font-semibold text-slate-900">{s.numeroReferencia ?? "—"}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{nombreCategoria(s.categoria)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{s.solicitanteNombre}</div>
                        <div className="text-[10px] text-slate-500">{s.areaSolicitante ?? "—"}</div>
                      </td>
                      <td className="px-5 py-4"><div className="font-medium text-slate-700">{nombreCoord(s.coordinadorId ?? "")}</div></td>
                      <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={toneDe(s.estado)} label={estadoLegible(s.estado)} /><SemParoBadge solicitud={s} compact /></div></td>
                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap">{duracionAtencion({ fechaCreacion: s.fechaCreacion, fechaCierre: s.fechaCierre }).texto}</td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{new Date(s.fechaCreacion).toLocaleDateString("es-HN")}</td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/admin/solicitud/${s.id}`} className="text-sky-600 hover:text-sky-800 font-semibold px-3 py-1.5 bg-sky-50 rounded-lg transition-colors whitespace-nowrap">Ver Detalle</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function StatCard({ label, value, unit, trend, sub, tone, danger }: { label: string; value: string; unit?: string; trend?: string; sub?: string; tone?: "emerald" | "slate" | "sky" | "rose"; danger?: boolean }) {
  const valColor = tone === "emerald" ? "text-emerald-600" : tone === "sky" ? "text-sky-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm relative overflow-hidden">
      {tone === "emerald" ? <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100 rounded-full opacity-50" /> : null}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 relative z-10 flex items-center gap-1">
        {danger ? <span className="text-rose-500">{label}</span> : label}
      </div>
      <div className="flex items-end justify-between relative z-10">
        <div className={"text-3xl font-semibold tracking-tight " + valColor}>
          {value}
          {unit ? <span className="text-lg text-slate-400 font-medium ml-1">{unit}</span> : null}
        </div>
        {trend ? <div className={"text-[11px] font-medium flex items-center gap-0.5 " + (tone === "emerald" ? "text-emerald-600" : "text-emerald-600")}>{trend}</div> : sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function tipoLegible(t: string): string {
  const m: Record<string, string> = { RFI: "RFI · Información", RFQ: "RFQ · Cotización", RFP: "RFP · Propuesta", SIN_TIPO: "Sin clasificar" };
  return m[t] ?? t;
}

function estadoLegible(e: string): string {  const m: Record<string, string> = {
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