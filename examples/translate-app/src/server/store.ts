import type { ServerResponse } from "node:http";
import { DEFAULT_LANGUAGE } from "./languages.js";

const MAX_HISTORY = 80;

/** A transcript segment plus its translation (null until the model returns). */
export interface Segment {
  segmentId: string;
  original: string;
  translated: string | null;
  isFinal: boolean;
}

interface UserSession {
  /** Target language for this user (applies to future segments). */
  targetLang: string;
  /** Recent segments, capped at MAX_HISTORY. */
  segments: Segment[];
  /** Open SSE responses for this user's webview(s). */
  listeners: Set<ServerResponse>;
}

/**
 * In-memory bridge between the glasses session and the webview, keyed by SeeIt
 * user ID. The `GlassAppServer` side upserts segments as transcription +
 * translation arrive; the SSE endpoint streams them to the browser.
 */
class SessionStore {
  private readonly sessions = new Map<string, UserSession>();

  private get(userId: string): UserSession {
    let s = this.sessions.get(userId);
    if (!s) {
      s = { targetLang: DEFAULT_LANGUAGE, segments: [], listeners: new Set() };
      this.sessions.set(userId, s);
    }
    return s;
  }

  getLanguage(userId: string): string {
    return this.get(userId).targetLang;
  }

  setLanguage(userId: string, lang: string): void {
    this.get(userId).targetLang = lang;
  }

  /** Insert or replace a segment (by id) and fan it out to connected webviews. */
  upsertSegment(userId: string, seg: Segment): void {
    const s = this.get(userId);
    const idx = s.segments.findIndex((x) => x.segmentId === seg.segmentId);
    if (idx === -1) {
      s.segments.push(seg);
      if (s.segments.length > MAX_HISTORY) s.segments.shift();
    } else {
      s.segments[idx] = seg;
    }

    const frame = `data: ${JSON.stringify(seg)}\n\n`;
    for (const res of s.listeners) res.write(frame);
  }

  /** Segments buffered so far (used to backfill a freshly-opened webview). */
  history(userId: string): Segment[] {
    return this.sessions.get(userId)?.segments ?? [];
  }

  addListener(userId: string, res: ServerResponse): void {
    this.get(userId).listeners.add(res);
  }

  removeListener(userId: string, res: ServerResponse): void {
    this.sessions.get(userId)?.listeners.delete(res);
  }
}

export const store = new SessionStore();
