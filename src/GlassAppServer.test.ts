import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { GlassAppServer } from './GlassAppServer.js';
import type { GlassAppSession } from './GlassAppSession.js';

const SECRET = `whsec_${'a1b2c3d4'.repeat(8)}`;

class TestApp extends GlassAppServer {
  readonly sessions: string[] = [];

  protected async onSession(session: GlassAppSession): Promise<void> {
    this.sessions.push(session.userId);
  }
}

const glass = new TestApp({ webhookSecret: SECRET, maxWebhookBodyBytes: 1024 });

// Drive handleWebhookRequest through a real socket rather than a fake req/res —
// it is the streaming body path that the signature depends on. Port 0 avoids
// the port coupling that start() would impose.
let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((req, res) => void glass.handleWebhookRequest(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function sign(timestamp: number, body: string, secret = SECRET) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function post(body: string, opts: { secret?: string; signed?: boolean } = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.signed !== false) {
    headers['x-seeit-timestamp'] = String(timestamp);
    headers['x-seeit-signature'] =
      `v1=${sign(timestamp, body, opts.secret ?? SECRET)}`;
  }
  return fetch(origin, { method: 'POST', headers, body });
}

describe('constructor', () => {
  test('rejects a missing webhookSecret', () => {
    // @ts-expect-error — exercising the runtime guard for JS callers
    expect(() => new TestApp({})).toThrow(/webhookSecret is required/);
    // @ts-expect-error — exercising the runtime guard for JS callers
    expect(() => new TestApp()).toThrow(/webhookSecret is required/);
  });
});

describe('endpoint.verification handshake', () => {
  const challenge = 'ab'.repeat(24);
  const body = JSON.stringify({ type: 'endpoint.verification', challenge });

  test('echoes the challenge when the signature is valid', async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge });
    expect(glass.sessions).toHaveLength(0);
  });

  test('does not echo the challenge when the signature is wrong', async () => {
    const res = await post(body, { secret: `whsec_${'f'.repeat(64)}` });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(challenge);
  });

  test('does not echo the challenge when the request is unsigned', async () => {
    const res = await post(body, { signed: false });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(challenge);
  });

  test('rejects a verification with no challenge field', async () => {
    const res = await post(JSON.stringify({ type: 'endpoint.verification' }));
    expect(res.status).toBe(400);
  });

  test('rejects a verification with an empty challenge', async () => {
    const res = await post(
      JSON.stringify({ type: 'endpoint.verification', challenge: '' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('request handling', () => {
  test('acks an unknown event type without dispatching', async () => {
    const res = await post(JSON.stringify({ type: 'session.paused' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(glass.sessions).toHaveLength(0);
  });

  test('rejects malformed JSON that is correctly signed', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
  });

  test('rejects a body over maxWebhookBodyBytes', async () => {
    const body = JSON.stringify({
      type: 'session.paused',
      pad: 'x'.repeat(4096),
    });
    const res = await post(body);
    expect(res.status).toBe(413);
    expect(glass.sessions).toHaveLength(0);
  });
});

describe('pre-consumed request bodies', () => {
  // express.raw() and similar leave the bytes on req.body; those are still
  // verifiable, so the handler must use them instead of reading the stream.
  test('verifies a raw Buffer left on req.body by a body parser', async () => {
    const challenge = 'cd'.repeat(24);
    const body = JSON.stringify({ type: 'endpoint.verification', challenge });
    const timestamp = Math.floor(Date.now() / 1000);

    const parsed = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        (req as { body?: unknown }).body = Buffer.concat(chunks);
        void glass.handleWebhookRequest(req, res);
      });
    });
    await new Promise<void>((resolve) => parsed.listen(0, resolve));
    const port = (parsed.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seeit-timestamp': String(timestamp),
          'x-seeit-signature': `v1=${sign(timestamp, body)}`,
        },
        body,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ challenge });
    } finally {
      await new Promise<void>((resolve) => parsed.close(() => resolve()));
    }
  });

  test('reports a misconfiguration when the body was parsed away', async () => {
    const body = JSON.stringify({ type: 'session.paused' });
    const timestamp = Math.floor(Date.now() / 1000);

    // The express.json() mistake: stream drained, only an object left behind.
    const drained = createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        (req as { body?: unknown }).body = { type: 'session.paused' };
        void glass.handleWebhookRequest(req, res);
      });
    });
    await new Promise<void>((resolve) => drained.listen(0, resolve));
    const port = (drained.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seeit-timestamp': String(timestamp),
          'x-seeit-signature': `v1=${sign(timestamp, body)}`,
        },
        body,
      });
      // 500, not 401 — the endpoint is misconfigured, not under attack.
      expect(res.status).toBe(500);
    } finally {
      await new Promise<void>((resolve) => drained.close(() => resolve()));
    }
  });
});
