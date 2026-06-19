import { GlassAppServer, GlassAppSession } from "@seeit/app-sdk";
import { registerSession, unregisterSession } from "./playback.js";

/**
 * Glass app logic for the meditation companion. Unlike the transcription
 * examples, this app doesn't listen to speech — it just needs a handle on the
 * live session so the webview can drive `audio.playAudio()` / `audio.speak()` on
 * the glasses. We register the session here and release it on disconnect.
 */
export class CalmApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(`[CalmApp] session connected — user=${session.userId}`);
    registerSession(session.userId, session);

    session.on("disconnected", () => {
      console.log(`[CalmApp] session disconnected — user=${session.userId}`);
      unregisterSession(session.userId);
    });
  }
}
