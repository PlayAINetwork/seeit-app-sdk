/** Time + export formatting helpers shared across the webview. */

/** "Just now", "12 min ago", "Today 14:32", or a date for older sessions. */
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

/** Wall-clock label for a session header, e.g. "Jun 19, 14:32". */
export function sessionLabel(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ExportLine {
  text: string;
}

/** Build a plain-text transcript for copy / download / share. */
export function transcriptToText(
  startedAt: number,
  lines: ExportLine[],
): string {
  const header = `SeeIt — Live Transcript\n${sessionLabel(startedAt)}\n\n`;
  const body = lines
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join("\n");
  return header + body + "\n";
}

/** Trigger a browser download of `text` as a .txt file. */
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
