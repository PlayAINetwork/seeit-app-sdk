import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStatus =
  | "connecting"
  | "live"
  | "idle"
  | "reconnecting"
  | "offline";

export type Mode = "oneway" | "conversation";

export interface Segment {
  segmentId: string;
  original: string;
  translated: string | null;
  sourceLang: string | null;
  targetLang?: string | null;
  direction?: string | null;
  isFinal: boolean;
}

export interface Settings {
  mode: Mode;
  targetLang: string;
  langA: string;
  langB: string;
  speakBack: boolean;
}

export interface ActiveSession {
  sessionId: string;
  startedAt: number;
  live: boolean;
}

type StreamEvent =
  | {
      type: "session";
      sessionId: string;
      startedAt: number;
      endedAt: number | null;
      live: boolean;
    }
  | { type: "segment"; sessionId: string; segment: Segment }
  | { type: "settings"; settings: Settings };

const MAX_BACKOFF = 8_000;
const OFFLINE_AFTER = 4;

/**
 * Subscribe to the live translation SSE stream with automatic, backing-off
 * reconnection. Also surfaces the server-synced settings (target language +
 * speak-back) so every webview stays in lockstep on (re)connect.
 */
export function useTranslateStream(token: string | undefined) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [authExpired, setAuthExpired] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const probedRef = useRef(false);
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
      probedRef.current = false;
      setStatus((s) => (s === "live" ? s : "idle"));
    };

    es.onmessage = (e) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(e.data) as StreamEvent;
      } catch {
        return;
      }

      if (event.type === "settings") {
        setSettings(event.settings);
        return;
      }

      if (event.type === "session") {
        if (sessionIdRef.current !== event.sessionId) {
          sessionIdRef.current = event.sessionId;
          setSegments([]);
        }
        setSession({
          sessionId: event.sessionId,
          startedAt: event.startedAt,
          live: event.live,
        });
        setStatus(event.live ? "live" : "idle");
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

      // EventSource hides the HTTP status, so once we've been failing for a
      // while, probe /api/me to distinguish "server down" from "token expired".
      if (attemptsRef.current >= OFFLINE_AFTER && !probedRef.current) {
        probedRef.current = true;
        const t = tokenRef.current;
        if (t) {
          fetch("/api/me", { headers: { Authorization: `Bearer ${t}` } })
            .then((r) => {
              if (r.status === 401) setAuthExpired(true);
            })
            .catch(() => {});
        }
      }
    };
  }, []);

  const reconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptsRef.current = 0;
    probedRef.current = false;
    setAuthExpired(false);
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

  return { segments, session, settings, status, authExpired, reconnect, setSettings };
}
