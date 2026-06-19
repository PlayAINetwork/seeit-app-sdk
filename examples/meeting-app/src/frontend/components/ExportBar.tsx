import { useState } from "react";
import { CopyIcon, DownloadIcon, ShareIcon, CheckIcon } from "../lib/icons.js";
import { downloadText, notesToMarkdown } from "../lib/format.js";
import type { Insights } from "../lib/types.js";

/**
 * Copy / Save / Share toolbar for the current meeting. Builds a Markdown notes
 * document from the latest insights.
 */
export function ExportBar({
  startedAt,
  insights,
}: {
  startedAt: number;
  insights: Insights | null;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !insights;

  const text = () => notesToMarkdown(startedAt, insights);
  const filename = () =>
    `meeting-notes-${new Date(startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const share = async () => {
    const data = { title: "Meeting Notes", text: text() };
    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled — fall through */
      }
    }
    void copy();
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 backdrop-blur-xl">
      <Btn onClick={copy} disabled={disabled} active={copied}
        icon={copied ? <CheckIcon className="h-[18px] w-[18px]" /> : <CopyIcon className="h-[18px] w-[18px]" />}
        label={copied ? "Copied" : "Copy"} />
      <Btn onClick={() => downloadText(filename(), text())} disabled={disabled}
        icon={<DownloadIcon className="h-[18px] w-[18px]" />} label="Save" />
      <Btn onClick={share} disabled={disabled}
        icon={<ShareIcon className="h-[18px] w-[18px]" />} label="Share" />
    </div>
  );
}

function Btn({
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
        active ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-200 hover:bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
