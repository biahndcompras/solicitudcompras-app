import { cn } from "@/lib/design/cn";

export type BadgeTone =
  | "nueva"
  | "activa"
  | "cotizaciones"
  | "decision"
  | "cerrada"
  | "neutral"
  | "success"
  | "warning"
  | "error";

type BadgeProps = {
  tone?: BadgeTone;
  label: string;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  nueva: "bg-sky-500/10 text-sky-600 border border-sky-500/20 uppercase tracking-wider text-xs font-bold",
  activa: "bg-sky-100 text-sky-700",
  cotizaciones: "bg-amber-100 text-amber-700",
  decision: "bg-indigo-100 text-indigo-700",
  cerrada: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600 px-2.5 py-1",
  success: "bg-sky-500/10 text-sky-600 border border-sky-500/20 uppercase tracking-wider text-xs font-bold",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

export function Badge({ tone = "neutral", label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {label}
    </span>
  );
}