"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { authorizedReturnTo, safeReturnTo } from "@/homeport/return-to";
import { assessPassword } from "@/wayfarer/password-policy";

type Mode = "register" | "sign-in" | "forgot" | "reset" | "verify" | "email-change" | "claim" | "merge" | "security";
type Props = {
  mode: Mode;
  query?: {
    returnTo?: string;
    return?: string;
    reason?: string;
    token?: string;
    email?: string;
    delivery?: string;
    action?: string;
    provider?: string;
  };
  initialCsrf?: string;
  maskedEmail?: string;
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

function primaryActionLabel(mode: Exclude<Mode, "security">) {
  return {
    register: "Create account",
    "sign-in": "Sign in",
    forgot: "Send reset instructions",
    reset: "Reset password",
    verify: "Verify email",
    "email-change": "Confirm email change",
    claim: "Claim voyage",
    merge: "Use this account",
  }[mode];
}

export function AccountFlow({ mode, query, initialCsrf = "", maskedEmail }: Props) {
  const router = useRouter();
  const { state: currentUser, invalidate } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [csrf, setCsrf] = useState(
    () => initialCsrf || (typeof window === "undefined" ? "" : (sessionStorage.getItem("wayfarer-csrf") ?? "")),
  );
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationDestination, setVerificationDestination] = useState(maskedEmail ?? "your email address");
  const [changingVerificationEmail, setChangingVerificationEmail] = useState(query?.action === "change");
  const [replacementEmail, setReplacementEmail] = useState("");
  const [sessions, setSessions] = useState<Array<{ id: string; deviceLabel?: string; current: boolean }>>([]);
  const [oauthProviders, setOauthProviders] = useState<
    Array<{ provider: "GOOGLE" | "GITHUB"; name: string; available: boolean; status: string }>
  >([
    { provider: "GOOGLE", name: "Google", available: false, status: "CHECKING" },
    { provider: "GITHUB", name: "GitHub", available: false, status: "CHECKING" },
  ]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initialValues: Record<string, string> = {};
    if (mode === "sign-in" && query?.email) initialValues.login = query.email;
    return initialValues;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const verificationCodeRef = useRef<HTMLInputElement>(null);
  const returnTo = safeReturnTo(query?.returnTo ?? query?.return, "");
  const reason = query?.reason ?? "";
  const queryToken = query?.token ?? "";
  const passwordAssessment = assessPassword(values.password ?? "", {
    email: values.email,
    displayName: values.displayName,
  });
  const passwordStrengthValue = { TOO_WEAK: 0, WEAK: 1, GOOD: 2, STRONG: 3 }[passwordAssessment.level];
  const confirmationMatches = (values.confirmPassword ?? "") === (values.password ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setFieldErrors({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if ((mode === "register" || mode === "reset") && data.password !== data.confirmPassword) {
      setError("Passwords do not match.");
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      window.requestAnimationFrame(() => inputRefs.current.confirmPassword?.focus());
      setBusy(false);
      return;
    }
    if (mode === "register" && !passwordAssessment.acceptable) {
      setError(passwordAssessment.message);
      setFieldErrors({ password: passwordAssessment.message });
      window.requestAnimationFrame(() => inputRefs.current.password?.focus());
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
      if (!response.ok) {
        if (mode === "register" && body?.conflict === "EMAIL_CONFLICT") {
          const handoff = new URLSearchParams({
            email: body?.handoff?.email ?? String(data.email ?? ""),
            reason: "account-exists",
          });
          if (returnTo) handoff.set("returnTo", returnTo);
          router.replace(`/sign-in?${handoff.toString()}`);
          router.refresh();
          return;
        }
        if (body?.field && typeof body.error === "string") {
          setFieldErrors({ [body.field]: body.error });
          window.requestAnimationFrame(() => inputRefs.current[body.field]?.focus());
          return;
        }
        throw new Error(body?.error ?? "Please try again.");
      }
      if (body?.csrfToken) {
        setCsrf(body.csrfToken);
        sessionStorage.setItem("wayfarer-csrf", body.csrfToken);
      }
      if (body?.verificationRequired) {
        setMessage(
          body?.registrationState === "ACCOUNT_CREATED_DELIVERY_FAILED"
            ? "Your account was created, but we could not send the verification email."
            : "Account created. Opening secure email verification.",
        );
        router.replace(body.next ?? "/verify-email");
        router.refresh();
      } else if (["register", "sign-in", "reset", "claim", "merge"].includes(mode)) {
        const nextContext = await invalidate();
        if (nextContext.status !== "authenticated")
          throw new Error("Your account changed, but the new session could not be verified.");
        const next = authorizedReturnTo(body?.next ?? returnTo, nextContext, "/passport");
        setMessage("Your account is ready. Opening your destination.");
        router.replace(next);
        router.refresh();
      } else if (mode === "verify") {
        const nextContext = await invalidate();
        if (nextContext.status !== "authenticated")
          throw new Error("Email was verified, but the new account session could not be confirmed.");
        setMessage("Your email is verified. Opening your account.");
        router.replace(authorizedReturnTo(body?.next ?? returnTo, nextContext, "/passport"));
        router.refresh();
      } else if (mode === "email-change") {
        sessionStorage.removeItem("wayfarer-csrf");
        await invalidate();
        setMessage("Your primary email was changed and existing sessions were ended. Sign in with the new address.");
      } else {
        setMessage(mode === "forgot" ? body?.message : "Your account request was completed.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      if (mode === "verify") window.requestAnimationFrame(() => verificationCodeRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "register" && mode !== "sign-in") return;
    let active = true;
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("provider inventory unavailable"))))
      .then((body: { providers?: typeof oauthProviders }) => {
        if (active && body.providers) setOauthProviders(body.providers);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mode]);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function resendCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/verification/resend", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      });
      const body = (await response.json().catch(() => null)) as { cooldownSeconds?: number; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "A new code could not be sent.");
      setResendCooldown(body?.cooldownSeconds ?? 60);
      setMessage("A new six-digit code was sent. Earlier codes no longer work.");
      verificationCodeRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A new code could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function changeVerificationEmail() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/verification/change", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ email: replacementEmail }),
      });
      const body = (await response.json().catch(() => null)) as {
        maskedEmail?: string;
        cooldownSeconds?: number;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "The registration email could not be changed.");
      setVerificationDestination(body?.maskedEmail ?? "your updated email address");
      setResendCooldown(body?.cooldownSeconds ?? 60);
      setChangingVerificationEmail(false);
      setReplacementEmail("");
      setValues((current) => ({ ...current, code: "" }));
      setMessage("Email updated. Enter the newest code sent to the new address.");
      window.requestAnimationFrame(() => verificationCodeRef.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The registration email could not be changed.");
    } finally {
      setBusy(false);
    }
  }

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
              : mode === "verify"
                ? ["code"]
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
              : mode === "verify"
                ? `Enter the six-digit code sent to ${verificationDestination}. Codes expire after ten minutes.`
                : "Complete this account step securely, then continue where you intended."}
        </p>
        {mode === "sign-in" && reason ? (
          <p className="account-flow-notice" role="status">
            {reason === "account-exists"
              ? "An account already uses this email address. Sign in instead."
              : reason === "oauth-email-collision"
                ? "That provider email already belongs to a Voyagewright account. Sign in to that account, then connect the provider in Settings."
                : reason === "oauth-cancelled"
                  ? "Provider sign-in was cancelled. Your Voyagewright account was not changed."
                  : reason === "oauth-unavailable"
                    ? "That provider is not configured in this environment. Use another available sign-in method."
                    : reason === "oauth-account-restricted"
                      ? "That account cannot use provider sign-in in its current state. Use account recovery or contact support."
                      : reason === "oauth-identity-conflict"
                        ? "That provider identity is already connected to a different Voyagewright account."
                        : reason === "oauth-email-required"
                          ? "The provider did not supply a verified email address, so Voyagewright could not create an account."
                          : reason === "oauth-invalid"
                            ? "That provider response was invalid, expired, or already used. Start again."
                            : reason === "expired"
                              ? "Your session expired. Sign in again; no Voyage progress has changed."
                              : reason === "revoked" || reason === "invalid"
                                ? "That session ended. Sign in again to continue."
                                : "Sign in to continue."}
          </p>
        ) : null}
        {mode === "verify" && query?.delivery === "failed" ? (
          <div className="account-flow-notice" role="alert">
            <b>Your account was created, but we could not send the verification email.</b>
            <p>
              Retry delivery below, change the email address, or <Link href="/sign-in">sign in instead</Link>. If
              delivery keeps failing, contact account support and say that registration completed before delivery.
            </p>
          </div>
        ) : null}
        {mode === "sign-in" && currentUser.status === "authenticated" ? (
          <p className="account-flow-notice">
            Signed in as {currentUser.user.displayName}.{" "}
            <Link href={authorizedReturnTo(returnTo, currentUser, "/passport")}>Continue without signing in again</Link>
          </p>
        ) : null}
        <form onSubmit={submit} aria-describedby="account-status">
          {fields.map((field) => {
            const fieldError = fieldErrors[field];
            const describedBy =
              field === "password" && mode === "register"
                ? `password-strength${fieldError ? ` ${field}-error` : ""}`
                : field === "confirmPassword" && confirmationTouched
                  ? `password-confirmation${fieldError ? ` ${field}-error` : ""}`
                  : fieldError
                    ? `${field}-error`
                    : undefined;
            const inputId = `account-${field}`;
            return (
              <div className="account-flow-field" key={field}>
                <label htmlFor={inputId}>
                  {field === "displayName"
                    ? "Display name"
                    : field === "login"
                      ? "Email or Player name"
                      : field === "confirmPassword"
                        ? "Confirm password"
                        : field[0].toUpperCase() + field.slice(1)}
                </label>
                <input
                  id={inputId}
                  ref={(node) => {
                    inputRefs.current[field] = node;
                    if (field === "code") verificationCodeRef.current = node;
                  }}
                  name={field}
                  value={values[field] ?? ""}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, [field]: event.target.value }));
                    setFieldErrors((current) => {
                      if (!current[field]) return current;
                      const next = { ...current };
                      delete next[field];
                      return next;
                    });
                    if (field === "confirmPassword") setConfirmationTouched(true);
                  }}
                  type={field.toLowerCase().includes("password") ? "password" : field === "email" ? "email" : "text"}
                  inputMode={field === "code" ? "numeric" : undefined}
                  pattern={field === "code" ? "[0-9]{6}" : undefined}
                  maxLength={field === "code" ? 6 : undefined}
                  className={field === "code" ? "account-verification-code" : undefined}
                  aria-invalid={fieldError || (field === "code" && error) ? true : undefined}
                  aria-errormessage={
                    fieldError ? `${field}-error` : field === "code" && error ? "account-status" : undefined
                  }
                  aria-describedby={describedBy}
                  autoComplete={
                    field === "code"
                      ? "one-time-code"
                      : field === "email"
                        ? "email"
                        : field === "login"
                          ? "username"
                          : field.toLowerCase().includes("password")
                            ? mode === "sign-in" || mode === "merge"
                              ? "current-password"
                              : "new-password"
                            : "nickname"
                  }
                  disabled={busy}
                  required
                />
                {field === "password" && mode === "register" ? (
                  <span id="password-strength" className="account-password-strength">
                    <span
                      role="meter"
                      aria-label="Password strength"
                      aria-valuemin={0}
                      aria-valuemax={3}
                      aria-valuenow={passwordStrengthValue}
                      aria-valuetext={passwordAssessment.label}
                    >
                      <i style={{ width: `${((passwordStrengthValue + 1) / 4) * 100}%` }} />
                    </span>
                    <b>Strength: {passwordAssessment.label}</b>
                    <small>{passwordAssessment.message}</small>
                  </span>
                ) : null}
                {field === "confirmPassword" && confirmationTouched ? (
                  <span
                    id="password-confirmation"
                    className={confirmationMatches ? "account-confirmation-match" : "platform-error"}
                    role="status"
                  >
                    {confirmationMatches ? "Passwords match." : "Passwords do not match."}
                  </span>
                ) : null}
                {fieldError ? (
                  <span id={`${field}-error`} className="platform-error">
                    {fieldError}
                  </span>
                ) : null}
              </div>
            );
          })}
          {(mode === "reset" || mode === "email-change") && <input name="token" type="hidden" value={queryToken} />}
          {mode === "merge" && <p>Confirming preserves your guest voyage history in this account.</p>}
          <button className="brass-button" disabled={busy}>
            {busy ? "Working…" : primaryActionLabel(mode)}
          </button>
        </form>
        {mode === "sign-in" || mode === "register" ? (
          <section className="account-oauth" aria-labelledby="account-oauth-heading">
            <span className="account-oauth__divider" aria-hidden="true">
              or use a trusted provider
            </span>
            <h2 id="account-oauth-heading">
              {mode === "register" ? "Create with a trusted provider" : "Continue with a trusted provider"}
            </h2>
            <p>
              Voyagewright requests only identity, profile, and verified email information. Provider access tokens are
              discarded after verification.
            </p>
            <div className="account-oauth__choices">
              {oauthProviders.map((provider) => {
                const params = new URLSearchParams();
                if (returnTo) params.set("returnTo", returnTo);
                const href = `/api/auth/providers/${provider.provider.toLowerCase()}/start${params.size ? `?${params}` : ""}`;
                return provider.available ? (
                  <a
                    className={`account-oauth__button account-oauth__button--${provider.provider.toLowerCase()}`}
                    href={href}
                    key={provider.provider}
                  >
                    {mode === "register" ? `Create account with ${provider.name}` : `Continue with ${provider.name}`}
                  </a>
                ) : (
                  <article
                    className="account-oauth__unavailable"
                    key={provider.provider}
                    data-provider={provider.provider}
                  >
                    <strong>
                      {provider.status === "CHECKING" ? `Checking ${provider.name}` : `${provider.name} unavailable`}
                    </strong>
                    <span>
                      {provider.status === "CHECKING"
                        ? "This sign-in option is being checked."
                        : "This sign-in option is not configured here. Use email and password, or return later."}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {mode === "sign-in" ? (
          <nav className="account-flow-nav" aria-label="Account help">
            <Link href={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>Create Account</Link>{" "}
            <Link href={`/forgot-password${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
              Forgot Password
            </Link>
            {returnTo ? (
              <Link href={returnTo}>Return to previous page</Link>
            ) : (
              <Link href="/">Return to Voyagewright</Link>
            )}
          </nav>
        ) : null}
        {mode === "register" ? (
          <nav className="account-flow-nav" aria-label="Registration help">
            <Link href={`/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
              Already have an account? Sign in
            </Link>{" "}
            <Link href={`/forgot-password${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
              Forgot Password
            </Link>
          </nav>
        ) : null}
        {mode === "forgot" ? (
          <Link
            className="account-flow-nav"
            href={`/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
          >
            Return to Sign In
          </Link>
        ) : null}
        {mode === "email-change" && message ? (
          <Link className="account-flow-nav" href="/sign-in">
            Sign in with the new email
          </Link>
        ) : null}
        {mode === "verify" ? (
          <div className="account-verification-help">
            <button
              type="button"
              className="button button--quiet"
              disabled={busy || resendCooldown > 0}
              onClick={() => void resendCode()}
            >
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : query?.delivery === "failed"
                  ? "Retry sending"
                  : "Resend code"}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={() => setChangingVerificationEmail((value) => !value)}
            >
              {changingVerificationEmail ? "Keep current email" : "Change email"}
            </button>
            {changingVerificationEmail ? (
              <div className="account-verification-email-change">
                <label>
                  <span>New registration email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={replacementEmail}
                    onChange={(event) => setReplacementEmail(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  className="button"
                  disabled={busy || replacementEmail.trim().length < 3}
                  onClick={() => void changeVerificationEmail()}
                >
                  Send code to new email
                </button>
              </div>
            ) : null}
            <p>Use the newest code only. If delivery fails, retry after the cooldown or contact account support.</p>
          </div>
        ) : null}
        <p id="account-status" className={error ? "platform-error" : "account-flow-status"} aria-live="polite">
          {error || message}
        </p>
      </div>
    </main>
  );
}
