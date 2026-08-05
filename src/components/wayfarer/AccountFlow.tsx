"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { authorizedReturnTo, safeReturnTo } from "@/homeport/return-to";

type Mode =
  | "register"
  | "sign-in"
  | "forgot"
  | "reset"
  | "verify"
  | "email-change"
  | "claim"
  | "merge"
  | "security";
type Props = {
  mode: Mode;
  query?: { returnTo?: string; return?: string; reason?: string; token?: string };
};

const endpoints: Record<Exclude<Mode, "security">, string> = {
  register: "/api/auth/register",
  "sign-in": "/api/auth/sign-in",
  forgot: "/api/auth/password-reset/request",
  reset: "/api/auth/password-reset/confirm",
  verify: "/api/auth/email/verify",
  "email-change": "/api/account/email/change/confirm",
  claim: "/api/auth/guest/claim",
  merge: "/api/auth/guest/merge",
};

export function AccountFlow({ mode, query }: Props) {
  const router = useRouter();
  const { state: currentUser, invalidate } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [csrf, setCsrf] = useState(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem("wayfarer-csrf") ?? ""),
  );
  const [sessions, setSessions] = useState<Array<{ id: string; deviceLabel?: string; current: boolean }>>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const returnTo = safeReturnTo(query?.returnTo ?? query?.return, "");
  const reason = query?.reason ?? "";
  const queryToken = query?.token ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if ((mode === "register" || mode === "reset") && data.password !== data.confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(endpoints[mode as Exclude<Mode, "security">], {
        method: "POST",
        headers: { "content-type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({
          ...data,
          ...(returnTo ? { returnTo } : {}),
          ...(mode === "merge" ? { confirm: true } : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Please try again.");
      if (body?.csrfToken) {
        setCsrf(body.csrfToken);
        sessionStorage.setItem("wayfarer-csrf", body.csrfToken);
      }
      if (["register", "sign-in", "reset", "claim", "merge"].includes(mode)) {
        const nextContext = await invalidate();
        if (nextContext.status !== "authenticated")
          throw new Error("Your account changed, but the new session could not be verified.");
        const next = authorizedReturnTo(body?.next ?? returnTo, nextContext, "/passport");
        setMessage("Your account is ready. Opening your destination.");
        router.replace(next);
        router.refresh();
      } else if (mode === "verify") {
        await invalidate();
        setMessage("Your email is verified. Continue to your account.");
      } else if (mode === "email-change") {
        sessionStorage.removeItem("wayfarer-csrf");
        await invalidate();
        setMessage("Your primary email was changed and existing sessions were ended. Sign in with the new address.");
      } else {
        setMessage(mode === "forgot" ? body?.message : "Your account request was completed.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "security") return;
    fetch("/api/auth/sessions")
      .then((response) => response.json())
      .then((body) => {
        setSessions(body.sessions ?? []);
        if (body.csrfToken) {
          setCsrf(body.csrfToken);
          sessionStorage.setItem("wayfarer-csrf", body.csrfToken);
        }
      })
      .catch(() => setError("Unable to load signed-in devices."));
  }, [mode]);

  async function revoke(url: string, method = "POST", currentSession = false) {
    const response = await fetch(url, { method, headers: { "x-csrf-token": csrf } });
    if (!response.ok) {
      setError("Unable to update sessions.");
      return;
    }
    setSessions((items) => items.filter((item) => !url.includes(item.id)));
    setMessage("Session security updated.");
    const nextContext = await invalidate();
    if (currentSession || nextContext.status !== "authenticated") {
      router.replace("/");
      router.refresh();
    }
  }

  async function signOutEverywhere() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/sign-out-all", {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    if (!response.ok) {
      setBusy(false);
      setError("Unable to sign out all devices.");
      return;
    }
    sessionStorage.removeItem("wayfarer-csrf");
    await invalidate();
    router.replace("/");
    router.refresh();
  }

  if (mode === "security")
    return (
      <main className="platform-auth account-flow-page">
        <div className="auth-ledger">
          <p className="eyebrow">Voyagewright account</p>
          <h1>Account security</h1>
          <p>Review active account sessions without changing Voyage or Chronicle progress.</p>
          <p className={error ? "platform-error" : ""} aria-live="polite">
            {message || error}
          </p>
          <ul className="account-session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <span>
                  {session.deviceLabel || "This device"}
                  {session.current ? " (current)" : ""}
                </span>
                <button onClick={() => void revoke(`/api/auth/sessions/${session.id}/revoke`, "POST", session.current)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => void revoke("/api/auth/sessions", "DELETE")}>Sign out everywhere else</button>
          <button disabled={busy} onClick={() => void signOutEverywhere()}>
            {busy ? "Signing out…" : "Sign out all devices"}
          </button>
        </div>
      </main>
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
    <main className="platform-auth account-flow-page">
      <div className="auth-ledger">
        <p className="eyebrow">One Voyagewright account</p>
        <h1>
          {mode === "sign-in"
            ? "Sign in"
            : mode === "forgot"
              ? "Forgot password"
              : mode === "reset"
                ? "Reset password"
                : mode === "verify"
                  ? "Verify email"
                  : mode === "email-change"
                    ? "Confirm email change"
                  : mode === "claim"
                    ? "Claim your guest voyage"
                    : mode === "merge"
                      ? "Use an existing account"
                      : "Create your account"}
        </h1>
        <p className="account-flow-intro">
          {mode === "sign-in"
            ? "Use one account across Player, Captain, Creator, Community, and Chronicle Passport."
            : mode === "register"
              ? "Create one identity for every Voyagewright workspace."
              : "Complete this account step securely, then continue where you intended."}
        </p>
        {mode === "sign-in" && reason ? (
          <p className="account-flow-notice" role="status">
            {reason === "expired"
              ? "Your session expired. Sign in again; no Voyage progress has changed."
              : reason === "revoked" || reason === "invalid"
                ? "That session ended. Sign in again to continue."
                : "Sign in to continue."}
          </p>
        ) : null}
        {mode === "sign-in" && currentUser.status === "authenticated" ? (
          <p className="account-flow-notice">
            Signed in as {currentUser.user.displayName}.{" "}
            <Link href={authorizedReturnTo(returnTo, currentUser, "/passport")}>Continue without signing in again</Link>
          </p>
        ) : null}
        <form onSubmit={submit} aria-describedby="account-status">
          {fields.map((field) => (
            <label key={field}>
              <span>
                {field === "displayName"
                  ? "Display name"
                  : field === "login"
                    ? "Email or legacy Player name"
                    : field === "confirmPassword"
                      ? "Confirm password"
                      : field[0].toUpperCase() + field.slice(1)}
              </span>
              <input
                name={field}
                value={values[field] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                type={field.toLowerCase().includes("password") ? "password" : field === "email" ? "email" : "text"}
                autoComplete={
                  field === "email"
                    ? "email"
                    : field === "login"
                      ? "username"
                      : field.toLowerCase().includes("password")
                        ? mode === "sign-in" || mode === "merge"
                          ? "current-password"
                          : "new-password"
                        : "nickname"
                }
                disabled={currentUser.status === "loading"}
                required
              />
            </label>
          ))}
          {(mode === "reset" || mode === "verify" || mode === "email-change") && (
            <input name="token" type="hidden" value={queryToken} />
          )}
          {mode === "merge" && <p>Confirming preserves your guest voyage history in this account.</p>}
          <button className="brass-button" disabled={busy || currentUser.status === "loading"}>
            {busy ? "Working…" : "Continue"}
          </button>
        </form>
        {mode === "sign-in" ? (
          <nav className="account-flow-nav" aria-label="Account help">
            <Link href={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>Create Account</Link>{" "}
            <Link href={`/forgot-password${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
              Forgot Password
            </Link>
          </nav>
        ) : null}
        {mode === "register" ? (
          <Link
            className="account-flow-nav"
            href={`/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
          >
            Already have an account? Sign in
          </Link>
        ) : null}
        {mode === "email-change" && message ? (
          <Link className="account-flow-nav" href="/sign-in">
            Sign in with the new email
          </Link>
        ) : null}
        <p id="account-status" className={error ? "platform-error" : "account-flow-status"} aria-live="polite">
          {error || message}
        </p>
      </div>
    </main>
  );
}
