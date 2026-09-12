"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Anchor, Crown, Plus, Compass, UserRound, Timer, BookOpen, Check, ChevronDown, Circle } from "./icons";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { postIdempotentAuthorityCommand } from "@/helm/authority-command.client";
import { membershipPresenceDeviceId } from "@/platform/presence-client";
import { type MusterProjection, type MusterMessage, type MusterMember } from "@/muster/contracts";
import { CrewChat } from "./CrewChat";
import { MusterAvatar } from "./MusterAvatar";
import { MusterOptions } from "./MusterOptions";
import { useMusterStage } from "./useMusterStage";
import "./muster.css";

function words(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
function stateName(status: string, authority: string) {
  if (authority === "VACANT") return "Succession Hold";
  if (["READY", "INVITING", "SCHEDULED"].includes(status)) return "Crew Muster";
  return status.charAt(0) + words(status).slice(1);
}
export function readinessCopy(room: MusterProjection) {
  if (["CANCELLED", "COMPLETED", "ABANDONED"].includes(room.voyage.status)) return "This Voyage has ended.";
  if (room.voyage.authorityState === "VACANT") return "A joined Player can take the helm.";
  if (["ACTIVE", "PAUSED"].includes(room.voyage.status)) return "The Voyage has begun. Your story awaits.";
  if (!room.readiness.total)
    return room.viewer.isCaptain ? "Captain-only Voyage. Begin when you're ready." : "The Crew is gathering.";
  const remaining = room.readiness.total - room.readiness.ready;
  if (remaining) return `${remaining} crew ${remaining === 1 ? "member is" : "members are"} still preparing.`;
  return room.viewer.isCaptain
    ? "All set. Begin the Voyage when you're ready."
    : "All set. Waiting for the Captain to begin.";
}
export function MusterRoom({
  voyageId,
  playerRoute = false,
  onRouteHandoff,
}: {
  voyageId: string;
  playerRoute?: boolean;
  onRouteHandoff?: (destination: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const { mode } = useMotionMode();
  const { requestAction, dialog } = useActionDialog();
  const [room, setRoom] = useState<MusterProjection | null>(null);
  const stage = useMusterStage(voyageId, Boolean(room));
  const [messages, setMessages] = useState<MusterMessage[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Connecting");
  const [busy, setBusy] = useState("");
  const [revoked, setRevoked] = useState(false);
  const [coverFailed, setCoverFailed] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [soloDestination, setSoloDestination] = useState<string | null>(null);
  const roomRef = useRef<MusterProjection | null>(null);
  const loading = useRef(false);
  const refreshQueued = useRef(false);
  const accessRevoked = useRef(false);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const handoff = useRef<string | null>(null);
  const load = useCallback(
    async function refresh(): Promise<void> {
      if (!mounted.current || accessRevoked.current) return;
      if (loading.current) {
        refreshQueued.current = true;
        return;
      }
      const currentEpoch = epoch.current;
      loading.current = true;
      try {
        const response = await fetch(`/api/voyages/${voyageId}/muster`, { cache: "no-store" });
        const body = await response.json();
        if (!mounted.current || currentEpoch !== epoch.current || accessRevoked.current) return;
        if (!response.ok) {
          if ([401, 403, 404, 410].includes(response.status)) {
            accessRevoked.current = true;
            setRevoked(true);
            setRoom(null);
            setMessages([]);
          }
          throw new Error(body.error ?? "This Voyage is unavailable.");
        }
        if (!mounted.current || currentEpoch !== epoch.current || accessRevoked.current) return;
        const previous = roomRef.current;
        const next = body as MusterProjection;
        if (previous) {
          const changes = next.crew.filter((member) => {
            const before = previous.crew.find((m) => m.id === member.id);
            return !before || before.status !== member.status || before.isCaptain !== member.isCaptain;
          });
          if (changes.length)
            setNotice(
              changes
                .map(
                  (m) => `${m.displayName}: ${m.isCaptain ? "Captain, " : ""}${m.ready ? "ready" : words(m.status)}.`,
                )
                .join(" "),
            );
        }
        roomRef.current = next;
        setRoom(next);
        setError("");
        setRevoked(false);
        const chat = await fetch(`/api/voyages/${voyageId}/muster/chat`, { cache: "no-store" });
        const history = await chat.json();
        if (!mounted.current || currentEpoch !== epoch.current || accessRevoked.current) return;
        if (chat.ok)
          setMessages((prior) => {
            const incoming = history.messages as MusterMessage[];
            if (prior.length === incoming.length && prior.every((m, i) => m.id === incoming[i]?.id)) return prior;
            // Keep messages already being read when the recent-history window moves.
            const merged = new Map([...prior, ...incoming].map((m) => [m.id, m]));
            return [...merged.values()].sort((a, b) => Number(a.id) - Number(b.id));
          });
        else if (chat.status === 403 || chat.status === 401) setMessages([]);
      } catch (cause) {
        if (mounted.current) {
          setError(cause instanceof Error ? cause.message : "Unable to refresh. Try again.");
          setConnection(navigator.onLine ? "Reconnecting" : "Offline");
        }
      } finally {
        loading.current = false;
        if (refreshQueued.current && mounted.current && !accessRevoked.current) {
          refreshQueued.current = false;
          queueMicrotask(() => void refresh());
        }
      }
    },
    [voyageId],
  );
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => void load());
    let source: EventSource;
    const reconcile = () => {
      if (navigator.onLine) void load();
    };
    const connect = () => {
      source = new EventSource(`/api/voyages/${voyageId}/muster/events`);
      source.onopen = () => setConnection("Live");
      source.addEventListener("changed", reconcile);
      source.addEventListener("heartbeat", () => {
        setConnection("Live");
        reconcile();
      });
      source.addEventListener("access-revoked", () => {
        source.close();
        accessRevoked.current = true;
        epoch.current += 1;
        roomRef.current = null;
        setRevoked(true);
        setRoom(null);
        setMessages([]);
        setError("Your access to this Voyage has ended.");
      });
      source.onerror = () => setConnection(navigator.onLine ? "Reconnecting" : "Offline");
    };
    connect();
    const offline = () => {
      source.close();
      setConnection("Offline");
    };
    const online = () => {
      if (accessRevoked.current) return;
      source.close();
      setConnection("Reconnecting");
      connect();
      reconcile();
    };
    const visible = () => {
      if (!document.hidden) reconcile();
    };
    const timer = window.setInterval(reconcile, 5000);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      source.close();
      window.clearInterval(timer);
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, voyageId]);
  const membershipId = room?.viewer.membershipId;
  useEffect(() => {
    if (!membershipId || revoked) return;
    const deviceInstanceId = membershipPresenceDeviceId();
    const report = (disconnected = false) => {
      const current = roomRef.current;
      if (!current) return;
      void fetch(`/api/player/playthroughs/${voyageId}/presence`, {
        method: "POST",
        keepalive: disconnected,
        headers: { "Content-Type": "application/json", "x-csrf-token": current.csrfToken },
        body: JSON.stringify({
          membershipId,
          deviceInstanceId,
          acknowledgedSequence: current.voyage.currentSequence,
          safeActivity: disconnected ? "RECONNECTING" : "WAITING_ROOM",
          disconnected,
        }),
      }).catch(() => undefined);
    };
    report();
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) report();
    }, 20_000);
    return () => {
      window.clearInterval(timer);
      report(true);
    };
  }, [membershipId, revoked, voyageId]);
  useEffect(() => {
    const href = room?.viewer.runtimeHref;
    if (!playerRoute || !href || revoked || handoff.current === href) return;
    handoff.current = href;
    Promise.resolve()
      .then(() => (onRouteHandoff ? onRouteHandoff(href) : router.push(href)))
      .catch(() => {
        setError("The Voyage has begun, but the journal could not open. Use Open Voyage to try again.");
      });
  }, [playerRoute, room?.viewer.runtimeHref, revoked, onRouteHandoff, router]);

  async function command(
    action: string,
    url: string,
    label: string,
    detail: string,
    options: { destructive?: boolean; idempotent?: boolean; data?: object; destination?: string } = {},
  ) {
    if (!room || busy) return;
    if (
      !(await requestAction({
        eyebrow: "Voyage",
        title: `${label}?`,
        detail,
        confirmLabel: label,
        destructive: options.destructive,
      }))
    )
      return;
    setBusy(action);
    setError("");
    try {
      const payload = {
        expectedVersion: room.voyage.concurrencyVersion,
        ...options.data,
        ...(options.idempotent ? { idempotencyKey: crypto.randomUUID() } : {}),
      };
      const response = options.idempotent
        ? await postIdempotentAuthorityCommand({ url, csrfToken: room.csrfToken, body: payload })
        : await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": room.csrfToken },
            body: JSON.stringify(payload),
          });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The action could not be completed.");
      setNotice(`${label}: confirmed.`);
      if (action === "solo" && result.voyageId) setSoloDestination(`/player/playthroughs/${result.voyageId}`);
      else if (options.destination) router.push(options.destination);
      else await load();
    } catch (cause) {
      await load();
      setError(cause instanceof Error ? cause.message : "Please refresh and try again.");
    } finally {
      setBusy("");
    }
  }
  const captainPath = `/api/captain/playthroughs/${voyageId}`;
  const playerPath = `/api/player/playthroughs/${voyageId}`;
  if (!room)
    return (
      <main className="muster-scene muster-loading" data-motion={mode}>
        <div className="muster-environment" aria-hidden="true" />
        <section>
          <Compass size={34} />
          <h1>
            {revoked ? "This room is unavailable" : error ? "The harbor is out of reach" : "Gathering your Crew…"}
          </h1>
          {error && <p role="alert">{error}</p>}
          {!revoked && <button onClick={() => void load()}>Refresh room</button>}
          <Link href={playerRoute ? "/player/library" : "/captain/library"}>Return to Voyages</Link>
        </section>
      </main>
    );
  const { voyage, viewer, readiness } = room;
  const currentCrew = room.crew.filter(
    (m) => m.isCaptain || !["LEFT", "REMOVED", "CANCELLED", "COMPLETED_MEMBER"].includes(m.status),
  );
  const departed = room.crew.filter(
    (m) => !m.isCaptain && ["LEFT", "REMOVED", "CANCELLED", "COMPLETED_MEMBER"].includes(m.status),
  );
  const gathering = ["READY", "INVITING", "SCHEDULED"].includes(voyage.status);
  return (
    <>
      <main
        ref={stage}
        className="muster-scene"
        data-motion={mode}
        data-viewer-role={viewer.isCaptain ? (viewer.participates ? "captain-player" : "captain-only") : "player"}
        aria-labelledby="muster-title"
      >
        <div className="muster-environment" aria-hidden="true">
          <div className="muster-lantern-glow" />
        </div>
        <section className="muster-gathering">
          <header className="muster-title-group">
            <p className="muster-eyebrow">{viewer.isCaptain ? "Captain Muster" : "Chronicle Muster"}</p>
            <h1 id="muster-title">{voyage.title}</h1>
            <p className="muster-voyage-name">{voyage.voyageName}</p>
            <p className="muster-intro">
              {viewer.isCaptain
                ? "Review your crew, prepare together, and set sail when you're ready."
                : "Review crew, prepare together, and wait for the Captain to set sail."}
            </p>
          </header>
          <ul className="muster-crew" aria-label="Voyage crew">
            {currentCrew.map((member) => (
              <li
                className="muster-crew-card"
                data-captain={member.isCaptain}
                data-ready={member.ready}
                data-invited={member.status === "INVITED"}
                key={member.id}
              >
                {member.isCaptain && <Crown className="muster-crown" size={21} aria-label="Captain" />}
                <MusterAvatar name={member.displayName} url={member.avatarUrl} />
                <span
                  className="muster-presence"
                  data-presence={member.presence}
                  title={
                    member.presence === "CONNECTED"
                      ? "Connected"
                      : member.presence === "RECENTLY_LOST"
                        ? "Reconnecting"
                        : member.presence === "STALE"
                          ? "Offline"
                          : "Connection unknown"
                  }
                >
                  <span className="sr-only">
                    {member.presence === "CONNECTED"
                      ? "Connected"
                      : member.presence === "RECENTLY_LOST"
                        ? "Reconnecting"
                        : member.presence === "STALE"
                          ? "Offline"
                          : "Connection unknown"}
                  </span>
                </span>
                <strong>{member.displayName}</strong>
                <span className="muster-crew-role">
                  {member.isCaptain ? "Captain" : "Crew"}
                  {member.isCurrentPlayer ? " · You" : ""}
                </span>
                <span className="muster-member-ready">
                  {member.status === "CAPTAIN_ONLY" || (!member.participates && member.isCaptain) ? (
                    <>
                      <Anchor size={13} />
                      Captain only
                    </>
                  ) : member.ready ? (
                    <>
                      <i>
                        <Check size={10} />
                      </i>
                      Ready
                    </>
                  ) : member.status === "INVITED" ? (
                    <>
                      <Circle size={11} />
                      Invited
                    </>
                  ) : (
                    <>
                      <Circle size={11} />
                      Preparing
                    </>
                  )}
                </span>
                {viewer.isCaptain && !member.isCaptain && (
                  <button
                    className="muster-manage-member"
                    aria-label={`Manage ${member.displayName}`}
                    aria-expanded={selectedMember === member.id}
                    onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                  >
                    <ChevronDown size={13} />
                  </button>
                )}
                {viewer.isCaptain && selectedMember === member.id && (
                  <fieldset disabled={Boolean(busy)}>
                    <MemberMenu member={member} captainPath={captainPath} voyageId={voyageId} command={command} />
                  </fieldset>
                )}
              </li>
            ))}
            {viewer.canInvite && (
              <li className="muster-open-card">
                <Link href="/captain/library" aria-label="Invite Crew">
                  <span>
                    <Plus size={30} aria-hidden="true" />
                  </span>
                  <strong>Invite Crew</strong>
                  <small>
                    Send another
                    <br />
                    invitation
                  </small>
                </Link>
              </li>
            )}
          </ul>
          {departed.length > 0 && (
            <details className="muster-departed">
              <summary>Earlier crew ({departed.length})</summary>
              {departed.map((m) => (
                <p key={m.id}>
                  {m.displayName} · {words(m.status)}
                </p>
              ))}
            </details>
          )}
        </section>
        <aside className="muster-parchment" aria-labelledby="muster-chronicle-title">
          <div className="muster-paper" aria-hidden="true" />
          <div className="muster-paper-content">
            <div className="muster-cover">
              {coverFailed === voyage.coverUrl ? (
                <div className="muster-cover-error" role="status">
                  <p>Chronicle cover temporarily unavailable.</p>
                  <button onClick={() => setCoverFailed("")}>Retry cover</button>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={voyage.coverUrl}
                  alt={`${voyage.title} Chronicle cover`}
                  onError={() => setCoverFailed(voyage.coverUrl)}
                />
              )}
              <span>
                <span aria-hidden="true">✦</span>{" "}
                {gathering ? "Awaiting departure" : stateName(voyage.status, voyage.authorityState)}
              </span>
            </div>
            <h2 id="muster-chronicle-title">{voyage.title}</h2>
            {voyage.subtitle && <p className="muster-subtitle">{voyage.subtitle}</p>}
            {voyage.description && <p className="muster-description">{voyage.description}</p>}
            <dl className="muster-details">
              <div>
                <dt className="muster-detail-icon" aria-hidden="true">
                  <i>
                    <BookOpen />
                  </i>
                </dt>
                <dt>Edition</dt>
                <dd>{voyage.edition}</dd>
              </div>
              <div>
                <dt className="muster-detail-icon" aria-hidden="true">
                  <i>
                    <Compass />
                  </i>
                </dt>
                <dt>Voyage State</dt>
                <dd>{stateName(voyage.status, voyage.authorityState)}</dd>
              </div>
              <div>
                <dt className="muster-detail-icon" aria-hidden="true">
                  <i>
                    <UserRound />
                  </i>
                </dt>
                <dt>Captain</dt>
                <dd>{voyage.captainName}</dd>
              </div>
              {voyage.duration !== null && (
                <div>
                  <dt className="muster-detail-icon" aria-hidden="true">
                    <i>
                      <Timer />
                    </i>
                  </dt>
                  <dt>Estimated Duration</dt>
                  <dd>
                    {voyage.duration >= 60
                      ? `~ ${Number((voyage.duration / 60).toFixed(1))} ${voyage.duration === 60 ? "Hour" : "Hours"}`
                      : `~ ${voyage.duration} Minutes`}
                  </dd>
                </div>
              )}
            </dl>
            {voyage.plannedStartAt && (
              <p className="muster-schedule">Planned departure · {new Date(voyage.plannedStartAt).toLocaleString()}</p>
            )}
            <section className="muster-readiness" aria-labelledby="muster-readiness-title">
              <h3 id="muster-readiness-title">Voyage Readiness</h3>
              <p>{readinessCopy(room)}</p>
              <div
                className="muster-progress"
                role="progressbar"
                aria-label="Player readiness"
                aria-valuemin={0}
                aria-valuemax={Math.max(readiness.total, 1)}
                aria-valuenow={readiness.ready}
                aria-valuetext={`${readiness.ready} of ${readiness.total} Players ready`}
              >
                <span style={{ width: `${readiness.total ? (readiness.ready / readiness.total) * 100 : 0}%` }} />
                {readiness.total > 1 &&
                  readiness.total <= 12 &&
                  Array.from({ length: readiness.total - 1 }, (_, i) => (
                    <i key={i} style={{ left: `${((i + 1) / readiness.total) * 100}%` }} />
                  ))}
              </div>
              <div className="muster-ready-count">
                {readiness.ready} / {readiness.total} Ready
              </div>
            </section>
            <div className="muster-launch-area">
              {viewer.isCaptain && gathering ? (
                <button
                  className="muster-launch"
                  disabled={!viewer.canLaunch || Boolean(busy)}
                  onClick={() =>
                    void command(
                      "launch",
                      `${captainPath}/launch`,
                      "Begin the Voyage",
                      "Ready Crew receive access to the Voyage. This changes the shared Voyage state.",
                    )
                  }
                >
                  <Anchor />
                  {busy === "launch" ? "Beginning Voyage…" : "Begin the Voyage"}
                </button>
              ) : viewer.runtimeHref ? (
                <Link className="muster-launch" href={viewer.runtimeHref}>
                  <Anchor />
                  Open Voyage
                </Link>
              ) : viewer.isCaptain && !gathering ? (
                <Link className="muster-launch" href={`/captain/sessions/${voyageId}`}>
                  <Anchor />
                  Open Captain’s Console
                </Link>
              ) : (
                <button className="muster-launch" disabled>
                  <Anchor />
                  {["CANCELLED", "COMPLETED", "ABANDONED"].includes(voyage.status)
                    ? "Voyage ended"
                    : voyage.authorityState === "VACANT"
                      ? "Awaiting a Captain"
                      : "Waiting for the Captain"}
                </button>
              )}
              <p>
                {viewer.isCaptain
                  ? !readiness.total
                    ? "Captain authority is separate from Player readiness."
                    : !readiness.allReady && viewer.canLaunch
                      ? "Ready Players can begin; preparing crew can join later."
                      : "Good company. A new horizon."
                  : !gathering
                    ? "Your access follows the current Voyage state."
                    : viewer.ready
                      ? "You're ready. The Captain will begin the Voyage."
                      : "Your readiness follows your current participation."}
              </p>
            </div>
            <MusterOptions label={viewer.isCaptain ? "Captain & Voyage options" : "Your Voyage options"}>
              <div className="muster-option-buttons">
                {viewer.isCaptain && (
                  <>
                    <button
                      disabled={Boolean(busy) || !viewer.canRelinquish}
                      onClick={() =>
                        void command(
                          "relinquish",
                          `${captainPath}/captain/relinquish`,
                          "Relinquish Captaincy",
                          "Place this Voyage in Succession Hold. A joined Player may take Captaincy. Your Player participation, if any, is retained.",
                          {
                            idempotent: true,
                            destination: viewer.participates ? `/player/playthroughs/${voyageId}` : "/captain/library",
                          },
                        )
                      }
                    >
                      Relinquish Captaincy
                    </button>
                    {!viewer.canRelinquish && <p>This Voyage cannot currently change Captain authority.</p>}
                    {gathering && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void command(
                            "cancel",
                            `${captainPath}/cancel`,
                            "Cancel Voyage for Everyone",
                            "End current access for everyone and revoke outstanding invitations. Participation history is preserved. This cannot be undone.",
                            { destructive: true, destination: "/captain/library" },
                          )
                        }
                      >
                        Cancel Voyage for Everyone
                      </button>
                    )}
                  </>
                )}
                {viewer.canTakeCaptaincy && (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void command(
                        "takeover",
                        `${playerPath}/captain/takeover`,
                        "Take Captaincy",
                        "Become the Captain of this Voyage. The first confirmed claim takes the helm.",
                        { idempotent: true },
                      )
                    }
                  >
                    Take Captaincy
                  </button>
                )}
                {soloDestination && <Link href={soloDestination}>Open solo Voyage</Link>}
                {viewer.canContinueSolo && !soloDestination && (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void command(
                        "solo",
                        `${playerPath}/continue-solo`,
                        "Continue Solo",
                        "Create a separate personal Voyage. This shared Voyage and everyone else's private state remain unchanged.",
                        { idempotent: true },
                      )
                    }
                  >
                    Continue Solo
                  </button>
                )}
                {viewer.canLeave && (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void command(
                        "leave",
                        `${playerPath}/leave`,
                        "Leave Voyage",
                        "End your Player access to this shared Voyage. Other Players and retained history are unchanged.",
                        { destructive: true, destination: "/player/library" },
                      )
                    }
                  >
                    Leave Voyage
                  </button>
                )}
                <Link href={viewer.isCaptain ? "/captain/library" : "/player/library"}>Leave Waiting Room</Link>
                <button onClick={() => void load()}>Refresh room</button>
              </div>
            </MusterOptions>
          </div>
        </aside>
        <CrewChat
          voyageId={voyageId}
          csrfToken={room.csrfToken}
          messages={messages}
          connected={connection}
          onSent={load}
          disabled={!gathering || revoked || (!viewer.isCaptain && !viewer.participates)}
        />
        <div className="muster-quote">
          <blockquote>
            “Not all who wait are idle -<br />
            some are simply gathering a better story.”
          </blockquote>
          <span aria-hidden="true">
            <i />
            <Compass size={24} />
            <i />
          </span>
        </div>
        <div className="muster-announcements" aria-live="polite">
          {notice}
        </div>
        {error && (
          <div className="muster-error" role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
      </main>
      {dialog}
    </>
  );
}

function MemberMenu({
  member,
  captainPath,
  voyageId,
  command,
}: {
  member: MusterMember;
  captainPath: string;
  voyageId: string;
  command: (
    action: string,
    url: string,
    label: string,
    detail: string,
    options?: { destructive?: boolean; idempotent?: boolean; data?: object; destination?: string },
  ) => Promise<void>;
}) {
  return (
    <div className="muster-member-menu">
      {member.canReceiveCaptaincy && (
        <button
          onClick={() =>
            void command(
              "transfer",
              `${captainPath}/captain/transfer`,
              "Transfer Captaincy",
              `Give ${member.displayName} Captain authority. Your Player membership is retained.`,
              {
                idempotent: true,
                data: { recipientMembershipId: member.id },
                destination: `/player/playthroughs/${voyageId}`,
              },
            )
          }
        >
          Transfer Captaincy
        </button>
      )}
      {!member.isCaptain && !["LEFT", "REMOVED", "CANCELLED"].includes(member.status) && (
        <button
          onClick={() =>
            void command(
              "remove",
              `${captainPath}/crew/${member.id}/remove`,
              "Remove from Crew",
              `End ${member.displayName}'s current access. Their participation history is preserved.`,
              { destructive: true },
            )
          }
        >
          Remove from Crew
        </button>
      )}
      {member.invitation?.canManage &&
        (["extend", "replace", "revoke"] as const).map((action) => (
          <button
            key={action}
            onClick={() =>
              void command(
                action,
                `/api/captain/invitations/${member.invitation!.id}`,
                action === "extend" ? "Resend invitation" : `${action === "revoke" ? "Revoke" : "Replace"} invitation`,
                action === "extend"
                  ? "Extend the invitation for seven days."
                  : "The current invitation link and code will stop working.",
                { destructive: action !== "extend", data: { action, extendHours: 168 } },
              )
            }
          >
            {action === "extend" ? "Resend" : action === "replace" ? "Replace" : "Revoke"} invitation
          </button>
        ))}
    </div>
  );
}
