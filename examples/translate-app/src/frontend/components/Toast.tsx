import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type Tone = "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(
  null,
);

/** Lightweight top-center toast stack for surfacing transient failures. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: Tone = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 pt-safe">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={`pointer-events-auto max-w-[88%] rounded-2xl border px-4 py-2.5 text-[13px] font-medium shadow-float backdrop-blur-xl ${
                t.tone === "error"
                  ? "border-rose-500/25 bg-rose-500/15 text-rose-100"
                  : "border-white/10 bg-zinc-900/85 text-zinc-100"
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string, tone?: Tone) => void {
  const ctx = useContext(ToastContext);
  // No-op if used outside a provider, so callers never need to guard.
  return ctx ?? (() => {});
}
