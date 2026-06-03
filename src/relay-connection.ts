import WebSocket from 'ws';
import type { ConnectionEvent, Unsubscribe } from '../types/index.js';

type Stream = 'transcription' | 'data';
type EventHandler = (data: unknown) => void;

export class RelayConnection {
  private ws: WebSocket;
  private readonly handlers = new Map<Stream, Set<EventHandler>>();
  private readonly subscribed = new Set<Stream>();
  private readonly connListeners = new Map<ConnectionEvent, Set<() => void>>();
  private readonly outbox: string[] = [];
  private isReady = false;
  private readonly ready: Promise<void>;

  constructor(
    private readonly relayUrl: string,
    private readonly relayToken: string,
  ) {
    this.ws = new WebSocket(this.relayUrl);
    this.ready = new Promise<void>((resolve, reject) => {
      this.ws.on('open', () => {
        this.ws.send(
          JSON.stringify({ type: 'relay.hello', relayToken: this.relayToken }),
        );
      });
      this.ws.on('message', (raw: WebSocket.RawData) => {
        let msg: { type?: string; [k: string]: unknown };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === 'relay.ready') {
          this.isReady = true;
          this.flush();
          resolve();
        } else if (msg.type === 'relay.event') {
          this.dispatch(msg.stream as Stream, msg.data);
        } else if (msg.type === 'relay.error') {
          if (!this.isReady)
            reject(new Error(String(msg.message ?? 'relay error')));
          else
            console.error(
              '[GlassAppSession] relay error:',
              msg.code,
              msg.message,
            );
        }
      });
      this.ws.on('close', () => this.emit('disconnected'));
      this.ws.on('error', (err) => {
        if (!this.isReady) reject(err);
      });
    });
  }

  /** Resolves once the relay has acknowledged the handshake (`relay.ready`). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  get connected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /** Register a handler for a stream; lazily subscribes on the relay. */
  onEvent(stream: Stream, handler: EventHandler): Unsubscribe {
    let set = this.handlers.get(stream);
    if (!set) {
      set = new Set();
      this.handlers.set(stream, set);
    }
    set.add(handler);
    this.subscribe(stream);
    return () => set!.delete(handler);
  }

  /** Send a command to the relay (queued until ready). */
  command(message: Record<string, unknown>): void {
    this.queue(JSON.stringify(message));
  }

  on(event: ConnectionEvent, handler: () => void): Unsubscribe {
    let set = this.connListeners.get(event);
    if (!set) {
      set = new Set();
      this.connListeners.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }

  // ---------------------------------------------------------------------------

  private subscribe(stream: Stream): void {
    if (this.subscribed.has(stream)) return;
    this.subscribed.add(stream);
    this.queue(JSON.stringify({ type: 'relay.subscribe', streams: [stream] }));
  }

  private dispatch(stream: Stream, data: unknown): void {
    const set = this.handlers.get(stream);
    if (!set) return;
    for (const handler of set) handler(data);
  }

  private emit(event: ConnectionEvent): void {
    const set = this.connListeners.get(event);
    if (!set) return;
    for (const handler of set) handler();
  }

  private queue(payload: string): void {
    if (this.isReady && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.outbox.push(payload);
    }
  }

  private flush(): void {
    while (this.outbox.length > 0) {
      const payload = this.outbox.shift()!;
      this.ws.send(payload);
    }
  }
}
