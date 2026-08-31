# Glass Calm — a meditation companion for your glasses

A [SeeIt Glass](../../README.md) app that plays **calming soundscapes in your
ears**. Open it from the glasses, pick a soundscape and a duration, and a gentle
breathing orb guides you while the audio plays on the glasses speaker — with
optional spoken breathing cues.

```
webview ── POST /api/play {soundscapeId, durationMin, guided} ──▶ playback.start
                                                                      │
                              session.audio.playAudio(url)  ◀─────────┤ (loops until duration)
                              session.audio.speak(cue)       ◀────────┘ (if guided)
webview ◀── SSE /api/stream (CalmState: status · soundscape · endsAt · glasses) ──┘
```

## Where the music comes from

The soundscapes are **synthesised to CC0 WAV loops** by
[`src/server/sounds/generate.ts`](src/server/sounds/generate.ts) — built from
noise + oscillators (rain, ocean, forest, night, fireside, deep-calm drone). So
there's **no copyrighted audio and nothing to download**; the files are generated
into `public/audio/` on first boot (and via `bun run generate:sounds`) and served
by Express at `/audio/<id>.wav`.

## How playback works (SDK limits)

The SDK's `AudioModule` exposes only `playAudio(url)` and `speak(text)` — there's
**no stop, loop, or "ended" event**. So this app:

- **loops** by re-triggering `playAudio()` every `loopSeconds` until the chosen
  duration elapses;
- **"stops"** by cancelling that schedule (the current clip finishes naturally);
- **guides** (optional) by speaking breathing cues on a timer over the music.

Because `playAudio(url)` hands the URL to the device, the audio must be **publicly
reachable** — set `PUBLIC_BASE_URL` to your deployed origin (or tunnel URL). With
no glasses connected the app still runs the **visual** breathing session (no
sound), so you can demo the UI locally.

## Project layout

```
src/
  server/
    index.ts          Express: webhook + /api + /audio static + generate sounds on boot
    CalmApp.ts        GlassAppServer subclass → register the live session for playback
    playback.ts       loop playAudio() + speak() cues; start/stop schedules
    soundscapes.ts    the soundscape manifest (id, colour, kind, loop length)
    sounds/generate.ts  procedural CC0 WAV synthesis
    store.ts          per-user CalmState + SSE listeners
    api.ts            /api/soundscapes, /state, /stream (SSE), POST /play, /stop
  frontend/
    App.tsx           immersive screen: orb + timer + controls
    components/Orb.tsx          breathing orb (inhale/exhale animation)
    components/Aurora.tsx       drifting background blobs
    components/SoundscapePicker.tsx
    hooks/useCalmState.ts       reconnecting SSE state
```

## Setup

```bash
bun install
cp .env.example .env     # fill in SEEIT_APP_ID, SEEIT_JWKS_URL, PUBLIC_BASE_URL
```

| Env var | What it is |
|---|---|
| `PORT` | Express port (default `5004`). |
| `SEEIT_APP_ID` | Your app's UUID. Tokens must carry it as `aud`. |
| `SEEIT_JWKS_URL` | SeeIt's public keys, e.g. `http://localhost:3000/glass/.well-known/jwks.json`. |
| `PUBLIC_BASE_URL` | Public origin the **glasses** use to fetch `/audio/*.wav` (your deploy or tunnel URL). |
| `WEBHOOK_SECRET` | **Required.** The `whsec_…` signing secret from the dev console, shown once at registration. |

> Playing audio on the glasses requires **ffmpeg** available to the SeeIt backend
> that fetches the URL (per the SDK's getting-started notes).

## Run

```bash
bun run dev      # Vite UI on :5173 (proxying /api + /webhook + /audio) + server on :5004
```

Production:

```bash
bun run build && bun run start
```

For local testing, expose the port with a tunnel (e.g. `ngrok http 5004`) and set
`PUBLIC_BASE_URL` to the tunnel URL so the glasses can fetch the audio.

## Notes

- Generated audio lives in `public/audio/` and is **gitignored** — it's recreated
  on boot, so it never needs to be committed.
- State is **in-memory**; a server restart ends any active session.
