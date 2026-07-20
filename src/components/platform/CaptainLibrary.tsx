"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { reconcileVersionedRows } from "@/animation/platform/polling-delta";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";
import { captainCopy } from "@/language/captain-copy";
import { PlatformRelic } from "./PlatformRelic";

type Voyage = {
  id: string;
  taleTitle: string;
  voyageName: string;
  versionLabel: string;
  status: string;
  plannedStartAt: string | null;
  lastActivityAt: string;
  currentSequence: number;
  connected: boolean;
  pendingAction: string | null;
  players: Array<{ id: string; displayName: string; status: string }>;
};
type Invitation = {
  id: string;
  playthroughId: string;
  taleTitle: string;
  voyageName: string | null;
  versionLabel: string | null;
  recipientName: string;
  status: string;
  tokenPrefix: string;
  shortCodePrefix: string;
  expiresAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  replacementId: string | null;
};
type Tale = {
  id: string;
  title: string;
  subtitle: string | null;
  visibility: string;
  versions: Array<{ id: string; label: string; publishedAt: string; activeRunCount: number }>;
};
type Library = {
  csrfToken: string;
  groups: {
    needsAttention: Voyage[];
    activeVoyages: Voyage[];
    readyToLaunch: Voyage[];
    completedPlaythroughs: Voyage[];
  };
  invitations: Invitation[];
  publishedTales: Tale[];
  playerProfiles: Array<{ id: string; displayName: string; username: string | null }>;
  serverTime: string;
};
type CreatedInvitation = {
  id: string;
  recipientName: string;
  link: string;
  shortCode: string;
  qrCodeDataUrl: string;
  message: string;
  expiresAt: string;
};
type CrewDraft = { key: string; playerId: string; displayName: string; crewRole: string; pin: string };

const steps = ["Select Chronicle", "Configure Voyage", "Add Crew", "Invitation access", "Delivery", "Review", "Create"];

type VoyageGroup = keyof Library["groups"];
type VersionedVoyage = { group: VoyageGroup; voyage: Voyage };

function flattenVoyages(groups: Library["groups"]): VersionedVoyage[] {
  return (Object.keys(groups) as VoyageGroup[]).flatMap((group) => groups[group].map((voyage) => ({ group, voyage })));
}

function rebuildVoyageGroups(rows: readonly VersionedVoyage[]): Library["groups"] {
  const groups = {
    needsAttention: [],
    activeVoyages: [],
    readyToLaunch: [],
    completedPlaythroughs: [],
  } as Library["groups"];
  for (const row of rows) groups[row.group].push(row.voyage);
  return groups;
}

function voyageVersion(row: VersionedVoyage) {
  return JSON.stringify([
    row.voyage.status,
    row.voyage.versionLabel,
    row.voyage.currentSequence,
    row.voyage.connected,
    row.voyage.pendingAction,
    row.voyage.players,
  ]);
}

function invitationVersion(invitation: Invitation) {
  return JSON.stringify([
    invitation.status,
    invitation.expiresAt,
    invitation.viewedAt,
    invitation.acceptedAt,
    invitation.replacementId,
  ]);
}

export function CaptainLibrary() {
  const { mode } = useMotionMode();
  const layoutToken = resolvePlatformMotionToken("layout", mode);
  const libraryRef = useRef<Library | null>(null);
  const requestSequence = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const changedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"voyages" | "invitations" | "published">("voyages");
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [wizardDirection, setWizardDirection] = useState<1 | -1>(1);
  const [taleId, setTaleId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [voyageName, setVoyageName] = useState("");
  const [captainMode, setCaptainMode] = useState("CAPTAIN_CONTROLLED");
  const [hints, setHints] = useState("ON_REQUEST");
  const [sideQuests, setSideQuests] = useState(true);
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [players, setPlayers] = useState<CrewDraft[]>([
    { key: "crew-1", playerId: "", displayName: "", crewRole: "Crew member", pin: "" },
  ]);
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [accountRequired, setAccountRequired] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set());
  const [invitationTransitions, setInvitationTransitions] = useState<Readonly<Record<string, string>>>({});
  const [launchState, setLaunchState] =
    useState<Readonly<{ id: string; phase: "confirming" | "launching" | "launched" } | null>>(null);

  const load = useCallback(async () => {
    if (activeLoad.current) return;
    const controller = new AbortController();
    activeLoad.current = controller;
    try {
      const response = await fetch("/api/captain/library", { cache: "no-store", signal: controller.signal });
      const body = (await response.json()) as Library & { error?: string };
      if (!response.ok)
        setError(body.error ?? "Captain's Console is unavailable. No Voyage progress has changed. Check your connection, then try again.");
      else {
        requestSequence.current += 1;
        const previous = libraryRef.current;
        if (!previous) {
          libraryRef.current = body;
          setLibrary(body);
          setChangedIds(
            new Set([
              ...flattenVoyages(body.groups).map((row) => row.voyage.id),
              ...body.invitations.map((item) => item.id),
            ]),
          );
          changedTimer.current = setTimeout(() => setChangedIds(new Set()), 900);
        } else {
          const voyageDiff = reconcileVersionedRows({
            previous: flattenVoyages(previous.groups),
            next: flattenVoyages(body.groups),
            previousVersion: requestSequence.current - 1,
            nextVersion: requestSequence.current,
            getId: (row) => row.voyage.id,
            getVersion: voyageVersion,
            getGroup: (row) => row.group,
          });
          const invitationDiff = reconcileVersionedRows({
            previous: previous.invitations,
            next: body.invitations,
            previousVersion: requestSequence.current - 1,
            nextVersion: requestSequence.current,
            getId: (item) => item.id,
            getVersion: invitationVersion,
          });
          const nextLibrary = {
            ...body,
            groups: voyageDiff.changed ? rebuildVoyageGroups(voyageDiff.rows) : previous.groups,
            invitations: invitationDiff.changed ? [...invitationDiff.rows] : previous.invitations,
            publishedTales:
              JSON.stringify(body.publishedTales) === JSON.stringify(previous.publishedTales)
                ? previous.publishedTales
                : body.publishedTales,
          };
          libraryRef.current = nextLibrary;
          setLibrary(nextLibrary);
          const changed = [
            ...voyageDiff.addedIds,
            ...voyageDiff.changedIds,
            ...invitationDiff.addedIds,
            ...invitationDiff.changedIds,
          ];
          if (changed.length) {
            setChangedIds(new Set(changed));
            if (changedTimer.current) clearTimeout(changedTimer.current);
            changedTimer.current = setTimeout(() => setChangedIds(new Set()), 900);
          }
        }
        setError("");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Captain's Console could not connect. No Voyage progress has changed. Check your connection, then try again.");
    } finally {
      if (activeLoad.current === controller) activeLoad.current = null;
    }
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "invitations")
      queueMicrotask(() => setTab("invitations"));
    queueMicrotask(() => void load());
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      clearInterval(timer);
      activeLoad.current?.abort("unmounted");
      if (changedTimer.current) clearTimeout(changedTimer.current);
    };
  }, [load]);

  const selectedTale = library?.publishedTales.find((tale) => tale.id === taleId);
  const selectedVersion = selectedTale?.versions.find((version) => version.id === versionId);
  const resolvedPlayers = players.map((player) => ({
    ...player,
    displayName:
      library?.playerProfiles.find((profile) => profile.id === player.playerId)?.displayName ??
      player.displayName.trim(),
  }));

  function chooseTale(id: string) {
    setTaleId(id);
    const tale = library?.publishedTales.find((item) => item.id === id);
    setVersionId(tale?.versions[0]?.id ?? "");
    if (!voyageName && tale) setVoyageName(`${resolvedPlayers[0]?.displayName || "New Crew"} · ${tale.title}`);
  }

  async function createVoyage() {
    if (!library || resolvedPlayers.some((player) => !player.displayName)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/captain/playthroughs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": library.csrfToken },
        body: JSON.stringify({
          taleId,
          versionId,
          voyageName,
          captainMode,
          hints,
          sideQuests,
          plannedStartAt: plannedStartAt ? new Date(plannedStartAt).toISOString() : null,
          scheduleTimezone: plannedStartAt ? scheduleTimezone : null,
          expiresInHours,
          accountRequired,
          maxRedemptions: 1,
          accessibilityDefaults: {},
          testVoyage: false,
          players: resolvedPlayers.map((player) => ({
            ...(player.playerId ? { playerId: player.playerId } : {}),
            displayName: player.displayName,
            crewRole: player.crewRole,
            ...(player.pin ? { pin: player.pin } : {}),
          })),
        }),
      });
      const body = (await response.json()) as { invitations?: CreatedInvitation[]; error?: string };
      if (!response.ok)
        return setError(body.error ?? "The Voyage could not be created. Check the Voyage list before trying again to avoid duplicate invitations.");
      setCreated(body.invitations ?? []);
      setNotice("The Voyage and its individual Crew invitations were created together.");
      setWizardDirection(1);
      setStep(6);
      await load();
    } catch {
      setError("The Voyage could not be created. Check the Voyage list before trying again to avoid duplicate invitations.");
    } finally {
      setBusy(false);
    }
  }

  async function launch(voyage: Voyage) {
    if (!library) return;
    setLaunchState({ id: voyage.id, phase: "confirming" });
    if (!window.confirm(`Begin “${voyage.voyageName}” for its ready Crew? The ready Crew will receive access to this Voyage.`)) {
      setLaunchState(null);
      return;
    }
    setLaunchState({ id: voyage.id, phase: "launching" });
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/captain/playthroughs/${voyage.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": library.csrfToken },
        body: "{}",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "The Voyage could not begin. No Crew access has changed. Review the Voyage and try again.");
        setLaunchState(null);
      } else {
        setLaunchState({ id: voyage.id, phase: "launched" });
        setNotice(`“${voyage.voyageName}” is now available to ready Crew.`);
      }
      await load();
    } catch {
      setError("The Voyage could not begin. Check its current status before trying again.");
      setLaunchState(null);
    } finally {
      setBusy(false);
    }
  }

  async function invitationAction(invitation: Invitation, action: "extend" | "revoke" | "replace") {
    if (!library) return;
    if (
      ["revoke", "replace"].includes(action) &&
      !window.confirm(
        action === "revoke"
          ? `Revoke the invitation for ${invitation.recipientName}? The current link and short code will stop working immediately.`
          : `Replace the invitation for ${invitation.recipientName}? The current link and short code will stop working immediately, and the Crew member will need the replacement invitation.`,
      )
    )
      return;
    setInvitationTransitions((current) => ({ ...current, [invitation.id]: `${action}-pending` }));
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/captain/invitations/${invitation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": library.csrfToken },
        body: JSON.stringify({ action, extendHours: 168 }),
      });
      const body = (await response.json()) as { error?: string; replacement?: CreatedInvitation };
      if (!response.ok) {
        setError(body.error ?? "The invitation could not be changed. Its current access remains unchanged. Check its status, then try again.");
        setInvitationTransitions((current) => {
          const next = { ...current };
          delete next[invitation.id];
          return next;
        });
      } else {
        setInvitationTransitions((current) => ({
          ...current,
          [invitation.id]: action === "replace" ? "replaced" : action === "revoke" ? "revoked" : "extended",
        }));
        if (body.replacement) {
          await new Promise((resolve) => window.setTimeout(resolve, layoutToken.durationMs));
          setCreated([body.replacement]);
        }
        setNotice(
          action === "extend"
            ? `The invitation for ${invitation.recipientName} was extended.`
            : action === "replace"
              ? `A replacement invitation for ${invitation.recipientName} was created.`
              : `The invitation for ${invitation.recipientName} was revoked.`,
        );
      }
      await load();
    } catch {
      setError("The invitation could not be changed. Check its current status, then try again.");
      setInvitationTransitions((current) => {
        const next = { ...current };
        delete next[invitation.id];
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!library && error)
    return (
      <main className="captain-library platform-loading">
        <ErrorState
          title="Captain's Console could not connect"
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      </main>
    );
  if (!library)
    return (
      <main className="captain-library platform-loading">
        <LoadingState
          title="Opening Captain's Console"
          detail="Loading Voyages, Crew invitations, and published Chronicles."
        />
      </main>
    );
  const voyageGroups: Array<[string, Voyage[]]> = [
    ["Needs Attention", library.groups.needsAttention],
    ["Active Voyages", library.groups.activeVoyages],
    ["Ready to Launch", library.groups.readyToLaunch],
    ["Voyage Records", library.groups.completedPlaythroughs],
  ];
  const voyageCount = voyageGroups.reduce((total, [, voyages]) => total + voyages.length, 0);
  return (
    <main className="captain-library" data-motion-mode={mode}>
      <header className="platform-header">
        <div>
          <p className="eyebrow">Live Voyage control</p>
          <h1>{captainCopy.consoleName.value}</h1>
          <p>Begin live Voyages, invite Crew, and keep Chronicle authoring in Voyagewright Studio.</p>
        </div>
        <div>
          <button
            className="brass-button"
            onClick={() => {
              setWizard(true);
              setWizardDirection(1);
              setStep(0);
            }}
          >
            Create a Voyage
          </button>
        </div>
      </header>
      <nav className="platform-tabs" aria-label="Captain&apos;s Console sections">
        <button
          className={tab === "voyages" ? "active" : ""}
          aria-pressed={tab === "voyages"}
          onClick={() => setTab("voyages")}
        >
          {tab === "voyages" && (
            <motion.span className="platform-tab-plate" layoutId="captain-tab-plate" aria-hidden="true" />
          )}
          Voyages
        </button>
        <button
          className={tab === "invitations" ? "active" : ""}
          aria-pressed={tab === "invitations"}
          onClick={() => setTab("invitations")}
        >
          {tab === "invitations" && (
            <motion.span className="platform-tab-plate" layoutId="captain-tab-plate" aria-hidden="true" />
          )}
          Invitations{" "}
          <span>
            {library.invitations.filter((item) => ["CREATED", "COPIED", "VIEWED"].includes(item.status)).length}
          </span>
        </button>
        <button
          className={tab === "published" ? "active" : ""}
          aria-pressed={tab === "published"}
          onClick={() => setTab("published")}
        >
          {tab === "published" && (
            <motion.span className="platform-tab-plate" layoutId="captain-tab-plate" aria-hidden="true" />
          )}
          Published Chronicles
        </button>
      </nav>
      {notice && <StatusBanner tone="success">{notice}</StatusBanner>}
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="captain-tab-panel"
          initial={{ opacity: 0, y: mode === "reduced" ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: layoutToken.durationSeconds, ease: platformMotionEasing("layout") }}
        >
          {tab === "voyages" && (
            <div className="captain-groups">
              {!voyageCount && (
                <EmptyState
                  title="No voyages need your attention"
                  detail="Choose a published Chronicle, add your Crew, and create secure invitations."
                  action={{
                    label: "Create a Voyage",
                    onClick: () => {
                      setWizard(true);
                      setWizardDirection(1);
                      setStep(0);
                    },
                  }}
                />
              )}
              {voyageGroups.map(
                ([label, voyages]) =>
                  voyages.length > 0 && (
                    <section key={label}>
                      <header>
                        <h2>{label}</h2>
                        <span>{voyages.length}</span>
                      </header>
                      <LayoutGroup id="captain-voyages">
                        <div className="captain-card-grid">
                          {voyages.map((voyage) => (
                            <VoyageCard
                              key={voyage.id}
                              voyage={voyage}
                              busy={busy}
                              changed={changedIds.has(voyage.id)}
                              group={label}
                              launchPhase={launchState?.id === voyage.id ? launchState.phase : null}
                              mode={mode}
                              launch={() => void launch(voyage)}
                            />
                          ))}
                        </div>
                      </LayoutGroup>
                    </section>
                  ),
              )}
            </div>
          )}
          {tab === "invitations" && (
            <section className="invitation-dashboard">
              <header>
                <div>
                  <p className="eyebrow">Tracked access records</p>
                  <h2>Crew invitations</h2>
                </div>
              </header>
              {!library.invitations.length ? (
                <EmptyState
                  title="No Crew invitations yet"
                  detail="Invitations appear here after a Captain creates a Voyage for one or more Crew members."
                  action={{
                    label: "Create a Voyage",
                    onClick: () => {
                      setWizard(true);
                      setWizardDirection(1);
                      setStep(0);
                    },
                  }}
                />
              ) : (
                <div className="invitation-table" role="table" aria-label="Crew invitations for Voyages">
                  <AnimatePresence initial={false} mode="popLayout">
                    {library.invitations.map((invitation) => (
                      <motion.article
                        layout
                        key={invitation.id}
                        role="row"
                        data-invitation-transition={
                          invitationTransitions[invitation.id] ?? invitation.status.toLocaleLowerCase()
                        }
                        data-row-changed={changedIds.has(invitation.id)}
                        exit={{ opacity: 0, scale: mode === "reduced" ? 1 : 0.98 }}
                      >
                        <div>
                          <strong>{invitation.recipientName}</strong>
                          <span>
                            {invitation.taleTitle} · {invitation.voyageName}
                          </span>
                        </div>
                        <div>
                          <b className={`status-pill status-${invitation.status.toLocaleLowerCase()}`}>
                            {invitation.status}
                          </b>
                          <small>
                            token {invitation.tokenPrefix}… · code {invitation.shortCodePrefix}…
                          </small>
                        </div>
                        <div>
                          <time>{new Date(invitation.expiresAt).toLocaleString()}</time>
                          <small>
                            {invitation.viewedAt
                              ? `Viewed ${new Date(invitation.viewedAt).toLocaleString()}`
                              : "Not viewed"}
                          </small>
                        </div>
                        <div className="row-actions">
                          {["CREATED", "SENT", "COPIED", "VIEWED"].includes(invitation.status) && (
                            <>
                              <button disabled={busy} onClick={() => void invitationAction(invitation, "extend")}>
                                Extend
                              </button>
                              <button disabled={busy} onClick={() => void invitationAction(invitation, "replace")}>
                                Replace invitation
                              </button>
                              <button
                                className="button-danger"
                                disabled={busy}
                                onClick={() => void invitationAction(invitation, "revoke")}
                              >
                                Revoke invitation
                              </button>
                            </>
                          )}
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          )}
          {tab === "published" && (
            <section className="published-tale-grid">
              {!library.publishedTales.length && (
                <EmptyState
                  title="No published Chronicles are ready"
                  detail="A Creator must validate and publish a version before a Captain can create a Voyage from it."
                  action={{ label: "Open Voyagewright Studio", href: "/studio/library" }}
                />
              )}
              <AnimatePresence initial={false}>
                {library.publishedTales.map((tale) => (
                  <motion.article layout key={tale.id}>
                    <p className="card-kicker">{tale.visibility.toLocaleLowerCase()}</p>
                    <h2>{tale.title}</h2>
                    <p>{tale.subtitle}</p>
                    <ul>
                      {tale.versions.map((version) => (
                        <li key={version.id}>
                          <span>Version {version.label}</span>
                          <small>
                            {version.activeRunCount} active Voyages · {new Date(version.publishedAt).toLocaleDateString()}
                          </small>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        chooseTale(tale.id);
                        setWizard(true);
                        setWizardDirection(1);
                        setStep(1);
                      }}
                    >
                      Invite Crew
                    </button>
                    <Link href={`/captain/tales/${tale.id}`}>Open Chronicle</Link>
                  </motion.article>
                ))}
              </AnimatePresence>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {created.length > 0 && !wizard && (
          <InvitationSecrets invitations={created} csrf={library.csrfToken} mode={mode} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {wizard && (
          <VoyageWizard
            step={step}
            direction={wizardDirection}
            setStep={(nextStep) => {
              setWizardDirection(nextStep >= step ? 1 : -1);
              setStep(nextStep);
            }}
            close={() => setWizard(false)}
            library={library}
            taleId={taleId}
            chooseTale={chooseTale}
            versionId={versionId}
            setVersionId={setVersionId}
            selectedTale={selectedTale}
            selectedVersion={selectedVersion}
            voyageName={voyageName}
            setVoyageName={setVoyageName}
            captainMode={captainMode}
            setCaptainMode={setCaptainMode}
            hints={hints}
            setHints={setHints}
            sideQuests={sideQuests}
            setSideQuests={setSideQuests}
            plannedStartAt={plannedStartAt}
            setPlannedStartAt={setPlannedStartAt}
            scheduleTimezone={scheduleTimezone}
            setScheduleTimezone={setScheduleTimezone}
            players={players}
            setPlayers={setPlayers}
            expiresInHours={expiresInHours}
            setExpiresInHours={setExpiresInHours}
            accountRequired={accountRequired}
            setAccountRequired={setAccountRequired}
            created={created}
            busy={busy}
            mode={mode}
            createVoyage={() => void createVoyage()}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function VoyageCard({
  voyage,
  busy,
  changed,
  group,
  launchPhase,
  mode,
  launch,
}: {
  voyage: Voyage;
  busy: boolean;
  changed: boolean;
  group: string;
  launchPhase: "confirming" | "launching" | "launched" | null;
  mode: ReturnType<typeof useMotionMode>["mode"];
  launch: () => void;
}) {
  const readyPlayers = voyage.players.filter((player) => ["READY", "JOINED", "ACTIVE"].includes(player.status)).length;
  const readiness = voyage.players.length ? Math.round((readyPlayers / voyage.players.length) * 100) : 0;
  return (
    <motion.article
      layout
      layoutId={`captain-voyage-${voyage.id}`}
      className="captain-voyage-card"
      data-voyage-group={group}
      data-card-changed={changed}
      data-launch-state={launchPhase ?? "idle"}
    >
      <div className="session-signal">
        <i className={voyage.connected ? "connected" : "quiet"} />
        <span>{voyage.connected ? "Crew member recently connected" : "No recent Crew connection"}</span>
      </div>
      <p className="card-kicker">Version {voyage.versionLabel}</p>
      <h3>{voyage.taleTitle}</h3>
      <h4>{voyage.voyageName}</h4>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{voyage.status.toLocaleLowerCase()}</dd>
        </div>
        <div>
          <dt>Crew</dt>
          <dd>
            {voyage.players
              .map((player) => `${player.displayName} (${player.status.toLocaleLowerCase()})`)
              .join(", ") || "No Crew members"}
          </dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{new Date(voyage.lastActivityAt).toLocaleTimeString()}</dd>
        </div>
        {voyage.pendingAction && (
          <div>
            <dt>Needs action</dt>
            <dd>{voyage.pendingAction}</dd>
          </div>
        )}
      </dl>
      {group === "Needs Attention" && (
        <p className="needs-attention-mark">
          <span aria-hidden="true">!</span> A Captain action is required before this Voyage can continue.
        </p>
      )}
      {group === "Ready to Launch" && (
        <div className="readiness-gauge" aria-label={`${readiness}% of Crew ready`}>
          <span style={{ "--readiness": `${readiness}%` } as React.CSSProperties} />
          <small>
            {readyPlayers} of {voyage.players.length} Crew members ready
          </small>
        </div>
      )}
      {launchPhase && (
        <div className="launch-ceremony-status" role="status" aria-live="polite">
          <PlatformRelic
            kind="voyage-compass"
            state={launchPhase === "launched" ? "launch-ready" : "bearing"}
            mode={mode}
          />
          <span>
            {launchPhase === "launched"
              ? "The server confirmed this Voyage is available to ready Crew."
              : launchPhase === "launching"
                ? "Recording this Voyage launch with the Captain&apos;s Console."
                : "Waiting for launch confirmation."}
          </span>
        </div>
      )}
      <div className="card-actions">
        <Link className="brass-button" href={`/captain/sessions/${voyage.id}`}>
          Open Captain&apos;s Console
        </Link>
        <Link href={`/captain/voyages/${voyage.id}/player-preview`}>Preview Crew view</Link>
        {["READY", "SCHEDULED"].includes(voyage.status) && (
          <button
            disabled={busy || launchPhase === "launched"}
            aria-busy={launchPhase === "launching"}
            onClick={launch}
          >
            {launchPhase === "launching"
              ? "Beginning..."
              : launchPhase === "launched"
                ? "Voyage begun"
                : captainCopy.beginVoyage.value}
          </button>
        )}
      </div>
    </motion.article>
  );
}

type WizardProps = Record<string, unknown> & {
  step: number;
  direction: 1 | -1;
  setStep: (step: number) => void;
  close: () => void;
  library: Library;
  taleId: string;
  chooseTale: (id: string) => void;
  versionId: string;
  setVersionId: (id: string) => void;
  selectedTale?: Tale;
  selectedVersion?: Tale["versions"][number];
  voyageName: string;
  setVoyageName: (value: string) => void;
  captainMode: string;
  setCaptainMode: (value: string) => void;
  hints: string;
  setHints: (value: string) => void;
  sideQuests: boolean;
  setSideQuests: (value: boolean) => void;
  plannedStartAt: string;
  setPlannedStartAt: (value: string) => void;
  scheduleTimezone: string;
  setScheduleTimezone: (value: string) => void;
  players: CrewDraft[];
  setPlayers: React.Dispatch<React.SetStateAction<CrewDraft[]>>;
  expiresInHours: number;
  setExpiresInHours: (value: number) => void;
  accountRequired: boolean;
  setAccountRequired: (value: boolean) => void;
  created: CreatedInvitation[];
  busy: boolean;
  mode: ReturnType<typeof useMotionMode>["mode"];
  createVoyage: () => void;
};
function VoyageWizard(props: WizardProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(props.close);
  const token = resolvePlatformMotionToken("layout", props.mode);
  const direction = props.direction;
  const crewNames = props.players.map(
    (crew) =>
      props.library.playerProfiles.find((profile) => profile.id === crew.playerId)?.displayName ??
      crew.displayName.trim(),
  );
  const claimedAccountsValid = props.players.every((crew) => {
    const profile = props.library.playerProfiles.find((item) => item.id === crew.playerId);
    return !props.accountRequired || Boolean(profile?.username);
  });
  const crewValid = props.players.length > 0 && crewNames.every(Boolean);
  const canNext = [
    Boolean(props.taleId && props.versionId),
    props.voyageName.length >= 3,
    crewValid,
    claimedAccountsValid,
    claimedAccountsValid,
    claimedAccountsValid,
    true,
  ][props.step];
  const updateCrew = (key: string, update: Partial<CrewDraft>) =>
    props.setPlayers((current) => current.map((crew) => (crew.key === key ? { ...crew, ...update } : crew)));
  const removeCrew = (key: string) => {
    props.setPlayers((current) => current.filter((item) => item.key !== key));
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("[data-add-player]")?.focus(), 0);
  };

  useEffect(() => {
    closeRef.current = props.close;
  }, [props.close]);

  useEffect(() => {
    const timer = window.setTimeout(() => document.getElementById("wizard-title")?.focus(), token.durationMs + 20);
    return () => window.clearTimeout(timer);
  }, [props.step, token.durationMs]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", keydown);
    return () => {
      dialog?.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);

  return (
    <motion.div
      className="wizard-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        ref={dialogRef}
        className="voyage-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        initial={{ opacity: 0, scale: props.mode === "reduced" ? 1 : 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: props.mode === "reduced" ? 1 : 0.99 }}
      >
        <header>
          <div>
            <p className="eyebrow">Step {props.step + 1} of 7</p>
            <h2 id="wizard-title" tabIndex={-1}>
              {steps[props.step]}
            </h2>
          </div>
          <button aria-label="Close Voyage wizard" onClick={props.close}>
            ×
          </button>
        </header>
        <ol className="wizard-progress" aria-label="Voyage creation progress">
          <motion.span
            className="wizard-progress-path"
            aria-hidden="true"
            animate={{ scaleX: props.step / (steps.length - 1) }}
            transition={{ duration: token.durationSeconds }}
          />
          {steps.map((label, index) => (
            <li
              className={index === props.step ? "current" : index < props.step ? "completed" : ""}
              aria-current={index === props.step ? "step" : undefined}
              key={label}
            >
              <span>{index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
        <div className="wizard-body">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              className="wizard-step-panel"
              key={props.step}
              custom={direction}
              initial={{ opacity: 0, x: props.mode === "reduced" ? 0 : direction * 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: props.mode === "reduced" ? 0 : direction * -12 }}
              transition={{ duration: token.durationSeconds, ease: platformMotionEasing("layout") }}
            >
              {props.step === 0 && (
                <div className="wizard-choice-grid">
                  {props.library.publishedTales.map((tale) => (
                    <button
                      className={props.taleId === tale.id ? "selected" : ""}
                      aria-pressed={props.taleId === tale.id}
                      onClick={() => props.chooseTale(tale.id)}
                      key={tale.id}
                    >
                      <strong>{tale.title}</strong>
                      <span>
                        {tale.versions.length} published {tale.versions.length === 1 ? "version" : "versions"}
                      </span>
                    </button>
                  ))}
                  {props.selectedTale && (
                    <label>
                      <span>Published version</span>
                      <select value={props.versionId} onChange={(event) => props.setVersionId(event.target.value)}>
                        {props.selectedTale.versions.map((version) => (
                          <option key={version.id} value={version.id}>
                            Version {version.label} · {new Date(version.publishedAt).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {props.step === 1 && (
                <div className="wizard-form">
                  <label>
                    <span>Voyage name</span>
                    <input value={props.voyageName} onChange={(event) => props.setVoyageName(event.target.value)} />
                  </label>
                  <label>
                    <span>Progression mode</span>
                    <select value={props.captainMode} onChange={(event) => props.setCaptainMode(event.target.value)}>
                      <option value="CAPTAIN_CONTROLLED">Captain-controlled</option>
                      <option value="RULE_CONTROLLED">Rule-controlled</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </label>
                  <label>
                    <span>Hints</span>
                    <select value={props.hints} onChange={(event) => props.setHints(event.target.value)}>
                      <option value="DISABLED">Disabled</option>
                      <option value="ON_REQUEST">On request</option>
                      <option value="CAPTAIN_PUSHED">Captain-pushed</option>
                      <option value="TIMED">Timed</option>
                      <option value="TALE_DEFINED">Chronicle-defined</option>
                    </select>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={props.sideQuests}
                      onChange={(event) => props.setSideQuests(event.target.checked)}
                    />{" "}
                    Enable published Echoes
                  </label>
                  <label>
                    <span>Planned start (optional)</span>
                    <input
                      type="datetime-local"
                      value={props.plannedStartAt}
                      onChange={(event) => props.setPlannedStartAt(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Schedule timezone</span>
                    <input
                      value={props.scheduleTimezone}
                      onChange={(event) => props.setScheduleTimezone(event.target.value)}
                    />
                  </label>
                </div>
              )}
              {props.step === 2 && (
                <div className="wizard-form crew-builder">
                  <AnimatePresence initial={false}>
                    {props.players.map((crew, index) => (
                      <motion.fieldset
                        layout
                        key={crew.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <legend>Crew member {index + 1}</legend>
                        <label>
                          <span>Use existing Crew member (optional)</span>
                          <select
                            value={crew.playerId}
                            onChange={(event) => updateCrew(crew.key, { playerId: event.target.value })}
                          >
                            <option value="">Create guest Crew profile</option>
                            {props.library.playerProfiles.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName}
                                {player.username ? ` (${player.username})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!crew.playerId && (
                          <label>
                            <span>Crew member name</span>
                            <input
                              value={crew.displayName}
                              onChange={(event) => updateCrew(crew.key, { displayName: event.target.value })}
                            />
                          </label>
                        )}
                        <label>
                          <span>Crew role</span>
                          <input
                            value={crew.crewRole}
                            onChange={(event) => updateCrew(crew.key, { crewRole: event.target.value })}
                          />
                        </label>
                        {props.players.length > 1 && (
                          <button type="button" onClick={() => removeCrew(crew.key)}>
                            Remove Crew member
                          </button>
                        )}
                      </motion.fieldset>
                    ))}
                  </AnimatePresence>
                  <button
                    data-add-player
                    type="button"
                    onClick={() =>
                      props.setPlayers((current) => [
                        ...current,
                        { key: crypto.randomUUID(), playerId: "", displayName: "", crewRole: "Crew member", pin: "" },
                      ])
                    }
                  >
                    Add another Crew member
                  </button>
                  <p className="panel-note">
                    Each Crew member receives an individual invitation and identity boundary.
                  </p>
                </div>
              )}
              {props.step === 3 && (
                <div className="wizard-form">
                  <label>
                    <span>Invitation lifetime</span>
                    <select
                      value={props.expiresInHours}
                      onChange={(event) => props.setExpiresInHours(Number(event.target.value))}
                    >
                      <option value={24}>24 hours</option>
                      <option value={168}>7 days</option>
                      <option value={720}>30 days</option>
                    </select>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={props.accountRequired}
                      onChange={(event) => props.setAccountRequired(event.target.checked)}
                    />{" "}
                    Require registered Crew accounts
                  </label>
                  {props.players.map((crew, index) => (
                    <label key={crew.key}>
                      <span>Optional PIN for {crewNames[index] || `Crew member ${index + 1}`}</span>
                      <input
                        type="password"
                        minLength={4}
                        value={crew.pin}
                        onChange={(event) => updateCrew(crew.key, { pin: event.target.value })}
                      />
                    </label>
                  ))}
                  {!claimedAccountsValid && (
                    <p className="platform-error" role="alert">
                      Every invitation that requires an account must select a registered Crew account.
                    </p>
                  )}
                  <p>No raw token, short code, or PIN will be stored. Replacements generate new secrets.</p>
                </div>
              )}
              {props.step === 4 && (
                <div className="delivery-options">
                  <article>
                    <strong>Secure link</strong>
                    <span>Opaque, high-entropy, single-recipient URL</span>
                  </article>
                  <article>
                    <strong>QR card</strong>
                    <span>Encodes the same secure link with a readable code fallback</span>
                  </article>
                  <article>
                    <strong>Short code</strong>
                    <span>Human-friendly, rate-limited gateway lookup</span>
                  </article>
                  <article>
                    <strong>Copyable message</strong>
                    <span>Crew-safe invitation copy without hidden Chronicle details</span>
                  </article>
                </div>
              )}
              {props.step === 5 && (
                <div className="review-sheet">
                  <p className="eyebrow">Crew preview</p>
                  <h3>{props.selectedTale?.title}</h3>
                  <h4>{props.voyageName}</h4>
                  <dl>
                    <div>
                      <dt>Chronicle</dt>
                      <dd>{props.selectedTale?.title}</dd>
                    </div>
                    <div>
                      <dt>Voyage name</dt>
                      <dd>{props.voyageName}</dd>
                    </div>
                    <div>
                      <dt>Edition lock</dt>
                      <dd>{props.selectedVersion?.label}</dd>
                    </div>
                    <div>
                      <dt>Crew</dt>
                      <dd>{crewNames.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Progression</dt>
                      <dd>{props.captainMode.replaceAll("_", " ").toLocaleLowerCase()}</dd>
                    </div>
                    <div>
                      <dt>Hints</dt>
                      <dd>{props.hints.replaceAll("_", " ").toLocaleLowerCase()}</dd>
                    </div>
                    <div>
                      <dt>Echoes</dt>
                      <dd>{props.sideQuests ? "Enabled" : "Disabled"}</dd>
                    </div>
                    {props.plannedStartAt && (
                      <div>
                        <dt>Planned start</dt>
                        <dd>
                          {new Date(props.plannedStartAt).toLocaleString()} · {props.scheduleTimezone}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Invitation expires</dt>
                      <dd>{props.expiresInHours} hours after creation</dd>
                    </div>
                    <div>
                      <dt>Account requirement</dt>
                      <dd>{props.accountRequired ? "Registered Crew accounts required" : "Guest Crew allowed"}</dd>
                    </div>
                  </dl>
                  <p className="panel-note">
                    Creation is atomic. The Voyage remains bound to this published version, even after newer versions
                    are published.
                  </p>
                </div>
              )}
              {props.step === 6 &&
                (props.created.length ? (
                  <InvitationSecrets invitations={props.created} csrf={props.library.csrfToken} mode={props.mode} />
                ) : (
                  <div className="platform-empty">
                    <h3>Ready to create</h3>
                    <p>
                      The Voyage and invitations will be created together. If creation fails, no Voyage is created.
                    </p>
                  </div>
                ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <footer>
          {props.step > 0 && props.step < 6 && (
            <button onClick={() => props.setStep(props.step - 1)}>Back to {steps[props.step - 1]}</button>
          )}
          {props.step < 5 && (
            <button className="brass-button" disabled={!canNext} onClick={() => props.setStep(props.step + 1)}>
              Continue to {steps[props.step + 1]}
            </button>
          )}
          {props.step === 5 && (
            <button className="brass-button" disabled={props.busy || !canNext} onClick={props.createVoyage}>
              {props.busy ? "Creating..." : "Create Voyage and invitations"}
            </button>
          )}
          {props.step === 6 && props.created.length > 0 && (
            <button className="brass-button" onClick={props.close}>
              Done
            </button>
          )}
        </footer>
      </motion.section>
    </motion.div>
  );
}

function InvitationSecrets({
  invitations,
  csrf,
  mode,
}: {
  invitations: CreatedInvitation[];
  csrf: string;
  mode: ReturnType<typeof useMotionMode>["mode"];
}) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const token = resolvePlatformMotionToken("state", mode);
  async function copy(invitation: CreatedInvitation, value: string) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      const response = await fetch(`/api/captain/invitations/${invitation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action: "copied" }),
      });
      if (!response.ok) throw new Error("copy-audit-failed");
      setCopied(invitation.id);
    } catch {
      setCopyError("The invitation could not be copied. Select the visible details and copy them manually.");
    }
  }
  return (
    <motion.div className="invitation-secrets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {copied && <StatusBanner tone="success">Invitation details copied to the clipboard.</StatusBanner>}
      {copyError && <StatusBanner tone="danger">{copyError}</StatusBanner>}
      {invitations.map((invitation, index) => (
        <motion.article
          key={invitation.id}
          initial={{ opacity: 0, y: mode === "reduced" ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: token.durationSeconds, delay: mode === "reduced" ? 0 : Math.min(index * 0.06, 0.18) }}
        >
          <motion.img
            src={invitation.qrCodeDataUrl}
            alt={`QR code for ${invitation.recipientName}. Short code ${invitation.shortCode}.`}
            initial={{ clipPath: mode === "reduced" ? "inset(0)" : "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: token.durationSeconds, ease: platformMotionEasing("state") }}
          />
          <div>
            <p className="eyebrow">Shown once after creation</p>
            <h3>{invitation.recipientName}</h3>
            <code>{invitation.shortCode}</code>
            <p>{invitation.message}</p>
            <div>
              <button onClick={() => void copy(invitation, invitation.link)}>
                {copied === invitation.id ? "Secure link copied" : "Copy secure link"}
              </button>
              <button onClick={() => void copy(invitation, invitation.message)}>Copy message</button>
            </div>
            <small>Expires {new Date(invitation.expiresAt).toLocaleString()}</small>
          </div>
        </motion.article>
      ))}
    </motion.div>
  );
}
