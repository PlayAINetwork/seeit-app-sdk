import { Router, type Request, type Response } from 'express';
import { verifySessionToken } from '@seeit/app-sdk';
import { store } from './store.js';

const appId = process.env.SEEIT_APP_ID ?? '';
const jwksUrl = process.env.SEEIT_JWKS_URL;

if (!appId) {
  console.warn('[api] SEEIT_APP_ID is empty — every token will fail `aud` check.');
}
console.log(
  `[api] verifying tokens with appId=${appId || '(none)'} jwksUrl=${jwksUrl ?? '(default)'}`,
);

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

/** Who is the current user? Called by the webview on boot. */
api.get('/me', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({ userId: claims.userId, name: claims.name ?? null });
});

/** List the user's recent meetings (most-recent first) for the history view. */
api.get('/sessions', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({ sessions: store.listSessions(claims.userId) });
});

/** Full transcript + notes for one past meeting (used by history + export). */
api.get('/sessions/:id', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  const session = store.getSession(claims.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json({ session });
});

/**
 * Live meeting stream (Server-Sent Events): a `session` header, the latest
 * `insights`, then `segment` events. `EventSource` can't send an Authorization
 * header, so the token comes in as a `?token=` query param.
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
    if (session.insights) {
      res.write(
        `data: ${JSON.stringify({ type: 'insights', sessionId: session.sessionId, insights: session.insights })}\n\n`,
      );
    }
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
