"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminCommand } from "@/domain/admin";

type Status = {
  csrfToken: string;
  permissions: string[];
  campaign: { slug: string; title: string; status: string; sequence: number; startedAt: string; updatedAt: string };
  chapter: { ordinal: number; state: string; title: string };
  chapters: Array<{
    id: string;
    ordinal: number;
    state: string;
    title: string;
    objective: string;
    revealedAt: string | null;
    solvedAt: string | null;
    hints: Array<{ id: string; ordinal: number; body: string; releasedAt: string | null }>;
  }>;
  presence: {
    state: string;
    activeDevices: number;
    lastSeenAt: string | null;
    acknowledgedSequence: number;
    synchronized: boolean;
    lag: number;
    route: string | null;
  };
  events: Array<{
    id: string;
    type: string;
    sequence: number;
    actor: string;
    payload: Record<string, unknown>;
    createdAt: string;
    reversesEventId: string | null;
  }>;
  artifacts: Array<{ id: string; key: string; name: string; description: string; awarded: boolean }>;
  mapLocations: Array<{
    id: string;
    key: string;
    name: string;
    regionLabel: string;
    x: number;
    y: number;
    revealedAt: string | null;
  }>;
  sideQuests: Array<{
    id: string;
    key: string;
    title: string;
    state: string;
    objectives: Array<{ id: string; body: string; complete: boolean }>;
  }>;
  stagedActions: Array<{
    id: string;
    command: string;
    targetKey: string | null;
    status: string;
    expectedSequence: number;
    scheduledFor: string | null;
    preparedAt: string;
  }>;
  journalEntries: Array<{ id: string; title: string; body: string; releasedAt: string | null; createdAt: string }>;
  recovery: Array<{ id: string; sequence: number; reason: string; createdAt: string; reversible: boolean }>;
  audit: Array<{
    id: string;
    action: string;
    actor: string;
    outcome: string;
    reason: string | null;
    correlationId: string | null;
    createdAt: string;
  }>;
  playerSnapshot: {
    campaign: { slug: string; title: string; status: string };
    sequence: number;
    chapter: {
      ordinal: number;
      state: string;
      title?: string;
      narrative?: string;
      objective?: string;
      riddle?: string;
    };
    artifacts: Array<{ key: string; name: string; description: string }>;
    mapLocations: Array<{ key: string; name: string; regionLabel: string; x: number; y: number }>;
    sideQuest: { title: string; state: string } | null;
  };
  diagnostics: {
    database: string;
    liveTransport: string;
    latestCampaignSequence: number;
    latestAcknowledgedSequence: number;
    lag: number;
    stalePreparedActions: number;
  };
};

type Preview = {
  watermark: string;
  projectedSequence: number;
  eventType: string;
  affectedSystems: string[];
  undoAvailable: boolean;
  prerequisites: string[];
  canExecute: boolean;
  snapshot: Status["playerSnapshot"];
};

type Action = {
  command: AdminCommand;
  label: string;
  consequence: string;
  targetKey?: string;
  payload?: Record<string, unknown>;
  risk?: "LOW" | "MEDIUM" | "HIGH";
};
const workspaces = [
  ["deck", "Command Deck", "⌂"],
  ["chapters", "Chapters", "I"],
  ["hints", "Hints", "?"],
  ["voyage", "Voyage", "⌁"],
  ["artifacts", "Artifacts", "◇"],
  ["quests", "Side Quests", "✦"],
  ["journal", "Journal", "✎"],
  ["events", "Event Staging", "≋"],
  ["player-view", "Player View", "◫"],
  ["recovery", "Recovery", "↶"],
  ["audit", "Audit", "☷"],
  ["diagnostics", "Diagnostics", "⚙"],
] as const;

const quickActions: Action[] = [
  {
    command: "PREPARE_CHAPTER",
    label: "Prepare Chapter",
    consequence: "Move the next legal chapter to READY without exposing its contents.",
    risk: "MEDIUM",
  },
  {
    command: "RELEASE_CHAPTER",
    label: "Release Chapter",
    consequence: "Publish the prepared chapter and begin the player reveal ceremony.",
  },
  {
    command: "RELEASE_NEXT_HINT",
    label: "Release Next Hint",
    consequence: "Release only the earliest eligible unreleased hint.",
  },
  { command: "MARK_SOLVED", label: "Mark Chapter Solved", consequence: "Record the active objective as solved." },
  {
    command: "PAUSE",
    label: "Pause Campaign",
    consequence: "Block new progression while preserving released player content.",
  },
  {
    command: "UNDO_LAST",
    label: "Undo Last Progression Action",
    consequence: "Create a reversal and reconcile the player to the previous save state.",
  },
  {
    command: "AWARD_ARTIFACT",
    label: "Award Test Artifact",
    consequence: "Award the configured development artifact through the validated command pipeline.",
  },
  {
    command: "REVEAL_MAP",
    label: "Reveal Test Map Location",
    consequence: "Reveal the configured development chart location.",
  },
];

function formatAge(value: string | null) {
  if (!value) return "No evidence";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}
function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function Quartermaster({
  authenticated,
  initialWorkspace = "deck",
}: {
  authenticated: boolean;
  initialWorkspace?: string;
}) {
  const [signedIn, setSignedIn] = useState(authenticated);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<Action | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const workspace = workspaces.some(([key]) => key === initialWorkspace) ? initialWorkspace : "deck";

  const refresh = useCallback(async () => {
    const response = await fetch("/api/gm/status", { cache: "no-store" });
    if (response.ok) {
      setStatus(await response.json());
      setSignedIn(true);
    } else if (response.status === 401) setSignedIn(false);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [signedIn, refresh, workspace]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
      if (event.key === "Escape") {
        setSelected(null);
        setPreview(null);
        setPalette(false);
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "p" && !selected) {
        const action =
          status?.campaign.status === "PAUSED"
            ? {
                command: "RESUME" as const,
                label: "Resume Campaign",
                consequence: "Resume progression after revalidating staged actions.",
              }
            : quickActions[4];
        void choose(action);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  useEffect(() => {
    if (selected && dialog.current) dialog.current.focus();
  }, [selected, preview]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/gm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else {
      setSignedIn(true);
      await refresh();
    }
  }
  async function choose(action: Action) {
    if (!status) return;
    setSelected(action);
    setPreview(null);
    setError("");
    setBusy(true);
    const response = await fetch("/api/gm/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: action.command,
        campaignSlug: status.campaign.slug,
        expectedSequence: status.campaign.sequence,
        targetKey: action.targetKey,
        payload: action.payload ?? {},
        preview: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else setPreview(data);
    setBusy(false);
  }
  async function execute() {
    if (!selected || !status || !preview?.canExecute) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/gm/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
      body: JSON.stringify({
        command: selected.command,
        campaignSlug: status.campaign.slug,
        expectedSequence: status.campaign.sequence,
        idempotencyKey: crypto.randomUUID(),
        targetKey: selected.targetKey,
        payload: selected.payload ?? {},
        confirmation: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else {
      setMessage(
        `${title(data.event.type)} recorded at sequence ${data.event.sequence}. Delivery is tracked separately.`,
      );
      setSelected(null);
      setPreview(null);
      await refresh();
    }
    setBusy(false);
  }
  async function stage(action: Action) {
    if (!status) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/gm/staging", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
      body: JSON.stringify({
        command: action.command,
        campaignSlug: status.campaign.slug,
        expectedSequence: status.campaign.sequence,
        targetKey: action.targetKey,
        payload: action.payload ?? {},
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else {
      setMessage(`${action.label} persisted in staging. Nothing was released.`);
      setSelected(null);
      setPreview(null);
      await refresh();
    }
    setBusy(false);
  }

  const commandMatches = useMemo(
    () => quickActions.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  if (!signedIn) return <Login error={error} onSubmit={login} />;
  if (!status) return <main className="command-center-loading">Opening the command ledger…</main>;

  return (
    <main className="command-center">
      <a className="skip-link" href="#command-workspace">
        Skip to workspace
      </a>
      <aside className="command-rail" aria-label="Command Center workspaces">
        <div className="rail-brand">
          <span>FT</span>
          <div>
            <b>Forever Treasure</b>
            <small>Game Master</small>
          </div>
        </div>
        <nav>
          {workspaces.map(([key, label, icon]) => (
            <Link
              key={key}
              href={key === "deck" ? "/quartermaster" : `/quartermaster/${key}`}
              aria-current={workspace === key ? "page" : undefined}
            >
              <i aria-hidden="true">{icon}</i>
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/studio">
            <i aria-hidden="true">S</i>
            <span>Tall Tale Studio</span>
          </Link>
          <Link href="/captain">
            <i aria-hidden="true">C</i>
            <span>Captain Sessions</span>
          </Link>
        </nav>
        <button className="palette-trigger" onClick={() => setPalette(true)}>
          <span>Command palette</span>
          <kbd>Ctrl K</kbd>
        </button>
      </aside>
      <section className="command-main">
        <h2 className="sr-only">Quartermaster&apos;s Log</h2>
        <header className="command-topbar">
          <div>
            <p className="eyebrow">{workspaces.find(([key]) => key === workspace)?.[1]}</p>
            <h1>{status.campaign.title}</h1>
          </div>
          <div className="truth-strip" aria-label="Live campaign status">
            <Truth
              label="Campaign"
              value={status.campaign.status}
              tone={status.campaign.status === "PAUSED" ? "warning" : "live"}
            />
            <Truth
              label="Player"
              value={status.presence.state}
              tone={status.presence.state === "CONNECTED" ? "live" : "warning"}
            />
            <Truth
              label="Sync"
              value={status.presence.synchronized ? "CURRENT" : `BEHIND ${status.presence.lag}`}
              tone={status.presence.synchronized ? "live" : "warning"}
            />
            <Truth label="Sequence" value={String(status.campaign.sequence)} />
          </div>
        </header>
        <div id="command-workspace" className="command-workspace" tabIndex={-1}>
          <Workspace name={workspace} status={status} choose={choose} stage={stage} refresh={refresh} />
        </div>
      </section>
      <nav className="emergency-dock" aria-label="Emergency controls">
        <button
          onClick={() =>
            void choose(
              status.campaign.status === "PAUSED"
                ? { command: "RESUME", label: "Resume Campaign", consequence: "Resume after reviewing queued actions." }
                : quickActions[4],
            )
          }
        >
          {status.campaign.status === "PAUSED" ? "Resume" : "Pause"}
        </button>
        <Link href="/quartermaster/player-view">Player View</Link>
        <button onClick={() => void choose(quickActions[2])}>Next Hint</button>
        <button onClick={() => void choose(quickActions[5])}>Undo</button>
      </nav>
      {message && (
        <div className="command-toast gm-toast" role="status">
          <b>Server confirmed</b>
          <span>{message}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {selected && (
        <ConfirmDialog
          action={selected}
          preview={preview}
          busy={busy}
          error={error}
          dialogRef={dialog}
          onCancel={() => {
            setSelected(null);
            setPreview(null);
          }}
          onExecute={execute}
          onStage={() => stage(selected)}
        />
      )}
      {palette && (
        <CommandPalette
          query={query}
          setQuery={setQuery}
          matches={commandMatches}
          choose={(action) => {
            setPalette(false);
            void choose(action);
          }}
          close={() => setPalette(false)}
        />
      )}
    </main>
  );
}

function Login({ error, onSubmit }: { error: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <main className="quartermaster-login">
      <section>
        <p className="eyebrow">Restricted chart room</p>
        <h1>Quartermaster&apos;s Log</h1>
        <p>Captain, identify yourself before touching the voyage ledger.</p>
        <form onSubmit={onSubmit}>
          <label>
            Captain&apos;s name
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Passphrase
            <input name="password" type="password" autoComplete="current-password" required minLength={8} />
          </label>
          <button className="brass-button">Enter the chart room</button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
function Truth({ label, value, tone = "neutral" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`truth ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Workspace({
  name,
  status,
  choose,
  stage,
  refresh,
}: {
  name: string;
  status: Status;
  choose: (action: Action) => Promise<void>;
  stage: (action: Action) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  if (name === "chapters") return <Chapters status={status} choose={choose} />;
  if (name === "hints") return <Hints status={status} choose={choose} stage={stage} />;
  if (name === "voyage") return <Voyage status={status} choose={choose} />;
  if (name === "artifacts") return <Artifacts status={status} choose={choose} />;
  if (name === "quests") return <Quests status={status} choose={choose} />;
  if (name === "journal") return <Journal status={status} choose={choose} />;
  if (name === "events") return <Events status={status} />;
  if (name === "player-view") return <PlayerView status={status} />;
  if (name === "recovery") return <Recovery status={status} choose={choose} />;
  if (name === "audit") return <Audit status={status} />;
  if (name === "diagnostics") return <Diagnostics status={status} refresh={refresh} choose={choose} />;
  return <Deck status={status} choose={choose} />;
}

function Deck({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  const last = status.events[0];
  const deckActions = quickActions.map((action) =>
    action.command === "PAUSE" && status.campaign.status === "PAUSED"
      ? {
          command: "RESUME" as const,
          label: "Resume Campaign",
          consequence: "Revalidate staged actions and return the voyage to active status.",
        }
      : action,
  );
  return (
    <>
      <section className="command-hero">
        <div>
          <p className="eyebrow">Active operation</p>
          <h2>
            Chapter {status.chapter.ordinal}: {status.chapter.title}
          </h2>
          <p>{status.chapters.find((item) => item.ordinal === status.chapter.ordinal)?.objective}</p>
        </div>
        <span className={`state-flag state-${status.chapter.state.toLowerCase()}`}>{status.chapter.state}</span>
      </section>
      <div className="deck-grid">
        <section className="instrument-panel immediate">
          <PanelTitle title="Immediate operations" detail="Fast, deliberate commands" />
          <div className="command-buttons">
            {deckActions.map((action) => (
              <button
                key={action.command}
                aria-label={action.label}
                onClick={() => void choose(action)}
                disabled={action.command === "UNDO_LAST" && !status.recovery.some((item) => item.reversible)}
              >
                <b>{action.label}</b>
                <span>{action.consequence}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="instrument-panel player-signal">
          <PanelTitle title="Player signal" detail="Evidence, not assumption" />
          <div className="signal-orb" data-state={status.presence.state} />
          <h3>{title(status.presence.state)}</h3>
          <dl>
            <Row label="Last heartbeat" value={formatAge(status.presence.lastSeenAt)} />
            <Row label="Active devices" value={String(status.presence.activeDevices)} />
            <Row label="Last acknowledged" value={`Sequence ${status.presence.acknowledgedSequence}`} />
            <Row label="Current route" value={status.presence.route ?? "Unknown"} />
          </dl>
          <Link href="/quartermaster/player-view">Inspect sanitized Player View →</Link>
        </section>
        <section className="instrument-panel upcoming">
          <PanelTitle title="Upcoming dispatches" detail={`${status.stagedActions.length} persisted`} />
          {status.stagedActions.length ? (
            <ol className="ledger-list">
              {status.stagedActions.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <span className="status-token amber">{item.status}</span>
                  <b>{title(item.command)}</b>
                  <small>
                    {item.expectedSequence === status.campaign.sequence ? "Validated" : "Needs revalidation"}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No staged releases. The player cannot see this ledger.</Empty>
          )}
        </section>
        <section className="instrument-panel recent">
          <PanelTitle title="Recent truth" detail={last ? `Last action sequence ${last.sequence}` : "No events"} />
          <ol className="event-stream">
            {status.events.slice(0, 7).map((event) => (
              <li key={event.id}>
                <span>{event.sequence}</span>
                <div>
                  <b>{title(event.type)}</b>
                  <small>
                    {event.actor} · {new Date(event.createdAt).toLocaleTimeString()}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function Chapters({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  return (
    <section className="instrument-panel full">
      <PanelTitle title="Chapter operations" detail="State-machine controlled; no arbitrary mutation" />
      <div className="chapter-ledger">
        {status.chapters.map((chapter) => (
          <article key={chapter.id}>
            <div className="chapter-number">{String(chapter.ordinal).padStart(2, "0")}</div>
            <div>
              <span className={`status-token state-${chapter.state.toLowerCase()}`}>{chapter.state}</span>
              <h2>{chapter.title}</h2>
              <p>{chapter.objective}</p>
              <small>
                {chapter.hints.length} hints ·{" "}
                {chapter.revealedAt ? `released ${new Date(chapter.revealedAt).toLocaleString()}` : "not released"}
              </small>
            </div>
            <div className="row-actions">
              {chapter.state === "LOCKED" && <button onClick={() => void choose(quickActions[0])}>Prepare</button>}
              {chapter.state === "READY" && (
                <button onClick={() => void choose(quickActions[1])}>Preview & release</button>
              )}
              {chapter.state === "ACTIVE" && <button onClick={() => void choose(quickActions[3])}>Mark solved</button>}
              {chapter.state === "SOLVED" && (
                <button
                  onClick={() =>
                    void choose({
                      command: "COMPLETE_CHAPTER",
                      label: "Complete Chapter",
                      consequence: "Close the solved chapter and make its completion durable.",
                    })
                  }
                >
                  Complete
                </button>
              )}
              {chapter.state === "COMPLETE" && <span>Complete — no forward action</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Hints({
  status,
  choose,
  stage,
}: {
  status: Status;
  choose: (action: Action) => Promise<void>;
  stage: (action: Action) => Promise<void>;
}) {
  return (
    <section className="instrument-panel full">
      <PanelTitle title="Hint control center" detail="Ordered release with quick next-hint control" />
      <button className="primary-command" onClick={() => void choose(quickActions[2])}>
        Release next eligible hint
      </button>
      {status.chapters.map((chapter) => (
        <div className="hint-group" key={chapter.id}>
          <h2>
            Chapter {chapter.ordinal} · {chapter.title}
          </h2>
          {chapter.hints.length ? (
            chapter.hints.map((hint) => {
              const action: Action = {
                command: "RELEASE_HINT",
                targetKey: hint.id,
                label: `Release Hint ${hint.ordinal}`,
                consequence: `Expose only Hint ${hint.ordinal} to the player.`,
              };
              return (
                <article key={hint.id}>
                  <span className={`status-token ${hint.releasedAt ? "live" : "sealed"}`}>
                    {hint.releasedAt ? "RELEASED" : "SEALED"}
                  </span>
                  <b>Hint {hint.ordinal}</b>
                  <p>{hint.body}</p>
                  {!hint.releasedAt && (
                    <div className="row-actions">
                      <button
                        onClick={() =>
                          void stage({ ...action, command: "PREPARE_HINT", label: `Prepare Hint ${hint.ordinal}` })
                        }
                      >
                        Prepare
                      </button>
                      <button onClick={() => void choose(action)}>Preview & release</button>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <Empty>No hints configured for this chapter.</Empty>
          )}
        </div>
      ))}
    </section>
  );
}

function Voyage({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  return (
    <div className="split-workspace">
      <section className="instrument-panel">
        <PanelTitle title="Voyage plotting table" detail="Fog clears only after server commit" />
        <div className="gm-chart">
          {status.mapLocations.map((location) => (
            <button
              key={location.id}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
              className={location.revealedAt ? "revealed" : "hidden-mark"}
              onClick={() =>
                !location.revealedAt &&
                void choose({
                  command: "REVEAL_MAP",
                  targetKey: location.key,
                  label: `Reveal ${location.name}`,
                  consequence: `Clear fog around ${location.name} and publish its approximate position.`,
                })
              }
            >
              <span>✦</span>
              <b>{location.revealedAt ? location.name : "Hidden bearing"}</b>
            </button>
          ))}
        </div>
      </section>
      <section className="instrument-panel">
        <PanelTitle title="Chart ledger" detail="Approximate player-safe positions" />
        <ol className="ledger-list">
          {status.mapLocations.map((location) => (
            <li key={location.id}>
              <span className={`status-token ${location.revealedAt ? "live" : "sealed"}`}>
                {location.revealedAt ? "REVEALED" : "HIDDEN"}
              </span>
              <b>{location.name}</b>
              <small>
                {location.regionLabel} · {location.x}, {location.y}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Artifacts({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  return (
    <section className="instrument-panel full">
      <PanelTitle title="Artifact operations" detail="Award ceremony and inventory truth" />
      <div className="artifact-ledger">
        {status.artifacts.map((item) => (
          <article key={item.id}>
            <div className="artifact-glyph">◇</div>
            <span className={`status-token ${item.awarded ? "live" : "sealed"}`}>
              {item.awarded ? "COLLECTED" : "AVAILABLE"}
            </span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            {!item.awarded && (
              <button
                onClick={() =>
                  void choose({
                    command: "AWARD_ARTIFACT",
                    targetKey: item.key,
                    label: `Award ${item.name}`,
                    consequence: `Place ${item.name} in the player's relic frame and publish an award event.`,
                  })
                }
              >
                Preview award
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Quests({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  return (
    <section className="instrument-panel full">
      <PanelTitle title="Side-quest operations" detail="Discovery and objective progression" />
      <div className="quest-ledger">
        {status.sideQuests.map((quest) => (
          <article key={quest.id}>
            <span className="status-token amber">{quest.state}</span>
            <h2>{quest.title}</h2>
            <ol>
              {quest.objectives.map((objective) => (
                <li key={objective.id}>
                  {objective.complete ? "✓" : "○"} {objective.body}
                </li>
              ))}
            </ol>
            <div className="row-actions">
              {["HIDDEN", "RUMORED"].includes(quest.state) ? (
                <button
                  onClick={() =>
                    void choose({
                      command: "DISCOVER_SIDE_QUEST",
                      targetKey: quest.key,
                      label: `Discover ${quest.title}`,
                      consequence: "Make the optional course visible without changing the main chapter.",
                    })
                  }
                >
                  Discover quest
                </button>
              ) : (
                quest.state !== "COMPLETE" && (
                  <button
                    onClick={() =>
                      void choose({
                        command: "ADVANCE_SIDE_QUEST",
                        targetKey: quest.key,
                        label: `Advance ${quest.title}`,
                        consequence: "Advance the quest by one validated state.",
                      })
                    }
                  >
                    Advance quest
                  </button>
                )
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Journal({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  const [entry, setEntry] = useState({ title: "Captain's dispatch", body: "" });
  return (
    <div className="split-workspace">
      <section className="instrument-panel composer">
        <PanelTitle title="Narrative composer" detail="Development-only dispatch content" />
        <label>
          Entry title
          <input
            value={entry.title}
            maxLength={120}
            onChange={(event) => setEntry({ ...entry, title: event.target.value })}
          />
        </label>
        <label>
          Player-visible message
          <textarea
            value={entry.body}
            maxLength={2000}
            rows={10}
            onChange={(event) => setEntry({ ...entry, body: event.target.value })}
          />
        </label>
        <small>{entry.body.length}/2000 · scripts and markup render as plain text</small>
        <button
          className="primary-command"
          disabled={!entry.body.trim()}
          onClick={() =>
            void choose({
              command: "RELEASE_JOURNAL_ENTRY",
              label: "Release Journal Annotation",
              consequence: "Publish this exact plain-text dispatch to the player's event stream.",
              payload: entry,
            })
          }
        >
          Preview dispatch
        </button>
      </section>
      <section className="instrument-panel">
        <PanelTitle title="Released annotations" detail={`${status.journalEntries.length} entries`} />
        <ol className="narrative-list">
          {status.journalEntries.map((item) => (
            <li key={item.id}>
              <b>{item.title}</b>
              <p>{item.body}</p>
              <small>{item.releasedAt ? new Date(item.releasedAt).toLocaleString() : "DRAFT"}</small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Events({ status }: { status: Status }) {
  return (
    <div className="split-workspace">
      <section className="instrument-panel">
        <PanelTitle title="Staging ledger" detail="Prepared is not released" />
        {status.stagedActions.length ? (
          <ol className="ledger-list">
            {status.stagedActions.map((item) => (
              <li key={item.id}>
                <span className="status-token amber">{item.status}</span>
                <b>{title(item.command)}</b>
                <small>
                  Expected sequence {item.expectedSequence} ·{" "}
                  {item.expectedSequence === status.campaign.sequence ? "valid now" : "stale — revalidation required"}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>The staging ledger is empty.</Empty>
        )}
      </section>
      <section className="instrument-panel">
        <PanelTitle title="Player-facing event history" detail="Immutable ordered sequence" />
        <ol className="event-stream long">
          {status.events.map((event) => (
            <li key={event.id}>
              <span>{event.sequence}</span>
              <div>
                <b>{title(event.type)}</b>
                <small>
                  {new Date(event.createdAt).toLocaleString()} · {event.actor}
                </small>
                <code>{event.id}</code>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function PlayerView({ status }: { status: Status }) {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const snap = status.playerSnapshot;
  return (
    <section className="player-mirror-workspace">
      <header>
        <div>
          <p className="eyebrow">Current Player View</p>
          <h2>Sanitized snapshot · sequence {snap.sequence}</h2>
          <p>This is released state. Drafts, admin metadata, hidden content, and audit records are excluded.</p>
        </div>
        <div className="segmented">
          <button aria-pressed={mode === "desktop"} onClick={() => setMode("desktop")}>
            Desktop
          </button>
          <button aria-pressed={mode === "mobile"} onClick={() => setMode("mobile")}>
            Mobile
          </button>
        </div>
      </header>
      <div className={`player-mirror ${mode}`}>
        <div className="mirror-browser">
          <span>PLAYER VIEW — ACTUAL RELEASED STATE</span>
          <article>
            <p className="eyebrow">
              Chapter {snap.chapter.ordinal} · {snap.chapter.state}
            </p>
            <h1>{snap.chapter.title ?? "Awaiting the captain's signal"}</h1>
            <p>{snap.chapter.narrative}</p>
            <blockquote>{snap.chapter.riddle}</blockquote>
            <aside>{snap.chapter.objective ?? "No released objective."}</aside>
          </article>
          <footer>
            {snap.artifacts.length} relics · {snap.mapLocations.length} chart marks ·{" "}
            {snap.sideQuest?.state ?? "No side quest"}
          </footer>
        </div>
      </div>
    </section>
  );
}

function Recovery({ status, choose }: { status: Status; choose: (action: Action) => Promise<void> }) {
  return (
    <div className="split-workspace">
      <section className="instrument-panel danger-zone">
        <PanelTitle title="Recovery center" detail="Compensating events preserve history" />
        <div className="recovery-callout">
          <b>Undo is not deletion.</b>
          <p>The server restores the last save point, emits STATE_REVERTED, and asks active players to reconcile.</p>
        </div>
        <button
          className="danger-command"
          disabled={!status.recovery.some((item) => item.reversible)}
          onClick={() => void choose(quickActions[5])}
        >
          Analyze & undo last action
        </button>
        <ol className="ledger-list">
          {status.recovery.map((item) => (
            <li key={item.id}>
              <span className={`status-token ${item.reversible ? "amber" : "sealed"}`}>
                {item.reversible ? "LATEST" : "HISTORIC"}
              </span>
              <b>{title(item.reason)}</b>
              <small>
                Before sequence {item.sequence} · {new Date(item.createdAt).toLocaleString()}
              </small>
            </li>
          ))}
        </ol>
      </section>
      <section className="instrument-panel">
        <PanelTitle title="Emergency operations" detail="Guarded high-impact controls" />
        <button
          onClick={() =>
            void choose(
              status.campaign.status === "PAUSED"
                ? {
                    command: "RESUME",
                    label: "Resume Campaign",
                    consequence: "Resume progression after queued-action revalidation.",
                  }
                : quickActions[4],
            )
          }
        >
          {status.campaign.status === "PAUSED" ? "Review & resume" : "Emergency pause"}
        </button>
        <button
          onClick={() =>
            void choose({
              command: "REQUEST_RECONCILIATION",
              label: "Request Player Reconciliation",
              consequence: "Publish a refresh request without changing story progression.",
              risk: "LOW",
            })
          }
        >
          Request snapshot reconciliation
        </button>
        <div className="critical-disabled">
          <b>Finale unlock</b>
          <span>Disabled during Phase 3. No real finale content is present.</span>
        </div>
      </section>
    </div>
  );
}

function Audit({ status }: { status: Status }) {
  return (
    <section className="instrument-panel full">
      <PanelTitle title="Administrative audit" detail="Actor, outcome, reason, and correlation" />
      <div className="audit-table" role="table" aria-label="Administrative audit history">
        <div role="row" className="table-head">
          <span>Time</span>
          <span>Actor</span>
          <span>Action</span>
          <span>Outcome</span>
          <span>Correlation</span>
        </div>
        {status.audit.map((item) => (
          <div role="row" key={item.id}>
            <time>{new Date(item.createdAt).toLocaleString()}</time>
            <span>{item.actor}</span>
            <b>{title(item.action)}</b>
            <span className={`status-token ${item.outcome === "SUCCEEDED" ? "live" : "danger"}`}>{item.outcome}</span>
            <code>{item.correlationId?.slice(0, 8) ?? "legacy"}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Diagnostics({
  status,
  refresh,
  choose,
}: {
  status: Status;
  refresh: () => Promise<void>;
  choose: (action: Action) => Promise<void>;
}) {
  return (
    <div className="split-workspace">
      <section className="instrument-panel">
        <PanelTitle title="Synchronization diagnostics" detail="Read-only operational evidence" />
        <dl className="diagnostic-grid">
          <Row label="Database" value={status.diagnostics.database} />
          <Row label="Live transport" value={status.diagnostics.liveTransport} />
          <Row label="Server sequence" value={String(status.diagnostics.latestCampaignSequence)} />
          <Row label="Player acknowledgment" value={String(status.diagnostics.latestAcknowledgedSequence)} />
          <Row label="Sequence lag" value={String(status.diagnostics.lag)} />
          <Row label="Stale prepared actions" value={String(status.diagnostics.stalePreparedActions)} />
        </dl>
        <button onClick={() => void refresh()}>Refresh evidence</button>
        <button
          onClick={() =>
            void choose({
              command: "REQUEST_RECONCILIATION",
              label: "Request Player Reconciliation",
              consequence: "Ask connected player clients to fetch the authoritative snapshot.",
              risk: "LOW",
            })
          }
        >
          Request reconciliation
        </button>
      </section>
      <section className="instrument-panel">
        <PanelTitle title="Capability boundary" detail="Simple documented authorization model" />
        <ul className="capability-list">
          {status.permissions.map((item) => (
            <li key={item}>✓ {title(item)}</li>
          ))}
        </ul>
        <div className="environment-gate">
          <b>Development controls</b>
          <span>
            {status.permissions.includes("RESET_DEVELOPMENT_CAMPAIGN")
              ? "Server gate open in development"
              : "Production gate closed"}
          </span>
        </div>
      </section>
    </div>
  );
}

function ConfirmDialog({
  action,
  preview,
  busy,
  error,
  dialogRef,
  onCancel,
  onExecute,
  onStage,
}: {
  action: Action;
  preview: Preview | null;
  busy: boolean;
  error: string;
  dialogRef: React.RefObject<HTMLElement | null>;
  onCancel: () => void;
  onExecute: () => void;
  onStage: () => void;
}) {
  return (
    <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="command-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
      >
        <header>
          <div>
            <p className="eyebrow">
              {action.risk ?? (action.command.startsWith("PREPARE") ? "Medium" : "High")} risk command
            </p>
            <h2 id="confirm-title">{action.label}</h2>
          </div>
          <button aria-label="Close confirmation" onClick={onCancel}>
            ×
          </button>
        </header>
        {busy && !preview ? (
          <p role="status">Computing server-side projection…</p>
        ) : (
          <>
            <div className="preview-watermark">{preview?.watermark ?? "PREVIEW UNAVAILABLE"}</div>
            <p>{action.consequence}</p>
            <div className="transition-compare">
              <div>
                <span>Current</span>
                <b>Sequence {preview ? preview.projectedSequence - 1 : "—"}</b>
              </div>
              <i aria-hidden="true">→</i>
              <div>
                <span>Projected</span>
                <b>Sequence {preview?.projectedSequence ?? "—"}</b>
              </div>
            </div>
            <dl>
              <Row label="Event" value={preview?.eventType ? title(preview.eventType) : "Pending"} />
              <Row
                label="Undo"
                value={preview?.undoAvailable ? "Available, subject to dependencies" : "Not available"}
              />
              <Row
                label="Ceremony"
                value={preview?.affectedSystems.includes("Player ceremony") ? "Will trigger" : "No theatrical ceremony"}
              />
            </dl>
            <div className="affected">
              <b>Affected systems</b>
              <ul>
                {preview?.affectedSystems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {preview?.prerequisites.length ? (
              <div className="prerequisite-error" role="alert">
                <b>Cannot execute</b>
                {preview.prerequisites.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : (
              <p className="ready-note">✓ Server validation passed at the displayed sequence.</p>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button onClick={onCancel}>Cancel</button>
          {action.command.startsWith("PREPARE") && (
            <button disabled={busy || !preview?.canExecute} onClick={onStage}>
              Persist in staging
            </button>
          )}
          <button className="confirm-action" disabled={busy || !preview?.canExecute} onClick={onExecute}>
            {busy ? "Committing…" : "Confirm action"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CommandPalette({
  query,
  setQuery,
  matches,
  choose,
  close,
}: {
  query: string;
  setQuery: (value: string) => void;
  matches: Action[];
  choose: (action: Action) => void;
  close: () => void;
}) {
  return (
    <div className="palette-backdrop">
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <header>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search safe commands…"
            aria-label="Search commands"
          />
          <button aria-label="Close command palette" onClick={close}>
            Esc
          </button>
        </header>
        <div>
          {matches.map((action) => (
            <button key={action.command} onClick={() => choose(action)}>
              <b>{action.label}</b>
              <span>{action.consequence}</span>
            </button>
          ))}
        </div>
        <footer>Navigate with Tab · open with Ctrl K · close with Escape</footer>
      </section>
    </div>
  );
}
function PanelTitle({ title: heading, detail }: { title: string; detail: string }) {
  return (
    <header className="panel-heading">
      <div>
        <p className="eyebrow">Captain’s instrument</p>
        <h2>{heading}</h2>
      </div>
      <span>{detail}</span>
    </header>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty-ledger">{children}</p>;
}
