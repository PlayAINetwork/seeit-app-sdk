import type { RelayConnection } from "../relay-connection.js";
import type { DataMessage, Unsubscribe } from "../../types/index.js";

/**
 * Raw data messaging with the room, relayed by SeeIt.
 */
export class DataModule {
  constructor(private readonly conn: RelayConnection) {}

  /** Send a data message into the room (optionally on a topic). */
  send(payload: string, options: { topic?: string } = {}): void {
    this.conn.command({
      type: "relay.data",
      payload,
      ...(options.topic !== undefined ? { topic: options.topic } : {}),
    });
  }

  /** Listen for incoming data messages. Optionally filter by topic. */
  onData(handler: (msg: DataMessage) => void): Unsubscribe;
  onData(topic: string, handler: (msg: DataMessage) => void): Unsubscribe;
  onData(
    topicOrHandler: string | ((msg: DataMessage) => void),
    maybeHandler?: (msg: DataMessage) => void
  ): Unsubscribe {
    const filterTopic =
      typeof topicOrHandler === "string" ? topicOrHandler : undefined;
    const handler =
      typeof topicOrHandler === "function" ? topicOrHandler : maybeHandler!;

    return this.conn.onEvent("data", (data) => {
      const m = data as { topic?: string; payload: string; from: string };
      if (filterTopic !== undefined && m.topic !== filterTopic) return;
      handler({
        payload: m.payload,
        ...(m.topic !== undefined ? { topic: m.topic } : {}),
        senderIdentity: m.from,
      });
    });
  }
}
