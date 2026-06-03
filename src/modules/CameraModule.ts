import type { RelayConnection } from '../relay-connection.js';
import type { Unsubscribe } from '../../types/index.js';

export class CameraModule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_conn: RelayConnection) {}

  /** @throws camera is not yet supported over the SeeIt relay. */
  onVideoTrack(_handler: (frame: unknown) => void): Unsubscribe {
    throw new Error(
      'camera is not yet supported over the SeeIt relay — coming in a future release',
    );
  }
}
