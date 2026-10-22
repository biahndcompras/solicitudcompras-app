import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/primitives";
import { site } from "@/config/site";

/**
 * Shell de las pantallas del solicitante (sin sesión): no hay sidebar ni menú de
 * usuario. Solo marca, dos enlaces de consulta y el contenido.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="bia-ds min-h-dvh bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" aria-label={site.fullName} className="inline-flex items-center">
            <Logo label={site.name} />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/mis-solicitudes"
              className="mono-label rounded-sm px-3 py-2 text-ink transition-colors hover:bg-surface-soft"
            >
              Mis solicitudes
            </Link>
            <Link
              href="/guias/manual-solicitante"
              className="mono-label rounded-sm px-3 py-2 text-body transition-colors hover:bg-surface-soft"
            >
              Guía
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-8">{children}</main>

      <footer className="mx-auto w-full max-w-[1120px] px-4 pb-8 sm:px-8">
        <p className="mono-caption text-body">{site.fullName} · v1.0</p>
      </footer>
    </div>
  );
}
