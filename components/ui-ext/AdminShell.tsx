"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar, NAV_ADMIN } from "./AdminSidebar";
import { useSesion } from "@/lib/sesion-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/design/cn";

type AdminShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/**
 * Shell del admin.
 *
 * Altura: el contenedor externo está CAPADO a la altura del viewport (`h-dvh`) y
 * el scroller interno es el único que hace scroll. Antes era `min-h-screen` +
 * `flex-1` en el nav, así que la section crecía hasta la altura del contenido y
 * el `<aside>` (flex sibling con align-items:stretch) se estiraba con ella: la
 * sidebar medía la altura del documento (medido: 8.4x–20.2x el viewport) y el
 * `overflow-y-auto` interno nunca llegaba a scrollear. Además el bloque de
 * usuario/logout quedaba miles de píxeles bajo el pliegue.
 */
export function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const sesion = useSesion();
  const pathname = usePathname();

  return (
    <main className="h-dvh flex flex-col overflow-hidden bg-slate-50">
      {/* Navegación en <768px: la sidebar de escritorio se oculta y sin esto el
          admin se quedaba sin ninguna salida de navegación. */}
      <MobileAdminNav pathname={pathname} />

      <div className="flex-1 min-h-0 flex">
        <AdminSidebar />

        <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
          <header className="shrink-0 border-b border-slate-200 bg-white">
            <div className="px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900 truncate">
                  {title}
                </h1>
                <p className="text-xs md:text-[13px] text-slate-500 mt-1">{subtitle}</p>
              </div>
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-800">{sesion?.nombre ?? "Admin"}</span>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-8 py-4 md:py-6">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function MobileAdminNav({ pathname }: { pathname: string }) {
  const router = useRouter();

  async function salir() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="md:hidden shrink-0 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 h-14">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-semibold">BIA</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">Admin</span>
        <button
          type="button"
          onClick={salir}
          aria-label="Cerrar sesión"
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
          Salir
        </button>
      </div>
      <nav aria-label="Navegación de administración" className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pb-2.5">
        {NAV_ADMIN.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 rounded-lg text-[13px] whitespace-nowrap transition-colors",
                active ? "bg-slate-900 text-white font-semibold" : "text-slate-600 font-medium hover:bg-slate-100"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
