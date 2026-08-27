"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { postIdempotentAuthorityCommand } from "@/helm/authority-command.client";

type Projection = {
  voyage: {
    chronicle: string;
    voyageName: string;
    edition: string;
    lifecycle: string;
    captainAuthorityState: string;
    concurrencyVersion: number;
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
  csrfToken: string;
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
    canReceiveCaptaincy: boolean;
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
  const { requestAction, dialog } = useActionDialog();
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [authorityAction, setAuthorityAction] = useState<"transfer" | "relinquish" | "">("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/captain/voyages/${voyageId}`, { cache: "no-store" });
    const body = (await response.json()) as Projection & { error?: string };
    if (!response.ok) setError(body.error ?? "The operational view is unavailable. No Voyage state has changed.");
    else {
      setProjection(body);
      setError("");
    }
  }, [voyageId]);

  async function removeMember(member: Projection["crew"][number]) {
    if (
      !projection ||
      member.isCaptainsOwnPlayerMembership ||
      ["REMOVED", "LEFT", "CANCELLED"].includes(member.membership.status)
    )
      return;
    if (
      !(await requestAction({
        eyebrow: "Crew membership",
        title: `Remove ${member.displayName} from this Voyage?`,
        detail:
          "Their active Voyage access ends immediately. Their existing participation history remains preserved, and rejoining requires a new invitation.",
        confirmLabel: "Remove from Crew",
        destructive: true,
      }))
    )
      return;
    setBusyMemberId(member.id);
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyageId}/crew/${member.id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": projection.csrfToken },
        body: JSON.stringify({ expectedVersion: projection.voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Crew access could not be changed.");
      setNotice(`${member.displayName} was removed from this Voyage. Their history remains preserved.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Crew access could not be changed.");
    } finally {
      setBusyMemberId("");
    }
  }

  async function cancelForEveryone() {
    if (!projection || projection.voyage.lifecycle === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Terminal Voyage action",
        title: `Cancel “${projection.voyage.voyageName}” for everyone?`,
        detail:
          "This ends shared play and current participant access for every Crew member. The Voyage remains available as an archived historical record and cannot be resumed as this same Voyage.",
        confirmLabel: "Cancel Voyage for Everyone",
        destructive: true,
      }))
    )
      return;
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyageId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": projection.csrfToken },
        body: JSON.stringify({ expectedVersion: projection.voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Voyage could not be cancelled.");
      setNotice("The Voyage was cancelled for everyone and is now historical.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Voyage could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  async function transferCaptaincy(member: Projection["crew"][number]) {
    if (!projection || !member.canReceiveCaptaincy || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Transfer Captaincy to ${member.displayName}?`,
        detail:
          "Captain authority moves atomically after this current joined Player is verified. You remain an ordinary Player if you already participate; the edition, progression, artifacts, and private Player state do not change.",
        confirmLabel: "Transfer Captaincy",
      }))
    )
      return;
    setAuthorityAction("transfer");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/captain/playthroughs/${voyageId}/captain/transfer`,
        csrfToken: projection.csrfToken,
        body: {
          recipientMembershipId: member.id,
          expectedVersion: projection.voyage.concurrencyVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be transferred.");
      setNotice(`Captaincy transferred to ${member.displayName}. Returning to your Player perspective.`);
      window.location.assign(`/player/playthroughs/${voyageId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be transferred.");
      await load();
    } finally {
      setAuthorityAction("");
    }
  }

  async function relinquishCaptaincy() {
    if (!projection || authorityAction || projection.voyage.lifecycle === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Relinquish Captaincy for “${projection.voyage.voyageName}”?`,
        detail:
          "This does not cancel the shared Voyage. It enters Succession Hold until an eligible joined Player takes Captaincy, continues solo, or leaves. Transfer Captaincy directly when a recipient is available.",
        confirmLabel: "Relinquish Captaincy",
        destructive: true,
      }))
    )
      return;
    setAuthorityAction("relinquish");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/captain/playthroughs/${voyageId}/captain/relinquish`,
        csrfToken: projection.csrfToken,
        body: {
          expectedVersion: projection.voyage.concurrencyVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be relinquished.");
      setNotice("Captaincy was relinquished. The shared Voyage is now in Succession Hold, not cancelled.");
      window.location.assign(`/player/playthroughs/${voyageId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be relinquished.");
      await load();
    } finally {
      setAuthorityAction("");
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
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
        <h2 aria-label="Operational voyage summary">{projection.voyage.voyageName}</h2>
        <p>
          {projection.voyage.edition} · {words(projection.voyage.operationalStatus)} · aggregate presence{" "}
          {words(projection.voyage.aggregatePresence)}
        </p>
      </header>
      {notice && <StatusBanner tone="success">{notice}</StatusBanner>}
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      <section aria-labelledby="needs-attention-heading">
        <h3 id="needs-attention-heading" aria-label="Operational attention and safety">
          Needs Attention
        </h3>
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
              {!member.isCaptainsOwnPlayerMembership &&
                !["REMOVED", "LEFT", "CANCELLED"].includes(member.membership.status) && (
                  <button
                    className="button-danger"
                    disabled={Boolean(busyMemberId) || cancelling || Boolean(authorityAction)}
                    aria-busy={busyMemberId === member.id}
                    onClick={() => void removeMember(member)}
                  >
                    {busyMemberId === member.id ? "Removing…" : "Remove from Crew"}
                  </button>
                )}
              {member.canReceiveCaptaincy && (
                <button
                  className="button-secondary"
                  disabled={Boolean(busyMemberId) || cancelling || Boolean(authorityAction)}
                  onClick={() => void transferCaptaincy(member)}
                >
                  {authorityAction === "transfer" ? "Transferring Captaincy…" : "Transfer Captaincy"}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p>
          Presence is derived from authenticated membership heartbeats. It is operational evidence only and never
          changes Voyage progression.
        </p>
      </section>
      {!["CANCELLED", "COMPLETED", "ABANDONED"].includes(projection.voyage.lifecycle) &&
        projection.voyage.captainAuthorityState === "ASSIGNED" && (
          <section aria-labelledby="relinquish-captaincy-heading">
            <h3 id="relinquish-captaincy-heading">Relinquish Captaincy</h3>
            <p>
              Relinquishing is not cancellation. The shared Voyage enters Succession Hold until a joined Player takes
              Captaincy, continues solo, or leaves. Transfer Captaincy directly when a successor is available.
            </p>
            <button
              className="button-danger"
              disabled={Boolean(busyMemberId) || cancelling || Boolean(authorityAction)}
              onClick={() => void relinquishCaptaincy()}
            >
              {authorityAction === "relinquish" ? "Relinquishing Captaincy…" : "Relinquish Captaincy"}
            </button>
          </section>
        )}
      {!["CANCELLED", "COMPLETED", "ABANDONED"].includes(projection.voyage.lifecycle) && (
        <section aria-labelledby="cancel-voyage-heading">
          <h3 id="cancel-voyage-heading">End shared Voyage</h3>
          <p>
            Cancellation ends this shared Voyage for everyone. It is distinct from the later Captain succession flow.
          </p>
          <button
            className="button-danger"
            disabled={Boolean(busyMemberId) || cancelling || Boolean(authorityAction)}
            onClick={() => void cancelForEveryone()}
          >
            {cancelling ? "Cancelling Voyage…" : "Cancel Voyage for Everyone"}
          </button>
        </section>
      )}
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
      {dialog}
    </section>
  );
}
