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

const app = new MyApp({ port: 3000 });
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
2. Set the **Webhook URL** to `https://your-server.com/webhook` (the path defaults to `/webhook`).
3. Publish your app.

When a user starts your app on their glasses, the backend will `POST` a `session.started` event to your webhook URL, and `onSession()` will be called automatically.

---

## Configuration

```ts
new MyApp({
  port: 3000,          // Port to listen on (default: 3000)
  webhookPath: "/webhook",   // Path for POST webhook (default: "/webhook")
  webhookSecret: process.env.WEBHOOK_SECRET, // Optional HMAC verification
});
```

### Webhook secret (optional but recommended)

When `webhookSecret` is set, every incoming request must include an
`x-seeit-signature: sha256=<hex>` header. Requests that fail verification
are rejected with HTTP 401.

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
- [Webviews (custom UI)](./webviews.md)
