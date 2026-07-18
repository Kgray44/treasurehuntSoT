export type LottieAssetContract = {
  key: string;
  path: string;
  renderer: "svg" | "canvas";
  loop: boolean;
  fallback: string;
  pages: string[];
  behavior: { full: string; gentle: string; reduced: string };
  priority: "critical" | "idle" | "intent";
  provenance: string;
  dimensions: string;
};

export const lottieAssets = {
  moonlitWaves: {
    key: "moonlit-waves",
    path: "/animations/lottie/moonlit-waves.json",
    renderer: "svg",
    loop: true,
    fallback: "/animations/stills/waves-fallback.svg",
    pages: ["landing", "access"],
    behavior: { full: "long ambient loop", gentle: "0.65x speed", reduced: "representative frame" },
    priority: "critical",
    provenance: "Original shape-layer Lottie authored for Forever Treasure.",
    dimensions: "1200 x 320",
  },
  rollingFog: {
    key: "rolling-fog",
    path: "/animations/lottie/rolling-fog.json",
    renderer: "svg",
    loop: true,
    fallback: "/animations/stills/fog-fallback.svg",
    pages: ["landing", "chart", "finale"],
    behavior: { full: "slow loop", gentle: "lower opacity and speed", reduced: "representative frame" },
    priority: "idle",
    provenance: "Original shape-layer Lottie authored for Forever Treasure.",
    dimensions: "1200 x 420",
  },
  inkBloom: {
    key: "ink-bloom",
    path: "/animations/lottie/ink-bloom.json",
    renderer: "svg",
    loop: false,
    fallback: "/animations/stills/ink-fallback.svg",
    pages: ["journal", "log", "quest ledger"],
    behavior: { full: "single bloom and dry", gentle: "short bloom", reduced: "static ink stain" },
    priority: "intent",
    provenance: "Original shape-layer Lottie authored for Forever Treasure.",
    dimensions: "320 x 320",
  },
} satisfies Record<string, LottieAssetContract>;
