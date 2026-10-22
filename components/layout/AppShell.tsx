"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Providers } from "../providers/Providers";
import { Sidebar } from "./Sidebar";
import type { NavGroup } from "./navigation";

const ShellCtx = createContext<{ openMenu: () => void }>({ openMenu: () => {} });
export const useShell = () => useContext(ShellCtx);

/**
 * Shell del sistema nuevo (DESIGN.md §4.1): sidebar + página animada.
 *
 * La navegación es un prop: el admin usa su menú de gestión y el coordinador
 * usa las etapas del flujo con contadores (DESIGN.md §16).
 */
export function AppShell({
  children,
  nav,
  portal,
  homeHref,
  profileHref,
  profileLabel,
}: {
  children: ReactNode;
  nav: NavGroup[];
  portal: { label: string; sub: string };
  homeHref: string;
  profileHref: string;
  profileLabel?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ShellCtx.Provider value={{ openMenu: () => setMenuOpen(true) }}>
      <Providers>
        <div className="bia-ds flex min-h-dvh bg-canvas">
          <Sidebar
            mobileOpen={menuOpen}
            onMobileClose={() => setMenuOpen(false)}
            nav={nav}
            portal={portal}
            homeHref={homeHref}
            profileHref={profileHref}
            profileLabel={profileLabel}
          />
          <main className="relative min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-6"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </Providers>
    </ShellCtx.Provider>
  );
}
