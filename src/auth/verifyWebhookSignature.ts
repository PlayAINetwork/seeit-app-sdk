import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verification for the webhooks SeeIt delivers to your app.
 *
 * Every delivery carries two headers:
 *
 *   x-seeit-timestamp: 1735689600
 *   x-seeit-signature: v1=<hex hmac-sha256>
 *
 * where the signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. The
 * timestamp is inside the signed string, so a captured request cannot be
 * re-dated without breaking the signature — which is what makes the ±5 minute
 * window real replay protection rather than a formality.
 *
 * {@link GlassAppServer} calls this for you. Use it directly if you receive
 * webhooks on a stack it doesn't cover (Next.js route handlers, Hono, Fastify).
 */

export const SIGNATURE_HEADER = 'x-seeit-signature';
export const TIMESTAMP_HEADER = 'x-seeit-timestamp';

const SIGNATURE_VERSION = 'v1';

/** Matches the backend's `REPLAY_TOLERANCE_SECONDS`. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Node's `req.headers`, or anything with a Fetch-style `get()` — the `Headers`
 * of a Next.js route handler, Hono's `c.req.header`, and so on.
 */
export type WebhookHeaders =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

export type WebhookVerificationFailure =
  | 'missing_signature'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'timestamp_out_of_tolerance'
  | 'invalid_signature';

export type WebhookVerificationResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: WebhookVerificationFailure };

export interface VerifyWebhookSignatureOptions {
  /** Your app's signing secret (`whsec_…`). */
  secret: string;
  /** Replay window in seconds. Default 300, matching the backend. */
  toleranceSeconds?: number;
  /** Unix seconds to compare the timestamp against. Defaults to now. */
  nowSeconds?: number;
}

function readHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (
      (headers as { get(n: string): string | null }).get(name) ?? undefined
    );
  }
  // Node lowercases incoming header names, but be forgiving about hand-built
  // objects. A repeated header arrives as an array; take the first.
  const bag = headers as Record<string, string | string[] | undefined>;
  const value = bag[name] ?? bag[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Verify one webhook delivery against the raw request body.
 *
 * The body must be the **exact bytes** that were received — verify before
 * parsing. Re-serializing a parsed object will not reproduce the signature.
 *
 * @example
 * ```ts
 * const result = verifyWebhookSignature(rawBody, req.headers, secret);
 * if (!result.ok) return res.status(401).send(result.reason);
 * ```
 */
export function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secretOrOptions: string | VerifyWebhookSignatureOptions,
): WebhookVerificationResult {
  const options: VerifyWebhookSignatureOptions =
    typeof secretOrOptions === 'string'
      ? { secret: secretOrOptions }
      : secretOrOptions;
  const tolerance =
    options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;

  const received = readHeader(headers, SIGNATURE_HEADER)?.trim();
  if (!received) return { ok: false, reason: 'missing_signature' };

  const rawTimestamp = readHeader(headers, TIMESTAMP_HEADER)?.trim();
  if (!rawTimestamp) return { ok: false, reason: 'missing_timestamp' };

  // Reject anything that isn't a plain positive integer before Number() gets a
  // chance to be generous with "1e9", " 12 ", "0x10" and friends.
  if (!/^\d{1,15}$/.test(rawTimestamp)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const timestamp = Number(rawTimestamp);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  // Both directions: a future-dated request is as suspect as a stale one.
  if (Math.abs(now - timestamp) > tolerance) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const body =
    typeof rawBody === 'string'
      ? Buffer.from(rawBody, 'utf8')
      : Buffer.from(rawBody);

  // Two updates rather than building `${ts}.${body}` as a string: identical
  // bytes, and the body never round-trips through a string that could mangle
  // it. Sign the timestamp exactly as it arrived, not the parsed number.
  const expected = createHmac('sha256', options.secret)
    .update(`${rawTimestamp}.`, 'utf8')
    .update(body)
    .digest('hex');

  // The backend's own verifier accepts a bare hex signature too; stay in parity.
  const actual = received.startsWith(`${SIGNATURE_VERSION}=`)
    ? received.slice(SIGNATURE_VERSION.length + 1)
    : received;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  // timingSafeEqual throws on a length mismatch, so check length first — a
  // wrong-length signature is a mismatch, not an error.
  if (a.length !== b.length) return { ok: false, reason: 'invalid_signature' };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'invalid_signature' };

  return { ok: true, timestamp };
}
