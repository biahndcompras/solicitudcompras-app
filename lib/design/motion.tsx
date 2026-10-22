"use client";

import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------------------------------------------------------------- */
/* Shared easing + variants                                          */
/* ---------------------------------------------------------------- */
export const ease = [0.22, 1, 0.36, 1] as const;

export const revealParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
export const revealChild: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};

/** Scroll reveal wrapper: children with `variants={revealChild}` stagger in once. */
export function Reveal({ children, className, as = "div", amount = 0.15 }: { children: ReactNode; className?: string; as?: "div" | "section"; amount?: number }) {
  const M = as === "section" ? motion.section : motion.div;
  return (
    <M className={className} variants={revealParent} initial="hidden" whileInView="show" viewport={{ once: true, amount }}>
      {children}
    </M>
  );
}

/* ---------------------------------------------------------------- */
/* Count-up numbers                                                  */
/* ---------------------------------------------------------------- */
export function useCountUp(value: number, opts: { duration?: number; delay?: number; start?: boolean } = {}) {
  const { duration = 1.1, delay = 0, start = true } = opts;
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!start) return;
    if (reduced) {
      from.current = value;
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }
    const controls = animate(from.current, value, {
      duration,
      delay,
      ease,
      onUpdate: (v) => setDisplay(v),
      onComplete: () => (from.current = value),
    });
    return () => {
      controls.stop();
    };
  }, [value, duration, delay, start, reduced]);
  return display;
}

/** Number that counts up the first time it scrolls into view, and tweens on change after. */
export function CountUp({ value, format, delay = 0, className }: { value: number; format: (n: number) => string; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const v = useCountUp(value, { delay, start: inView });
  return (
    <span ref={ref} className={className}>
      {format(v)}
    </span>
  );
}
