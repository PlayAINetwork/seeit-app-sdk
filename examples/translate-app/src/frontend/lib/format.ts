/** Time + export formatting helpers shared across the webview. */

export function relativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;

  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return `Today ${time}`;

  const yesterday = new Date(now - 86_400_000).toDateString() === d.toDateString();
  if (yesterday) return `Yesterday ${time}`;

  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`;
}

export function sessionLabel(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface BilingualLine {
  original: string;
  translated: string | null;
}

/** Build a bilingual plain-text transcript for copy / download / share. */
export function translationToText(
  startedAt: number,
  targetLang: string,
  lines: BilingualLine[],
): string {
  const header = `SeeIt — Live Translate → ${targetLang}\n${sessionLabel(startedAt)}\n\n`;
  const body = lines
    .filter((l) => l.original.trim())
    .map((l) => `• ${l.original.trim()}\n  → ${(l.translated ?? "").trim()}`)
    .join("\n\n");
  return header + body + "\n";
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
