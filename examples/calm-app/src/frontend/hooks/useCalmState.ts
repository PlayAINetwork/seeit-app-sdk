import { useCallback, useEffect, useRef, useState } from "react";
import type { CalmState } from "../lib/types.js";

const IDLE: CalmState = {
  status: "idle",
  soundscapeId: null,
  startedAt: null,
  endsAt: null,
  durationMin: null,
  guided: false,
  glassesConnected: false,
};

const MAX_BACKOFF = 8_000;

/**
 * Subscribe to the calm-session state stream (SSE) with auto-reconnect. The
 * server pushes the full {@link CalmState} on connect and on every change.
 */
export function useCalmState(token: string | undefined) {
  const [state, setState] = useState<CalmState>(IDLE);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const connect = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;

    esRef.current?.close();
    const es = new EventSource(`/api/stream?token=${encodeURIComponent(t)}`);
    esRef.current = es;

    es.onopen = () => {
      attemptsRef.current = 0;
      setConnected(true);
    };
    es.onmessage = (e) => {
      try {
        setState(JSON.parse(e.data) as CalmState);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      es.close();
      setConnected(false);
      attemptsRef.current += 1;
      const delay = Math.min(MAX_BACKOFF, 600 * 2 ** (attemptsRef.current - 1));
      timerRef.current = setTimeout(connect, delay);
    };
  }, []);

  const reconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (!token) return;
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      esRef.current?.close();
    };
  }, [token, connect]);

  return { state, connected, reconnect, setState };
}
