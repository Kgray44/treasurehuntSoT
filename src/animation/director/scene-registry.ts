import type {
  AnimatedProperty,
  AnimationRuntimeOwner,
  AnimationSceneName,
  AnySceneTargetContract,
  SceneAcknowledgmentPolicy,
  SceneCleanupPolicy,
  SceneDefinition,
  SceneDefinitionV2,
  SceneFinalStatePolicy,
  SceneFinalStatePolicyV2,
  ScenePlaybackPolicy,
  SceneTargetContract,
  SceneTargetContractV2,
  SceneTargetProperty,
  SceneTargetRequirement,
  SceneTargetRequirementV2,
  SceneTargetSource,
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
  key?: string;
  max?: number;
  minimumEffectiveOpacity?: number;
  mustHaveNonZeroBox?: boolean;
  mustIntersectViewport?: boolean;
  source?: SceneTargetSource;
};

const hostSource = Object.freeze({ kind: "host" as const });
const externalSource = (handleKey: string): SceneTargetSource =>
  Object.freeze({ kind: "external" as const, handleKey });

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

const hold = (semanticState: string): SceneFinalStatePolicy => ({
  kind: "hold-until-unmount",
  semanticState,
});

type ContractInput = Omit<SceneTargetContract, "version" | "sceneName">;

function contract(sceneName: AnimationSceneName, input: ContractInput): SceneTargetContract {
  return { version: 1, sceneName, ...input };
}

const cleanupPolicy = Object.freeze({
  cleanupTimeoutMs: 2_000,
  onHandoffFailure: "render-static-fallback",
  releaseOrder: [
    "runtime-resources",
    "temporary-styles",
    "external-handles",
    "ownership-claims",
    "target-handles",
    "invocation-registration",
  ],
} satisfies SceneCleanupPolicy);

function v2Target(
  part: string,
  requiredTarget: boolean,
  owner: AnimationRuntimeOwner,
  properties: readonly AnimatedProperty[],
  options: TargetOptions = {},
): SceneTargetRequirementV2 {
  return Object.freeze({
    key: options.key ?? part,
    part,
    source: options.source ?? hostSource,
    required: requiredTarget,
    cardinality: Object.freeze({ min: requiredTarget ? 1 : 0, max: options.max ?? 1 }),
    visibility: Object.freeze({
      ...visibleWithinHost,
      minimumEffectiveOpacity: options.minimumEffectiveOpacity ?? visibleWithinHost.minimumEffectiveOpacity,
      mustHaveNonZeroBox: options.mustHaveNonZeroBox ?? visibleWithinHost.mustHaveNonZeroBox,
      mustIntersectViewport: options.mustIntersectViewport ?? visibleWithinHost.mustIntersectViewport,
    }),
    owner,
    properties: Object.freeze([...properties]),
  });
}

const v2Required = (
  part: string,
  properties: readonly AnimatedProperty[],
  options?: TargetOptions,
  owner: AnimationRuntimeOwner = "gsap",
) => v2Target(part, true, owner, properties, options);

const v2Optional = (
  part: string,
  properties: readonly AnimatedProperty[],
  options?: TargetOptions,
  owner: AnimationRuntimeOwner = "gsap",
) => v2Target(part, false, owner, properties, options);

function v2IdentityTarget(
  part: string,
  requiredTarget: boolean,
  options: TargetOptions = {},
): SceneTargetRequirementV2 {
  return Object.freeze({
    key: options.key ?? part,
    part,
    source: options.source ?? hostSource,
    required: requiredTarget,
    cardinality: Object.freeze({ min: requiredTarget ? 1 : 0, max: options.max ?? 1 }),
    visibility: Object.freeze({
      ...visibleWithinHost,
      minimumEffectiveOpacity: options.minimumEffectiveOpacity ?? visibleWithinHost.minimumEffectiveOpacity,
      mustHaveNonZeroBox: options.mustHaveNonZeroBox ?? visibleWithinHost.mustHaveNonZeroBox,
      mustIntersectViewport: options.mustIntersectViewport ?? visibleWithinHost.mustIntersectViewport,
    }),
    identityOnly: true,
    owner: null,
    properties: [] as const,
  });
}

const v2RequiredIdentity = (part: string, options?: TargetOptions) => v2IdentityTarget(part, true, options);

type V2ContractInput = Omit<SceneTargetContractV2, "version" | "sceneName" | "cleanupPolicy"> & {
  cleanupPolicy?: SceneCleanupPolicy;
};

function v2Contract(sceneName: AnimationSceneName, input: V2ContractInput): SceneTargetContractV2 {
  return Object.freeze({
    version: 2,
    sceneName,
    ...input,
    expectedHostKinds: Object.freeze([...input.expectedHostKinds]),
    targets: Object.freeze([...input.targets]),
    cleanupPolicy: input.cleanupPolicy ?? cleanupPolicy,
  });
}

const v2Reconcile = (semanticState: string, handoffTargetKey: string): SceneFinalStatePolicyV2 => ({
  kind: "reconcile-then-revert",
  semanticState,
  handoffTargetKey,
});

const v2Hold = (semanticState: string): SceneFinalStatePolicyV2 => ({
  kind: "hold-final-until-unmount",
  semanticState,
});

const v2StaticFallback = (semanticState: string, fallback: string): SceneFinalStatePolicyV2 => ({
  kind: "fallback-to-static-state",
  semanticState,
  fallback,
});

const v2WorkspaceLight = () => v2Optional("workspace-light", ["opacity"]);
const v2CommandLight = () => v2Optional("command-light", ["opacity"]);

const v2ChapterInheritedOptionalTargets = (primary: "ink-heading" | "ink-story"): readonly SceneTargetRequirementV2[] =>
  [
    v2Optional("sealed-parchment", ["transform"]),
    v2Optional("ink-heading", ["transform", "opacity"]),
    v2Optional("ink-story", ["transform", "opacity", "filter"]),
    v2Optional("ink-objective", ["transform", "opacity"]),
    v2Optional("ink-riddle", ["clip-path", "opacity"]),
    v2Optional("seal", ["transform"]),
    v2Optional("seal-crack", ["stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
    v2Optional("seal-fragment", ["transform", "opacity"], { max: 4 }),
    v2Optional("page-light", ["transform", "opacity"]),
    v2Optional("route-path", ["stroke-dasharray", "stroke-dashoffset"]),
    v2Optional("map-fog", ["transform", "opacity"]),
    v2Optional("quill", ["transform", "opacity"]),
    v2Optional("quill-path", ["path-drawing"]),
    v2Optional("companion-header-dim", ["opacity"], { source: externalSource("companion-header-dim") }),
    v2Optional("companion-desktop-navigation-dim", ["opacity"], {
      source: externalSource("companion-desktop-navigation-dim"),
    }),
    v2Optional("companion-mobile-navigation-dim", ["opacity"], {
      source: externalSource("companion-mobile-navigation-dim"),
    }),
    v2WorkspaceLight(),
  ].filter((entry) => entry.part !== primary);

const workspaceLight = () => optional("workspace-light", ["opacity"]);
const commandLight = () => optional("command-light", ["opacity"]);

type SceneCallerAnchor = {
  sourcePath: string;
  callerSymbol: string;
  sceneBinding: string;
  invocation: string;
};

export type SceneReachabilityEvidence =
  | { reachability: "production"; caller: SceneCallerAnchor; additionalCallers?: readonly SceneCallerAnchor[] }
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

const playerEventCaller = (_sceneBinding: string): SceneCallerAnchor => {
  void _sceneBinding;
  return {
    sourcePath: "src/components/player/PlayerExperience.tsx",
    callerSymbol: "const presentProgressionRequest = useCallback",
    sceneBinding: "policyForProgressionEvent(request.eventType)",
    invocation: "director.play<void>(eventPolicy.sceneName,",
  };
};

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

const quartermasterProductionCaller = (sceneBinding: string): readonly SceneCallerAnchor[] =>
  Object.freeze([quartermasterActionCaller(sceneBinding)]);

/**
 * Source-grounded reachability evidence. Production status is granted only to
 * a scene with a current non-development caller; the showcase is deliberately
 * absent because a synthetic harness is not production reachability proof.
 */
export const sceneReachabilityEvidence: Readonly<Record<AnimationSceneName, SceneReachabilityEvidence>> = {
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
    additionalCallers: quartermasterProductionCaller('REVEAL_MAP: "map-reveal"'),
  },
  "route-draw": {
    reachability: "production",
    caller: playerEventCaller('MAP_ROUTE_REVEALED: "route-draw"'),
    additionalCallers: quartermasterProductionCaller('REVEAL_ROUTE: "route-draw"'),
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
    additionalCallers: quartermasterProductionCaller('AWARD_ARTIFACT: "artifact-award"'),
  },
  "artifact-inspection": {
    reachability: "future-contract",
    disposition: "Registered artifact-detail subscene contract only; no current production caller.",
  },
  "artifact-connection": {
    reachability: "production",
    caller: playerEventCaller('ARTIFACT_CONNECTED: "artifact-connection"'),
    additionalCallers: quartermasterProductionCaller('CONNECT_ARTIFACTS: "artifact-connection"'),
  },
  "quest-discovery": {
    reachability: "production",
    caller: playerEventCaller('SIDE_QUEST_DISCOVERED: "quest-discovery"'),
    additionalCallers: quartermasterProductionCaller('DISCOVER_SIDE_QUEST: "quest-discovery"'),
  },
  "quest-complete": {
    reachability: "production",
    caller: playerEventCaller('SIDE_QUEST_COMPLETED: "quest-complete"'),
    additionalCallers: quartermasterProductionCaller('COMPLETE_SIDE_QUEST: "quest-complete"'),
  },
  "log-entry": {
    reachability: "production",
    caller: playerEventCaller('PLAYER_LOG_ENTRY_ADDED: "log-entry"'),
    additionalCallers: quartermasterProductionCaller('ADD_LOG_ENTRY: "log-entry"'),
  },
  "finale-tease": {
    reachability: "production",
    caller: playerEventCaller('FINALE_TEASED: "finale-tease"'),
    additionalCallers: quartermasterProductionCaller('TEASE_FINALE: "finale-tease"'),
  },
  "finale-requirement": {
    reachability: "production",
    caller: playerEventCaller('FINALE_REQUIREMENT_UPDATED: "finale-requirement"'),
    additionalCallers: quartermasterProductionCaller('UPDATE_FINALE_REQUIREMENT: "finale-requirement"'),
  },
  "prepare-chapter": {
    reachability: "legacy",
    caller: quartermasterActionCaller('PREPARE_CHAPTER: "prepare-chapter"'),
    disposition: "Live compatibility Quartermaster preparation command; retained as legacy.",
  },
  "mark-solved": {
    reachability: "production",
    caller: playerEventCaller('CHAPTER_SOLVED: "mark-solved"'),
    additionalCallers: quartermasterProductionCaller('MARK_SOLVED: "mark-solved"'),
  },
  pause: {
    reachability: "production",
    caller: playerEventCaller('CAMPAIGN_PAUSED: "pause"'),
    additionalCallers: quartermasterProductionCaller('PAUSE: "pause"'),
  },
  resume: {
    reachability: "production",
    caller: playerEventCaller('CAMPAIGN_RESUMED: "resume"'),
    additionalCallers: quartermasterProductionCaller('RESUME: "resume"'),
  },
  undo: {
    reachability: "production",
    caller: playerEventCaller('STATE_REVERTED: "undo"'),
    additionalCallers: quartermasterProductionCaller('UNDO_LAST: "undo"'),
  },
};

export const sceneContracts = {
  "first-arrival": v2Contract("first-arrival", {
    reachability: "production",
    expectedHostKinds: ["gateway", "journal-opening"],
    targets: [
      v2Required("title", ["clip-path", "opacity"]),
      v2Required("arrival-copy", ["transform", "opacity"], { max: 2 }),
      v2Required("arrival-action", ["transform", "opacity"], { max: 2 }),
      v2Optional("sky", ["opacity"]),
      v2Optional("stars", ["opacity"]),
      v2Optional("moon", ["transform", "opacity"]),
      v2Optional("horizon", ["transform", "opacity"], { max: 2 }),
      v2Optional("ocean", ["transform", "opacity"], { max: 2 }),
      v2Optional("fog-back", ["transform", "opacity"]),
      v2Optional("fog-front", ["transform", "opacity"], { max: 2 }),
      v2Optional("ship", ["transform", "opacity"]),
      v2Optional("emblem", ["transform", "opacity"]),
      v2Optional("nautical-border", ["opacity"]),
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
    finalStatePolicy: v2Reconcile("arrival-readable", "title"),
    reducedFallback: "semantic-final-state",
  }),
  "session-reentry": v2Contract("session-reentry", {
    reachability: "production",
    expectedHostKinds: ["gateway", "journal-opening"],
    targets: [
      v2Required("title", ["transform", "opacity"]),
      v2Required("arrival-action", ["transform", "opacity"], { max: 2 }),
      v2Optional("fog-front", ["transform", "opacity"], { max: 2 }),
    ],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      allowUserSkip: true,
      userSkipFinalState: "reentry-readable",
      allowedFallback: "static-reentry",
      priority: 15,
    }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2Reconcile("reentry-readable", "title"),
    reducedFallback: "semantic-final-state",
  }),
  "player-access": contract("player-access", {
    reachability: "legacy",
    expectedHostKind: "access",
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
    expectedHostKind: "access",
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
  "journal-open": v2Contract("journal-open", {
    reachability: "deprecated",
    expectedHostKinds: ["development-showcase"],
    targets: [],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("journal-readable", "journal-opening-machine"),
    reducedFallback: "none",
    replacedBy: "journal-opening-machine",
  }),
  "manual-page-flip": v2Contract("manual-page-flip", {
    reachability: "deprecated",
    expectedHostKinds: ["development-showcase"],
    targets: [],
    timeoutMs: 1_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("page-readable", "PageFlipBook-manual-controls"),
    reducedFallback: "none",
    replacedBy: "PageFlipBook-manual-controls",
  }),
  "programmatic-page-flip": v2Contract("programmatic-page-flip", {
    reachability: "deprecated",
    expectedHostKinds: ["development-showcase"],
    targets: [],
    timeoutMs: 1_000,
    playbackPolicy: playback("development", { allowPolicySkip: false, priority: 0 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("page-readable", "PageFlipBook-flipTo"),
    reducedFallback: "none",
    replacedBy: "PageFlipBook-flipTo",
  }),
  "chapter-heading": v2Contract("chapter-heading", {
    reachability: "future-contract",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [
      v2Required("ink-heading", ["transform", "opacity"], { max: 2 }),
      ...v2ChapterInheritedOptionalTargets("ink-heading"),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("development", {
      allowedFallback: "static-chapter-heading",
      priority: 10,
    }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("chapter-heading-readable", "static-chapter-heading"),
    reducedFallback: "static-reader",
  }),
  "prose-ink": v2Contract("prose-ink", {
    reachability: "future-contract",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [
      v2Required("ink-story", ["transform", "opacity", "filter"]),
      ...v2ChapterInheritedOptionalTargets("ink-story"),
    ],
    timeoutMs: 5_000,
    playbackPolicy: playback("development", { allowedFallback: "static-prose", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("prose-readable", "static-prose"),
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
  "chapter-release": v2Contract("chapter-release", {
    reachability: "production",
    expectedHostKinds: ["player-progression"],
    targets: [
      v2Required("journal-stage", ["transform"]),
      v2Required("sealed-parchment", ["transform"], { key: "global-sealed-parchment" }),
      v2Required("ink-heading", ["transform", "opacity"], { max: 2 }),
      v2Required("ink-story", ["transform", "opacity", "filter"]),
      v2Required("ink-objective", ["transform", "opacity"]),
      v2Required("ink-riddle", ["clip-path", "opacity"]),
      v2WorkspaceLight(),
      v2Optional("lantern", ["opacity"]),
      v2Optional("companion-header-dim", ["opacity"], { source: externalSource("companion-header-dim") }),
      v2Optional("companion-desktop-navigation-dim", ["opacity"], {
        source: externalSource("companion-desktop-navigation-dim"),
      }),
      v2Optional("companion-mobile-navigation-dim", ["opacity"], {
        source: externalSource("companion-mobile-navigation-dim"),
      }),
      v2Optional("seal", ["transform"]),
      v2Optional("seal-crack", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], { max: 4 }),
      v2Optional("seal-fragment", ["transform", "opacity"], { max: 4 }),
      v2Optional("page-light", ["transform", "opacity"]),
      v2Optional("route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
      v2Optional("map-fog", ["transform", "opacity"]),
      v2Optional("quill", ["transform", "opacity"]),
      v2Optional("quill-path", ["path-drawing"]),
      v2Optional("sealed-parchment", ["transform"], {
        key: "local-sealed-parchment",
        source: externalSource("sealed-parchment"),
      }),
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
    finalStatePolicy: v2Reconcile("chapter-readable", "global-sealed-parchment"),
    reducedFallback: "static-reader",
  }),
  "map-reveal": v2Contract("map-reveal", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("map-marker", ["transform", "opacity"], { key: "map-marker-new" }),
      v2Optional("map-marker", ["transform", "opacity"], {
        key: "local-map-marker",
        source: externalSource("map-marker"),
      }),
      v2Optional("map-fog", ["clip-path", "opacity"], { source: externalSource("map-fog") }),
      v2Optional("route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], {
        source: externalSource("route-path"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_500,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "map-location-readable",
      allowedFallback: "readable-map-location",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("map-location-readable", "map-marker-new"),
    reducedFallback: "semantic-final-state",
  }),
  "route-draw": v2Contract("route-draw", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"], {
        key: "global-route-path",
      }),
      v2Optional("route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"], {
        key: "local-route-path",
        source: externalSource("route-path"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "route-readable",
      allowedFallback: "readable-route",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("route-readable", "global-route-path"),
    reducedFallback: "semantic-final-state",
  }),
  "marker-stamp": v2Contract("marker-stamp", {
    reachability: "future-contract",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [v2Required("map-marker-new", ["transform", "opacity"]), v2WorkspaceLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowedFallback: "static-map-marker", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("map-marker-readable", "static-map-marker"),
    reducedFallback: "static-reader",
  }),
  "ship-course": v2Contract("ship-course", {
    reachability: "future-contract",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [
      v2Required("ship-token", ["transform"]),
      v2Required("route-motion-path", ["path-drawing"]),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("development", { allowedFallback: "static-ship-position", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2StaticFallback("ship-position-readable", "static-ship-position"),
    reducedFallback: "static-reader",
  }),
  "artifact-award": v2Contract("artifact-award", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("artifact-reveal", ["transform", "opacity"]),
      v2RequiredIdentity("artifact-slot-target"),
      v2Optional("artifact-silhouette", ["transform", "opacity", "filter"], {
        key: "local-artifact-slot",
        source: externalSource("artifact-slot"),
      }),
      v2Optional("artifact-light", ["transform", "opacity"]),
      v2WorkspaceLight(),
    ],
    timeoutMs: 5_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "artifact-awarded-readable",
      allowedFallback: "readable-artifact-award",
      priority: 70,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("artifact-awarded-readable", "artifact-slot-target"),
    reducedFallback: "semantic-final-state",
  }),
  "artifact-inspection": v2Contract("artifact-inspection", {
    reachability: "future-contract",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [
      v2Required("artifact-engraving", ["clip-path"]),
      v2Optional("artifact-detail-light", ["transform", "opacity"]),
      v2WorkspaceLight(),
    ],
    timeoutMs: 3_000,
    playbackPolicy: playback("development", { allowedFallback: "static-artifact-engraving", priority: 10 }),
    acknowledgmentPolicy: noAcknowledgment(),
    finalStatePolicy: v2Hold("artifact-engraving-readable"),
    reducedFallback: "static-reader",
  }),
  "artifact-connection": v2Contract("artifact-connection", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("artifact-connection-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"], {
        key: "global-artifact-connection-path",
      }),
      v2Optional("artifact-connection-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"], {
        key: "local-artifact-connection-path",
        source: externalSource("artifact-connection-path"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "artifact-connection-readable",
      allowedFallback: "readable-artifact-connection",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("artifact-connection-readable", "global-artifact-connection-path"),
    reducedFallback: "semantic-final-state",
  }),
  "quest-discovery": v2Contract("quest-discovery", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("quest-note-new", ["transform", "opacity"]),
      v2Optional("red-thread", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
      v2Optional("quest-note-new", ["transform", "opacity"], {
        key: "local-quest-note",
        source: externalSource("quest-note"),
      }),
      v2Optional("red-thread", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"], {
        key: "local-quest-red-thread",
        source: externalSource("quest-red-thread"),
      }),
      v2Optional("quest-objective-updated", ["transform", "opacity"], {
        key: "local-quest-objective",
        source: externalSource("quest-objective"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "quest-readable",
      allowedFallback: "readable-quest-update",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("quest-readable", "quest-note-new"),
    reducedFallback: "semantic-final-state",
  }),
  "quest-complete": v2Contract("quest-complete", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("quest-stamp", ["transform", "opacity"], { key: "global-quest-stamp" }),
      v2Optional("quest-stamp", ["transform", "opacity"], {
        key: "local-quest-stamp",
        source: externalSource("quest-stamp"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "quest-complete-readable",
      allowedFallback: "readable-quest-complete",
      priority: 60,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("quest-complete-readable", "global-quest-stamp"),
    reducedFallback: "semantic-final-state",
  }),
  "log-entry": v2Contract("log-entry", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("log-entry-new", ["opacity", "clip-path", "filter"]),
      v2Optional("log-symbol-new", ["transform", "opacity"]),
      v2Optional("log-entry-new", ["opacity", "clip-path", "filter"], {
        key: "local-log-entry",
        source: externalSource("log-entry"),
      }),
      v2Optional("log-symbol-new", ["transform", "opacity"], {
        key: "local-log-symbol",
        source: externalSource("log-symbol"),
      }),
      v2Optional("annotation-ink", ["opacity", "clip-path", "filter"], {
        key: "local-journal-annotation-ink",
        source: externalSource("journal-annotation-ink"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 3_500,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "log-entry-readable",
      allowedFallback: "readable-log-entry",
      priority: 55,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("log-entry-readable", "log-entry-new"),
    reducedFallback: "semantic-final-state",
  }),
  "finale-tease": v2Contract("finale-tease", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("finale-ring-outer", ["transform"]),
      v2Required("finale-ring-inner", ["transform"]),
      v2Required("finale-light-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
      v2Optional("finale-mechanism", ["transform", "opacity"], {
        key: "local-finale-mechanism",
        source: externalSource("finale-mechanism"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 5_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "finale-tease-readable",
      allowedFallback: "readable-finale-tease",
      priority: 70,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("finale-tease-readable", "finale-light-path"),
    reducedFallback: "semantic-final-state",
  }),
  "finale-requirement": v2Contract("finale-requirement", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("finale-light-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"]),
      v2Optional("finale-requirement-socket", ["transform", "opacity", "filter"], {
        key: "local-finale-requirement-socket",
        source: externalSource("finale-requirement-socket"),
      }),
      v2WorkspaceLight(),
    ],
    timeoutMs: 4_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "finale-requirement-readable",
      allowedFallback: "readable-finale-requirement",
      priority: 65,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("finale-requirement-readable", "finale-light-path"),
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
  "mark-solved": v2Contract("mark-solved", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [
      v2Required("solved-stamp", ["transform", "opacity"]),
      v2Optional("solved-stamp", ["transform", "opacity"], {
        key: "local-chapter-solved-stamp",
        source: externalSource("chapter-solved-stamp"),
      }),
      v2CommandLight(),
    ],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "chapter-solved-readable",
      allowedFallback: "readable-chapter-solved",
      priority: 65,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("chapter-solved-readable", "solved-stamp"),
    reducedFallback: "semantic-final-state",
  }),
  pause: v2Contract("pause", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [v2Required("lantern", ["transform", "opacity"]), v2CommandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "campaign-paused-readable",
      allowedFallback: "readable-campaign-paused",
      priority: 80,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("campaign-paused-readable", "lantern"),
    reducedFallback: "semantic-final-state",
  }),
  resume: v2Contract("resume", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [v2Required("lantern", ["transform", "opacity"]), v2CommandLight()],
    timeoutMs: 3_000,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "campaign-resumed-readable",
      allowedFallback: "readable-campaign-resumed",
      priority: 80,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("campaign-resumed-readable", "lantern"),
    reducedFallback: "semantic-final-state",
  }),
  undo: v2Contract("undo", {
    reachability: "production",
    expectedHostKinds: ["player-progression", "quartermaster-command"],
    targets: [v2Required("undo-mark", ["transform", "opacity"]), v2CommandLight()],
    timeoutMs: 3_500,
    playbackPolicy: playback("automatic", {
      replayable: true,
      allowUserSkip: true,
      userSkipFinalState: "state-restored-readable",
      allowedFallback: "readable-state-restored",
      priority: 85,
    }),
    acknowledgmentPolicy: playerEventAcknowledgment(),
    finalStatePolicy: v2Reconcile("state-restored-readable", "undo-mark"),
    reducedFallback: "semantic-final-state",
  }),
} satisfies Record<AnimationSceneName, AnySceneTargetContract>;

type AnySceneDefinition = SceneDefinition | SceneDefinitionV2;

const definitions: AnySceneDefinition[] = [
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

export type RegisteredSceneDefinition = AnySceneDefinition & { contract: AnySceneTargetContract };

export const sceneRegistry = Object.fromEntries(
  definitions.map((definition) => [
    definition.name,
    { ...definition, contract: sceneContracts[definition.name] } satisfies RegisteredSceneDefinition,
  ]),
) as Record<AnimationSceneName, RegisteredSceneDefinition>;

export function getSceneDefinition(name: AnimationSceneName) {
  return sceneRegistry[name];
}
