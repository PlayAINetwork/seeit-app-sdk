import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlassUser, type GlassUser } from "./auth.js";
import { useTranscriptStream } from "./hooks/useTranscriptStream.js";
import { TranscriptDisplay } from "./components/TranscriptDisplay.js";
import { StatusPill } from "./components/StatusPill.js";
import { ExportBar } from "./components/ExportBar.js";
import { HistorySheet } from "./components/HistorySheet.js";
import { HistoryIcon, RetryIcon } from "./lib/icons.js";

export function App() {
  const { user, isLoading } = useGlassUser();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Unauthorized />;
  return <Home user={user} />;
}

function Home({ user }: { user: GlassUser }) {
  const { segments, session, status, reconnect } = useTranscriptStream(
    user.sessionToken,
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  const finals = segments.filter((s) => s.isFinal && s.text.trim());
  const initial = (user.name ?? user.userId).trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-safe pb-safe">
      <TopBar
        initial={initial}
        name={user.name ?? "Live Transcript"}
        status={status}
        onHistory={() => setHistoryOpen(true)}
      />

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

      <TranscriptDisplay segments={segments} status={status} />

      <div className="pt-3">
        <ExportBar
          startedAt={session?.startedAt ?? Date.now()}
          lines={finals.map((s) => s.text)}
        />
      </div>

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

function TopBar({
  initial,
  name,
  status,
  onHistory,
}: {
  initial: string;
  name: string;
  status: ReturnType<typeof useTranscriptStream>["status"];
  onHistory: () => void;
}) {
  return (
    <header className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-600 text-[15px] font-semibold text-white shadow-float">
        {initial || "•"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
          Live Transcript
        </p>
        <p className="truncate text-[16px] font-semibold tracking-tight text-white">
          {name}
        </p>
      </div>
      <StatusPill status={status} />
      <button
        onClick={onHistory}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition active:scale-90 hover:bg-white/10"
        aria-label="History"
      >
        <HistoryIcon className="h-[18px] w-[18px]" />
      </button>
    </header>
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
          👓
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
