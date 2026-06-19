import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlassUser, type GlassUser } from "./auth.js";
import { useTranslateStream } from "./hooks/useTranslateStream.js";
import { TranslateView } from "./components/TranslateView.js";
import { LanguagePicker } from "./components/LanguagePicker.js";
import { SettingsSheet } from "./components/SettingsSheet.js";
import { HistorySheet } from "./components/HistorySheet.js";
import { StatusPill } from "./components/StatusPill.js";
import { ExportBar } from "./components/ExportBar.js";
import type { ViewMode } from "./components/ViewModeControl.js";
import { HistoryIcon, SettingsIcon, RetryIcon } from "./lib/icons.js";

const VIEW_MODE_KEY = "translate.viewMode";

export function App() {
  const { user, isLoading } = useGlassUser();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Unauthorized />;
  return <Home user={user} />;
}

function Home({ user }: { user: GlassUser }) {
  const { segments, session, settings, status, reconnect } = useTranslateStream(
    user.sessionToken,
  );

  const [language, setLanguage] = useState("Spanish");
  const [speakBack, setSpeakBack] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "both",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // The stream syncs server-side settings (language + speak-back) on connect.
  useEffect(() => {
    if (!settings) return;
    setLanguage(settings.targetLang);
    setSpeakBack(settings.speakBack);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const onRetry = (segmentId: string) => {
    fetch(`/api/retry/${segmentId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.sessionToken}` },
    }).catch(() => {});
  };

  const finals = segments.filter((s) => s.isFinal && s.original.trim());
  const initial = (user.name ?? user.userId).trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-safe pb-safe">
      <header className="flex items-center gap-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-600 text-[15px] font-semibold text-white shadow-float">
          {initial || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Live Translate
          </p>
          <p className="truncate text-[16px] font-semibold tracking-tight text-white">
            {user.name ?? "You"}
          </p>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="flex items-center gap-2 pb-3">
        <LanguagePicker language={language} onChange={setLanguage} />
        <div className="flex-1" />
        <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label="History" onClick={() => setHistoryOpen(true)}>
          <HistoryIcon className="h-[18px] w-[18px]" />
        </IconButton>
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

      <TranslateView
        segments={segments}
        status={status}
        viewMode={viewMode}
        targetLang={language}
        onRetry={onRetry}
      />

      <div className="pt-3">
        <ExportBar
          startedAt={session?.startedAt ?? Date.now()}
          targetLang={language}
          lines={finals.map((s) => ({
            original: s.original,
            translated: s.translated,
          }))}
        />
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        speakBack={speakBack}
        onSpeakBackChange={setSpeakBack}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        targetLang={language}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition active:scale-90 hover:bg-white/10"
    >
      {children}
    </button>
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
          🌐
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
