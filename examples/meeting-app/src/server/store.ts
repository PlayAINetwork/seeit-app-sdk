import type { ServerResponse } from "node:http";
import type { Insights, Segment } from "./types.js";

const MAX_SESSIONS = 25;
const MAX_SEGMENTS = 1000;

export interface SessionRecord {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segments: Segment[];
  insights: Insights | null;
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
  | { type: "insights"; sessionId: string; insights: Insights };

interface UserState {
  sessions: SessionRecord[];
  current: SessionRecord | null;
  listeners: Set<ServerResponse>;
}

function summarize(s: SessionRecord): SessionSummary {
  const first = s.segments.find((t) => t.isFinal && t.text.trim());
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    segmentCount: s.segments.filter((t) => t.isFinal).length,
    preview: s.insights?.summary?.trim() || first?.text.trim() || "",
  };
}

/**
 * In-memory bridge between the glasses meeting and the webview, keyed by SeeIt
 * user ID. Transcription is grouped into discrete meetings; each carries its
 * own LLM-derived `insights` (notes, takeaways, inferred participants).
 *
 * (In-memory is fine for a single-process example. History resets on restart.)
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

  startSession(userId: string, sessionId: string, startedAt: number): void {
    const state = this.get(userId);
    const record: SessionRecord = {
      sessionId,
      startedAt,
      endedAt: null,
      segments: [],
      insights: null,
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

  append(userId: string, sessionId: string, transcript: Segment): void {
    const state = this.get(userId);
    const record =
      state.current?.sessionId === sessionId
        ? state.current
        : state.sessions.find((s) => s.sessionId === sessionId);
    if (!record) return;

    const idx = record.segments.findIndex((t) => t.segmentId === transcript.segmentId);
    if (idx === -1) {
      record.segments.push(transcript);
      if (record.segments.length > MAX_SEGMENTS) record.segments.shift();
    } else {
      record.segments[idx] = transcript;
    }
    this.broadcast(state, { type: "segment", sessionId, segment: transcript });
  }

  setInsights(userId: string, sessionId: string, insights: Insights): void {
    const state = this.get(userId);
    const record =
      state.current?.sessionId === sessionId
        ? state.current
        : state.sessions.find((s) => s.sessionId === sessionId);
    if (!record) return;
    record.insights = insights;
    this.broadcast(state, { type: "insights", sessionId, insights });
  }

  /** Final transcript text for the analyzer (most recent ~8000 chars). */
  finalText(userId: string, sessionId: string): string {
    const record = this.getSession(userId, sessionId);
    if (!record) return "";
    const text = record.segments
      .filter((s) => s.isFinal && s.text.trim())
      .map((s) => s.text.trim())
      .join("\n");
    return text.slice(-8000);
  }

  currentOrLatest(userId: string): SessionRecord | null {
    const state = this.users.get(userId);
    if (!state) return null;
    return state.current ?? state.sessions[state.sessions.length - 1] ?? null;
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
}

export const store = new SessionStore();
