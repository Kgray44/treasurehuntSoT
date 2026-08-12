export const authoringModes = ["GUIDED", "DETAILED", "ENGINEERING"] as const;
export type AuthoringMode = (typeof authoringModes)[number];

export const inspectorSectionIds = [
  "CONTENT",
  "BEHAVIOR",
  "COMPLETION",
  "PRESENTATION",
  "ACCESSIBILITY",
  "ADVANCED",
] as const;
export type InspectorSectionId = (typeof inspectorSectionIds)[number];

export type AuthoringStrategy =
  | "PURPOSE_BUILT"
  | "CONTRACT_GENERATED"
  | "HYBRID"
  | "DOMAIN_ADAPTER"
  | "SAFE_GENERIC_FALLBACK";

export type ShipwrightAuthoringAdapter = {
  blockType: string;
  displayName: string;
  strategy: AuthoringStrategy;
  sections: readonly InspectorSectionId[];
  guidedSummary: string;
};

const purposeBuilt = new Set([
  "narrative",
  "choice",
  "artifactReveal",
  "wait",
  "condition",
  "setVariable",
  "chapterComplete",
  "taleComplete",
]);

const domainAdapters = new Set(["location", "arrivalCheck"]);

const hybrid = new Set(["imageTransformation"]);

const titleFor = (type: string) => type.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());

function strategyFor(type: string): AuthoringStrategy {
  if (purposeBuilt.has(type)) return "PURPOSE_BUILT";
  if (domainAdapters.has(type)) return "DOMAIN_ADAPTER";
  if (hybrid.has(type)) return "HYBRID";
  return "CONTRACT_GENERATED";
}

export function getShipwrightAuthoringAdapter(
  blockType: string,
  hasCanonicalContract = false,
): ShipwrightAuthoringAdapter {
  if (!hasCanonicalContract)
    return {
      blockType,
      displayName: titleFor(blockType),
      strategy: "SAFE_GENERIC_FALLBACK",
      sections: inspectorSectionIds,
      guidedSummary: "This Passage uses a current contract without a specialized Studio editor yet.",
    };
  return {
    blockType,
    displayName: titleFor(blockType),
    strategy: strategyFor(blockType),
    sections: inspectorSectionIds,
    guidedSummary:
      blockType === "choice"
        ? "Give each path a clear label and choose where it leads."
        : blockType === "condition"
          ? "Build the rule from declared variables, then choose both destinations."
          : blockType === "setVariable"
            ? "Choose a declared variable and the action this Passage performs."
            : "Complete the essential Player-facing details first; Drydock will guide any remaining work.",
  };
}

export function sectionForFieldPath(fieldPath?: string | null): InspectorSectionId {
  if (!fieldPath) return "ADVANCED";
  if (fieldPath.startsWith("presentation.")) return "PRESENTATION";
  if (fieldPath.startsWith("completion.")) return "COMPLETION";
  if (/altText|transcript|captions|poster|nonMotionMeaning|accessible|fallback/i.test(fieldPath))
    return "ACCESSIBILITY";
  if (/target|choice|variable|expression|operation|provider|duration|visibility|recipient/i.test(fieldPath))
    return "BEHAVIOR";
  if (fieldPath.startsWith("configuration.")) return "CONTENT";
  return "ADVANCED";
}
