import type { RelayConnection } from '../relay-connection.js';

export class AudioModule {
  constructor(private readonly conn: RelayConnection) {}

  /** Speak text to the user (SeeIt synthesizes and plays it). */
  speak(text: string): void {
    this.conn.command({ type: 'relay.speak', text });
  }

  /** Play an audio file at `url` on the glasses speaker. */
  playAudio(url: string): void {
    this.conn.command({ type: 'relay.play', url });
  }
}
