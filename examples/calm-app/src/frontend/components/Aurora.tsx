/**
 * Ambient animated background: a few large, slowly drifting colour blobs tinted
 * by the active soundscape. Pure CSS animation (see tailwind keyframes).
 */
export function Aurora({ color }: { color: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-24 top-10 h-72 w-72 animate-drift rounded-full blur-3xl"
        style={{ backgroundColor: color, opacity: 0.18 }}
      />
      <div
        className="absolute -right-20 top-1/3 h-80 w-80 animate-aurora rounded-full blur-3xl"
        style={{ backgroundColor: color, opacity: 0.14 }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-72 w-72 animate-drift rounded-full blur-3xl"
        style={{ backgroundColor: color, opacity: 0.12, animationDelay: "6s" }}
      />
    </div>
  );
}
