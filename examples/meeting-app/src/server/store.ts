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
      /** True while the user is actively recording this meeting. */
      recording: boolean;
    }
  | { type: "segment"; sessionId: string; segment: Segment }
  | { type: "insights"; sessionId: string; insights: Insights };

interface UserState {
  sessions: SessionRecord[];
  current: SessionRecord | null;
  listeners: Set<ServerResponse>;
  recording: boolean;
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
 * user ID. The user starts/stops a recording from the webview; while recording,
 * incoming transcription is appended to the current meeting and summarized.
 *
 * (In-memory is fine for a single-process example. History resets on restart.)
 */
class SessionStore {
  private readonly users = new Map<string, UserState>();
  private counter = 0;

  private get(userId: string): UserState {
    let s = this.users.get(userId);
    if (!s) {
      s = { sessions: [], current: null, listeners: new Set(), recording: false };
      this.users.set(userId, s);
    }
    return s;
  }

  private broadcast(state: UserState, event: StreamEvent): void {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of state.listeners) res.write(frame);
  }

  private sessionEvent(state: UserState, record: SessionRecord): void {
    this.broadcast(state, {
      type: "session",
      sessionId: record.sessionId,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      recording: state.recording && state.current?.sessionId === record.sessionId,
    });
  }

  /** Begin a fresh meeting recording. Returns the new session id. */
  startRecording(userId: string, startedAt: number): string {
    const state = this.get(userId);
    const sessionId = `m-${startedAt}-${++this.counter}`;
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
    state.recording = true;
    this.sessionEvent(state, record);
    return sessionId;
  }

  /** Stop the current recording (the meeting record is kept). */
  stopRecording(userId: string, endedAt: number): void {
    const state = this.users.get(userId);
    if (!state || !state.current) return;
    state.current.endedAt = endedAt;
    state.recording = false;
    this.sessionEvent(state, state.current);
  }

  isRecording(userId: string): boolean {
    return this.users.get(userId)?.recording ?? false;
  }

  currentSessionId(userId: string): string | null {
    const state = this.users.get(userId);
    return state?.recording ? (state.current?.sessionId ?? null) : null;
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

  /** Whether `record` is the one currently being recorded. */
  isActive(userId: string, sessionId: string): boolean {
    const state = this.users.get(userId);
    return !!state?.recording && state.current?.sessionId === sessionId;
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
