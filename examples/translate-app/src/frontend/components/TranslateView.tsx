import { useEffect, useRef, useState } from "react";
import { useGlassUser } from "../auth.js";

interface Segment {
  segmentId: string;
  original: string;
  translated: string | null;
  isFinal: boolean;
}

/**
 * Focus view: the most-recent finalized translation is shown big (with its
 * original above), older ones fade into a history list, and the in-progress
 * sentence previews live at the bottom.
 */
export function TranslateView() {
  const { user } = useGlassUser();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [connected, setConnected] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const es = new EventSource(
      `/api/transcripts?token=${encodeURIComponent(user.sessionToken)}`,
    );
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      const seg = JSON.parse(e.data) as Segment;
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.segmentId === seg.segmentId);
        if (idx === -1) return [...prev, seg];
        const next = prev.slice();
        next[idx] = seg;
        return next;
      });
    };
    return () => es.close();
  }, [user]);

  const finals = segments.filter((s) => s.isFinal);
  const interim = [...segments].reverse().find((s) => !s.isFinal);
  const current = finals[finals.length - 1];
  const history = finals.slice(0, -1);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history.length]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* History — older translations, faded */}
      <div
        ref={historyRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-2"
      >
        {history.length === 0 && !current && (
          <p className="mt-16 text-center text-sm text-zinc-500">
            Start speaking — your translation will appear here.
          </p>
        )}
        {history.map((s) => (
          <div key={s.segmentId} className="opacity-45">
            <p className="text-xs text-zinc-500">{s.original}</p>
            <p className="text-[15px] text-zinc-200">{s.translated ?? "…"}</p>
          </div>
        ))}
      </div>

      {/* Current — the focus */}
      {current && (
        <div className="border-t border-white/10 px-1 pt-4">
          <p className="text-sm text-zinc-400">{current.original}</p>
          {current.translated === null ? (
            <p className="mt-1 animate-pulse text-2xl font-semibold text-indigo-300">
              translating…
            </p>
          ) : (
            <p className="mt-1 text-3xl font-bold leading-tight text-white">
              {current.translated}
            </p>
          )}
        </div>
      )}

      {/* Interim — what's being said right now */}
      {interim && interim.original && (
        <p className="px-1 pt-3 text-base italic text-zinc-500">
          {interim.original}…
        </p>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 px-1 pt-4">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
        <span className="text-sm text-zinc-400">
          {connected ? "Listening" : "Connecting…"}
        </span>
      </div>
    </div>
  );
}
