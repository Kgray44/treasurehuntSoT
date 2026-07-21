"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  useAuthoritativeAsyncState,
  type AuthoritativeAsyncRun,
} from "@/animation/platform/useAuthoritativeAsyncState";
import { parseJsonResponse } from "@/lib/client-response";
import { PlatformRelic } from "./PlatformRelic";

type GatewayStatus = Partial<Record<"captain" | "creator", { authenticated?: boolean }>> & { error?: string };
type CeremonyState = "idle" | "pending" | "accepted" | "rejected";
type StaffRouteHandoff = (destination: string, signal: AbortSignal) => void | Promise<void>;

const ceremonyProperties = [
  "opacity",
  "transform",
  "clip-path",
  "filter",
] as const satisfies readonly AnimatedProperty[];

function StaffCeremonyTarget({ part, targetKey }: { part: "accepted-pose" | "rejected-pose"; targetKey: string }) {
  const registration = useMemo(
    () => ({ targetKey, part, ownerHint: "gsap" as const, allowedProperties: ceremonyProperties }),
    [part, targetKey],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return <i ref={bindTarget} data-platform-ceremony-part={part} data-runtime-boundary="gsap" />;
}

function StaffCeremonyBoundary({
  intent,
  mode,
  operationKey,
  state,
}: {
  intent: "captain" | "creator";
  mode: ReturnType<typeof useMotionMode>["mode"];
  operationKey: number;
  state: CeremonyState;
}) {
  const hostKey = `staff-${intent}`;
  const relicState =
    state === "accepted" ? "arrived" : state === "rejected" ? "failure" : state === "pending" ? "resolving" : "idle";
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
        kind={intent === "captain" ? "captain-lock" : "creator-quill"}
        state={relicState}
        mode={mode}
        layoutId={`role-object-${intent}`}
      />
      <StaffCeremonyTarget part="accepted-pose" targetKey={`${hostKey}:${operationKey}:accepted`} />
      <StaffCeremonyTarget part="rejected-pose" targetKey={`${hostKey}:${operationKey}:rejected`} />
    </SceneHost>
  );
}

export function StaffSignIn({
  intent,
  authorized,
  signedIn,
  onRouteHandoff,
}: {
  intent: "captain" | "creator";
  authorized: boolean;
  signedIn: boolean;
  onRouteHandoff?: StaffRouteHandoff;
}) {
  const router = useRouter();
  const { mode } = useMotionMode();
  const asyncState = useAuthoritativeAsyncState(900);
  const usernameInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [ceremonyState, setCeremonyState] = useState<CeremonyState>("idle");
  const [operationKey, setOperationKey] = useState(0);
  const [online, setOnline] = useState(true);
  const title = intent === "captain" ? "Captain's Command" : "Tall Tale Studio";
  const destination = intent === "captain" ? "/captain/library" : "/studio/library";
  const busy = asyncState.busy;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function handOffRoute(signal: AbortSignal) {
    if (onRouteHandoff) return onRouteHandoff(destination, signal);
    router.push(destination);
    router.refresh();
  }

  function restoreAfterFailure(run: AuthoritativeAsyncRun, message: string) {
    if (!asyncState.fail(run)) return;
    setStatus("");
    setError(message);
    setCeremonyState("rejected");
    window.requestAnimationFrame(() => usernameInput.current?.focus());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const run = asyncState.begin();
    if (!run) return;
    setOperationKey(run.id);
    setError("");
    setStatus("");
    setCeremonyState("pending");
    let credentialsAccepted = false;
    try {
      const response = await fetch("/api/gm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: run.controller.signal,
      });
      if (!response.ok) {
        const body = await parseJsonResponse<{ error?: string }>(response);
        return restoreAfterFailure(run, body?.error ?? "Sign-in failed. Please try again.");
      }

      const statusResponse = await fetch("/api/gateway/status", {
        cache: "no-store",
        signal: run.controller.signal,
      });
      const gatewayStatus = await parseJsonResponse<GatewayStatus>(statusResponse);
      if (!statusResponse.ok || !gatewayStatus) {
        return restoreAfterFailure(
          run,
          gatewayStatus?.error ?? `Sign-in succeeded, but ${title} permission could not be verified. Please try again.`,
        );
      }
      if (!gatewayStatus[intent]?.authenticated) {
        return restoreAfterFailure(
          run,
          `This account is signed in but does not have ${intent === "captain" ? "Captain" : "Creator"} permission.`,
        );
      }

      if (!asyncState.succeed(run)) return;
      credentialsAccepted = true;
      setCeremonyState("accepted");
      setStatus(`Sign-in accepted. Opening ${title}.`);
      await handOffRoute(run.controller.signal);
      asyncState.release(run, "success");
    } catch {
      restoreAfterFailure(
        run,
        credentialsAccepted
          ? `Sign-in succeeded, but ${title} could not be opened. Please try again.`
          : `${title} could not be reached. Check that the app is running and try again.`,
      );
    }
  }

  return (
    <main
      className={`platform-auth staff-auth-page intent-${intent}`}
      data-auth-state={ceremonyState}
      data-async-state={asyncState.phase}
      data-auth-operation={operationKey}
    >
      <StaffCeremonyBoundary intent={intent} mode={mode} operationKey={operationKey} state={ceremonyState} />
      <section className="auth-ledger" aria-labelledby="staff-sign-in-title">
        <p className="eyebrow">{intent === "captain" ? "Operational waters" : "Authoring waters"}</p>
        <h1 id="staff-sign-in-title">Enter {title}</h1>
        <p>
          {intent === "captain"
            ? "Guide live voyages and manage secure invitations."
            : "Author, validate, publish, compare, and preserve immutable editions."}
        </p>
        {!online && (
          <p className="platform-status auth-offline" role="status">
            Offline. Entered credentials are preserved; reconnect before submitting.
          </p>
        )}
        {authorized ? (
          <Link className="brass-button auth-continue" href={destination}>
            Continue to {title}
          </Link>
        ) : signedIn ? (
          <p className="platform-error" role="alert">
            Your current account is not authorized for this workspace. Return to a role you are allowed to use.
          </p>
        ) : null}
        <form onSubmit={submit} aria-busy={busy} aria-describedby={error ? "staff-sign-in-error" : undefined}>
          <label>
            <span>Username</span>
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
          <button className="brass-button" disabled={busy || !online} aria-busy={busy}>
            {asyncState.phase === "slow"
              ? "Still checking the ledger…"
              : busy
                ? "Checking the ledger…"
                : `Enter ${title}`}
          </button>
        </form>
        {error && (
          <p id="staff-sign-in-error" className="platform-error" role="alert">
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
