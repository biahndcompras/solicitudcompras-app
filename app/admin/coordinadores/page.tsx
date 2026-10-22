import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/primitives";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { CoordinadoresManager } from "./CoordinadoresManager";

export const dynamic = "force-dynamic";

const repo = new PostgresRepositorio();

const ESTADOS_TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);

export default async function AdminCoordinadoresPage() {
  // Se traen también los inactivos: la pantalla de gestión necesita poder reactivarlos.
  const [equipo, solicitudes] = await Promise.all([
    repo.listarEquipo({ incluirInactivos: true }),
    repo.listarTodas(),
  ]);

  // Las tarjetas de rendimiento son del equipo de coordinación; los admins se gestionan
  // igual pero no tienen carga de solicitudes asignadas.
  const coordinadores = equipo.filter((u) => u.rol === "coordinador");
  const activos = coordinadores.filter((c) => c.activo);
  const admins = equipo.filter((u) => u.rol === "admin");
  const adminsActivos = admins.filter((u) => u.activo).length;

  const stats = activos.map((c, i) => {
    const propias = solicitudes.filter((s) => s.coordinadorId === c.id);
    const activosCount = propias.filter((s) => !ESTADOS_TERMINALES.has(s.estado)).length;
    const cerradas = propias.filter((s) => s.fechaCierre);
    const promedio = cerradas.length
      ? cerradas.reduce(
          (acc, s) =>
            acc + (new Date(s.fechaCierre!).getTime() - new Date(s.fechaCreacion).getTime()) / 86400000,
          0
        ) / cerradas.length
      : null;
    return {
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      iniciales: c.nombre
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      tone: (i % 2 === 0 ? "mint" : "periwinkle") as "mint" | "periwinkle",
      activos: activosCount,
      promedio,
    };
  });

  return (
    <>
      <PageHeader
        title="Coordinadores"
        subtitle={`${activos.length} coordinadores activos${
          coordinadores.length > activos.length ? ` · ${coordinadores.length - activos.length} inactivos` : ""
        } · ${adminsActivos} administrador${adminsActivos === 1 ? "" : "es"} activo${adminsActivos === 1 ? "" : "s"}.`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((m) => (
          <article
            key={m.id}
            className="flex min-w-0 flex-col gap-5 rounded-sm bg-canvas p-6 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
          >
            <div className="flex items-center gap-3">
              <Avatar initials={m.iniciales} tone={m.tone} />
              <div className="min-w-0">
                <h2 className="truncate text-body-md font-medium text-ink">{m.nombre}</h2>
                <p className="truncate text-caption text-body">{m.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="eyebrow text-body">Activas</dt>
                <dd className="mt-1.5 text-display-md text-ink tabular-nums">{m.activos}</dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Promedio</dt>
                <dd className="mt-1.5 text-display-md text-ink tabular-nums">
                  {m.promedio === null ? (
                    "—"
                  ) : (
                    <>
                      {m.promedio.toFixed(1)}
                      <span className="ml-1 text-caption font-normal text-body">días</span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <CoordinadoresManager inicial={equipo} />
    </>
  );
}
