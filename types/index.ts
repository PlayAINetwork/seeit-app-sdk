// ---------------------------------------------------------------------------
// Webhook payloads (sent by SeeIt backend to your app's webhookUrl)
// ---------------------------------------------------------------------------

export interface SessionStartedPayload {
  type: "session.started";
  appId: string;
  userId: string;
  roomId: string;
  url: string;
  token: string;
  timestamp: string;
}

export interface SessionEndedPayload {
  type: "session.ended";
  appId: string;
  userId: string;
  timestamp: string;
}

export type WebhookPayload = SessionStartedPayload | SessionEndedPayload;

// ---------------------------------------------------------------------------
// Server options
// ---------------------------------------------------------------------------

export interface GlassAppServerOptions {
  /** HTTP port to listen on. Default: 3000 */
  port?: number;
  /** Path for webhook POST requests. Default: "/webhook" */
  webhookPath?: string;
  /**
   * Optional secret for HMAC-SHA256 signature verification.
   * When set, requests must include an `x-seeit-signature` header
   * with `sha256=<hex>` computed over the raw body using this secret.
   */
  webhookSecret?: string;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** A speech transcription segment received from the glasses user */
export interface TranscriptionData {
  /** Unique segment identifier */
  segmentId: string;
  /** Transcribed text content */
  text: string;
  /** Whether this is the final (committed) transcription for this segment */
  isFinal: boolean;
  /** true = spoken by the glasses user; false = spoken by an AI agent in the room */
  isUser: boolean;
}

/** A raw data-channel message received from a room participant */
export interface DataMessage {
  /** Raw message bytes */
  data: Uint8Array;
  /** Optional topic the message was published to */
  topic?: string;
  /** LiveKit identity of the sender */
  senderIdentity: string;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface PlayAudioOptions {
  /** Playback volume from 0 (silent) to 1 (full). Default: 1.0 */
  volume?: number;
  /** Loop the audio until stopAudio() is called. Default: false */
  loop?: boolean;
}

export interface AudioPublishOptions {
  /** Audio bitrate in bps. Default: 32000 */
  audioBitrate?: number;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Call to remove an event subscription */
export type Unsubscribe = () => void;

export type ConnectionEvent = "disconnected" | "reconnected";
