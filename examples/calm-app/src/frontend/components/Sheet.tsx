import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { CloseIcon } from "../lib/icons.js";

/**
 * iOS-style bottom sheet: dim backdrop + a rounded panel that springs up from
 * the bottom and can be dragged down to dismiss.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-t-4xl border border-white/10 bg-zinc-950/85 pb-safe shadow-sheet backdrop-blur-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/20" />
            <header className="flex items-center gap-2 px-5 pb-3 pt-3">
              <h2 className="flex-1 text-[17px] font-semibold tracking-tight text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition active:scale-90"
                aria-label="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
