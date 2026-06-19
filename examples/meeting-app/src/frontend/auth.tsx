import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface GlassUser {
  userId: string;
  sessionToken: string;
  name?: string;
}

interface GlassAuthValue {
  user: GlassUser | null;
  isLoading: boolean;
  logout: () => void;
}

const GlassAuthContext = createContext<GlassAuthValue | null>(null);

const LS_USER_ID = "glass.userId";
const LS_SESSION_TOKEN = "glass.sessionToken";
const LS_NAME = "glass.name";

/** Decode a JWT payload without verifying — the server verifies for real. */
function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

/**
 * Reads the SeeIt launch token from the URL on first load, persists the user +
 * session token, and exposes them via {@link useGlassUser}.
 *
 * The launch token is only *decoded* here to populate the UI; trust happens on
 * the backend, which verifies every request with `verifySessionToken`.
 */
export function GlassAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GlassUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const launchToken = new URLSearchParams(window.location.search).get(
      "glass_launch_token"
    );

    if (launchToken) {
      try {
        const claims = decodeJwt(launchToken);
        const next: GlassUser = {
          userId: String(claims.sub ?? ""),
          sessionToken: String(claims.sessionToken ?? ""),
          ...(typeof claims.name === "string" ? { name: claims.name } : {}),
        };
        localStorage.setItem(LS_USER_ID, next.userId);
        localStorage.setItem(LS_SESSION_TOKEN, next.sessionToken);
        if (next.name) localStorage.setItem(LS_NAME, next.name);
        setUser(next);
      } catch {
        // malformed token — fall through to the unauthenticated state
      }
      // Scrub the token out of the address bar.
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      const userId = localStorage.getItem(LS_USER_ID);
      const sessionToken = localStorage.getItem(LS_SESSION_TOKEN);
      const name = localStorage.getItem(LS_NAME) ?? undefined;
      if (userId && sessionToken) {
        setUser({ userId, sessionToken, ...(name ? { name } : {}) });
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem(LS_USER_ID);
    localStorage.removeItem(LS_SESSION_TOKEN);
    localStorage.removeItem(LS_NAME);
    setUser(null);
  };

  return (
    <GlassAuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </GlassAuthContext.Provider>
  );
}

export function useGlassUser(): GlassAuthValue {
  const ctx = useContext(GlassAuthContext);
  if (!ctx) throw new Error("useGlassUser must be used within <GlassAuthProvider>");
  return ctx;
}
