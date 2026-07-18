"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlayerSignIn({
  authenticated,
  nextHref = "/player/library",
}: {
  authenticated: boolean;
  nextHref?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/player/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Player sign-in failed.");
    router.push(nextHref);
    router.refresh();
  }

  async function findInvitation(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/invitations/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = (await response.json()) as { error?: string; next?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Invitation code not found.");
    router.push(body.next ?? "/player/invitation");
  }

  return (
    <main className="platform-auth player-auth-page">
      <div className="auth-ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <section className="auth-ledger" aria-labelledby="player-sign-in-title">
        <p className="eyebrow">Player waters</p>
        <h1 id="player-sign-in-title">Open your Tall Tale Library</h1>
        <p>Sign in to continue remembered voyages, or enter the short code from a Captain&apos;s invitation.</p>
        {authenticated && (
          <Link className="brass-button auth-continue" href={nextHref}>
            {nextHref === "/player/invitation" ? "Return to invitation" : "Continue to my library"}
          </Link>
        )}
        <div className="auth-columns">
          <form onSubmit={signIn} aria-busy={busy} aria-describedby={error ? "player-sign-in-error" : undefined}>
            <h2>{authenticated ? "Use a different Player account" : "Player sign-in"}</h2>
            <label>
              <span>Player name</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="brass-button" disabled={busy} aria-busy={busy}>
              {busy ? "Opening library…" : "Open my library"}
            </button>
          </form>
          <form id="invitation-code" onSubmit={findInvitation}>
            <h2>Invitation code</h2>
            <label>
              <span>Short code</span>
              <input
                inputMode="text"
                autoCapitalize="characters"
                placeholder="ABCD-EFGH"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
            <p>Invitation links open the same ceremony automatically. Codes are checked securely and rate-limited.</p>
            <button disabled={busy} aria-busy={busy}>
              {busy ? "Checking code…" : "Find my invitation"}
            </button>
          </form>
        </div>
        {error && (
          <p id="player-sign-in-error" className="platform-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
