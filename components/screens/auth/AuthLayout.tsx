"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Ribbon } from "@/components/brand/Ribbon";
import { Logo } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { ease } from "@/lib/design/motion";

const headline = "Cada solicitud, su comparativa y su decisión, en un solo tablero.";

const puntos = [
  ["Solicitudes con contexto", "Especificaciones, respuestas y adjuntos desde el primer día."],
  ["Comparativas comparables", "Los proveedores en columnas, con pros, contras y ahorro."],
  ["Decisión trazada", "El solicitante decide y Compras recibe la notificación."],
];

/**
 * Pantalla de acceso partida, portada de la referencia (DESIGN.md §4.4):
 * banda oscura con el listón a la izquierda y el formulario a la derecha.
 *
 * Sin cifras de demostración: la referencia mostraba métricas inventadas
 * («186 venues»). Acá van tres propuestas de valor, sin datos que no existen.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const words = headline.split(" ");

  return (
    <div className="bia-ds grid min-h-dvh bg-canvas lg:grid-cols-[1fr_620px]">
      <section
        aria-label={site.fullName}
        className="on-dark relative isolate flex min-h-[420px] flex-col overflow-hidden bg-canvas-dark px-6 py-10 sm:px-14 sm:py-12"
      >
        <div className="self-start">
          <Logo onDark label={site.name} />
        </div>

        <motion.div
          className="pointer-events-none absolute inset-x-[-10%] top-[12%] -z-10 h-[62%]"
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.8, ease, delay: 0.2 }}
        >
          <Ribbon className="h-full w-full" />
        </motion.div>

        <div className="flex-1" />

        <div className="max-w-[560px]">
          <motion.p
            className="eyebrow text-on-dark-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Portal de Compras · Equipo
          </motion.p>

          <h1 className="mt-5 text-[30px] leading-[36px] font-medium tracking-[-0.6px] text-on-dark sm:text-display-xl">
            {words.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-1 align-top">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, ease, delay: 0.25 + i * 0.045 }}
                >
                  {w}&nbsp;
                </motion.span>
              </span>
            ))}
          </h1>

          <ul className="mt-6 flex flex-col gap-3">
            {puntos.map(([titulo, texto], i) => (
              <motion.li
                key={titulo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.08, duration: 0.6, ease }}
                className="flex gap-3"
              >
                <span className="mono-label mt-0.5 grid size-6 shrink-0 place-items-center rounded-xs bg-surface-dark-soft text-on-dark">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-caption font-medium text-on-dark">{titulo}</span>
                  <span className="block text-caption text-on-dark-muted">{texto}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-14">
        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
        >
          {children}
        </motion.div>
        <p className="mono-caption absolute bottom-6 left-6 text-body sm:left-14">
          {site.fullName} · v1.0
        </p>
      </section>
    </div>
  );
}
