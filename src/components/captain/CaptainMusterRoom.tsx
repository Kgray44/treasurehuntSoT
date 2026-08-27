"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { postIdempotentAuthorityCommand } from "@/helm/authority-command.client";

type CrewMember = {
  id: string;
  displayName: string;
  avatar: null;
  crewRole: string | null;
  membership: { status: string; joinedAt: string | null; completedAt: string | null; removedAt: string | null };
  presence: { state: string; lastSeenAt: string | null; activeDeviceCount: number; safeActivity: string | null };
  synchronization: { state: string; lag: number | null };
  readiness: { state: string };
  invitation: { id: string; status: string; expiresAt: string; canManage: boolean } | null;
  isCaptainsOwnPlayerMembership: boolean;
  canReceiveCaptaincy: boolean;
};

type Projection = {
  csrfToken: string;
  voyage: {
    id: string;
    chronicle: string;
    voyageName: string;
    edition: string;
    lifecycle: string;
    captainAuthorityState: string;
    concurrencyVersion: number;
    sourceUpdatedAt: string;
  };
  crew: CrewMember[];
};

function words(value: string | null | undefined) {
  return (value ?? "UNKNOWN").replaceAll("_", " ").toLocaleLowerCase();
}

function initials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

function membershipCopy(status: string) {
  if (status === "INVITED") return "Invited — not joined";
  if (status === "ACCEPTED") return "Joined — not ready";
  if (status === "READY") return "Joined — ready";
  if (status === "ACTIVE_MEMBER") return "Joined — in Voyage";
  if (status === "LEFT") return "Departed Voyage";
  if (status === "REMOVED") return "Removed from crew";
  if (status === "CANCELLED") return "Voyage cancelled";
  return words(status);
}

function presenceCopy(member: CrewMember) {
  if (["REMOVED", "LEFT", "CANCELLED"].includes(member.membership.status)) return "No longer connected";
  if (member.presence.state === "CONNECTED")
    return member.synchronization.state === "CATCHING_UP" ? "Online — catching up" : "Online and in sync";
  if (member.presence.state === "RECENTLY_LOST") return "Reconnecting";
  if (member.presence.state === "NOT_CURRENTLY_CONNECTED" || member.presence.state === "STALE") return "Offline";
  return "Connection unknown";
}

function roomVersion(projection: Projection) {
  return JSON.stringify([
    projection.voyage.lifecycle,
    projection.voyage.captainAuthorityState,
    projection.crew.map((member) => [
      member.id,
      member.membership.status,
      member.presence.state,
      member.synchronization.state,
      member.readiness.state,
      member.isCaptainsOwnPlayerMembership,
      member.invitation?.status,
    ]),
  ]);
}

export function CaptainMusterRoom({ voyageId }: { voyageId: string }) {
  const { requestAction, dialog } = useActionDialog();
  const projectionRef = useRef<Projection | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [liveUpdate, setLiveUpdate] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/captain/voyages/${voyageId}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as Projection & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "This Voyage is unavailable.");
      const previous = projectionRef.current;
      if (previous && roomVersion(previous) !== roomVersion(body)) {
        const changes: string[] = [];
        if (previous.voyage.captainAuthorityState !== body.voyage.captainAuthorityState)
          changes.push(`Captaincy is now ${words(body.voyage.captainAuthorityState)}.`);
        const before = new Map(previous.crew.map((member) => [member.id, member]));
        for (const member of body.crew) {
          const prior = before.get(member.id);
          if (!prior) changes.push(`${member.displayName} joined the room.`);
          else if (prior.membership.status !== member.membership.status)
            changes.push(`${member.displayName}: ${membershipCopy(member.membership.status)}.`);
          else if (prior.presence.state !== member.presence.state)
            changes.push(`${member.displayName} is ${presenceCopy(member).toLocaleLowerCase()}.`);
          else if (prior.readiness.state !== member.readiness.state)
            changes.push(`${member.displayName} is now ${words(member.readiness.state)}.`);
        }
        setLiveUpdate(changes.slice(0, 3).join(" "));
      }
      projectionRef.current = body;
      setProjection(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The muster room could not be refreshed.");
    }
  }, [voyageId]);

  async function launch() {
    if (!projection || !["READY", "SCHEDULED"].includes(projection.voyage.lifecycle)) return;
    if (
      !(await requestAction({
        eyebrow: "Captain launch",
        title: `Begin “${projection.voyage.voyageName}”?`,
        detail:
          "Ready Crew will receive access to this Voyage. This changes the shared Voyage state; it does not change anyone's membership or private Player history.",
        confirmLabel: "Begin Voyage",
      }))
    )
      return;
    setAction("launch");
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyageId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": projection.csrfToken },
        body: JSON.stringify({ expectedVersion: projection.voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Voyage could not begin.");
      setNotice("The server confirmed this Voyage is available to ready Crew.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Voyage could not begin.");
    } finally {
      setAction("");
    }
  }

  async function invitationAction(member: CrewMember, operation: "extend" | "revoke" | "replace") {
    if (!projection || !member.invitation?.canManage) return;
    if (
      ["revoke", "replace"].includes(operation) &&
      !(await requestAction({
        eyebrow: "Crew invitation",
        title:
          operation === "revoke"
            ? `Revoke ${member.displayName}'s invitation?`
            : `Replace ${member.displayName}'s invitation?`,
        detail:
          operation === "revoke"
            ? "The current invitation link and short code will stop working immediately."
            : "The current invitation link and short code will stop working immediately, and the Crew member will need the replacement invitation.",
        confirmLabel: operation === "revoke" ? "Revoke Invitation" : "Replace Invitation",
        destructive: true,
      }))
    )
      return;
    setAction(`invitation:${member.id}`);
    setError("");
    try {
      const response = await fetch(`/api/captain/invitations/${member.invitation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": projection.csrfToken },
        body: JSON.stringify({ action: operation, extendHours: 168 }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The invitation could not be changed.");
      setNotice(`${member.displayName}'s invitation was ${operation === "extend" ? "resent" : `${operation}d`}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invitation could not be changed.");
    } finally {
      setAction("");
    }
  }

  async function removeMember(member: CrewMember) {
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
          "Their current Voyage access ends immediately. Their existing participation history remains preserved, and a new invitation is required to rejoin.",
        confirmLabel: "Remove from Crew",
        destructive: true,
      }))
    )
      return;
    setAction(`remove:${member.id}`);
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
      setAction("");
    }
  }

  async function transfer(member: CrewMember) {
    if (!projection || !member.canReceiveCaptaincy) return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Transfer Captaincy to ${member.displayName}?`,
        detail:
          "Captain authority moves atomically to this current joined Player. The edition, progression, artifacts, and private Player state do not change.",
        confirmLabel: "Transfer Captaincy",
      }))
    )
      return;
    setAction(`transfer:${member.id}`);
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
      window.location.assign(`/player/playthroughs/${voyageId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be transferred.");
      await load();
    } finally {
      setAction("");
    }
  }

  async function relinquish() {
    if (!projection || projection.voyage.lifecycle === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Relinquish Captaincy for “${projection.voyage.voyageName}”?`,
        detail:
          "This does not cancel the shared Voyage. It enters Succession Hold until an eligible joined Player takes Captaincy, continues solo, or leaves.",
        confirmLabel: "Relinquish Captaincy",
        destructive: true,
      }))
    )
      return;
    setAction("relinquish");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/captain/playthroughs/${voyageId}/captain/relinquish`,
        csrfToken: projection.csrfToken,
        body: { expectedVersion: projection.voyage.concurrencyVersion, idempotencyKey: crypto.randomUUID() },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be relinquished.");
      setNotice("Captaincy was relinquished. The shared Voyage is in Succession Hold, not cancelled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be relinquished.");
      await load();
    } finally {
      setAction("");
    }
  }

  async function cancel() {
    if (!projection || projection.voyage.lifecycle === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Terminal Voyage action",
        title: `Cancel “${projection.voyage.voyageName}” for everyone?`,
        detail:
          "This ends shared play and current participant access for every Crew member. It is not Captain relinquishment or an ordinary crew departure.",
        confirmLabel: "Cancel Voyage for Everyone",
        destructive: true,
      }))
    )
      return;
    setAction("cancel");
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
      await load();
    } finally {
      setAction("");
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
    const source = new EventSource(`/api/play/sessions/${voyageId}/events`);
    const refresh = () => void load();
    source.onopen = refresh;
    source.addEventListener("progression", refresh);
    source.addEventListener("heartbeat", refresh);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5_000);
    return () => {
      source.close();
      window.clearInterval(timer);
    };
  }, [load, voyageId]);

  if (!projection)
    return (
      <main className="waiting-room captain-muster-room platform-loading">
        {error ? (
          <ErrorState
            title="This muster room cannot be opened"
            detail={error}
            action={{ label: "Return to Captain's Console", href: "/captain/library" }}
          />
        ) : (
          <LoadingState title="Opening the muster room" detail="Checking Crew, readiness, and connection state." />
        )}
      </main>
    );

  const canLaunch =
    ["READY", "SCHEDULED"].includes(projection.voyage.lifecycle) &&
    projection.voyage.captainAuthorityState === "ASSIGNED";
  return (
    <>
      <main
        className="waiting-room captain-muster-room"
        data-captain-authority={projection.voyage.captainAuthorityState}
      >
        <section aria-labelledby="muster-title">
          <p className="eyebrow">Captain muster</p>
          <h1 id="muster-title" tabIndex={-1}>
            {projection.voyage.chronicle}
          </h1>
          <h2>{projection.voyage.voyageName}</h2>
          <p>
            {projection.voyage.captainAuthorityState === "VACANT"
              ? "Captaincy is vacant. This shared Voyage is in Succession Hold, not cancelled."
              : canLaunch
                ? "The room is ready for your final review. Begin the Voyage here when you are ready."
                : "Review crew presence, invitation state, and readiness. This room is focused on gathering, not the full Captain cockpit."}
          </p>
          <dl>
            <div>
              <dt>Edition</dt>
              <dd>{projection.voyage.edition}</dd>
            </div>
            <div>
              <dt>Voyage state</dt>
              <dd>{words(projection.voyage.lifecycle)}</dd>
            </div>
            <div>
              <dt>Captaincy</dt>
              <dd>{projection.voyage.captainAuthorityState === "ASSIGNED" ? "You are Captain" : "Succession Hold"}</dd>
            </div>
            <div>
              <dt>Last server confirmation</dt>
              <dd>{new Date(projection.voyage.sourceUpdatedAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
          {liveUpdate && (
            <p className="reconciliation-summary" role="status">
              {liveUpdate}
            </p>
          )}
          {notice && <StatusBanner tone="success">{notice}</StatusBanner>}
          {error && <StatusBanner tone="danger">{error}</StatusBanner>}
          <section className="crew-readiness muster-crew" aria-labelledby="captain-muster-crew-title">
            <div className="muster-section-heading">
              <div>
                <p className="eyebrow">Crew composition</p>
                <h3 id="captain-muster-crew-title">
                  {projection.crew.length ? "Everyone in this Voyage" : "Captain-only Voyage"}
                </h3>
              </div>
              <span className="muster-count" aria-label={`${projection.crew.length} crew seats`}>
                {projection.crew.length}
              </span>
            </div>
            {projection.crew.length === 0 ? (
              <p className="muster-empty">
                No Player membership exists yet. This Captain-only Voyage is ready to launch or can receive invitations
                from Captain&apos;s Console.
              </p>
            ) : (
              <ul className="muster-crew-grid">
                {projection.crew.map((member) => (
                  <li
                    key={member.id}
                    data-membership-status={member.membership.status}
                    data-presence-state={member.presence.state}
                    data-captain={member.isCaptainsOwnPlayerMembership ? "true" : "false"}
                  >
                    <span className="muster-avatar" aria-hidden="true">
                      {initials(member.displayName)}
                    </span>
                    <div className="muster-member-copy">
                      <div className="muster-member-title">
                        <strong>{member.displayName}</strong>
                        {member.isCaptainsOwnPlayerMembership && <span className="muster-badge">You</span>}
                        {member.isCaptainsOwnPlayerMembership && (
                          <span className="muster-badge muster-badge-captain">Captain</span>
                        )}
                      </div>
                      <span>{member.crewRole ?? "Player"}</span>
                      <div className="muster-statuses">
                        <span>{membershipCopy(member.membership.status)}</span>
                        <span>
                          {member.readiness.state === "READY"
                            ? "Ready"
                            : member.readiness.state === "NOT_READY"
                              ? "Not ready"
                              : "Readiness unknown"}
                        </span>
                        <span>{presenceCopy(member)}</span>
                      </div>
                    </div>
                    <div className="muster-member-actions">
                      {member.invitation?.canManage && (
                        <>
                          <button disabled={Boolean(action)} onClick={() => void invitationAction(member, "extend")}>
                            Resend invitation
                          </button>
                          <button disabled={Boolean(action)} onClick={() => void invitationAction(member, "replace")}>
                            Replace invitation
                          </button>
                          <button
                            className="button-danger"
                            disabled={Boolean(action)}
                            onClick={() => void invitationAction(member, "revoke")}
                          >
                            Revoke invitation
                          </button>
                        </>
                      )}
                      {!member.isCaptainsOwnPlayerMembership &&
                        !["REMOVED", "LEFT", "CANCELLED"].includes(member.membership.status) && (
                          <button
                            className="button-danger"
                            disabled={Boolean(action)}
                            onClick={() => void removeMember(member)}
                          >
                            {action === `remove:${member.id}` ? "Removing…" : "Remove from Crew"}
                          </button>
                        )}
                      {member.canReceiveCaptaincy && (
                        <button
                          className="button-secondary"
                          disabled={Boolean(action)}
                          onClick={() => void transfer(member)}
                        >
                          {action === `transfer:${member.id}` ? "Transferring…" : "Transfer Captaincy"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="waiting-actions">
            {canLaunch && (
              <button className="brass-button" disabled={Boolean(action)} onClick={() => void launch()}>
                {action === "launch" ? "Beginning Voyage…" : "Begin Voyage"}
              </button>
            )}
            <button className="button-secondary" disabled={Boolean(action)} onClick={() => void load()}>
              Refresh room
            </button>
            <Link className="button-subtle" href="/captain/library">
              Leave Waiting Room
            </Link>
          </div>
          {projection.voyage.captainAuthorityState === "ASSIGNED" &&
            !["CANCELLED", "COMPLETED", "ABANDONED"].includes(projection.voyage.lifecycle) && (
              <details className="muster-management">
                <summary>Captaincy and Voyage options</summary>
                <p>
                  Relinquishing Captaincy, cancelling this Voyage, and leaving this waiting room remain distinct
                  operations.
                </p>
                <div className="waiting-actions">
                  <button className="button-danger" disabled={Boolean(action)} onClick={() => void relinquish()}>
                    {action === "relinquish" ? "Relinquishing Captaincy…" : "Relinquish Captaincy"}
                  </button>
                  <button className="button-danger" disabled={Boolean(action)} onClick={() => void cancel()}>
                    {action === "cancel" ? "Cancelling Voyage…" : "Cancel Voyage for Everyone"}
                  </button>
                </div>
              </details>
            )}
        </section>
      </main>
      {dialog}
    </>
  );
}
