"use client";

import { motion } from "motion/react";
import { CountUp, ease, revealChild } from "@/lib/design/motion";
import { Icon, type IconName } from "../ui/Icon";
import { cx } from "../ui/primitives";

/**
 * KPI con sparkline (DESIGN.md §6/§7).
 *
 * Adaptación de la referencia: el valor puede ser `null` (dato no disponible → «—»,
 * nunca 0) y el delta es opcional (si no hay comparación real, no se inventa). La
 * tendencia es opcional por la misma razón.
 */
function Sparkline({ data, id }: { data: number[]; id: string }) {
  const w = 88;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / (max - min || 1)) * (h - 4) - 2,
  ] as const);
  const d = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <motion.path
        key={id + d}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 1.2, ease, delay: 0.2 }}
      />
      <motion.rect
        key={id + "dot" + d}
        x={last[0] - 2.5}
        y={last[1] - 2.5}
        width={5}
        height={5}
        fill="currentColor"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 500, damping: 20 }}
        style={{ transformOrigin: `${last[0]}px ${last[1]}px` }}
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  format,
  unit,
  delta,
  good,
  comparison,
  trend,
  icon,
  tone = "default",
  index = 0,
  error = false,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  unit?: string;
  delta?: string;
  /** `true` verde, `false` rojo, `undefined` neutro (sin juicio). */
  good?: boolean;
  comparison?: string;
  trend?: number[];
  icon: IconName;
  tone?: "default" | "mint" | "periwinkle";
  index?: number;
  error?: boolean;
}) {
  const tint =
    tone === "mint"
      ? "bg-mint"
      : tone === "periwinkle"
        ? "bg-periwinkle"
        : "bg-canvas shadow-[inset_0_0_0_1px_var(--color-border-hairline)]";
  const up = delta?.trim().startsWith("+");

  return (
    <motion.article
      variants={revealChild}
      className={cx(
        "group/kpi relative flex min-w-0 flex-col gap-5 rounded-sm p-6 transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_#000]",
        tint
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="eyebrow flex-1 text-ink">{label}</h3>
        <Icon name={icon} className="text-ink transition-transform duration-300 group-hover/kpi:-rotate-6" />
      </div>
      <p className="text-display-xl text-ink tabular-nums">
        {error || value === null ? (
          "—"
        ) : (
          <>
            <CountUp value={value} format={format} delay={index * 0.08} />
            {unit ? <span className="ml-1 text-display-md text-body">{unit}</span> : null}
          </>
        )}
      </p>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          {delta ? (
            <p
              className={cx(
                "flex items-center gap-1 text-caption font-medium",
                good === undefined ? "text-body" : good ? "text-success" : "text-critical"
              )}
            >
              <motion.span
                key={delta}
                initial={{ opacity: 0, y: up ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
                className="inline-flex items-center gap-1"
              >
                <Icon name={up ? "arrow-up-right" : "arrow-down-right"} size={14} />
                {delta}
              </motion.span>
            </p>
          ) : null}
          <p className={cx("mt-1 truncate text-caption", tone === "default" ? "text-body" : "text-ink")}>{comparison}</p>
        </div>
        {trend && trend.length > 1 ? (
          <span className="text-ink">
            <Sparkline data={trend} id={label} />
          </span>
        ) : null}
      </div>
    </motion.article>
  );
}
