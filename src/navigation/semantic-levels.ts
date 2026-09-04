import type { NavigationLayer } from "./types";

export const navigationSemanticLevels = {
  global: "GLOBAL",
  product: "PRODUCT",
  section: "SECTION",
  contextual: "CONTEXTUAL",
  longPage: "LONG_PAGE",
} as const;

export type NavigationSemanticLevel = (typeof navigationSemanticLevels)[keyof typeof navigationSemanticLevels];

/**
 * The existing shell registry predates Brightwork's terminology. This bridge
 * preserves its API while making the intended visual hierarchy explicit.
 */
export function semanticLevelForNavigationLayer(layer: NavigationLayer): NavigationSemanticLevel {
  switch (layer) {
    case "GLOBAL":
    case "ACCOUNT":
      return navigationSemanticLevels.global;
    case "WORKSPACE":
      return navigationSemanticLevels.product;
    case "CONTEXTUAL":
      return navigationSemanticLevels.contextual;
  }
}
