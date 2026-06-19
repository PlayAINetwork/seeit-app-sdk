import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Segment, StreamStatus } from "../hooks/useTranslateStream.js";
import type { ViewMode } from "./ViewModeControl.js";
import { GlobeIcon, RetryIcon } from "../lib/icons.js";

const FAILED = "(translation failed)";

/**
 * Focus stage: older translations fade into a scrolling history, the latest
 * finalized line sits in focus (big), and the in-progress sentence previews at
 * the bottom. The view mode controls whether we show original, translation, or
 * both.
 */
export function TranslateView({
  segments,
  status,
  viewMode,
  targetLang,
  onRetry,
}: {
  segments: Segment[];
  status: StreamStatus;
  viewMode: ViewMode;
  targetLang: string;
  onRetry: (segmentId: string) => void;
}) {
  const finals = segments.filter((s) => s.isFinal);
  const interim = [...segments].reverse().find((s) => !s.isFinal);
  const current = finals[finals.length - 1];
  const history = finals.slice(0, -1);

  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history.length]);

  const showOriginal = viewMode !== "translation";
  const showTranslation = viewMode !== "original";
  const empty = finals.length === 0 && !interim;

  if (empty) return <EmptyState status={status} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03]">
      {/* History — older translations, faded */}
      <div
        ref={historyRef}
        className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-6"
      >
        {history.map((s) => (
          <div key={s.segmentId} className="opacity-55">
            {showOriginal && (
              <p className="text-[12px] text-zinc-500">{s.original}</p>
            )}
            {showTranslation && (
              <p className="text-[15px] leading-snug text-zinc-200">
                {s.translated ?? "…"}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Current — the focus */}
      {current && (
        <div className="border-t border-white/[0.07] px-5 pb-5 pt-4">
          <SourceTarget sourceLang={current.sourceLang} targetLang={targetLang} />

          {showOriginal && (
            <p className="mt-2 text-[14px] text-zinc-400">{current.original}</p>
          )}

          {showTranslation && (
            <CurrentTranslation segment={current} onRetry={onRetry} />
          )}

          {!showTranslation && (
            <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-white">
              {current.original}
            </p>
          )}
        </div>
      )}

      {/* Interim — what's being said right now */}
      <AnimatePresence>
        {interim && interim.original && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pb-5 text-[15px] italic text-zinc-500"
          >
            {interim.original}
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-breathe rounded-full bg-accent align-middle" />
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function CurrentTranslation({
  segment,
  onRetry,
}: {
  segment: Segment;
  onRetry: (id: string) => void;
}) {
  if (segment.translated === FAILED) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <p className="text-[15px] text-rose-300">Translation failed</p>
        <button
          onClick={() => onRetry(segment.segmentId)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-white transition active:scale-95 hover:bg-white/10"
        >
          <RetryIcon className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (segment.translated === null) {
    return (
      <p className="mt-1 animate-shimmer text-shimmer text-[28px] font-semibold leading-tight tracking-tight">
        Translating…
      </p>
    );
  }

  return (
    <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-white">
      {segment.translated}
    </p>
  );
}

function SourceTarget({
  sourceLang,
  targetLang,
}: {
  sourceLang: string | null;
  targetLang: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
      <GlobeIcon className="h-3.5 w-3.5 text-accent" />
      {sourceLang ? `${sourceLang} → ${targetLang}` : targetLang}
    </div>
  );
}

function EmptyState({ status }: { status: StreamStatus }) {
  const live = status === "live";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.03] px-6 text-center">
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
          live ? "bg-accent-soft text-accent" : "bg-white/5 text-zinc-500"
        }`}
      >
        <GlobeIcon className={`h-7 w-7 ${live ? "animate-breathe" : ""}`} />
      </div>
      <p className="text-[17px] font-semibold text-white">
        {live ? "Listening…" : "Ready to translate"}
      </p>
      <p className="mt-1.5 max-w-[16rem] text-[14px] leading-relaxed text-zinc-500">
        {live
          ? "Speak in any language and the translation appears here instantly."
          : "Your live translation will show up here as soon as you start talking."}
      </p>
    </div>
  );
}
