import { motion } from "framer-motion";
import { Sheet } from "./Sheet.js";
import { ViewModeControl, type ViewMode } from "./ViewModeControl.js";
import { LanguagePicker } from "./LanguagePicker.js";
import { SpeakerIcon } from "../lib/icons.js";
import type { Mode } from "../hooks/useTranslateStream.js";

/** Settings: translation mode, languages, speak-back, and what to show. */
export function SettingsSheet({
  open,
  onClose,
  mode,
  onModeChange,
  language,
  onLanguageChange,
  langA,
  langB,
  onLangAChange,
  onLangBChange,
  speakBack,
  onSpeakBackChange,
  viewMode,
  onViewModeChange,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  language: string;
  onLanguageChange: (l: string) => void;
  langA: string;
  langB: string;
  onLangAChange: (l: string) => void;
  onLangBChange: (l: string) => void;
  speakBack: boolean;
  onSpeakBackChange: (on: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-6">
        <Section label="Mode">
          <ModeControl value={mode} onChange={onModeChange} />
        </Section>

        {mode === "conversation" ? (
          <>
            <Section label="Conversation languages">
              <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <Row label="Language A">
                  <LanguagePicker
                    language={langA}
                    onChange={onLangAChange}
                    title="Language A"
                    persist={false}
                  />
                </Row>
                <Row label="Language B">
                  <LanguagePicker
                    language={langB}
                    onChange={onLangBChange}
                    title="Language B"
                    persist={false}
                  />
                </Row>
              </div>
            </Section>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <SpeakerIcon className="h-5 w-5" />
              </div>
              <p className="text-[13px] text-zinc-300">
                Translations are spoken aloud — always on in Conversation.
              </p>
            </div>
          </>
        ) : (
          <>
            <Section label="Translate to">
              <Row label="Target language">
                <LanguagePicker
                  language={language}
                  onChange={onLanguageChange}
                  title="Translate to"
                  persist={false}
                />
              </Row>
            </Section>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <SpeakerIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-white">Speak translations</p>
                <p className="text-[13px] text-zinc-400">
                  Play each translation through your glasses.
                </p>
              </div>
              <Switch checked={speakBack} onChange={onSpeakBackChange} />
            </div>
          </>
        )}

        <Section label="Show on screen">
          <ViewModeControl value={viewMode} onChange={onViewModeChange} />
        </Section>
      </div>
    </Sheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[13px] font-medium text-zinc-400">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1">
      <span className="text-[14px] text-zinc-300">{label}</span>
      {children}
    </div>
  );
}

function ModeControl({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  const opts: { value: Mode; label: string }[] = [
    { value: "oneway", label: "One-way" },
    { value: "conversation", label: "Conversation" },
  ];
  return (
    <div className="flex rounded-full bg-white/[0.06] p-1 backdrop-blur">
      {opts.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="relative flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition"
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-white/[0.14]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative ${active ? "text-white" : "text-zinc-400"}`}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Minimal iOS-style switch. */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label="Speak translations"
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-emerald-500" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-all duration-200 ${
          checked ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}
