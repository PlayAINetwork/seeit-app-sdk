import { AnimatePresence, motion } from "framer-motion";
import type { Insights } from "../lib/types.js";
import {
  SparklesIcon,
  TagIcon,
  TargetIcon,
  CheckSquareIcon,
  NotesIcon,
} from "../lib/icons.js";

/**
 * Renders the LLM-derived meeting intelligence: summary, topics, decisions,
 * action items, and key takeaways. Sections appear only when they have content
 * and animate in as the notes update.
 */
export function NotesPanel({
  insights,
  live,
}: {
  insights: Insights | null;
  live: boolean;
}) {
  if (!insights || (!insights.summary && insights.takeaways.length === 0)) {
    return <EmptyNotes live={live} />;
  }

  return (
    <div className="space-y-3 pb-2">
      {insights.summary && (
        <Card icon={<SparklesIcon className="h-4 w-4" />} title="Summary" tint="text-accent">
          <p className="text-[15px] leading-relaxed text-zinc-100">
            {insights.summary}
          </p>
        </Card>
      )}

      {insights.topics.length > 0 && (
        <Card icon={<TagIcon className="h-4 w-4" />} title="Topics" tint="text-sky-300">
          <div className="flex flex-wrap gap-2">
            {insights.topics.map((t, i) => (
              <motion.span
                key={t + i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[13px] text-zinc-200"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </Card>
      )}

      {insights.decisions.length > 0 && (
        <Card icon={<TargetIcon className="h-4 w-4" />} title="Decisions" tint="text-violet-300">
          <BulletList items={insights.decisions} dot="bg-violet-400" />
        </Card>
      )}

      {insights.actionItems.length > 0 && (
        <Card icon={<CheckSquareIcon className="h-4 w-4" />} title="Action Items" tint="text-emerald-300">
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {insights.actionItems.map((a, i) => (
                <motion.li
                  key={a.text + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-400/10" />
                  <span className="text-[15px] leading-snug text-zinc-100">
                    {a.text}
                    {a.owner && (
                      <span className="ml-1.5 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                        {a.owner}
                      </span>
                    )}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}

      {insights.takeaways.length > 0 && (
        <Card icon={<NotesIcon className="h-4 w-4" />} title="Key Takeaways" tint="text-amber-300">
          <BulletList items={insights.takeaways} dot="bg-amber-400" />
        </Card>
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  tint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-4"
    >
      <div className={`mb-2.5 flex items-center gap-2 ${tint}`}>
        {icon}
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em]">
          {title}
        </h3>
      </div>
      {children}
    </motion.section>
  );
}

function BulletList({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it + i} className="flex items-start gap-2.5">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span className="text-[15px] leading-snug text-zinc-100">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyNotes({ live }: { live: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <SparklesIcon className={`h-7 w-7 ${live ? "animate-breathe" : ""}`} />
      </div>
      <p className="text-[17px] font-semibold text-white">
        {live ? "Listening to the room…" : "No notes yet"}
      </p>
      <p className="mt-1.5 max-w-[17rem] text-[14px] leading-relaxed text-zinc-500">
        {live
          ? "As the conversation flows, notes, decisions and takeaways will appear here automatically."
          : "Start a meeting from your glasses and notes will be captured live."}
      </p>
    </div>
  );
}
