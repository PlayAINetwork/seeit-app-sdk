import { GlassAppServer, GlassAppSession } from '../../src/index.js';

/**
 * Basic example: log transcription from the glasses user.
 *
 * Run:
 *   bun run examples/basic-app/index.ts
 *
 * Then send it a signed event. Deliveries are HMAC-signed over
 * "<timestamp>.<body>", so a plain curl won't do — use the helper:
 *   node examples/send-test-webhook.mjs endpoint.verification
 *   node examples/send-test-webhook.mjs session.started
 *
 * Both default to the same local dev secret this file uses.
 */
class BasicApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(
      `[BasicApp] Session started — userId: ${session.userId}, room: ${session.roomId}`,
    );

    // Listen for speech transcription from the glasses user
    const unsubTranscription = session.events.onTranscription(
      ({ text, isFinal }) => {
        if (!isFinal) return;
        const speaker = 'User';
        console.log(`[${speaker}]: ${text}`);

        if (text.toLowerCase().includes('helo')) {
          session.speak('Hello! How can I assist you today?');
        }
      },
    );

    // Clean up when session ends
    session.on('disconnected', () => {
      console.log(`[BasicApp] Session ended — userId: ${session.userId}`);
      unsubTranscription();
    });
  }
}

// Local demo only. A real app reads the secret SeeIt issued for it from the
// environment and never falls back to a literal.
const app = new BasicApp({
  webhookSecret: process.env.WEBHOOK_SECRET ?? 'whsec_localdev',
  port: 5001,
});
app.start().catch(console.error);
