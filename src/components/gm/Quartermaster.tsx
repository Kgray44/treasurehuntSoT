"use client";

/* eslint-disable @next/next/no-img-element -- The cabin's decorative SVG is an animation target, not content imagery. */

import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type {
  AnimatedProperty,
  AnimationRuntimeOwner,
  AnimationSceneName,
  PresentationOutcome,
} from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { ExternalSceneTargetHandle, SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
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

type CommandResultBase = {
  correlationId: string;
  persistence: "COMMITTED";
  playerDelivery: "UNCONFIRMED";
  playerPresentation: "UNCONFIRMED";
  playerAcknowledgment: "UNCONFIRMED";
  idempotentReplay?: boolean;
};

type EventCommandResult = CommandResultBase & {
  kind: "PROGRESSION_EVENT";
  event: { id: string; type: string; sequence: number };
  playerEvent: { id: string; type: string; sequence: number };
  publication: "PROCESS_PUBLISHED" | "PROCESS_PUBLICATION_FAILED";
  delivery: "PUBLISHED" | "PUBLICATION_FAILED";
  deliveryScope: "PROCESS_SUBSCRIBERS_ONLY";
};

type StagedCommandResult = CommandResultBase & {
  kind: "STAGED_ACTION";
  event: null;
  playerEvent: null;
  preparedActionId: string;
  stagedAction: {
    preparedActionId: string;
    command: string;
    targetKey: string | null;
    reservedSequence: number;
    status: string;
    preparedAt: string;
  };
  publication: "NOT_APPLICABLE";
  delivery: "NOT_ATTEMPTED";
  deliveryScope: "NO_PLAYER_EVENT";
};

type CommandResult = EventCommandResult | StagedCommandResult;

const QUARTERMASTER_LOGIN_FALLBACK = "readable-quartermaster-result";
const completedPresentationOutcomes = new Set<PresentationOutcome>([
  "presented",
  "presented-fallback",
  "skipped-by-policy",
  "skipped-by-user",
]);

const dialogFocusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function dialogFocusables(dialog: HTMLElement | null) {
  return Array.from(dialog?.querySelectorAll<HTMLElement>(dialogFocusableSelector) ?? []).filter(
    (candidate) => !candidate.hasAttribute("hidden") && candidate.getAttribute("aria-hidden") !== "true",
  );
}

function isCommandResult(value: unknown): value is CommandResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (
    typeof result.correlationId !== "string" ||
    result.persistence !== "COMMITTED" ||
    result.playerDelivery !== "UNCONFIRMED" ||
    result.playerPresentation !== "UNCONFIRMED" ||
    result.playerAcknowledgment !== "UNCONFIRMED"
  )
    return false;
  if (result.kind === "PROGRESSION_EVENT") {
    const event = result.event as Record<string, unknown> | null;
    const playerEvent = result.playerEvent as Record<string, unknown> | null;
    return (
      !!event &&
      !!playerEvent &&
      typeof event.id === "string" &&
      typeof event.type === "string" &&
      typeof event.sequence === "number" &&
      playerEvent.id === event.id &&
      playerEvent.type === event.type &&
      playerEvent.sequence === event.sequence &&
      ((result.publication === "PROCESS_PUBLISHED" && result.delivery === "PUBLISHED") ||
        (result.publication === "PROCESS_PUBLICATION_FAILED" && result.delivery === "PUBLICATION_FAILED")) &&
      result.deliveryScope === "PROCESS_SUBSCRIBERS_ONLY"
    );
  }
  if (result.kind === "STAGED_ACTION") {
    const staged = result.stagedAction as Record<string, unknown> | null;
    return (
      result.event === null &&
      result.playerEvent === null &&
      typeof result.preparedActionId === "string" &&
      !!staged &&
      staged.preparedActionId === result.preparedActionId &&
      typeof staged.command === "string" &&
      (staged.targetKey === null || typeof staged.targetKey === "string") &&
      typeof staged.reservedSequence === "number" &&
      typeof staged.status === "string" &&
      typeof staged.preparedAt === "string" &&
      result.publication === "NOT_APPLICABLE" &&
      result.delivery === "NOT_ATTEMPTED" &&
      result.deliveryScope === "NO_PLAYER_EVENT"
    );
  }
  return false;
}

function receiptTruth(result: CommandResult) {
  const publication =
    result.publication === "PROCESS_PUBLISHED"
      ? "The event was published to this server's live subscribers."
      : result.publication === "PROCESS_PUBLICATION_FAILED"
        ? "The action was saved, but this server could not confirm live delivery."
        : "This prepared action does not send a Crew event.";
  return `${publication} Crew delivery, presentation, and acknowledgment remain unconfirmed. Reference ${result.correlationId}.`;
}

function receiptMessage(result: CommandResult) {
  return result.kind === "STAGED_ACTION"
    ? `Prepared action saved at sequence ${result.stagedAction.reservedSequence}.`
    : `Voyage event saved at sequence ${result.event.sequence}.`;
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
    : "The Voyage action was saved, but its presentation could not be displayed. The saved result remains authoritative.";
}

const actions = [
  [
    "PREPARE_CHAPTER",
    "Prepare Chapter",
    "Make this Chapter ready for later release. The Crew cannot see its content yet.",
  ],
  ["RELEASE_CHAPTER", "Release Chapter", "Make this Chapter available to the Crew and begin its presentation."],
  ["MARK_SOLVED", "Mark Chapter solved", "Record that the active Chapter has been solved."],
  ["AWARD_ARTIFACT", "Award test Artifact", "Add the Broken Compass Needle to the Crew's Artifact collection."],
  ["REVEAL_MAP", "Reveal test Waypoint", "Mark Port Merrick on the Voyage chart."],
  ["REVEAL_ROUTE", "Reveal route segment", "Reveal the next safe development route between Waypoints."],
  ["REVEAL_ARTIFACT_SILHOUETTE", "Reveal Artifact silhouette", "Show only the next Artifact's approved safe outline."],
  ["CONNECT_ARTIFACTS", "Connect test Artifacts", "Reveal the development connection between configured Artifacts."],
  ["DISCOVER_SIDE_QUEST", "Discover Echo", "Make the next optional Echo available to the Crew."],
  ["UPDATE_SIDE_QUEST", "Update Echo", "Advance one released Echo objective."],
  ["COMPLETE_SIDE_QUEST", "Complete Echo", "Complete the active Echo and grant its configured reward."],
  ["ADD_JOURNAL_ANNOTATION", "Add journal annotation", "Release a development note beside the active Chapter."],
  ["ADD_LOG_ENTRY", "Add Crew log entry", "Record a generic Crew-facing Captain note."],
  ["TEASE_FINALE", "Preview sealed finale", "Prepare the finale shell without releasing finale content."],
  ["UPDATE_FINALE_REQUIREMENT", "Update finale requirement", "Advance one configured finale requirement."],
  [
    "UNDO_LAST",
    "Restore prior progression state",
    "Restore the prior saved progression state and publish a reconciliation event for the Crew.",
  ],
  ["PAUSE", "Pause Voyage", "Pause progression without hiding material already released to the Crew."],
  ["RESUME", "Resume Voyage", "Return this Voyage to active progression."],
] as const;

type Action = (typeof actions)[number];

function commandPreflight(action: Action, status: Status) {
  const previous = status.events[0];
  const campaignTarget = `${status.campaign.title} at Voyage record sequence ${status.campaign.sequence}`;
  switch (action[0]) {
    case "PREPARE_CHAPTER":
    case "RELEASE_CHAPTER":
    case "MARK_SOLVED":
      return {
        target: `Chapter ${status.chapter.ordinal}: ${status.chapter.title}`,
        current: status.chapter.state,
        consequence: action[2],
      };
    case "UNDO_LAST":
      return {
        target: previous
          ? `${previous.type.replaceAll("_", " ")} at sequence ${previous.sequence}`
          : "No previous Voyage event",
        current: campaignTarget,
        consequence: previous
          ? `Restore the persisted state immediately before event ${previous.id}.`
          : "No undo target is currently available.",
      };
    case "PAUSE":
    case "RESUME":
      return { target: campaignTarget, current: status.campaign.status, consequence: action[2] };
    default:
      return {
        target: `${status.campaign.title} / ${status.chapter.title}`,
        current: `Voyage record sequence ${status.campaign.sequence}`,
        consequence: action[2],
      };
  }
}

type ActiveCommand = Readonly<{ action: Action; operationKey: string }>;
type CommandRuntime = Readonly<{
  operationKey: string;
  host: SceneHostHandle;
  root: HTMLElement;
  externalTargets: Readonly<Record<string, ExternalSceneTargetHandle>>;
}>;
type CommandTargetSpec = Readonly<{
  key: string;
  part: string;
  properties: readonly AnimatedProperty[];
  ownerHint?: AnimationRuntimeOwner;
  externalKey?: string;
  visual: "div" | "i" | "path";
  className?: string;
}>;

const commandTarget = (
  key: string,
  part: string,
  properties: readonly AnimatedProperty[],
  visual: CommandTargetSpec["visual"] = "div",
  options: Pick<CommandTargetSpec, "ownerHint" | "externalKey" | "className"> = {},
): CommandTargetSpec => ({ key, part, properties, visual, ownerHint: "gsap", ...options });

const workspaceLight = commandTarget("workspace-light", "workspace-light", ["opacity"], "i");
const commandLight = commandTarget("command-light", "command-light", ["opacity"], "i");

const commandTargetSpecs: Record<Action[0], readonly CommandTargetSpec[]> = {
  PREPARE_CHAPTER: [
    commandTarget("blank-page", "blank-page", ["transform", "opacity"], "div", { className: "blank-page" }),
    commandLight,
  ],
  RELEASE_CHAPTER: [
    commandTarget("seal", "seal", ["transform"], "div", { className: "seal-object" }),
    commandTarget("seal-crack", "seal-crack", ["stroke-dasharray", "stroke-dashoffset"], "path"),
    commandTarget("seal-fragment-left", "seal-fragment", ["transform", "opacity"], "path"),
    commandTarget("seal-fragment-right", "seal-fragment", ["transform", "opacity"], "path"),
    workspaceLight,
  ],
  MARK_SOLVED: [
    commandTarget("solved-stamp", "solved-stamp", ["transform", "opacity"], "div", { className: "solved-stamp" }),
    commandLight,
  ],
  AWARD_ARTIFACT: [
    commandTarget("artifact-reveal", "artifact-reveal", ["transform", "opacity"], "div", {
      className: "artifact-object",
    }),
    commandTarget("artifact-slot", "artifact-slot-target", ["layout"], "div", {
      ownerHint: "motion",
      externalKey: "artifact-slot",
      className: "artifact-slot-target",
    }),
    commandTarget("artifact-light", "artifact-light", ["transform", "opacity"], "i"),
    workspaceLight,
  ],
  REVEAL_MAP: [
    commandTarget("map-marker", "map-marker", ["transform", "opacity"], "div", {
      externalKey: "map-marker",
      className: "marker",
    }),
    commandTarget("map-fog", "map-fog", ["clip-path", "opacity"], "div", { externalKey: "map-fog" }),
    commandTarget("route-path", "route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], "path", {
      externalKey: "route-path",
    }),
    workspaceLight,
  ],
  REVEAL_ROUTE: [
    commandTarget(
      "route-path",
      "route-path",
      ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"],
      "path",
      { externalKey: "route-path" },
    ),
    workspaceLight,
  ],
  REVEAL_ARTIFACT_SILHOUETTE: [
    commandTarget("artifact-reveal", "artifact-reveal", ["transform", "opacity"], "div", {
      className: "artifact-object",
    }),
    commandTarget("artifact-slot", "artifact-slot-target", ["layout"], "div", {
      ownerHint: "motion",
      externalKey: "artifact-slot",
      className: "artifact-slot-target",
    }),
    commandTarget("artifact-light", "artifact-light", ["transform", "opacity"], "i"),
    workspaceLight,
  ],
  CONNECT_ARTIFACTS: [
    commandTarget(
      "artifact-connection-path",
      "artifact-connection-path",
      ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"],
      "path",
      { externalKey: "artifact-connection-path" },
    ),
    workspaceLight,
  ],
  DISCOVER_SIDE_QUEST: [
    commandTarget("quest-note", "quest-note-new", ["transform", "opacity"], "div", {
      externalKey: "quest-note",
      className: "quest-note",
    }),
    commandTarget("quest-red-thread", "red-thread", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], "path", {
      externalKey: "quest-red-thread",
    }),
    workspaceLight,
  ],
  UPDATE_SIDE_QUEST: [
    commandTarget("quest-note", "quest-note-new", ["transform", "opacity"], "div", {
      externalKey: "quest-note",
      className: "quest-note",
    }),
    commandTarget("quest-red-thread", "red-thread", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], "path", {
      externalKey: "quest-red-thread",
    }),
    workspaceLight,
  ],
  COMPLETE_SIDE_QUEST: [
    commandTarget("quest-stamp", "quest-stamp", ["transform", "opacity"], "div", {
      externalKey: "quest-stamp",
      className: "quest-stamp",
    }),
    workspaceLight,
  ],
  ADD_JOURNAL_ANNOTATION: [
    commandTarget("log-entry", "log-entry-new", ["opacity", "clip-path", "filter"], "div", {
      externalKey: "log-entry",
      className: "log-line",
    }),
    commandTarget("log-symbol", "log-symbol-new", ["transform", "opacity"], "i", {
      externalKey: "log-symbol",
    }),
    workspaceLight,
  ],
  ADD_LOG_ENTRY: [
    commandTarget("log-entry", "log-entry-new", ["opacity", "clip-path", "filter"], "div", {
      externalKey: "log-entry",
      className: "log-line",
    }),
    commandTarget("log-symbol", "log-symbol-new", ["transform", "opacity"], "i", {
      externalKey: "log-symbol",
    }),
    workspaceLight,
  ],
  TEASE_FINALE: [
    commandTarget("finale-ring-outer", "finale-ring-outer", ["transform"], "i", {
      externalKey: "finale-ring-outer",
    }),
    commandTarget("finale-ring-inner", "finale-ring-inner", ["transform"], "i", {
      externalKey: "finale-ring-inner",
    }),
    commandTarget(
      "finale-light-path",
      "finale-light-path",
      ["path-drawing", "stroke-dasharray", "stroke-dashoffset"],
      "path",
      {
        externalKey: "finale-light-path",
      },
    ),
    workspaceLight,
  ],
  UPDATE_FINALE_REQUIREMENT: [
    commandTarget(
      "finale-light-path",
      "finale-light-path",
      ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"],
      "path",
      { externalKey: "finale-light-path" },
    ),
    workspaceLight,
  ],
  UNDO_LAST: [
    commandTarget("undo-mark", "undo-mark", ["transform", "opacity"], "div", { className: "undo-mark" }),
    commandLight,
  ],
  PAUSE: [commandTarget("lantern", "lantern", ["transform", "opacity"], "div", { className: "lantern" }), commandLight],
  RESUME: [
    commandTarget("lantern", "lantern", ["transform", "opacity"], "div", { className: "lantern" }),
    commandLight,
  ],
};

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

const commandPathData: Record<string, string> = {
  "seal-crack": "M90 12l-8 53 23 18-34 16 15 68M24 88l57-23M105 83l50-20",
  "seal-fragment-left": "M24 88l57-23-10 34z",
  "seal-fragment-right": "M105 83l50-20-34 42z",
  "route-path": "M30 210C160 35 330 40 490 190",
  "artifact-connection-path": "M80 100Q260 230 440 100",
  "quest-red-thread": "M50 190C180 40 320 40 470 170",
  "finale-light-path": "M260 20L430 130 260 240 90 130z",
};

type CommandTargetNodeProps = Readonly<{
  operationKey: string;
  spec: CommandTargetSpec;
  legacyPart: boolean;
  onHandle: (key: string, handle: SceneTargetHandle | null) => void;
}>;

function RegisteredCommandTargetNode({ operationKey, spec, legacyPart, onHandle }: CommandTargetNodeProps) {
  const registration = useMemo(
    () => ({
      targetKey: `${operationKey}:${spec.key}`,
      part: spec.part,
      ownerHint: spec.ownerHint ?? "gsap",
      allowedProperties: spec.properties,
    }),
    [operationKey, spec],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(registration);
  useLayoutEffect(() => {
    onHandle(spec.key, handle);
    return () => onHandle(spec.key, null);
  }, [handle, onHandle, spec.key]);

  if (spec.visual === "path") {
    return (
      <path
        ref={bindTarget}
        data-command-cinematic-part={spec.part}
        data-runtime-boundary="gsap"
        data-scene-part={legacyPart ? spec.part : undefined}
        d={commandPathData[spec.key] ?? "M0 0"}
      />
    );
  }
  const common = {
    ref: bindTarget,
    className: `command-object ${spec.className ?? ""}`.trim(),
    "data-command-cinematic-part": spec.part,
    "data-runtime-boundary": "gsap",
    "data-scene-part": legacyPart ? spec.part : undefined,
  };
  const content =
    spec.part === "artifact-reveal" ? (
      <img src="/illustrations/artifacts/compass-needle.svg" alt="" />
    ) : spec.part === "solved-stamp" ? (
      "SOLVED"
    ) : spec.part === "quest-note-new" ? (
      "OPTIONAL COURSE"
    ) : spec.part === "quest-stamp" ? (
      "COMPLETE"
    ) : spec.part === "undo-mark" ? (
      "↶"
    ) : spec.part === "lantern" ? (
      <i />
    ) : null;
  return spec.visual === "i" ? <i {...common}>{content}</i> : <div {...common}>{content}</div>;
}

function MotionCommandTargetNode({ operationKey, spec, legacyPart, onHandle }: CommandTargetNodeProps) {
  const registration = useMemo(
    () => ({
      targetKey: `${operationKey}:${spec.key}`,
      part: spec.part,
      runtime: "motion" as const,
      allowedProperties: spec.properties,
      properties: spec.properties,
    }),
    [operationKey, spec],
  );
  const { bindTarget, handle, ownershipReady } = useRuntimeOwnedSceneTarget(registration);
  const bindMotionTarget = useCallback((node: HTMLDivElement | null) => bindTarget(node), [bindTarget]);
  useLayoutEffect(() => {
    onHandle(spec.key, handle);
    return () => onHandle(spec.key, null);
  }, [handle, onHandle, spec.key]);

  return (
    <motion.div
      ref={bindMotionTarget}
      {...(ownershipReady && spec.properties.includes("layout") ? { layout: true } : {})}
      className={`command-object ${spec.className ?? ""}`.trim()}
      data-command-cinematic-part={spec.part}
      data-runtime-boundary="motion"
      data-runtime-lease={ownershipReady ? "ready" : "gated"}
      data-scene-part={legacyPart ? spec.part : undefined}
    />
  );
}

function CommandTargetNode(props: CommandTargetNodeProps) {
  return props.spec.ownerHint === "motion" ? (
    <MotionCommandTargetNode {...props} />
  ) : (
    <RegisteredCommandTargetNode {...props} />
  );
}

function CommandHostContent({
  action,
  operationKey,
  onReady,
}: {
  action: Action;
  operationKey: string;
  onReady: (runtime: CommandRuntime) => void;
}) {
  const host = useOptionalSceneHost();
  const sentinel = useRef<HTMLSpanElement>(null);
  const specs = commandTargetSpecs[action[0]];
  const [handles, setHandles] = useState<Readonly<Record<string, SceneTargetHandle>>>({});
  const captureHandle = useCallback((key: string, handle: SceneTargetHandle | null) => {
    setHandles((current) => {
      if (handle && current[key] === handle) return current;
      if (!handle && !(key in current)) return current;
      const next = { ...current };
      if (handle) next[key] = handle;
      else delete next[key];
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const root = sentinel.current?.parentElement;
    if (!host || !root || specs.some((spec) => !handles[spec.key])) return;
    const externalTargets: Record<string, ExternalSceneTargetHandle> = {};
    for (const spec of specs) {
      if (!spec.externalKey) continue;
      externalTargets[spec.externalKey] = host.exportTarget({
        target: handles[spec.key],
        destinationHostId: host.hostId,
        allowedProperties: spec.properties,
        lifetime: "handoff",
      });
    }
    onReady(Object.freeze({ operationKey, host, root, externalTargets: Object.freeze(externalTargets) }));
    return () => Object.values(externalTargets).forEach((handle) => handle.revoke());
  }, [handles, host, onReady, operationKey, specs]);

  const paths = specs.filter((spec) => spec.visual === "path");
  const elements = specs.filter((spec) => spec.visual !== "path");
  const legacyPart = action[0] === "PREPARE_CHAPTER" || action[0] === "RELEASE_CHAPTER";
  return (
    <>
      <span ref={sentinel} hidden />
      {elements.map((spec) => (
        <CommandTargetNode
          key={spec.key}
          operationKey={operationKey}
          spec={spec}
          legacyPart={legacyPart}
          onHandle={captureHandle}
        />
      ))}
      {paths.length > 0 && (
        <svg className="command-map" viewBox="0 0 520 260">
          {paths.map((spec) => (
            <CommandTargetNode
              key={spec.key}
              operationKey={operationKey}
              spec={spec}
              legacyPart={legacyPart}
              onHandle={captureHandle}
            />
          ))}
        </svg>
      )}
    </>
  );
}

const loginTargetProperties = {
  lock: ["transform"],
  "door-bolt": ["transform"],
  "cabin-door": ["transform"],
  "login-ledger": ["transform"],
  "chart-room-light": ["opacity"],
  lantern: ["transform", "opacity"],
} as const satisfies Readonly<Record<string, readonly AnimatedProperty[]>>;

function LoginTarget({
  as = "div",
  part,
  targetKey,
  className,
  children,
}: {
  as?: "div" | "i";
  part: keyof typeof loginTargetProperties;
  targetKey: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const registration = useMemo(
    () => ({ targetKey, part, ownerHint: "gsap" as const, allowedProperties: loginTargetProperties[part] }),
    [part, targetKey],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return createElement(
    as,
    {
      ref: bindTarget,
      className,
      "data-login-cinematic-part": part,
      "data-runtime-boundary": "gsap",
      // The bounded v1 compatibility adapter still resolves this legacy scene by part.
      "data-scene-part": part,
    },
    children,
  );
}

function QuartermasterLoginHost({
  mode,
  onReady,
}: {
  mode: ReturnType<typeof useMotionMode>["mode"];
  onReady: (runtime: Readonly<{ host: SceneHostHandle; root: HTMLElement }>) => void;
}) {
  const host = useOptionalSceneHost();
  const sentinel = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = sentinel.current?.parentElement;
    if (host && root) onReady(Object.freeze({ host, root }));
  }, [host, onReady]);
  return (
    <>
      <span ref={sentinel} hidden />
      <LoginTarget
        part="chart-room-light"
        targetKey="quartermaster-login:chart-room-light"
        className="chart-room-light"
      />
      <LoginTarget part="cabin-door" targetKey="quartermaster-login:cabin-door" className="cabin-door">
        <span>Captain’s Console access</span>
        <LoginTarget as="i" part="door-bolt" targetKey="quartermaster-login:door-bolt" />
        <LoginTarget part="lock" targetKey="quartermaster-login:lock" className="door-keyhole">
          <RiveStatefulObject asset={riveAssets.invitationSeal} mode={mode} label="Captain's Console door lock" />
        </LoginTarget>
      </LoginTarget>
      <LoginTarget part="lantern" targetKey="quartermaster-login:lantern" className="login-lantern">
        <i />
        <b />
      </LoginTarget>
      <LoginTarget part="login-ledger" targetKey="quartermaster-login:ledger" className="login-ledger-cinematic" />
    </>
  );
}

export function Quartermaster({ authenticated }: { authenticated: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [signedIn, setSignedIn] = useState(authenticated);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<Action | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveCommand | null>(null);
  const [message, setMessage] = useState("");
  const [commandTruth, setCommandTruth] = useState("");
  const [presentationWarning, setPresentationWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const loginRuntime = useRef<Readonly<{ host: SceneHostHandle; root: HTMLElement }> | null>(null);
  const commandRuntime = useRef<CommandRuntime | null>(null);
  const commandSequence = useRef(0);
  const commandTrigger = useRef<HTMLButtonElement | null>(null);
  const confirmationIdempotencyKey = useRef("");
  const confirmAction = useRef<HTMLButtonElement | null>(null);
  const confirmationDialog = useRef<HTMLElement | null>(null);
  const loginInput = useRef<HTMLInputElement | null>(null);
  const busyState = useRef(busy);
  const commandWaiter = useRef<{
    operationKey: string;
    resolve: (runtime: CommandRuntime) => void;
    reject: (reason: Error) => void;
  } | null>(null);
  const presentationWarningTarget = useRef<HTMLParagraphElement>(null);
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();
  busyState.current = busy;

  const handleCommandRuntimeReady = useCallback((runtime: CommandRuntime) => {
    commandRuntime.current = runtime;
    const waiter = commandWaiter.current;
    if (waiter?.operationKey !== runtime.operationKey) return;
    commandWaiter.current = null;
    waiter.resolve(runtime);
  }, []);

  const handleLoginRuntimeReady = useCallback((runtime: Readonly<{ host: SceneHostHandle; root: HTMLElement }>) => {
    loginRuntime.current = runtime;
  }, []);

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
      commandWaiter.current?.reject(new Error("quartermaster-unmounted"));
      commandWaiter.current = null;
      commandRuntime.current = null;
      loginRuntime.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const dialog = confirmationDialog.current;
    const restoreTarget = commandTrigger.current;
    const focusInitial = () => {
      if (!dialog?.isConnected) return;
      const preferred = confirmAction.current;
      const target = preferred && !preferred.disabled ? preferred : (dialogFocusables(dialog)[0] ?? dialog);
      target.focus();
    };
    focusInitial();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busyState.current) return;
        event.preventDefault();
        event.stopPropagation();
        closeConfirmation();
        return;
      }
      if (event.key !== "Tab" || !dialog?.isConnected) return;
      const controls = dialogFocusables(dialog);
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1)!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!dialog?.isConnected || dialog.contains(event.target as Node)) return;
      focusInitial();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      if (!restoreTarget?.isConnected) return;
      window.requestAnimationFrame(() => {
        if (restoreTarget.isConnected) restoreTarget.focus();
      });
    };
  }, [selected]);

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

  function closeConfirmation() {
    confirmationIdempotencyKey.current = "";
    setSelected(null);
  }

  function restoreLoginFailure(controller: AbortController, message: string, warning = "") {
    if (!mounted.current || controller.signal.aborted || inFlight.current !== controller) return;
    inFlight.current = null;
    setBusy(false);
    setError(message);
    setPresentationWarning(warning);
    window.requestAnimationFrame(() => loginInput.current?.focus());
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const runtime = loginRuntime.current;
    if (!runtime || inFlight.current) return;
    setBusy(true);
    setError("");
    setPresentationWarning("");
    const form = new FormData(event.currentTarget);
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
          operationError = safeServerError(
            data,
            "We couldn't sign you in. Check the Captain name and passphrase, then try again.",
          );
          throw new Error("authoritative-login-failed");
        }
        authoritativeLoginSucceeded = true;
        return { authenticated: true as const };
      })();
      return loginOperation;
    };
    try {
      const receipt = await director.play<{ authenticated: true }>("quartermaster-login", {
        root: runtime.root,
        hostId: runtime.host.hostId,
        hostKind: runtime.host.kind,
        sceneHost: runtime.host,
        requestSource: "operation",
        eventOrActionId: "quartermaster-login",
        queue: false,
        signal: controller.signal,
        operation: authenticate,
        finalStateRuntime: {
          holdSafePose: (semanticState) => {
            if (semanticState !== "quartermaster-result-readable" || controller.signal.aborted) return;
            publishPresentationWarning("Sign-in accepted. Opening Captain's Console.");
          },
          verifyReadableState: (semanticState) =>
            semanticState === "quartermaster-result-readable" &&
            presentationWarningTarget.current?.getAttribute("role") === "status" &&
            presentationWarningTarget.current?.textContent?.includes("Sign-in accepted") === true,
        },
        presentationFallback: async (context) => {
          if (
            context.hostId !== runtime.host.hostId ||
            context.hostKind !== runtime.host.kind ||
            context.fallback !== QUARTERMASTER_LOGIN_FALLBACK ||
            context.signal?.aborted
          ) {
            return { completed: false, readable: false, reason: "quartermaster-login-fallback-rejected" };
          }
          try {
            fallbackLoginResult = await authenticate();
            const readable = publishPresentationWarning(
              "Sign-in succeeded. The entrance presentation is unavailable; opening Captain's Console directly.",
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
        restoreLoginFailure(
          controller,
          operationError ||
            (operationStarted
              ? "We couldn't sign you in. Check the Captain name and passphrase, then try again."
              : "Sign-in was not attempted because its presentation could not start."),
          !operationStarted && presentationFailed(receipt.outcome)
            ? "The entrance presentation is unavailable. Sign-in was not recorded."
            : "",
        );
        return;
      }

      if (receipt.outcome === "presented-fallback" || presentationFailed(receipt.outcome)) {
        setPresentationWarning(readablePresentationWarning("sign-in"));
      } else {
        publishPresentationWarning("Sign-in accepted. Opening Captain's Console.");
      }
      const refreshed = await refresh(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      if (!refreshed) {
        restoreLoginFailure(
          controller,
          "Sign-in succeeded, but Captain's Console could not be opened. Please try again.",
          readablePresentationWarning("sign-in"),
        );
      }
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      if (authoritativeLoginSucceeded) {
        setPresentationWarning(readablePresentationWarning("sign-in"));
        const refreshed = await refresh(controller.signal);
        if (!refreshed && mounted.current) {
          restoreLoginFailure(
            controller,
            "Sign-in succeeded, but Captain's Console could not be opened. Please try again.",
            readablePresentationWarning("sign-in"),
          );
        }
      } else {
        restoreLoginFailure(
          controller,
          operationError || "We couldn't sign you in. Check the Captain name and passphrase, then try again.",
        );
      }
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }

  async function execute() {
    if (!selected || !status || inFlight.current) return;
    setBusy(true);
    setError("");
    setPresentationWarning("");
    setCommandTruth("");
    const action = selected;
    const idempotencyKey = confirmationIdempotencyKey.current;
    if (!idempotencyKey) {
      setBusy(false);
      setError("This confirmation expired. Close it and review the Voyage action again.");
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    commandSequence.current += 1;
    const operationKey = `quartermaster:${action[0].toLowerCase()}:${commandSequence.current}`;
    commandRuntime.current = null;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let abortWait: (() => void) | undefined;
    const runtimePromise = new Promise<CommandRuntime>((resolve, reject) => {
      const rejectWait = (reason: Error) => {
        if (commandWaiter.current?.operationKey === operationKey) commandWaiter.current = null;
        reject(reason);
      };
      commandWaiter.current = { operationKey, resolve, reject: rejectWait };
      waitTimer = setTimeout(() => rejectWait(new Error("quartermaster-command-host-timeout")), 1_500);
      abortWait = () => rejectWait(new Error("quartermaster-command-host-aborted"));
      controller.signal.addEventListener("abort", abortWait, { once: true });
    });
    let operationStarted = false;
    let operationError = "";
    let authoritativeResult: CommandResult | undefined;
    let commandOperation: Promise<CommandResult> | null = null;
    let fallbackOperationResult: CommandResult | undefined;
    const fallbackContract = actionPresentationFallback[action[0]];
    const submitCommand = () => {
      commandOperation ??= (async () => {
        operationStarted = true;
        const response = await fetch("/api/gm/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": status.csrfToken },
          body: JSON.stringify({
            command: action[0],
            campaignSlug: status.campaign.slug,
            expectedSequence: status.campaign.sequence,
            idempotencyKey,
            payload: {},
            confirmation: true,
          }),
          signal: controller.signal,
        });
        const body = await readJson(response);
        if (!response.ok || !isCommandResult(body)) {
          operationError = safeServerError(body, "The Voyage action could not be recorded. No progress has changed.");
          throw new Error("authoritative-command-failed");
        }
        authoritativeResult = body;
        return body;
      })();
      return commandOperation;
    };
    flushSync(() => setActiveAction({ action, operationKey }));
    try {
      const runtime = await runtimePromise;
      if (!mounted.current || controller.signal.aborted || runtime.operationKey !== operationKey) return;
      const receipt = await director.play<CommandResult>(actionScene[action[0]], {
        root: runtime.root,
        hostId: runtime.host.hostId,
        hostKind: runtime.host.kind,
        sceneHost: runtime.host,
        externalTargets: runtime.externalTargets,
        requestSource: "operation",
        eventOrActionId: action[0],
        queue: false,
        signal: controller.signal,
        display: { actionLabel: action[1] },
        operation: submitCommand,
        finalStateRuntime: {
          holdSafePose: (semanticState) => {
            if (semanticState !== fallbackContract.semanticState || controller.signal.aborted) return;
            publishPresentationWarning("The Voyage action was saved. Updating the Voyage record.");
          },
          reconcileFinalState: (semanticState) => {
            if (semanticState !== fallbackContract.semanticState || controller.signal.aborted) return;
            publishPresentationWarning("The Voyage action was saved. Updating the Voyage record.");
          },
          verifyReadableState: (semanticState) =>
            semanticState === fallbackContract.semanticState &&
            presentationWarningTarget.current?.getAttribute("role") === "status" &&
            presentationWarningTarget.current?.textContent?.includes("The Voyage action was saved") === true,
        },
        presentationFallback: async (context) => {
          if (
            context.hostId !== runtime.host.hostId ||
            context.hostKind !== runtime.host.kind ||
            context.fallback !== fallbackContract.fallback ||
            context.signal?.aborted
          ) {
            return { completed: false, readable: false, reason: "quartermaster-command-fallback-rejected" };
          }
          try {
            fallbackOperationResult = await submitCommand();
            const readable = publishPresentationWarning(
              "The Voyage action was saved. Its presentation is unavailable; refreshing the Voyage record directly.",
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
              ? "The Voyage action could not be recorded. No progress has changed."
              : "The Voyage action was not sent because its presentation could not start."),
        );
        if (!operationStarted && presentationFailed(receipt.outcome)) {
          setPresentationWarning("The Voyage action presentation is unavailable. No action was recorded.");
        }
        return;
      }

      const refreshed = await refresh(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setMessage(receiptMessage(result));
      setCommandTruth(receiptTruth(result));
      closeConfirmation();
      if (receipt.outcome === "presented-fallback" || presentationFailed(receipt.outcome)) {
        setPresentationWarning(readablePresentationWarning("order"));
      } else if (!refreshed) {
        setPresentationWarning("The Voyage action was saved, but the latest Voyage record could not be loaded.");
      } else {
        setPresentationWarning("");
      }
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      if (authoritativeResult) {
        const refreshed = await refresh(controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        setMessage(receiptMessage(authoritativeResult));
        setCommandTruth(receiptTruth(authoritativeResult));
        closeConfirmation();
        setPresentationWarning(
          refreshed
            ? readablePresentationWarning("order")
            : "The Voyage action was saved, but its presentation and latest Voyage record could not be loaded.",
        );
      } else {
        setError(
          operationError ||
            (operationStarted
              ? "The Voyage action could not be recorded. No progress has changed."
              : "The Voyage action presentation could not be prepared."),
        );
      }
    } finally {
      if (waitTimer !== undefined) clearTimeout(waitTimer);
      if (abortWait) controller.signal.removeEventListener("abort", abortWait);
      if (commandWaiter.current?.operationKey === operationKey) commandWaiter.current = null;
      if (inFlight.current === controller) inFlight.current = null;
      if (mounted.current) {
        setBusy(false);
        setActiveAction((current) => (current?.operationKey === operationKey ? null : current));
      }
    }
  }

  if (!signedIn) {
    return (
      <main ref={root} className={`quartermaster-login stage-${animation.label}`} data-motion-mode={mode}>
        <SceneHost
          kind="access"
          hostKey="quartermaster-login"
          className="quartermaster-login-cinematic-boundary"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        >
          <QuartermasterLoginHost mode={mode} onReady={handleLoginRuntimeReady} />
        </SceneHost>
        <LottieEffect
          asset={lottieAssets.rollingFog}
          mode={mode}
          label="Dust and lantern haze at the chart-room entrance"
          className="login-door-dust"
        />
        <section className="login-ledger">
          <p className="eyebrow">Restricted Captain’s Console</p>
          <h1>Captain’s Console</h1>
          <p>Captain, sign in before changing Voyage progress.</p>
          <form onSubmit={login} aria-busy={busy} aria-describedby={error ? "quartermaster-login-error" : undefined}>
            <label>
              Captain name
              <input ref={loginInput} name="username" autoComplete="username" required />
            </label>
            <label>
              Passphrase
              <input name="password" type="password" autoComplete="current-password" required minLength={8} />
            </label>
            <motion.button
              className="brass-button"
              disabled={busy || animation.isPlaying}
              aria-busy={busy}
              {...pressable(mode)}
            >
              {busy || animation.isPlaying ? "Signing in..." : "Sign in to Captain's Console"}
            </motion.button>
            {error && (
              <p id="quartermaster-login-error" className="form-error" role="alert">
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
          <button onClick={cycle} aria-label={`Motion setting: ${mode}. Change motion setting`}>
            {mode} motion
          </button>
          {animation.isPlaying && <button onClick={() => director.skip()}>Skip nonessential motion</button>}
        </div>
        <AnimationTestButton />
      </main>
    );
  }

  if (!status) return <main className="quartermaster-shell loading-quarters">Opening Captain’s Console...</main>;
  const selectedPreflight = selected ? commandPreflight(selected, status) : null;

  return (
    <main
      ref={root}
      className={`quartermaster-shell stage-${animation.label}`}
      data-motion-mode={mode}
      aria-hidden={selected ? true : undefined}
      inert={selected ? true : undefined}
    >
      <div className="quartermaster-desk" aria-hidden="true" />
      <header className="quartermaster-header">
        <div>
          <p className="eyebrow">Live Voyage control</p>
          <h1>Captain’s Console</h1>
        </div>
        <div className="gm-header-tools">
          <a href="/studio">Voyagewright Studio</a>
          <a href="/captain">Voyage dashboard</a>
          <button onClick={cycle} aria-label={`Motion setting: ${mode}. Change motion setting`}>
            {mode} motion
          </button>
          <div className="campaign-stamp">
            <span>{status.campaign.status}</span>
            <b>Voyage sequence {status.campaign.sequence}</b>
          </div>
        </div>
      </header>
      {presentationWarning && (
        <p ref={presentationWarningTarget} className="gm-presentation-warning" role="status">
          {presentationWarning}
          <button onClick={() => setPresentationWarning("")} aria-label="Dismiss Captain's Console notice">
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
          <p className="card-kicker">Active Voyage</p>
          <h2>{status.campaign.title}</h2>
          <div className="status-instruments">
            <div className={`connection-lamp ${status.playerConnected ? "live" : "quiet"}`}>
              <i />
              {status.playerConnected ? "Crew member connected" : "No recent Crew connection"}
            </div>
            <div className="campaign-instrument" data-authoritative-sequence={status.campaign.sequence}>
              <motion.i
                key={status.campaign.sequence}
                initial={{ scaleX: mode === "reduced" ? 1 : 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: mode === "reduced" ? 0 : 0.28 }}
              />
              <span>{status.campaign.status}</span>
              <b>Voyage record sequence {status.campaign.sequence}</b>
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
              <dt>Echo</dt>
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
          <p className="card-kicker">Crew’s current view</p>
          <div className="mini-page">
            <span>{status.chapter.state}</span>
            <strong>{status.preview.chapter.objective ?? "Awaiting the Captain's signal."}</strong>
          </div>
          <a href={`/tale/${status.campaign.slug}`} target="_blank">
            Open Crew view ↗
          </a>
        </motion.article>
        <motion.article
          className="gm-actions"
          variants={cardVariants(mode)}
          initial="initial"
          animate="enter"
          custom={2}
        >
          <p className="card-kicker">Voyage controls</p>
          <div className="action-list">
            {actions.map((action) => (
              <motion.button
                layout
                key={action[0]}
                aria-label={action[1]}
                disabled={busy || animation.isPlaying}
                aria-busy={busy && selected?.[0] === action[0]}
                className={action[0] === "UNDO_LAST" ? "danger-action" : ""}
                onClick={(event) => {
                  commandTrigger.current = event.currentTarget;
                  confirmationIdempotencyKey.current = crypto.randomUUID();
                  setError("");
                  setPresentationWarning("");
                  setCommandTruth("");
                  setSelected(action);
                }}
                whileHover={mode === "reduced" ? {} : { x: 3 }}
                whileTap={mode === "reduced" ? {} : { scale: 0.99 }}
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
          <p className="card-kicker">Recent Voyage events</p>
          <ol>
            {status.events.map((event) => (
              <motion.li layout key={event.id}>
                <span>{event.sequence}</span>
                <b>{event.type.replaceAll("_", " ")}</b>
                <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </motion.li>
            ))}
          </ol>
          <p>Artifacts recovered: {status.inventory.length ? status.inventory.join(", ") : "None"}</p>
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
            {commandTruth && <span>{commandTruth}</span>}
            <button onClick={() => setMessage("")} aria-label="Dismiss Captain's Console message">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {typeof document !== "undefined" && selected
        ? createPortal(
            <motion.div className="confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.section
                ref={confirmationDialog}
                className="confirm-sheet"
                data-runtime-handoff={activeAction ? "gsap" : "motion"}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                tabIndex={-1}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: activeAction ? 0 : 1, y: activeAction ? -8 : 0, scale: activeAction ? 0.985 : 1 }}
              >
                <p className="eyebrow">Confirm Voyage action</p>
                <h2 id="confirm-title">{selected[1]}</h2>
                <p>{selected[2]}</p>
                {selectedPreflight && (
                  <dl className="command-preflight" aria-label="Command-specific preflight">
                    <div>
                      <dt>Exact target</dt>
                      <dd>{selectedPreflight.target}</dd>
                    </div>
                    <div>
                      <dt>Current authoritative state</dt>
                      <dd>{selectedPreflight.current}</dd>
                    </div>
                    <div>
                      <dt>Committed consequence</dt>
                      <dd>{selectedPreflight.consequence}</dd>
                    </div>
                  </dl>
                )}
                <div className="impact-note">
                  <b>What happens next</b>
                  <span>
                    This runs atomically, records an audit entry, saves a recovery point, and then attempts live
                    delivery. Crew delivery and presentation are confirmed separately.
                  </span>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                {busy && (
                  <p className="command-queue-state" role="status">
                    This action holds the Voyage queue. Other actions wait until it finishes.
                  </p>
                )}
                <div>
                  <button onClick={closeConfirmation} disabled={busy}>
                    Cancel
                  </button>
                  <button ref={confirmAction} className="confirm-action" disabled={busy} onClick={execute}>
                    {busy ? "Recording..." : "Confirm Voyage action"}
                  </button>
                </div>
              </motion.section>
            </motion.div>,
            document.body,
            "quartermaster-confirmation",
          )
        : null}
      <AnimatePresence>
        {activeAction && (
          <QuartermasterActionScene
            key={activeAction.operationKey}
            action={activeAction.action}
            scene={actionScene[activeAction.action[0]]}
            operationKey={activeAction.operationKey}
            onReady={handleCommandRuntimeReady}
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
  operationKey,
  onReady,
  label,
  mode,
  skip,
}: {
  action: Action;
  scene: AnimationSceneName;
  operationKey: string;
  onReady: (runtime: CommandRuntime) => void;
  label: string;
  mode: ReturnType<typeof useMotionMode>["mode"];
  skip: () => void;
}) {
  const descriptions: Record<Action[0], string> = {
    PREPARE_CHAPTER: "A blank leaf aligns beneath the Captain's press.",
    RELEASE_CHAPTER: "The Chapter seal parts and released ink finds the page.",
    MARK_SOLVED: "The solved stamp falls with an imperfect edge.",
    AWARD_ARTIFACT: "Velvet darkens while the recovered object finds its brass slot.",
    REVEAL_MAP: "Fog withdraws and a new marker meets the chart.",
    REVEAL_ROUTE: "A route scratches itself between truthful bearings.",
    REVEAL_ARTIFACT_SILHOUETTE: "Only the approved silhouette enters the cabinet.",
    CONNECT_ARTIFACTS: "A fine brass line joins the released Artifacts.",
    DISCOVER_SIDE_QUEST: "A rumor note slips from its envelope.",
    UPDATE_SIDE_QUEST: "Fresh ink checks the next optional objective.",
    COMPLETE_SIDE_QUEST: "The optional course receives its completion stamp.",
    ADD_JOURNAL_ANNOTATION: "A Captain's note settles into the margin.",
    ADD_LOG_ENTRY: "The next dated line enters the logbook.",
    TEASE_FINALE: "The outer rings wake while the core stays sealed.",
    UPDATE_FINALE_REQUIREMENT: "One truthful socket receives light.",
    UNDO_LAST: "Ink, route, and mark return toward their prior truthful state.",
    PAUSE: "Wind falls, lantern dims, and the compass rests.",
    RESUME: "Lantern and compass return to their working rhythm.",
  };
  return (
    <>
      <SceneHost
        kind="quartermaster-command"
        hostKey={operationKey}
        className={`cinematic-command-overlay command-${action[0].toLowerCase()} scene-${scene}`}
        data-motion-mode={mode}
        data-command-operation={operationKey}
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        <CommandHostContent action={action} operationKey={operationKey} onReady={onReady} />
      </SceneHost>
      <motion.div
        className="command-copy"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        aria-live="polite"
        aria-label={`${action[1]} presentation: ${label}`}
      >
        <p className="eyebrow">{action[1]}</p>
        <h2>{label.replaceAll("-", " ")}</h2>
        <p>{descriptions[action[0]]}</p>
        <button onClick={skip}>Skip nonessential motion</button>
      </motion.div>
    </>
  );
}
