import { Router, type Request, type Response } from 'express';
import { verifySessionToken } from '@seeit/app-sdk';
import { store } from './store.js';

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

/**
 * Who is the current user? Called by the webview right after it boots with the
 * `Authorization: Bearer <sessionToken>` header.
 */
api.get('/me', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({ userId: claims.userId, name: claims.name ?? null });
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
 * Live transcript stream (Server-Sent Events).
 *
 * `EventSource` can't send an Authorization header, so the webview passes the
 * session token as a `?token=` query param instead. Frames are JSON envelopes
 * (`StreamEvent`): a `session` header followed by `segment` events.
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

  // Flush headers + an initial byte so the browser fires `onopen` immediately.
  res.flushHeaders?.();
  res.write(': connected\n\n');

  // Backfill the live (or most recent) session so a freshly-opened or
  // reconnecting webview lands on the right content.
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

  // Heartbeat so proxies don't drop an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    store.removeListener(claims.userId, res);
  });
});
