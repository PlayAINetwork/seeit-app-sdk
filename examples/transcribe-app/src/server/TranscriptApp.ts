import { GlassAppServer, GlassAppSession } from '@seeit/glass-sdk';
import { store } from './store.js';

/**
 * Glass app logic: for every session, forward the glasses user's speech
 * transcription into the shared store so the webview can stream it.
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

    const unsubscribe = session.events.onTranscription((t) => {
      store.append(session.userId, t);
    });

    session.on('disconnected', () => {
      console.log(`[TranscriptApp] session ended — user=${session.userId}`);
      unsubscribe();
    });
  }
}
