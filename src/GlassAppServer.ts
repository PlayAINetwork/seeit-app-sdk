import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GlassAppServerOptions, WebhookPayload, SessionStartedPayload } from "../types/index.js";
import { GlassAppSession, createSession } from "./GlassAppSession.js";

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
 * new MyApp({ port: 3000 }).start();
 * ```
 */
export abstract class GlassAppServer {
  private readonly port: number;
  private readonly webhookPath: string;
  private readonly webhookSecret: string | undefined;
  private readonly activeSessions = new Map<string, GlassAppSession>();
  private server: Server | null = null;

  constructor(options: GlassAppServerOptions = {}) {
    this.port = options.port ?? 3000;
    this.webhookPath = options.webhookPath ?? "/webhook";
    this.webhookSecret = options.webhookSecret;
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
   * @example
   * ```ts
   * const glass = new MyApp();              // do NOT call glass.start()
   * app.post("/webhook", (req, res) => glass.handleWebhookRequest(req, res));
   * ```
   */
  async handleWebhookRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let body: Buffer;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }

    if (this.webhookSecret) {
      const sig = req.headers["x-seeit-signature"];
      if (!verifySignature(body, this.webhookSecret, String(sig ?? ""))) {
        res.writeHead(401).end("Unauthorized");
        return;
      }
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body.toString()) as WebhookPayload;
    } catch {
      res.writeHead(400).end("Invalid JSON");
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');

    // Handle async — errors are logged, never crash the server
    this.handleWebhook(payload).catch((err: unknown) => {
      console.error("[GlassAppServer] Webhook handler error:", err);
    });
  }

  private async handleWebhook(payload: WebhookPayload): Promise<void> {
    if (payload.type === "session.started") {
      await this.handleSessionStarted(payload);
    } else if (payload.type === "session.ended") {
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

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(
  body: Buffer,
  secret: string,
  header: string
): boolean {
  const expected = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}
