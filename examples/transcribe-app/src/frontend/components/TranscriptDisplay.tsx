import { useEffect, useRef, useState } from "react";
import { useGlassUser } from "../auth.js";

interface Segment {
  segmentId: string;
  text: string;
  isFinal: boolean;
}

/**
 * Opens an SSE connection to the backend and renders the glasses user's speech
 * transcription live. Interim segments are shown faded; finals solid.
 */
export function TranscriptDisplay() {
  const { user } = useGlassUser();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const es = new EventSource(
      `/api/transcripts?token=${encodeURIComponent(user.sessionToken)}`
    );

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      const seg = JSON.parse(e.data) as Segment;
      setSegments((prev) => {
        // Replace the matching segment (interim → final updates in place).
        const idx = prev.findIndex((s) => s.segmentId === seg.segmentId);
        if (idx === -1) return [...prev, seg];
        const next = prev.slice();
        next[idx] = seg;
        return next;
      });
    };

    return () => es.close();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
        <span className="text-sm font-medium text-zinc-300">
          {connected ? "Listening" : "Connecting…"}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {segments.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-500">
            Start speaking — your transcript will appear here.
          </p>
        ) : (
          segments.map((s) => (
            <div
              key={s.segmentId}
              className={`ml-auto max-w-[85%] rounded-2xl bg-indigo-500/90 px-4 py-2 text-[15px] leading-snug text-white ${
                s.isFinal ? "opacity-100" : "opacity-60"
              }`}
            >
              {s.text || "…"}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
