"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";

type Overview = {
  accountState: string;
  canSelfInitialize: boolean;
  activeChronicles: Array<{
    membershipId: string;
    playthroughId: string;
    title: string;
    voyageName: string | null;
    alias: string | null;
    status: string;
    returnHref: string;
  }>;
  transitionLock: {
    state: "CLEAR" | "BLOCKED_ACTIVE_PLAYER_CHRONICLE";
    blockedWorkspaces: readonly ("CAPTAIN" | "CREATOR")[];
    detail: string;
  };
  workspaces: Array<{
    id: "PLAYER" | "CAPTAIN" | "CREATOR";
    label: string;
    state: "ACTIVE" | "AVAILABLE" | "BLOCKED" | "UNAVAILABLE";
    href: string | null;
    detail: string;
    emptyHint?: string | null;
  }>;
};

export function WorkspaceCapabilityDashboard() {
  const { state: currentUser, invalidate } = useCurrentUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ tone: "info" | "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const currentUserRevision = currentUser.status === "authenticated" ? currentUser.revision : currentUser.status;

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/account/workspaces", { cache: "no-store" });
      const body = (await response.json()) as Overview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Workspace state is unavailable.");
      setOverview(body);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Workspace state is unavailable.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUserRevision, load]);

  const mutate = async (body: object, success: string) => {
    if (currentUser.status !== "authenticated") return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": currentUser.csrfToken },
        body: JSON.stringify(body),
      });
      const value = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(value.error ?? "Workspace change could not be completed.");
      setMessage({ tone: "success", text: success });
      setConfirmation("");
      await invalidate();
      await load();
    } catch (cause) {
      setMessage({ tone: "danger", text: cause instanceof Error ? cause.message : "Workspace change failed." });
    } finally {
      setBusy(false);
    }
  };

  if (loadError)
    return (
      <ErrorState
        title="Workspaces are unavailable"
        detail={loadError}
        action={{ label: "Try again", onClick: () => void load() }}
      />
    );
  if (!overview)
    return (
      <LoadingState
        title="Opening all workspaces"
        detail="Reading your account capabilities and active Chronicle safety state."
      />
    );

  return (
    <main className="workspace-capability-page">
      <header className="workspace-capability-hero">
        <p className="eyebrow">One account, three ways to voyage</p>
        <h1>All Workspaces</h1>
        <p>Player, Captain, and Creator are capabilities of this {overview.accountState.toLocaleLowerCase()}.</p>
      </header>
      {message ? <StatusBanner tone={message.tone}>{message.text}</StatusBanner> : null}
      {overview.transitionLock.state === "BLOCKED_ACTIVE_PLAYER_CHRONICLE" ? (
        <section className="workspace-transition-lock" aria-labelledby="workspace-lock-title">
          <p className="eyebrow">Active Chronicle safety lock</p>
          <h2 id="workspace-lock-title">
            {overview.transitionLock.blockedWorkspaces.includes("CAPTAIN")
              ? "Captain and Creator transitions are paused"
              : "Creator transitions are paused"}
          </h2>
          <p>{overview.transitionLock.detail}</p>
          <ul>
            {overview.activeChronicles.map((chronicle) => (
              <li key={chronicle.membershipId}>
                <div>
                  <strong>{chronicle.title}</strong>
                  <span>
                    {chronicle.alias ?? "Your Player identity"} · {chronicle.status.replaceAll("_", " ")}
                  </span>
                </div>
                <Link className="button" href={chronicle.returnHref}>
                  Return to Chronicle
                </Link>
              </li>
            ))}
          </ul>
          <label>
            Type <strong>LEAVE ACTIVE CHRONICLES</strong> to end this account&apos;s active Player participation.
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
          </label>
          <button
            type="button"
            className="button button--danger"
            disabled={busy || confirmation !== "LEAVE ACTIVE CHRONICLES"}
            onClick={() =>
              void mutate(
                { action: "LEAVE_ACTIVE_CHRONICLES", confirmation },
                "Active Player participation ended safely.",
              )
            }
          >
            Safely leave active Chronicles
          </button>
        </section>
      ) : null}
      <section className="workspace-capability-grid" aria-label="Account workspace capabilities">
        {overview.workspaces.map((workspace) => (
          <article key={workspace.id} data-workspace-state={workspace.state.toLocaleLowerCase()}>
            <span className="workspace-capability-state">
              {workspace.state === "ACTIVE" ? "Available" : workspace.state.toLocaleLowerCase()}
            </span>
            <h2>{workspace.label}</h2>
            <p>{workspace.detail}</p>
            {workspace.emptyHint ? <p className="workspace-capability-note">{workspace.emptyHint}</p> : null}
            {workspace.href ? (
              <Link className="button button--primary" href={workspace.href}>
                Enter {workspace.label}
              </Link>
            ) : null}
            {workspace.state === "AVAILABLE" && workspace.id !== "PLAYER" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    { action: "ACTIVATE", target: workspace.id },
                    `${workspace.label} workspace activated for this account.`,
                  )
                }
              >
                Activate {workspace.label}
              </button>
            ) : null}
            {workspace.state === "BLOCKED" ? (
              <span className="workspace-capability-note">Resolve the active Chronicle lock above.</span>
            ) : null}
          </article>
        ))}
      </section>
      <p className="workspace-capability-boundary">
        Workspace activation never grants ownership of another person&apos;s Chronicle, Voyage, draft, moderation queue,
        or private content.
      </p>
    </main>
  );
}
