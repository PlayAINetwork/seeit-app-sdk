import { GlassAppServer, GlassAppSession } from "@seeit/app-sdk";
import { store } from "./store.js";
import { analyzeMeeting } from "./analyzer.js";

/** Wait this long after the last final segment before (re)summarizing. */
const DEBOUNCE_MS = 5_000;
/** Don't bother analyzing until there's at least this much transcript. */
const MIN_CHARS = 40;

interface Scheduler {
  timer: ReturnType<typeof setTimeout> | null;
  analyzing: boolean;
  /** New text arrived while a previous analysis was in flight. */
  dirty: boolean;
}

/**
 * Glass app logic: capture the meeting transcript and, as it grows, keep an
 * up-to-date set of LLM notes (summary, topics, decisions, action items,
 * takeaways) plus an inferred participant count.
 *
 * Analysis is debounced so we summarize on natural pauses rather than on every
 * word, and a final pass runs when the meeting ends.
 */
export class MeetingApp extends GlassAppServer {
  private readonly schedulers = new Map<string, Scheduler>();

  protected async onSession(session: GlassAppSession): Promise<void> {
    const userId = session.userId;
    const sessionId = session.sessionId;
    console.log(`[MeetingApp] meeting started — user=${userId}`);

    store.startSession(userId, sessionId, Date.now());
    this.schedulers.set(sessionId, { timer: null, analyzing: false, dirty: false });

    const unsubscribe = session.events.onTranscription((t) => {
      store.append(userId, sessionId, {
        segmentId: t.segmentId,
        text: t.text,
        isFinal: t.isFinal,
      });
      if (t.isFinal) this.schedule(userId, sessionId);
    });

    session.on("disconnected", () => {
      console.log(`[MeetingApp] meeting ended — user=${userId}`);
      unsubscribe();
      const s = this.schedulers.get(sessionId);
      if (s?.timer) clearTimeout(s.timer);
      // One last summary pass on the full transcript.
      void this.analyze(userId, sessionId);
      store.endSession(userId, sessionId, Date.now());
      this.schedulers.delete(sessionId);
    });
  }

  private schedule(userId: string, sessionId: string): void {
    const s = this.schedulers.get(sessionId);
    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => void this.analyze(userId, sessionId), DEBOUNCE_MS);
  }

  private async analyze(userId: string, sessionId: string): Promise<void> {
    const s = this.schedulers.get(sessionId);
    if (!s) return;
    if (s.analyzing) {
      s.dirty = true; // coalesce — re-run after the current pass
      return;
    }

    const transcript = store.finalText(userId, sessionId);
    if (transcript.length < MIN_CHARS) return;

    s.analyzing = true;
    s.dirty = false;
    try {
      const insights = await analyzeMeeting(transcript);
      store.setInsights(userId, sessionId, insights);
      console.log(
        `[MeetingApp] notes updated — ~${insights.participantEstimate} people, ` +
          `${insights.actionItems.length} action items`,
      );
    } catch (err) {
      console.error("[MeetingApp] analyze failed:", (err as Error)?.message ?? err);
    } finally {
      s.analyzing = false;
      if (s.dirty) this.schedule(userId, sessionId);
    }
  }
}
