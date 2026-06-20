import { useEffect, useState } from "react";
import { Sheet } from "./Sheet.js";
import { GlobeIcon, CheckIcon } from "../lib/icons.js";
import { useGlassUser } from "../auth.js";

interface Language {
  label: string;
  value: string;
}

/**
 * Built-in language list (mirrors the server's languages.ts). Used directly so
 * the picker always works even if the /api/languages fetch fails.
 */
const FALLBACK_LANGUAGES: Language[] = [
  { label: "Spanish", value: "Spanish" },
  { label: "French", value: "French" },
  { label: "German", value: "German" },
  { label: "Italian", value: "Italian" },
  { label: "Portuguese", value: "Portuguese" },
  { label: "Hindi", value: "Hindi" },
  { label: "Japanese", value: "Japanese" },
  { label: "Korean", value: "Korean" },
  { label: "Chinese (Simplified)", value: "Simplified Chinese" },
  { label: "Arabic", value: "Arabic" },
  { label: "Russian", value: "Russian" },
  { label: "English", value: "English" },
];

/**
 * Compact pill that opens an iOS-style sheet to pick a language. By default it
 * persists the choice to the backend (`persist`); when used for the conversation
 * pair the parent handles persistence, so pass `persist={false}`.
 */
export function LanguagePicker({
  language,
  onChange,
  title = "Translate to",
  persist = true,
}: {
  language: string;
  onChange: (lang: string) => void;
  title?: string;
  persist?: boolean;
}) {
  const { user } = useGlassUser();
  const [languages, setLanguages] = useState<Language[]>(FALLBACK_LANGUAGES);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/languages", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.languages) && d.languages.length) {
          setLanguages(d.languages);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const select = (lang: string) => {
    setOpen(false);
    onChange(lang);
    if (persist && user) {
      fetch("/api/language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.sessionToken}`,
        },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  const current = languages.find((l) => l.value === language)?.label ?? language;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`${title}: ${current}`}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-white transition active:scale-95 hover:bg-white/10"
      >
        <GlobeIcon className="h-4 w-4 text-accent" />
        {current}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <ul className="space-y-1">
          {languages.map((l) => {
            const active = l.value === language;
            return (
              <li key={l.value}>
                <button
                  onClick={() => select(l.value)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition active:scale-[0.98] ${
                    active
                      ? "bg-accent-soft text-white"
                      : "text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  {l.label}
                  {active && <CheckIcon className="h-5 w-5 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
