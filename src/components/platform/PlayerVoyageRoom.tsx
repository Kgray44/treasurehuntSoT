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
import { PlatformRelic } from "./PlatformRelic";

type CrewMember = { displayName: string; crewRole: string | null; status: string };
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
};
type ConnectionState = "connecting" | "live" | "polling" | "offline" | "reconnecting" | "reconciling" | "revoked";
type RouteHandoff = (destination: string) => void | Promise<void>;

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
  return `${member.displayName}\u0000${member.crewRole ?? "Player"}`;
}

function crewVersion(member: CrewMember) {
  return member.status;
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
  const { mode } = useMotionMode();
  const layoutToken = resolvePlatformMotionToken("layout", mode);
  const ceremonyToken = resolvePlatformMotionToken("ceremony", mode);
  const voyageRef = useRef<Playthrough | null>(null);
  const connectionRef = useRef<ConnectionState>("connecting");
  const requestVersion = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const crewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchStarted = useRef(false);
  const serverOffset = useRef(0);
  const [voyage, setVoyage] = useState<Playthrough | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [newCrew, setNewCrew] = useState<ReadonlySet<string>>(new Set());
  const [reconciliation, setReconciliation] = useState<readonly string[]>([]);
  const [clock, setClock] = useState<number | null>(null);
  const [launchReady, setLaunchReady] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);

  const load = useCallback(
    async (nextConnection?: ConnectionState) => {
      if (activeLoad.current || connectionRef.current === "revoked") return;
      const controller = new AbortController();
      activeLoad.current = controller;
      try {
        const response = await fetch(`/api/player/playthroughs/${playthroughId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          playthrough?: Playthrough;
          serverTime?: string;
          error?: string;
        };
        if (!response.ok || !body.playthrough) {
          if ([403, 404, 410].includes(response.status) && voyageRef.current) {
            setConnection("revoked");
            setError(body.error ?? "Your access to this voyage was revoked.");
          } else setError(body.error ?? "This voyage is unavailable.");
          return;
        }
        requestVersion.current += 1;
        if (body.serverTime) serverOffset.current = new Date(body.serverTime).getTime() - Date.now();
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
          for (const id of diff.addedIds) changes.push(`${id.split("\u0000")[0]} joined the waiting crew.`);
          for (const id of diff.changedIds) changes.push(`${id.split("\u0000")[0]}'s readiness changed.`);
          setReconciliation(changes);
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
      if (document.hidden || connectionRef.current === "revoked") return;
      const nextConnection = connectionRef.current === "live" ? "live" : "polling";
      if (nextConnection === "polling") setConnection("polling");
      void load(nextConnection);
    }, 5_000);
    const source = new EventSource(`/api/play/sessions/${playthroughId}/events`);
    source.onopen = () => {
      setConnection("reconciling");
      reconcile("live");
    };
    source.addEventListener("progression", () => {
      setConnection("reconciling");
      reconcile("live");
    });
    source.addEventListener("access-revoked", () => {
      setConnection("revoked");
      setError("Your access to this voyage was revoked.");
    });
    source.onerror = () => setConnection(navigator.onLine ? "polling" : "offline");
    const onOffline = () => setConnection("offline");
    const onOnline = () => {
      setConnection("reconnecting");
      reconcile("reconciling");
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      source.close();
      activeLoad.current?.abort("unmounted");
      if (crewTimer.current) clearTimeout(crewTimer.current);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [load, playthroughId]);

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
    if (!voyage?.canEnter || !voyage.runtimeHref || launchStarted.current || routeFailed || connection === "revoked")
      return;
    launchStarted.current = true;
    setLaunchReady(true);
    const showCeremony = consumeOneShot(
      platformOneShotKey("waiting-launch", voyage.id, `${voyage.status}:${voyage.lastSynchronizedAt}`),
    );
    const timer = window.setTimeout(
      async () => {
        try {
          if (onRouteHandoff) await onRouteHandoff(voyage.runtimeHref!);
          else router.push(voyage.runtimeHref!);
        } catch {
          launchStarted.current = false;
          setRouteFailed(true);
          setError("The voyage launched, but the journal route could not open. Try again.");
        }
      },
      showCeremony ? ceremonyToken.durationMs : 0,
    );
    return () => window.clearTimeout(timer);
  }, [ceremonyToken.durationMs, connection, onRouteHandoff, routeFailed, router, voyage]);

  useEffect(() => {
    if (voyage?.state === "COMPLETED") router.replace(`/player/playthroughs/${playthroughId}/journal`);
  }, [playthroughId, router, voyage?.state]);

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
        <LoadingState title="Opening your completed journal" detail="Restoring this Voyage Record and its saved progress." />
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
    <main
      className="waiting-room"
      data-connection-state={connection}
      data-motion-mode={mode}
      data-launch-state={launchReady ? "launch-ready" : "waiting"}
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
          {launchReady
            ? "The Captain has launched the voyage. Releasing the journal clasp…"
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
              {launchReady ? "Launch confirmed" : voyage.status === "SCHEDULED" ? "Scheduled" : "Awaiting Captain"}
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
            <dd className={`connection-${connection}`} role="status" aria-live="polite">
              {connectionCopy[connection]}
            </dd>
          </div>
          <div>
            <dt>Last server confirmation</dt>
            <dd>{new Date(voyage.lastSynchronizedAt).toLocaleTimeString()}</dd>
          </div>
        </dl>
        {reconciliation.length > 0 && (
          <section className="reconciliation-summary" aria-labelledby="reconciliation-title">
            <h3 id="reconciliation-title">Changes received while reconnecting</h3>
            <ol>
              {reconciliation.map((change, index) => (
                <li key={`${index}-${change}`}>{change}</li>
              ))}
            </ol>
          </section>
        )}
        <section className="crew-readiness">
          <h3>Crew readiness</h3>
          <motion.ul layout>
            <AnimatePresence initial={false}>
              {voyage.crew.map((member) => {
                const identity = crewIdentity(member);
                return (
                  <motion.li
                    layout
                    key={identity}
                    initial={newCrew.has(identity) ? { opacity: 0, y: layoutToken.distancePx } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: layoutToken.durationSeconds, ease: platformMotionEasing("layout") }}
                  >
                    <span>{member.displayName}</span>
                    <small>
                      {member.crewRole ?? "Player"} · {member.status.replaceAll("_", " ").toLocaleLowerCase()}
                    </small>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        </section>
        {error && (
          <p className="platform-error" role="alert">
            {error}
          </p>
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
          <Link className="button-subtle" href="/player/library">
            Leave Waiting Room
          </Link>
        </div>
      </section>
    </main>
  );
}
