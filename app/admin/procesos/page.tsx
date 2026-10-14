import Link from "next/link";
import { AdminShell } from "@/components/ui-ext/AdminShell";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

export const dynamic = "force-dynamic";

const repo = new PostgresRepositorio();

const ESTADOS_TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);

const COLUMNAS: { tipo: string; titulo: string }[] = [
  { tipo: "RFQ", titulo: "Cotización (RFQ)" },
  { tipo: "RFI", titulo: "Información (RFI)" },
  { tipo: "RFP", titulo: "Propuesta (RFP)" },
  { tipo: "SIN_TIPO", titulo: "Sin clasificar" },
];

function haceCuanto(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} d`;
}

export default async function AdminProcesosPage() {
  const todas = await repo.listarTodas();
  const activas = todas.filter((s) => !ESTADOS_TERMINALES.has(s.estado));

  return (
    <AdminShell title="Procesos de Compras" subtitle="Estado de todas las solicitudes activas, agrupadas por tipo de proceso.">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {COLUMNAS.map((col) => {
          const items = activas
            .filter((s) => (s.tipo ?? "SIN_TIPO") === col.tipo)
            .sort((a, b) => (a.fechaCreacion < b.fechaCreacion ? 1 : -1));
          return (
            <div key={col.tipo}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">{col.titulo}</h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg px-2 py-0.5">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.length ? items.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/solicitud/${s.id}`}
                    className="block bg-white border border-slate-200/70 rounded-xl p-4 shadow-sm hover:border-sky-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      {/* 4.1.1: sin numero_referencia no se inventa `SOL-<id>`; se dice
                          «Sin referencia» igual que el panel del coordinador. */}
                      {s.numeroReferencia ? (
                        <span className="font-mono text-[11px] font-semibold text-slate-700">{s.numeroReferencia}</span>
                      ) : (
                        <span className="text-[11px] italic text-slate-500" title={`Sin referencia asignada · id interno ${s.id}`}>
                          Sin referencia
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">{haceCuanto(s.fechaCreacion)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-900 line-clamp-2">{s.titulo}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{s.solicitanteNombre ?? "Anónimo"}</span>
                      <span>·</span>
                      <span>{estadoLegible(s.estado)}</span>
                    </div>
                  </Link>
                )) : (
                  <p className="text-[11px] text-slate-400 bg-white/60 border border-dashed border-slate-200 rounded-xl p-4 text-center">Sin procesos activos</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
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
