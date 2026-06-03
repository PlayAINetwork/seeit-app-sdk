import { useGlassUser } from "./auth.js";
import { TranscriptDisplay } from "./components/TranscriptDisplay.js";

export function App() {
  const { user, isLoading } = useGlassUser();

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
            👓
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
      <div className="flex h-full w-full max-w-md flex-col gap-4 p-4">
        <Header name={user.name} userId={user.userId} />
        <TranscriptDisplay />
      </div>
    </Screen>
  );
}

function Header({ name, userId }: { name?: string; userId: string }) {
  // One-way app: identity comes from the launch token, no server round-trip.
  return (
    <header className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-sm text-zinc-400">Live transcript</p>
      <p className="text-base font-semibold text-white">{name ?? userId}</p>
    </header>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-zinc-100">
      {children}
    </div>
  );
}
