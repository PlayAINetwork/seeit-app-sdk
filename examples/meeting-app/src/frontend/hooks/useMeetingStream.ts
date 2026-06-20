import { useCallback, useEffect, useRef, useState } from "react";
import type { Insights, Segment } from "../lib/types.js";

export type StreamStatus =
  | "connecting"
  | "live"
  | "idle"
  | "reconnecting"
  | "offline";

export interface ActiveSession {
  sessionId: string;
  startedAt: number;
  recording: boolean;
}

type StreamEvent =
  | {
      type: "session";
      sessionId: string;
      startedAt: number;
      endedAt: number | null;
      recording: boolean;
    }
  | { type: "segment"; sessionId: string; segment: Segment }
  | { type: "insights"; sessionId: string; insights: Insights };

const MAX_BACKOFF = 8_000;
const OFFLINE_AFTER = 4;

/**
 * Subscribe to the live meeting SSE stream (transcript + notes) with automatic,
 * backing-off reconnection. The server backfills the session header, latest
 * insights, and segments on every (re)connect.
 */
export function useMeetingStream(token: string | undefined) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const connect = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;

    esRef.current?.close();
    const es = new EventSource(`/api/transcripts?token=${encodeURIComponent(t)}`);
    esRef.current = es;

    es.onopen = () => {
      attemptsRef.current = 0;
      setStatus((s) => (s === "live" ? s : "idle"));
    };

    es.onmessage = (e) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(e.data) as StreamEvent;
      } catch {
        return;
      }

      if (event.type === "session") {
        if (sessionIdRef.current !== event.sessionId) {
          sessionIdRef.current = event.sessionId;
          setSegments([]);
          setInsights(null);
        }
        setSession({
          sessionId: event.sessionId,
          startedAt: event.startedAt,
          recording: event.recording,
        });
        setStatus(event.recording ? "live" : "idle");
        return;
      }

      if (event.type === "insights") {
        setInsights(event.insights);
        return;
      }

      // segment
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.segmentId === event.segment.segmentId);
        if (idx === -1) return [...prev, event.segment];
        const next = prev.slice();
        next[idx] = event.segment;
        return next;
      });
    };

    es.onerror = () => {
      es.close();
      attemptsRef.current += 1;
      setStatus(attemptsRef.current >= OFFLINE_AFTER ? "offline" : "reconnecting");
      const delay = Math.min(MAX_BACKOFF, 600 * 2 ** (attemptsRef.current - 1));
      timerRef.current = setTimeout(connect, delay);
    };
  }, []);

  const reconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptsRef.current = 0;
    setStatus("connecting");
    connect();
  }, [connect]);

  useEffect(() => {
    if (!token) return;
    setStatus("connecting");
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, connect]);

  return { segments, insights, session, status, reconnect };
}
