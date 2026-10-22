"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { site } from "@/config/site";
import { useSesion } from "@/lib/sesion-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Icon } from "../ui/Icon";
import { Avatar, Logo, cx } from "../ui/primitives";
import type { NavGroup, NavItem } from "./navigation";

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function NavLink({
  item,
  collapsed,
  active,
  onNavigate,
  layoutId,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
  layoutId: string;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cx(
        "group/nav relative flex h-10 max-sm:h-11 items-center gap-3 rounded-sm px-3 transition-colors duration-150",
        active ? "text-on-dark" : "text-on-dark-muted hover:bg-surface-dark-soft/60 hover:text-on-dark",
        collapsed && "justify-center px-0"
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-sm bg-surface-dark-soft shadow-[inset_2px_0_0_var(--color-text-on-dark)]"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon name={item.icon} className="relative shrink-0 transition-transform duration-200 group-hover/nav:scale-110" />
      {!collapsed && <span className="relative flex-1 truncate text-body-md">{item.label}</span>}
      {!collapsed && item.count !== undefined ? (
        <span
          className={cx(
            "mono-label relative shrink-0 rounded-sm px-1.5",
            active ? "bg-mint text-ink" : "bg-surface-dark-soft text-on-dark"
          )}
        >
          {item.count}
        </span>
      ) : null}
      {collapsed && item.count !== undefined ? (
        <span className="absolute top-2 right-2 size-1.5 rounded-full bg-mint" aria-hidden />
      ) : null}
    </Link>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
  nav,
  portal,
  homeHref,
  profileHref,
  profileLabel = "Mi perfil",
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  nav: NavGroup[];
  portal: { label: string; sub: string };
  homeHref: string;
  profileHref: string;
  profileLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const sesion = useSesion();

  // Solo el ítem MÁS específico queda activo: con un simple `startsWith`, /panel/cotizaciones
  // marcaba también /panel y /admin/procesos marcaba /admin.
  const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = hrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  async function salir() {
    setMenu(false);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const body = (isMobile: boolean) => {
    const c = isMobile ? false : collapsed;
    const lid = isMobile ? "nav-active-m" : "nav-active";
    return (
      <div className="on-dark flex h-full flex-col gap-1 overflow-y-auto px-4 py-6">
        <div className={cx("flex items-center", c ? "justify-center" : "justify-between")}>
          <Link href={homeHref} aria-label={`${site.fullName}, inicio`}>
            <Logo onDark compact={c} label={site.name} />
          </Link>
          {!c && (
            <button
              type="button"
              onClick={isMobile ? onMobileClose : () => setCollapsed(true)}
              aria-label={isMobile ? "Cerrar menú" : "Colapsar sidebar"}
              className="grid size-8 max-sm:size-11 place-items-center rounded-sm text-on-dark-muted hover:bg-surface-dark-soft hover:text-on-dark"
            >
              <Icon name={isMobile ? "close" : "sidebar-collapse"} size={18} />
            </button>
          )}
        </div>
        {c && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expandir sidebar"
            className="mx-auto mt-3 grid size-8 max-sm:size-11 rotate-180 place-items-center rounded-sm text-on-dark-muted hover:bg-surface-dark-soft hover:text-on-dark"
          >
            <Icon name="sidebar-collapse" size={18} />
          </button>
        )}
        <div className="h-6 shrink-0" />
        {!c && (
          <div className="mb-5 rounded-sm bg-surface-dark-soft px-3 py-2.5">
            <span className="eyebrow block text-on-dark-muted">Portal</span>
            <span className="mt-1 block text-body-md font-medium text-on-dark">
              {portal.label} · {portal.sub}
            </span>
          </div>
        )}
        <nav aria-label="Navegación principal" className="flex flex-col gap-1">
          {nav.map((g, gi) => (
            <div key={g.label} className={cx("flex flex-col gap-1", gi > 0 && "mt-3")}>
              {!c && <p className="eyebrow px-3 py-2 text-on-dark-muted">{g.label}</p>}
              {g.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={c}
                  active={isActive(item.href)}
                  onNavigate={isMobile ? onMobileClose : undefined}
                  layoutId={lid}
                />
              ))}
            </div>
          ))}
        </nav>
        <div className="min-h-6 flex-1" />
        <NavLink
          item={{ href: profileHref, label: profileLabel, icon: "staff" }}
          collapsed={c}
          active={isActive(profileHref)}
          onNavigate={isMobile ? onMobileClose : undefined}
          layoutId={lid}
        />
        <div className="relative mt-2 border-t border-on-dark-line pt-4">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            className={cx("flex w-full items-center gap-3 rounded-sm py-1 text-left hover:bg-surface-dark-soft/60", c ? "justify-center" : "px-3")}
          >
            <Avatar initials={iniciales(sesion?.nombre ?? "Usuario")} />
            {!c && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-caption font-medium text-on-dark">{sesion?.nombre ?? "Usuario"}</span>
                <span className="block truncate text-caption text-on-dark-muted">
                  {sesion?.rol === "admin" ? "Administración" : "Coordinador"}
                </span>
              </span>
            )}
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="absolute bottom-full left-0 mb-2 w-[216px] rounded-sm bg-canvas p-1 text-ink shadow-[var(--shadow-soft-drop)]"
              >
                <Link
                  href={profileHref}
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 rounded-xs px-3 py-2 text-body-md hover:bg-surface-soft"
                >
                  <Icon name="staff" size={16} /> {profileLabel}
                </Link>
                <button
                  type="button"
                  onClick={salir}
                  className="flex w-full items-center gap-2 rounded-xs px-3 py-2 text-left text-body-md text-critical hover:bg-surface-soft"
                >
                  <Icon name="close" size={16} /> Cerrar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="hidden shrink-0 bg-canvas-dark lg:block">
        <motion.aside
          animate={{ width: collapsed ? 72 : 248 }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          className="sticky top-0 h-dvh overflow-hidden"
        >
          {body(false)}
        </motion.aside>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial="hidden" animate="show" exit="hidden">
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              onClick={onMobileClose}
              className="absolute inset-0 bg-canvas-dark/60"
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-canvas-dark"
              variants={{ hidden: { x: "-100%" }, show: { x: 0 } }}
              transition={{ type: "spring", stiffness: 420, damping: 42 }}
            >
              {body(true)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
