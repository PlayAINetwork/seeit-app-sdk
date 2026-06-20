import { store } from "./store.js";
import { translateStream } from "./translator.js";
import { detectLanguage } from "./langdetect.js";

/** Coalesce streamed deltas to ~12 updates/sec so SSE isn't flooded. */
const THROTTLE_MS = 80;

/**
 * Run the full translate pipeline for one final segment: detect the source
 * language, show the original immediately, stream the translation in, and
 * (optionally) speak the finished translation back to the glasses.
 *
 * Shared by live transcription (TranslateApp) and the per-segment retry
 * endpoint, so both behave identically.
 */
export async function runTranslation(
  userId: string,
  sessionId: string,
  base: { segmentId: string; original: string },
  opts?: { speak?: (text: string) => void },
): Promise<void> {
  const { targetLang, speakBack } = store.getSettings(userId);
  const sourceLang = detectLanguage(base.original);

  const put = (translated: string | null) =>
    store.upsertSegment(userId, sessionId, {
      segmentId: base.segmentId,
      original: base.original,
      translated,
      sourceLang,
      isFinal: true,
    });

  // Original visible right away with the detected source language.
  put(null);

  let lastEmit = 0;
  try {
    const result = await translateStream(base.original, targetLang, (partial) => {
      const now = Date.now();
      if (now - lastEmit >= THROTTLE_MS) {
        lastEmit = now;
        put(partial);
      }
    });
    put(result || "(no translation)");
    const willSpeak = Boolean(opts?.speak && speakBack && result);
    console.log(`[translate] → ${targetLang}: "${result}" (speak=${willSpeak})`);
    if (willSpeak) opts!.speak!(result);
  } catch (err) {
    console.error("[translate] failed:", (err as Error)?.message ?? err);
    put("(translation failed)");
  }
}
