# Glass Webview Example — Live Transcript

A complete [SeeIt Glass](../../README.md) app that streams the glasses user's
speech transcription into a **React webview**, authenticated automatically with
the SeeIt launch handshake. No login screen.

It demonstrates both halves of a webview app:

- **Session side** — `GlassAppServer` connects to the SeeIt relay for the user's
  session and receives live transcription (`session.events.onTranscription`).
- **Webview side** — a React UI opened inside the SeeIt app, signed in via the
  `glass_launch_token` URL param, calling the backend with a session token that's
  verified by `verifySessionToken`.

```
glasses ──speech──▶ TranscriptApp.onSession ──▶ SessionStore
                                                    │
React webview ──SSE /api/transcripts?token=──▶ Express ──verifySessionToken──▶ store
   ▲ reads glass_launch_token, stores userId + sessionToken
```

Everything runs on **one port** — the webhook is mounted onto the Express server
with `glass.handleWebhookRequest(...)` instead of `glass.start()`.

## Project layout

```
src/
  server/
    index.ts          Express app: webhook + /api + static, one port
    TranscriptApp.ts  GlassAppServer subclass → writes transcripts to the store
    store.ts          in-memory userId → transcripts + SSE listeners
    api.ts            GET /api/me, GET /api/transcripts (SSE)
  frontend/
    main.tsx          React entry
    auth.tsx          GlassAuthProvider + useGlassUser (reads glass_launch_token)
    App.tsx           authed → <TranscriptDisplay/>, else "open from SeeIt app"
    components/TranscriptDisplay.tsx   EventSource → live transcript list
```

## Setup

```bash
bun install
cp .env.example .env     # then fill in SEEIT_APP_ID and SEEIT_JWKS_URL
```

| Env var | What it is |
|---|---|
| `PORT` | Express port (default `4000`). |
| `SEEIT_APP_ID` | Your app ID from the developer console. Tokens must carry it as `aud`. |
| `SEEIT_JWKS_URL` | SeeIt's public keys, e.g. `http://localhost:3000/glass/.well-known/jwks.json`. |
| `WEBHOOK_SECRET` | **Required.** The `whsec_…` signing secret from the dev console, shown once at registration. |

## Run

```bash
bun run dev      # Vite UI on :5173 (proxying /api + /webhook) + server on :4000
```

For production (single server serves the built UI + API + webhook):

```bash
bun run build
bun run start    # http://localhost:4000
```

## Register the app

In the SeeIt developer console, point both URLs at this server (same origin):

- **Webhook URL** → `https://<your-host>/webhook`
- **Webview URL** → `https://<your-host>/`

Copy the signing secret shown at registration into `WEBHOOK_SECRET`, deploy,
then verify the endpoint — **no events are delivered until this passes**:

```bash
curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/verify \
  -H "Cookie: $YOUR_SESSION_COOKIE"
```

Changing the webhook URL or rotating the secret clears verification, so re-run
it after either.

For local testing, expose your port with a tunnel (e.g. `ngrok http 4000`) and
use that HTTPS URL for both.

## Try the auth path without glasses

You don't need a device to see the sign-in work. Mint a launch token from the
SeeIt backend (the `signLaunchToken` util) for your `SEEIT_APP_ID`, then open:

```
http://localhost:5173/?glass_launch_token=<token>
```

The header should show the user as **Signed in**. A tampered token shows the
"Open from your SeeIt glasses" screen and `/api/me` returns `401`.

## Caveat: no events until the endpoint is verified

If the webview signs in but no transcripts ever arrive, the endpoint is almost
certainly unverified — SeeIt delivers nothing at all until the ownership
handshake passes. See "Register the app" above.
