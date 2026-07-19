import type {
  AnimationRuntimeOwner,
  AnimationSceneName,
  SceneAcknowledgmentPolicy,
  SceneDefinition,
  SceneFinalStatePolicy,
  ScenePlaybackPolicy,
  SceneTargetContract,
  SceneTargetProperty,
  SceneTargetRequirement,
  SceneVisibilityRule,
} from "../core/animation-types";
import { firstArrivalScene, sessionReentryScene } from "../scenes/arrival.scene";
import { playerAccessScene, quartermasterLoginScene } from "../scenes/access.scene";
import { markSolvedScene, pauseScene, prepareChapterScene, resumeScene, undoScene } from "../scenes/command.scene";
import {
  artifactAwardScene,
  artifactConnectionScene,
  artifactInspectionScene,
  chapterHeadingScene,
  chapterReleaseScene,
  finaleRequirementScene,
  finaleTeaseScene,
  journalOpenScene,
  logEntryScene,
  manualPageFlipScene,
  mapRevealScene,
  markerStampScene,
  programmaticPageFlipScene,
  proseInkScene,
  questCompleteScene,
  questDiscoveryScene,
  routeDrawScene,
  sealBreakScene,
  shipCourseScene,
} from "../scenes/story.scene";

const visibleWithinHost = {
  mustBeConnected: true,
  mustHaveNonZeroBox: true,
  mustNotBeDisplayNone: true,
  mustNotBeVisibilityHidden: true,
  minimumEffectiveOpacity: 0.01,
  mustIntersectHost: true,
  mustIntersectViewport: false,
  rejectPageFlipSource: true,
  rejectStaleSceneInstance: true,
} satisfies SceneVisibilityRule;

type TargetOptions = {
  max?: number;
  minimumEffectiveOpacity?: number;
  mustHaveNonZeroBox?: boolean;
  mustIntersectViewport?: boolean;
};

function target(
  part: string,
  required: boolean,
  owner: AnimationRuntimeOwner,
  properties: SceneTargetProperty[],
  options: TargetOptions = {},
): SceneTargetRequirement {
  return {
    part,
    required,
    cardinality: { min: required ? 1 : 0, max: options.max ?? 1 },
    visibility: {
      ...visibleWithinHost,
      minimumEffectiveOpacity: options.minimumEffectiveOpacity ?? visibleWithinHost.minimumEffectiveOpacity,
      mustHaveNonZeroBox: options.mustHaveNonZeroBox ?? visibleWithinHost.mustHaveNonZeroBox,
      mustIntersectViewport: options.mustIntersectViewport ?? visibleWithinHost.mustIntersectViewport,
    },
    owner,
    properties,
  };
}

const required = (
  part: string,
  properties: SceneTargetProperty[],
  options?: TargetOptions,
  owner: AnimationRuntimeOwner = "gsap",
) => target(part, true, owner, properties, options);

const optional = (
  part: string,
  properties: SceneTargetProperty[],
  options?: TargetOptions,
  owner: AnimationRuntimeOwner = "gsap",
) => target(part, false, owner, properties, options);

function playback(
  source: ScenePlaybackPolicy["source"],
  options: Partial<ScenePlaybackPolicy> = {},
): ScenePlaybackPolicy {
  return {
    source,
    replayable: false,
    allowUserSkip: false,
    allowPolicySkip: true,
    priority: 50,
    ...options,
  };
}

function noAcknowledgment(): SceneAcknowledgmentPolicy {
  return {
    kind: "informational",
    acknowledgeOn: [],
    fallbackMustBeReadable: true,
    acknowledgmentOwner: "none",
  };
}

function callerAcknowledgment(): SceneAcknowledgmentPolicy {
  return {
    kind: "animation-independent",
    acknowledgeOn: [],
    fallbackMustBeReadable: true,
    acknowledgmentOwner: "caller",
  };
}

function playerEventAcknowledgment(kind: "mandatory" | "optional" = "optional"): SceneAcknowledgmentPolicy {
  return {
    kind,
    acknowledgeOn: ["presented", "presented-fallback", "skipped-by-user"],
    fallbackMustBeReadable: true,
    acknowledgmentOwner: "player-presentation",
  };
}

const reconcile = (semanticState: string): SceneFinalStatePolicy => ({
  kind: "reconcile-then-revert",
  semanticState,
});

const hold = (semanticState: string): SceneFinalStatePolicy => ({
  kind: "hold-until-unmount",
  semanticState,
});

const staticFallback = (semanticState: string, fallback: string): SceneFinalStatePolicy => ({
  kind: "readable-static-fallback",
  semanticState,
  fallback,
});

type ContractInput = Omit<SceneTargetContract, "version" | "sceneName">;

function contract(sceneName: AnimationSceneName, input: ContractInput): SceneTargetContract {
  return { version: 1, sceneName, ...input };
}

const workspaceLight = () => optional("workspace-light", ["opacity"]);
const commandLight = () => optional("command-light", ["opacity"]);

const chapterInheritedOptionalTargets = (primary: "ink-heading" | "ink-story"): SceneTargetRequirement[] =>
  [
    optional("sealed-parchment", ["transform", "custom"]),
    optional("ink-heading", ["transform", "opacity"]),
    optional("ink-story", ["transform", "opacity", "filter"]),
    optional("ink-objective", ["transform", "opacity"]),
    optional("ink-riddle", ["clip-path", "opacity"]),
    optional("seal", ["transform"]),
    optional("seal-crack", ["stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
    optional("seal-fragment", ["transform", "opacity"], { max: 4 }),
    optional("page-light", ["transform", "opacity"]),
    optional("route-path", ["stroke-dasharray", "stroke-dashoffset"]),
    optional("map-fog", ["transform", "opacity"]),
    optional("quill", ["transform", "opacity"]),
    optional("peripheral", ["transform", "opacity"], { max: 2 }),
    workspaceLight(),
  ].filter((entry) => entry.part !== primary);

type SceneCallerAnchor = {
  sourcePath: string;
  callerSymbol: string;
  sceneBinding: string;
  invocation: string;
};

export type SceneReachabilityEvidence =
  | { reachability: "production"; caller: SceneCallerAnchor }
  | { reachability: "legacy"; caller: SceneCallerAnchor; disposition: string }
  | { reachability: "future-contract"; disposition: string }
  | {
      reachability: "deprecated";
      disposition: string;
      replacement: string;
      replacementSourcePath: string;
      replacementSymbol: string;
    }
  | { reachability: "development-only"; disposition: string };

const playerEventCaller = (sceneBinding: string): SceneCallerAnchor => ({
  sourcePath: "src/components/player/PlayerExperience.tsx",
  callerSymbol: "const playEvent = useCallback",
  sceneBinding,
  invocation: "director.play(scene,",
});

const playerJournalCaller: SceneCallerAnchor = {
  sourcePath: "src/components/player/PlayerExperience.tsx",
  callerSymbol: "async function openJournal",
  sceneBinding: `first ? "first-arrival" : "session-reentry"`,
  invocation: `director.play(first ? "first-arrival" : "session-reentry"`,
};

const quartermasterActionCaller = (sceneBinding: string): SceneCallerAnchor => ({
  sourcePath: "src/components/gm/Quartermaster.tsx",
  callerSymbol: "const actionScene:",
  sceneBinding,
  invocation: "director.play<CommandResult>(actionScene[action[0]],",
});

/**
 * Source-grounded reachability evidence. Production status is granted only to
 * a scene with a current non-development caller; the showcase is deliberately
 * absent because a synthetic harness is not production reachability proof.
 */
export const sceneReachabilityEvidence = {
  "first-arrival": {
    reachability: "production",
    caller: playerJournalCaller,
  },
  "session-reentry": {
    reachability: "production",
    caller: playerJournalCaller,
  },
  "player-access": {
    reachability: "legacy",
    caller: {
      sourcePath: "src/components/player/AccessGate.tsx",
      callerSymbol: "function AccessGate",
      sceneBinding: 'director.play<AccessOperationResult>("player-access",',
      invocation: 'director.play<AccessOperationResult>("player-access",',
    },
    disposition: "Live compatibility access flow; retained as legacy rather than canonical platform navigation.",
  },
  "quartermaster-login": {
    reachability: "legacy",
    caller: {
      sourcePath: "src/components/gm/Quartermaster.tsx",
      callerSymbol: "function Quartermaster",
      sceneBinding: 'director.play<{ authenticated: true }>("quartermaster-login",',
      invocation: 'director.play<{ authenticated: true }>("quartermaster-login",',
    },
    disposition: "Live compatibility Game Master sign-in flow; retained as legacy.",
  },
  "journal-open": {
    reachability: "deprecated",
    disposition: "The bounded Journal opening machine owns this behavior; the GSAP scene has no production caller.",
    replacement: "journal-opening-machine",
    replacementSourcePath: "src/animation/journal/opening-machine.ts",
    replacementSymbol: "waitForJournalPhase",
  },
  "manual-page-flip": {
    reachability: "deprecated",
    disposition: "PageFlipBook manual controls own page changes; the GSAP scene has no production caller.",
    replacement: "PageFlipBook-manual-controls",
    replacementSourcePath: "src/components/animation/PageFlipBook.tsx",
    replacementSymbol: "PageFlipBook",
  },
  "programmatic-page-flip": {
    reachability: "deprecated",
    disposition: "PageFlipBook.flipTo owns commanded page changes; the GSAP scene has no production caller.",
    replacement: "PageFlipBook-flipTo",
    replacementSourcePath: "src/components/animation/PageFlipBook.tsx",
    replacementSymbol: "flipTo",
  },
  "chapter-heading": {
    reachability: "future-contract",
    disposition: "Registered subscene contract only; no current production caller.",
  },
  "prose-ink": {
    reachability: "future-contract",
    disposition: "Registered subscene contract only; no current production caller.",
  },
  "seal-break": {
    reachability: "legacy",
    caller: quartermasterActionCaller('RELEASE_CHAPTER: "seal-break"'),
    disposition:
      "Live compatibility Quartermaster command presentation; player release presentation is chapter-release.",
  },
  "chapter-release": {
    reachability: "production",
    caller: playerEventCaller('CHAPTER_RELEASED: "chapter-release"'),
  },
  "map-reveal": {
    reachability: "production",
    caller: playerEventCaller('MAP_LOCATION_REVEALED: "map-reveal"'),
  },
  "route-draw": {
    reachability: "production",
    caller: playerEventCaller('MAP_ROUTE_REVEALED: "route-draw"'),
  },
  "marker-stamp": {
    reachability: "future-contract",
    disposition: "Registered map subscene contract only; no current production caller.",
  },
  "ship-course": {
    reachability: "future-contract",
    disposition: "Registered map subscene contract only; no current production caller.",
  },
  "artifact-award": {
    reachability: "production",
    caller: playerEventCaller('ARTIFACT_AWARDED: "artifact-award"'),
  },
  "artifact-inspection": {
    reachability: "future-contract",
    disposition: "Registered artifact-detail subscene contract only; no current production caller.",
  },
  "artifact-connection": {
    reachability: "production",
    caller: playerEventCaller('ARTIFACT_CONNECTED: "artifact-connection"'),
  },
  "quest-discovery": {
    reachability: "production",
    caller: playerEventCaller('SIDE_QUEST_DISCOVERED: "quest-discovery"'),
  },
  "quest-complete": {
    reachability: "production",
    caller: playerEventCaller('SIDE_QUEST_COMPLETED: "quest-complete"'),
  },
  "log-entry": {
    reachability: "production",
    caller: playerEventCaller('PLAYER_LOG_ENTRY_ADDED: "log-entry"'),
  },
  "finale-tease": {
    reachability: "production",
    caller: playerEventCaller('FINALE_TEASED: "finale-tease"'),
  },
  "finale-requirement": {
    reachability: "production",
    caller: playerEventCaller('FINALE_REQUIREMENT_UPDATED: "finale-requirement"'),
  },
  "prepare-chapter": {
    reachability: "legacy",
    caller: quartermasterActionCaller('PREPARE_CHAPTER: "prepare-chapter"'),
    disposition: "Live compatibility Quartermaster preparation command; retained as legacy.",
  },
  "mark-solved": {
    reachability: "production",
    caller: playerEventCaller('CHAPTER_SOLVED: "mark-solved"'),
  },
  pause: {
    reachability: "production",
    caller: playerEventCaller('CAMPAIGN_PAUSED: "pause"'),
  },
  resume: {
    reachability: "production",
    caller: playerEventCaller('CAMPAIGN_RESUMED: "resume"'),
  },
  undo: {
    reachability: "production",
    caller: playerEventCaller('STATE_REVERTED: "undo"'),
  },
} satisfies Record<AnimationSceneName, SceneReachabilityEvidence>;

export const sceneContracts = {
  "first-arrival": contract("first-arrival", {
    reachability: "production",
    expectedHostKind: "arrival",
    requiredTargets: [
      required("title", ["clip-path", "opacity"]),
      required("arrival-copy", ["transform", "opacity"], { max: 2 }),
      required("arrival-action", ["transform", "opacity"], { max: 2 }),
    ],
    optionalTargets: [
      optional("sky", ["opacity"]),
      optional("stars", ["opacity"]),
      optional("moon", ["transform", "opacity"]),
      optional("horizon", ["transform", "opacity"], { max: 2 }),
      optional("ocean", ["transform", "opacity"], { max: 2 }),
      optional("fog-back", ["transform", "opacity"]),
      optional("fog-front", ["transform", "opacity"], { max: 2 }),
      optional("ship", ["transform", "opacity"]),
      optional("emblem", ["transform", "opacity"]),
      optional("nautical-border", ["opacity"]),
    ],
    timeoutMs: 7_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "arrival-readable",
      allowedFallback: "static-arrival",
      priority: 20,
    }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: reconcile("arrival-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "session-reentry": contract("session-reentry", {
    reachability: "production",
    expectedHostKind: "arrival",
    requiredTargets: [
      required("title", ["transform", "opacity"]),
      required("arrival-action", ["transform", "opacity"], { max: 2 }),
    ],
    optionalTargets: [optional("fog-front", ["transform", "opacity"], { max: 2 })],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "reentry-readable",
      allowedFallback: "static-reentry",
      priority: 15,
    }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: reconcile("reentry-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "player-access": contract("player-access", {
    reachability: "legacy",
    expectedHostKind: "player-access",
    requiredTargets: [
      required("invitation", ["transform"]),
      required("invitation-ink", ["filter", "opacity"]),
      required("seal", ["transform", "filter"]),
    ],
    optionalTargets: [
      optional("ribbon", ["transform", "opacity"]),
      optional("seal-crack", ["stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
      optional("lantern", ["transform", "opacity"]),
    ],
    timeoutMs: 12_000,
    playbackPolicy: playback("operation", {
      allowUserSkip: true,
      userSkipFinalState: "access-result-readable",
      allowedFallback: "readable-access-result",
      priority: 80,
    }),
    acknowledgmentPolicy: callerAcknowledgment(),
    finalStatePolicy: hold("access-result-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "quartermaster-login": contract("quartermaster-login", {
    reachability: "legacy",
    expectedHostKind: "quartermaster-login",
    requiredTargets: [
      required("lock", ["transform"]),
      required("door-bolt", ["transform"]),
      required("cabin-door", ["transform"]),
      required("login-ledger", ["transform"]),
    ],
    optionalTargets: [optional("chart-room-light", ["opacity"]), optional("lantern", ["transform", "opacity"])],
    timeoutMs: 12_000,
    playbackPolicy: playback("operation", {
      allowUserSkip: true,
      userSkipFinalState: "quartermaster-result-readable",
      allowedFallback: "readable-quartermaster-result",
      priority: 80,
    }),
    acknowledgmentPolicy: callerAcknowledgment(),
    finalStatePolicy: hold("quartermaster-result-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "journal-open": contract("journal-open", {
    reachability: "deprecated",
    expectedHostKind: "development-showcase",
    requiredTargets: [],
    optionalTargets: [
      optional("journal-cover", ["transform"]),
      optional("journal-clasp", ["transform"]),
      optional("page-dust", ["opacity"]),
    ],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("journal-readable", "journal-opening-machine"),
    reducedFallback: "none",
    replacedBy: "journal-opening-machine",
  }),
  "manual-page-flip": contract("manual-page-flip", {
    reachability: "deprecated",
    expectedHostKind: "development-showcase",
    requiredTargets: [],
    optionalTargets: [workspaceLight()],
    timeoutMs: 1_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("page-readable", "PageFlipBook-manual-controls"),
    reducedFallback: "none",
    replacedBy: "PageFlipBook-manual-controls",
  }),
  "programmatic-page-flip": contract("programmatic-page-flip", {
    reachability: "deprecated",
    expectedHostKind: "development-showcase",
    requiredTargets: [],
    optionalTargets: [workspaceLight()],
    timeoutMs: 1_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("page-readable", "PageFlipBook-flipTo"),
    reducedFallback: "none",
    replacedBy: "PageFlipBook-flipTo",
  }),
  "chapter-heading": contract("chapter-heading", {
    reachability: "future-contract",
    expectedHostKind: "future-chapter-subscene",
    requiredTargets: [required("ink-heading", ["transform", "opacity"], { max: 2 })],
    optionalTargets: chapterInheritedOptionalTargets("ink-heading"),
    timeoutMs: 4_000,
    playbackPolicy: playback("development", {
      allowedFallback: "static-chapter-heading",
      priority: 10,
    }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("chapter-heading-readable", "static-chapter-heading"),
    reducedFallback: "static-reader",
  }),
  "prose-ink": contract("prose-ink", {
    reachability: "future-contract",
    expectedHostKind: "future-chapter-subscene",
    requiredTargets: [required("ink-story", ["transform", "opacity", "filter"])],
    optionalTargets: chapterInheritedOptionalTargets("ink-story"),
    timeoutMs: 5_000,
    playbackPolicy: playback("development", { allowedFallback: "static-prose", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("prose-readable", "static-prose"),
    reducedFallback: "static-reader",
  }),
  "seal-break": contract("seal-break", {
    reachability: "legacy",
    expectedHostKind: "quartermaster-command",
    requiredTargets: [required("seal", ["transform"])],
    optionalTargets: [
      optional("seal-crack", ["stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
      optional("seal-fragment", ["transform", "opacity"], { max: 4 }),
      workspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("operation", {
      allowUserSkip: true,
      userSkipFinalState: "chapter-command-recorded",
      allowedFallback: "readable-command-result",
      priority: 70,
    }),
    acknowledgmentPolicy: callerAcknowledgment(),
    finalStatePolicy: hold("chapter-command-recorded"),
    reducedFallback: "semantic-final-state",
  }),
  "chapter-release": contract("chapter-release", {
    reachability: "production",
    expectedHostKind: "player-progression",
    requiredTargets: [
      required("journal-stage", ["transform"]),
      required("sealed-parchment", ["transform", "custom"]),
      required("ink-heading", ["transform", "opacity"], { max: 2 }),
      required("ink-story", ["transform", "opacity", "filter"]),
      required("ink-objective", ["transform", "opacity"]),
      required("ink-riddle", ["clip-path", "opacity"]),
    ],
    optionalTargets: [
      workspaceLight(),
      optional("lantern", ["opacity"]),
      optional("peripheral", ["transform", "opacity"], { max: 2 }),
      optional("seal", ["transform"]),
      optional("seal-crack", ["stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
      optional("seal-fragment", ["transform", "opacity"], { max: 4 }),
      optional("page-light", ["transform", "opacity"]),
      optional("route-path", ["stroke-dasharray", "stroke-dashoffset"]),
      optional("map-fog", ["transform", "opacity"]),
      optional("quill", ["transform", "opacity"]),
    ],
    timeoutMs: 9_500,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "chapter-readable",
      allowPolicySkip: false,
      allowedFallback: "readable-chapter-release",
      priority: 100,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment("mandatory"),
    finalStatePolicy: reconcile("chapter-readable"),
    reducedFallback: "static-reader",
  }),
  "map-reveal": contract("map-reveal", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("map-marker-new", ["transform", "opacity"])],
    optionalTargets: [
      optional("map-fog", ["clip-path", "opacity"]),
      optional("route-path", ["stroke-dasharray", "stroke-dashoffset"]),
      workspaceLight(),
    ],
    timeoutMs: 4_500,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "map-location-readable",
      allowedFallback: "readable-map-location",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("map-location-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "route-draw": contract("route-draw", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("route-path", ["stroke-dasharray", "stroke-dashoffset", "opacity"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "route-readable",
      allowedFallback: "readable-route",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("route-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "marker-stamp": contract("marker-stamp", {
    reachability: "future-contract",
    expectedHostKind: "future-map-subscene",
    requiredTargets: [required("map-marker-new", ["transform", "opacity"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowedFallback: "static-map-marker", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("map-marker-readable", "static-map-marker"),
    reducedFallback: "static-reader",
  }),
  "ship-course": contract("ship-course", {
    reachability: "future-contract",
    expectedHostKind: "future-map-subscene",
    requiredTargets: [required("ship-token", ["transform"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 4_000,
    playbackPolicy: playback("development", { allowedFallback: "static-ship-position", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: staticFallback("ship-position-readable", "static-ship-position"),
    reducedFallback: "static-reader",
  }),
  "artifact-award": contract("artifact-award", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [
      required("artifact-reveal", ["transform", "opacity", "layout"]),
      required("artifact-slot-target", ["layout"], undefined, "react"),
    ],
    optionalTargets: [optional("artifact-light", ["transform", "opacity"]), workspaceLight()],
    timeoutMs: 5_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "artifact-awarded-readable",
      allowedFallback: "readable-artifact-award",
      priority: 70,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("artifact-awarded-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "artifact-inspection": contract("artifact-inspection", {
    reachability: "future-contract",
    expectedHostKind: "future-artifact-inspection-detail",
    requiredTargets: [required("artifact-engraving", ["clip-path"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowedFallback: "static-artifact-engraving", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: hold("artifact-engraving-readable"),
    reducedFallback: "static-reader",
  }),
  "artifact-connection": contract("artifact-connection", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("artifact-connection-path", ["stroke-dasharray", "stroke-dashoffset", "opacity"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "artifact-connection-readable",
      allowedFallback: "readable-artifact-connection",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("artifact-connection-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "quest-discovery": contract("quest-discovery", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("quest-note-new", ["transform", "opacity"])],
    optionalTargets: [optional("red-thread", ["stroke-dasharray", "stroke-dashoffset"]), workspaceLight()],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "quest-readable",
      allowedFallback: "readable-quest-update",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("quest-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "quest-complete": contract("quest-complete", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("quest-stamp", ["transform", "opacity"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "quest-complete-readable",
      allowedFallback: "readable-quest-complete",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("quest-complete-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "log-entry": contract("log-entry", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("log-entry-new", ["transform", "opacity"])],
    optionalTargets: [optional("log-symbol-new", ["transform", "opacity"]), workspaceLight()],
    timeoutMs: 3_500,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "log-entry-readable",
      allowedFallback: "readable-log-entry",
      priority: 55,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("log-entry-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "finale-tease": contract("finale-tease", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [
      required("finale-ring-outer", ["transform"]),
      required("finale-ring-inner", ["transform"]),
      required("finale-light-path", ["stroke-dasharray", "stroke-dashoffset"]),
    ],
    optionalTargets: [workspaceLight()],
    timeoutMs: 5_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "finale-tease-readable",
      allowedFallback: "readable-finale-tease",
      priority: 70,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("finale-tease-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "finale-requirement": contract("finale-requirement", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("finale-light-path", ["stroke-dasharray", "stroke-dashoffset", "opacity"])],
    optionalTargets: [workspaceLight()],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "finale-requirement-readable",
      allowedFallback: "readable-finale-requirement",
      priority: 65,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("finale-requirement-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "prepare-chapter": contract("prepare-chapter", {
    reachability: "legacy",
    expectedHostKind: "quartermaster-command",
    requiredTargets: [required("blank-page", ["transform", "opacity"])],
    optionalTargets: [commandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("operation", {
      allowUserSkip: true,
      userSkipFinalState: "chapter-prepared-readable",
      allowedFallback: "readable-command-result",
      priority: 65,
    }),
    acknowledgmentPolicy: callerAcknowledgment(),
    finalStatePolicy: hold("chapter-prepared-readable"),
    reducedFallback: "semantic-final-state",
  }),
  "mark-solved": contract("mark-solved", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("solved-stamp", ["transform", "opacity"])],
    optionalTargets: [commandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "chapter-solved-readable",
      allowedFallback: "readable-chapter-solved",
      priority: 65,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("chapter-solved-readable"),
    reducedFallback: "semantic-final-state",
  }),
  pause: contract("pause", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("lantern", ["transform", "opacity"])],
    optionalTargets: [commandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "campaign-paused-readable",
      allowedFallback: "readable-campaign-paused",
      priority: 80,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("campaign-paused-readable"),
    reducedFallback: "semantic-final-state",
  }),
  resume: contract("resume", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("lantern", ["transform", "opacity"])],
    optionalTargets: [commandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "campaign-resumed-readable",
      allowedFallback: "readable-campaign-resumed",
      priority: 80,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("campaign-resumed-readable"),
    reducedFallback: "semantic-final-state",
  }),
  undo: contract("undo", {
    reachability: "production",
    expectedHostKind: "progression",
    requiredTargets: [required("undo-mark", ["transform", "opacity"])],
    optionalTargets: [commandLight()],
    timeoutMs: 3_500,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "state-restored-readable",
      allowedFallback: "readable-state-restored",
      priority: 85,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: reconcile("state-restored-readable"),
    reducedFallback: "semantic-final-state",
  }),
} satisfies Record<AnimationSceneName, SceneTargetContract>;

const definitions: SceneDefinition[] = [
  firstArrivalScene,
  sessionReentryScene,
  playerAccessScene,
  quartermasterLoginScene,
  journalOpenScene,
  manualPageFlipScene,
  programmaticPageFlipScene,
  chapterHeadingScene,
  proseInkScene,
  sealBreakScene,
  chapterReleaseScene,
  mapRevealScene,
  routeDrawScene,
  markerStampScene,
  shipCourseScene,
  artifactAwardScene,
  artifactInspectionScene,
  artifactConnectionScene,
  questDiscoveryScene,
  questCompleteScene,
  logEntryScene,
  finaleTeaseScene,
  finaleRequirementScene,
  prepareChapterScene,
  markSolvedScene,
  pauseScene,
  resumeScene,
  undoScene,
];

export type RegisteredSceneDefinition = SceneDefinition & { contract: SceneTargetContract };

export const sceneRegistry = Object.fromEntries(
  definitions.map((definition) => [
    definition.name,
    { ...definition, contract: sceneContracts[definition.name] } satisfies RegisteredSceneDefinition,
  ]),
) as Record<AnimationSceneName, RegisteredSceneDefinition>;

export function getSceneDefinition(name: AnimationSceneName) {
  return sceneRegistry[name];
}
