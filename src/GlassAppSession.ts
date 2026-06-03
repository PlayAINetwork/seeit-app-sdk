import { RelayConnection } from './relay-connection.js';
import { EventsModule } from './modules/EventsModule.js';
import { AudioModule } from './modules/AudioModule.js';
import { CameraModule } from './modules/CameraModule.js';
import { DataModule } from './modules/DataModule.js';
import type { ConnectionEvent, Unsubscribe } from '../types/index.js';

export class GlassAppSession {
  /** Room ID (also used as the session ID). */
  readonly roomId: string;
  /** Unique session identifier — same as roomId. */
  readonly sessionId: string;
  /** SeeIt user ID of the glasses wearer. */
  readonly userId: string;
  /** ID of the registered app. */
  readonly appId: string;

  /** Real-time event subscriptions (transcription, data). */
  readonly events: EventsModule;
  /** Audio output (speak / play). */
  readonly audio: AudioModule;
  /** Camera access (not yet supported over the relay). */
  readonly camera: CameraModule;
  /** Raw data messaging. */
  readonly data: DataModule;

  /** @internal */
  private readonly conn: RelayConnection;

  constructor(params: {
    relayUrl: string;
    relayToken: string;
    roomId: string;
    userId: string;
    appId: string;
  }) {
    this.roomId = params.roomId;
    this.sessionId = params.roomId;
    this.userId = params.userId;
    this.appId = params.appId;

    this.conn = new RelayConnection(params.relayUrl, params.relayToken);
    this.events = new EventsModule(this.conn);
    this.audio = new AudioModule(this.conn);
    this.camera = new CameraModule(this.conn);
    this.data = new DataModule(this.conn);
  }

  get isConnected(): boolean {
    return this.conn.connected;
  }

  /** Shortcut for `audio.speak(text)`. */
  speak(text: string): void {
    this.audio.speak(text);
  }

  /**
   * Listen for session-level connection events.
   * Returns an unsubscribe function.
   */
  on(event: ConnectionEvent, handler: () => void): Unsubscribe {
    return this.conn.on(event, handler);
  }

  /** Disconnect from the relay and clean up. */
  async disconnect(): Promise<void> {
    this.conn.close();
  }

  /** @internal — resolves once the relay handshake completes. */
  whenReady(): Promise<void> {
    return this.conn.whenReady();
  }
}

/**
 * Connect to the SeeIt relay and return a ready GlassAppSession.
 * @internal
 */
export async function createSession(params: {
  relayUrl: string;
  relayToken: string;
  roomId: string;
  userId: string;
  appId: string;
}): Promise<GlassAppSession> {
  const session = new GlassAppSession(params);
  await session.whenReady();
  return session;
}
