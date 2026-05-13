# Audio & Camera

## Audio — `session.audio`

### `audio.playAudio(source, options?): Promise<void>`

Play audio on the glasses speaker. Resolves when playback finishes.

**`source`** can be:
- A **remote URL** (`http://` or `https://`) — fetched and decoded on-the-fly
- A **local file path** — read from disk and decoded
- A pre-built **`AudioSource`** (advanced — see [publish raw audio](#publish-raw-audio))

```ts
// Remote URL
await session.audio.playAudio("https://example.com/welcome.mp3");

// Local file
await session.audio.playAudio("./sounds/beep.wav");

// With options
await session.audio.playAudio("./sounds/background.mp3", {
  volume: 0.6,
  loop: true,   // loops until stopAudio() is called
});
```

**Supported formats:** anything FFmpeg can decode — MP3, WAV, AAC, OGG, FLAC, etc.

**`PlayAudioOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `volume` | `number` | `1.0` | Playback volume (0 = silent, 1 = full) |
| `loop` | `boolean` | `false` | Loop until `stopAudio()` is called |

---

### `audio.stopAudio(): Promise<void>`

Stop any currently playing audio immediately.

```ts
setTimeout(() => session.audio.stopAudio(), 5000); // stop after 5 s
await session.audio.playAudio("./long-track.mp3", { loop: true });
```

---

### `audio.onAudioTrack(handler): Unsubscribe`

Subscribe to the glasses microphone audio track.

```ts
session.audio.onAudioTrack((track) => {
  console.log("Microphone track received:", track.sid);
  // Use @livekit/rtc-node AudioStream to read PCM frames:
  // const stream = new AudioStream(track);
  // for await (const frame of stream) { ... }
});
```

---

### Publish raw audio (advanced)

For full control — feed your own PCM frames directly into the room:

```ts
import { AudioSource, AudioFrame } from "@livekit/rtc-node";

const source = new AudioSource(48_000, 1);
const track = await session.audio.publishAudio(source);

// Push PCM frames
const frame = AudioFrame.create(48_000, 1, 480);
// ... fill frame.data with Int16 samples ...
await source.captureFrame(frame);

// When done:
await session.audio.unpublishAudio();
```

---

## Camera — `session.camera`

The glasses camera stream is delivered as a LiveKit video track from a
WHIP ingress participant (identity ends with `"-ingress"`).

### `camera.onVideoTrack(handler): Unsubscribe`

Called whenever the glasses camera video track becomes available.

```ts
session.camera.onVideoTrack((track) => {
  console.log("Camera track available:", track.sid);
  // Use @livekit/rtc-node VideoStream to read frames:
  // const stream = new VideoStream(track);
  // for await (const event of stream) {
  //   const frame = event.frame;
  //   // frame.width, frame.height, frame.data (RGBA)
  // }
});
```

> **Note:** The camera stream is only available if the user has granted
> the `"camera"` permission when installing the app, and the glasses are
> actively streaming.
