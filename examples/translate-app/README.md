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
| `WEBHOOK_SECRET` | Optional — if set in the dev console. |

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

For local testing, expose the port with a tunnel (e.g. `ngrok http 5002`).

## Use

1. Open the app from your glasses → the webview loads, picker defaults to Spanish.
2. Speak → your words show live; on a natural pause the translation appears in
   the big slot.
3. Tap the language pill to switch — **new** sentences translate to the new
   language (past ones keep their text).

## Notes

- Translation is **per sentence** (each finalized segment), so it has no
  cross-sentence context — fine for live captions, not literary translation.
- The relay only delivers the **user's** speech, so the agent's voice never gets
  translated.
