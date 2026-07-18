export type RiveInputContract = { name: string; type: "boolean" | "number" | "trigger" };
export type RiveAssetContract = {
  key: string;
  path?: string;
  artboard?: string;
  stateMachine: string;
  inputs: RiveInputContract[];
  states: string[];
  fallback: string;
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
  states: string[],
  fallback: string,
  pages: string[],
): RiveAssetContract => ({
  key,
  stateMachine,
  inputs: [],
  states,
  fallback,
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
    ["idle", "hover", "pressed", "listening", "opening", "rejected"],
    "/animations/stills/seal-fallback.svg",
    ["access"],
  ),
  journalClasp: productionFallback(
    "journal-clasp",
    "Journal Clasp",
    ["locked", "awake", "opening", "open"],
    "/animations/stills/journal-clasp-fallback.svg",
    ["journal"],
  ),
  voyageCompass: productionFallback(
    "voyage-compass",
    "Voyage Compass",
    ["idle", "bearing", "arrived"],
    "/animations/stills/compass-fallback.svg",
    ["landing", "chart"],
  ),
  finaleMechanism: productionFallback(
    "finale-mechanism",
    "Finale Mechanism",
    ["dormant", "teased", "sealed", "partial", "ready", "unlocking", "unlocked", "complete"],
    "/animations/stills/finale-fallback.svg",
    ["finale"],
  ),
  developmentRating: {
    key: "development-rating",
    path: "/animations/rive/rating-animation.riv",
    stateMachine: "State Machine 1",
    inputs: [],
    states: ["runtime-ready", "input-controlled"],
    fallback: "/animations/stills/rive-sample-fallback.svg",
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
