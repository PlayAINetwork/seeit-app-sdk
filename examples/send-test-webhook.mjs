#!/usr/bin/env node
/**
 * Send a correctly signed webhook to a locally running example.
 *
 * Deliveries from SeeIt are signed `HMAC-SHA256(secret, "<timestamp>.<body>")`
 * and the SDK rejects anything else, so a plain `curl` can no longer stand in
 * for the backend. This does the signing for you.
 *
 * Usage:
 *   node examples/send-test-webhook.mjs endpoint.verification
 *   node examples/send-test-webhook.mjs session.started
 *   node examples/send-test-webhook.mjs session.ended
 *
 * Environment:
 *   WEBHOOK_URL     default http://localhost:5001/webhook
 *   WEBHOOK_SECRET  default whsec_localdev (match what the example was started with)
 */
import { createHmac } from 'node:crypto';

const [type = 'session.started'] = process.argv.slice(2);
const url = process.env.WEBHOOK_URL ?? 'http://localhost:5001/webhook';
const secret = process.env.WEBHOOK_SECRET ?? 'whsec_localdev';

const bodies = {
  'endpoint.verification': {
    type: 'endpoint.verification',
    challenge: 'ab'.repeat(24),
  },
  'session.started': {
    type: 'session.started',
    appId: 'my-app',
    userId: 'user-1',
    roomId: 'room-123',
    relayUrl: 'wss://relay.example.com',
    relayToken: '<relay-token>',
    timestamp: new Date().toISOString(),
  },
  'session.ended': {
    type: 'session.ended',
    appId: 'my-app',
    userId: 'user-1',
    timestamp: new Date().toISOString(),
  },
};

const payload = bodies[type];
if (!payload) {
  console.error(
    `Unknown event type ${JSON.stringify(type)}. Expected one of: ${Object.keys(bodies).join(', ')}`,
  );
  process.exit(1);
}

const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-seeit-timestamp': String(timestamp),
    'x-seeit-signature': `v1=${signature}`,
  },
  body,
});

console.log(`${res.status} ${res.statusText}`);
console.log(await res.text());

// session.started makes the SDK dial relayUrl, which won't resolve here — the
// 200 above only confirms the signature and routing were accepted.
if (!res.ok) process.exit(1);
