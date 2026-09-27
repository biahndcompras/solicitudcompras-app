"use client";

import { useEffect, useId, useRef } from "react";

type ModalProps = {
  children: React.ReactNode;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
};

/**
 * Modal in-app del flujo del coordinador. Reemplaza a `window.confirm` en las
 * acciones irreversibles (cancelar / reabrir), que necesitan un resumen de
 * impacto con su consecuencia concreta y tienen que funcionar igual en táctil
 * (P3-11). Cierra con Escape y con clic en el fondo, y recibe el foco al abrirse.
 */
export function Modal({ children, onCerrar, titulo, descripcion }: ModalProps) {
  const tituloId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onTecla);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onTecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? `${tituloId}-desc` : undefined}
        tabIndex={-1}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md relative z-10 p-6 step-enter focus:outline-none"
      >
        <div id={tituloId} className="text-base font-semibold text-slate-900">
          {titulo}
        </div>
        {descripcion ? (
          <div id={`${tituloId}-desc`} className="text-sm text-slate-600 mt-2">
            {descripcion}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
