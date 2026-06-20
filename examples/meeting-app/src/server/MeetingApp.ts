import { GlassAppServer, GlassAppSession } from "@seeit/app-sdk";
import { store } from "./store.js";
import { scheduleAnalysis } from "./analyze.js";

/**
 * Glass app logic: forward the glasses user's speech into the current meeting —
 * but only while the user has an active recording (started from the webview).
 * The notes (summary, decisions, action items, takeaways, inferred participants)
 * are kept up to date by a debounced LLM pass as the transcript grows.
 *
 * Recording is controlled by the webview via POST /api/start and /api/stop, so
 * transcription that arrives while not recording is ignored.
 */
export class MeetingApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    const userId = session.userId;
    console.log(`[MeetingApp] glasses connected — user=${userId}`);

    const unsubscribe = session.events.onTranscription((t) => {
      const sessionId = store.currentSessionId(userId);
      if (!sessionId) return; // not recording — ignore

      store.append(userId, sessionId, {
        segmentId: t.segmentId,
        text: t.text,
        isFinal: t.isFinal,
      });
      if (t.isFinal) scheduleAnalysis(userId, sessionId);
    });

    session.on("disconnected", () => {
      console.log(`[MeetingApp] glasses disconnected — user=${userId}`);
      unsubscribe();
    });
  }
}
