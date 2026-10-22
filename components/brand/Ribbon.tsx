"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

/**
 * The brand ribbon: 36 fine strands twisting through orange, magenta and periwinkle.
 * It is the only decorative element in RestoBoard. It drifts slowly (ambient motion),
 * leans toward the pointer, pauses off-screen and stays still for reduced-motion users.
 */
const W = 560;
const H = 260;
const STRANDS = 36;
const SAMPLES = 40;
const X0 = -20;
const X1 = W + 90;

function path(pts: [number, number][]) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function frame(t: number, lean: number) {
  const base = (x: number) => H * 0.5 + H * (0.22 + lean * 0.04) * Math.sin((x / W) * Math.PI * 1.5 - 0.4 + t * 0.32);
  const width = (x: number) => H * 0.21 * Math.cos((x / W) * Math.PI * 1.8 + 0.5 + t * 0.22);
  const lift = (x: number) => H * 0.035 * Math.sin((x / W) * Math.PI * 3 + t * 0.5);
  const out: string[] = [];
  for (let s = 0; s < STRANDS; s++) {
    const k = -1 + (2 * s) / (STRANDS - 1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = X0 + ((X1 - X0) * i) / SAMPLES;
      pts.push([x, base(x) + k * width(x) + k * k * lift(x)]);
    }
    out.push(path(pts));
  }
  return out;
}

const initial = frame(0, 0);

export function Ribbon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const refs = useRef<(SVGPathElement | null)[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !svg.current) return;
    let raf = 0;
    let visible = true;
    let lean = 0;
    let target = 0;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) raf = requestAnimationFrame(loop);
    });
    io.observe(svg.current);
    const onMove = (e: PointerEvent) => {
      target = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    function loop(now: number) {
      if (!visible || document.hidden) return;
      lean += (target - lean) * 0.03;
      const d = frame((now - start) / 1000, lean);
      for (let i = 0; i < STRANDS; i++) refs.current[i]?.setAttribute("d", d[i]);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    const onVis = () => {
      if (!document.hidden && visible) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`rb-${id}`} gradientUnits="userSpaceOnUse" x1={X0} y1="0" x2={X1} y2="0">
          <stop offset="0" stopColor="var(--color-gradient-orange)" stopOpacity="0" />
          <stop offset="0.3" stopColor="var(--color-gradient-orange)" />
          <stop offset="0.62" stopColor="var(--color-gradient-magenta)" />
          <stop offset="1" stopColor="var(--color-gradient-periwinkle)" />
        </linearGradient>
      </defs>
      {initial.map((d, i) => {
        const e = Math.abs(-1 + (2 * i) / (STRANDS - 1));
        return (
          <path
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            d={d}
            fill="none"
            stroke={`url(#rb-${id})`}
            strokeOpacity={0.16 + 0.74 * Math.pow(e, 2.4)}
            strokeWidth={e > 0.95 ? 1.75 : 1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
