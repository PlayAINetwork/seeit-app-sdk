import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Segment, StreamStatus, Mode } from "../hooks/useTranslateStream.js";
import type { ViewMode } from "./ViewModeControl.js";
import { GlobeIcon, RetryIcon } from "../lib/icons.js";
import { dirFor } from "../lib/i18n.js";

const FAILED = "(translation failed)";

/**
 * Focus stage: older translations fade into a scrolling history, the latest
 * finalized line sits in focus (big), and the in-progress sentence previews at
 * the bottom. View mode controls original/translation/both; conversation mode
 * adds a per-line direction badge ("ES → HI").
 */
export function TranslateView({
  segments,
  status,
  viewMode,
  mode,
  targetLang,
  onRetry,
}: {
  segments: Segment[];
  status: StreamStatus;
  viewMode: ViewMode;
  mode: Mode;
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

  if (empty) return <EmptyState status={status} mode={mode} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03]">
      {/* History — older translations, faded */}
      <div
        ref={historyRef}
        className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-6"
      >
        {history.map((s) => (
          <div key={s.segmentId} className="opacity-55">
            {s.direction && (
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
                {s.direction}
              </p>
            )}
            {showOriginal && (
              <p dir={dirFor(s.sourceLang)} className="text-[12px] text-zinc-500">
                {s.original}
              </p>
            )}
            {showTranslation && (
              <p
                dir={dirFor(s.targetLang ?? targetLang)}
                className="text-[15px] leading-snug text-zinc-200"
              >
                {s.translated ?? "…"}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Current — the focus */}
      {current && (
        <div className="border-t border-white/[0.07] px-5 pb-5 pt-4">
          <SourceTarget
            direction={current.direction}
            sourceLang={current.sourceLang}
            targetLang={current.targetLang ?? targetLang}
          />

          {showOriginal && (
            <p
              dir={dirFor(current.sourceLang)}
              className="mt-2 text-[14px] text-zinc-400"
            >
              {current.original}
            </p>
          )}

          {showTranslation && (
            <CurrentTranslation
              segment={current}
              targetLang={targetLang}
              onRetry={onRetry}
            />
          )}

          {!showTranslation && (
            <p
              dir={dirFor(current.sourceLang)}
              className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-white"
            >
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
            dir={dirFor(interim.sourceLang)}
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
  targetLang,
  onRetry,
}: {
  segment: Segment;
  targetLang: string;
  onRetry: (id: string) => void;
}) {
  if (segment.translated === FAILED) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <p className="text-[15px] text-rose-300">Translation failed</p>
        <button
          onClick={() => onRetry(segment.segmentId)}
          aria-label="Retry translation"
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
    <p
      dir={dirFor(segment.targetLang ?? targetLang)}
      className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-white"
    >
      {segment.translated}
    </p>
  );
}

function SourceTarget({
  direction,
  sourceLang,
  targetLang,
}: {
  direction?: string | null;
  sourceLang: string | null;
  targetLang: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
      <GlobeIcon className="h-3.5 w-3.5 text-accent" />
      {direction ?? (sourceLang ? `${sourceLang} → ${targetLang}` : targetLang)}
    </div>
  );
}

function EmptyState({ status, mode }: { status: StreamStatus; mode: Mode }) {
  const live = status === "live";
  const conv = mode === "conversation";
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
        {live ? "Listening…" : conv ? "Ready to interpret" : "Ready to translate"}
      </p>
      <p className="mt-1.5 max-w-[16rem] text-[14px] leading-relaxed text-zinc-500">
        {conv
          ? "Speak in either language — each turn is translated into the other and spoken aloud."
          : "Speak in any language and the translation appears here instantly."}
      </p>
    </div>
  );
}
