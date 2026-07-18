"use client";

/* eslint-disable @next/next/no-img-element -- The cabin's decorative SVG is an animation target, not content imagery. */

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { AnimationSceneName } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { cardVariants, pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";

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
  ["AWARD_ARTIFACT", "Award Test Artifact", "Place the Broken Compass Needle in the player's relic frame."],
  ["REVEAL_MAP", "Reveal Test Map Location", "Mark Port Merrick on the voyage chart."],
  ["REVEAL_ROUTE", "Reveal Route Segment", "Draw the next safe development route between revealed locations."],
  [
    "REVEAL_ARTIFACT_SILHOUETTE",
    "Reveal Artifact Silhouette",
    "Expose only the next artifact's approved safe outline.",
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
  ["ADD_LOG_ENTRY", "Add Player Log Entry", "Record a generic player-facing captain's note."],
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

type Action = (typeof actions)[number];

const actionScene: Record<Action[0], AnimationSceneName> = {
  PREPARE_CHAPTER: "prepare-chapter",
  RELEASE_CHAPTER: "seal-break",
  MARK_SOLVED: "mark-solved",
  AWARD_ARTIFACT: "artifact-award",
  REVEAL_MAP: "map-reveal",
  REVEAL_ROUTE: "route-draw",
  REVEAL_ARTIFACT_SILHOUETTE: "artifact-award",
  CONNECT_ARTIFACTS: "artifact-connection",
  DISCOVER_SIDE_QUEST: "quest-discovery",
  UPDATE_SIDE_QUEST: "quest-discovery",
  COMPLETE_SIDE_QUEST: "quest-complete",
  ADD_JOURNAL_ANNOTATION: "log-entry",
  ADD_LOG_ENTRY: "log-entry",
  TEASE_FINALE: "finale-tease",
  UPDATE_FINALE_REQUIREMENT: "finale-requirement",
  UNDO_LAST: "undo",
  PAUSE: "pause",
  RESUME: "resume",
};

export function Quartermaster({ authenticated }: { authenticated: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [signedIn, setSignedIn] = useState(authenticated);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<Action | null>(null);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/gm/status", { cache: "no-store" });
    if (!response.ok) return;
    setStatus((await response.json()) as Status);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, signedIn]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!root.current) return;
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await director.play("quartermaster-login", {
        root: root.current,
        queue: false,
        operation: async () => {
          const response = await fetch("/api/gm/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
          });
          const data = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(data.error ?? "The lock refused the key.");
          return data;
        },
      });
      setSignedIn(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lock refused the key.");
    }
  }

  async function execute() {
    if (!selected || !status || !root.current) return;
    setBusy(true);
    setError("");
    const action = selected;
    flushSync(() => setActiveAction(action));
    try {
      const data = await director.play(actionScene[action[0]], {
        root: root.current,
        queue: false,
        display: { actionLabel: action[1] },
        operation: async () => {
          const response = await fetch("/api/gm/action", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
            body: JSON.stringify({ action: action[0], campaignSlug: status.campaign.slug, confirmation: true }),
          });
          const body = (await response.json()) as { error?: string; event?: { id: string; sequence: number } };
          if (!response.ok || !body.event) throw new Error(body.error ?? "The order could not be recorded.");
          return body;
        },
      });
      if (data?.event) {
        setMessage(`Event ${data.event.id} recorded at sequence ${data.event.sequence}.`);
        setSelected(null);
        await refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The order could not be recorded.");
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }

  if (!signedIn) {
    return (
      <main ref={root} className={`quartermaster-login stage-${animation.label}`} data-motion-mode={mode}>
        <div className="chart-room-light" data-scene-part="chart-room-light" data-gsap-owned aria-hidden="true" />
        <LottieEffect
          asset={lottieAssets.rollingFog}
          mode={mode}
          label="Dust and lantern haze at the chart-room entrance"
          className="login-door-dust"
        />
        <div className="cabin-door" data-scene-part="cabin-door" data-gsap-owned aria-hidden="true">
          <span>Private command surface</span>
          <i data-scene-part="door-bolt" data-gsap-owned />
          <div className="door-keyhole" data-scene-part="lock" data-gsap-owned />
        </div>
        <div className="login-lantern" data-scene-part="lantern" data-gsap-owned aria-hidden="true">
          <i />
          <b />
        </div>
        <section className="login-ledger" data-scene-part="login-ledger" data-gsap-owned>
          <div className="brass-latch" aria-hidden="true">
            <RiveStatefulObject asset={riveAssets.invitationSeal} mode={mode} label="Quartermaster door lock" />
          </div>
          <p className="eyebrow">Restricted chart room</p>
          <h1>Quartermaster&apos;s Log</h1>
          <p>Captain, identify yourself before touching the voyage ledger.</p>
          <form onSubmit={login}>
            <label>
              Captain&apos;s name
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Passphrase
              <input name="password" type="password" autoComplete="current-password" required minLength={8} />
            </label>
            <motion.button className="brass-button" disabled={animation.isPlaying} {...pressable(mode)}>
              {animation.isPlaying ? "Turning the key…" : "Enter the chart room"}
            </motion.button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        <div className="quartermaster-login-controls">
          <button onClick={cycle} aria-label={`Motion: ${mode}. Change motion setting`}>
            {mode} motion
          </button>
          {animation.isPlaying && <button onClick={() => director.skip()}>Skip nonessential motion</button>}
        </div>
        <AnimationTestButton />
      </main>
    );
  }

  if (!status) return <main className="quartermaster-shell loading-quarters">Opening the voyage ledger…</main>;

  return (
    <main ref={root} className={`quartermaster-shell stage-${animation.label}`} data-motion-mode={mode}>
      <div className="quartermaster-desk" data-scene-part="command-light" data-gsap-owned aria-hidden="true" />
      <header className="quartermaster-header">
        <div>
          <p className="eyebrow">Private command surface</p>
          <h1>Quartermaster&apos;s Log</h1>
        </div>
        <div className="gm-header-tools">
          <a href="/studio">Tall Tale Studio</a>
          <a href="/captain">Captain sessions</a>
          <button onClick={cycle} aria-label={`Motion: ${mode}. Change motion setting`}>
            {mode} motion
          </button>
          <div className="campaign-stamp">
            <span>{status.campaign.status}</span>
            <b>Sequence {status.campaign.sequence}</b>
          </div>
        </div>
      </header>
      <section className="gm-grid">
        <motion.article
          className="gm-status-card"
          variants={cardVariants(mode)}
          initial="initial"
          animate="enter"
          custom={0}
        >
          <p className="card-kicker">Active voyage</p>
          <h2>{status.campaign.title}</h2>
          <div className="status-instruments">
            <div className={`connection-lamp ${status.playerConnected ? "live" : "quiet"}`}>
              <i />
              {status.playerConnected ? "Player signal" : "No recent signal"}
            </div>
            <div className="campaign-instrument">
              <i style={{ "--progress": `${Math.min(status.campaign.sequence * 8, 100)}%` } as React.CSSProperties} />
              <span>{status.campaign.status}</span>
            </div>
          </div>
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
              <dt>Side quest</dt>
              <dd>{status.sideQuest?.state ?? "None"}</dd>
            </div>
          </dl>
        </motion.article>
        <motion.article
          className="gm-preview"
          variants={cardVariants(mode)}
          initial="initial"
          animate="enter"
          custom={1}
        >
          <p className="card-kicker">Player&apos;s present view</p>
          <div className="mini-page">
            <span>{status.chapter.state}</span>
            <strong>{status.preview.chapter.objective ?? "Awaiting the captain's signal."}</strong>
          </div>
          <a href={`/tale/${status.campaign.slug}`} target="_blank">
            Open player view ↗
          </a>
        </motion.article>
        <motion.article
          className="gm-actions"
          variants={cardVariants(mode)}
          initial="initial"
          animate="enter"
          custom={2}
        >
          <p className="card-kicker">Progression controls</p>
          <div className="action-list">
            {actions.map((action) => (
              <motion.button
                layout
                key={action[0]}
                aria-label={action[1]}
                className={action[0] === "UNDO_LAST" ? "danger-action" : ""}
                onClick={() => {
                  setError("");
                  setSelected(action);
                }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.99 }}
              >
                <strong>{action[1]}</strong>
                <span>{action[2]}</span>
              </motion.button>
            ))}
          </div>
        </motion.article>
        <motion.article
          className="gm-events"
          variants={cardVariants(mode)}
          initial="initial"
          animate="enter"
          custom={3}
        >
          <p className="card-kicker">Recent ledger entries</p>
          <ol>
            {status.events.map((event) => (
              <motion.li layout key={event.id}>
                <span>{event.sequence}</span>
                <b>{event.type.replaceAll("_", " ")}</b>
                <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </motion.li>
            ))}
          </ol>
          <p>Relics aboard: {status.inventory.length ? status.inventory.join(", ") : "none"}</p>
        </motion.article>
      </section>
      <AnimatePresence>
        {message && (
          <motion.div
            className="gm-toast"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {message}
            <button onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selected && (
          <motion.div
            className="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="confirm-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, opacity: 0 }}
            >
              <p className="eyebrow">Confirm ledger action</p>
              <h2 id="confirm-title">{selected[1]}</h2>
              <p>{selected[2]}</p>
              <div className="impact-note">
                <b>What happens next</b>
                <span>
                  This runs atomically, writes an audit entry, publishes one ordered event, and creates a state point
                  for undo.
                </span>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div>
                <button onClick={() => setSelected(null)} disabled={busy}>
                  Cancel
                </button>
                <button className="confirm-action" disabled={busy} onClick={execute}>
                  {busy ? "Recording…" : "Confirm action"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeAction && (
          <QuartermasterActionScene
            action={activeAction}
            scene={actionScene[activeAction[0]]}
            label={animation.label}
            mode={mode}
            skip={() => director.skip()}
          />
        )}
      </AnimatePresence>
      <AnimationTestButton />
    </main>
  );
}

function QuartermasterActionScene({
  action,
  scene,
  label,
  mode,
  skip,
}: {
  action: Action;
  scene: AnimationSceneName;
  label: string;
  mode: ReturnType<typeof useMotionMode>["mode"];
  skip: () => void;
}) {
  const descriptions: Record<Action[0], string> = {
    PREPARE_CHAPTER: "A blank leaf aligns beneath the captain's press.",
    RELEASE_CHAPTER: "The chapter seal parts and released ink finds the page.",
    MARK_SOLVED: "The solved stamp falls with an imperfect edge.",
    AWARD_ARTIFACT: "Velvet darkens while the recovered object finds its brass slot.",
    REVEAL_MAP: "Fog withdraws and a new marker meets the chart.",
    REVEAL_ROUTE: "A route scratches itself between truthful bearings.",
    REVEAL_ARTIFACT_SILHOUETTE: "Only the approved silhouette enters the cabinet.",
    CONNECT_ARTIFACTS: "A fine brass line joins the released relics.",
    DISCOVER_SIDE_QUEST: "A rumor note slips from its envelope.",
    UPDATE_SIDE_QUEST: "Fresh ink checks the next optional objective.",
    COMPLETE_SIDE_QUEST: "The optional course receives its completion stamp.",
    ADD_JOURNAL_ANNOTATION: "A captain's note settles into the margin.",
    ADD_LOG_ENTRY: "The next dated line enters the logbook.",
    TEASE_FINALE: "The outer rings wake while the core stays sealed.",
    UPDATE_FINALE_REQUIREMENT: "One truthful socket receives light.",
    UNDO_LAST: "Ink, route, and mark return toward their prior truthful state.",
    PAUSE: "Wind falls, lantern dims, and the compass rests.",
    RESUME: "Lantern and compass return to their working rhythm.",
  };
  return (
    <motion.div
      className={`cinematic-command-overlay command-${action[0].toLowerCase()} scene-${scene}`}
      data-motion-mode={mode}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
      aria-label={`${action[1]} ceremony: ${label}`}
    >
      <div className="command-vignette" data-scene-part="workspace-light" data-gsap-owned aria-hidden="true">
        <i data-scene-part="command-light" data-gsap-owned />
        <i data-scene-part="artifact-light" data-gsap-owned />
        <i data-scene-part="map-fog" data-gsap-owned />
      </div>
      <div className="command-object blank-page" data-scene-part="blank-page" data-gsap-owned aria-hidden="true">
        <i />
      </div>
      <div className="command-object seal-object" data-scene-part="seal" data-gsap-owned aria-hidden="true">
        <span>F</span>
        <svg viewBox="0 0 180 180">
          <path data-scene-part="seal-crack" d="M90 12l-8 53 23 18-34 16 15 68M24 88l57-23M105 83l50-20" />
          <path data-scene-part="seal-fragment" d="M24 88l57-23-10 34z" />
          <path data-scene-part="seal-fragment" d="M105 83l50-20-34 42z" />
        </svg>
      </div>
      <div className="command-object solved-stamp" data-scene-part="solved-stamp" data-gsap-owned aria-hidden="true">
        SOLVED
      </div>
      <div
        className="command-object artifact-object"
        data-scene-part="artifact-reveal"
        data-gsap-owned
        aria-hidden="true"
      >
        <img src="/illustrations/artifacts/compass-needle.svg" alt="" />
      </div>
      <div className="command-object artifact-slot-target" data-scene-part="artifact-slot-target" aria-hidden="true" />
      <svg className="command-map" viewBox="0 0 520 260" aria-hidden="true">
        <path data-scene-part="route-path" data-gsap-owned d="M30 210C160 35 330 40 490 190" />
        <path data-scene-part="artifact-connection-path" data-gsap-owned d="M80 100Q260 230 440 100" />
        <path data-scene-part="red-thread" data-gsap-owned d="M50 190C180 40 320 40 470 170" />
        <path data-scene-part="finale-light-path" data-gsap-owned d="M260 20L430 130 260 240 90 130z" />
      </svg>
      <div className="command-object marker" data-scene-part="map-marker-new" data-gsap-owned aria-hidden="true">
        ✦
      </div>
      <div className="command-object quest-note" data-scene-part="quest-note-new" data-gsap-owned aria-hidden="true">
        OPTIONAL COURSE
      </div>
      <div className="command-object quest-stamp" data-scene-part="quest-stamp" data-gsap-owned aria-hidden="true">
        COMPLETE
      </div>
      <div className="command-object log-line" data-scene-part="log-entry-new" data-gsap-owned aria-hidden="true">
        <i data-scene-part="log-symbol-new" data-gsap-owned>
          ✦
        </i>
      </div>
      <div className="command-object finale-rings" aria-hidden="true">
        <i data-scene-part="finale-ring-outer" data-gsap-owned />
        <i data-scene-part="finale-ring-inner" data-gsap-owned />
      </div>
      <div className="command-object lantern" data-scene-part="lantern" data-gsap-owned aria-hidden="true">
        <i />
      </div>
      <div className="command-object undo-mark" data-scene-part="undo-mark" data-gsap-owned aria-hidden="true">
        ↶
      </div>
      <div className="command-copy">
        <p className="eyebrow">{action[1]}</p>
        <h2>{label.replaceAll("-", " ")}</h2>
        <p>{descriptions[action[0]]}</p>
        <button onClick={skip}>Skip nonessential motion</button>
      </div>
    </motion.div>
  );
}
