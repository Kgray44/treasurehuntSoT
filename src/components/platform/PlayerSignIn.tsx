"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { parseJsonResponse } from "@/lib/client-response";

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

function PlayerCeremonyBoundary({ operationKey, state }: { operationKey: number; state: CeremonyState }) {
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
  const mounted = useRef(true);
  const activeRun = useRef<AbortController | null>(null);
  const operationSequence = useRef(0);
  const usernameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ceremonyState, setCeremonyState] = useState<CeremonyState>("idle");
  const [operationKey, setOperationKey] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRun.current?.abort();
      activeRun.current = null;
    };
  }, []);

  function beginRun() {
    if (activeRun.current) return null;
    const controller = new AbortController();
    activeRun.current = controller;
    operationSequence.current += 1;
    setOperationKey(operationSequence.current);
    setBusy(true);
    setError("");
    setStatus("");
    setCeremonyState("pending");
    return controller;
  }

  async function handOffRoute(destination: string, signal: AbortSignal, refresh: boolean) {
    if (onRouteHandoff) return onRouteHandoff(destination, signal);
    router.push(destination);
    if (refresh) router.refresh();
  }

  function restoreAfterFailure(controller: AbortController, message: string, focus: "username" | "code") {
    if (!mounted.current || controller.signal.aborted || activeRun.current !== controller) return;
    activeRun.current = null;
    setBusy(false);
    setStatus("");
    setError(message);
    setCeremonyState("rejected");
    window.requestAnimationFrame(() => (focus === "username" ? usernameInput.current : codeInput.current)?.focus());
  }

  async function acceptAndNavigate(
    controller: AbortController,
    destination: string,
    message: string,
    refresh: boolean,
  ) {
    if (!mounted.current || controller.signal.aborted || activeRun.current !== controller) return;
    setCeremonyState("accepted");
    setStatus(message);
    try {
      await handOffRoute(destination, controller.signal, refresh);
    } catch {
      restoreAfterFailure(
        controller,
        `${message.replace(/\.$/u, "")} could not complete. Please try again.`,
        refresh ? "username" : "code",
      );
    }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const controller = beginRun();
    if (!controller) return;
    try {
      const response = await fetch("/api/player/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      const body = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        return restoreAfterFailure(controller, body?.error ?? "Player sign-in failed.", "username");
      }
      await acceptAndNavigate(controller, nextHref, "Player sign-in accepted. Opening your library.", true);
    } catch {
      restoreAfterFailure(controller, "Player sign-in could not be reached. Please try again.", "username");
    }
  }

  async function findInvitation(event: React.FormEvent) {
    event.preventDefault();
    const controller = beginRun();
    if (!controller) return;
    try {
      const response = await fetch("/api/invitations/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        signal: controller.signal,
      });
      const body = await parseJsonResponse<{ error?: string; next?: string }>(response);
      if (!response.ok) {
        return restoreAfterFailure(controller, body?.error ?? "Invitation code not found.", "code");
      }
      await acceptAndNavigate(
        controller,
        body?.next ?? "/player/invitation",
        "Invitation accepted. Opening the invitation.",
        false,
      );
    } catch {
      restoreAfterFailure(controller, "The invitation service could not be reached. Please try again.", "code");
    }
  }

  return (
    <main className="platform-auth player-auth-page" data-auth-state={ceremonyState} data-auth-operation={operationKey}>
      <PlayerCeremonyBoundary operationKey={operationKey} state={ceremonyState} />
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
            <button className="brass-button" disabled={busy} aria-busy={busy}>
              {busy ? "Opening library…" : "Open my library"}
            </button>
          </form>
          <form
            id="invitation-code"
            onSubmit={findInvitation}
            aria-busy={busy}
            aria-describedby={error ? "player-sign-in-error" : undefined}
          >
            <h2>Invitation code</h2>
            <label>
              <span>Short code</span>
              <input
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
        {status && (
          <p className="platform-status" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </section>
    </main>
  );
}
