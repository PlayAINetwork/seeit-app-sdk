// ---------------------------------------------------------------------------
// Webhook payloads (sent by SeeIt backend to your app's webhookUrl)
// ---------------------------------------------------------------------------

export interface SessionStartedPayload {
  type: "session.started";
  appId: string;
  userId: string;
  roomId: string;
  /** WebSocket URL of the SeeIt relay to connect to. */
  relayUrl: string;
  /** Scoped credential for opening the relay connection. */
  relayToken: string;
  timestamp: string;
}

export interface SessionEndedPayload {
  type: "session.ended";
  appId: string;
  userId: string;
  timestamp: string;
}

/**
 * Ownership handshake. SeeIt POSTs this when you call
 * `POST /glass/apps/:appId/webhook/verify`, and your endpoint must reply 200
 * echoing the challenge back. `GlassAppServer` answers it for you.
 */
export interface EndpointVerificationPayload {
  type: "endpoint.verification";
  /** Random hex string your endpoint must echo back. */
  challenge: string;
}

export type WebhookPayload =
  | SessionStartedPayload
  | SessionEndedPayload
  | EndpointVerificationPayload;

// ---------------------------------------------------------------------------
// Server options
// ---------------------------------------------------------------------------

export interface GlassAppServerOptions {
  /**
   * Your app's webhook signing secret (`whsec_…`), issued when you register the
   * app and shown only once. Rotate it with
   * `POST /glass/apps/:appId/webhook/rotate-secret`.
   *
   * Required. Every delivery from SeeIt is signed, and an endpoint that cannot
   * check the signature will accept forged session events from anyone who
   * learns its URL. Deliveries carry `x-seeit-timestamp` and
   * `x-seeit-signature: v1=<hex>`, where the signature is
   * `HMAC-SHA256(secret, "<timestamp>.<raw body>")`; requests that fail
   * verification, or fall outside the replay window, are rejected with 401.
   */
  webhookSecret: string;
  /** HTTP port to listen on. Default: 3000 */
  port?: number;
  /** Path for webhook POST requests. Default: "/webhook" */
  webhookPath?: string;
  /** Replay window in seconds. Default: 300 — matches the SeeIt backend. */
  webhookToleranceSeconds?: number;
  /** Max accepted webhook body size in bytes. Default: 1 MiB. Larger → 413. */
  maxWebhookBodyBytes?: number;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** A speech transcription segment from the glasses user */
export interface TranscriptionData {
  /** Unique segment identifier */
  segmentId: string;
  /** Transcribed text content */
  text: string;
  /** Whether this is the final (committed) transcription for this segment */
  isFinal: boolean;
}

/** A raw data message relayed from the room. */
export interface DataMessage {
  /** Decoded message payload. */
  payload: string;
  /** Optional topic the message was published to. */
  topic?: string;
  /** Identity of the sender in the room. */
  senderIdentity: string;
}

// ---------------------------------------------------------------------------
// Webview auth (Glass launch handshake)
// ---------------------------------------------------------------------------

export interface VerifySessionTokenOptions {
  /** Your app's ID (the token's `aud` claim must match this). */
  appId: string;
  /**
   * Override the JWKS endpoint used to verify tokens.
   * Defaults to SeeIt's public JWKS (`/glass/.well-known/jwks.json`).
   */
  jwksUrl?: string;
}

/** Verified identity extracted from a session (or launch) token. */
export interface SessionClaims {
  /** SeeIt user ID of the glasses wearer (the token `sub`). */
  userId: string;
  /** Your app ID (the verified `aud`). */
  appId: string;
  /** Which token this was: short-lived `launch` or durable `session`. */
  tokenType: "launch" | "session";
  /** User's display name, when present on the token. */
  name?: string;
  /** User's email, when present on the token. */
  email?: string;
  /**
   * The durable session token — present only on a `launch` token. Your web UI
   * stores this and sends it as `Authorization: Bearer <sessionToken>`.
   */
  sessionToken?: string;
  /** Expiry as a Unix timestamp (seconds), if set. */
  expiresAt?: number;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Call to remove an event subscription */
export type Unsubscribe = () => void;

export type ConnectionEvent = "disconnected" | "reconnected";
