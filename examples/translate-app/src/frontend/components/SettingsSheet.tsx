import { Sheet } from "./Sheet.js";
import { ViewModeControl, type ViewMode } from "./ViewModeControl.js";
import { SpeakerIcon } from "../lib/icons.js";
import { useGlassUser } from "../auth.js";

/** Settings: speak-back toggle + what to show on the stage. */
export function SettingsSheet({
  open,
  onClose,
  speakBack,
  onSpeakBackChange,
  viewMode,
  onViewModeChange,
}: {
  open: boolean;
  onClose: () => void;
  speakBack: boolean;
  onSpeakBackChange: (on: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const { user } = useGlassUser();

  const toggleSpeak = (on: boolean) => {
    onSpeakBackChange(on);
    if (!user) return;
    fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.sessionToken}`,
      },
      body: JSON.stringify({ speakBack: on }),
    }).catch(() => {});
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <SpeakerIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-white">
                Speak translations
              </p>
              <p className="text-[13px] text-zinc-400">
                Play each translation through your glasses.
              </p>
            </div>
            <Switch checked={speakBack} onChange={toggleSpeak} />
          </div>
        </div>

        <div>
          <p className="mb-2 px-1 text-[13px] font-medium text-zinc-400">
            Show on screen
          </p>
          <ViewModeControl value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
    </Sheet>
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
