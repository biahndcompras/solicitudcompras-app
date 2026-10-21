import { AdminShell } from "@/components/ui-ext/AdminShell";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { CoordinadoresManager } from "./CoordinadoresManager";

export const dynamic = "force-dynamic";

const repo = new PostgresRepositorio();

const ESTADOS_TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);
const COLORES_AVATAR = [
  "bg-sky-100 border-sky-200 text-sky-700",
  "bg-emerald-100 border-emerald-200 text-emerald-700",
  "bg-purple-100 border-purple-200 text-purple-700",
  "bg-amber-100 border-amber-200 text-amber-700",
  "bg-rose-100 border-rose-200 text-rose-700",
];
const DOTS = ["bg-emerald-400", "bg-sky-400", "bg-amber-400"];

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
      iniciales: c.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
      color: COLORES_AVATAR[i % COLORES_AVATAR.length],
      dot: DOTS[i % DOTS.length],
      activos: activosCount,
      promedio,
    };
  });

  return (
    <AdminShell title="Equipo de Coordinadores" subtitle="Rendimiento, carga de trabajo y asignación del equipo.">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-[11px] text-slate-500">
          {activos.length} coordinadores activos
          {coordinadores.length > activos.length ? ` · ${coordinadores.length - activos.length} inactivos` : ""}
          {` · ${adminsActivos} administrador${adminsActivos === 1 ? "" : "es"} activo${adminsActivos === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((m) => (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className={"w-2.5 h-2.5 rounded-full block shadow-[0_0_8px_rgba(52,211,153,0.8)] " + m.dot}></span>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <div className={"w-14 h-14 rounded-full flex items-center justify-center border text-lg font-semibold " + m.color}>{m.iniciales}</div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{m.nombre}</h3>
                <p className="text-[11px] text-slate-500 font-medium">{m.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 font-medium mb-0.5">Activos</div>
                <div className="text-lg font-semibold text-slate-900 tracking-tight">{m.activos}</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 font-medium mb-0.5">Promedio</div>
                <div className="text-lg font-semibold text-slate-900 tracking-tight">
                  {m.promedio === null ? "—" : m.promedio.toFixed(1)} <span className="text-[10px] text-slate-400 ml-1 font-medium">días</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CoordinadoresManager inicial={equipo} />
    </AdminShell>
  );
}

