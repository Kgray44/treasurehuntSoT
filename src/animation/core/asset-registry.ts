import { lottieAssets } from "../assets/lottie-contracts";
import { riveAssets } from "../assets/rive-contracts";

export type AnimationAsset = {
  key: string;
  type: "rive" | "lottie" | "svg" | "still";
  path?: string;
  owner: "rive" | "lottie" | "gsap" | "css";
  pages: readonly string[];
  behavior: Readonly<{ full: string; gentle: string; reduced: string }>;
  priority: "critical" | "idle" | "intent";
  provenance: string;
  fallback?: string;
  dimensions?: string;
  developmentOnly?: boolean;
};

export const animationAssets: AnimationAsset[] = [
  ...Object.values(riveAssets).map((asset) => ({
    key: asset.key,
    type: "rive" as const,
    path: asset.path,
    owner: "rive" as const,
    pages: asset.pages,
    behavior: asset.behavior,
    priority: asset.priority,
    provenance: asset.provenance,
    fallback: asset.fallback,
    dimensions: asset.dimensions,
    developmentOnly: asset.developmentOnly,
  })),
  ...Object.values(lottieAssets).map((asset) => ({
    key: asset.key,
    type: "lottie" as const,
    path: asset.path,
    owner: "lottie" as const,
    pages: asset.pages,
    behavior: asset.behavior,
    priority: asset.priority,
    provenance: asset.provenance,
    fallback: asset.fallback,
    dimensions: asset.dimensions,
  })),
  {
    key: "voyage-chart",
    type: "svg",
    path: "/illustrations/chart/voyage-chart.svg",
    owner: "gsap",
    pages: ["chart"],
    behavior: { full: "route draw and fog reveal", gentle: "short route draw", reduced: "static complete chart" },
    priority: "intent",
    provenance: "Original procedural SVG authored for Forever Treasure.",
    fallback: "/animations/stills/chart-fallback.svg",
    dimensions: "viewBox 0 0 1200 780",
  },
  {
    key: "celestial-mechanism",
    type: "svg",
    path: "/illustrations/finale/celestial-mechanism.svg",
    owner: "gsap",
    pages: ["finale"],
    behavior: { full: "layered ring choreography", gentle: "short ring activation", reduced: "static state pose" },
    priority: "intent",
    provenance: "Original procedural SVG authored for Forever Treasure.",
    fallback: "/animations/stills/finale-fallback.svg",
    dimensions: "viewBox 0 0 640 640",
  },
];

export function assetByKey(key: string) {
  return animationAssets.find((asset) => asset.key === key);
}
