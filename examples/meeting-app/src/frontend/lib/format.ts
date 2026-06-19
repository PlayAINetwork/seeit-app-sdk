import type { Insights } from "./types.js";

/** Time formatting helpers shared across the webview. */

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

/** Build a Markdown meeting-notes document for copy / download / share. */
export function notesToMarkdown(startedAt: number, insights: Insights | null): string {
  const lines: string[] = [`# Meeting Notes`, `_${sessionLabel(startedAt)}_`, ""];

  if (!insights) {
    lines.push("_No notes captured yet._", "");
    return lines.join("\n");
  }

  lines.push(
    `**Participants (est.):** ~${insights.participantEstimate}` +
      (insights.participants.length
        ? ` — ${insights.participants
            .map((p) => (p.role ? `${p.name} (${p.role})` : p.name))
            .join(", ")}`
        : ""),
    "",
  );

  if (insights.summary) lines.push(`## Summary`, insights.summary, "");
  if (insights.topics.length)
    lines.push(`## Topics`, ...insights.topics.map((t) => `- ${t}`), "");
  if (insights.decisions.length)
    lines.push(`## Decisions`, ...insights.decisions.map((d) => `- ${d}`), "");
  if (insights.actionItems.length)
    lines.push(
      `## Action Items`,
      ...insights.actionItems.map(
        (a) => `- [ ] ${a.text}${a.owner ? ` — _${a.owner}_` : ""}`,
      ),
      "",
    );
  if (insights.takeaways.length)
    lines.push(`## Key Takeaways`, ...insights.takeaways.map((t) => `- ${t}`), "");

  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
