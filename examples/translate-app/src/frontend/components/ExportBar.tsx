import { useState } from "react";
import { CopyIcon, DownloadIcon, ShareIcon, CheckIcon } from "../lib/icons.js";
import {
  downloadText,
  translationToText,
  type BilingualLine,
} from "../lib/format.js";
import { useToast } from "./Toast.js";

/**
 * Copy / Save / Share toolbar for the current session. Pure client-side: builds
 * a bilingual (original → translation) plain-text transcript.
 */
export function ExportBar({
  startedAt,
  targetLang,
  lines,
}: {
  startedAt: number;
  targetLang: string;
  lines: BilingualLine[];
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const disabled = lines.length === 0;

  const text = () => translationToText(startedAt, targetLang, lines);
  const filename = () =>
    `seeit-translate-${new Date(startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast("Copy blocked by the browser — try Save instead", "error");
    }
  };

  const share = async () => {
    const data = { title: "SeeIt Translation", text: text() };
    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    void copy();
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 backdrop-blur-xl">
      <ToolbarButton
        onClick={copy}
        disabled={disabled}
        icon={copied ? <CheckIcon className="h-[18px] w-[18px]" /> : <CopyIcon className="h-[18px] w-[18px]" />}
        label={copied ? "Copied" : "Copy"}
        active={copied}
      />
      <ToolbarButton
        onClick={() => downloadText(filename(), text())}
        disabled={disabled}
        icon={<DownloadIcon className="h-[18px] w-[18px]" />}
        label="Save"
      />
      <ToolbarButton
        onClick={share}
        disabled={disabled}
        icon={<ShareIcon className="h-[18px] w-[18px]" />}
        label="Share"
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium transition active:scale-[0.97] disabled:opacity-35 ${
        active
          ? "bg-emerald-500/20 text-emerald-300"
          : "text-zinc-200 hover:bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
