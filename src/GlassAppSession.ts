import { Room, RoomEvent } from "@livekit/rtc-node";
import { EventsModule } from "./modules/EventsModule.js";
import { AudioModule } from "./modules/AudioModule.js";
import { CameraModule } from "./modules/CameraModule.js";
import { DataModule } from "./modules/DataModule.js";
import type { ConnectionEvent, Unsubscribe } from "../types/index.js";

/**
 * Represents an active session between a user's glasses and your app.
 *
 * Created automatically by GlassAppServer when a `session.started` webhook
 * arrives. Passed to your `onSession()` implementation.
 */
export class GlassAppSession {
  /** LiveKit room ID (also used as sessionId) */
  readonly roomId: string;
  /** Unique session identifier — same as roomId */
  readonly sessionId: string;
  /** SeeIt user ID of the glasses wearer */
  readonly userId: string;
  /** ID of the registered app */
  readonly appId: string;

  /** Real-time event subscriptions (transcription, data messages) */
  readonly events: EventsModule;
  /** Audio playback and microphone access */
  readonly audio: AudioModule;
  /** Camera video track access */
  readonly camera: CameraModule;
  /** Raw data channel and RPC */
  readonly data: DataModule;

  /** @internal */
  readonly _room: Room;

  constructor(params: {
    roomId: string;
    userId: string;
    appId: string;
    room: Room;
  }) {
    this.roomId = params.roomId;
    this.sessionId = params.roomId;
    this.userId = params.userId;
    this.appId = params.appId;
    this._room = params.room;

    this.events = new EventsModule(params.room);
    this.audio = new AudioModule(params.room);
    this.camera = new CameraModule(params.room);
    this.data = new DataModule(params.room);
  }

  get isConnected(): boolean {
    return this._room.isConnected;
  }

  /**
   * Listen for session-level connection events.
   * Returns an unsubscribe function.
   */
  on(event: ConnectionEvent, handler: () => void): Unsubscribe {
    this._room.on(event, handler);
    return () => this._room.off(event, handler);
  }

  /**
   * Disconnect from the LiveKit room and clean up all resources.
   * Called automatically when the backend sends `session.ended`.
   */
  async disconnect(): Promise<void> {
    await this.audio.stopAudio();
    await this._room.disconnect();
  }
}

/**
 * Connect to a LiveKit room and return a ready GlassAppSession.
 * @internal
 */
export async function createSession(params: {
  url: string;
  token: string;
  roomId: string;
  userId: string;
  appId: string;
}): Promise<GlassAppSession> {
  const room = new Room();

  await room.connect(params.url, params.token, { autoSubscribe: true, dynacast: false });

  return new GlassAppSession({
    roomId: params.roomId,
    userId: params.userId,
    appId: params.appId,
    room,
  });
}
