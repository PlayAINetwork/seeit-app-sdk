import type { ServerResponse } from "node:http";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_LANG_A,
  DEFAULT_LANG_B,
  type Mode,
} from "./languages.js";

/** How many past sessions to keep per user (in memory). */
const MAX_SESSIONS = 25;
/** How many segments to keep per session. */
const MAX_SEGMENTS = 500;

/** A transcript segment plus its translation (null until the model returns). */
export interface Segment {
  segmentId: string;
  original: string;
  translated: string | null;
  /** Detected source language display name, e.g. "Spanish" (null if unknown). */
  sourceLang: string | null;
  /** Per-segment target language (conversation mode); null for one-way. */
  targetLang?: string | null;
  /** Direction badge, e.g. "ES → HI" (conversation mode only). */
  direction?: string | null;
  isFinal: boolean;
}

export interface Settings {
  mode: Mode;
  /** One-way target language. */
  targetLang: string;
  /** Conversation language A. */
  langA: string;
  /** Conversation language B. */
  langB: string;
  /** Speak each final translation back (one-way; conversation always speaks). */
  speakBack: boolean;
}

export interface SessionRecord {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segments: Segment[];
}

export interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segmentCount: number;
  preview: string;
}

export type StreamEvent =
  | {
      type: "session";
      sessionId: string;
      startedAt: number;
      endedAt: number | null;
      live: boolean;
    }
  | { type: "segment"; sessionId: string; segment: Segment }
  | { type: "settings"; settings: Settings };

interface UserState {
  sessions: SessionRecord[];
  current: SessionRecord | null;
  listeners: Set<ServerResponse>;
  settings: Settings;
}

function defaultSettings(): Settings {
  return {
    mode: "oneway",
    targetLang: DEFAULT_LANGUAGE,
    langA: DEFAULT_LANG_A,
    langB: DEFAULT_LANG_B,
    speakBack: true,
  };
}

function summarize(s: SessionRecord): SessionSummary {
  const first = s.segments.find((seg) => seg.isFinal && seg.original.trim());
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    segmentCount: s.segments.filter((seg) => seg.isFinal).length,
    preview: first?.translated?.trim() || first?.original.trim() || "",
  };
}

/**
 * In-memory bridge between the glasses session and the webview, keyed by SeeIt
 * user ID. Transcription + translation are grouped into discrete sessions so the
 * webview can show a live view and browse recent history.
 *
 * (In-memory is fine for a single-process example. History resets on restart.)
 */
class SessionStore {
  private readonly users = new Map<string, UserState>();

  private get(userId: string): UserState {
    let s = this.users.get(userId);
    if (!s) {
      s = {
        sessions: [],
        current: null,
        listeners: new Set(),
        settings: defaultSettings(),
      };
      this.users.set(userId, s);
    }
    return s;
  }

  /** Write to every listener; drop any whose socket has gone away. */
  private broadcast(state: UserState, event: StreamEvent): void {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    const dead: ServerResponse[] = [];
    for (const res of state.listeners) {
      try {
        res.write(frame);
      } catch {
        dead.push(res);
      }
    }
    for (const res of dead) state.listeners.delete(res);
  }

  // --- settings -------------------------------------------------------------

  getSettings(userId: string): Settings {
    return { ...this.get(userId).settings };
  }

  /** Apply a validated patch (validation happens in the API) and broadcast once. */
  updateSettings(userId: string, patch: Partial<Settings>): Settings {
    const state = this.get(userId);
    state.settings = { ...state.settings, ...patch };
    this.broadcast(state, { type: "settings", settings: { ...state.settings } });
    return { ...state.settings };
  }

  // --- sessions -------------------------------------------------------------

  startSession(userId: string, sessionId: string, startedAt: number): void {
    const state = this.get(userId);
    const record: SessionRecord = { sessionId, startedAt, endedAt: null, segments: [] };
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

  /** Insert or replace a segment (by id) within a session, and fan it out. */
  upsertSegment(userId: string, sessionId: string, seg: Segment): void {
    const state = this.get(userId);
    const record =
      state.current?.sessionId === sessionId
        ? state.current
        : state.sessions.find((s) => s.sessionId === sessionId);
    if (!record) return;

    const idx = record.segments.findIndex((x) => x.segmentId === seg.segmentId);
    if (idx === -1) {
      record.segments.push(seg);
      if (record.segments.length > MAX_SEGMENTS) record.segments.shift();
    } else {
      record.segments[idx] = seg;
    }
    this.broadcast(state, { type: "segment", sessionId, segment: seg });
  }

  /** The session a freshly-opened webview should show: live one, else latest. */
  currentOrLatest(userId: string): SessionRecord | null {
    const state = this.users.get(userId);
    if (!state) return null;
    return state.current ?? state.sessions[state.sessions.length - 1] ?? null;
  }

  /** Find a segment in the live session (used by per-segment retry). */
  findInCurrent(userId: string, segmentId: string): Segment | null {
    const state = this.users.get(userId);
    return (
      state?.current?.segments.find((s) => s.segmentId === segmentId) ?? null
    );
  }

  currentSessionId(userId: string): string | null {
    return this.users.get(userId)?.current?.sessionId ?? null;
  }

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

  /** End every open SSE response (used for graceful shutdown). */
  endAllListeners(): void {
    for (const state of this.users.values()) {
      for (const res of state.listeners) {
        try {
          res.end();
        } catch {
          /* already closed */
        }
      }
      state.listeners.clear();
    }
  }

  /** Test helper: wipe all state. */
  __reset(): void {
    this.users.clear();
  }
}

export const store = new SessionStore();
