import { GlassAppServer, GlassAppSession } from "@seeit/glass-sdk";
import { store } from "./store.js";
import { translate } from "./translator.js";

/**
 * Glass app logic: stream the user's speech transcription, and translate each
 * segment into their chosen language once it finalizes.
 *
 * Interim segments show the original live; on a final segment we push the
 * original immediately, then translate (OpenAI) and push the translation in.
 */
export class TranslateApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    const userId = session.userId;
    console.log(`[TranslateApp] session started — user=${userId}`);

    const unsubscribe = session.events.onTranscription((t) => {
      if (!t.isFinal) {
        store.upsertSegment(userId, {
          segmentId: t.segmentId,
          original: t.text,
          translated: null,
          isFinal: false,
        });
        return;
      }

      // Final: show the original right away, then fill in the translation.
      store.upsertSegment(userId, {
        segmentId: t.segmentId,
        original: t.text,
        translated: null,
        isFinal: true,
      });

      const lang = store.getLanguage(userId);
      translate(t.text, lang)
        .then((translated) => {
          console.log(`[TranslateApp] → ${lang}: ${translated}`);
          store.upsertSegment(userId, {
            segmentId: t.segmentId,
            original: t.text,
            translated,
            isFinal: true,
          });
        })
        .catch((err) => {
          console.error("[TranslateApp] translate failed:", err?.message ?? err);
          store.upsertSegment(userId, {
            segmentId: t.segmentId,
            original: t.text,
            translated: "(translation failed)",
            isFinal: true,
          });
        });
    });

    session.on("disconnected", () => {
      console.log(`[TranslateApp] session ended — user=${userId}`);
      unsubscribe();
    });
  }
}
