# Webhooks

SeeIt delivers events to your app by POSTing to the callback URL you register.
Four things are required of that endpoint, and until all four hold, **your app
receives nothing**.

| Requirement | Who does it |
| --- | --- |
| Endpoint is HTTPS, on a public address | You |
| Ownership verified via a challenge | SeeIt asks, the SDK answers |
| Every request's signature verified | The SDK |
| Requests outside a ±5 minute window rejected | The SDK |

---

## 1. HTTPS only

`http://` callback URLs are rejected at registration and never contacted. URLs
that resolve to private or internal addresses are refused too, so a
`localhost` or `10.x` endpoint will not register — use a tunnel (ngrok,
Cloudflare Tunnel) while developing.

## 2. Your signing secret

Format: `whsec_` followed by 64 hex characters.

Creating an app generates a secret, but **the create response does not include
it** — it is stored encrypted and no read endpoint returns it. The only
endpoint that ever hands you plaintext is `rotate-secret`, so getting your
first usable secret means rotating once:

```bash
curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/rotate-secret \
  -H "Cookie: $YOUR_SESSION_COOKIE"
```

```json
{
  "secret": "whsec_...",
  "message": "Store this now — it is not shown again. Re-verify the endpoint before events resume."
}
```

Store it immediately. Rotating **clears verification**, so always verify
(step 3) *after* rotating, not before — and if you lose the secret, your only
recovery is another rotation followed by another verify.

Pass it to the server:

```ts
const app = new MyApp({ webhookSecret: process.env.WEBHOOK_SECRET! });
```

It is required. Without it, an endpoint accepts forged session events from
anyone who learns its URL.

## 3. Verify ownership

Deploy your app first — the endpoint must be live to answer. Then trigger the
handshake:

```bash
curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/verify \
  -H "Cookie: $YOUR_SESSION_COOKIE"
```

This call is authenticated as **you, the app owner** — it uses your developer
account session, not the webhook secret. The developer dashboard has a button
for it. Rate limited to 5 calls per minute.

SeeIt then POSTs a signed challenge to your endpoint:

```json
{ "type": "endpoint.verification", "challenge": "<random hex>" }
```

Your endpoint must reply `200` with the same JSON body it received.
**`GlassAppServer` does this for you** — there is no code to write. It verifies
the signature first, then echoes the received bytes back verbatim; an unverified
challenge is never answered, because that would let anyone who knows your URL
prove "ownership" of it.

If you are handling this yourself, echo the raw body you were sent rather than
building a new object.

Once this succeeds, events start flowing.

## 4. Signature verification

Every delivery carries two headers:

```
x-seeit-timestamp: 1735689600
x-seeit-signature: v1=<hex hmac-sha256>
```

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. Because the
timestamp is inside the signed string, a captured request cannot be re-dated
without breaking the signature — which is what makes the ±5 minute replay
window meaningful.

`GlassAppServer` verifies this on every request and answers 401 on failure.
Requests must be verified against the **raw body, before parsing**; a
re-serialized object will not reproduce the signature. This is why the webhook
route must be registered before any body parser:

```ts
const glass = new MyApp({ webhookSecret: process.env.WEBHOOK_SECRET! });
const app = express();

// BEFORE express.json() — verification needs the raw request stream.
app.post('/webhook', (req, res) => glass.handleWebhookRequest(req, res));
app.use(express.json());
```

If you cannot control that ordering, `express.raw({ type: '*/*' })` on the
webhook route works too — the SDK will use the buffer it leaves behind.

### Verifying on other stacks

`handleWebhookRequest` needs a `node:http` request. On anything else, use the
exported primitive:

```ts
import { verifyWebhookSignature } from '@seeit/app-sdk';

// Next.js route handler
export async function POST(req: Request) {
  const raw = await req.text();          // raw, not req.json()
  const result = verifyWebhookSignature(raw, req.headers, process.env.WEBHOOK_SECRET!);
  if (!result.ok) {
    return new Response(result.reason, { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.type === 'endpoint.verification') {
    // Echo the body back verbatim — don't forget this, or you get
    // "The endpoint did not echo the challenge" and no events ever arrive.
    return new Response(raw, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  // ... handle session.started / session.ended
  return Response.json({ ok: true });
}
```

```ts
// Hono
app.post('/webhook', async (c) => {
  const raw = await c.req.text();
  const result = verifyWebhookSignature(raw, c.req.raw.headers, SECRET);
  if (!result.ok) return c.text(result.reason, 401);
  // ...
});
```

It accepts Node's `req.headers`, a Fetch `Headers`, or anything with `get()`,
and a body as either a string or a `Uint8Array`/`Buffer`. It returns
`{ ok: true, timestamp }` or `{ ok: false, reason }` rather than a bare
boolean, so you can log why a delivery was rejected.

Override the replay window with `{ secret, toleranceSeconds }` if you need to,
though the default matches the backend and you generally shouldn't.

---

## Events

| Type | When |
| --- | --- |
| `endpoint.verification` | You called `/webhook/verify`. Answered by the SDK. |
| `session.started` | A user launched your app. Triggers `onSession()`. |
| `session.ended` | The session stopped. Disconnects the session object. |

Unknown event types are acknowledged with `200` and ignored, so a newer backend
event will not break your app.

---

## Troubleshooting

**"I registered the app but no events arrive."** Almost always step 3 — an
unverified endpoint receives nothing at all, silently. Confirm you called
`/webhook/verify` after the most recent URL or secret change.

When the SDK rejects a delivery it logs the reason. What each one means:

| Reason | Cause |
| --- | --- |
| `invalid_signature` | Wrong secret (rotated but not redeployed?), or the body was modified in transit — a proxy that reformats JSON will do this. |
| `missing_signature` / `missing_timestamp` | Not a SeeIt delivery, or a proxy stripped the headers. |
| `timestamp_out_of_tolerance` | Your server's clock is off by more than 5 minutes, or a genuinely replayed request. Check NTP. |
| `invalid_timestamp` | The timestamp header wasn't a plain integer. |

Other failures:

- **HTTP 500 and "the request body was consumed before the webhook handler ran"**
  — a body parser is mounted ahead of the webhook route. See §4.
- **"The endpoint did not echo the challenge"** — the most common cause is
  running an SDK older than 2.0.0, which has no `endpoint.verification` handler
  and replies `{"ok":true}`. Check the deployed version, not your local one:
  the examples pin the SDK by git commit in `bun.lock` and deploy with a frozen
  lockfile, so a stale lock silently ships the old code. Otherwise: the endpoint
  wasn't reachable, returned non-200, or is behind auth that blocked the
  request. The challenge POST is itself signed, so a wrong secret fails here
  too — and since rotating clears verification, rotate first, redeploy, then
  verify.
- **HTTP 413** — body over 1 MiB. Raise `maxWebhookBodyBytes` if you ever
  legitimately need to.
