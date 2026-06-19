import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlassUser, type GlassUser } from "./auth.js";
import { useCalmState } from "./hooks/useCalmState.js";
import { Aurora } from "./components/Aurora.js";
import { Orb } from "./components/Orb.js";
import { SoundscapePicker } from "./components/SoundscapePicker.js";
import { Glyph } from "./lib/glyphs.js";
import {
  PlayIcon,
  StopIcon,
  ClockIcon,
  GlassesIcon,
  SpeakerIcon,
} from "./lib/icons.js";
import type { Soundscape } from "./lib/types.js";

const DURATIONS = [1, 3, 5, 10, 15, 30];

export function App() {
  const { user, isLoading } = useGlassUser();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Unauthorized />;
  return <Home user={user} />;
}

function Home({ user }: { user: GlassUser }) {
  const { state, setState } = useCalmState(user.sessionToken);
  const [soundscapes, setSoundscapes] = useState<Soundscape[]>([]);
  const [selectedId, setSelectedId] = useState("rain");
  const [durationMin, setDurationMin] = useState(5);
  const [guided, setGuided] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/soundscapes")
      .then((r) => r.json())
      .then((d) => setSoundscapes(d.soundscapes ?? []))
      .catch(() => {});
  }, []);

  const playing = state.status === "playing";

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [playing]);

  const auth = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.sessionToken}`,
  };

  const begin = () => {
    fetch("/api/play", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ soundscapeId: selectedId, durationMin, guided }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setState(s))
      .catch(() => {});
  };

  const stop = () => {
    fetch("/api/stop", { method: "POST", headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setState(s))
      .catch(() => {});
  };

  const activeId = playing ? state.soundscapeId : selectedId;
  const active =
    soundscapes.find((s) => s.id === activeId) ?? soundscapes[0];
  const color = active?.color ?? "#5EE7D0";
  const remainingMs = playing && state.endsAt ? Math.max(0, state.endsAt - now) : 0;

  return (
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <Aurora color={color} />

      <header className="flex items-center justify-between py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            Calm
          </p>
          <p className="text-[16px] font-semibold tracking-tight text-white">
            {user.name ? `Hello, ${user.name}` : "Take a breath"}
          </p>
        </div>
        <GlassesPill connected={state.glassesConnected} />
      </header>

      {/* Orb */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <Orb color={color} playing={playing}>
          <Glyph icon={active?.icon ?? "orbit"} className="h-9 w-9" />
        </Orb>

        <AnimatePresence mode="wait">
          {playing ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-8 flex flex-col items-center"
            >
              <p className="text-[15px] font-medium text-zinc-300">{active?.name}</p>
              <p className="mt-1 text-[44px] font-semibold tabular-nums tracking-tight text-white">
                {mmss(remainingMs)}
              </p>
              <p className="text-[13px] text-zinc-500">
                {guided || state.guided ? "Follow the breath" : "remaining"}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-8 text-center"
            >
              <p className="text-[20px] font-semibold tracking-tight text-white">
                {active?.name ?? "Choose a soundscape"}
              </p>
              <p className="mt-1 text-[14px] text-zinc-400">{active?.description}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="space-y-3 pb-2">
        {!playing && (
          <>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.07]"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}22`, color }}
              >
                <Glyph icon={active?.icon ?? "orbit"} className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-zinc-500">
                  Soundscape
                </span>
                <span className="block text-[15px] font-medium text-white">
                  {active?.name ?? "Pick one"}
                </span>
              </span>
              <span className="text-zinc-500">›</span>
            </button>

            <DurationRow value={durationMin} onChange={setDurationMin} />

            <GuidedToggle guided={guided} onChange={setGuided} />
          </>
        )}

        <ControlButton playing={playing} color={color} onBegin={begin} onStop={stop} />
      </div>

      <SoundscapePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        soundscapes={soundscapes}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}

function ControlButton({
  playing,
  color,
  onBegin,
  onStop,
}: {
  playing: boolean;
  color: string;
  onBegin: () => void;
  onStop: () => void;
}) {
  if (playing) {
    return (
      <button
        onClick={onStop}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] hover:bg-white/10"
      >
        <StopIcon className="h-5 w-5" />
        End session
      </button>
    );
  }
  return (
    <button
      onClick={onBegin}
      className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold text-black transition active:scale-[0.98]"
      style={{ backgroundColor: color, boxShadow: `0 8px 30px ${color}55` }}
    >
      <PlayIcon className="h-5 w-5" />
      Begin
    </button>
  );
}

function DurationRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
      <ClockIcon className="h-4 w-4 shrink-0 text-zinc-400" />
      <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
        {DURATIONS.map((d) => {
          const active = d === value;
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition ${
                active ? "bg-white/[0.16] text-white" : "text-zinc-400 hover:bg-white/[0.06]"
              }`}
            >
              {d}m
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GuidedToggle({
  guided,
  onChange,
}: {
  guided: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <SpeakerIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-white">Guided breathing</p>
        <p className="text-[12px] text-zinc-400">Gentle voice cues while you relax</p>
      </div>
      <button
        role="switch"
        aria-checked={guided}
        onClick={() => onChange(!guided)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
          guided ? "bg-emerald-500" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-all duration-200 ${
            guided ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

function GlassesPill({ connected }: { connected: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur ${
        connected
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-zinc-400"
      }`}
    >
      <GlassesIcon className="h-4 w-4" />
      {connected ? "Connected" : "Preview"}
    </div>
  );
}

function mmss(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        className="h-7 w-7 rounded-full border-2 border-white/15 border-t-accent"
      />
    </div>
  );
}

function Unauthorized() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="w-full max-w-sm rounded-4xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-3xl">
          🧘
        </div>
        <h1 className="text-[19px] font-semibold tracking-tight text-white">
          Open from your SeeIt glasses
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
          Launch this app from the SeeIt app and you’ll be signed in
          automatically.
        </p>
      </motion.div>
    </div>
  );
}
