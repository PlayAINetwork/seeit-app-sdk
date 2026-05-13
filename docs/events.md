# Event Handlers

All event subscription methods return an **`Unsubscribe`** function. Call it to
remove the listener.

---

## `session.events` — `EventsModule`

### `onTranscription(handler): Unsubscribe`

Real-time speech transcription from the glasses user. The glasses device sends
transcription segments as data-channel JSON messages.

```ts
session.events.onTranscription(({ text, isFinal, isUser, segmentId }) => {
  if (!isFinal) return; // interim result — wait for the final one

  if (isUser) {
    console.log("User said:", text);
  } else {
    console.log("Agent said:", text);
  }
});
```

**`TranscriptionData`**

| Field | Type | Description |
|---|---|---|
| `text` | `string` | Transcribed text |
| `isFinal` | `boolean` | `true` = committed segment; `false` = interim |
| `isUser` | `boolean` | `true` = glasses user; `false` = AI agent in the room |
| `segmentId` | `string` | Unique segment identifier |

---

### `onData(handler): Unsubscribe`
### `onData(topic, handler): Unsubscribe`

Listen for raw binary data-channel messages. Optionally filter by topic.

```ts
// All messages
session.events.onData(({ data, topic, senderIdentity }) => {
  const text = new TextDecoder().decode(data);
  console.log(`[${topic ?? "no-topic"}] from ${senderIdentity}: ${text}`);
});

// Topic-filtered
session.events.onData("lk.chat", ({ data }) => {
  console.log("Chat:", new TextDecoder().decode(data));
});
```

**`DataMessage`**

| Field | Type | Description |
|---|---|---|
| `data` | `Uint8Array` | Raw message bytes |
| `topic` | `string \| undefined` | Message topic if set |
| `senderIdentity` | `string` | LiveKit identity of the sender |

---

## `session.data` — `DataModule`

Lower-level data channel and RPC access.

### `data.send(data, options?): Promise<void>`

Send a message to all (or specific) participants.

```ts
// Broadcast a JSON command
await session.data.send(
  JSON.stringify({ type: "ping" }),
  { topic: "app.commands", reliable: true }
);

// Send to a specific participant
await session.data.send(new Uint8Array([1, 2, 3]), {
  destinationIdentities: ["glasses-participant-identity"],
});
```

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `topic` | `string` | — | Topic tag for the message |
| `reliable` | `boolean` | `true` | Reliable (guaranteed) vs. lossy delivery |
| `destinationIdentities` | `string[]` | all | Specific recipient identities |

### `data.onData(handler): Unsubscribe`

Same as `session.events.onData()` but available on the `data` module for
convenience.

### `data.registerRpcMethod(method, handler): Unsubscribe`

Register a method that remote participants can call via LiveKit RPC.

```ts
session.data.registerRpcMethod("get-status", async (payload, callerId) => {
  console.log(`RPC call from ${callerId}:`, payload);
  return JSON.stringify({ status: "ok" });
});
```

### `data.callRpc(targetIdentity, method, payload?): Promise<string>`

Call an RPC method on a remote participant.

```ts
const response = await session.data.callRpc(
  "glasses-participant",
  "request-location",
  "{}"
);
console.log("Location:", response);
```
