"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { parseJsonResponse } from "@/lib/client-response";

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
  operationKey,
  state,
}: {
  intent: "captain" | "creator";
  operationKey: number;
  state: CeremonyState;
}) {
  const hostKey = `staff-${intent}`;
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
  const mounted = useRef(true);
  const activeRun = useRef<AbortController | null>(null);
  const operationSequence = useRef(0);
  const usernameInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ceremonyState, setCeremonyState] = useState<CeremonyState>("idle");
  const [operationKey, setOperationKey] = useState(0);
  const title = intent === "captain" ? "Captain's Command" : "Tall Tale Studio";
  const destination = intent === "captain" ? "/captain/library" : "/studio/library";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRun.current?.abort();
      activeRun.current = null;
    };
  }, []);

  async function handOffRoute(signal: AbortSignal) {
    if (onRouteHandoff) return onRouteHandoff(destination, signal);
    router.push(destination);
    router.refresh();
  }

  function restoreAfterFailure(controller: AbortController, message: string) {
    if (!mounted.current || controller.signal.aborted || activeRun.current !== controller) return;
    activeRun.current = null;
    setStatus("");
    setError(message);
    setCeremonyState("rejected");
    setBusy(false);
    window.requestAnimationFrame(() => usernameInput.current?.focus());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (activeRun.current) return;
    const controller = new AbortController();
    activeRun.current = controller;
    operationSequence.current += 1;
    setOperationKey(operationSequence.current);
    setBusy(true);
    setError("");
    setStatus("");
    setCeremonyState("pending");
    let credentialsAccepted = false;
    try {
      const response = await fetch("/api/gm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await parseJsonResponse<{ error?: string }>(response);
        return restoreAfterFailure(controller, body?.error ?? "Sign-in failed. Please try again.");
      }

      const statusResponse = await fetch("/api/gateway/status", { cache: "no-store", signal: controller.signal });
      const status = await parseJsonResponse<GatewayStatus>(statusResponse);
      if (!statusResponse.ok || !status) {
        return restoreAfterFailure(
          controller,
          status?.error ?? `Sign-in succeeded, but ${title} permission could not be verified. Please try again.`,
        );
      }
      if (!status[intent]?.authenticated) {
        return restoreAfterFailure(
          controller,
          `This account is signed in but does not have ${intent === "captain" ? "Captain" : "Creator"} permission.`,
        );
      }

      if (!mounted.current || controller.signal.aborted || activeRun.current !== controller) return;
      credentialsAccepted = true;
      setCeremonyState("accepted");
      setStatus(`Sign-in accepted. Opening ${title}.`);
      await handOffRoute(controller.signal);
    } catch {
      restoreAfterFailure(
        controller,
        credentialsAccepted
          ? `Sign-in succeeded, but ${title} could not be opened. Please try again.`
          : `${title} could not be reached. Check that the app is running and try again.`,
      );
    } finally {
      // On success the active operation and accepted pose deliberately remain held until route unmount.
      if (activeRun.current === controller && (!mounted.current || controller.signal.aborted)) activeRun.current = null;
    }
  }

  return (
    <main
      className={`platform-auth staff-auth-page intent-${intent}`}
      data-auth-state={ceremonyState}
      data-auth-operation={operationKey}
    >
      <StaffCeremonyBoundary intent={intent} operationKey={operationKey} state={ceremonyState} />
      <section className="auth-ledger" aria-labelledby="staff-sign-in-title">
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
          <button className="brass-button" disabled={busy} aria-busy={busy}>
            {busy ? "Checking the ledger…" : `Enter ${title}`}
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
