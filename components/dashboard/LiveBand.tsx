"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CountUp, ease } from "@/lib/design/motion";
import { Ribbon } from "../brand/Ribbon";

export type LiveStat = {
  label: string;
  value: number;
  format: (n: number) => string;
  sub: string;
};

/**
 * Banda «pulso» del dashboard (DESIGN.md §1/§6.5).
 *
 * Adaptación: sin reloj demo de la referencia; muestra la hora real (se completa en
 * un efecto para no romper la hidratación) y no inventa cifras.
 */
export function LiveBand({
  headline,
  stats,
  actions,
  eyebrow = "Pulso de compras",
}: {
  headline: string;
  stats: LiveStat[];
  actions?: ReactNode;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const ribbonY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const ribbonOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.25]);
  const [hora, setHora] = useState("");

  useEffect(() => {
    const tick = () =>
      setHora(new Date().toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const words = headline.split(" ");

  return (
    <section
      ref={ref}
      aria-label="Pulso de compras"
      className="on-dark relative isolate overflow-hidden rounded-sm bg-canvas-dark px-6 py-8 sm:px-8"
    >
      <motion.div
        style={{ y: reduced ? 0 : ribbonY, opacity: reduced ? 1 : ribbonOpacity }}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.6, ease, delay: 0.3 }}
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full md:w-[58%]"
      >
        <Ribbon className="h-full w-full opacity-60 md:opacity-100" />
      </motion.div>

      <div className="max-w-[640px]">
        <motion.p className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          <span className="rb-pulse relative size-2 bg-mint" aria-hidden />
          <span className="eyebrow text-on-dark-muted">
            {eyebrow}
            {hora ? ` · ${hora}` : ""}
          </span>
        </motion.p>

        <h2 className="mt-5 text-[28px] leading-[32px] font-medium tracking-[-0.5px] text-on-dark sm:text-display-xl">
          {words.map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-1 align-top">
              <motion.span
                className="inline-block"
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease, delay: 0.15 + i * 0.04 }}
              >
                {w}&nbsp;
              </motion.span>
            </span>
          ))}
        </h2>

        <motion.dl
          className="mt-5 grid grid-cols-2 gap-y-5 sm:flex sm:flex-wrap"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
              className={`pr-7 ${i > 0 ? "sm:border-l sm:border-on-dark-line sm:pl-7" : ""}`}
            >
              <dt className="eyebrow text-on-dark-muted">{s.label}</dt>
              <dd className="mt-2 text-display-lg text-on-dark tabular-nums">
                <CountUp value={s.value} format={s.format} delay={0.7 + i * 0.08} />
              </dd>
              <dd className="mt-2 text-caption text-on-dark-muted">{s.sub}</dd>
            </motion.div>
          ))}
        </motion.dl>

        {actions ? (
          <motion.div
            className="mt-6 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 1 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
