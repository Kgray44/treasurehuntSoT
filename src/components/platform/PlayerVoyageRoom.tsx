"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { consumeOneShot, platformOneShotKey } from "@/animation/platform/one-shot";
import { reconcileVersionedRows } from "@/animation/platform/polling-delta";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { postIdempotentAuthorityCommand } from "@/helm/authority-command.client";
import { PlatformRelic } from "./PlatformRelic";
import { membershipPresenceDeviceId } from "@/platform/presence-client";

type CrewMember = {
  id?: string;
  displayName: string;
  crewRole: string | null;
  status: string;
  avatar?: null;
  joinedAt?: string | null;
  isCaptain?: boolean;
  isCurrentPlayer?: boolean;
  canReceiveCaptaincy?: boolean;
  presence?: { state: string; lastSeenAt: string | null; activeDeviceCount: number; safeActivity: string | null };
  synchronization?: { state: string; lag: number | null };
  readiness?: { state: string };
  invitation?: { id: string; status: string; expiresAt: string; canManage: boolean } | null;
};
type Playthrough = {
  id: string;
  title: string;
  subtitle: string | null;
  voyageName: string;
  versionLabel: string;
  status: string;
  state: string;
  plannedStartAt: string | null;
  lastSynchronizedAt: string;
  primaryHref: string;
  primaryLabel: string;
  crew: CrewMember[];
  canEnter: boolean;
  runtimeHref: string | null;
  membershipId: string;
  concurrencyVersion?: number;
  captainAuthorityState?: string;
  canTakeCaptaincy?: boolean;
  canContinueSolo?: boolean;
  viewer?: {
    isCaptain: boolean;
    participationMode: "CAPTAIN_AND_PLAYER" | "PLAYER";
    canLaunch: boolean;
  };
};
type ConnectionState = "connecting" | "live" | "polling" | "offline" | "reconnecting" | "reconciling" | "revoked";
type RouteHandoff = (destination: string) => void | Promise<void>;

function isAccessRevoked(connection: ConnectionState) {
  return connection === "revoked";
}

const launchProperties = ["opacity", "transform", "filter"] as const satisfies readonly AnimatedProperty[];

function LaunchTarget({ part }: { part: "latch" | "terminal-pose" }) {
  const registration = useMemo(
    () => ({
      targetKey: `waiting-launch:${part}`,
      part,
      ownerHint: "gsap" as const,
      allowedProperties: launchProperties,
    }),
    [part],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return <i ref={bindTarget} data-waiting-launch-part={part} data-runtime-boundary="gsap" />;
}

function WaitingLaunchBoundary({
  launchReady,
  mode,
}: {
  launchReady: boolean;
  mode: ReturnType<typeof useMotionMode>["mode"];
}) {
  const instanceId = useId();
  return (
    <SceneHost
      kind="platform-ceremony"
      hostKey={`waiting-room-launch:${instanceId}`}
      className="waiting-launch-boundary"
      data-launch-state={launchReady ? "launch-ready" : "waiting"}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <PlatformRelic kind="journal-clasp" state={launchReady ? "releasing" : "locked"} mode={mode} />
      <LaunchTarget part="latch" />
      <LaunchTarget part="terminal-pose" />
    </SceneHost>
  );
}

function crewIdentity(member: CrewMember) {
  return member.id ?? `${member.displayName}\u0000${member.crewRole ?? "Player"}`;
}

function crewVersion(member: CrewMember) {
  return JSON.stringify([
    member.status,
    member.isCaptain,
    member.presence?.state,
    member.synchronization?.state,
    member.synchronization?.lag,
    member.readiness?.state,
    member.invitation?.status,
  ]);
}

function words(value: string | null | undefined) {
  return (value ?? "UNKNOWN").replaceAll("_", " ").toLocaleLowerCase();
}

function membershipCopy(status: string) {
  if (status === "INVITED") return "Invited — not joined";
  if (status === "ACCEPTED") return "Joined — not ready";
  if (status === "READY") return "Joined — ready";
  if (status === "ACTIVE_MEMBER") return "Joined — in Voyage";
  if (status === "COMPLETED_MEMBER") return "Completed Voyage";
  if (status === "LEFT") return "Departed Voyage";
  if (status === "REMOVED") return "Removed from crew";
  if (status === "CANCELLED") return "Voyage cancelled";
  return words(status);
}

function presenceCopy(member: CrewMember) {
  if (["REMOVED", "LEFT", "CANCELLED"].includes(member.status)) return "No longer connected";
  if (member.presence?.state === "CONNECTED")
    return member.synchronization?.state === "CATCHING_UP" ? "Online — catching up" : "Online and in sync";
  if (member.presence?.state === "RECENTLY_LOST") return "Reconnecting";
  if (member.presence?.state === "STALE") return "Offline";
  return "Connection unknown";
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

function countdown(plannedStartAt: string, now: number) {
  const remaining = Math.max(0, new Date(plannedStartAt).getTime() - now);
  const seconds = Math.ceil(remaining / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${remainder}s`;
  return `${minutes}m ${remainder}s`;
}

const connectionCopy: Record<ConnectionState, string> = {
  connecting: "Connecting to the live voyage channel.",
  live: "Live updates connected.",
  polling: "Live updates paused; checking the Captain's ledger every five seconds.",
  offline: "Offline. The last server-confirmed waiting state remains visible.",
  reconnecting: "Connection restored; requesting current voyage state.",
  reconciling: "Comparing missed changes with the Captain's ledger.",
  revoked: "Access revoked. This waiting room is closed.",
};

export function PlayerVoyageRoom({
  playthroughId,
  onRouteHandoff,
}: {
  playthroughId: string;
  onRouteHandoff?: RouteHandoff;
}) {
  const router = useRouter();
  const { requestAction, dialog } = useActionDialog();
  const { mode } = useMotionMode();
  const layoutToken = resolvePlatformMotionToken("layout", mode);
  const ceremonyToken = resolvePlatformMotionToken("ceremony", mode);
  const voyageRef = useRef<Playthrough | null>(null);
  const connectionRef = useRef<ConnectionState>("connecting");
  const requestVersion = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const crewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchStarted = useRef(false);
  const launchHandoffTimer = useRef<number | null>(null);
  const serverOffset = useRef(0);
  const csrfToken = useRef<string | null>(null);
  const [voyage, setVoyage] = useState<Playthrough | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [newCrew, setNewCrew] = useState<ReadonlySet<string>>(new Set());
  const [reconciliation, setReconciliation] = useState<readonly string[]>([]);
  const [clock, setClock] = useState<number | null>(null);
  const [launchReady, setLaunchReady] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);
  const [authorityAction, setAuthorityAction] = useState<
    "takeover" | "solo" | "leave" | "launch" | "remove" | "transfer" | "relinquish" | "cancel" | "invitation" | ""
  >("");
  const [soloDestination, setSoloDestination] = useState<{ href: string; voyageName: string } | null>(null);
  const launchCeremonyKey = voyage
    ? platformOneShotKey("waiting-launch", voyage.id, `${voyage.status}:${voyage.lastSynchronizedAt}`)
    : null;

  const load = useCallback(
    async (nextConnection?: ConnectionState) => {
      if (activeLoad.current || isAccessRevoked(connectionRef.current)) return;
      const controller = new AbortController();
      activeLoad.current = controller;
      try {
        const response = await fetch(`/api/player/playthroughs/${playthroughId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          playthrough?: Playthrough;
          csrfToken?: string;
          serverTime?: string;
          error?: string;
        };
        if (!response.ok || !body.playthrough) {
          if ([403, 404, 410].includes(response.status) && voyageRef.current) {
            connectionRef.current = "revoked";
            setConnection("revoked");
            setError(body.error ?? "Your access to this voyage was revoked.");
          } else setError(body.error ?? "This voyage is unavailable.");
          return;
        }
        if (controller.signal.aborted || isAccessRevoked(connectionRef.current)) return;
        requestVersion.current += 1;
        if (body.serverTime) serverOffset.current = new Date(body.serverTime).getTime() - Date.now();
        csrfToken.current = body.csrfToken ?? null;
        const previous = voyageRef.current;
        const diff = reconcileVersionedRows({
          previous: previous?.crew ?? [],
          next: body.playthrough.crew,
          previousVersion: requestVersion.current - 1,
          nextVersion: requestVersion.current,
          getId: crewIdentity,
          getVersion: crewVersion,
        });
        const nextVoyage = { ...body.playthrough, crew: [...diff.rows] };
        if (previous) {
          const changes: string[] = [];
          if (previous.status !== nextVoyage.status)
            changes.push(`Voyage status changed to ${nextVoyage.status.replaceAll("_", " ").toLocaleLowerCase()}.`);
          const previousCrew = new Map(previous.crew.map((member) => [crewIdentity(member), member]));
          for (const id of diff.addedIds) {
            const member = nextVoyage.crew.find((item) => crewIdentity(item) === id);
            if (member) changes.push(`${member.displayName} joined the waiting crew.`);
          }
          for (const id of diff.changedIds) {
            const before = previousCrew.get(id);
            const member = nextVoyage.crew.find((item) => crewIdentity(item) === id);
            if (!before || !member) continue;
            if (before.isCaptain !== member.isCaptain)
              changes.push(
                member.isCaptain
                  ? `${member.displayName} is now Captain.`
                  : `${member.displayName} is no longer Captain.`,
              );
            else if (before.status !== member.status)
              changes.push(`${member.displayName}: ${membershipCopy(member.status)}.`);
            else if (before.presence?.state !== member.presence?.state)
              changes.push(`${member.displayName} is ${presenceCopy(member).toLocaleLowerCase()}.`);
            else if (before.synchronization?.state !== member.synchronization?.state)
              changes.push(`${member.displayName}'s sync state changed to ${words(member.synchronization?.state)}.`);
            else if (before.readiness?.state !== member.readiness?.state)
              changes.push(`${member.displayName}'s readiness changed to ${words(member.readiness?.state)}.`);
          }
          for (const id of diff.removedIds) {
            const member = previousCrew.get(id);
            if (member) changes.push(`${member.displayName} is no longer listed in this room.`);
          }
          setReconciliation(changes.slice(0, 3));
        }
        if (diff.addedIds.length) {
          setNewCrew(new Set(diff.addedIds));
          if (crewTimer.current) clearTimeout(crewTimer.current);
          crewTimer.current = setTimeout(() => setNewCrew(new Set()), 800);
        }
        voyageRef.current = nextVoyage;
        setVoyage(nextVoyage);
        setError("");
        if (nextConnection) setConnection(nextConnection);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setConnection(navigator.onLine ? "polling" : "offline");
        setError("The waiting room could not be reached. Check your connection and try again.");
      } finally {
        if (activeLoad.current === controller) activeLoad.current = null;
      }
    },
    [playthroughId],
  );

  async function takeCaptaincy() {
    if (!voyage?.canTakeCaptaincy || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Succession Hold",
        title: `Take Captaincy for “${voyage.voyageName}”?`,
        detail:
          "You will become the shared Voyage's Captain while remaining an ordinary Player. If another Player acts at the same time, only the first committed request can win.",
        confirmLabel: "Take Captaincy",
      }))
    )
      return;
    setAuthorityAction("takeover");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/player/playthroughs/${voyage.id}/captain/takeover`,
        csrfToken: csrfToken.current ?? "",
        body: { expectedVersion: voyage.concurrencyVersion, idempotencyKey: crypto.randomUUID() },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be taken.");
      router.push("/captain/library");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be taken.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function continueSolo() {
    if (!voyage?.canContinueSolo || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Personal continuation",
        title: `Continue “${voyage.voyageName}” solo?`,
        detail:
          "This creates a new personal Voyage from the last committed shared state. This shared Voyage, its Captaincy, its Crew, and every other Player's private state remain unchanged.",
        confirmLabel: "Create Solo Voyage",
      }))
    )
      return;
    setAuthorityAction("solo");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/player/playthroughs/${voyage.id}/continue-solo`,
        csrfToken: csrfToken.current ?? "",
        body: { expectedVersion: voyage.concurrencyVersion, idempotencyKey: crypto.randomUUID() },
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        voyageId?: string;
        voyageName?: string;
      };
      if (!response.ok || !body.voyageId) throw new Error(body.error ?? "A solo continuation could not be created.");
      // The fork is authoritative at this point. Keep the committed result
      // visible until the Player opens it, so a slow route handoff can never
      // make this separate authority mutation look indeterminate.
      setSoloDestination({
        href: `/player/playthroughs/${body.voyageId}`,
        voyageName: body.voyageName ?? `${voyage.voyageName} — solo`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A solo continuation could not be created.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function leaveVoyage() {
    if (!voyage || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Voyage membership",
        title: `Leave “${voyage.voyageName}”?`,
        detail:
          "Leaving ends only your access to this shared Voyage. Its current shared state and every other Player remain unchanged.",
        confirmLabel: "Leave Voyage",
        destructive: true,
      }))
    )
      return;
    setAuthorityAction("leave");
    setError("");
    try {
      const response = await fetch(`/api/player/playthroughs/${voyage.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken.current ?? "" },
        body: JSON.stringify({ expectedVersion: voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "This Voyage could not be left.");
      router.push("/player/library");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Voyage could not be left.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function launchVoyage() {
    if (!voyage?.viewer?.canLaunch || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Captain launch",
        title: `Begin “${voyage.voyageName}”?`,
        detail:
          "Ready Crew will receive access to this Voyage. This changes the shared Voyage state; it does not change anyone's membership or private Player history.",
        confirmLabel: "Begin Voyage",
      }))
    )
      return;
    setAuthorityAction("launch");
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyage.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken.current ?? "" },
        body: JSON.stringify({ expectedVersion: voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Voyage could not begin.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Voyage could not begin.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function removeCrewMember(member: CrewMember) {
    if (
      !voyage?.viewer?.isCaptain ||
      member.isCurrentPlayer ||
      ["REMOVED", "LEFT", "CANCELLED"].includes(member.status)
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
    setAuthorityAction("remove");
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyage.id}/crew/${member.id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken.current ?? "" },
        body: JSON.stringify({ expectedVersion: voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Crew access could not be changed.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Crew access could not be changed.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function manageInvitation(member: CrewMember, action: "extend" | "revoke" | "replace") {
    if (!voyage?.viewer?.isCaptain || !member.invitation?.canManage || authorityAction) return;
    if (
      ["revoke", "replace"].includes(action) &&
      !(await requestAction({
        eyebrow: "Crew invitation",
        title:
          action === "revoke"
            ? `Revoke ${member.displayName}'s invitation?`
            : `Replace ${member.displayName}'s invitation?`,
        detail:
          action === "revoke"
            ? "The current invitation link and short code will stop working immediately."
            : "The current invitation link and short code will stop working immediately, and the Crew member will need the replacement invitation.",
        confirmLabel: action === "revoke" ? "Revoke Invitation" : "Replace Invitation",
        destructive: true,
      }))
    )
      return;
    setAuthorityAction("invitation");
    setError("");
    try {
      const response = await fetch(`/api/captain/invitations/${member.invitation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken.current ?? "" },
        body: JSON.stringify({ action, extendHours: 168 }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The invitation could not be changed.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invitation could not be changed.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function transferCaptaincy(member: CrewMember) {
    if (!voyage?.viewer?.isCaptain || !member.canReceiveCaptaincy || authorityAction) return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Transfer Captaincy to ${member.displayName}?`,
        detail:
          "Captain authority moves atomically to this current joined Player. Your own Player participation, the edition, progression, artifacts, and private Player state do not change.",
        confirmLabel: "Transfer Captaincy",
      }))
    )
      return;
    setAuthorityAction("transfer");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/captain/playthroughs/${voyage.id}/captain/transfer`,
        csrfToken: csrfToken.current ?? "",
        body: {
          recipientMembershipId: member.id,
          expectedVersion: voyage.concurrencyVersion,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be transferred.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be transferred.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function relinquishCaptaincy() {
    if (!voyage?.viewer?.isCaptain || authorityAction || voyage.state === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Captain authority",
        title: `Relinquish Captaincy for “${voyage.voyageName}”?`,
        detail:
          "This does not cancel the shared Voyage. It enters Succession Hold until an eligible joined Player takes Captaincy, continues solo, or leaves.",
        confirmLabel: "Relinquish Captaincy",
        destructive: true,
      }))
    )
      return;
    setAuthorityAction("relinquish");
    setError("");
    try {
      const response = await postIdempotentAuthorityCommand({
        url: `/api/captain/playthroughs/${voyage.id}/captain/relinquish`,
        csrfToken: csrfToken.current ?? "",
        body: { expectedVersion: voyage.concurrencyVersion, idempotencyKey: crypto.randomUUID() },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Captaincy could not be relinquished.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Captaincy could not be relinquished.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  async function cancelVoyage() {
    if (!voyage?.viewer?.isCaptain || authorityAction || voyage.state === "CANCELLED") return;
    if (
      !(await requestAction({
        eyebrow: "Terminal Voyage action",
        title: `Cancel “${voyage.voyageName}” for everyone?`,
        detail:
          "This ends shared play and current participant access for every Crew member. It is not Captain relinquishment or an ordinary crew departure.",
        confirmLabel: "Cancel Voyage for Everyone",
        destructive: true,
      }))
    )
      return;
    setAuthorityAction("cancel");
    setError("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyage.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken.current ?? "" },
        body: JSON.stringify({ expectedVersion: voyage.concurrencyVersion }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Voyage could not be cancelled.");
      await load("reconciling");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Voyage could not be cancelled.");
      await load("reconciling");
    } finally {
      setAuthorityAction("");
    }
  }

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    queueMicrotask(() => void load("connecting"));
    const reconcile = (nextConnection: ConnectionState) => {
      activeLoad.current?.abort("superseded-by-authoritative-event");
      activeLoad.current = null;
      void load(nextConnection);
    };
    const timer = window.setInterval(() => {
      if (connectionRef.current === "revoked") return;
      const nextConnection = connectionRef.current === "live" ? "live" : "polling";
      if (nextConnection === "polling") setConnection("polling");
      void load(nextConnection);
    }, 5_000);
    const source = new EventSource(`/api/play/sessions/${playthroughId}/events`);
    const reconcileFromServer = () => {
      setConnection("reconciling");
      reconcile("live");
    };
    source.onopen = reconcileFromServer;
    source.addEventListener("progression", () => {
      reconcileFromServer();
    });
    // The stream heartbeat is the durable reconciliation path when a browser
    // backgrounds a waiting room long enough to defer local timers or an
    // in-process progression notification. A newly active Voyage must still
    // release its Player route without requiring a manual refresh.
    source.addEventListener("heartbeat", reconcileFromServer);
    source.addEventListener("access-revoked", () => {
      const currentLoad = activeLoad.current;
      activeLoad.current = null;
      currentLoad?.abort("access-revoked");
      if (launchHandoffTimer.current) {
        window.clearTimeout(launchHandoffTimer.current);
        launchHandoffTimer.current = null;
      }
      connectionRef.current = "revoked";
      setConnection("revoked");
      setError("Your access to this voyage was revoked.");
    });
    source.onerror = () => setConnection(navigator.onLine ? "polling" : "offline");
    const onOffline = () => setConnection("offline");
    const onOnline = () => {
      setConnection("reconnecting");
      reconcile("reconciling");
    };
    const reconcileWhenVisible = () => {
      if (connectionRef.current === "revoked") return;
      if (document.hidden) return;
      setConnection("reconciling");
      reconcile("reconciling");
    };
    // Focus is the resume signal even if the visibility property has not
    // caught up yet. Waiting for a single visibility recheck can strand a
    // launched Voyage when the browser delays that update beyond one task.
    const onFocus = () => {
      if (connectionRef.current === "revoked") return;
      setConnection("reconciling");
      reconcile("reconciling");
    };
    const onVisibilityChange = reconcileWhenVisible;
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      source.close();
      activeLoad.current?.abort("unmounted");
      if (crewTimer.current) clearTimeout(crewTimer.current);
      if (launchHandoffTimer.current) {
        window.clearTimeout(launchHandoffTimer.current);
        launchHandoffTimer.current = null;
      }
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, playthroughId]);

  useEffect(() => {
    if (!voyage?.membershipId || !csrfToken.current || connectionRef.current === "revoked") return;
    const deviceInstanceId = membershipPresenceDeviceId();
    const report = (disconnected = false) => {
      const token = csrfToken.current;
      if (!token) return;
      void fetch(`/api/player/playthroughs/${playthroughId}/presence`, {
        method: "POST",
        keepalive: disconnected,
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          membershipId: voyage.membershipId,
          deviceInstanceId,
          acknowledgedSequence: 0,
          safeActivity: disconnected ? "RECONNECTING" : "WAITING_ROOM",
          disconnected,
        }),
      }).catch(() => undefined);
    };
    report();
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && connectionRef.current !== "revoked") report();
    }, 20_000);
    return () => {
      window.clearInterval(timer);
      report(true);
    };
  }, [playthroughId, voyage?.membershipId]);

  useEffect(() => {
    if (!voyage?.plannedStartAt) return;
    const updateClock = () => {
      if (!document.hidden) setClock(Date.now() + serverOffset.current);
    };
    const initial = window.setTimeout(updateClock, 0);
    const timer = window.setInterval(updateClock, 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [voyage?.plannedStartAt]);

  useEffect(() => {
    if (
      !voyage?.canEnter ||
      !voyage.runtimeHref ||
      !launchCeremonyKey ||
      launchStarted.current ||
      routeFailed ||
      connectionRef.current === "revoked"
    )
      return;
    launchStarted.current = true;
    setLaunchReady(true);
    const showCeremony = consumeOneShot(launchCeremonyKey);
    const handOff = async () => {
      launchHandoffTimer.current = null;
      if (connectionRef.current === "revoked") return;
      try {
        if (onRouteHandoff) await onRouteHandoff(voyage.runtimeHref!);
        else router.push(voyage.runtimeHref!);
      } catch {
        launchStarted.current = false;
        setRouteFailed(true);
        setError("The voyage launched, but the journal route could not open. Try again.");
      }
    };
    // A background tab can expose the authoritative active state before the
    // browser resumes its timer queue. Do not put the zero-delay recovery
    // route behind that queue; only a visible ceremony earns a delay.
    if (showCeremony && !document.hidden) {
      launchHandoffTimer.current = window.setTimeout(() => void handOff(), ceremonyToken.durationMs);
    } else {
      void handOff();
    }
  }, [
    ceremonyToken.durationMs,
    launchCeremonyKey,
    onRouteHandoff,
    routeFailed,
    router,
    voyage?.canEnter,
    voyage?.id,
    voyage?.runtimeHref,
  ]);

  useEffect(() => {
    if (voyage?.state === "COMPLETED") router.replace(`/player/playthroughs/${playthroughId}/journal`);
  }, [playthroughId, router, voyage?.state]);

  useEffect(() => {
    if (!voyage || voyage.state === "COMPLETED") return;
    const frame = requestAnimationFrame(() => document.getElementById("waiting-title")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [voyage?.id, voyage?.state]);

  if (error && !voyage)
    return (
      <main className="waiting-room platform-loading">
        <ErrorState
          title="This voyage cannot be opened"
          detail={error}
          action={{ label: "Return to My Library", href: "/player/library" }}
        />
      </main>
    );
  if (!voyage)
    return (
      <main className="waiting-room platform-loading">
        <LoadingState title="Opening the waiting room" detail="Checking launch status, participants, and connection." />
      </main>
    );
  if (voyage.state === "COMPLETED")
    return (
      <main className="waiting-room platform-loading">
        <LoadingState
          title="Opening your completed journal"
          detail="Restoring this Voyage Record and its saved progress."
        />
      </main>
    );

  const plannedCountdown = voyage.plannedStartAt
    ? clock === null
      ? "Synchronizing…"
      : countdown(voyage.plannedStartAt, clock)
    : null;
  const relicState =
    connection === "revoked"
      ? "revoked"
      : launchReady
        ? "releasing"
        : connection === "live"
          ? "breathing"
          : connection === "connecting" || connection === "reconnecting" || connection === "reconciling"
            ? "connecting"
            : connection === "offline"
              ? "offline"
              : voyage.status === "SCHEDULED"
                ? "seeking"
                : "locked";
  return (
    <>
      <main
        className="waiting-room"
        data-connection-state={connection}
        data-motion-mode={mode}
        data-launch-state={launchReady ? "launch-ready" : "waiting"}
        data-captain-authority={voyage.captainAuthorityState ?? "ASSIGNED"}
      >
        <WaitingLaunchBoundary launchReady={launchReady} mode={mode} />
        <motion.div
          className="closed-journal"
          data-relic-state={relicState}
          aria-hidden="true"
          animate={{ y: mode === "reduced" || connection !== "live" ? 0 : -3 }}
          transition={{
            duration: 3.6,
            repeat: connection === "live" && mode !== "reduced" ? Infinity : 0,
            repeatType: "reverse",
          }}
        >
          <i />
          <b>
            <PlatformRelic kind="journal-clasp" state={relicState} mode={mode} />
          </b>
        </motion.div>
        <section aria-labelledby="waiting-title">
          <p className="eyebrow">{voyage.status.replaceAll("_", " ")}</p>
          <h1 id="waiting-title" tabIndex={-1}>
            {voyage.title}
          </h1>
          <h2>{voyage.voyageName}</h2>
          <p>
            {voyage.captainAuthorityState === "VACANT"
              ? "Captaincy is vacant. This shared Voyage is in Succession Hold until a joined Player takes Captaincy, continues solo, or leaves."
              : launchReady
                ? "The Captain has launched the voyage. Releasing the journal clasp…"
                : voyage.viewer?.isCaptain
                  ? "You are Captain and an ordinary Player in this Crew. Review the room, then begin the Voyage when it is ready."
                  : "Your place is secured. The journal will open only after the Captain launches the voyage."}
          </p>
          <dl>
            <div>
              <dt>Edition</dt>
              <dd>{voyage.versionLabel}</dd>
            </div>
            <div>
              <dt>Readiness</dt>
              <dd>
                {voyage.captainAuthorityState === "VACANT"
                  ? "Succession Hold"
                  : launchReady
                    ? "Launch confirmed"
                    : voyage.viewer?.isCaptain
                      ? voyage.viewer.canLaunch
                        ? "Captain launch available"
                        : "Captain review in progress"
                      : voyage.status === "SCHEDULED"
                        ? "Scheduled"
                        : "Awaiting Captain"}
              </dd>
            </div>
            {voyage.plannedStartAt && (
              <div data-planned-start-due={plannedCountdown === "0m 0s"}>
                <dt>Planned start</dt>
                <dd>
                  {new Date(voyage.plannedStartAt).toLocaleString()} · <span role="timer">{plannedCountdown}</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Connection</dt>
              <dd className={`connection-${connection}`}>
                <span role="status" aria-live="polite">
                  {connectionCopy[connection]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Last server confirmation</dt>
              <dd>{new Date(voyage.lastSynchronizedAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
          {reconciliation.length > 0 && (
            <section
              className="reconciliation-summary"
              aria-live="polite"
              aria-atomic="true"
              aria-labelledby="reconciliation-title"
            >
              <h3 id="reconciliation-title">Live room update</h3>
              <ol>
                {reconciliation.map((change, index) => (
                  <li key={`${index}-${change}`}>{change}</li>
                ))}
              </ol>
            </section>
          )}
          <section className="crew-readiness muster-crew" aria-labelledby="crew-readiness-title">
            <div className="muster-section-heading">
              <div>
                <p className="eyebrow">Crew muster</p>
                <h3 id="crew-readiness-title">
                  {voyage.crew.length ? "Everyone in this Voyage" : "No Crew seats yet"}
                </h3>
              </div>
              <span className="muster-count" aria-label={`${voyage.crew.length} crew seats`}>
                {voyage.crew.length}
              </span>
            </div>
            {voyage.crew.length === 0 ? (
              <p className="muster-empty">
                This is a Captain-only Voyage. Invite Players from Captain&apos;s Console when you are ready to assemble
                a Crew.
              </p>
            ) : (
              <motion.ul layout className="muster-crew-grid">
                <AnimatePresence initial={false}>
                  {voyage.crew.map((member) => {
                    const identity = crewIdentity(member);
                    return (
                      <motion.li
                        layout
                        key={identity}
                        data-membership-status={member.status}
                        data-presence-state={member.presence?.state ?? "UNKNOWN"}
                        data-captain={member.isCaptain ? "true" : "false"}
                        initial={newCrew.has(identity) ? { opacity: 0, y: layoutToken.distancePx } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: layoutToken.durationSeconds, ease: platformMotionEasing("layout") }}
                      >
                        <span className="muster-avatar" aria-hidden="true">
                          {initials(member.displayName)}
                        </span>
                        <div className="muster-member-copy">
                          <div className="muster-member-title">
                            <strong>{member.displayName}</strong>
                            {member.isCurrentPlayer && <span className="muster-badge">You</span>}
                            {member.isCaptain && <span className="muster-badge muster-badge-captain">Captain</span>}
                          </div>
                          <span>{member.crewRole ?? "Player"}</span>
                          <div className="muster-statuses">
                            <span>{membershipCopy(member.status)}</span>
                            <span>
                              {member.readiness?.state === "READY"
                                ? "Ready"
                                : member.readiness?.state === "NOT_READY"
                                  ? "Not ready"
                                  : "Readiness unknown"}
                            </span>
                            <span>{presenceCopy(member)}</span>
                          </div>
                        </div>
                        {voyage.viewer?.isCaptain && (
                          <div className="muster-member-actions">
                            {member.invitation?.canManage && (
                              <>
                                <button
                                  disabled={Boolean(authorityAction)}
                                  onClick={() => void manageInvitation(member, "extend")}
                                >
                                  Resend invitation
                                </button>
                                <button
                                  disabled={Boolean(authorityAction)}
                                  onClick={() => void manageInvitation(member, "replace")}
                                >
                                  Replace invitation
                                </button>
                                <button
                                  className="button-danger"
                                  disabled={Boolean(authorityAction)}
                                  onClick={() => void manageInvitation(member, "revoke")}
                                >
                                  Revoke invitation
                                </button>
                              </>
                            )}
                            {!member.isCurrentPlayer && !["REMOVED", "LEFT", "CANCELLED"].includes(member.status) && (
                              <button
                                className="button-danger"
                                disabled={Boolean(authorityAction)}
                                onClick={() => void removeCrewMember(member)}
                              >
                                {authorityAction === "remove" ? "Removing…" : "Remove from Crew"}
                              </button>
                            )}
                            {member.canReceiveCaptaincy && (
                              <button
                                className="button-secondary"
                                disabled={Boolean(authorityAction)}
                                onClick={() => void transferCaptaincy(member)}
                              >
                                {authorityAction === "transfer" ? "Transferring…" : "Transfer Captaincy"}
                              </button>
                            )}
                          </div>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </motion.ul>
            )}
          </section>
          {error && (
            <p className="platform-error" role="alert">
              {error}
            </p>
          )}
          {soloDestination && (
            <section className="succession-hold" aria-labelledby="solo-continuation-title" role="status">
              <p className="eyebrow">Personal continuation ready</p>
              <h3 id="solo-continuation-title">Your solo Voyage is ready</h3>
              <p>
                “{soloDestination.voyageName}” begins from the last committed shared state. The shared Voyage and every
                other Player&apos;s private state remain unchanged.
              </p>
              <Link className="brass-button" href={soloDestination.href}>
                Open solo Voyage
              </Link>
            </section>
          )}
          {voyage.captainAuthorityState === "VACANT" && (
            <section className="succession-hold" aria-labelledby="succession-hold-title">
              <p className="eyebrow">Succession Hold</p>
              <h3 id="succession-hold-title">This Voyage needs a Captain</h3>
              <p>
                The current Player-safe state remains readable, but shared progression is unavailable until Captaincy is
                committed. There is no invented deadline.
              </p>
              <div className="waiting-actions">
                {voyage.canTakeCaptaincy && (
                  <button
                    className="brass-button"
                    disabled={Boolean(authorityAction)}
                    onClick={() => void takeCaptaincy()}
                  >
                    {authorityAction === "takeover" ? "Confirming Captaincy…" : "Take Captaincy"}
                  </button>
                )}
                {voyage.canContinueSolo && !soloDestination && (
                  <button disabled={Boolean(authorityAction)} onClick={() => void continueSolo()}>
                    {authorityAction === "solo" ? "Synchronizing…" : "Continue Solo"}
                  </button>
                )}
                <button
                  className="button-danger"
                  disabled={Boolean(authorityAction)}
                  onClick={() => void leaveVoyage()}
                >
                  {authorityAction === "leave" ? "Leaving Voyage…" : "Leave Voyage"}
                </button>
              </div>
            </section>
          )}
          {voyage.viewer?.isCaptain && voyage.captainAuthorityState !== "VACANT" && (
            <section className="muster-captain-frame" aria-labelledby="captain-room-title">
              <p className="eyebrow">Captain in the room</p>
              <h3 id="captain-room-title">Lead this Voyage without leaving your Player perspective</h3>
              <p>
                You remain one ordinary Crew member. Launch is available here when the current Voyage state permits it;
                deeper operations remain in Captain&apos;s Console.
              </p>
              <div className="waiting-actions">
                {voyage.viewer.canLaunch && (
                  <button
                    className="brass-button"
                    disabled={Boolean(authorityAction)}
                    onClick={() => void launchVoyage()}
                  >
                    {authorityAction === "launch" ? "Beginning Voyage…" : "Begin Voyage"}
                  </button>
                )}
                <Link className="button-secondary" href={`/captain/sessions/${voyage.id}`}>
                  Open Captain&apos;s Console
                </Link>
              </div>
              <details className="muster-management">
                <summary>Captaincy and Voyage options</summary>
                <p>
                  Captain transfer, relinquishment, and cancellation are distinct actions. None of them means “Leave
                  Waiting Room.”
                </p>
                <div className="waiting-actions">
                  <button
                    className="button-danger"
                    disabled={Boolean(authorityAction)}
                    onClick={() => void relinquishCaptaincy()}
                  >
                    {authorityAction === "relinquish" ? "Relinquishing Captaincy…" : "Relinquish Captaincy"}
                  </button>
                  <button
                    className="button-danger"
                    disabled={Boolean(authorityAction)}
                    onClick={() => void cancelVoyage()}
                  >
                    {authorityAction === "cancel" ? "Cancelling Voyage…" : "Cancel Voyage for Everyone"}
                  </button>
                </div>
              </details>
            </section>
          )}
          <div className="waiting-actions">
            {launchReady && routeFailed && (
              <button className="brass-button" onClick={() => setRouteFailed(false)}>
                Open launched journal
              </button>
            )}
            {connection !== "revoked" && (
              <button
                className="button-secondary"
                disabled={connection === "reconciling"}
                onClick={() => {
                  setConnection("reconnecting");
                  void load("live");
                }}
              >
                Reconnect and Refresh
              </button>
            )}
            {voyage.captainAuthorityState !== "VACANT" && voyage.canContinueSolo && !soloDestination && (
              <button disabled={Boolean(authorityAction)} onClick={() => void continueSolo()}>
                {authorityAction === "solo" ? "Synchronizing…" : "Continue Solo"}
              </button>
            )}
            {voyage.captainAuthorityState !== "VACANT" && (
              <button className="button-danger" disabled={Boolean(authorityAction)} onClick={() => void leaveVoyage()}>
                {authorityAction === "leave" ? "Leaving Voyage…" : "Leave Voyage"}
              </button>
            )}
            <Link className="button-subtle" href="/player/library">
              Leave Waiting Room
            </Link>
          </div>
        </section>
      </main>
      {dialog}
    </>
  );
}
