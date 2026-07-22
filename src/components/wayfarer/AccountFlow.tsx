"use client";

import { FormEvent, useEffect, useState } from "react";

type Mode = "register" | "sign-in" | "forgot" | "reset" | "verify" | "claim" | "merge" | "security";
type Props = { mode: Mode };

const endpoints: Record<Exclude<Mode, "security">, string> = {
  register: "/api/auth/register",
  "sign-in": "/api/auth/sign-in",
  forgot: "/api/auth/password-reset/request",
  reset: "/api/auth/password-reset/confirm",
  verify: "/api/auth/email/verify",
  claim: "/api/auth/guest/claim",
  merge: "/api/auth/guest/merge",
};

export function AccountFlow({ mode }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [csrf, setCsrf] = useState(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem("wayfarer-csrf") ?? ""),
  );
  const [sessions, setSessions] = useState<Array<{ id: string; deviceLabel?: string; current: boolean }>>([]);
  const queryToken =
    typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("token") ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === "register" && data.password !== data.confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(endpoints[mode as Exclude<Mode, "security">], {
        method: "POST",
        headers: { "content-type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ ...data, ...(mode === "merge" ? { confirm: true } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Please try again.");
      if (body.csrfToken) {
        setCsrf(body.csrfToken);
        sessionStorage.setItem("wayfarer-csrf", body.csrfToken);
      }
      setMessage(mode === "forgot" ? body.message : "Your account request was completed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "security") return;
    fetch("/api/auth/sessions")
      .then((r) => r.json())
      .then((body) => {
        setSessions(body.sessions ?? []);
        if (body.csrfToken) {
          setCsrf(body.csrfToken);
          sessionStorage.setItem("wayfarer-csrf", body.csrfToken);
        }
      })
      .catch(() => setError("Unable to load signed-in devices."));
  }, [mode]);
  async function revoke(url: string, method = "POST") {
    const response = await fetch(url, { method, headers: { "x-csrf-token": csrf } });
    if (!response.ok) {
      setError("Unable to update sessions.");
      return;
    }
    setSessions((items) => items.filter((item) => !url.includes(item.id)));
    setMessage("Session security updated.");
  }

  if (mode === "security")
    return (
      <section>
        <h1>Account security</h1>
        <p aria-live="polite">{message || error}</p>
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              {session.deviceLabel || "This device"}
              {session.current ? " (current)" : ""}
              <button onClick={() => void revoke(`/api/auth/sessions/${session.id}/revoke`)}>Revoke</button>
            </li>
          ))}
        </ul>
        <button onClick={() => void revoke("/api/auth/sessions", "DELETE")}>Sign out everywhere else</button>
      </section>
    );
  const fields =
    mode === "register"
      ? ["displayName", "email", "password", "confirmPassword"]
      : mode === "sign-in" || mode === "merge"
        ? ["login", "password"]
        : mode === "forgot"
          ? ["email"]
          : mode === "claim"
            ? ["email", "password"]
            : mode === "reset"
              ? ["password", "confirmPassword"]
              : [];
  return (
    <section>
      <h1>
        {mode === "sign-in"
          ? "Sign in"
          : mode === "forgot"
            ? "Forgot password"
            : mode === "reset"
              ? "Reset password"
              : mode === "verify"
                ? "Verify email"
                : mode === "claim"
                  ? "Claim your guest voyage"
                  : mode === "merge"
                    ? "Use an existing account"
                    : "Create your account"}
      </h1>
      <form onSubmit={submit} aria-describedby="account-status">
        {fields.map((field) => (
          <label key={field}>
            {field === "displayName"
              ? "Display name"
              : field === "login"
                ? "Email or legacy Player name"
                : field === "confirmPassword"
                  ? "Confirm password"
                  : field[0].toUpperCase() + field.slice(1)}
            <input
              name={field}
              type={field.toLowerCase().includes("password") ? "password" : field === "email" ? "email" : "text"}
              autoComplete={
                field === "email" ? "email" : field.toLowerCase().includes("password") ? "new-password" : "nickname"
              }
              required
            />
          </label>
        ))}
        {(mode === "reset" || mode === "verify") && <input name="token" type="hidden" value={queryToken} />}
        {mode === "merge" && <p>Confirming preserves your guest voyage history in this account.</p>}
        <button disabled={busy}>{busy ? "Working…" : "Continue"}</button>
      </form>
      <p id="account-status" aria-live="polite">
        {error || message}
      </p>
    </section>
  );
}
