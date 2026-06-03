import type { RelayConnection } from "../relay-connection.js";
import type {
  TranscriptionData,
  DataMessage,
  Unsubscribe,
} from "../../types/index.js";

/**
 * Real-time events from the glasses session, relayed by SeeIt:
 * - speech transcription
 * - raw data messages
 */
export class EventsModule {
  constructor(private readonly conn: RelayConnection) {}

  /**
   * Subscribe to speech transcription from the glasses user (and the agent).
   * SeeIt performs the transcription and relays segments to you.
   */
  onTranscription(handler: (data: TranscriptionData) => void): Unsubscribe {
    return this.conn.onEvent("transcription", (data) =>
      handler(data as TranscriptionData)
    );
  }

  /**
   * Subscribe to raw data messages relayed from the room.
   * Optionally filter by topic.
   */
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
