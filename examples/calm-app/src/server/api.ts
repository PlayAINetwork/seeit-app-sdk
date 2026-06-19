import { Router, type Request, type Response } from 'express';
import { verifySessionToken } from '@seeit/app-sdk';
import { store } from './store.js';
import { SOUNDSCAPES, getSoundscape } from './soundscapes.js';
import * as playback from './playback.js';

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

/** The public base URL the glasses use to fetch audio (must be reachable). */
function audioUrl(req: Request, soundscapeId: string): string {
  const base =
    process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host')}`;
  return `${base}/audio/${soundscapeId}.wav`;
}

export const api = Router();

/** The soundscapes the picker offers (public — static manifest). */
api.get('/soundscapes', (_req: Request, res: Response) => {
  res.json({ soundscapes: SOUNDSCAPES });
});

/** Who is the current user? Called by the webview on boot. */
api.get('/me', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json({ userId: claims.userId, name: claims.name ?? null });
});

/** Current calm-session state (status, soundscape, timer, glasses presence). */
api.get('/state', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  res.json(store.snapshot(claims.userId));
});

/** Start a calm session: loop a soundscape on the glasses for `durationMin`. */
api.post('/play', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });

  const soundscape = getSoundscape(String(req.body?.soundscapeId ?? ''));
  if (!soundscape) return res.status(400).json({ error: 'unknown soundscape' });

  const durationMin = Math.min(60, Math.max(1, Number(req.body?.durationMin) || 5));
  const guided = req.body?.guided === true;

  playback.start(claims.userId, soundscape, durationMin, guided, audioUrl(req, soundscape.id));
  res.json(store.snapshot(claims.userId));
});

/** Stop the current calm session. */
api.post('/stop', async (req: Request, res: Response) => {
  const claims = await authenticate(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  playback.stop(claims.userId);
  res.json(store.snapshot(claims.userId));
});

/**
 * Live state stream (Server-Sent Events). `EventSource` can't send an
 * Authorization header, so the token comes in as a `?token=` query param.
 */
api.get('/stream', async (req: Request, res: Response) => {
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
  res.write(`data: ${JSON.stringify(store.snapshot(claims.userId))}\n\n`);

  store.addListener(claims.userId, res);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    store.removeListener(claims.userId, res);
  });
});
