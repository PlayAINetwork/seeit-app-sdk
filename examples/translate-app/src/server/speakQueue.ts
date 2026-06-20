/**
 * Per-user serialized speak queue.
 *
 * `session.audio.speak()` is fire-and-forget — the SDK gives no "finished
 * speaking" signal — so we can't await playback. To stop rapid utterances from
 * slurring together (especially in conversation mode), we space them out by a
 * fixed gap. This is heuristic: a long utterance may still overlap the next.
 */

const GAP_MS = 1800;

interface Queue {
  items: string[];
  timer: ReturnType<typeof setTimeout> | null;
  speak: (text: string) => void;
}

const queues = new Map<string, Queue>();

export function enqueueSpeak(
  userId: string,
  text: string,
  speak: (text: string) => void,
): void {
  const t = text.trim();
  if (!t) return;
  let q = queues.get(userId);
  if (!q) {
    q = { items: [], timer: null, speak };
    queues.set(userId, q);
  }
  q.speak = speak; // keep the latest live-session speak fn
  q.items.push(t);
  if (!q.timer) drain(userId);
}

function drain(userId: string): void {
  const q = queues.get(userId);
  if (!q) return;
  const next = q.items.shift();
  if (next === undefined) {
    q.timer = null;
    return;
  }
  try {
    q.speak(next);
  } catch (err) {
    console.error("[speak] failed:", (err as Error)?.message ?? err);
  }
  q.timer = setTimeout(() => drain(userId), GAP_MS);
}

/** Test/shutdown helper. */
export function __clearSpeakQueues(): void {
  for (const q of queues.values()) if (q.timer) clearTimeout(q.timer);
  queues.clear();
}
