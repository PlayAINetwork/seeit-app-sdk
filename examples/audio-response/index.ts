import { GlassAppServer, GlassAppSession } from '../../src/index.js';

/**
 * Audio response example:
 * - Plays a welcome sound when the session starts
 * - Plays a local beep when the user finishes speaking
 * - Demonstrates remote URL and local file playback
 *
 * Run:
 *   bun run examples/audio-response/index.ts
 */
class AudioResponseApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(`[AudioResponseApp] Session started — ${session.userId}`);

    // Play a welcome chime from a remote URL when the session starts
    session.audio
      .playAudio('https://www.soundjay.com/buttons_c2026/beep-01a.wav', {
        volume: 0.8,
      })
      .catch(console.error);

    // Play a local sound file when the user finishes a sentence
    session.events.onTranscription(async ({ text, isFinal }) => {
      if (!isFinal) return;
      console.log('User said:', text);

      // Example: play a local audio file as acknowledgement
      // Replace with your TTS provider URL for a more dynamic response
      await session.audio
        .playAudio('./sounds/ack.wav', { volume: 1.0 })
        .catch(console.error);
    });

    // Demonstrate looped background audio (stopped after 10 seconds)
    // await session.audio.playAudio("./sounds/ambient.mp3", { loop: true })
    // setTimeout(() => session.audio.stopAudio(), 10_000)

    session.on('disconnected', () => {
      console.log(`[AudioResponseApp] Session ended — ${session.userId}`);
    });
  }
}

const app = new AudioResponseApp({ port: 3000 });
app.start().catch(console.error);
