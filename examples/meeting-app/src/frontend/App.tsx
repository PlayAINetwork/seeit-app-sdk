import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlassUser, type GlassUser } from "./auth.js";
import { useMeetingStream, type StreamStatus } from "./hooks/useMeetingStream.js";
import { NotesPanel } from "./components/NotesPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { StatusPill } from "./components/StatusPill.js";
import { ExportBar } from "./components/ExportBar.js";
import { HistorySheet } from "./components/HistorySheet.js";
import { HistoryIcon, RetryIcon, UsersIcon, NotesIcon, TranscriptIcon } from "./lib/icons.js";

type Tab = "notes" | "transcript";

export function App() {
  const { user, isLoading } = useGlassUser();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Unauthorized />;
  return <Home user={user} />;
}

function Home({ user }: { user: GlassUser }) {
  const { segments, insights, session, status, reconnect } = useMeetingStream(
    user.sessionToken,
  );
  const [tab, setTab] = useState<Tab>("notes");
  const [historyOpen, setHistoryOpen] = useState(false);

  const initial = (user.name ?? user.userId).trim().charAt(0).toUpperCase();
  const live = status === "live";

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-safe pb-safe">
      <header className="flex items-center gap-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-600 text-[15px] font-semibold text-white shadow-float">
          {initial || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Meeting Notes
          </p>
          <p className="truncate text-[16px] font-semibold tracking-tight text-white">
            {user.name ?? "You"}
          </p>
        </div>
        <ParticipantBadge count={insights?.participantEstimate ?? null} />
        <button
          onClick={() => setHistoryOpen(true)}
          aria-label="History"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition active:scale-90 hover:bg-white/10"
        >
          <HistoryIcon className="h-[18px] w-[18px]" />
        </button>
      </header>

      <div className="flex items-center gap-2 pb-3">
        <Tabs tab={tab} onChange={setTab} status={status} />
      </div>

      <AnimatePresence>
        {status === "offline" && (
          <motion.button
            onClick={reconnect}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[13px] font-medium text-rose-200"
          >
            <RetryIcon className="h-4 w-4" />
            Connection lost — tap to reconnect
          </motion.button>
        )}
      </AnimatePresence>

      {tab === "notes" ? (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <NotesPanel insights={insights} live={live} />
        </div>
      ) : (
        <TranscriptPanel segments={segments} status={status} />
      )}

      <div className="pt-3">
        <ExportBar startedAt={session?.startedAt ?? Date.now()} insights={insights} />
      </div>

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

function ParticipantBadge({ count }: { count: number | null }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
      <UsersIcon className="h-4 w-4 text-accent" />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count ?? "?"}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="text-[13px] font-semibold tabular-nums text-white"
        >
          {count === null ? "—" : `~${count}`}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Tabs({
  tab,
  onChange,
  status,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  status: StreamStatus;
}) {
  const items: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: "notes", label: "Notes", icon: <NotesIcon className="h-4 w-4" /> },
    { value: "transcript", label: "Transcript", icon: <TranscriptIcon className="h-4 w-4" /> },
  ];
  return (
    <div className="flex flex-1 items-center gap-2">
      <div className="flex flex-1 rounded-full bg-white/[0.06] p-1 backdrop-blur">
        {items.map((it) => {
          const active = it.value === tab;
          return (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className="relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-white/[0.14]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative ${active ? "text-white" : "text-zinc-400"}`}>
                {it.icon}
              </span>
              <span className={`relative ${active ? "text-white" : "text-zinc-400"}`}>
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
      <StatusPill status={status} />
    </div>
  );
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
          📝
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
