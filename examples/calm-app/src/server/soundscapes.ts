export type SoundKind = "rain" | "ocean" | "forest" | "night" | "fire" | "drone";

export interface Soundscape {
  id: string;
  name: string;
  description: string;
  /** Icon key the webview maps to a glyph. */
  icon: string;
  /** Accent colour (hex) used for the card + orb gradient. */
  color: string;
  /** Length of the generated loop, in seconds. */
  loopSeconds: number;
  kind: SoundKind;
}

/**
 * The soundscapes offered in the picker. Each one is synthesised to a CC0 WAV
 * loop by `sounds/generate.ts` — no copyrighted audio, no external downloads.
 */
export const SOUNDSCAPES: Soundscape[] = [
  {
    id: "rain",
    name: "Rain",
    description: "Soft, steady rainfall",
    icon: "rain",
    color: "#5EA9FF",
    loopSeconds: 40,
    kind: "rain",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Slow rolling waves",
    icon: "wave",
    color: "#33C4C4",
    loopSeconds: 40,
    kind: "ocean",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Wind, leaves & distant birds",
    icon: "leaf",
    color: "#7FD17F",
    loopSeconds: 40,
    kind: "forest",
  },
  {
    id: "night",
    name: "Night",
    description: "Crickets under a low drone",
    icon: "moon",
    color: "#9C8CFF",
    loopSeconds: 40,
    kind: "night",
  },
  {
    id: "fire",
    name: "Fireside",
    description: "Crackling embers",
    icon: "flame",
    color: "#FF9E5E",
    loopSeconds: 40,
    kind: "fire",
  },
  {
    id: "drone",
    name: "Deep Calm",
    description: "Warm meditative drone",
    icon: "orbit",
    color: "#C08CFF",
    loopSeconds: 40,
    kind: "drone",
  },
];

export function getSoundscape(id: string): Soundscape | undefined {
  return SOUNDSCAPES.find((s) => s.id === id);
}
