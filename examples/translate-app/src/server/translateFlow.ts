import { store } from "./store.js";
import { translateStream, translatePair } from "./translator.js";
import { detectLanguage } from "./langdetect.js";
import { enqueueSpeak } from "./speakQueue.js";
import { langCode } from "./languages.js";

/** Coalesce streamed deltas to ~12 updates/sec so SSE isn't flooded. */
const THROTTLE_MS = 80;

interface SegmentExtra {
  sourceLang: string | null;
  targetLang: string | null;
  direction: string | null;
}

/**
 * Pure: given the pair and which side an utterance came from, produce the
 * display labels (source/target language + direction badge).
 */
export function routeDirection(
  langA: string,
  langB: string,
  from: "A" | "B",
): { sourceLang: string; targetLang: string; direction: string } {
  const sourceLang = from === "A" ? langA : langB;
  const targetLang = from === "A" ? langB : langA;
  return { sourceLang, targetLang, direction: `${langCode(sourceLang)} → ${langCode(targetLang)}` };
}

/**
 * Run the translate pipeline for one final segment. Branches on the user's mode:
 * - one-way: stream a translation into `targetLang`, speak it if speak-back is on.
 * - conversation: detect which language of the pair was spoken, translate into
 *   the other, and always speak the translation aloud (interpreter mode).
 *
 * Shared by live transcription (TranslateApp) and the per-segment retry endpoint.
 */
export async function runTranslation(
  userId: string,
  sessionId: string,
  base: { segmentId: string; original: string },
  opts?: { speak?: (text: string) => void },
): Promise<void> {
  const settings = store.getSettings(userId);
  if (settings.mode === "conversation") {
    return runConversation(userId, sessionId, base, settings.langA, settings.langB, opts);
  }
  return runOneWay(
    userId,
    sessionId,
    base,
    settings.targetLang,
    settings.speakBack,
    opts,
  );
}

function putter(
  userId: string,
  sessionId: string,
  base: { segmentId: string; original: string },
) {
  return (translated: string | null, extra: SegmentExtra) =>
    store.upsertSegment(userId, sessionId, {
      segmentId: base.segmentId,
      original: base.original,
      translated,
      sourceLang: extra.sourceLang,
      targetLang: extra.targetLang,
      direction: extra.direction,
      isFinal: true,
    });
}

async function runOneWay(
  userId: string,
  sessionId: string,
  base: { segmentId: string; original: string },
  targetLang: string,
  speakBack: boolean,
  opts?: { speak?: (text: string) => void },
): Promise<void> {
  const put = putter(userId, sessionId, base);
  const sourceLang = detectLanguage(base.original);
  const extra: SegmentExtra = { sourceLang, targetLang, direction: null };

  put(null, extra); // original visible immediately

  let lastEmit = 0;
  try {
    const result = await translateStream(base.original, targetLang, (partial) => {
      const now = Date.now();
      if (now - lastEmit >= THROTTLE_MS) {
        lastEmit = now;
        put(partial, extra);
      }
    });
    put(result || "(no translation)", extra);
    const willSpeak = Boolean(opts?.speak && speakBack && result);
    console.log(`[translate] → ${targetLang}: "${result}" (speak=${willSpeak})`);
    if (willSpeak && opts?.speak) enqueueSpeak(userId, result, opts.speak);
  } catch (err) {
    console.error("[translate] failed:", (err as Error)?.message ?? err);
    put("(translation failed)", extra);
  }
}

async function runConversation(
  userId: string,
  sessionId: string,
  base: { segmentId: string; original: string },
  langA: string,
  langB: string,
  opts?: { speak?: (text: string) => void },
): Promise<void> {
  const put = putter(userId, sessionId, base);

  // Original visible immediately; direction unknown until detection completes.
  put(null, { sourceLang: null, targetLang: null, direction: null });

  try {
    const pair = await translatePair(base.original, langA, langB);
    if (!pair) {
      put("(translation failed)", { sourceLang: null, targetLang: null, direction: null });
      return;
    }
    const r = routeDirection(langA, langB, pair.from);
    put(pair.translation, r);
    console.log(`[conversation] ${r.direction}: "${pair.translation}"`);
    // Conversation always speaks the translation aloud.
    if (opts?.speak) enqueueSpeak(userId, pair.translation, opts.speak);
  } catch (err) {
    console.error("[conversation] failed:", (err as Error)?.message ?? err);
    put("(translation failed)", { sourceLang: null, targetLang: null, direction: null });
  }
}
