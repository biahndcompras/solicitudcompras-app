"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import type { DiaSerie } from "@/lib/domain/dashboard";
import { ease } from "@/lib/design/motion";
import { cx } from "../ui/primitives";

const SERIES = [
  { key: "creadas" as const, label: "Creadas", swatch: "bg-primary" },
  { key: "cerradas" as const, label: "Cerradas", swatch: "bg-periwinkle" },
];

function niceMax(v: number) {
  const step = v > 400 ? 100 : v > 100 ? 20 : v > 40 ? 10 : 5;
  return Math.max(step, Math.ceil((v * 1.05) / step) * step);
}

/**
 * Solicitudes creadas vs cerradas por día (DESIGN.md §7): el patrón de barras de
 * `OrdersChart` de la referencia, con dos series agrupadas. Sin proyección: no
 * existe un dato real de forecast.
 */
export function SolicitudesChart({ serie }: { serie: DiaSerie[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const inView = useInView(plot, { once: true, amount: 0.3 });
  const buckets = serie.slice(-14);
  const dense = buckets.length > 10;
  const activo = hover ?? buckets.length - 1;

  const totales = {
    creadas: buckets.reduce((a, b) => a + b.creadas, 0),
    cerradas: buckets.reduce((a, b) => a + b.cerradas, 0),
  };
  const max = niceMax(Math.max(...buckets.map((b) => Math.max(b.creadas, b.cerradas)), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const hoy = buckets[buckets.length - 1]?.fecha;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Series de la gráfica">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-caption">
            <span className={cx("size-2.5", s.swatch)} />
            <span className="text-body">{s.label}</span>
            <span className="font-medium text-ink tabular-nums">{totales[s.key]}</span>
          </span>
        ))}
        <span className="ml-auto text-caption text-body">Últimos {buckets.length} días</span>
      </div>

      <div className="relative pt-7 pl-9">
        <div ref={plot} className="relative h-[240px]">
          {ticks.map((t, i) => (
            <div key={i} className="absolute inset-x-0" style={{ bottom: `${(t / max) * 100}%` }}>
              <div className={cx("h-px w-full", i === 0 ? "bg-primary" : "bg-hairline")} />
              <motion.span
                key={`${t}-${max}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mono-caption absolute -top-[7px] -left-9 w-7 text-right text-body"
              >
                {t}
              </motion.span>
            </div>
          ))}

          <div className="absolute inset-0 flex items-end" onMouseLeave={() => setHover(null)}>
            {buckets.map((b, i) => {
              const esHoy = b.fecha === hoy;
              const activa = i === activo;
              return (
                <div
                  key={b.fecha}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`${b.label}: ${b.creadas} creadas, ${b.cerradas} cerradas`}
                >
                  {esHoy && (
                    <motion.div
                      layoutId="solicitudes-hoy"
                      className="absolute inset-x-[6%] -top-2 bottom-0 bg-mint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: inView ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    />
                  )}
                  {hover === i && !esHoy && <div className="absolute inset-x-[6%] -top-2 bottom-0 bg-surface-soft/60" />}
                  <div className={cx("relative flex h-full items-end justify-center gap-[2px]", dense ? "w-[62%]" : "w-[52%] max-w-7")}>
                    {SERIES.map((s, si) => (
                      <motion.div
                        key={s.key}
                        className={cx("h-full flex-1", s.swatch)}
                        initial={{ height: 0 }}
                        animate={{ height: inView ? `${(b[s.key] / max) * 100}%` : 0 }}
                        transition={{
                          duration: 0.8,
                          ease,
                          delay: inView ? 0.1 + i * (dense ? 0.012 : 0.04) + si * 0.05 : 0,
                        }}
                      />
                    ))}
                  </div>
                  <AnimatePresence>
                    {activa && inView && (
                      <motion.div
                        key="tip"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.2, delay: hover === null ? 1.1 : 0 }}
                        className={cx(
                          "pointer-events-none absolute top-2 z-20 w-[168px] rounded-sm bg-canvas-dark p-3 text-on-dark",
                          i > buckets.length / 2 ? "right-[calc(100%+6px)]" : "left-[calc(100%+6px)]"
                        )}
                      >
                        <p className="eyebrow text-on-dark-muted">{esHoy ? `${b.label}, hoy` : b.label}</p>
                        {SERIES.map((s) => (
                          <p key={s.key} className="mt-2 flex items-center gap-2 text-caption">
                            <span className={cx("size-2", s.swatch)} />
                            <span className="flex-1">{s.label}</span>
                            <span className="font-medium tabular-nums">{b[s.key]}</span>
                          </p>
                        ))}
                        <p className="mt-2 flex justify-between text-caption text-on-dark-muted">
                          <span>Activas al cierre</span>
                          <span className="tabular-nums text-on-dark">{b.activas}</span>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 flex">
          {buckets.map((b, i) => (
            <span
              key={`l-${b.fecha}`}
              className={cx(
                "mono-caption min-w-0 flex-1 text-center whitespace-nowrap",
                i === activo ? "text-ink" : "text-body",
                dense && i % 3 !== 0 && b.fecha !== hoy && "invisible"
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
