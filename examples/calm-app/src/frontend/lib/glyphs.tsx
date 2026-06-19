import {
  RainIcon,
  WaveIcon,
  LeafIcon,
  MoonIcon,
  FlameIcon,
  OrbitIcon,
} from "./icons.js";

const MAP: Record<string, (p: { className?: string }) => JSX.Element> = {
  rain: RainIcon,
  wave: WaveIcon,
  leaf: LeafIcon,
  moon: MoonIcon,
  flame: FlameIcon,
  orbit: OrbitIcon,
};

/** Resolve a soundscape's `icon` key to its glyph component. */
export function Glyph({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Comp = MAP[icon] ?? OrbitIcon;
  return <Comp className={className} />;
}
