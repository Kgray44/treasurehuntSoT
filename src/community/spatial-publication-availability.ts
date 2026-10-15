import type { SpatialDraft } from "@/parallax/authoring";
import { matchesExtractedComposition } from "@/parallax/element-authoring";
import type { EnvironmentRecord } from "@/parallax/environment-contracts";

/** Client presentation hint only. The server's exact-revision review remains authoritative. */
export function knownSpatialPublicationLimit(
  draft: SpatialDraft,
  environments: readonly EnvironmentRecord[] = [],
  ownedItems: readonly { id: string; draft: SpatialDraft; readOnly?: boolean }[] = [],
): string | null {
  if (draft.scope !== "MY_LIBRARY") return "Save this item to My Spatial Library before publishing.";
  if (draft.lineage) {
    const parent = ownedItems.find((item) => item.id === draft.lineage?.definitionId && !item.readOnly);
    if (!parent || !matchesExtractedComposition(parent.draft, draft))
      return "This remix needs verified redistribution rights. Save a fresh composition from its current owned source.";
  }
  if (draft.content.entities.some((entity) => entity.element?.kind === "PHYSICAL_ASSET"))
    return "Physical models need owner redistribution authorization and a resolved package dependency.";
  if (draft.content.studio?.assets.length)
    return "Referenced models, textures or audio need resolved bytes, scanner evidence and redistribution rights.";
  if (draft.content.studio?.visionReferences.length)
    return "Private Vision or calibration references cannot enter a Community package.";
  if (
    draft.content.adaptive?.calibration.enabled ||
    draft.content.adaptive?.calibration.reviewReceiptId ||
    draft.content.placementPolicy === "CALIBRATED"
  )
    return "Private calibration evidence or calibrated placement cannot be published as portable content.";
  const reference = draft.content.environment;
  const record = environments.find((candidate) => candidate.id === reference?.environmentId);
  const pinned = record?.versions.find((version) => version.reference.versionId === reference?.versionId);
  if (record && pinned) {
    if (record.builtin || record.readOnly || pinned.content.origin !== "MANUAL")
      return "This Scene needs an owned synthetic Environment before it can be distributed.";
    if (pinned.content.evidence.source !== "SIMULATED")
      return "Measured real-world room evidence cannot enter a Community package.";
  }
  return null;
}

export function knownEnvironmentPublicationLimit(environment: EnvironmentRecord): string | null {
  if (environment.builtin || environment.readOnly || environment.current.content.origin === "BUILTIN")
    return "Only an owned editable Environment can be published.";
  if (environment.current.content.origin === "RECONSTRUCTED")
    return "A reconstructed real-world room cannot be distributed. Create an owned synthetic Environment instead.";
  if (environment.current.content.evidence.source !== "SIMULATED")
    return "Measured real-world room evidence cannot enter a Community package.";
  return null;
}
