import type { TranscriptionData } from "@seeit/app-sdk";
import type { ServerResponse } from "node:http";

const MAX_HISTORY = 100;

interface UserSession {
  /** Recent transcript segments, capped at MAX_HISTORY. */
  transcripts: TranscriptionData[];
  /** Open SSE responses listening for this user's transcripts. */
  listeners: Set<ServerResponse>;
}

/**
 * In-memory bridge between the glasses session and the webview.
 *
 * The `GlassAppServer` side writes transcripts here as they arrive; the Express
 * SSE endpoint reads from here and streams them to the user's browser. Keyed by
 * SeeIt user ID, so a user's glasses and their webview line up.
 *
 * (In-memory is fine for a single-process example. For multiple instances, back
 * this with Redis pub/sub or similar.)
 */
class SessionStore {
  private readonly sessions = new Map<string, UserSession>();

  private get(userId: string): UserSession {
    let s = this.sessions.get(userId);
    if (!s) {
      s = { transcripts: [], listeners: new Set() };
      this.sessions.set(userId, s);
    }
    return s;
  }

  /** Record a transcript and fan it out to any connected webviews. */
  append(userId: string, transcript: TranscriptionData): void {
    const s = this.get(userId);
    s.transcripts.push(transcript);
    if (s.transcripts.length > MAX_HISTORY) s.transcripts.shift();

    const frame = `data: ${JSON.stringify(transcript)}\n\n`;
    for (const res of s.listeners) res.write(frame);
  }

  /** Transcripts buffered so far (used to backfill a freshly-opened webview). */
  history(userId: string): TranscriptionData[] {
    return this.sessions.get(userId)?.transcripts ?? [];
  }

  addListener(userId: string, res: ServerResponse): void {
    this.get(userId).listeners.add(res);
  }

  removeListener(userId: string, res: ServerResponse): void {
    this.sessions.get(userId)?.listeners.delete(res);
  }
}

export const store = new SessionStore();
