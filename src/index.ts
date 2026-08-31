export { GlassAppServer } from "./GlassAppServer.js";
export { GlassAppSession } from "./GlassAppSession.js";
export { EventsModule } from "./modules/EventsModule.js";
export { AudioModule } from "./modules/AudioModule.js";
export { CameraModule } from "./modules/CameraModule.js";
export { DataModule } from "./modules/DataModule.js";
export { verifySessionToken } from "./auth/verifySessionToken.js";
export {
  verifyWebhookSignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
} from "./auth/verifyWebhookSignature.js";

export type {
  WebhookHeaders,
  WebhookVerificationResult,
  WebhookVerificationFailure,
  VerifyWebhookSignatureOptions,
} from "./auth/verifyWebhookSignature.js";

export type {
  GlassAppServerOptions,
  SessionStartedPayload,
  SessionEndedPayload,
  EndpointVerificationPayload,
  WebhookPayload,
  TranscriptionData,
  DataMessage,
  Unsubscribe,
  ConnectionEvent,
  VerifySessionTokenOptions,
  SessionClaims,
} from "../types/index.js";
