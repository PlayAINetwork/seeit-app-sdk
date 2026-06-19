/** Minimal stroked line icons, sized to the current font by default. */
type IconProps = { className?: string };

function Svg({
  children,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const StopIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const ChevronLeftIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m5 13 4 4 10-11" />
  </Svg>
);

export const SpeakerIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    <path d="M16 9a3 3 0 0 1 0 6" />
    <path d="M18.5 7a6 6 0 0 1 0 10" />
  </Svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const RetryIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
    <path d="M21 4v5h-5" />
  </Svg>
);

export const GlassesIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="6.5" cy="14" r="3.5" />
    <circle cx="17.5" cy="14" r="3.5" />
    <path d="M10 13.5c.7-.8 3.3-.8 4 0" />
    <path d="M3 11l2-4M21 11l-2-4" />
  </Svg>
);

// --- soundscape glyphs ------------------------------------------------------

export const RainIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7 14a4.5 4.5 0 0 1 .6-8.96A5.5 5.5 0 0 1 18 6.5a3.5 3.5 0 0 1-.5 7H7Z" />
    <path d="M8 17l-1 2.5M12 17l-1 2.5M16 17l-1 2.5" />
  </Svg>
);

export const WaveIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2 9c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
    <path d="M2 15c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
  </Svg>
);

export const LeafIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 13Z" />
    <path d="M5 19c3-5 6-7 10-8" />
  </Svg>
);

export const MoonIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z" />
  </Svg>
);

export const FlameIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.4 1.3-3C9.8 6.7 11 5.4 12 3Z" />
  </Svg>
);

export const OrbitIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3" />
    <ellipse cx="12" cy="12" rx="9" ry="4" />
  </Svg>
);
