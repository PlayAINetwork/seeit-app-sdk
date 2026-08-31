# Getting Started

## Installation

```bash
npm install @seeit/glass-sdk
# or
bun add @seeit/glass-sdk
```

`ffmpeg` must be available in your system PATH (used by `audio.playAudio()`).

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

---

## Quickstart

Create a file `index.ts`:

```ts
import { GlassAppServer, GlassAppSession } from "@seeit/glass-sdk";

class MyApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession) {
    console.log(`Session started — user: ${session.userId}`);

    session.events.onTranscription(({ text, isFinal }) => {
      if (isFinal) console.log("User said:", text);
    });

    session.on("disconnected", () => {
      console.log("Session ended");
    });
  }
}

const app = new MyApp({
  webhookSecret: process.env.WEBHOOK_SECRET!,
  port: 3000,
});
app.start();
```

Run it:

```bash
npx ts-node index.ts
# or
bun run index.ts
```

---

## Register your app on SeeIt

1. Go to the SeeIt developer dashboard and create an app.
2. Set the **Webhook URL** to `https://your-server.com/webhook` (the path
   defaults to `/webhook`). It must be HTTPS on a public address — use a tunnel
   while developing.
3. **Copy the signing secret.** It is shown once, at registration.
4. Deploy your app with that secret set as `WEBHOOK_SECRET`.
5. **Verify your endpoint** — click Verify in the dashboard, or:

   ```bash
   curl -X POST https://api.seeit.ai/glass/apps/$APP_ID/webhook/verify \
     -H "Cookie: $YOUR_SESSION_COOKIE"
   ```

   SeeIt POSTs a challenge to your endpoint and the SDK answers it
   automatically — no code needed. **Until this succeeds, no events are
   delivered at all.** Changing your webhook URL or rotating the secret clears
   verification, so re-verify after either.
6. Publish your app.

When a user starts your app on their glasses, the backend will `POST` a `session.started` event to your webhook URL, and `onSession()` will be called automatically.

---

## Configuration

```ts
new MyApp({
  webhookSecret: process.env.WEBHOOK_SECRET!, // Required — see below
  port: 3000,                // Port to listen on (default: 3000)
  webhookPath: "/webhook",   // Path for POST webhook (default: "/webhook")
});
```

### Webhook secret (required)

Every webhook SeeIt delivers is signed, and your endpoint must verify it.
Deliveries carry `x-seeit-timestamp` and `x-seeit-signature: v1=<hex>`, where
the signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. The SDK checks
this on every request and rejects failures — and anything outside a ±5 minute
replay window — with HTTP 401.

Without a secret an endpoint would accept forged session events from anyone who
learns its URL, so the constructor throws if it is missing. See
[Webhooks](./webhooks.md) for the full contract, verification on other
frameworks, and troubleshooting.

---

## TypeScript

The SDK ships full TypeScript types — no `@types` package needed.

```ts
import type { TranscriptionData, PlayAudioOptions } from "@seeit/glass-sdk";
```

---

## Next steps

- [Session API](./session.md)
- [Event handlers](./events.md)
- [Audio & Camera](./audio-camera.md)
- [Webhooks (signing, verification)](./webhooks.md)
- [Webviews (custom UI)](./webviews.md)
