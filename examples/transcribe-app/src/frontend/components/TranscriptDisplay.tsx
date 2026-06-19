import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Segment, StreamStatus } from "../hooks/useTranscriptStream.js";
import { ArrowDownIcon, MicIcon } from "../lib/icons.js";

/**
 * The live transcript surface: flowing, readable lines (à la Live Captions).
 * Finals render solid; the in-progress utterance trails dimmed. Auto-scroll
 * follows the latest line but yields the moment the user scrolls up to read.
 */
export function TranscriptDisplay({
  segments,
  status,
}: {
  segments: Segment[];
  status: StreamStatus;
}) {
  const finals = segments.filter((s) => s.isFinal);
  const interim = [...segments].reverse().find((s) => !s.isFinal);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);

  // Follow the bottom only while the user hasn't scrolled away.
  useEffect(() => {
    if (stuck) {
      const el = scrollRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [segments, stuck]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStuck(distance < 80);
  };

  const jumpToLive = () => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setStuck(true);
  };

  const empty = finals.length === 0 && !interim;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03]">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6"
      >
        {empty ? (
          <EmptyState status={status} />
        ) : (
          <div className="space-y-4">
            {finals.map((s) => (
              <motion.p
                key={s.segmentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="text-[19px] font-medium leading-relaxed tracking-tight text-zinc-50"
              >
                {s.text}
              </motion.p>
            ))}
            {interim && interim.text && (
              <p className="text-[19px] font-medium leading-relaxed tracking-tight text-zinc-400">
                {interim.text}
                <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-breathe rounded-full bg-accent align-middle" />
              </p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!stuck && !empty && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={jumpToLive}
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-float"
          >
            <ArrowDownIcon className="h-4 w-4" />
            Jump to live
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ status }: { status: StreamStatus }) {
  const live = status === "live";
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
          live ? "bg-accent-soft text-accent" : "bg-white/5 text-zinc-500"
        }`}
      >
        <MicIcon className={`h-7 w-7 ${live ? "animate-breathe" : ""}`} />
      </div>
      <p className="text-[17px] font-semibold text-white">
        {live ? "Listening…" : "Ready when you are"}
      </p>
      <p className="mt-1.5 max-w-[16rem] text-[14px] leading-relaxed text-zinc-500">
        {live
          ? "Start speaking and your words will appear here in real time."
          : "Your live transcript will show up here as soon as you start talking."}
      </p>
    </div>
  );
}
