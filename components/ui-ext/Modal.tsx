"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/design/cn";

// Modal accesible: role=dialog + aria-modal + trampa de foco + Escape + restaur del foco.
// Los tokens que usaba antes (bg-ink, rounded-card, shadow-pop, bg-azul-marino) no existen
// en styles/globals.css: el overlay quedaba transparente y el panel sin fondo.

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Botón de cierre visible (por defecto true). */
  cerrable?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  className,
  cerrable = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const tituloId = useId();

  const enfocarPrimero = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Nunca cae sobre la acción destructiva/confirmación por defecto: si el autor no marca
    // [data-autofocus], el foco arranca en el panel y el usuario decide con Tab.
    const marcado = panel.querySelector<HTMLElement>("[data-autofocus]");
    (marcado ?? panel).focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    enfocarPrimero();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activo === primero || !panel.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflowPrevio;
      focoPrevio.current?.focus?.();
    };
  }, [open, onClose, enfocarPrimero]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={cerrable ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : undefined}
        tabIndex={-1}
        className={cn(
          // Columna con dos zonas: el cuerpo scrollea, el pie NO. Antes todo el panel
          // scrolleaba (max-h + overflow-y-auto), así que con contenido largo las acciones
          // finales quedaban fuera de la vista sin ningún indicio, y sin padding propio
          // quedaban pegadas al borde inferior: [MEDIDO] hueco abajo/izq/der = 0 px.
          "w-full sm:max-w-[480px] max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl outline-none step-enter",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 overflow-y-auto no-scrollbar">
          {eyebrow ? (
            <div className="px-6 pt-6 pb-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{eyebrow}</div>
            </div>
          ) : null}
          <div className={cn("px-6", footer ? "pb-2" : "pb-6")}>
            {title ? (
              <h2 id={tituloId} className="mb-3 text-xl font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            ) : null}
            {children}
          </div>
        </div>
        {/* El pie lleva su propio aire: `pb` respeta el safe-area del iPhone, y sin él el
            último botón queda con 0 px de aire contra el borde (y contra el home indicator). */}
        <div className="shrink-0 px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
