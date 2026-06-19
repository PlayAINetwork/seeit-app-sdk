import { GlassAppServer, GlassAppSession } from "@seeit/app-sdk";
import { store } from "./store.js";
import { runTranslation } from "./translateFlow.js";

/**
 * Glass app logic: stream the user's speech transcription, translate each final
 * segment into their chosen language (streaming the translation in), and — when
 * the speak-back setting is on — speak the translation back through the glasses.
 *
 * Each glasses connection becomes a discrete, browsable session in the store.
 */
export class TranslateApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    const userId = session.userId;
    const sessionId = session.sessionId;
    console.log(`[TranslateApp] session started — user=${userId}`);

    store.startSession(userId, sessionId, Date.now());

    const unsubscribe = session.events.onTranscription((t) => {
      if (!t.isFinal) {
        // Interim: show the original live, nothing translated yet.
        store.upsertSegment(userId, sessionId, {
          segmentId: t.segmentId,
          original: t.text,
          translated: null,
          sourceLang: null,
          isFinal: false,
        });
        return;
      }

      // Final: hand off to the shared translate pipeline (streams + speaks).
      void runTranslation(
        userId,
        sessionId,
        { segmentId: t.segmentId, original: t.text },
        { speak: (text) => session.audio.speak(text) },
      );
    });

    session.on("disconnected", () => {
      console.log(`[TranslateApp] session ended — user=${userId}`);
      unsubscribe();
      store.endSession(userId, sessionId, Date.now());
    });
  }
}
