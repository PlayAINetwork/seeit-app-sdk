import { Room, RoomEvent, RemoteParticipant } from "@livekit/rtc-node";
import type { TranscriptionData, DataMessage, Unsubscribe } from "../../types/index.js";

/**
 * Handles real-time events from the glasses session:
 * - Speech transcription (sent as data-channel messages with type "transcription")
 * - Raw data-channel messages
 *
 * Transcription format expected on the data channel:
 *   { type: "transcription", segmentId, text, isFinal, isUser }
 */
export class EventsModule {
  private readonly room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  /**
   * Subscribe to speech transcription events from the glasses user.
   *
   * The glasses device sends transcription segments as JSON data-channel
   * messages with `type: "transcription"`.
   */
  onTranscription(handler: (data: TranscriptionData) => void): Unsubscribe {
    const listener = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      // Accept messages on the "transcription" topic OR any topic-less message
      // that parses as a transcription object.
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text) as Record<string, unknown>;
        if (msg["type"] !== "transcription") return;

        handler({
          segmentId: String(msg["segmentId"] ?? msg["id"] ?? ""),
          text: String(msg["text"] ?? ""),
          isFinal: Boolean(msg["isFinal"] ?? msg["final"] ?? false),
          isUser: Boolean(msg["isUser"] ?? true),
        });
      } catch {
        // Non-JSON or unrelated message — ignore
      }
    };

    this.room.on(RoomEvent.DataReceived, listener);
    return () => this.room.off(RoomEvent.DataReceived, listener);
  }

  /**
   * Subscribe to raw data-channel messages.
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

    const listener = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      if (filterTopic !== undefined && topic !== filterTopic) return;
      handler({
        data: payload,
        ...(topic !== undefined ? { topic } : {}),
        senderIdentity: participant?.identity ?? "",
      });
    };

    this.room.on(RoomEvent.DataReceived, listener);
    return () => this.room.off(RoomEvent.DataReceived, listener);
  }
}
