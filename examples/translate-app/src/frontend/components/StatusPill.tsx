import type { StreamStatus } from "../hooks/useTranslateStream.js";

const META: Record<
  StreamStatus,
  { label: string; dot: string; text: string; breathe: boolean }
> = {
  connecting: { label: "Connecting", dot: "bg-zinc-400", text: "text-zinc-400", breathe: true },
  live: { label: "Listening", dot: "bg-emerald-400", text: "text-emerald-300", breathe: true },
  idle: { label: "Idle", dot: "bg-zinc-500", text: "text-zinc-400", breathe: false },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400", text: "text-amber-300", breathe: true },
  offline: { label: "Offline", dot: "bg-rose-500", text: "text-rose-300", breathe: false },
};

/** Small frosted status capsule that mirrors the SSE connection state. */
export function StatusPill({ status }: { status: StreamStatus }) {
  const m = META[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
      <span
        className={`h-2 w-2 rounded-full ${m.dot} ${m.breathe ? "animate-breathe" : ""}`}
      />
      <span className={`text-[12px] font-medium ${m.text}`}>{m.label}</span>
    </div>
  );
}
