"use client";
import { useState } from "react";
export function AccessGate({ campaignSlug }: { campaignSlug: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/player/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignSlug, accessCode: form.get("accessCode") }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    location.reload();
  }
  return (
    <main className="access-scene">
      <section className="access-card" aria-labelledby="invitation-title">
        <div className="wax-emblem" aria-hidden="true">
          F
        </div>
        <p className="eyebrow">Private invitation</p>
        <h1 id="invitation-title">The journal knows its sailor</h1>
        <p>Speak the phrase tucked inside your invitation. Nothing beyond the seal has been sent to this page.</p>
        <form onSubmit={submit}>
          <label htmlFor="accessCode">Invitation phrase</label>
          <input
            id="accessCode"
            name="accessCode"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
          />
          <button className="brass-button" disabled={busy}>
            {busy ? "Listening to the tide…" : "Open the journal"}
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
