"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";

type Command = {
  id: string;
  label: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  reversible: boolean;
  playersSeeResult: boolean;
  consequence: string;
  warning: string | null;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  target: "NONE" | "PASSAGE";
};

type Projection = {
  csrfToken: string;
  voyage: {
    voyageName: string;
    chronicle: string;
    edition: string;
    lifecycle: string;
    operationalStatus: string;
    concurrencyVersion: number;
    computedAt: string;
    sourceUpdatedAt: string;
  };
  progress: {
    currentChapter: string | null;
    currentCheckpoint: string | null;
    currentSequence: number;
    pendingCaptain: boolean;
    pendingPlayer: boolean;
    providerWaiting: boolean;
  };
  commandConsole: {
    commands: Command[];
    hintSummary: { available: number; released: number };
    progressMap: Array<{
      id: string;
      chapterId: string;
      chapterTitle: string;
      title: string;
      blockType: string;
      state: "COMPLETED" | "CURRENT" | "UPCOMING" | "OPTIONAL" | "BLOCKED";
      outgoingCount: number;
    }>;
  };
  attention: Array<{ key: string; severity: string; title: string; explanation: string; stale: boolean }>;
  crew: Array<{
    id: string;
    displayName: string;
    crewRole: string | null;
    membership: { status: string };
    presence: { state: string };
    synchronization: { state: string; lag: number | null };
    readiness: { state: string };
    isCaptainsOwnPlayerMembership: boolean;
  }>;
  resilience: {
    preflight: {
      state: "READY" | "READY_WITH_WARNINGS" | "NOT_READY" | "UNKNOWN_DEPENDENCY";
      checks: Array<{ id: string; state: "PASS" | "WARNING" | "BLOCKED" | "UNKNOWN"; label: string; detail: string }>;
    };
    recovery: {
      state: "HEALTHY" | "ACTIONABLE" | "ESCALATE";
      diagnosis: string;
      evidence: { sourceRevision: number; observedAt: string };
      steps: Array<{
        id: string;
        label: string;
        detail: string;
        commandId: "PAUSE_VOYAGE" | "RESUME_VOYAGE" | "REPLAY_PRESENTATION" | "RESTORE_PRIOR_PASSAGE" | null;
      }>;
    };
  };
  events: Array<{ id: string; category: string; timestamp: string; sequence: number; summary: string }>;
};

type Preview = {
  command: Command;
  target: { title: string; chapterTitle: string } | null;
  currentState: {
    voyageName: string;
    lifecycle: string;
    expectedSequence: number;
    chapter: string | null;
    passage: string | null;
  };
};

function words(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase();
}

export function CaptainCommandConsole({ voyageId, authenticated }: { voyageId: string; authenticated: boolean }) {
  const { requestAction, dialog } = useActionDialog();
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState("");
  const [moveTarget, setMoveTarget] = useState("");
  const idempotencyKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/captain/voyages/${voyageId}`, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as Projection & { error?: string };
    if (!response.ok) setError(body.error ?? "The Captain console is unavailable. No Voyage state has changed.");
    else {
      setProjection(body);
      setError("");
    }
  }, [voyageId]);

  useEffect(() => {
    if (!authenticated) return;
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden && !busy) void load();
    }, 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [authenticated, busy, load]);

  async function execute(prepared: Preview, targetBlockId: string | undefined, reason: string | undefined) {
    if (!projection) return;
    const keyId = `${prepared.command.id}:${targetBlockId ?? ""}`;
    const idempotencyKey = idempotencyKeys.current[keyId] ?? crypto.randomUUID();
    idempotencyKeys.current[keyId] = idempotencyKey;
    setBusy(prepared.command.id);
    setError("");
    try {
      const response = await fetch(`/api/captain/voyages/${voyageId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": projection.csrfToken },
        body: JSON.stringify({
          commandId: prepared.command.id,
          targetBlockId,
          expectedSequence: prepared.currentState.expectedSequence,
          idempotencyKey,
          confirmed: prepared.command.requiresConfirmation,
          reason,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        if (response.status === 409)
          setError("Voyage changed while this command was being prepared. Refresh current state before continuing.");
        else setError(body.error ?? "This Captain command could not be completed. No Voyage progress has changed.");
        await load();
        return;
      }
      delete idempotencyKeys.current[keyId];
      setNotice(body.message ?? `${prepared.command.label} was recorded from the authoritative Voyage state.`);
      setPreview(null);
      await load();
    } catch {
      setError("The command response was lost. Retry the same action to reconcile its authoritative result.");
    } finally {
      setBusy("");
    }
  }

  async function prepare(command: Command, targetBlockId?: string) {
    if (!projection || busy) return;
    if (command.target === "PASSAGE" && !targetBlockId) {
      setError("Choose a published Passage before preparing this command.");
      return;
    }
    setBusy(command.id);
    setError("");
    try {
      const response = await fetch(`/api/captain/voyages/${voyageId}/commands/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: command.id, targetBlockId }),
      });
      const body = (await response.json().catch(() => ({}))) as Preview & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "This command is no longer available. Refresh current state before continuing.");
        await load();
        return;
      }
      setPreview(body);
      if (!body.command.requiresConfirmation) {
        await execute(body, targetBlockId, undefined);
        return;
      }
      setBusy("");
      const values = await requestAction({
        eyebrow: `${body.command.risk.toLocaleLowerCase()} impact command`,
        title: `${body.command.label}?`,
        detail: [
          `Target: ${body.target ? `${body.target.chapterTitle} - ${body.target.title}` : (body.currentState.passage ?? "Current Passage")}.`,
          `Current state: ${words(body.currentState.lifecycle)} at revision ${body.currentState.expectedSequence}.`,
          `Consequence: ${body.command.consequence}`,
          `Reversible: ${body.command.reversible ? "yes, through a governed follow-up command where available" : "no"}.`,
          `Player result: ${body.command.playersSeeResult ? "Players may see an immediate result." : "No Player presentation is expected."}`,
          body.command.warning ?? "",
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: body.command.label,
        destructive: body.command.risk === "HIGH",
        fields: body.command.requiresReason
          ? [
              {
                id: "reason",
                label: "Captain reason",
                description: "This explanation is recorded with the canonical command.",
                required: true,
                multiline: true,
                maxLength: 500,
              },
            ]
          : undefined,
      });
      if (values) await execute(body, targetBlockId, values.reason);
    } catch {
      setError("The command preview could not be prepared. No Voyage progress has changed.");
    } finally {
      setBusy("");
    }
  }

  if (!authenticated) return null;
  if (!projection)
    return (
      <main className="captain-command-console" aria-label="Captain command console">
        {error ? (
          <ErrorState
            title="Captain console unavailable"
            detail={error}
            action={{ label: "Try again", onClick: () => void load() }}
          />
        ) : (
          <LoadingState
            title="Reading live Voyage state"
            detail="Loading the authoritative Captain operation projection."
          />
        )}
      </main>
    );

  const directCommands = projection.commandConsole.commands.filter((command) => command.target === "NONE");
  const moveCommand = projection.commandConsole.commands.find((command) => command.target === "PASSAGE");
  const moveTargets = projection.commandConsole.progressMap.filter((node) => node.state !== "CURRENT");
  return (
    <main
      className="captain-command-console"
      aria-label="Captain command console"
      data-operational-status={projection.voyage.operationalStatus}
    >
      <header className="captain-command-console__header">
        <div>
          <p className="eyebrow">Live Voyage operations</p>
          <h1>{projection.voyage.voyageName}</h1>
          <p>
            {projection.voyage.chronicle} - {projection.voyage.edition} - {words(projection.voyage.operationalStatus)}
          </p>
        </div>
        <div className="captain-command-console__state">
          <strong>Revision {projection.progress.currentSequence}</strong>
          <span>{projection.progress.currentChapter ?? "Current chapter awaiting confirmation"}</span>
          <button className="button-secondary" disabled={Boolean(busy)} onClick={() => void load()}>
            Refresh current state
          </button>
        </div>
      </header>
      {notice ? <StatusBanner tone="success">{notice}</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}
      <section className="captain-command-console__grid">
        <section className="captain-command-console__attention" aria-labelledby="captain-attention-heading">
          <h2 id="captain-attention-heading">Needs attention</h2>
          {projection.attention.length ? (
            <ul>
              {projection.attention.map((item) => (
                <li key={item.key} data-severity={item.severity}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.explanation}
                    {item.stale ? " Refresh before acting." : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No current operational condition requires Captain intervention.</p>
          )}
        </section>
        <section className="captain-command-console__commands" aria-labelledby="captain-commands-heading">
          <p className="card-kicker">Contextual commands</p>
          <h2 id="captain-commands-heading">What you can do now</h2>
          {directCommands.length ? (
            <div className="captain-command-console__command-list">
              {directCommands.map((command) => (
                <button key={command.id} disabled={Boolean(busy)} onClick={() => void prepare(command)}>
                  <span>{command.label}</span>
                  <small>{command.description}</small>
                  <em>{command.risk.toLocaleLowerCase()} impact</em>
                </button>
              ))}
            </div>
          ) : (
            <p>No Captain command is currently safe or relevant for this Voyage state.</p>
          )}
          {moveCommand ? (
            <div className="captain-command-console__move">
              <label htmlFor="captain-passage-target">Move Crew to a published Passage</label>
              <select
                id="captain-passage-target"
                value={moveTarget}
                onChange={(event) => setMoveTarget(event.target.value)}
              >
                <option value="">Choose a Passage</option>
                {moveTargets.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.chapterTitle} - {node.title}
                  </option>
                ))}
              </select>
              <button
                className="button-danger"
                disabled={Boolean(busy) || !moveTarget}
                onClick={() => void prepare(moveCommand, moveTarget)}
              >
                {busy === moveCommand.id ? "Preparing command…" : moveCommand.label}
              </button>
            </div>
          ) : null}
          {preview ? (
            <p className="captain-command-console__preview" role="status">
              Prepared preview: {preview.command.label} at revision {preview.currentState.expectedSequence}.
            </p>
          ) : null}
        </section>
        <section className="captain-command-console__map" aria-labelledby="captain-map-heading">
          <p className="card-kicker">Operational map</p>
          <h2 id="captain-map-heading">Voyage progression</h2>
          <ol>
            {projection.commandConsole.progressMap.map((node) => (
              <li key={node.id} data-state={node.state}>
                <strong>{node.title}</strong>
                <span>
                  {node.chapterTitle} - {words(node.state)} - {node.outgoingCount} onward path
                  {node.outgoingCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
          <p className="captain-command-console__map-summary">
            Hints released: {projection.commandConsole.hintSummary.released} of{" "}
            {projection.commandConsole.hintSummary.available}. This operational map is Captain-only; Player view remains
            separately projected.
          </p>
        </section>
        <section className="captain-command-console__crew" aria-labelledby="captain-crew-heading">
          <h2 id="captain-crew-heading">Crew status</h2>
          <ul>
            {projection.crew.map((member) => (
              <li key={member.id}>
                <strong>
                  {member.displayName}
                  {member.isCaptainsOwnPlayerMembership ? " (your Player membership)" : ""}
                </strong>
                <span>
                  {member.crewRole ?? "Crew"} - {words(member.membership.status)} - {words(member.presence.state)} -{" "}
                  {words(member.synchronization.state)}
                  {member.synchronization.lag
                    ? `, ${member.synchronization.lag} event${member.synchronization.lag === 1 ? "" : "s"} behind`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="captain-command-console__recovery" aria-labelledby="captain-recovery-heading">
          <p className="card-kicker">Weather the Passage</p>
          <h2 id="captain-recovery-heading">Preflight and recovery</h2>
          <p data-recovery-state={projection.resilience.recovery.state}>
            {projection.resilience.preflight.state.replaceAll("_", " ").toLocaleLowerCase()} preflight -{" "}
            {projection.resilience.recovery.diagnosis}
          </p>
          <ul aria-label="Preflight checks">
            {projection.resilience.preflight.checks.map((check) => (
              <li key={check.id} data-check-state={check.state}>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </li>
            ))}
          </ul>
          <ol aria-label="Governed recovery steps">
            {projection.resilience.recovery.steps.map((step) => {
              const command = step.commandId
                ? directCommands.find((candidate) => candidate.id === step.commandId)
                : undefined;
              return (
                <li key={step.id}>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                  {command ? (
                    <button
                      className="button-secondary"
                      disabled={Boolean(busy)}
                      onClick={() => void prepare(command)}
                    >
                      Prepare governed action
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <small>
            Evidence observed at revision {projection.resilience.recovery.evidence.sourceRevision} on{" "}
            {new Date(projection.resilience.recovery.evidence.observedAt).toLocaleTimeString()}.
          </small>
        </section>
        <section className="captain-command-console__history" aria-labelledby="captain-history-heading">
          <h2 id="captain-history-heading">Recent Voyage results</h2>
          <ol>
            {projection.events.map((event) => (
              <li key={event.id}>
                <strong>{event.summary}</strong>
                <span>
                  {words(event.category)} - revision {event.sequence} - {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </section>
      <p className="captain-command-console__freshness">
        Authoritative projection refreshed {new Date(projection.voyage.computedAt).toLocaleTimeString()}. If it changes
        while a command is prepared, refresh before continuing.
      </p>
      {dialog}
    </main>
  );
}
