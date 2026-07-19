"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import {
  useAuthoritativeAsyncState,
  type AuthoritativeAsyncRun,
} from "@/animation/platform/useAuthoritativeAsyncState";
import { parseJsonResponse } from "@/lib/client-response";
import { PlatformRelic } from "./PlatformRelic";

type CeremonyState = "idle" | "pending" | "accepted" | "rejected";
type PlayerRouteHandoff = (destination: string, signal: AbortSignal) => void | Promise<void>;

const ceremonyProperties = [
  "opacity",
  "transform",
  "clip-path",
  "filter",
] as const satisfies readonly AnimatedProperty[];

function PlayerCeremonyTarget({ part, targetKey }: { part: "accepted-pose" | "rejected-pose"; targetKey: string }) {
  const registration = useMemo(
    () => ({ targetKey, part, ownerHint: "gsap" as const, allowedProperties: ceremonyProperties }),
    [part, targetKey],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return <i ref={bindTarget} data-platform-ceremony-part={part} data-runtime-boundary="gsap" />;
}

function PlayerCeremonyBoundary({
  operationKey,
  state,
  mode,
}: {
  operationKey: number;
  state: CeremonyState;
  mode: ReturnType<typeof useMotionMode>["mode"];
}) {
  const hostKey = "player-sign-in";
  return (
    <SceneHost
      kind="platform-ceremony"
      hostKey={hostKey}
      className="auth-ambient platform-ceremony-boundary"
      data-ceremony-state={state}
      data-ceremony-operation={operationKey}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <PlatformRelic
        kind="player-journal"
        state={
          state === "accepted" ? "arrived" : state === "rejected" ? "failure" : state === "pending" ? "resolving" : "idle"
        }
        mode={mode}
        layoutId="role-object-player"
      />
      <PlayerCeremonyTarget part="accepted-pose" targetKey={`${hostKey}:${operationKey}:accepted`} />
      <PlayerCeremonyTarget part="rejected-pose" targetKey={`${hostKey}:${operationKey}:rejected`} />
    </SceneHost>
  );
}

export function PlayerSignIn({
  authenticated,
  nextHref = "/player/library",
  onRouteHandoff,
}: {
  authenticated: boolean;
  nextHref?: string;
  onRouteHandoff?: PlayerRouteHandoff;
}) {
  const router = useRouter();
  const { mode } = useMotionMode();
  const asyncState = useAuthoritativeAsyncState(900);
  const stateToken = resolvePlatformMotionToken("state", mode);
  const usernameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [authMode, setAuthMode] = useState<"account" | "invitation">("account");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [operationKey, setOperationKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [offline, setOffline] = useState(false);
  const busy = asyncState.busy;
  const ceremonyState: CeremonyState =
    asyncState.phase === "success"
      ? "accepted"
      : asyncState.phase === "recoverable-error" || asyncState.phase === "terminal-error"
        ? "rejected"
        : asyncState.phase === "pending" || asyncState.phase === "slow"
          ? "pending"
          : "idle";

  useEffect(() => {
    const updateMode = () => setAuthMode(window.location.hash === "#invitation-code" ? "invitation" : "account");
    const updateConnection = () => setOffline(!navigator.onLine);
    updateMode();
    updateConnection();
    window.addEventListener("hashchange", updateMode);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("hashchange", updateMode);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function beginRun() {
    const run = asyncState.begin();
    if (!run) return null;
    setOperationKey(run.id);
    setError("");
    setStatus("");
    return run;
  }

  async function handOffRoute(destination: string, signal: AbortSignal, refresh: boolean) {
    if (onRouteHandoff) return onRouteHandoff(destination, signal);
    router.push(destination);
    if (refresh) router.refresh();
  }

  function restoreAfterFailure(run: AuthoritativeAsyncRun, message: string, focus: "username" | "code") {
    if (!asyncState.fail(run)) return;
    setStatus("");
    setError(message);
    requestAnimationFrame(() => (focus === "username" ? usernameInput.current : codeInput.current)?.focus());
  }

  async function acceptAndNavigate(
    run: AuthoritativeAsyncRun,
    destination: string,
    message: string,
    refresh: boolean,
  ) {
    if (!asyncState.succeed(run)) return;
    setStatus(message);
    try {
      await handOffRoute(destination, run.controller.signal, refresh);
    } catch {
      restoreAfterFailure(
        run,
        `${message.replace(/\.$/u, "")} could not complete. Please try again.`,
        refresh ? "username" : "code",
      );
    }
  }

  function applyRateLimit(response: Response) {
    if (response.status !== 429) return;
    const retryAfter = Number(response.headers?.get("retry-after") ?? 30);
    setCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 30);
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const run = beginRun();
    if (!run) return;
    try {
      const response = await fetch("/api/player/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: run.controller.signal,
      });
      const body = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        applyRateLimit(response);
        return restoreAfterFailure(run, body?.error ?? "Player sign-in failed.", "username");
      }
      setOffline(false);
      await acceptAndNavigate(run, nextHref, "Player sign-in accepted. Opening your library.", true);
    } catch {
      if (run.controller.signal.aborted) return;
      setOffline(true);
      restoreAfterFailure(run, "Player sign-in could not be reached. Please try again.", "username");
    }
  }

  async function findInvitation(event: React.FormEvent) {
    event.preventDefault();
    const run = beginRun();
    if (!run) return;
    try {
      const response = await fetch("/api/invitations/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        signal: run.controller.signal,
      });
      const body = await parseJsonResponse<{ error?: string; next?: string }>(response);
      if (!response.ok) {
        applyRateLimit(response);
        return restoreAfterFailure(run, body?.error ?? "Invitation code not found.", "code");
      }
      setOffline(false);
      await acceptAndNavigate(
        run,
        body?.next ?? "/player/invitation",
        "Invitation accepted. Opening the invitation.",
        false,
      );
    } catch {
      if (run.controller.signal.aborted) return;
      setOffline(true);
      restoreAfterFailure(run, "The invitation service could not be reached. Please try again.", "code");
    }
  }

  function selectMode(next: "account" | "invitation") {
    asyncState.reset("entry-method-changed");
    setError("");
    setStatus("");
    setAuthMode(next);
    history.replaceState(null, "", next === "invitation" ? "#invitation-code" : window.location.pathname);
  }

  return (
    <main
      className="platform-auth player-auth-page"
      data-auth-state={ceremonyState}
      data-async-state={asyncState.phase}
      data-auth-operation={operationKey}
    >
      <PlayerCeremonyBoundary operationKey={operationKey} state={ceremonyState} mode={mode} />
      <section className="auth-ledger" aria-labelledby="player-sign-in-title">
        <p className="eyebrow">Player waters</p>
        <h1 id="player-sign-in-title">Open your Tall Tale Library</h1>
        <p>Sign in to continue remembered voyages, or enter the short code from a Captain&apos;s invitation.</p>
        {authenticated && (
          <Link className="brass-button auth-continue" href={nextHref}>
            {nextHref === "/player/invitation" ? "Return to invitation" : "Continue to my library"}
          </Link>
        )}
        <div className="auth-mode-tabs" role="tablist" aria-label="Player entry method">
          <button type="button" role="tab" aria-selected={authMode === "account"} onClick={() => selectMode("account")}>
            Player account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "invitation"}
            onClick={() => selectMode("invitation")}
          >
            Invitation code
          </button>
        </div>
        <div className="auth-columns auth-mode-panel">
          <AnimatePresence initial={false} mode="wait">
            {authMode === "account" ? (
              <motion.form
                key="account"
                initial={{ opacity: 0, x: mode === "reduced" ? 0 : -stateToken.distancePx }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "reduced" ? 0 : -stateToken.distancePx / 2 }}
                transition={{ duration: stateToken.durationSeconds, ease: platformMotionEasing("state") }}
                onSubmit={signIn}
                aria-busy={busy}
                aria-describedby={error ? "player-sign-in-error" : undefined}
              >
                <h2>{authenticated ? "Use a different Player account" : "Player sign-in"}</h2>
                <label>
                  <span>Player name</span>
                  <input
                    autoFocus
                    ref={usernameInput}
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
                <button className="brass-button" disabled={busy || cooldown > 0} aria-busy={busy}>
                  {cooldown > 0
                    ? `Try again in ${cooldown}s`
                    : asyncState.phase === "slow"
                      ? "Still checking…"
                      : busy
                        ? "Opening library…"
                        : "Open my library"}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="invitation"
                id="invitation-code"
                initial={{ opacity: 0, x: mode === "reduced" ? 0 : stateToken.distancePx }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "reduced" ? 0 : stateToken.distancePx / 2 }}
                transition={{ duration: stateToken.durationSeconds, ease: platformMotionEasing("state") }}
                onSubmit={findInvitation}
                aria-busy={busy}
                aria-describedby={error ? "player-sign-in-error" : undefined}
              >
                <h2>Invitation code</h2>
                <label>
                  <span>Short code</span>
                  <input
                    autoFocus
                    ref={codeInput}
                    inputMode="text"
                    autoCapitalize="characters"
                    placeholder="ABCD-EFGH"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </label>
                <p>Invitation links open the same ceremony automatically. Codes are checked securely and rate-limited.</p>
                <button disabled={busy || cooldown > 0} aria-busy={busy}>
                  {cooldown > 0
                    ? `Try again in ${cooldown}s`
                    : asyncState.phase === "slow"
                      ? "Still searching…"
                      : busy
                        ? "Checking code…"
                        : "Find my invitation"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        {offline && (
          <p className="platform-offline" role="status">
            You are offline. Your entries are preserved; reconnect, then submit again.
          </p>
        )}
        {error && (
          <p id="player-sign-in-error" className="platform-error" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p className="platform-status" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </section>
    </main>
  );
}
