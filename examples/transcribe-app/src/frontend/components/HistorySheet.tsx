import { useEffect, useState } from "react";
import { Sheet } from "./Sheet.js";
import { ExportBar } from "./ExportBar.js";
import { ChevronRightIcon, ChevronLeftIcon } from "../lib/icons.js";
import { relativeTime, sessionLabel } from "../lib/format.js";
import { useGlassUser } from "../auth.js";

interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segmentCount: number;
  preview: string;
}

interface Segment {
  segmentId: string;
  text: string;
  isFinal: boolean;
}

interface SessionRecord {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  segments: Segment[];
}

/** Bottom sheet to browse past sessions and open any one read-only. */
export function HistorySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useGlassUser();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<SessionRecord | null>(null);

  const auth = user ? { Authorization: `Bearer ${user.sessionToken}` } : undefined;

  useEffect(() => {
    if (!open || !auth) return;
    setSessions(null);
    setError(false);
    setDetail(null);
    fetch("/api/sessions", { headers: auth })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openSession = (id: string) => {
    if (!auth) return;
    setDetail(null);
    fetch(`/api/sessions/${id}`, { headers: auth })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setDetail(d.session))
      .catch(() => setError(true));
  };

  const back = () => setDetail(null);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={detail ? sessionLabel(detail.startedAt) : "History"}
      leading={
        detail ? (
          <button
            onClick={back}
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-accent transition active:scale-90"
            aria-label="Back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      {detail ? (
        <SessionDetail record={detail} />
      ) : (
        <SessionList
          sessions={sessions}
          error={error}
          onOpen={openSession}
        />
      )}
    </Sheet>
  );
}

function SessionList({
  sessions,
  error,
  onOpen,
}: {
  sessions: SessionSummary[] | null;
  error: boolean;
  onOpen: (id: string) => void;
}) {
  if (error) {
    return <Empty>Couldn’t load history.</Empty>;
  }
  if (sessions === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[60px] animate-pulse rounded-2xl bg-white/[0.05]"
          />
        ))}
      </div>
    );
  }
  if (sessions.length === 0) {
    return <Empty>No sessions yet. Start speaking to create one.</Empty>;
  }
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.sessionId}>
          <button
            onClick={() => onOpen(s.sessionId)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3.5 text-left transition active:scale-[0.98] hover:bg-white/[0.07]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-white">
                  {relativeTime(s.startedAt)}
                </span>
                {s.endedAt === null && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-zinc-400">
                {s.preview || "No speech captured"}
              </p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-zinc-500">
              {s.segmentCount} {s.segmentCount === 1 ? "line" : "lines"}
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-600" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SessionDetail({ record }: { record: SessionRecord }) {
  const finals = record.segments.filter((s) => s.isFinal && s.text.trim());
  return (
    <div className="space-y-4">
      <ExportBar startedAt={record.startedAt} lines={finals.map((s) => s.text)} />
      {finals.length === 0 ? (
        <Empty>No speech was captured in this session.</Empty>
      ) : (
        <div className="space-y-3">
          {finals.map((s) => (
            <p key={s.segmentId} className="text-[15px] leading-relaxed text-zinc-200">
              {s.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-[14px] text-zinc-500">{children}</p>
  );
}
