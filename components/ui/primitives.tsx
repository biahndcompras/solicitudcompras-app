"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------------- Button ---------------- */
type ButtonStyle = "primary" | "mint" | "white" | "outline" | "ghost-dark";
const buttonStyles: Record<ButtonStyle, string> = {
  primary: "bg-primary text-on-dark hover:bg-surface-dark-soft rounded-sm",
  mint: "bg-mint text-ink hover:shadow-[inset_0_0_0_1px_#000] rounded-sm",
  white: "bg-canvas text-ink hover:bg-surface-soft rounded-sm",
  outline: "bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft rounded-xs",
  "ghost-dark": "bg-surface-dark-soft text-on-dark hover:shadow-[inset_0_0_0_1px_var(--color-text-on-dark-muted)] rounded-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  ...rest
}: { variant?: ButtonStyle; size?: "md" | "sm"; icon?: IconName; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        "group/btn inline-flex shrink-0 items-center justify-center gap-2 transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "mono-button h-8 max-sm:min-h-11 px-5" : "mono-label h-7 max-sm:min-h-11 px-3.5",
        buttonStyles[variant],
        className,
      )}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size={size === "md" ? 16 : 14}
          className={cx(
            "transition-transform duration-300 ease-out",
            icon === "plus" && "group-hover/btn:rotate-90",
            icon === "download" && "group-hover/btn:translate-y-0.5",
          )}
        />
      )}
      {children}
    </button>
  );
}

/* ---------------- Button link (misma piel, navegación) ---------------- */
export function ButtonLink({
  href,
  variant = "outline",
  size = "sm",
  icon,
  children,
  className,
}: {
  href: string;
  variant?: ButtonStyle;
  size?: "md" | "sm";
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 transition-[background-color,box-shadow] duration-150",
        size === "md" ? "mono-button h-8 max-sm:min-h-11 px-5" : "mono-label h-7 max-sm:min-h-11 px-3.5",
        buttonStyles[variant],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === "md" ? 16 : 14} />}
      {children}
    </Link>
  );
}

/* ---------------- Icon button ---------------- */
export function IconButton({
  icon,
  label,
  onDark,
  className,
  children,
  ...rest
}: { icon: IconName; label: string; onDark?: boolean; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "relative grid size-9 max-sm:size-11 shrink-0 place-items-center rounded-sm transition-colors duration-150",
        onDark ? "bg-surface-dark-soft text-on-dark hover:bg-[#3d4350]" : "bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={20} />
      {children}
    </button>
  );
}

/* ---------------- Badge ---------------- */
export type BadgeTone = "neutral" | "dark" | "mint" | "periwinkle" | "success" | "critical" | "solid-critical";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]",
  dark: "bg-surface-dark-soft text-on-dark",
  mint: "bg-mint text-ink",
  periwinkle: "bg-periwinkle text-ink",
  success: "bg-canvas text-success shadow-[inset_0_0_0_1px_var(--color-border-hairline)]",
  critical: "bg-canvas text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]",
  "solid-critical": "bg-[var(--color-bg-critical)] text-on-dark",
};
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-caption font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ initials, tone = "mint" }: { initials: string; tone?: "mint" | "periwinkle" | "neutral" }) {
  const bg = tone === "mint" ? "bg-mint" : tone === "periwinkle" ? "bg-periwinkle" : "bg-surface-soft";
  return <span className={cx("mono-label grid size-8 shrink-0 place-items-center text-ink", bg)}>{initials}</span>;
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  id,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  id: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 gap-1 rounded-sm bg-surface-soft p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "mono-label relative h-7 max-sm:min-h-11 rounded-sm px-3.5 transition-colors duration-200",
              active ? "text-on-dark" : "bg-canvas text-ink hover:bg-[#f6f6f6]",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-sm bg-primary"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Logo ---------------- */
export function Logo({ onDark, compact, label = "RestoBoard" }: { onDark?: boolean; compact?: boolean; label?: string }) {
  const fg = onDark ? "bg-on-dark" : "bg-ink";
  return (
    <span className={cx("inline-flex items-center gap-2.5", onDark ? "text-on-dark" : "text-ink")}>
      <span className="grid size-6 shrink-0 grid-cols-2 gap-1" aria-hidden>
        <span className={cx("rounded-[1px]", fg)} />
        <span className={cx("rounded-[1px]", fg)} />
        <span className={cx("rounded-[1px]", fg)} />
        <span className={cx("rounded-full", fg)} />
      </span>
      {!compact && <span className="text-display-md">{label}</span>}
    </span>
  );
}

/* ---------------- Panel ---------------- */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cx("flex min-w-0 flex-col gap-5 rounded-sm bg-canvas p-6 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]", className)}
    >
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-display-md text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-caption text-body">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
