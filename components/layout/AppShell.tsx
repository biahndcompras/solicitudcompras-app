"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Providers } from "../providers/Providers";
import { Sidebar } from "./Sidebar";

const ShellCtx = createContext<{ openMenu: () => void }>({ openMenu: () => {} });
export const useShell = () => useContext(ShellCtx);

/**
 * Shell del sistema nuevo (DESIGN.md §4.1): sidebar + página animada.
 *
 * El scope `.bia-ds` hace que los tokens de la referencia (radios, fuentes,
 * success) apliquen solo acá; el shell viejo sigue con su tema hasta migrar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ShellCtx.Provider value={{ openMenu: () => setMenuOpen(true) }}>
      <Providers>
        <div className="bia-ds flex min-h-dvh bg-canvas">
          <Sidebar mobileOpen={menuOpen} onMobileClose={() => setMenuOpen(false)} />
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
