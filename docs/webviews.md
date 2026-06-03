# Webviews

A **webview** lets your app show a custom web UI to the user inside the SeeIt
app — settings, dashboards, content, anything you can build on the web. SeeIt
opens your URL in an in-app browser and passes the signed-in user's identity to
it automatically, so there's no separate login.

## How it works — the Glass launch handshake

1. You register a **webview URL** on your app in the SeeIt developer console.
2. When the user opens your app, SeeIt appends a short-lived **launch token** to
   your URL as the `glass_launch_token` query parameter and loads it.
3. Your web frontend reads that token, pulls out the `userId` and a durable
   **session token**, and stores the session token.
4. Your frontend calls **your own backend** with
   `Authorization: Bearer <sessionToken>`.
5. Your backend verifies that token with `verifySessionToken()` — done.

```
SeeIt app ──opens──▶  https://your-app.com/?glass_launch_token=<JWT>
                          │  (frontend reads token → userId + sessionToken)
                          ▼
your frontend ──Bearer sessionToken──▶ your backend ──verifySessionToken()──▶ { userId }
```

### Two tokens

| Token | Lifetime | Where it lives | Purpose |
|-------|----------|----------------|---------|
| **launch token** | ~5 min | `glass_launch_token` URL param | Bootstraps the page. Carries the session token. |
| **session token** | ~24h | `Authorization: Bearer` header | Durable credential for your API. |

Both are EdDSA JWTs signed by SeeIt with `iss: "glass"` and `aud: <yourAppId>`.
You verify them against SeeIt's public JWKS — there is **no shared secret**.

JWKS endpoint: `https://<seeit-host>/glass/.well-known/jwks.json`

---

## Backend: verify the token

```ts
import { verifySessionToken } from "@seeit/glass-sdk";

app.get("/api/me", async (req, res) => {
  try {
    const { userId, tokenType } = await verifySessionToken(
      req.headers.authorization,        // "Bearer <sessionToken>"
      { appId: process.env.SEEIT_APP_ID! }
    );
    res.json({ userId });
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
});
```

`verifySessionToken(token, options)`:

- `token` — the raw JWT or a full `Authorization` header (a leading `Bearer ` is
  stripped for you). Accepts both the launch token and the session token.
- `options.appId` — **required.** The token's `aud` must equal this, so a token
  minted for another app can't be replayed against yours.
- `options.jwksUrl` — optional. Defaults to SeeIt's production JWKS. Point it at
  your local/staging SeeIt host during development.

Returns a `SessionClaims` object
`{ userId, appId, tokenType, name?, email?, sessionToken?, expiresAt? }` and
**throws** on a bad signature, wrong issuer/audience, or expiry. (`sessionToken`
is only present when you verify a *launch* token.)

---

## Frontend: read the launch token (React)

There's no required frontend dependency — read the query param, hand the token to
your backend, and let the backend verify it. Here's a drop-in hook:

```tsx
import { createContext, useContext, useEffect, useState } from "react";

interface GlassUser {
  userId: string;
  sessionToken: string;
}

const GlassAuthContext = createContext<{
  user: GlassUser | null;
  isLoading: boolean;
  logout: () => void;
} | null>(null);

function decodeJwt(token: string): any {
  const [, payload] = token.split(".");
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}

export function GlassAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GlassUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(
      "glass_launch_token"
    );
    if (fromUrl) {
      const claims = decodeJwt(fromUrl); // signature is verified by your backend
      const next = { userId: claims.sub, sessionToken: claims.sessionToken };
      localStorage.setItem("glass.userId", next.userId);
      localStorage.setItem("glass.sessionToken", next.sessionToken);
      setUser(next);
      // clean the token out of the address bar
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      const userId = localStorage.getItem("glass.userId");
      const sessionToken = localStorage.getItem("glass.sessionToken");
      if (userId && sessionToken) setUser({ userId, sessionToken });
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem("glass.userId");
    localStorage.removeItem("glass.sessionToken");
    setUser(null);
  };

  return (
    <GlassAuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </GlassAuthContext.Provider>
  );
}

export function useGlassUser() {
  const ctx = useContext(GlassAuthContext);
  if (!ctx) throw new Error("useGlassUser must be used within GlassAuthProvider");
  return ctx;
}
```

Then call your API with the session token:

```ts
const { user } = useGlassUser();

await fetch("/api/me", {
  headers: { Authorization: `Bearer ${user.sessionToken}` },
});
```

> The frontend only *decodes* the launch token to read `userId`/`sessionToken`.
> The **trust** decision happens on your backend via `verifySessionToken()`, which
> checks the signature against SeeIt's JWKS. Never trust a decoded token for
> anything sensitive without verifying it server-side.

---

## Notes

- Keep the launch token out of logs and out of the address bar after reading it
  (the snippet above clears it with `history.replaceState`).
- The launch token is short-lived by design — it only bootstraps the page. The
  session token is what your API should accept on every request.
- A token minted for one app won't verify for another (`aud` binding), so always
  pass your real `appId`.
