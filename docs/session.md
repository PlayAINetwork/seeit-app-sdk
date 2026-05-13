# Session API

## Lifecycle

```
User starts app on glasses
        │
        ▼
Backend POSTs session.started
 { type, appId, userId, roomId, url, token, timestamp }
        │
        ▼
SDK connects to LiveKit room
        │
        ▼
onSession(session) called
        │
        ▼
... app logic runs ...
        │
        ▼
User stops app  ──or──  session times out
        │
        ▼
Backend POSTs session.ended
 { type, appId, userId, timestamp }
        │
        ▼
session.disconnect() called automatically
```

---

## `GlassAppSession`

### Properties

| Property | Type | Description |
|---|---|---|
| `sessionId` | `string` | Unique session ID (= `roomId`) |
| `roomId` | `string` | LiveKit room ID |
| `userId` | `string` | SeeIt user ID of the glasses wearer |
| `appId` | `string` | Your registered app ID |
| `isConnected` | `boolean` | Whether the LiveKit room is currently connected |
| `events` | `EventsModule` | Transcription and data-channel events |
| `audio` | `AudioModule` | Audio playback and microphone access |
| `camera` | `CameraModule` | Camera video track |
| `data` | `DataModule` | Raw data channel and RPC |

### Methods

#### `session.on(event, handler): Unsubscribe`

Listen for connection lifecycle events. Returns an unsubscribe function.

```ts
const unsub = session.on("disconnected", () => {
  console.log("Session disconnected");
});

// later:
unsub();
```

Available events: `"disconnected"` | `"reconnected"`

#### `session.disconnect(): Promise<void>`

Manually disconnect from the LiveKit room. Stops any playing audio and
releases all resources. Called automatically on `session.ended`.

---

## Multiple sessions

`GlassAppServer` manages one session per `(appId, userId, roomId)` tuple.
If a new `session.started` arrives for a user who already has an active
session, the stale session is disconnected before the new one is created.
