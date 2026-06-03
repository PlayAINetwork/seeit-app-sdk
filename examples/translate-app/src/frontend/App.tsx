import { useEffect, useState } from "react";
import { useGlassUser } from "./auth.js";
import { LanguagePicker } from "./components/LanguagePicker.js";
import { TranslateView } from "./components/TranslateView.js";

export function App() {
  const { user, isLoading } = useGlassUser();
  const [language, setLanguage] = useState("Spanish");

  // Sync the user's current target language on boot.
  useEffect(() => {
    if (!user) return;
    fetch("/api/me", {
      headers: { Authorization: `Bearer ${user.sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.language && setLanguage(d.language))
      .catch(() => {});
  }, [user]);

  if (isLoading) {
    return (
      <Screen>
        <p className="text-zinc-400">Loading…</p>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 text-2xl">
            🌐
          </div>
          <h1 className="mb-2 text-lg font-semibold text-white">
            Open from your SeeIt glasses
          </h1>
          <p className="text-sm text-zinc-400">
            Launch this app from the SeeIt app and it will sign you in
            automatically.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex h-full w-full max-w-md flex-col gap-3 p-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Live translate
            </p>
            <p className="text-base font-semibold text-white">
              {user.name ?? "You"}
            </p>
          </div>
          <LanguagePicker language={language} onChange={setLanguage} />
        </header>
        <TranslateView />
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-zinc-100">
      {children}
    </div>
  );
}
