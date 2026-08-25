export type DrydockAdjacentAdapter = Readonly<{
  id: "harborlight" | "sealed-hold" | "lanternwake" | "landfall" | "artifact";
  owner: string;
  version: string;
  /** CONTRACT_ONLY is a declared/read-only contract, not an installed runtime handoff. */
  state: "CONTRACT_ONLY" | "UNAVAILABLE";
  supportedAuthoringContracts: readonly string[];
  validationContribution: string;
  externalEvidenceKind?: string;
  unsupportedBehavior: "NOT_REQUIRED_WHEN_UNUSED" | "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED";
}>;

/** Versioned boundary declarations; domain truth remains with each owning project. */
export const drydockAdjacentAdapters: readonly DrydockAdjacentAdapter[] = [
  {
    id: "harborlight",
    owner: "Project Harborlight",
    version: "contract-v1",
    state: "CONTRACT_ONLY",
    supportedAuthoringContracts: ["community-package-v1", "remix-lineage-v1"],
    validationContribution:
      "Names package, dependency, license, attribution, and install compatibility facts without claiming a Drydock install/remix handoff.",
    externalEvidenceKind: "community-package-handoff",
    unsupportedBehavior: "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED",
  },
  {
    id: "sealed-hold",
    owner: "Project Sealed Hold",
    version: "contract-v1",
    state: "CONTRACT_ONLY",
    supportedAuthoringContracts: ["protected-asset-v1"],
    validationContribution:
      "Names protected asset scan, quarantine, and safe-preview facts without connecting a protected-content provider.",
    externalEvidenceKind: "protected-asset-state",
    unsupportedBehavior: "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED",
  },
  {
    id: "lanternwake",
    owner: "Project Lanternwake",
    version: "contract-v1",
    state: "CONTRACT_ONLY",
    supportedAuthoringContracts: ["scene-fallback-v1"],
    validationContribution:
      "Names scene and reduced-motion fallback facts while the presentation owner retains runtime authority.",
    externalEvidenceKind: "presentation-contract",
    unsupportedBehavior: "NOT_REQUIRED_WHEN_UNUSED",
  },
  {
    id: "landfall",
    owner: "Project Landfall",
    version: "adapter-unavailable",
    state: "UNAVAILABLE",
    supportedAuthoringContracts: [],
    validationContribution: "Reserves source-bound location-provider and field-evidence integration.",
    externalEvidenceKind: "field-evidence",
    unsupportedBehavior: "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED",
  },
  {
    id: "artifact",
    owner: "Artifact domain",
    version: "adapter-unavailable",
    state: "UNAVAILABLE",
    supportedAuthoringContracts: [],
    validationContribution: "Reserves representation, fallback, performance, and accessibility evidence integration.",
    externalEvidenceKind: "artifact-evidence",
    unsupportedBehavior: "NOT_REQUIRED_WHEN_UNUSED",
  },
];

export function drydockAdjacentAdapter(id: DrydockAdjacentAdapter["id"]) {
  return drydockAdjacentAdapters.find((adapter) => adapter.id === id) ?? null;
}
