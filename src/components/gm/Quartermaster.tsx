"use client";

/* eslint-disable @next/next/no-img-element -- The cabin's decorative SVG is an animation target, not content imagery. */

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { AnimationSceneName, PresentationOutcome } from "@/animation/core/animation-types";
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

type CommandResult = { event: { id: string; sequence: number } };

const QUARTERMASTER_HOST_ID = "quartermaster";
const QUARTERMASTER_HOST_KIND = "quartermaster";
const LEGACY_COMMAND_HOST = { hostId: "quartermaster-command", hostKind: "quartermaster-command" } as const;
const PROGRESSION_COMMAND_HOST = { hostId: "quartermaster-progression", hostKind: "progression" } as const;
const QUARTERMASTER_LOGIN_FALLBACK = "readable-quartermaster-result";
const completedPresentationOutcomes = new Set<PresentationOutcome>([
  "presented",
  "presented-fallback",
  "skipped-by-policy",
  "skipped-by-user",
]);

function isCommandResult(value: unknown): value is CommandResult {
  if (!value || typeof value !== "object" || !("event" in value)) return false;
  const event = value.event;
  return (
    !!event &&
    typeof event === "object" &&
    "id" in event &&
    typeof event.id === "string" &&
    "sequence" in event &&
    typeof event.sequence === "number"
  );
}

function safeServerError(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || !("error" in value) || typeof value.error !== "string") {
    return fallback;
  }
  const message = value.error.replace(/\s+/g, " ").trim();
  return message && message.length <= 180 ? message : fallback;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function presentationFailed(outcome: PresentationOutcome) {
  return !completedPresentationOutcomes.has(outcome);
}

function readablePresentationWarning(subject: "sign-in" | "order") {
  return subject === "sign-in"
    ? "Sign-in succeeded, but its entrance presentation could not be displayed."
    : "The order was recorded, but its presentation could not be displayed. The ledger result remains authoritative.";
}

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

const actionPresentationFallback: Record<Action[0], { fallback: string; semanticState: string }> = {
  PREPARE_CHAPTER: { fallback: "readable-command-result", semanticState: "chapter-prepared-readable" },
  RELEASE_CHAPTER: { fallback: "readable-command-result", semanticState: "chapter-command-recorded" },
  MARK_SOLVED: { fallback: "readable-chapter-solved", semanticState: "chapter-solved-readable" },
  AWARD_ARTIFACT: { fallback: "readable-artifact-award", semanticState: "artifact-awarded-readable" },
  REVEAL_MAP: { fallback: "readable-map-location", semanticState: "map-location-readable" },
  REVEAL_ROUTE: { fallback: "readable-route", semanticState: "route-readable" },
  REVEAL_ARTIFACT_SILHOUETTE: {
    fallback: "readable-artifact-award",
    semanticState: "artifact-awarded-readable",
  },
  CONNECT_ARTIFACTS: {
    fallback: "readable-artifact-connection",
    semanticState: "artifact-connection-readable",
  },
  DISCOVER_SIDE_QUEST: { fallback: "readable-quest-update", semanticState: "quest-readable" },
  UPDATE_SIDE_QUEST: { fallback: "readable-quest-update", semanticState: "quest-readable" },
  COMPLETE_SIDE_QUEST: { fallback: "readable-quest-complete", semanticState: "quest-complete-readable" },
  ADD_JOURNAL_ANNOTATION: { fallback: "readable-log-entry", semanticState: "log-entry-readable" },
  ADD_LOG_ENTRY: { fallback: "readable-log-entry", semanticState: "log-entry-readable" },
  TEASE_FINALE: { fallback: "readable-finale-tease", semanticState: "finale-tease-readable" },
  UPDATE_FINALE_REQUIREMENT: {
    fallback: "readable-finale-requirement",
    semanticState: "finale-requirement-readable",
  },
  UNDO_LAST: { fallback: "readable-state-restored", semanticState: "state-restored-readable" },
  PAUSE: { fallback: "readable-campaign-paused", semanticState: "campaign-paused-readable" },
  RESUME: { fallback: "readable-campaign-resumed", semanticState: "campaign-resumed-readable" },
};

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
  const [presentationWarning, setPresentationWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const presentationWarningTarget = useRef<HTMLParagraphElement>(null);
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/gm/status", { cache: "no-store", signal });
      if (!response.ok) return false;
      const nextStatus = (await response.json()) as Status;
      if (!mounted.current || signal?.aborted) return false;
      flushSync(() => {
        setStatus(nextStatus);
        setSignedIn(true);
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
      inFlight.current = null;
    };
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

  function publishPresentationWarning(warning: string) {
    if (!mounted.current) return false;
    flushSync(() => setPresentationWarning(warning));
    const rendered = presentationWarningTarget.current;
    return Boolean(
      rendered?.isConnected && rendered.getAttribute("role") === "status" && rendered.textContent?.includes(warning),
    );
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!root.current) return;
    setError("");
    setPresentationWarning("");
    const form = new FormData(event.currentTarget);
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    let operationStarted = false;
    let operationError = "";
    let authoritativeLoginSucceeded = false;
    let loginOperation: Promise<{ authenticated: true }> | null = null;
    let fallbackLoginResult: { authenticated: true } | undefined;
    const authenticate = () => {
      loginOperation ??= (async () => {
        operationStarted = true;
        const response = await fetch("/api/gm/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
          signal: controller.signal,
        });
        const data = await readJson(response);
        if (!response.ok) {
          operationError = safeServerError(data, "The lock refused the key.");
          throw new Error("authoritative-login-failed");
        }
        authoritativeLoginSucceeded = true;
        return { authenticated: true as const };
      })();
      return loginOperation;
    };
    try {
      const receipt = await director.play<{ authenticated: true }>("quartermaster-login", {
        root: root.current,
        hostId: QUARTERMASTER_HOST_ID,
        hostKind: QUARTERMASTER_HOST_KIND,
        requestSource: "operation",
        eventOrActionId: "quartermaster-login",
        queue: false,
        signal: controller.signal,
        operation: authenticate,
        presentationFallback: async (context) => {
          if (
            context.hostId !== QUARTERMASTER_HOST_ID ||
            context.hostKind !== QUARTERMASTER_HOST_KIND ||
            context.fallback !== QUARTERMASTER_LOGIN_FALLBACK ||
            context.signal?.aborted
          ) {
            return { completed: false, readable: false, reason: "quartermaster-login-fallback-rejected" };
          }
          try {
            fallbackLoginResult = await authenticate();
            const readable = publishPresentationWarning(
              "Sign-in succeeded. The entrance animation is unavailable; opening the chart room directly.",
            );
            return readable
              ? { completed: true, readable: true, semanticState: "quartermaster-result-readable" }
              : { completed: false, readable: false, reason: "quartermaster-login-fallback-not-readable" };
          } catch {
            return { completed: false, readable: false, reason: "quartermaster-login-fallback-operation-failed" };
          }
        },
      });

      if (!mounted.current || controller.signal.aborted) return;
      const loginResult = receipt.operationResult ?? fallbackLoginResult;
      if (loginResult?.authenticated !== true) {
        setError(
          operationError ||
            (operationStarted
              ? "The lock refused the key."
              : "Sign-in was not attempted because its presentation could not start."),
        );
        if (!operationStarted && presentationFailed(receipt.outcome)) {
          setPresentationWarning("The entrance presentation is unavailable. Sign-in was not recorded.");
        }
        return;
      }

      if (receipt.outcome === "presented-fallback" || presentationFailed(receipt.outcome)) {
        setPresentationWarning(readablePresentationWarning("sign-in"));
      }
      const refreshed = await refresh(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      if (!refreshed) setSignedIn(true);
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      if (authoritativeLoginSucceeded) {
        setPresentationWarning(readablePresentationWarning("sign-in"));
        const refreshed = await refresh(controller.signal);
        if (!refreshed && mounted.current) setSignedIn(true);
      } else {
        setError(operationError || "The lock refused the key.");
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }

  async function execute() {
    if (!selected || !status || !root.current) return;
    setBusy(true);
    setError("");
    setPresentationWarning("");
    const action = selected;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    let operationStarted = false;
    let operationError = "";
    let authoritativeResult: CommandResult | undefined;
    let commandOperation: Promise<CommandResult> | null = null;
    let fallbackOperationResult: CommandResult | undefined;
    const fallbackContract = actionPresentationFallback[action[0]];
    const commandHost =
      action[0] === "PREPARE_CHAPTER" || action[0] === "RELEASE_CHAPTER"
        ? LEGACY_COMMAND_HOST
        : PROGRESSION_COMMAND_HOST;
    const submitCommand = () => {
      commandOperation ??= (async () => {
        operationStarted = true;
        const response = await fetch("/api/gm/action", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
          body: JSON.stringify({ action: action[0], campaignSlug: status.campaign.slug, confirmation: true }),
          signal: controller.signal,
        });
        const body = await readJson(response);
        if (!response.ok || !isCommandResult(body)) {
          operationError = safeServerError(body, "The order could not be recorded.");
          throw new Error("authoritative-command-failed");
        }
        authoritativeResult = body;
        return body;
      })();
      return commandOperation;
    };
    flushSync(() => setActiveAction(action));
    try {
      const receipt = await director.play<CommandResult>(actionScene[action[0]], {
        root: root.current,
        hostId: commandHost.hostId,
        hostKind: commandHost.hostKind,
        requestSource: "operation",
        eventOrActionId: action[0],
        queue: false,
        signal: controller.signal,
        display: { actionLabel: action[1] },
        operation: submitCommand,
        presentationFallback: async (context) => {
          if (
            context.hostId !== commandHost.hostId ||
            context.hostKind !== commandHost.hostKind ||
            context.fallback !== fallbackContract.fallback ||
            context.signal?.aborted
          ) {
            return { completed: false, readable: false, reason: "quartermaster-command-fallback-rejected" };
          }
          try {
            fallbackOperationResult = await submitCommand();
            const readable = publishPresentationWarning(
              "The order was recorded. Its animation is unavailable; refreshing the ledger directly.",
            );
            return readable
              ? { completed: true, readable: true, semanticState: fallbackContract.semanticState }
              : { completed: false, readable: false, reason: "quartermaster-command-fallback-not-readable" };
          } catch {
            return { completed: false, readable: false, reason: "quartermaster-command-fallback-operation-failed" };
          }
        },
      });

      if (!mounted.current || controller.signal.aborted) return;
      const result = isCommandResult(receipt.operationResult)
        ? receipt.operationResult
        : isCommandResult(fallbackOperationResult)
          ? fallbackOperationResult
          : undefined;
      if (!result) {
        setError(
          operationError ||
            (operationStarted
              ? "The order could not be recorded."
              : "The order was not sent because its presentation could not start."),
        );
        if (!operationStarted && presentationFailed(receipt.outcome)) {
          setPresentationWarning("The command presentation is unavailable. No order was recorded.");
        }
        return;
      }

      const refreshed = await refresh(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setMessage(`Event ${result.event.id} recorded at sequence ${result.event.sequence}.`);
      setSelected(null);
      if (receipt.outcome === "presented-fallback" || presentationFailed(receipt.outcome)) {
        setPresentationWarning(readablePresentationWarning("order"));
      } else if (!refreshed) {
        setPresentationWarning("The order was recorded, but the latest ledger status could not be loaded.");
      }
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      if (authoritativeResult) {
        const refreshed = await refresh(controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        setMessage(`Event ${authoritativeResult.event.id} recorded at sequence ${authoritativeResult.event.sequence}.`);
        setSelected(null);
        setPresentationWarning(
          refreshed
            ? readablePresentationWarning("order")
            : "The order was recorded, but its presentation and latest ledger status could not be loaded.",
        );
      } else {
        setError(operationError || "The order could not be recorded.");
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (mounted.current) {
        setBusy(false);
        setActiveAction(null);
      }
    }
  }

  if (!signedIn) {
    return (
      <main
        ref={root}
        className={`quartermaster-login stage-${animation.label}`}
        data-motion-mode={mode}
        data-scene-host-id={QUARTERMASTER_HOST_ID}
        data-scene-host-kind={QUARTERMASTER_HOST_KIND}
      >
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
            {presentationWarning && (
              <p ref={presentationWarningTarget} className="gm-presentation-warning" role="status">
                {presentationWarning}
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
    <main
      ref={root}
      className={`quartermaster-shell stage-${animation.label}`}
      data-motion-mode={mode}
      data-scene-host-id={QUARTERMASTER_HOST_ID}
      data-scene-host-kind={QUARTERMASTER_HOST_KIND}
    >
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
      {presentationWarning && (
        <p ref={presentationWarningTarget} className="gm-presentation-warning" role="status">
          {presentationWarning}
          <button onClick={() => setPresentationWarning("")} aria-label="Dismiss presentation warning">
            ×
          </button>
        </p>
      )}
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
                  setPresentationWarning("");
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
