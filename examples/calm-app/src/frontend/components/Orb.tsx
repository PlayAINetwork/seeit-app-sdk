import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The breathing orb. When playing it expands and contracts on a slow ~10s
 * inhale/exhale cycle; idle it just drifts gently. Colour follows the active
 * soundscape.
 */
export function Orb({
  color,
  playing,
  children,
}: {
  color: string;
  playing: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex h-64 w-64 items-center justify-center">
      {/* outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ backgroundColor: color }}
        animate={
          playing
            ? { opacity: [0.35, 0.6, 0.35], scale: [0.9, 1.15, 0.9] }
            : { opacity: 0.28, scale: 1 }
        }
        transition={
          playing
            ? { duration: 10, repeat: Infinity, ease: "easeInOut" }
            : { duration: 1.2 }
        }
      />

      {/* breathing core */}
      <motion.div
        className="relative flex h-44 w-44 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${color}, rgba(255,255,255,0.04) 70%)`,
          boxShadow: `0 0 60px ${color}55, inset 0 0 40px rgba(255,255,255,0.12)`,
        }}
        animate={
          playing
            ? { scale: [1, 1.12, 1] }
            : { scale: [1, 1.03, 1] }
        }
        transition={{
          duration: playing ? 10 : 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* inner ring */}
        <div className="absolute inset-3 rounded-full border border-white/15" />
        <div className="relative flex flex-col items-center gap-1 text-white">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
