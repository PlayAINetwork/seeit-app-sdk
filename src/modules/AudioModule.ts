import { createReadStream } from "node:fs";
import { Readable, PassThrough } from "node:stream";
import https from "node:https";
import http from "node:http";
import ffmpeg from "fluent-ffmpeg";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteAudioTrack,
  LocalAudioTrack,
  AudioSource,
  AudioFrame,
  TrackKind,
} from "@livekit/rtc-node";
import type { TrackPublishOptions, TrackSource } from "@livekit/rtc-node";
import type {
  PlayAudioOptions,
  AudioPublishOptions,
  Unsubscribe,
} from "../../types/index.js";

const SAMPLE_RATE = 48_000;
const CHANNELS = 1;
const FRAME_DURATION_MS = 10; // 10ms frames
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 480 samples

export class AudioModule {
  private readonly room: Room;
  private currentTrack: LocalAudioTrack | null = null;
  private currentSource: AudioSource | null = null;
  private playbackAbort: AbortController | null = null;

  constructor(room: Room) {
    this.room = room;
  }

  // ---------------------------------------------------------------------------
  // Microphone subscription
  // ---------------------------------------------------------------------------

  /**
   * Called whenever a remote audio track (glasses microphone) is subscribed.
   * Also fires for any already-subscribed audio tracks.
   */
  onAudioTrack(handler: (track: RemoteAudioTrack) => void): Unsubscribe {
    // Deliver already-subscribed audio tracks
    for (const participant of this.room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.kind === TrackKind.KIND_AUDIO) {
          handler(pub.track as RemoteAudioTrack);
        }
      }
    }

    const listener = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant
    ) => {
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      handler(track as RemoteAudioTrack);
    };

    this.room.on(RoomEvent.TrackSubscribed, listener);
    return () => this.room.off(RoomEvent.TrackSubscribed, listener);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  /**
   * Play audio on the glasses speaker.
   *
   * @param source  A remote URL (http/https), a local file path, or a pre-built AudioSource.
   * @param options Volume (0–1) and loop behaviour.
   *
   * Resolves when playback finishes. Call `stopAudio()` to abort early.
   */
  async playAudio(
    source: string | AudioSource,
    options: PlayAudioOptions = {}
  ): Promise<void> {
    await this.stopAudio();

    const abort = new AbortController();
    this.playbackAbort = abort;

    if (source instanceof AudioSource) {
      await this.publishSource(source, options, abort.signal);
      return;
    }

    do {
      if (abort.signal.aborted) break;
      await this.playFromStringSource(source, options.volume ?? 1, abort.signal);
    } while (options.loop && !abort.signal.aborted);

    if (!abort.signal.aborted) {
      await this.stopAudio();
    }
  }

  /**
   * Stop any currently playing audio immediately.
   */
  async stopAudio(): Promise<void> {
    this.playbackAbort?.abort();
    this.playbackAbort = null;

    if (this.currentTrack) {
      const participant = this.room.localParticipant;
      if (participant && this.currentTrack.sid) {
        await participant.unpublishTrack(this.currentTrack.sid).catch(() => {});
      }
      await this.currentTrack.close().catch(() => {});
      this.currentTrack = null;
    }

    if (this.currentSource) {
      await this.currentSource.close().catch(() => {});
      this.currentSource = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Low-level: publish a raw AudioSource directly
  // ---------------------------------------------------------------------------

  /**
   * Publish a raw `AudioSource` as a local audio track (advanced use).
   * You are responsible for feeding PCM frames into the source.
   */
  async publishAudio(
    source: AudioSource,
    _options: AudioPublishOptions = {}
  ): Promise<LocalAudioTrack> {
    await this.stopAudio();
    const track = LocalAudioTrack.createAudioTrack("glass-app-audio", source);

    const participant = this.room.localParticipant;
    if (!participant) throw new Error("Not connected to a room");

    await participant.publishTrack(track, {
      source: 0 as TrackSource, // TrackSource.SOURCE_MICROPHONE = 0
    } as TrackPublishOptions);

    this.currentTrack = track;
    this.currentSource = source;
    return track;
  }

  /**
   * Unpublish the current manually-published audio track.
   */
  async unpublishAudio(): Promise<void> {
    await this.stopAudio();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async playFromStringSource(
    source: string,
    volume: number,
    signal: AbortSignal
  ): Promise<void> {
    const pcmStream = await this.decodeToPcm(source, signal);
    const audioSource = new AudioSource(SAMPLE_RATE, CHANNELS);
    const track = LocalAudioTrack.createAudioTrack("glass-app-audio", audioSource);

    this.currentSource = audioSource;
    this.currentTrack = track;

    const participant = this.room.localParticipant;
    if (!participant) {
      await audioSource.close();
      throw new Error("Not connected to a room");
    }

    await participant.publishTrack(track, {
      source: 0 as TrackSource,
    } as TrackPublishOptions);

    await this.pumpPcmStream(pcmStream, audioSource, volume, signal);
    await audioSource.waitForPlayout();
  }

  private async publishSource(
    source: AudioSource,
    _options: PlayAudioOptions,
    _signal: AbortSignal
  ): Promise<void> {
    const participant = this.room.localParticipant;
    if (!participant) throw new Error("Not connected to a room");

    const track = LocalAudioTrack.createAudioTrack("glass-app-audio", source);
    this.currentSource = source;
    this.currentTrack = track;

    await participant.publishTrack(track, {
      source: 0 as TrackSource,
    } as TrackPublishOptions);

    await source.waitForPlayout();
  }

  /**
   * Use ffmpeg to decode any audio format → raw signed-16-bit PCM at 48kHz mono.
   * Returns a Readable stream of raw PCM bytes.
   */
  private decodeToPcm(source: string, signal: AbortSignal): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const output = new PassThrough();

      const isUrl =
        source.startsWith("http://") || source.startsWith("https://");

      const cmd = ffmpeg()
        .audioChannels(CHANNELS)
        .audioFrequency(SAMPLE_RATE)
        .audioCodec("pcm_s16le")
        .format("s16le");

      if (isUrl) {
        // Stream the remote URL through ffmpeg
        const fetched = new PassThrough();
        const proto = source.startsWith("https://") ? https : http;
        const req = proto.get(source, (res) => res.pipe(fetched));
        req.on("error", reject);
        signal.addEventListener("abort", () => req.destroy(), { once: true });
        cmd.input(fetched);
      } else {
        cmd.input(createReadStream(source));
      }

      cmd
        .on("error", reject)
        .on("start", () => resolve(output))
        .pipe(output, { end: true });

      signal.addEventListener(
        "abort",
        () => {
          cmd.kill("SIGKILL");
          output.destroy();
        },
        { once: true }
      );
    });
  }

  /**
   * Read raw PCM bytes from `stream`, chunk into frames, and push to AudioSource.
   */
  private async pumpPcmStream(
    stream: Readable,
    source: AudioSource,
    volume: number,
    signal: AbortSignal
  ): Promise<void> {
    const bytesPerSample = 2; // int16
    const bytesPerFrame = SAMPLES_PER_FRAME * CHANNELS * bytesPerSample;

    let buffer = Buffer.alloc(0);

    for await (const chunk of stream) {
      if (signal.aborted) break;

      buffer = Buffer.concat([buffer, chunk as Buffer]);

      while (buffer.length >= bytesPerFrame) {
        if (signal.aborted) break;

        const frameBytes = buffer.subarray(0, bytesPerFrame);
        buffer = buffer.subarray(bytesPerFrame);

        const samples = new Int16Array(
          frameBytes.buffer,
          frameBytes.byteOffset,
          SAMPLES_PER_FRAME * CHANNELS
        );

        // Apply volume scaling
        if (volume !== 1) {
          for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.round((samples[i] ?? 0) * volume);
          }
        }

        const frame = new AudioFrame(
          samples,
          SAMPLE_RATE,
          CHANNELS,
          SAMPLES_PER_FRAME
        );

        await source.captureFrame(frame);
      }
    }

    // Flush remaining partial frame (zero-pad to full frame size)
    if (buffer.length > 0 && !signal.aborted) {
      const padded = Buffer.alloc(bytesPerFrame, 0);
      buffer.copy(padded);
      const samples = new Int16Array(
        padded.buffer,
        padded.byteOffset,
        SAMPLES_PER_FRAME * CHANNELS
      );
      if (volume !== 1) {
        for (let i = 0; i < samples.length; i++) {
          samples[i] = Math.round((samples[i] ?? 0) * volume);
        }
      }
      await source.captureFrame(
        new AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME)
      );
    }
  }
}
