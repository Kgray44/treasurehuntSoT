"use client";

/* eslint-disable @next/next/no-img-element -- QR data URLs are generated server-side and shown only after invitation creation. */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/ui/AsyncState";

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

const steps = ["Select Tale", "Configure Voyage", "Add Players", "Security", "Delivery", "Review", "Create"];

export function CaptainLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"voyages" | "invitations" | "published">("voyages");
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [taleId, setTaleId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [voyageName, setVoyageName] = useState("");
  const [captainMode, setCaptainMode] = useState("CAPTAIN_CONTROLLED");
  const [hints, setHints] = useState("ON_REQUEST");
  const [sideQuests, setSideQuests] = useState(true);
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [players, setPlayers] = useState<CrewDraft[]>([
    { key: "crew-1", playerId: "", displayName: "", crewRole: "Player", pin: "" },
  ]);
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [accountRequired, setAccountRequired] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/captain/library", { cache: "no-store" });
      const body = (await response.json()) as Library & { error?: string };
      if (!response.ok) setError(body.error ?? "Captain's library is unavailable.");
      else {
        setLibrary(body);
        setError("");
      }
    } catch {
      setError("Captain's Command could not be reached. Check your connection and try again.");
    }
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "invitations")
      queueMicrotask(() => setTab("invitations"));
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
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
      if (!response.ok) return setError(body.error ?? "Voyage creation failed.");
      setCreated(body.invitations ?? []);
      setNotice("The voyage and its individual invitations were created together.");
      setStep(6);
      await load();
    } catch {
      setError("The voyage could not be created. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function launch(voyage: Voyage) {
    if (!library || !window.confirm(`Launch “${voyage.voyageName}” for its ready Players?`)) return;
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
      if (!response.ok) setError(body.error ?? "The voyage could not be launched.");
      else setNotice(`“${voyage.voyageName}” is now live for ready Players.`);
      await load();
    } catch {
      setError("The voyage could not be launched. Check your connection and try again.");
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
          ? `Revoke the invitation for ${invitation.recipientName}? The current link and short code will stop working.`
          : `Replace the invitation for ${invitation.recipientName}? The current link and short code will be revoked and new credentials created.`,
      )
    )
      return;
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
      if (!response.ok) setError(body.error ?? "Invitation action failed.");
      else {
        if (body.replacement) setCreated([body.replacement]);
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
      setError("The invitation action could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!library && error)
    return (
      <main className="captain-library platform-loading">
        <ErrorState
          title="Captain's Command could not be opened"
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      </main>
    );
  if (!library)
    return (
      <main className="captain-library platform-loading">
        <LoadingState
          title="Opening Captain's Command"
          detail="Loading voyages, invitations, and published editions."
        />
      </main>
    );
  const voyageGroups: Array<[string, Voyage[]]> = [
    ["Needs Attention", library.groups.needsAttention],
    ["Active Voyages", library.groups.activeVoyages],
    ["Ready to Launch", library.groups.readyToLaunch],
    ["Completed Playthroughs", library.groups.completedPlaythroughs],
  ];
  const voyageCount = voyageGroups.reduce((total, [, voyages]) => total + voyages.length, 0);
  return (
    <main className="captain-library">
      <header className="platform-header">
        <div>
          <p className="eyebrow">Operational command</p>
          <h1>Captain&apos;s Tall Tale Library</h1>
          <p>Run live voyages, invite Players, and keep authoring controls safely in Studio.</p>
        </div>
        <div>
          <button
            className="brass-button"
            onClick={() => {
              setWizard(true);
              setStep(0);
            }}
          >
            Create a Voyage
          </button>
        </div>
      </header>
      <nav className="platform-tabs" aria-label="Captain library sections">
        <button
          className={tab === "voyages" ? "active" : ""}
          aria-pressed={tab === "voyages"}
          onClick={() => setTab("voyages")}
        >
          Voyages
        </button>
        <button
          className={tab === "invitations" ? "active" : ""}
          aria-pressed={tab === "invitations"}
          onClick={() => setTab("invitations")}
        >
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
          Published Tales
        </button>
      </nav>
      {notice && <StatusBanner tone="success">{notice}</StatusBanner>}
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      {tab === "voyages" && (
        <div className="captain-groups">
          {!voyageCount && (
            <EmptyState
              title="No voyages need your attention"
              detail="Choose a published Tall Tale, configure the participants, and create secure invitations."
              action={{
                label: "Create a Voyage",
                onClick: () => {
                  setWizard(true);
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
                  <div className="captain-card-grid">
                    {voyages.map((voyage) => (
                      <VoyageCard
                        key={`${label}-${voyage.id}`}
                        voyage={voyage}
                        busy={busy}
                        launch={() => void launch(voyage)}
                      />
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
      {tab === "invitations" && (
        <section className="invitation-dashboard">
          <header>
            <div>
              <p className="eyebrow">Tracked security objects</p>
              <h2>Invitation management</h2>
            </div>
          </header>
          {!library.invitations.length ? (
            <EmptyState
              title="No invitations have been created"
              detail="Invitations appear here after a Captain creates a voyage for one or more Players."
              action={{
                label: "Create a Voyage",
                onClick: () => {
                  setWizard(true);
                  setStep(0);
                },
              }}
            />
          ) : (
            <div className="invitation-table" role="table" aria-label="Voyage invitations">
              {library.invitations.map((invitation) => (
                <article key={invitation.id} role="row">
                  <div>
                    <strong>{invitation.recipientName}</strong>
                    <span>
                      {invitation.taleTitle} · {invitation.voyageName}
                    </span>
                  </div>
                  <div>
                    <b className={`status-pill status-${invitation.status.toLocaleLowerCase()}`}>{invitation.status}</b>
                    <small>
                      token {invitation.tokenPrefix}… · code {invitation.shortCodePrefix}…
                    </small>
                  </div>
                  <div>
                    <time>{new Date(invitation.expiresAt).toLocaleString()}</time>
                    <small>
                      {invitation.viewedAt ? `Viewed ${new Date(invitation.viewedAt).toLocaleString()}` : "Not viewed"}
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
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "published" && (
        <section className="published-tale-grid">
          {!library.publishedTales.length && (
            <EmptyState
              title="No published Tall Tales are ready"
              detail="A Creator must validate and publish an edition before a Captain can create a voyage from it."
              action={{ label: "Open Tall Tale Studio", href: "/studio/library" }}
            />
          )}
          {library.publishedTales.map((tale) => (
            <article key={tale.id}>
              <p className="card-kicker">{tale.visibility.toLocaleLowerCase()}</p>
              <h2>{tale.title}</h2>
              <p>{tale.subtitle}</p>
              <ul>
                {tale.versions.map((version) => (
                  <li key={version.id}>
                    <span>Version {version.label}</span>
                    <small>
                      {version.activeRunCount} runs · {new Date(version.publishedAt).toLocaleDateString()}
                    </small>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  chooseTale(tale.id);
                  setWizard(true);
                  setStep(1);
                }}
              >
                Invite Players
              </button>
              <Link href={`/captain/tales/${tale.id}`}>Open details</Link>
            </article>
          ))}
        </section>
      )}
      {created.length > 0 && !wizard && <InvitationSecrets invitations={created} csrf={library.csrfToken} />}
      {wizard && (
        <VoyageWizard
          step={step}
          setStep={setStep}
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
          createVoyage={() => void createVoyage()}
        />
      )}
    </main>
  );
}

function VoyageCard({ voyage, busy, launch }: { voyage: Voyage; busy: boolean; launch: () => void }) {
  return (
    <article className="captain-voyage-card">
      <div className="session-signal">
        <i className={voyage.connected ? "connected" : "quiet"} />
        <span>{voyage.connected ? "Player recently connected" : "No recent heartbeat"}</span>
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
          <dt>Players</dt>
          <dd>
            {voyage.players
              .map((player) => `${player.displayName} (${player.status.toLocaleLowerCase()})`)
              .join(", ") || "No Players"}
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
      <div className="card-actions">
        <Link className="brass-button" href={`/captain/sessions/${voyage.id}`}>
          Open Captain console
        </Link>
        <Link href={`/captain/voyages/${voyage.id}/player-preview`}>Preview as Player</Link>
        {["READY", "SCHEDULED"].includes(voyage.status) && (
          <button disabled={busy} onClick={launch}>
            Launch voyage
          </button>
        )}
      </div>
    </article>
  );
}

type WizardProps = Record<string, unknown> & {
  step: number;
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
  createVoyage: () => void;
};
function VoyageWizard(props: WizardProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(props.close);
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

  useEffect(() => {
    closeRef.current = props.close;
  }, [props.close]);

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
    <div className="wizard-backdrop" role="presentation">
      <section ref={dialogRef} className="voyage-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header>
          <div>
            <p className="eyebrow">Step {props.step + 1} of 7</p>
            <h2 id="wizard-title">{steps[props.step]}</h2>
          </div>
          <button aria-label="Close invitation wizard" onClick={props.close}>
            ×
          </button>
        </header>
        <ol className="wizard-progress" aria-label="Voyage creation progress">
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
                    {tale.versions.length} published {tale.versions.length === 1 ? "edition" : "editions"}
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
                  <option value="TALE_DEFINED">Tale-defined</option>
                </select>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={props.sideQuests}
                  onChange={(event) => props.setSideQuests(event.target.checked)}
                />{" "}
                Enable published side quests
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
              {props.players.map((crew, index) => (
                <fieldset key={crew.key}>
                  <legend>Player {index + 1}</legend>
                  <label>
                    <span>Use existing Player (optional)</span>
                    <select
                      value={crew.playerId}
                      onChange={(event) => updateCrew(crew.key, { playerId: event.target.value })}
                    >
                      <option value="">Create guest profile</option>
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
                      <span>Player display name</span>
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
                    <button
                      type="button"
                      onClick={() => props.setPlayers((current) => current.filter((item) => item.key !== crew.key))}
                    >
                      Remove Player
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() =>
                  props.setPlayers((current) => [
                    ...current,
                    { key: crypto.randomUUID(), playerId: "", displayName: "", crewRole: "Player", pin: "" },
                  ])
                }
              >
                Add another Player
              </button>
              <p className="panel-note">Each crew member receives an individual invitation and identity boundary.</p>
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
                Require claimed Player accounts
              </label>
              {props.players.map((crew, index) => (
                <label key={crew.key}>
                  <span>Optional PIN for {crewNames[index] || `Player ${index + 1}`}</span>
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
                  Every account-required invitation must select an existing claimed Player account.
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
                <span>Player-safe invitation copy without hidden Tale details</span>
              </article>
            </div>
          )}
          {props.step === 5 && (
            <div className="review-sheet">
              <p className="eyebrow">Player-safe preview</p>
              <h3>{props.selectedTale?.title}</h3>
              <h4>{props.voyageName}</h4>
              <dl>
                <div>
                  <dt>Tall Tale</dt>
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
                  <dt>Side quests</dt>
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
                  <dd>{props.accountRequired ? "Claimed Player accounts required" : "Guest Players allowed"}</dd>
                </div>
              </dl>
              <p className="panel-note">
                Creation is atomic. The voyage remains bound to this immutable edition, including after newer editions
                are published.
              </p>
            </div>
          )}
          {props.step === 6 &&
            (props.created.length ? (
              <InvitationSecrets invitations={props.created} csrf={props.library.csrfToken} />
            ) : (
              <div className="platform-empty">
                <h3>Ready to create</h3>
                <p>
                  The playthrough and invitation will be written together. No orphaned voyage is left if creation fails.
                </p>
              </div>
            ))}
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
              {props.busy ? "Creating…" : "Create voyage and invitation"}
            </button>
          )}
          {props.step === 6 && props.created.length > 0 && (
            <button className="brass-button" onClick={props.close}>
              Done
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function InvitationSecrets({ invitations, csrf }: { invitations: CreatedInvitation[]; csrf: string }) {
  const [copied, setCopied] = useState("");
  async function copy(invitation: CreatedInvitation, value: string) {
    await navigator.clipboard.writeText(value);
    await fetch(`/api/captain/invitations/${invitation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "copied" }),
    });
    setCopied(invitation.id);
  }
  return (
    <div className="invitation-secrets">
      {copied && <StatusBanner tone="success">Invitation details copied to the clipboard.</StatusBanner>}
      {invitations.map((invitation) => (
        <article key={invitation.id}>
          <img
            src={invitation.qrCodeDataUrl}
            alt={`QR code for ${invitation.recipientName}. Short code ${invitation.shortCode}.`}
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
        </article>
      ))}
    </div>
  );
}
