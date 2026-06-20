import { store } from "./store.js";
import { analyzeMeeting } from "./analyzer.js";

/** Wait this long after the last final segment before (re)summarizing. */
const DEBOUNCE_MS = 5_000;
/** Don't bother analyzing until there's at least this much transcript. */
const MIN_CHARS = 40;

interface Scheduler {
  sessionId: string;
  timer: ReturnType<typeof setTimeout> | null;
  analyzing: boolean;
  /** New text arrived while a previous analysis was in flight. */
  dirty: boolean;
}

const schedulers = new Map<string, Scheduler>();

/** Debounced re-summary, called as final segments arrive. */
export function scheduleAnalysis(userId: string, sessionId: string): void {
  let s = schedulers.get(userId);
  if (!s) {
    s = { sessionId, timer: null, analyzing: false, dirty: false };
    schedulers.set(userId, s);
  }
  s.sessionId = sessionId;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => void analyze(userId), DEBOUNCE_MS);
}

/** Run a final summary pass immediately (called when the meeting is stopped). */
export async function flushAnalysis(userId: string, sessionId: string): Promise<void> {
  const s = schedulers.get(userId);
  if (s?.timer) clearTimeout(s.timer);
  if (s) s.sessionId = sessionId;
  await analyze(userId, sessionId);
  schedulers.delete(userId);
}

async function analyze(userId: string, forceSessionId?: string): Promise<void> {
  const s = schedulers.get(userId);
  const sessionId = forceSessionId ?? s?.sessionId;
  if (!sessionId) return;

  if (s?.analyzing) {
    s.dirty = true; // coalesce — re-run after the current pass
    return;
  }

  const transcript = store.finalText(userId, sessionId);
  if (transcript.length < MIN_CHARS) return;

  if (s) {
    s.analyzing = true;
    s.dirty = false;
  }
  try {
    const insights = await analyzeMeeting(transcript);
    store.setInsights(userId, sessionId, insights);
    console.log(
      `[meeting] notes updated — ~${insights.participantEstimate} people, ` +
        `${insights.actionItems.length} action items`,
    );
  } catch (err) {
    console.error("[meeting] analyze failed:", (err as Error)?.message ?? err);
  } finally {
    if (s) {
      s.analyzing = false;
      if (s.dirty) scheduleAnalysis(userId, sessionId);
    }
  }
}
