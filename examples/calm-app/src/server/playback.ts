import type { GlassAppSession } from "@seeit/app-sdk";
import { store } from "./store.js";
import type { Soundscape } from "./soundscapes.js";

/**
 * Drives audio playback on the glasses. The SDK's AudioModule exposes only
 * `playAudio(url)` (fire-and-forget) and `speak(text)` — there is no stop, loop,
 * or "ended" event — so we approximate a continuous session by re-triggering the
 * loop on a timer until the chosen duration elapses, and "stop" simply cancels
 * the schedule (the current clip finishes on its own).
 */

const sessions = new Map<string, GlassAppSession>();
interface Active {
  loop: ReturnType<typeof setInterval>;
  guided: ReturnType<typeof setTimeout>[];
}
const playbacks = new Map<string, Active>();

const GUIDED_INTRO = "Let’s begin. Settle into a comfortable position, and gently soften your gaze.";
const BREATHE_IN = "Breathe in… slowly.";
const BREATHE_OUT = "And breathe out.";
const CUE_INTERVAL_MS = 11_000;

export function registerSession(userId: string, session: GlassAppSession): void {
  sessions.set(userId, session);
  store.setGlassesConnected(userId, true);
}

export function unregisterSession(userId: string): void {
  stop(userId);
  sessions.delete(userId);
  store.setGlassesConnected(userId, false);
}

export function hasSession(userId: string): boolean {
  return sessions.has(userId);
}

/** Begin a calm session: loop `soundscape` for `durationMin`, optional guidance. */
export function start(
  userId: string,
  soundscape: Soundscape,
  durationMin: number,
  guided: boolean,
  audioUrl: string,
): void {
  clearTimers(userId);

  const session = sessions.get(userId);
  if (!session) {
    console.warn(`[calm] no active glasses session for ${userId} — running visual-only`);
  }

  const startedAt = Date.now();
  const endsAt = startedAt + durationMin * 60_000;

  const playOnce = () => {
    try {
      session?.audio.playAudio(audioUrl);
    } catch (err) {
      console.error("[calm] playAudio failed:", (err as Error)?.message ?? err);
    }
  };

  playOnce();
  const loop = setInterval(() => {
    if (Date.now() >= endsAt) {
      stop(userId);
      return;
    }
    playOnce();
  }, soundscape.loopSeconds * 1000);

  const guidedTimers: ReturnType<typeof setTimeout>[] = [];
  if (guided && session) {
    const speak = (text: string) => {
      try {
        session.audio.speak(text);
      } catch {
        /* ignore */
      }
    };
    guidedTimers.push(setTimeout(() => speak(GUIDED_INTRO), 1_500));
    let at = 9_000;
    let inhale = true;
    while (startedAt + at < endsAt) {
      const line = inhale ? BREATHE_IN : BREATHE_OUT;
      guidedTimers.push(setTimeout(() => speak(line), at));
      inhale = !inhale;
      at += CUE_INTERVAL_MS;
    }
  }

  playbacks.set(userId, { loop, guided: guidedTimers });
  store.update(userId, {
    status: "playing",
    soundscapeId: soundscape.id,
    startedAt,
    endsAt,
    durationMin,
    guided,
  });
}

/** Stop the schedule and return to idle (current clip finishes naturally). */
export function stop(userId: string): void {
  clearTimers(userId);
  store.update(userId, {
    status: "idle",
    soundscapeId: null,
    startedAt: null,
    endsAt: null,
    durationMin: null,
    guided: false,
  });
}

function clearTimers(userId: string): void {
  const p = playbacks.get(userId);
  if (!p) return;
  clearInterval(p.loop);
  p.guided.forEach(clearTimeout);
  playbacks.delete(userId);
}
