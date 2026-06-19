export interface Soundscape {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  loopSeconds: number;
  kind: string;
}

export interface CalmState {
  status: "idle" | "playing";
  soundscapeId: string | null;
  startedAt: number | null;
  endsAt: number | null;
  durationMin: number | null;
  guided: boolean;
  glassesConnected: boolean;
}
