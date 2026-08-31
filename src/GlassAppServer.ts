import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import type {
  GlassAppServerOptions,
  WebhookPayload,
  SessionStartedPayload,
  SessionEndedPayload,
} from "../types/index.js";
import { GlassAppSession, createSession } from "./GlassAppSession.js";
import { verifyWebhookSignature } from "./auth/verifyWebhookSignature.js";

/** Real payloads are ~1 KB; this is only here to bound an abusive request. */
const DEFAULT_MAX_BODY_BYTES = 1_048_576;

/**
 * Base class for SeeIt Glass apps.
 *
 * Extend this class and implement `onSession()` to handle user sessions.
 *
 * @example
 * ```ts
 * class MyApp extends GlassAppServer {
 *   protected async onSession(session: GlassAppSession) {
 *     session.events.onTranscription(({ text, isFinal }) => {
 *       if (isFinal) console.log("User said:", text);
 *     });
 *   }
 * }
 * new MyApp({ webhookSecret: process.env.WEBHOOK_SECRET!, port: 3000 }).start();
 * ```
 */
export abstract class GlassAppServer {
  private readonly port: number;
  private readonly webhookPath: string;
  private readonly webhookSecret: string;
  private readonly webhookToleranceSeconds: number | undefined;
  private readonly maxWebhookBodyBytes: number;
  private readonly activeSessions = new Map<string, GlassAppSession>();
  private server: Server | null = null;

  constructor(options: GlassAppServerOptions) {
    if (!options?.webhookSecret) {
      throw new Error(
        "GlassAppServer: webhookSecret is required. Every webhook SeeIt delivers " +
          "is signed, and an unverified endpoint will accept forged session events " +
          "from anyone who learns its URL. Your app's secret is shown once when you " +
          "register it; issue a new one with POST /glass/apps/:appId/webhook/rotate-secret."
      );
    }

    this.port = options.port ?? 3000;
    this.webhookPath = options.webhookPath ?? "/webhook";
    this.webhookSecret = options.webhookSecret;
    this.webhookToleranceSeconds = options.webhookToleranceSeconds;
    this.maxWebhookBodyBytes =
      options.maxWebhookBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  }

  /**
   * Implement this method to handle each new user session.
   * Called once per `session.started` event.
   */
  protected abstract onSession(session: GlassAppSession): Promise<void>;

  /**
   * Start the HTTP server and begin accepting webhook requests.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          void this.handleRequest(req, res);
        }
      );

      this.server.on("error", reject);
      this.server.listen(this.port, () => {
        console.log(
          `[GlassAppServer] Listening on port ${this.port} — webhook at ${this.webhookPath}`
        );
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server and disconnect all active sessions.
   */
  async stop(): Promise<void> {
    await Promise.all(
      [...this.activeSessions.values()].map((s) => s.disconnect())
    );
    this.activeSessions.clear();

    await new Promise<void>((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  // ---------------------------------------------------------------------------
  // Internal request handling
  // ---------------------------------------------------------------------------

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = req.url?.split("?")[0] ?? "";

    if (req.method !== "POST" || url !== this.webhookPath) {
      res.writeHead(404).end("Not found");
      return;
    }

    await this.handleWebhookRequest(req, res);
  }

  /**
   * Handle a single webhook request on a server you control.
   *
   * Use this to mount the app's webhook on your own HTTP/Express server instead
   * of calling {@link start} (which opens its own port). Register it on the
   * webhook path **before** any body parser — signature verification needs the
   * raw request stream.
   *
   * If you can't control that ordering, a raw body parser (`express.raw` with a
   * catch-all type) on the webhook route works too — the buffer it leaves
   * behind is still verifiable.
   *
   * @example
   * ```ts
   * // do NOT call glass.start()
   * const glass = new MyApp({ webhookSecret: process.env.WEBHOOK_SECRET! });
   * app.post("/webhook", (req, res) => glass.handleWebhookRequest(req, res));
   * ```
   */
  async handleWebhookRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let raw: Buffer;
    try {
      raw = await readRawBody(req, this.maxWebhookBodyBytes);
    } catch (err) {
      if (err instanceof WebhookBodyError && err.kind === "too_large") {
        res.writeHead(413).end("Payload too large");
        return;
      }
      if (err instanceof WebhookBodyError && err.kind === "already_consumed") {
        console.error(
          "[GlassAppServer] The request body was consumed before the webhook handler " +
            "ran, so the signature cannot be verified. Mount handleWebhookRequest " +
            'BEFORE express.json(), or use express.raw({ type: "*/*" }) on the ' +
            "webhook route."
        );
        res.writeHead(500).end("Webhook misconfigured");
        return;
      }
      res.writeHead(400).end("Bad request");
      return;
    }

    const verification = verifyWebhookSignature(raw, req.headers, {
      secret: this.webhookSecret,
      ...(this.webhookToleranceSeconds !== undefined
        ? { toleranceSeconds: this.webhookToleranceSeconds }
        : {}),
    });
    if (!verification.ok) {
      console.warn(
        `[GlassAppServer] Rejected webhook: ${verification.reason}`
      );
      res.writeHead(401).end("Unauthorized");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {
      res.writeHead(400).end("Invalid JSON");
      return;
    }

    const payload = asWebhookPayload(parsed);

    // Ownership handshake. Answered only after the signature checked out —
    // echoing an unverified challenge would let anyone who knows this URL prove
    // "ownership" of it to SeeIt.
    if (payload?.type === "endpoint.verification") {
      if (typeof payload.challenge !== "string" || payload.challenge === "") {
        res.writeHead(400).end("Missing challenge");
        return;
      }
      console.log(
        "[GlassAppServer] Answered SeeIt endpoint verification challenge"
      );
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ challenge: payload.challenge }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');

    // Unknown type — a newer backend event. Acked above, nothing to dispatch.
    if (!payload) return;

    // Handle async — errors are logged, never crash the server
    this.handleWebhook(payload).catch((err: unknown) => {
      console.error("[GlassAppServer] Webhook handler error:", err);
    });
  }

  private async handleWebhook(
    payload: SessionStartedPayload | SessionEndedPayload
  ): Promise<void> {
    if (payload.type === "session.started") {
      await this.handleSessionStarted(payload);
    } else {
      await this.handleSessionEnded(payload.appId, payload.userId);
    }
  }

  private async handleSessionStarted(
    payload: SessionStartedPayload
  ): Promise<void> {
    const sessionKey = `${payload.appId}:${payload.userId}:${payload.roomId}`;

    // Tear down any stale session for the same key
    const existing = this.activeSessions.get(sessionKey);
    if (existing) {
      await existing.disconnect().catch(() => {});
      this.activeSessions.delete(sessionKey);
    }

    let session: GlassAppSession;
    try {
      session = await createSession({
        relayUrl: payload.relayUrl,
        relayToken: payload.relayToken,
        roomId: payload.roomId,
        userId: payload.userId,
        appId: payload.appId,
      });
    } catch (err) {
      console.error(
        `[GlassAppServer] Failed to connect to the SeeIt relay for room ${payload.roomId}:`,
        err
      );
      return;
    }

    this.activeSessions.set(sessionKey, session);

    // Remove from map when the session disconnects on its own
    session.on("disconnected", () => {
      this.activeSessions.delete(sessionKey);
    });

    await this.onSession(session);
  }

  private async handleSessionEnded(appId: string, userId: string): Promise<void> {
    // Find and disconnect all sessions that match appId + userId
    for (const [key, session] of this.activeSessions) {
      if (session.appId === appId && session.userId === userId) {
        await session.disconnect().catch(() => {});
        this.activeSessions.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class WebhookBodyError extends Error {
  constructor(readonly kind: "too_large" | "already_consumed") {
    super(kind);
  }
}

/**
 * Read the exact bytes that were received. Signature verification is over the
 * raw body, so anything that reserializes a parsed object will not match.
 */
function readRawBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  // A raw-body parser ran ahead of us (express.raw(), or middleware that stashes
  // req.rawBody). Those bytes are still verifiable.
  const parsed = (req as { body?: unknown }).body;
  if (Buffer.isBuffer(parsed)) return Promise.resolve(parsed);

  const stashed = (req as { rawBody?: unknown }).rawBody;
  if (Buffer.isBuffer(stashed)) return Promise.resolve(stashed);
  if (typeof stashed === "string") {
    return Promise.resolve(Buffer.from(stashed, "utf8"));
  }

  // A JSON parser drained the stream and kept nothing we can verify. Say so
  // loudly rather than failing the signature check for no visible reason.
  if (req.readableEnded) {
    return Promise.reject(new WebhookBodyError("already_consumed"));
  }

  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.reject(new WebhookBodyError("too_large"));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new WebhookBodyError("too_large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Narrow parsed JSON to a payload we know how to handle. Returns null for any
 * other shape, including event types added by a newer backend.
 */
function asWebhookPayload(value: unknown): WebhookPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const type = (value as { type?: unknown }).type;
  return type === "session.started" ||
    type === "session.ended" ||
    type === "endpoint.verification"
    ? (value as WebhookPayload)
    : null;
}
