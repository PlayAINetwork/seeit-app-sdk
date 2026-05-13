import {
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
} from "@livekit/rtc-node";
import type { RpcInvocationData } from "@livekit/rtc-node";
import type { DataMessage, Unsubscribe } from "../../types/index.js";

export class DataModule {
  private readonly room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  /**
   * Send a raw data message to all (or specific) participants in the room.
   */
  async send(
    data: Uint8Array | string,
    options: {
      topic?: string;
      reliable?: boolean;
      destinationIdentities?: string[];
    } = {}
  ): Promise<void> {
    const participant = this.room.localParticipant;
    if (!participant) throw new Error("Not connected to a room");

    const bytes =
      typeof data === "string" ? new TextEncoder().encode(data) : data;

    await participant.publishData(bytes, {
      ...(options.topic !== undefined ? { topic: options.topic } : {}),
      reliable: options.reliable ?? true,
      ...(options.destinationIdentities !== undefined
        ? { destination_identities: options.destinationIdentities }
        : {}),
    });
  }

  /**
   * Listen for incoming data-channel messages.
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

  /**
   * Register a method that remote participants can invoke via LiveKit RPC.
   * The handler must return a Promise<string> response payload.
   */
  registerRpcMethod(
    method: string,
    handler: (payload: string, callerId: string) => Promise<string>
  ): Unsubscribe {
    const participant = this.room.localParticipant;
    if (!participant) throw new Error("Not connected to a room");

    participant.registerRpcMethod(
      method,
      async (data: RpcInvocationData) => await handler(data.payload, data.callerIdentity)
    );
    return () => participant.unregisterRpcMethod(method);
  }

  /**
   * Call an RPC method on a remote participant.
   */
  async callRpc(
    targetIdentity: string,
    method: string,
    payload = "{}"
  ): Promise<string> {
    const participant = this.room.localParticipant;
    if (!participant) throw new Error("Not connected to a room");

    return participant.performRpc({
      destinationIdentity: targetIdentity,
      method,
      payload,
    });
  }
}
