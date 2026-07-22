export type RiveInputContract = Readonly<{ name: string; type: "boolean" | "number" | "trigger" }>;

export type RiveAssetContract = Readonly<{
  /** Stable Project Lanternwake asset identity. It is distinct from a filename or UI label. */
  key: string;
  assetId: string;
  path?: string;
  artboard?: string;
  stateMachine: string;
  inputs: readonly RiveInputContract[];
  states: readonly string[];
  /** Input values that produce the stable, non-travelling reduced pose before an authoritative semantic signal. */
  reducedPose: Readonly<Record<string, boolean | number>>;
  /** Signals that may update a semantic pose without enabling physical state travel. */
  reducedSemanticSignals: readonly string[];
  fallback: string;
  fallbackStates: readonly string[];
  availability: "runtime-ready" | "blocked_external_asset";
  version: string;
  loadTimeoutMs: number;
  pages: readonly string[];
  behavior: Readonly<{ full: string; gentle: string; reduced: string }>;
  priority: "critical" | "idle" | "intent";
  provenance: string;
  dimensions: string;
  developmentOnly?: boolean;
}>;

export const invitationSealStatus = Object.freeze({
  idle: 0,
  validating: 1,
  accepted: 2,
  rejected: 3,
  expired: 4,
  revoked: 5,
  opening: 6,
  open: 7,
});

export const journalClaspOpeningPhase = Object.freeze({
  locked: 0,
  awake: 1,
  releasing: 2,
  opening: 3,
  open: 4,
  interrupted: 5,
  resetting: 6,
});

export const voyageCompassConnectionStatus = Object.freeze({
  idle: 0,
  seeking: 1,
  bearing: 2,
  courseSet: 3,
  arrived: 4,
  disconnected: 5,
  adrift: 6,
  locked: 7,
  resetting: 8,
});

export const finaleMechanismStage = Object.freeze({
  dormant: 0,
  teased: 1,
  sealed: 2,
  partial: 3,
  ready: 4,
  unlocking: 5,
  unlocked: 6,
  complete: 7,
  historical: 8,
  resetting: 9,
});

const blockedProductionAsset = (asset: Omit<RiveAssetContract, "availability" | "provenance">): RiveAssetContract => ({
  ...asset,
  availability: "blocked_external_asset",
  provenance:
    "Project Lanternwake production contract is frozen; the genuine project-authored Rive export is pending the external Rive authoring handoff. The SVG/CSS fallback remains the only production rendering until that handoff is validated.",
});

const runtimeReadyProductionAsset = (
  asset: Omit<RiveAssetContract, "availability" | "provenance">,
): RiveAssetContract => ({
  ...asset,
  availability: "runtime-ready",
  provenance:
    "Project-owned Lanternwake source SVG and Rive .rev backup are governed in Development_Docs/Animation_Assets/Rive_Sources; the matching local .riv export is validated for production runtime use.",
});

export const riveAssets = {
  invitationSeal: runtimeReadyProductionAsset({
    key: "invitation-seal",
    assetId: "invitationSeal",
    path: "/animations/rive/invitation-seal-v1.riv",
    artboard: "InvitationSeal",
    stateMachine: "InvitationSealSM",
    inputs: [
      { name: "isHovering", type: "boolean" },
      { name: "isFocused", type: "boolean" },
      { name: "isPressed", type: "boolean" },
      { name: "isListening", type: "boolean" },
      { name: "pinProgress", type: "number" },
      { name: "status", type: "number" },
      { name: "accept", type: "trigger" },
      { name: "reject", type: "trigger" },
      { name: "expire", type: "trigger" },
      { name: "revoke", type: "trigger" },
      { name: "open", type: "trigger" },
      { name: "reset", type: "trigger" },
      { name: "reducedMotion", type: "boolean" },
    ],
    states: [
      "idle",
      "hover",
      "focus",
      "pressed",
      "listening",
      "validating",
      "pin-progress",
      "accepted",
      "rejected",
      "expired",
      "revoked",
      "opening",
      "open",
      "resetting",
    ],
    reducedPose: { status: invitationSealStatus.idle, pinProgress: 0, reducedMotion: true },
    reducedSemanticSignals: ["status", "pinProgress", "reducedMotion"],
    fallback: "/animations/stills/seal-fallback.svg",
    fallbackStates: ["idle", "validating", "accepted/open", "rejected", "expired", "revoked"],
    version: "v1",
    loadTimeoutMs: 5_000,
    pages: ["invitation", "access"],
    behavior: {
      full: "authoritative state-machine transitions with bounded internal material response",
      gentle: "short state transitions without fracture travel",
      reduced: "stable semantic status pose without fracture travel or spinning fragments",
    },
    priority: "critical",
    dimensions: "512 x 512 source; responsive contain",
  }),
  journalClasp: runtimeReadyProductionAsset({
    key: "journal-clasp",
    assetId: "journalClasp",
    path: "/animations/rive/journal-clasp-v1.riv",
    artboard: "JournalClasp",
    stateMachine: "JournalClaspSM",
    inputs: [
      { name: "isHovering", type: "boolean" },
      { name: "isFocused", type: "boolean" },
      { name: "openingPhase", type: "number" },
      { name: "pressure", type: "number" },
      { name: "wake", type: "trigger" },
      { name: "release", type: "trigger" },
      { name: "open", type: "trigger" },
      { name: "interrupt", type: "trigger" },
      { name: "reset", type: "trigger" },
      { name: "reducedMotion", type: "boolean" },
    ],
    states: [
      "locked",
      "idle",
      "hover",
      "focus",
      "awake",
      "pressure",
      "releasing",
      "opening",
      "open",
      "interrupted",
      "resetting",
    ],
    reducedPose: { openingPhase: journalClaspOpeningPhase.locked, pressure: 0, reducedMotion: true },
    reducedSemanticSignals: ["openingPhase", "pressure", "reducedMotion"],
    fallback: "/animations/stills/journal-clasp-fallback.svg",
    fallbackStates: ["locked", "awake", "opening", "open", "interrupted"],
    version: "v1",
    loadTimeoutMs: 5_000,
    pages: ["waiting-room", "journal"],
    behavior: {
      full: "authoritative phase-driven clasp tension, release, and stable open pose",
      gentle: "short phase transitions with restrained material response",
      reduced: "immediate locked/open semantic pose without repeated oscillation",
    },
    priority: "critical",
    dimensions: "512 x 512 source; responsive contain",
  }),
  voyageCompass: runtimeReadyProductionAsset({
    key: "voyage-compass",
    assetId: "voyageCompass",
    path: "/animations/rive/voyage-compass-v1.riv",
    artboard: "VoyageCompass",
    stateMachine: "VoyageCompassSM",
    inputs: [
      { name: "bearingDegrees", type: "number" },
      { name: "courseProgress", type: "number" },
      { name: "connectionStatus", type: "number" },
      { name: "hasCourse", type: "boolean" },
      { name: "seeking", type: "trigger" },
      { name: "setCourse", type: "trigger" },
      { name: "arrive", type: "trigger" },
      { name: "disconnect", type: "trigger" },
      { name: "reset", type: "trigger" },
      { name: "reducedMotion", type: "boolean" },
    ],
    states: ["idle", "seeking", "bearing", "course-set", "arrived", "disconnected", "adrift", "locked", "resetting"],
    reducedPose: {
      bearingDegrees: 0,
      courseProgress: 0,
      connectionStatus: voyageCompassConnectionStatus.idle,
      hasCourse: false,
      reducedMotion: true,
    },
    reducedSemanticSignals: ["bearingDegrees", "courseProgress", "connectionStatus", "hasCourse", "reducedMotion"],
    fallback: "/animations/stills/compass-fallback.svg",
    fallbackStates: ["idle", "bearing", "arrived", "disconnected", "locked"],
    version: "v1",
    loadTimeoutMs: 5_000,
    pages: ["waiting-room", "chart"],
    behavior: {
      full: "authoritative shortest-path bearing with bounded seeking and damped settle",
      gentle: "shortened bearing movement with the same final heading",
      reduced: "immediate authoritative bearing and readable connection state",
    },
    priority: "intent",
    dimensions: "512 x 512 source; responsive contain",
  }),
  finaleMechanism: blockedProductionAsset({
    key: "finale-mechanism",
    assetId: "finaleMechanism",
    path: "/animations/rive/finale-mechanism-v1.riv",
    artboard: "FinaleMechanism",
    stateMachine: "FinaleMechanismSM",
    inputs: [
      { name: "stage", type: "number" },
      { name: "overallProgress", type: "number" },
      { name: "activeRequirement", type: "number" },
      { name: "requirementProgress", type: "number" },
      { name: "isReady", type: "boolean" },
      { name: "tease", type: "trigger" },
      { name: "activateRequirement", type: "trigger" },
      { name: "unlock", type: "trigger" },
      { name: "complete", type: "trigger" },
      { name: "showHistorical", type: "trigger" },
      { name: "reset", type: "trigger" },
      { name: "reducedMotion", type: "boolean" },
    ],
    states: [
      "dormant",
      "teased",
      "sealed",
      "partial",
      "ready",
      "unlocking",
      "unlocked",
      "complete",
      "historical",
      "resetting",
    ],
    reducedPose: {
      stage: finaleMechanismStage.dormant,
      overallProgress: 0,
      activeRequirement: -1,
      requirementProgress: 0,
      isReady: false,
      reducedMotion: true,
    },
    reducedSemanticSignals: [
      "stage",
      "overallProgress",
      "activeRequirement",
      "requirementProgress",
      "isReady",
      "reducedMotion",
    ],
    fallback: "/animations/stills/finale-fallback.svg",
    fallbackStates: ["dormant", "teased", "partial", "ready", "unlocked", "complete", "historical"],
    version: "v1",
    loadTimeoutMs: 6_000,
    pages: ["finale"],
    behavior: {
      full: "authoritative sockets, ring inertia, unlock, and stable completion held inside the Rive artboard",
      gentle: "short bounded alignment and settle with the same semantic states",
      reduced: "stable progression state without ring travel or inertia",
    },
    priority: "critical",
    dimensions: "640 x 640 source; responsive contain",
  }),
  developmentRating: {
    key: "development-rating",
    assetId: "developmentRating",
    path: "/animations/rive/rating-animation.riv",
    stateMachine: "State Machine 1",
    inputs: [],
    states: ["runtime-ready", "input-controlled"],
    reducedPose: {},
    reducedSemanticSignals: [],
    fallback: "/animations/stills/rive-sample-fallback.svg",
    fallbackStates: ["static"],
    availability: "runtime-ready",
    version: "development-sample",
    loadTimeoutMs: 5_000,
    pages: ["development showcase"],
    behavior: {
      full: "interactive state machine",
      gentle: "interactive state machine",
      reduced: "autoplay disabled; inputs remain available",
    },
    priority: "intent",
    provenance:
      "Rive runtime repository example, MIT License, Copyright 2020-2021 Rive. Development-only; never production proof.",
    dimensions: "400 x 400 source; responsive contain",
    developmentOnly: true,
  },
} satisfies Record<string, RiveAssetContract>;
