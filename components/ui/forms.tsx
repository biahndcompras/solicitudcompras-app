"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { Button, cx } from "./primitives";

/* ---------------- Checkbox ---------------- */
export function Checkbox({ checked, indeterminate, onChange, label, hideLabel }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string; hideLabel?: boolean }) {
  const on = checked || indeterminate;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-body-md text-ink">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={hideLabel ? label : undefined} />
      <span className={cx("grid size-[18px] shrink-0 place-items-center rounded-xs transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black", on ? "bg-primary text-on-dark" : "bg-canvas shadow-[inset_0_0_0_1px_#000]")}>
        <AnimatePresence initial={false}>
          {on && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="grid">
              {indeterminate ? <span className="h-[1.5px] w-2.5 bg-on-dark" /> : <Icon name="check" size={14} />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {!hideLabel && label}
    </label>
  );
}

/* ---------------- Toggle (4px track, no pill) ---------------- */
export function Toggle({ checked, onChange, label, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; hideLabel?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={hideLabel ? label : undefined} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-body-md text-ink">
      <span className={cx("flex h-5 w-9 shrink-0 items-center rounded-sm px-[3px] transition-colors duration-200", checked ? "justify-end bg-primary" : "justify-start bg-surface-soft")}>
        <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 35 }} className={cx("size-3.5 rounded-[2px]", checked ? "bg-mint" : "bg-canvas shadow-[inset_0_0_0_1px_#000]")} />
      </span>
      {!hideLabel && label}
    </button>
  );
}

/* ---------------- Text field ---------------- */
export function TextField({
  label,
  error,
  helper,
  suffix,
  className,
  ...input
}: { label: string; error?: string; helper?: string; suffix?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-caption font-medium text-ink">
        {label}
      </label>
      <motion.div
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={cx(
          "flex h-10 max-sm:h-11 items-center gap-2 rounded-sm bg-canvas px-3 transition-shadow",
          error ? "shadow-[inset_0_0_0_1px_var(--color-text-critical)]" : "shadow-[inset_0_0_0_1px_var(--color-border-hairline)] focus-within:shadow-[inset_0_0_0_1px_#000]",
        )}
      >
        <input id={id} aria-invalid={!!error} aria-describedby={error || helper ? `${id}-h` : undefined} className="min-w-0 flex-1 bg-transparent text-body-md text-ink outline-none placeholder:text-body" {...input} />
        {suffix}
      </motion.div>
      <AnimatePresence initial={false}>
        {(error || helper) && (
          <motion.p id={`${id}-h`} key={error || helper} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cx("text-caption", error ? "text-critical" : "text-body")}>
            {error || helper}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Select (native, styled) ---------------- */
export function SelectField({ value, onChange, options, icon, label, className }: { value: string; onChange: (v: string) => void; options: string[]; icon?: IconName; label: string; className?: string }) {
  return (
    <label className={cx("relative flex h-10 max-sm:h-11 items-center gap-2 rounded-sm bg-canvas px-3 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] focus-within:shadow-[inset_0_0_0_1px_#000]", className)}>
      {icon && <Icon name={icon} size={18} />}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-body-md text-ink outline-none">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3" />
    </label>
  );
}

/* ---------------- Tabs (underline, animated) ---------------- */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div role="tablist" className="flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border-hairline)]">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button key={t.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(t.value)} className={cx("relative flex shrink-0 items-center gap-2 px-1 py-2.5 max-sm:py-3.5 text-body-md font-medium transition-colors", active ? "text-ink" : "text-body hover:text-ink")}>
            {t.label}
            {t.count !== undefined && (
              <motion.span key={t.count} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className={cx("mono-label rounded-sm px-1.5", active ? "bg-primary text-on-dark" : "bg-surface-soft text-ink")}>
                {t.count}
              </motion.span>
            )}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-0 h-0.5 bg-primary" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Filter chip ---------------- */
export function FilterChip({ label, active, onToggle, onRemove, icon }: { label: string; active?: boolean; onToggle?: () => void; onRemove?: () => void; icon?: IconName }) {
  return (
    <motion.span layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={cx("inline-flex h-8 max-sm:h-11 items-center rounded-sm text-caption font-medium", active ? "bg-primary text-on-dark" : "bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]")}>
      <button type="button" onClick={onToggle} aria-pressed={active} className="flex h-full items-center gap-1.5 pr-1 pl-2.5">
        <Icon name={icon ?? "filter"} size={14} />
        {label}
      </button>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="grid h-full place-items-center pr-2 pl-1 opacity-70 hover:opacity-100">
          <Icon name="close" size={14} />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </motion.span>
  );
}

/* ---------------- Quantity stepper ---------------- */
export function QtyStepper({ value, onChange, min = 0, label }: { value: number; onChange: (v: number) => void; min?: number; label: string }) {
  const btn = "grid size-8 max-sm:size-11 place-items-center bg-canvas shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft disabled:opacity-30";
  return (
    <div className="flex items-center" role="group" aria-label={label}>
      <button type="button" className={cx(btn, "rounded-l-sm")} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease">
        <span className="h-[1.5px] w-3 bg-ink" />
      </button>
      <span className="grid h-8 max-sm:h-11 w-11 place-items-center overflow-hidden shadow-[inset_0_1px_0_var(--color-border-hairline),inset_0_-1px_0_var(--color-border-hairline)]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="text-body-md font-medium tabular-nums">
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className={cx(btn, "rounded-r-sm")} onClick={() => onChange(value + 1)} aria-label="Increase">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, description, children, actions }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; actions: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-canvas-dark/60" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="relative w-full max-w-[480px] overflow-hidden rounded-sm bg-canvas shadow-[var(--shadow-soft-drop)]"
          >
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex-1">
                <h2 className="text-display-md">{title}</h2>
                {description && <p className="mt-1.5 text-caption text-body">{description}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 max-sm:size-11 place-items-center rounded-sm hover:bg-surface-soft">
                <Icon name="close" />
              </button>
            </div>
            {children && <div className="px-6 pb-6">{children}</div>}
            <div className="flex justify-end gap-3 bg-surface-soft px-6 py-4">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon, title, message, action, onAction }: { icon: IconName; title: string; message: string; action?: string; onAction?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center bg-mint">
        <Icon name={icon} />
      </span>
      <p className="text-body-lg font-medium text-ink">{title}</p>
      <p className="max-w-[320px] text-caption text-body">{message}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {action}
        </Button>
      )}
    </motion.div>
  );
}

/* ---------------- Summary strip ---------------- */
export function SummaryStrip({ items }: { items: { label: string; value: ReactNode; sub: string; tone?: "good" | "bad" }[] }) {
  return (
    <motion.dl
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="grid grid-cols-2 rounded-sm bg-canvas shadow-[inset_0_0_0_1px_var(--color-border-hairline)] lg:grid-cols-4"
    >
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          className={cx("flex flex-col gap-2 px-6 py-5", i > 0 && "lg:shadow-[inset_1px_0_0_var(--color-border-hairline)]", i % 2 === 1 && "max-lg:shadow-[inset_1px_0_0_var(--color-border-hairline)]", i > 1 && "max-lg:shadow-[inset_0_1px_0_var(--color-border-hairline)]")}
        >
          <dt className="eyebrow text-body">{it.label}</dt>
          <dd className="text-display-lg text-ink tabular-nums">{it.value}</dd>
          <dd className={cx("text-caption", it.tone === "good" ? "text-success" : it.tone === "bad" ? "text-critical" : "text-body")}>{it.sub}</dd>
        </motion.div>
      ))}
    </motion.dl>
  );
}
