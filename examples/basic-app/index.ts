import { GlassAppServer, GlassAppSession } from "../../src/index.js";

/**
 * Basic example: log transcription from the glasses user.
 *
 * Run:
 *   bun run examples/basic-app/index.ts
 *
 * Then POST a mock session.started payload:
 *   curl -X POST http://localhost:3000/webhook \
 *     -H "Content-Type: application/json" \
 *     -d '{"type":"session.started","appId":"my-app","userId":"user-1","roomId":"room-123","url":"wss://live.example.com","token":"<livekit-token>","timestamp":"2024-01-01T00:00:00Z"}'
 */
class BasicApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(
      `[BasicApp] Session started — userId: ${session.userId}, room: ${session.roomId}`
    );

    // Listen for speech transcription from the glasses user
    const unsubTranscription = session.events.onTranscription(
      ({ text, isFinal, isUser }) => {
        if (!isFinal) return;
        const speaker = isUser ? "User" : "Agent";
        console.log(`[${speaker}]: ${text}`);
      }
    );

    // Listen for raw data-channel messages
    session.events.onData(({ data, topic, senderIdentity }) => {
      const decoded = new TextDecoder().decode(data);
      console.log(
        `[Data] from=${senderIdentity} topic=${topic ?? "-"}: ${decoded}`
      );
    });

    // Clean up when session ends
    session.on("disconnected", () => {
      console.log(`[BasicApp] Session ended — userId: ${session.userId}`);
      unsubTranscription();
    });
  }
}

const app = new BasicApp({ port: 3000 });
app.start().catch(console.error);
