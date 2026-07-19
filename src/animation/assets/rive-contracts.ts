export type RiveInputContract = Readonly<{ name: string; type: "boolean" | "number" | "trigger" }>;
export type RiveAssetContract = {
  key: string;
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
  availability: "runtime-ready" | "blocked_external_asset";
  pages: string[];
  behavior: { full: string; gentle: string; reduced: string };
  priority: "critical" | "idle" | "intent";
  provenance: string;
  dimensions: string;
  developmentOnly?: boolean;
};

const productionFallback = (
  key: string,
  stateMachine: string,
  inputs: readonly RiveInputContract[],
  states: readonly string[],
  reducedPose: Readonly<Record<string, boolean | number>>,
  reducedSemanticSignals: readonly string[],
  fallback: string,
  pages: string[],
): RiveAssetContract => ({
  key,
  stateMachine,
  inputs,
  states,
  reducedPose,
  reducedSemanticSignals,
  fallback,
  availability: "blocked_external_asset",
  pages,
  behavior: {
    full: "stateful interactive object when original art is supplied",
    gentle: "short state transitions",
    reduced: "stable static pose",
  },
  priority: "intent",
  provenance:
    "Runtime contract only; production uses the original SVG/CSS fallback until a project-authored .riv is supplied.",
  dimensions: "responsive 1:1",
});

export const riveAssets = {
  invitationSeal: productionFallback(
    "invitation-seal",
    "Invitation Seal",
    [],
    ["idle", "hover", "pressed", "listening", "opening", "rejected"],
    {},
    [],
    "/animations/stills/seal-fallback.svg",
    ["access"],
  ),
  journalClasp: productionFallback(
    "journal-clasp",
    "Journal Clasp",
    [
      { name: "state", type: "number" },
      { name: "wake", type: "trigger" },
      { name: "release", type: "trigger" },
    ],
    ["locked", "awake", "opening", "open"],
    { state: 0 },
    ["state"],
    "/animations/stills/journal-clasp-fallback.svg",
    ["journal"],
  ),
  voyageCompass: productionFallback(
    "voyage-compass",
    "Voyage Compass",
    [
      { name: "state", type: "number" },
      { name: "bearing", type: "number" },
      { name: "arrive", type: "trigger" },
    ],
    ["idle", "bearing", "arrived"],
    { state: 0, bearing: 0 },
    ["state", "bearing"],
    "/animations/stills/compass-fallback.svg",
    ["landing", "chart"],
  ),
  finaleMechanism: productionFallback(
    "finale-mechanism",
    "Finale Mechanism",
    [
      { name: "state", type: "number" },
      { name: "progress", type: "number" },
      { name: "wake", type: "trigger" },
      { name: "unlock", type: "trigger" },
      { name: "audioLevel", type: "number" },
    ],
    ["dormant", "teased", "sealed", "partial", "ready", "unlocking", "unlocked", "complete"],
    { state: 0, progress: 0, audioLevel: 0 },
    ["state", "progress"],
    "/animations/stills/finale-fallback.svg",
    ["finale"],
  ),
  developmentRating: {
    key: "development-rating",
    path: "/animations/rive/rating-animation.riv",
    stateMachine: "State Machine 1",
    inputs: [],
    states: ["runtime-ready", "input-controlled"],
    reducedPose: {},
    reducedSemanticSignals: [],
    fallback: "/animations/stills/rive-sample-fallback.svg",
    availability: "runtime-ready",
    pages: ["development showcase"],
    behavior: {
      full: "interactive state machine",
      gentle: "interactive state machine",
      reduced: "autoplay disabled; inputs remain available",
    },
    priority: "intent",
    provenance: "Rive runtime repository example, MIT License, Copyright 2020-2021 Rive.",
    dimensions: "400 x 400 source; responsive contain",
    developmentOnly: true,
  },
} satisfies Record<string, RiveAssetContract>;
