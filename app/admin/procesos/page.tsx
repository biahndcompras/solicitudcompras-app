import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/primitives";
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
    <>
      <PageHeader
        title="Procesos"
        subtitle={`${activas.length} solicitudes activas, agrupadas por tipo.`}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((col) => {
          const items = activas
            .filter((s) => (s.tipo ?? "SIN_TIPO") === col.tipo)
            .sort((a, b) => (a.fechaCreacion < b.fechaCreacion ? 1 : -1));
          return (
            <section key={col.tipo} aria-label={col.titulo} className="flex min-w-0 flex-col gap-3">
              <header className="flex items-center justify-between gap-3">
                <h2 className="text-display-md text-ink">{col.titulo}</h2>
                <Badge tone="neutral">{items.length}</Badge>
              </header>
              <div className="flex flex-col gap-2">
                {items.length ? (
                  items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/admin/solicitud/${s.id}`}
                      className="group/card block rounded-sm bg-canvas p-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-shadow hover:shadow-[inset_0_0_0_1px_#000]"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3">
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
                        <span className="mono-caption shrink-0 text-body">{haceCuanto(s.fechaCreacion)}</span>
                      </div>
                      <p className="line-clamp-2 text-body-md text-ink">{s.titulo}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-body">
                        <span>{s.solicitanteNombre ?? "Anónimo"}</span>
                        <span aria-hidden>·</span>
                        <span>{estadoLegible(s.estado)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="rounded-sm bg-surface-soft px-4 py-6 text-center text-caption text-body">
                    Sin procesos activos
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
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
