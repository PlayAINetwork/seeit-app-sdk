import { Router, type Request, type Response } from 'express';
import { verifySessionToken } from '@seeit/app-sdk';
import { store, type Settings } from './store.js';
import { LANGUAGES, isValidLanguage, isValidMode } from './languages.js';
import { runTranslation } from './translateFlow.js';

const appId = process.env.SEEIT_APP_ID ?? '';
const jwksUrl = process.env.SEEIT_JWKS_URL;

if (!appId) {
  console.warn('[api] SEEIT_APP_ID is empty — every token will fail `aud` check.');
}
console.log(
  `[api] verifying tokens with appId=${appId || '(none)'} jwksUrl=${jwksUrl ?? '(default)'}`,
);

/** Verify a token and return the claims, or null if it's invalid/missing. */
async function authenticate(token: string | undefined | null) {
  try {
    return await verifySessionToken(token, {
      appId,
      ...(jwksUrl ? { jwksUrl } : {}),
    });
  } catch (err) {
    // Log the reason internally only; never echo token contents.
    console.error('[api] token verify failed:', (err as Error)?.message ?? 'invalid');
    return null;
  }
}

export const api = Router();

/** The languages the picker offers (public — just a static list). */
api.get('/languages', (_req: Request, res: Response) => {
  res.json({ languages: LANGUAGES });
});

/**
 * Who is the current user + their settings. Called by the webview on boot with
 * `Authorization: Bearer <sessionToken>`.
 */
api.get('/me', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({
    userId: claims.userId,
    name: claims.name ?? null,
    settings: store.getSettings(claims.userId),
  });
});

/** Set the one-way target language. Kept for back-compat with the single picker. */
api.post('/language', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const lang = req.body?.language;
  if (typeof lang !== 'string' || lang.length > 64 || !isValidLanguage(lang)) {
    return res.status(400).json({ error: 'unsupported language' });
  }
  store.updateSettings(claims.userId, { targetLang: lang });
  res.json({ language: lang });
});

/**
 * Update settings: mode (oneway|conversation), one-way target, conversation pair
 * (langA/langB), and speak-back. Every present field is validated; any invalid
 * field rejects the whole request.
 */
api.post('/settings', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<Settings> = {};

  if ('mode' in body) {
    if (typeof body.mode !== 'string' || !isValidMode(body.mode)) {
      return res.status(400).json({ error: 'invalid mode' });
    }
    patch.mode = body.mode;
  }
  for (const key of ['targetLang', 'langA', 'langB'] as const) {
    if (key in body) {
      const v = body[key];
      if (typeof v !== 'string' || v.length > 64 || !isValidLanguage(v)) {
        return res.status(400).json({ error: `invalid ${key}` });
      }
      patch[key] = v;
    }
  }
  if ('speakBack' in body) {
    if (typeof body.speakBack !== 'boolean') {
      return res.status(400).json({ error: 'invalid speakBack' });
    }
    patch.speakBack = body.speakBack;
  }

  const settings = store.updateSettings(claims.userId, patch);
  res.json({ settings });
});

// --- simple per-user token-bucket rate limit for /retry ---------------------
const buckets = new Map<string, { tokens: number; ts: number }>();
function allowRetry(userId: string): boolean {
  const now = Date.now();
  const cap = 5;
  const refillPerSec = 1;
  const b = buckets.get(userId) ?? { tokens: cap, ts: now };
  b.tokens = Math.min(cap, b.tokens + ((now - b.ts) / 1000) * refillPerSec);
  b.ts = now;
  if (b.tokens < 1) {
    buckets.set(userId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(userId, b);
  return true;
}

/** Re-run translation for a single segment in the live session. */
api.post('/retry/:id', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) {
    return res.status(400).json({ error: 'invalid segment id' });
  }
  if (!allowRetry(claims.userId)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const sessionId = store.currentSessionId(claims.userId);
  const seg = store.findInCurrent(claims.userId, id);
  if (!sessionId || !seg) return res.status(404).json({ error: 'not_found' });

  // No speak-back on a manual retry — the user is reading, not listening.
  void runTranslation(claims.userId, sessionId, {
    segmentId: seg.segmentId,
    original: seg.original,
  });
  res.json({ ok: true });
});

/** List the user's recent sessions (most-recent first) for the history view. */
api.get('/sessions', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({ sessions: store.listSessions(claims.userId) });
});

/** Full transcript for one past session (used by history + export). */
api.get('/sessions/:id', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  const session = store.getSession(claims.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json({ session });
});

/**
 * Live translation stream (Server-Sent Events).
 *
 * `EventSource` can't send an Authorization header, so the webview passes the
 * session token as a `?token=` query param (never logged). Frames are JSON
 * envelopes (`StreamEvent`): the current `settings`, a `session` header, then
 * `segment`s.
 */
api.get('/transcripts', async (req: Request, res: Response) => {
  const claims = await authenticate(
    typeof req.query.token === 'string' ? req.query.token : undefined,
  );
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  const userId = claims.userId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    store.removeListener(userId, res);
  };

  const safeWrite = (frame: string): boolean => {
    try {
      res.write(frame);
      return true;
    } catch {
      cleanup();
      return false;
    }
  };

  if (!safeWrite(': connected\n\n')) return;

  // Sync settings so a (re)connecting webview reflects the latest mode/pair/toggle.
  if (
    !safeWrite(
      `data: ${JSON.stringify({ type: 'settings', settings: store.getSettings(userId) })}\n\n`,
    )
  )
    return;

  // Backfill the live (or most recent) session from a stable snapshot.
  const session = store.currentOrLatest(userId);
  if (session) {
    const segs = session.segments.slice();
    if (
      !safeWrite(
        `data: ${JSON.stringify({
          type: 'session',
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          live: session.endedAt === null,
        })}\n\n`,
      )
    )
      return;
    for (const segment of segs) {
      if (
        !safeWrite(
          `data: ${JSON.stringify({ type: 'segment', sessionId: session.sessionId, segment })}\n\n`,
        )
      )
        return;
    }
  }

  store.addListener(userId, res);
  heartbeat = setInterval(() => safeWrite(': ping\n\n'), 15_000);

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});
