import { motion } from "framer-motion";

export type ViewMode = "both" | "translation" | "original";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "translation", label: "Translation" },
  { value: "original", label: "Original" },
];

/** iOS-style segmented control for choosing what to show on the stage. */
export function ViewModeControl({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/[0.06] p-1 backdrop-blur">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="relative flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition"
          >
            {active && (
              <motion.span
                layoutId="viewmode-pill"
                className="absolute inset-0 rounded-full bg-white/[0.14]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span
              className={`relative ${active ? "text-white" : "text-zinc-400"}`}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
