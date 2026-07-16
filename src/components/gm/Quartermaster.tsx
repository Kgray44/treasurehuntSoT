"use client";
import { useCallback, useEffect, useState } from "react";
import { cinematicSequences, type CinematicSequenceName } from "@/components/cinematic/sequences";
import { useCinematicTransition, type MotionMode } from "@/components/cinematic/useCinematicTransition";
type Status = {
  csrfToken: string;
  campaign: { slug: string; title: string; status: string; sequence: number };
  chapter: { ordinal: number; state: string; title: string };
  playerConnected: boolean;
  events: Array<{ id: string; type: string; sequence: number; createdAt: string }>;
  inventory: string[];
  sideQuest: { title: string; state: string } | null;
  preview: { chapter: { objective?: string } };
};
const actions = [
  [
    "PREPARE_CHAPTER",
    "Prepare Chapter",
    "Move the sealed chapter into a ready state. The player still receives no clue text.",
  ],
  ["RELEASE_CHAPTER", "Release Chapter", "Publish the clue, begin the player ceremony, and make Chapter One active."],
  ["MARK_SOLVED", "Mark Chapter Solved", "Record that the current chapter has been solved."],
  ["AWARD_ARTIFACT", "Award Test Artifact", "Place the Broken Compass Needle in the player’s relic frame."],
  ["REVEAL_MAP", "Reveal Test Map Location", "Mark Port Merrick on the voyage chart."],
  ["REVEAL_ROUTE", "Reveal Route Segment", "Draw the next safe development route between revealed locations."],
  [
    "REVEAL_ARTIFACT_SILHOUETTE",
    "Reveal Artifact Silhouette",
    "Expose only the next artifact’s approved safe outline.",
  ],
  [
    "CONNECT_ARTIFACTS",
    "Connect Test Artifacts",
    "Reveal the neutral development connection between configured relics.",
  ],
  ["DISCOVER_SIDE_QUEST", "Discover Side Quest", "Move the next optional mystery from rumor to discovered."],
  ["UPDATE_SIDE_QUEST", "Update Side Quest", "Advance one released optional objective."],
  ["COMPLETE_SIDE_QUEST", "Complete Side Quest", "Complete the active optional mystery and grant its safe reward."],
  ["ADD_JOURNAL_ANNOTATION", "Add Journal Annotation", "Release a generic development note beside the active chapter."],
  ["ADD_LOG_ENTRY", "Add Player Log Entry", "Record a generic player-facing captain’s note."],
  ["TEASE_FINALE", "Tease Sealed Finale", "Wake the dormant shell without releasing finale content."],
  ["UPDATE_FINALE_REQUIREMENT", "Update Finale Requirement", "Advance one generic symbolic requirement."],
  [
    "UNDO_LAST",
    "Undo Last Progression Action",
    "Restore the last saved progression state and publish a reconciliation event.",
  ],
  ["PAUSE", "Pause Campaign", "Pause the voyage without hiding already released material."],
  ["RESUME", "Resume Campaign", "Return the voyage to active status."],
] as const;
export function Quartermaster({ authenticated }: { authenticated: boolean }) {
  const [signedIn, setSignedIn] = useState(authenticated);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<(typeof actions)[number] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [motionMode, setMotionMode] = useState<MotionMode>("full");
  const transition = useCinematicTransition(motionMode);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setMotionMode(
        media.matches || localStorage.getItem("forever-motion") === "reduced"
          ? "reduced"
          : localStorage.getItem("forever-motion") === "gentle"
            ? "gentle"
            : "full",
      );
    queueMicrotask(sync);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/gm/status", { cache: "no-store" });
    if (response.ok) {
      setStatus(await response.json());
      setSignedIn(true);
    }
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    void fetch("/api/gm/status", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setStatus(await response.json());
    });
  }, [signedIn]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await transition.play("signIn", cinematicSequences.signIn, async () => {
        const response = await fetch("/api/gm/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      });
      setSignedIn(true);
      void refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lock refused the key.");
    }
  }
  async function execute() {
    if (!selected || !status) return;
    setBusy(true);
    setError("");
    const action = selected;
    const sequenceByAction: Record<string, CinematicSequenceName> = {
      PREPARE_CHAPTER: "prepare",
      RELEASE_CHAPTER: "release",
      MARK_SOLVED: "solved",
      AWARD_ARTIFACT: "artifact",
      REVEAL_MAP: "map",
      REVEAL_ROUTE: "map",
      REVEAL_ARTIFACT_SILHOUETTE: "artifact",
      CONNECT_ARTIFACTS: "artifact",
      DISCOVER_SIDE_QUEST: "prepare",
      UPDATE_SIDE_QUEST: "prepare",
      COMPLETE_SIDE_QUEST: "solved",
      ADD_JOURNAL_ANNOTATION: "prepare",
      ADD_LOG_ENTRY: "prepare",
      TEASE_FINALE: "prepare",
      UPDATE_FINALE_REQUIREMENT: "prepare",
      UNDO_LAST: "undo",
      PAUSE: "pause",
      RESUME: "resume",
    };
    try {
      const data = await transition.play(
        sequenceByAction[action[0]],
        cinematicSequences[sequenceByAction[action[0]]],
        async () => {
          const response = await fetch("/api/gm/action", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
            body: JSON.stringify({ action: action[0], campaignSlug: status.campaign.slug, confirmation: true }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          setSelected(null);
          return body;
        },
      );
      if (data) {
        setMessage(`Event ${data.event.id} recorded at sequence ${data.event.sequence}.`);
        await refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The order could not be recorded.");
    }
    setBusy(false);
  }
  if (!signedIn)
    return (
      <main className={`quartermaster-login cinematic-${transition.stage}`}>
        <div className="cabin-door" aria-hidden="true">
          <span>Private command surface</span>
        </div>
        <section className="login-ledger">
          <div className="brass-latch" aria-hidden="true">
            F
          </div>
          <p className="eyebrow">Restricted chart room</p>
          <h1>Quartermaster’s Log</h1>
          <p>Captain, identify yourself before touching the voyage ledger.</p>
          <form onSubmit={login}>
            <label>
              Captain’s name
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Passphrase
              <input name="password" type="password" autoComplete="current-password" required minLength={8} />
            </label>
            <button className="brass-button" disabled={transition.isPlaying}>
              {transition.isPlaying ? "Turning the key…" : "Enter the chart room"}
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        <CinematicOverlay name={transition.name} stage={transition.stage} active={transition.isPlaying} />
      </main>
    );
  if (!status) return <main className="quartermaster-shell loading-quarters">Opening the voyage ledger…</main>;
  return (
    <main className={`quartermaster-shell cinematic-${transition.stage}`}>
      <header>
        <div>
          <p className="eyebrow">Private command surface</p>
          <h1>Quartermaster’s Log</h1>
        </div>
        <div className="campaign-stamp">
          <span>{status.campaign.status}</span>
          <b>Sequence {status.campaign.sequence}</b>
        </div>
      </header>
      <section className="gm-grid">
        <div className="gm-status-card">
          <p className="card-kicker">Active voyage</p>
          <h2>{status.campaign.title}</h2>
          <dl>
            <div>
              <dt>Chapter</dt>
              <dd>
                {status.chapter.ordinal} · {status.chapter.title}
              </dd>
            </div>
            <div>
              <dt>Chapter state</dt>
              <dd>{status.chapter.state}</dd>
            </div>
            <div>
              <dt>Player signal</dt>
              <dd className={status.playerConnected ? "signal-live" : ""}>
                {status.playerConnected ? "Connected recently" : "No recent signal"}
              </dd>
            </div>
            <div>
              <dt>Side quest</dt>
              <dd>{status.sideQuest?.state ?? "None"}</dd>
            </div>
          </dl>
        </div>
        <div className="gm-preview">
          <p className="card-kicker">Player’s present view</p>
          <div className="mini-page">
            <span>{status.chapter.state}</span>
            <strong>{status.preview.chapter.objective ?? "Awaiting the captain’s signal."}</strong>
          </div>
          <a href={`/tale/${status.campaign.slug}`} target="_blank">
            Open player view ↗
          </a>
        </div>
        <div className="gm-actions">
          <p className="card-kicker">Progression controls</p>
          <div className="action-list">
            {actions.map((action) => (
              <button
                key={action[0]}
                aria-label={action[1]}
                className={action[0] === "UNDO_LAST" ? "danger-action" : ""}
                onClick={() => setSelected(action)}
              >
                <strong>{action[1]}</strong>
                <span>{action[2]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="gm-events">
          <p className="card-kicker">Recent ledger entries</p>
          <ol>
            {status.events.map((event) => (
              <li key={event.id}>
                <span>{event.sequence}</span>
                <b>{event.type.replaceAll("_", " ")}</b>
                <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            ))}
          </ol>
          <p>Relics aboard: {status.inventory.length ? status.inventory.join(", ") : "none"}</p>
        </div>
      </section>
      {message && (
        <div className="gm-toast" role="status">
          {message}
        </div>
      )}
      {selected && (
        <div className="confirm-backdrop">
          <section className="confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <p className="eyebrow">Confirm ledger action</p>
            <h2 id="confirm-title">{selected[1]}</h2>
            <p>{selected[2]}</p>
            <div className="impact-note">
              <b>What happens next</b>
              <span>
                This runs atomically, writes an audit entry, publishes one ordered event, and creates a state point for
                undo.
              </span>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div>
              <button onClick={() => setSelected(null)}>Cancel</button>
              <button className="confirm-action" disabled={busy} onClick={execute}>
                {busy ? "Recording…" : "Confirm action"}
              </button>
            </div>
          </section>
        </div>
      )}
      <CinematicOverlay name={transition.name} stage={transition.stage} active={transition.isPlaying} />
      {process.env.NODE_ENV === "development" && (
        <details className="dev-cinematic">
          <summary>Animation lab</summary>
          {(Object.keys(cinematicSequences) as CinematicSequenceName[]).map((name) => (
            <button
              key={name}
              onClick={() => void transition.play(name, cinematicSequences[name]).catch(() => undefined)}
            >
              {name}
            </button>
          ))}
        </details>
      )}
    </main>
  );
}

function CinematicOverlay({ name, stage, active }: { name: string; stage: string; active: boolean }) {
  if (!active) return null;
  return (
    <div
      className={`cinematic-command-overlay scene-${name} scene-stage-${stage}`}
      aria-live="polite"
      aria-label={`${name} ceremony: ${stage}`}
    >
      <div className="lantern-sweep" aria-hidden="true" />
      <div className="ceremony-seal" aria-hidden="true">
        F
      </div>
      <p>{stage.replaceAll("-", " ")}</p>
    </div>
  );
}
