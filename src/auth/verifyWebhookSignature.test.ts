import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from './verifyWebhookSignature.js';

const SECRET = `whsec_${'a1b2c3d4'.repeat(8)}`;
const NOW = 1735689600;

/**
 * The backend's formula, written out independently of the implementation under
 * test (backend/src/util/webhook.ts `signPayload`). If these two ever disagree,
 * every delivery 401s in production — which is exactly the bug this suite exists
 * to catch.
 */
function sign(timestamp: number | string, body: string, secret = SECRET) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function headers(timestamp: number | string, signature: string) {
  return {
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: `v1=${signature}`,
  };
}

const BODY = JSON.stringify({
  type: 'session.started',
  appId: 'app-1',
  userId: 'user-1',
});

describe('verifyWebhookSignature', () => {
  test('accepts a valid signature', () => {
    const result = verifyWebhookSignature(BODY, headers(NOW, sign(NOW, BODY)), {
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result).toEqual({ ok: true, timestamp: NOW });
  });

  test('rejects a body tampered by one byte', () => {
    const signature = sign(NOW, BODY);
    const tampered = BODY.replace('user-1', 'user-2');
    expect(tampered).not.toBe(BODY);

    const result = verifyWebhookSignature(tampered, headers(NOW, signature), {
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  test('rejects a correct body signed with the wrong secret', () => {
    const signature = sign(NOW, BODY, `whsec_${'f'.repeat(64)}`);
    const result = verifyWebhookSignature(BODY, headers(NOW, signature), {
      secret: SECRET,
      nowSeconds: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  describe('replay window', () => {
    const at = (timestamp: number) =>
      verifyWebhookSignature(BODY, headers(timestamp, sign(timestamp, BODY)), {
        secret: SECRET,
        nowSeconds: NOW,
      });

    test('accepts just inside the window', () => {
      expect(at(NOW - (DEFAULT_WEBHOOK_TOLERANCE_SECONDS - 1)).ok).toBe(true);
    });

    test('rejects just outside the window', () => {
      expect(at(NOW - (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1))).toEqual({
        ok: false,
        reason: 'timestamp_out_of_tolerance',
      });
    });

    test('rejects a future-dated request', () => {
      expect(at(NOW + (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1))).toEqual({
        ok: false,
        reason: 'timestamp_out_of_tolerance',
      });
    });

    test('honours a custom tolerance', () => {
      const timestamp = NOW - 600;
      const result = verifyWebhookSignature(
        BODY,
        headers(timestamp, sign(timestamp, BODY)),
        { secret: SECRET, nowSeconds: NOW, toleranceSeconds: 900 },
      );
      expect(result.ok).toBe(true);
    });

    test('defaults to 300 seconds, matching the backend', () => {
      expect(DEFAULT_WEBHOOK_TOLERANCE_SECONDS).toBe(300);
    });
  });

  describe('missing or malformed headers', () => {
    test('missing signature', () => {
      const result = verifyWebhookSignature(
        BODY,
        { [TIMESTAMP_HEADER]: String(NOW) },
        { secret: SECRET, nowSeconds: NOW },
      );
      expect(result).toEqual({ ok: false, reason: 'missing_signature' });
    });

    test('missing timestamp', () => {
      const result = verifyWebhookSignature(
        BODY,
        { [SIGNATURE_HEADER]: `v1=${sign(NOW, BODY)}` },
        { secret: SECRET, nowSeconds: NOW },
      );
      expect(result).toEqual({ ok: false, reason: 'missing_timestamp' });
    });

    // Number() would happily accept every one of these.
    test.each(['abc', '', '12.5', '1e9', '-5', ' 17356 89600', '0x10'])(
      'rejects non-integer timestamp %p',
      (timestamp) => {
        const result = verifyWebhookSignature(
          BODY,
          {
            [TIMESTAMP_HEADER]: timestamp,
            [SIGNATURE_HEADER]: `v1=${sign(timestamp, BODY)}`,
          },
          { secret: SECRET, nowSeconds: NOW },
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        // An empty string is indistinguishable from an absent header.
        expect(
          timestamp === ''
            ? ['missing_timestamp', 'invalid_timestamp']
            : ['invalid_timestamp'],
        ).toContain(result.reason);
      },
    );
  });

  describe('signature encoding', () => {
    test('accepts bare hex without the v1= prefix, like the backend does', () => {
      const result = verifyWebhookSignature(
        BODY,
        {
          [TIMESTAMP_HEADER]: String(NOW),
          [SIGNATURE_HEADER]: sign(NOW, BODY),
        },
        { secret: SECRET, nowSeconds: NOW },
      );
      expect(result.ok).toBe(true);
    });

    test.each([
      ['truncated', (s: string) => s.slice(0, 32)],
      ['over-long', (s: string) => `${s}00`],
      ['empty', () => ''],
      ['not hex', () => 'z'.repeat(64)],
    ])('rejects a %s signature without throwing', (_label, mangle) => {
      const result = verifyWebhookSignature(
        BODY,
        headers(NOW, mangle(sign(NOW, BODY))),
        { secret: SECRET, nowSeconds: NOW },
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('header and body shapes', () => {
    test('reads a repeated header delivered as an array', () => {
      const result = verifyWebhookSignature(
        BODY,
        {
          [TIMESTAMP_HEADER]: [String(NOW)],
          [SIGNATURE_HEADER]: [`v1=${sign(NOW, BODY)}`],
        },
        { secret: SECRET, nowSeconds: NOW },
      );
      expect(result.ok).toBe(true);
    });

    test('reads a Fetch Headers object', () => {
      const fetchHeaders = new Headers({
        [TIMESTAMP_HEADER]: String(NOW),
        [SIGNATURE_HEADER]: `v1=${sign(NOW, BODY)}`,
      });
      const result = verifyWebhookSignature(BODY, fetchHeaders, {
        secret: SECRET,
        nowSeconds: NOW,
      });
      expect(result.ok).toBe(true);
    });

    test('treats a string body and a Buffer body identically', () => {
      const h = headers(NOW, sign(NOW, BODY));
      const opts = { secret: SECRET, nowSeconds: NOW };
      expect(verifyWebhookSignature(Buffer.from(BODY, 'utf8'), h, opts)).toEqual(
        verifyWebhookSignature(BODY, h, opts),
      );
    });

    test('accepts a bare secret string as the third argument', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = verifyWebhookSignature(
        BODY,
        headers(now, sign(now, BODY)),
        SECRET,
      );
      expect(result.ok).toBe(true);
    });
  });

  test('matches the backend byte-for-byte on a multi-byte UTF-8 body', () => {
    // A body whose UTF-8 length differs from its UTF-16 length — the case where
    // a careless Buffer/string round-trip silently changes the digest.
    const body = JSON.stringify({
      type: 'session.started',
      note: 'नमस्ते — 你好 — 🎧 café',
    });
    expect(Buffer.byteLength(body, 'utf8')).not.toBe(body.length);

    const result = verifyWebhookSignature(
      body,
      headers(NOW, sign(NOW, body)),
      { secret: SECRET, nowSeconds: NOW },
    );
    expect(result.ok).toBe(true);
  });
});
