"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";

type Projection = {
  voyage: {
    chronicle: string;
    voyageName: string;
    edition: string;
    lifecycle: string;
    operationalStatus: string;
    aggregatePresence: string;
    crewPresenceSummary: {
      total: number;
      connected: number;
      recentlyLost: number;
      stale: number;
      unknown: number;
      synchronized: number;
      catchingUp: number;
    };
    sourceUpdatedAt: string;
    computedAt: string;
  };
  attention: Array<{ key: string; severity: string; title: string; explanation: string; stale: boolean }>;
  crew: Array<{
    id: string;
    displayName: string;
    crewRole: string | null;
    membership: { status: string };
    presence: { state: string; lastSeenAt: string | null; activeDeviceCount: number; safeActivity: string | null };
    synchronization: { state: string; lag: number | null };
    readiness: { state: string };
    isCaptainsOwnPlayerMembership: boolean;
  }>;
  progress: {
    currentChapter: string | null;
    currentCheckpoint: string | null;
    currentSequence: number;
    pendingCaptain: boolean;
    pendingPlayer: boolean;
    providerWaiting: boolean;
    blockedRequirementCount: number;
    updatedAt: string;
  };
  events: Array<{
    id: string;
    category: string;
    timestamp: string;
    sequence: number;
    safeActorLabel: string;
    summary: string;
  }>;
};

function words(value: string) {
  if (value === "REMOVED") return "removed / no longer participating";
  return value.replaceAll("_", " ").toLocaleLowerCase();
}

export function CaptainOperationalPanel({ voyageId, authenticated }: { voyageId: string; authenticated: boolean }) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/captain/voyages/${voyageId}`, { cache: "no-store" });
    const body = (await response.json()) as Projection & { error?: string };
    if (!response.ok) setError(body.error ?? "The operational view is unavailable. No Voyage state has changed.");
    else {
      setProjection(body);
      setError("");
    }
  }, [voyageId]);
  useEffect(() => {
    if (!authenticated) return;
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [authenticated, load]);
  if (!authenticated) return null;
  if (!projection)
    return (
      <section className="captain-operational-panel" aria-label="Operational view">
        {error ? (
          <ErrorState
            title="Operational view unavailable"
            detail={error}
            action={{ label: "Try again", onClick: () => void load() }}
          />
        ) : (
          <LoadingState
            title="Reading operational state"
            detail="Loading safe crew, progress, and event projections."
          />
        )}
      </section>
    );
  return (
    <section
      className="captain-operational-panel"
      aria-label="Captain operational view"
      data-operational-status={projection.voyage.operationalStatus}
    >
      <header>
        <p className="eyebrow">Operational view</p>
        <h2>{projection.voyage.voyageName}</h2>
        <p>
          {projection.voyage.edition} · {words(projection.voyage.operationalStatus)} · aggregate presence{" "}
          {words(projection.voyage.aggregatePresence)}
        </p>
      </header>
      <section aria-labelledby="needs-attention-heading">
        <h3 id="needs-attention-heading">Needs Attention</h3>
        {projection.attention.length ? (
          <ul>
            {projection.attention.map((item) => (
              <li key={item.key} data-severity={item.severity}>
                <strong>
                  {item.severity}: {item.title}
                </strong>
                <span>
                  {item.explanation}
                  {item.stale ? " Information may be stale." : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No active operational condition is currently derived from the available canonical sources.</p>
        )}
      </section>
      <section aria-labelledby="crew-operational-heading">
        <h3 id="crew-operational-heading">Crew</h3>
        <ul>
          {projection.crew.map((member) => (
            <li key={member.id}>
              <strong>
                {member.displayName}
                {member.isCaptainsOwnPlayerMembership ? " (your Player membership)" : ""}
              </strong>
              <span>
                {member.crewRole ?? "Crew"} · membership {words(member.membership.status)} · presence{" "}
                {words(member.presence.state)} · sync {words(member.synchronization.state)} · readiness{" "}
                {words(member.readiness.state)}
                {member.presence.lastSeenAt
                  ? ` Â· last seen ${new Date(member.presence.lastSeenAt).toLocaleTimeString()}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Presence is derived from authenticated membership heartbeats. It is operational evidence only and never
          changes Voyage progression.
        </p>
      </section>
      <section aria-labelledby="progress-operational-heading">
        <h3 id="progress-operational-heading">Progress</h3>
        <dl>
          <div>
            <dt>Current section</dt>
            <dd>{projection.progress.currentChapter ?? "Not yet established"}</dd>
          </div>
          <div>
            <dt>Current checkpoint</dt>
            <dd>{projection.progress.currentCheckpoint ?? "Not yet established"}</dd>
          </div>
          <div>
            <dt>Canonical sequence</dt>
            <dd>{projection.progress.currentSequence}</dd>
          </div>
          <div>
            <dt>Waiting</dt>
            <dd>
              {projection.progress.pendingCaptain
                ? "Captain"
                : projection.progress.pendingPlayer
                  ? "Player"
                  : projection.progress.providerWaiting
                    ? "Provider"
                    : "No known wait"}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="operational-events-heading">
        <h3 id="operational-events-heading">Recent operational events</h3>
        <ol>
          {projection.events.map((event) => (
            <li key={event.id}>
              <strong>{event.summary}</strong>
              <span>
                {event.category.toLocaleLowerCase()} · sequence {event.sequence} ·{" "}
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p>
        Projection computed {new Date(projection.voyage.computedAt).toLocaleTimeString()} from source updated{" "}
        {new Date(projection.voyage.sourceUpdatedAt).toLocaleTimeString()}. Polling is the active reconciliation
        fallback.
      </p>
    </section>
  );
}
