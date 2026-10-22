"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type Tone = "success" | "critical" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
}

const Ctx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = next.current++;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      if (t.tone !== "critical") setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-sm bg-canvas py-3 pr-3 pl-4 shadow-soft ${
                t.tone === "critical" ? "shadow-[inset_3px_0_0_var(--color-text-critical),inset_0_0_0_1px_var(--color-text-critical),var(--shadow-soft-drop)]" : "shadow-[inset_0_0_0_1px_var(--color-border-hairline),var(--shadow-soft-drop)]"
              }`}
            >
              <Icon
                name={t.tone === "success" ? "check-circle" : t.tone === "critical" ? "alert" : "info"}
                className={t.tone === "success" ? "text-success" : t.tone === "critical" ? "text-critical" : "text-ink"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-body-md font-medium text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 text-caption text-body">{t.message}</p>}
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="grid size-6 place-items-center text-body hover:text-ink">
                <Icon name="close" size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
