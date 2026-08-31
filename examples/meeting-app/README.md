# Glass Meeting Notes — live notes, takeaways & participants

A [SeeIt Glass](../../README.md) app that turns a conversation into **live meeting
notes**. Open it from the glasses, start talking, and as the discussion unfolds it
captures a running transcript and keeps an up-to-date set of notes — summary,
topics, decisions, action items, and key takeaways — plus an **estimate of how
many people are in the room**.

```
glasses speech ─▶ relay ─▶ MeetingApp.onTranscription ─▶ store (segments)
                                   │  (debounced on pauses)
                                   ▼
                          analyzeMeeting() ── OpenAI gpt-4o-mini ──▶ insights
                                   ▼
React webview ◀─ SSE /api/transcripts ─┘   (session · insights · segment frames)
```

## How "participants" works (important)

The SDK's transcription stream carries **no speaker identity or diarization** —
just `{ segmentId, text, isFinal }`. So the participant count and names are
**inferred by the LLM from conversational context** (names, greetings,
turn-taking, "you"/"we", questions/answers), not detected from distinct voices.
Treat the count as a smart estimate, shown as `~N`.

## Project layout

```
src/
  server/
    index.ts          Express: webhook + /api + static, one port
    MeetingApp.ts     GlassAppServer subclass → buffer transcript, debounce-analyze
    analyzer.ts       OpenAI gpt-4o-mini → structured Insights (JSON)
    store.ts          per-user meetings: segments + insights + SSE listeners
    api.ts            GET /api/transcripts (SSE), /api/sessions[/:id], /api/me
    types.ts          Insights / Segment shapes
  frontend/
    App.tsx           Notes / Transcript tabs, participant badge, export
    components/NotesPanel.tsx       summary · topics · decisions · actions · takeaways
    components/TranscriptPanel.tsx  live transcript w/ autoscroll-yield
    components/HistorySheet.tsx     browse past meetings + their notes
    hooks/useMeetingStream.ts       reconnecting SSE (segments + insights)
```

## Setup

```bash
bun install
cp .env.example .env     # fill in SEEIT_APP_ID, SEEIT_JWKS_URL, OPENAI_API_KEY
```

| Env var | What it is |
|---|---|
| `PORT` | Express port (default `5003`). |
| `SEEIT_APP_ID` | Your app's UUID. Tokens must carry it as `aud`. |
| `SEEIT_JWKS_URL` | SeeIt's public keys, e.g. `http://localhost:3000/glass/.well-known/jwks.json`. |
| `OPENAI_API_KEY` | Summarizes the meeting + infers participants (`gpt-4o-mini`). |
| `WEBHOOK_SECRET` | **Required.** The `whsec_…` signing secret. Obtain it with `POST /glass/apps/:appId/webhook/rotate-secret` — no other endpoint returns it. |

## Run

```bash
bun run dev      # Vite UI on :5173 (proxying /api + /webhook) + server on :5003
```

Production (single server serves the built UI + API + webhook):

```bash
bun run build && bun run start
```

## Register the app

In the SeeIt developer console, point both URLs at this server (same origin):

- **Webhook URL** → `https://<your-host>/webhook`
- **Webview URL** → `https://<your-host>/`

Creating the app generates a signing secret but does not show it to you. Call
`rotate-secret` once to get plaintext, put it in `WEBHOOK_SECRET`, deploy, then
verify — **no events are delivered until verification passes**:

```bash
# 1. Get a secret you can read (this is the only endpoint that returns plaintext)
curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/rotate-secret \
  -H "Cookie: $YOUR_SESSION_COOKIE"

# 2. Put it in WEBHOOK_SECRET, deploy, then verify
curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/verify \
  -H "Cookie: $YOUR_SESSION_COOKIE"
```

Changing the webhook URL or rotating the secret clears verification, so re-run
it after either.

For local testing, expose the port with a tunnel (e.g. `ngrok http 5003`).

## Notes

- Notes are re-generated on natural pauses (debounced ~5s after the last final
  segment) and once more when the meeting ends — not on every word.
- History is **in-memory** and resets on server restart (fine for an example).
- Export produces a Markdown notes document (copy / download / share).
