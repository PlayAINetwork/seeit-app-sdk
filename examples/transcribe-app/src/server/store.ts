import type { TranscriptionData } from "@seeit/app-sdk";
import type { ServerResponse } from "node:http";

/** How many past sessions to keep per user (in memory). */
const MAX_SESSIONS = 25;
/** How many segments to keep per session. */
const MAX_SEGMENTS = 500;

export interface SessionRecord {
  sessionId: string;
  startedAt: number;
  /** null while the glasses session is still live. */
  endedAt: number | null;
  segments: TranscriptionData[];
}

/** Lightweight summary used by the history list. */
export interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segmentCount: number;
  /** First final line, for a glanceable preview. */
  preview: string;
}

/**
 * Frames pushed over SSE. A small envelope so the webview can tell a new live
 * session apart from an appended segment and reset accordingly.
 */
export type StreamEvent =
  | {
      type: "session";
      sessionId: string;
      startedAt: number;
      endedAt: number | null;
      live: boolean;
    }
  | { type: "segment"; sessionId: string; segment: TranscriptionData };

interface UserState {
  /** Most-recent last. */
  sessions: SessionRecord[];
  /** The live session, if the glasses are currently connected. */
  current: SessionRecord | null;
  listeners: Set<ServerResponse>;
}

function summarize(s: SessionRecord): SessionSummary {
  const firstFinal = s.segments.find((t) => t.isFinal && t.text.trim());
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    segmentCount: s.segments.filter((t) => t.isFinal).length,
    preview: firstFinal?.text.trim() ?? "",
  };
}

/**
 * In-memory bridge between the glasses session and the webview.
 *
 * Transcription is grouped into discrete sessions (one per glasses connection)
 * so the webview can show a live view and browse recent history. Keyed by SeeIt
 * user ID, so a user's glasses and their webview line up.
 *
 * (In-memory is fine for a single-process example. History resets on restart.
 * For multiple instances, back this with Redis pub/sub or similar.)
 */
class SessionStore {
  private readonly users = new Map<string, UserState>();

  private get(userId: string): UserState {
    let s = this.users.get(userId);
    if (!s) {
      s = { sessions: [], current: null, listeners: new Set() };
      this.users.set(userId, s);
    }
    return s;
  }

  private broadcast(state: UserState, event: StreamEvent): void {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of state.listeners) res.write(frame);
  }

  /** Begin a new live session and announce it to connected webviews. */
  startSession(userId: string, sessionId: string, startedAt: number): void {
    const state = this.get(userId);
    const record: SessionRecord = {
      sessionId,
      startedAt,
      endedAt: null,
      segments: [],
    };
    state.sessions.push(record);
    if (state.sessions.length > MAX_SESSIONS) state.sessions.shift();
    state.current = record;

    this.broadcast(state, {
      type: "session",
      sessionId,
      startedAt,
      endedAt: null,
      live: true,
    });
  }

  /** Mark the live session ended. */
  endSession(userId: string, sessionId: string, endedAt: number): void {
    const state = this.users.get(userId);
    if (!state) return;
    const record = state.sessions.find((s) => s.sessionId === sessionId);
    if (record) record.endedAt = endedAt;
    if (state.current?.sessionId === sessionId) state.current = null;

    this.broadcast(state, {
      type: "session",
      sessionId,
      startedAt: record?.startedAt ?? endedAt,
      endedAt,
      live: false,
    });
  }

  /** Record a transcript segment and fan it out to connected webviews. */
  append(userId: string, sessionId: string, transcript: TranscriptionData): void {
    const state = this.get(userId);
    const record =
      state.current?.sessionId === sessionId
        ? state.current
        : state.sessions.find((s) => s.sessionId === sessionId);
    if (!record) return;

    const idx = record.segments.findIndex(
      (t) => t.segmentId === transcript.segmentId,
    );
    if (idx === -1) {
      record.segments.push(transcript);
      if (record.segments.length > MAX_SEGMENTS) record.segments.shift();
    } else {
      record.segments[idx] = transcript;
    }

    this.broadcast(state, { type: "segment", sessionId, segment: transcript });
  }

  /** The session a freshly-opened webview should show: live one, else latest. */
  currentOrLatest(userId: string): SessionRecord | null {
    const state = this.users.get(userId);
    if (!state) return null;
    return state.current ?? state.sessions[state.sessions.length - 1] ?? null;
  }

  /** Past sessions, most-recent first. */
  listSessions(userId: string): SessionSummary[] {
    const state = this.users.get(userId);
    if (!state) return [];
    return [...state.sessions].reverse().map(summarize);
  }

  getSession(userId: string, sessionId: string): SessionRecord | null {
    return (
      this.users.get(userId)?.sessions.find((s) => s.sessionId === sessionId) ??
      null
    );
  }

  addListener(userId: string, res: ServerResponse): void {
    this.get(userId).listeners.add(res);
  }

  removeListener(userId: string, res: ServerResponse): void {
    this.users.get(userId)?.listeners.delete(res);
  }
}

export const store = new SessionStore();
