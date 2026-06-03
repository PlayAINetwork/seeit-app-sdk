import { useEffect, useRef, useState } from "react";
import { useGlassUser } from "../auth.js";

interface Language {
  label: string;
  value: string;
}

/**
 * Pill button showing the current target language; tap to choose another.
 * Persists the choice to the backend (applies to future segments).
 */
export function LanguagePicker({
  language,
  onChange,
}: {
  language: string;
  onChange: (lang: string) => void;
}) {
  const { user } = useGlassUser();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d) => setLanguages(d.languages ?? []))
      .catch(() => {});
  }, []);

  // close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const select = (lang: string) => {
    setOpen(false);
    onChange(lang);
    if (!user) return;
    fetch("/api/language", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.sessionToken}`,
      },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {});
  };

  const current = languages.find((l) => l.value === language)?.label ?? language;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/15"
      >
        <span className="text-zinc-400">Translate to</span>
        <span>{current}</span>
        <span className="text-zinc-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 max-h-72 w-48 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-1 shadow-xl backdrop-blur">
          {languages.map((l) => (
            <button
              key={l.value}
              onClick={() => select(l.value)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                l.value === language
                  ? "bg-indigo-500/90 text-white"
                  : "text-zinc-200 hover:bg-white/10"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
