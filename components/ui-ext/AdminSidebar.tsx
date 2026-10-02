"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/design/cn";
import { useSesion } from "@/lib/sesion-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type NavAdminItem = { href: string; label: string; icon: string };

// Etiquetas específicas a propósito (no "Catálogo" genérico): el nombre dice lo
// que hay dentro, para que se pueda predecir sin abrir la página.
export const NAV_ADMIN: NavAdminItem[] = [
  { href: "/admin", label: "Dashboard", icon: "M4 20V10M10 20V4M16 20v-6M22 20H2" },
  { href: "/admin/procesos", label: "Procesos", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" },
  { href: "/admin/coordinadores", label: "Coordinadores", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/campos", label: "Campos", icon: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" },
  { href: "/admin/configuracion", label: "Umbrales y alertas", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.12-1.45l2.1-1.64-2-3.46-2.48 1a7.4 7.4 0 0 0-2.5-1.45L14.2 2h-4l-.2 2.5a7.4 7.4 0 0 0-2.5 1.45l-2.48-1-2 3.46 2.1 1.64A7.4 7.4 0 0 0 4.6 12a7.4 7.4 0 0 0 .12 1.45l-2.1 1.64 2 3.46 2.48-1a7.4 7.4 0 0 0 2.5 1.45L10.2 22h4l.2-2.5a7.4 7.4 0 0 0 2.5-1.45l2.48 1 2-3.46-2.1-1.64A7.4 7.4 0 0 0 19.4 12z" },
  { href: "/admin/ajustes", label: "Mi perfil", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sesion = useSesion();

  async function salir() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    // `min-h-0` + scroller propio: la sidebar queda anclada a la altura del
    // viewport y el nav scrollea si alguna vez no cabe. Antes `flex-1` sin
    // `min-h-0` la estiraba a la altura del documento.
    <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-200 bg-slate-50 min-h-0">
      <div className="flex flex-col h-full min-h-0 w-full py-5 px-3">
        <div className="flex items-center gap-2.5 px-2 mb-6 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-semibold">BIA</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">Admin Panel</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Trazabilidad</div>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5">
          {NAV_ADMIN.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
                  active
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-600 font-medium hover:bg-white hover:text-slate-900"
                )}
              >
                <span className="shrink-0 opacity-90">
                  <Icon d={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 pt-3 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-900">{sesion?.nombre ?? "Admin"}</div>
              <div className="text-[10px] text-slate-500">Administración</div>
            </div>
            <button
              type="button"
              onClick={salir}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
