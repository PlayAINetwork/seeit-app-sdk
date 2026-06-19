import { GlassAppServer, GlassAppSession } from '@seeit/app-sdk';
import { store } from './store.js';

/**
 * Glass app logic: for every session, forward the glasses user's speech
 * transcription into the shared store so the webview can stream it. Each glasses
 * connection becomes a discrete, browsable session in the store.
 *
 * Note we never call `.start()` on this — the webhook is mounted onto the same
 * Express server in `index.ts` via `handleWebhookRequest`, so everything runs on
 * one port.
 */
export class TranscriptApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(
      `[TranscriptApp] session started — user=${session.userId} room=${session.roomId}`,
    );

    store.startSession(session.userId, session.sessionId, Date.now());

    const unsubscribe = session.events.onTranscription((t) => {
      store.append(session.userId, session.sessionId, t);
    });

    session.on('disconnected', () => {
      console.log(`[TranscriptApp] session ended — user=${session.userId}`);
      unsubscribe();
      store.endSession(session.userId, session.sessionId, Date.now());
    });
  }
}
