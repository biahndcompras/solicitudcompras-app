"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { cx } from "../ui/primitives";
import { useShell } from "./AppShell";

/**
 * Header sticky que se condensa a los 12px de scroll (DESIGN.md §4.2).
 * Sin campana de notificaciones: el portal no tiene notificaciones en tiempo real
 * (ver DESIGN.md §14); no se muestra un dato falso.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  titleExtra,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleExtra?: ReactNode;
}) {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setStuck(y > 12));
  const { openMenu } = useShell();

  return (
    <header
      className={cx(
        "sticky top-0 z-30 -mx-4 px-4 transition-[background-color,box-shadow,padding] duration-300 sm:-mx-8 sm:px-8",
        stuck && "bg-canvas/90 py-3 shadow-[0_1px_0_var(--color-border-hairline)] backdrop-blur-md"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <button
          type="button"
          onClick={openMenu}
          aria-label="Abrir menú"
          className="order-first grid size-9 max-sm:size-11 shrink-0 place-items-center rounded-sm shadow-[inset_0_0_0_1px_var(--color-border-hairline)] lg:hidden"
        >
          <Icon name="hamburger" />
        </button>
        <div className="order-first min-w-0 basis-[calc(100%-48px)] sm:order-none sm:flex-1 sm:basis-auto">
          <div className="flex flex-wrap items-center gap-3">
            <motion.h1
              className="origin-left text-display-lg text-ink"
              animate={{ scale: stuck ? 0.82 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {title}
            </motion.h1>
            {titleExtra}
          </div>
          <AnimatePresence initial={false}>
            {!stuck && subtitle && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1.5 overflow-hidden text-caption text-body"
              >
                {subtitle}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {actions}
      </div>
    </header>
  );
}

/** Buscador con atajo `/` (DESIGN.md §4.2). */
export function SearchField({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label
      className={cx(
        "group/search relative flex h-10 max-sm:h-11 w-full items-center gap-2 rounded-sm bg-canvas px-3 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_#000] sm:w-56",
        className
      )}
    >
      <Icon name="search" size={18} className="text-body" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body-md text-ink outline-none placeholder:text-body"
      />
      <kbd className="mono-caption rounded-xs px-1.5 py-0.5 text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)] group-focus-within/search:opacity-0">
        /
      </kbd>
    </label>
  );
}
