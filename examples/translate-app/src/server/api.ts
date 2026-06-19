import { Router, type Request, type Response } from 'express';
import { verifySessionToken } from '@seeit/app-sdk';
import { store } from './store.js';
import { LANGUAGES, isValidLanguage } from './languages.js';
import { runTranslation } from './translateFlow.js';

const appId = process.env.SEEIT_APP_ID ?? '';
const jwksUrl = process.env.SEEIT_JWKS_URL;

if (!appId) {
  console.warn(
    '[api] SEEIT_APP_ID is empty — every token will fail `aud` check.',
  );
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
    console.error('[api] token verify failed:', (err as Error)?.message ?? err);
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

/** Set the target language for this user (applies to future segments). */
api.post('/language', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const lang = String(req.body?.language ?? '');
  if (!isValidLanguage(lang)) {
    return res.status(400).json({ error: 'unsupported language' });
  }
  store.setLanguage(claims.userId, lang);
  console.log(`[api] ${claims.userId} → target language ${lang}`);
  res.json({ language: lang });
});

/** Update settings — currently just the speak-back toggle. */
api.post('/settings', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  if (typeof req.body?.speakBack === 'boolean') {
    store.setSpeakBack(claims.userId, req.body.speakBack);
  }
  res.json({ settings: store.getSettings(claims.userId) });
});

/** Re-run translation for a single segment in the live session. */
api.post('/retry/:id', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const sessionId = store.currentSessionId(claims.userId);
  const seg = store.findInCurrent(claims.userId, req.params.id);
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
 * session token as a `?token=` query param instead. Frames are JSON envelopes
 * (`StreamEvent`): a `session` header, the current `settings`, then `segment`s.
 */
api.get('/transcripts', async (req: Request, res: Response) => {
  const claims = await authenticate(
    typeof req.query.token === 'string' ? req.query.token : undefined,
  );
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.flushHeaders?.();
  res.write(': connected\n\n');

  // Sync settings so a (re)connecting webview reflects the latest language/toggle.
  res.write(
    `data: ${JSON.stringify({ type: 'settings', settings: store.getSettings(claims.userId) })}\n\n`,
  );

  // Backfill the live (or most recent) session.
  const session = store.currentOrLatest(claims.userId);
  if (session) {
    res.write(
      `data: ${JSON.stringify({
        type: 'session',
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        live: session.endedAt === null,
      })}\n\n`,
    );
    for (const segment of session.segments) {
      res.write(
        `data: ${JSON.stringify({ type: 'segment', sessionId: session.sessionId, segment })}\n\n`,
      );
    }
  }

  store.addListener(claims.userId, res);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    store.removeListener(claims.userId, res);
  });
});
