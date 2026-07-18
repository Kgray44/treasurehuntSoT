"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StaffSignIn({
  intent,
  authorized,
  signedIn,
}: {
  intent: "captain" | "creator";
  authorized: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = intent === "captain" ? "Captain's Command" : "Tall Tale Studio";
  const destination = intent === "captain" ? "/captain/library" : "/studio/library";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/gm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(body.error ?? "Sign-in failed.");
    }
    const statusResponse = await fetch("/api/gateway/status", { cache: "no-store" });
    const status = (await statusResponse.json()) as Record<string, { authenticated: boolean }>;
    setBusy(false);
    if (!status[intent]?.authenticated)
      return setError(
        `This account is signed in but does not have ${intent === "captain" ? "Captain" : "Creator"} permission.`,
      );
    router.push(destination);
    router.refresh();
  }

  return (
    <main className={`platform-auth staff-auth-page intent-${intent}`}>
      <section className="auth-ledger" aria-labelledby="staff-sign-in-title">
        <Link href="/">Return to role selection</Link>
        <p className="eyebrow">{intent === "captain" ? "Operational waters" : "Authoring waters"}</p>
        <h1 id="staff-sign-in-title">Enter {title}</h1>
        <p>
          {intent === "captain"
            ? "Guide live voyages and manage secure invitations."
            : "Author, validate, publish, compare, and preserve immutable editions."}
        </p>
        {authorized ? (
          <Link className="brass-button auth-continue" href={destination}>
            Continue to {title}
          </Link>
        ) : signedIn ? (
          <p className="platform-error" role="alert">
            Your current account is not authorized for this workspace. Return to a role you are allowed to use.
          </p>
        ) : null}
        <form onSubmit={submit}>
          <label>
            <span>Username</span>
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
          <button className="brass-button" disabled={busy}>
            {busy ? "Checking the ledger…" : `Enter ${title}`}
          </button>
        </form>
        {error && (
          <p className="platform-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
