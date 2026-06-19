import type { ServerResponse } from "node:http";

/** Serializable calm-session state mirrored to the webview over SSE. */
export interface CalmState {
  status: "idle" | "playing";
  soundscapeId: string | null;
  startedAt: number | null;
  endsAt: number | null;
  durationMin: number | null;
  guided: boolean;
  /** Whether the user's glasses are currently connected (can play audio). */
  glassesConnected: boolean;
}

interface UserState {
  calm: CalmState;
  listeners: Set<ServerResponse>;
}

function freshState(): CalmState {
  return {
    status: "idle",
    soundscapeId: null,
    startedAt: null,
    endsAt: null,
    durationMin: null,
    guided: false,
    glassesConnected: false,
  };
}

/**
 * In-memory calm-session state, keyed by SeeIt user ID. The webview reads it via
 * GET /api/state and subscribes to changes over SSE; playback.ts mutates it as
 * sessions start/stop.
 */
class CalmStore {
  private readonly users = new Map<string, UserState>();

  private get(userId: string): UserState {
    let s = this.users.get(userId);
    if (!s) {
      s = { calm: freshState(), listeners: new Set() };
      this.users.set(userId, s);
    }
    return s;
  }

  snapshot(userId: string): CalmState {
    return { ...this.get(userId).calm };
  }

  private broadcast(userId: string): void {
    const s = this.get(userId);
    const frame = `data: ${JSON.stringify(s.calm)}\n\n`;
    for (const res of s.listeners) res.write(frame);
  }

  update(userId: string, patch: Partial<CalmState>): void {
    const s = this.get(userId);
    s.calm = { ...s.calm, ...patch };
    this.broadcast(userId);
  }

  setGlassesConnected(userId: string, connected: boolean): void {
    this.update(userId, { glassesConnected: connected });
  }

  addListener(userId: string, res: ServerResponse): void {
    this.get(userId).listeners.add(res);
  }

  removeListener(userId: string, res: ServerResponse): void {
    this.users.get(userId)?.listeners.delete(res);
  }
}

export const store = new CalmStore();
