import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
  TrackKind,
} from "@livekit/rtc-node";
import type { Unsubscribe } from "../../types/index.js";

/**
 * Provides access to the glasses camera video stream.
 *
 * The glasses camera is delivered as a LiveKit video track from a WHIP ingress
 * participant whose identity ends with "-ingress".
 */
export class CameraModule {
  private readonly room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  /**
   * Subscribe to the glasses camera video track.
   *
   * Called immediately for any already-subscribed video track from an ingress
   * participant, and again whenever a new ingress video track is subscribed.
   */
  onVideoTrack(handler: (track: RemoteVideoTrack) => void): Unsubscribe {
    // Deliver any tracks that are already subscribed (e.g. joined mid-stream)
    for (const participant of this.room.remoteParticipants.values()) {
      if (!this.isIngressParticipant(participant)) continue;
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.kind === TrackKind.KIND_VIDEO) {
          handler(pub.track as RemoteVideoTrack);
        }
      }
    }

    const listener = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      if (!this.isIngressParticipant(participant)) return;
      if (track.kind !== TrackKind.KIND_VIDEO) return;
      handler(track as RemoteVideoTrack);
    };

    this.room.on(RoomEvent.TrackSubscribed, listener);
    return () => this.room.off(RoomEvent.TrackSubscribed, listener);
  }

  private isIngressParticipant(p: RemoteParticipant): boolean {
    return p.identity.endsWith("-ingress");
  }
}
