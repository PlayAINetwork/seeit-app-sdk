# Glass Translate Example — live speech translation

A [SeeIt Glass](../../README.md) app that **translates the wearer's speech live**.
Open it from the glasses, pick a target language, and as you talk your words are
transcribed (by SeeIt) and translated into that language in a focused, real-time
view.

Built on the same pipeline as [`webview-app`](../webview-app) — transcription →
store → SSE → React — with a translation step (OpenAI `gpt-4o-mini`) and a
language picker.

```
glasses speech ─▶ relay ─▶ TranslateApp.onTranscription ─▶ store (targetLang + segments)
                                   │ interim: original live
                                   │ final:   original → translate(OpenAI) → translation
                                   ▼
React webview ◀─ SSE /api/transcripts ─┘   POST /api/language {language}
```

A segment streamed to the UI is `{ segmentId, original, translated, isFinal }`;
`translated` is `null` until the model returns, then it fills in place.

## Project layout

```
src/
  server/
    index.ts          Express: webhook + /api + static, one port
    TranslateApp.ts   GlassAppServer subclass → translate finals → store
    translator.ts     OpenAI gpt-4o-mini translate()
    languages.ts      the offered target languages
    store.ts          per-user targetLang + segments + SSE listeners
    api.ts            GET /api/transcripts (SSE), POST /api/language, GET /api/languages
  frontend/
    auth.tsx          GlassAuthProvider + useGlassUser
    App.tsx           focus screen + language picker
    components/LanguagePicker.tsx
    components/TranslateView.tsx   EventSource → focus view
```

## Setup

```bash
bun install
cp .env.example .env     # fill in SEEIT_APP_ID, SEEIT_JWKS_URL, OPENAI_API_KEY
```

| Env var | What it is |
|---|---|
| `PORT` | Express port (default `5002`). |
| `SEEIT_APP_ID` | Your app's UUID. Tokens must carry it as `aud`. |
| `SEEIT_JWKS_URL` | SeeIt's public keys, e.g. `http://localhost:3000/glass/.well-known/jwks.json`. |
| `OPENAI_API_KEY` | Used to translate each segment (`gpt-4o-mini`). |
| `WEBHOOK_SECRET` | **Required.** The `whsec_…` signing secret from the dev console, shown once at registration. |

## Run

```bash
bun run dev      # Vite UI on :5173 (proxying /api + /webhook) + server on :5002
```

Production (single server serves the built UI + API + webhook):

```bash
bun run build
bun run start
```

## Register the app

In the SeeIt developer console, point both URLs at this server (same origin) and
mark it **foreground** (so the agent yields while you translate):

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

For local testing, expose the port with a tunnel (e.g. `ngrok http 5002`).

## Use

1. Open the app from your glasses → the webview loads, picker defaults to Spanish.
2. Speak → your words show live; on a natural pause the translation appears in
   the big slot.
3. Tap the language pill to switch — **new** sentences translate to the new
   language (past ones keep their text).

## Conversation mode (two-way interpreter)

Open **Settings → Mode → Conversation** and pick a language pair (A & B, e.g.
Spanish ↔ Hindi). From then on every finalized utterance is auto-detected as A or
B, translated into the **other** language, shown with a direction badge ("ES → HI"),
and **spoken aloud** on the glasses. It runs continuously, alternating direction
turn-by-turn — a real-time interpreter for a dialogue.

Detection uses a single `gpt-4o-mini` JSON call (`{"from","translation"}`), which is
robust even when the two languages share a script (unlike offline detection). Speech
is serialized through a small queue so rapid turns don't slur together.

## API

| Route | Notes |
|---|---|
| `GET /health`, `GET /ready` | Liveness / readiness (503 until `OPENAI_API_KEY` set). Public. |
| `GET /api/me` | User + current `settings`. |
| `GET /api/languages` | Static language list (public). |
| `POST /api/settings` | `{ mode, targetLang, langA, langB, speakBack }` — every present field validated (400 on invalid). |
| `POST /api/language` | One-way target (back-compat). |
| `POST /api/retry/:id` | Re-translate one segment. Rate-limited per user (429). |
| `GET /api/transcripts` (SSE) | Live stream: `settings` → `session` → `segment` frames. |
| `GET /api/sessions[/:id]` | History list + one session. |

## Tests

```bash
bun test       # unit tests: translator, store, langdetect, conversation routing, speak queue
```

Tests inject a fake OpenAI client (`__setOpenAIForTests`) so they never hit the network.

## Notes

- Translation is **per sentence** (each finalized segment), so it has no
  cross-sentence context — fine for live captions, not literary translation.
- The relay only delivers the **user's** speech, so the agent's voice never gets
  translated.

### Known limitations (intentional for an example)

- **In-memory store** — history/settings reset on restart; single-process only (no
  Redis/horizontal scaling).
- **No metrics/observability** beyond logs; **no real persistence**.
- The speak-queue gap is **heuristic** — the SDK's `speak()` gives no
  "finished speaking" signal, so a long utterance can still overlap the next.
- The SDK's published `dist` typings cause three pre-existing `typecheck` errors
  (constructor / `handleWebhookRequest` / `onTranscription` typed `any`); they don't
  affect runtime or build.
