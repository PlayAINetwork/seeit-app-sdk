import { AudioStream, AudioSource, AudioFrame } from "@livekit/rtc-node";
import { GlassAppServer, GlassAppSession } from "../../src/index.js";

/**
 * Echo voice app — plays the user's own voice back after a configurable delay.
 *
 * How it works:
 *   1. Opens a speaker output track (AudioSource) immediately on session start.
 *   2. Subscribes to the glasses microphone track.
 *   3. Reads mic audio as a stream of 10ms PCM frames.
 *   4. Buffers DELAY_FRAME_COUNT frames before starting playback.
 *   5. Once the buffer is full, each new incoming frame is pushed to the
 *      speaker while the oldest buffered frame is played — producing a
 *      continuous echo with exactly DELAY_MS milliseconds of delay.
 *
 * Run:
 *   bun run examples/echo-app/index.ts
 *
 * Adjust DELAY_MS to change the echo delay (minimum ~100ms).
 */

const DELAY_MS = 1000; // milliseconds of echo delay
const FRAME_MS = 10; // AudioStream default frame duration
const DELAY_FRAME_COUNT = Math.round(DELAY_MS / FRAME_MS); // 100 frames @ 1 s

const SAMPLE_RATE = 48_000;
const NUM_CHANNELS = 1;

class EchoApp extends GlassAppServer {
  protected async onSession(session: GlassAppSession): Promise<void> {
    console.log(
      `[EchoApp] Session started — user: ${session.userId} | delay: ${DELAY_MS}ms`
    );

    // Open the speaker output immediately so we can push frames into it
    const speaker = new AudioSource(SAMPLE_RATE, NUM_CHANNELS);
    await session.audio.publishAudio(speaker);

    // Circular delay buffer — holds DELAY_FRAME_COUNT frames
    const delayBuffer: AudioFrame[] = [];

    // Subscribe to the glasses microphone
    const unsubMic = session.audio.onAudioTrack((micTrack) => {
      console.log("[EchoApp] Microphone track received — starting echo loop");

      const micStream = new AudioStream(micTrack, SAMPLE_RATE, NUM_CHANNELS);

      // Process frames asynchronously
      void (async () => {
        for await (const frame of micStream) {
          // Push the incoming frame into the delay buffer
          delayBuffer.push(frame);

          // Once the buffer reaches the target delay, start draining
          if (delayBuffer.length >= DELAY_FRAME_COUNT) {
            const echoFrame = delayBuffer.shift()!;
            await speaker.captureFrame(echoFrame);
          }
        }
      })();
    });

    session.on("disconnected", () => {
      console.log("[EchoApp] Session ended");
      unsubMic();
      delayBuffer.length = 0;
    });
  }
}

const app = new EchoApp({ port: 3000 });
app.start().catch(console.error);
