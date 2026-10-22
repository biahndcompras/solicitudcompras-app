"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ToastProvider } from "../ui/Toast";

/**
 * Providers del sistema nuevo (DESIGN.md §8).
 *
 * `MotionConfig reducedMotion="user"` hace que todas las animaciones respeten la
 * preferencia del sistema sin que cada componente lo repita. El ToastProvider es
 * el de la referencia; vive solo dentro del scope `.bia-ds` hasta que el shell
 * viejo migre (F7).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
