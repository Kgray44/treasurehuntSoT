import type { SpatialDraft } from "@/parallax/authoring";
import { matchesExtractedComposition } from "@/parallax/element-authoring";
import type { CompatibleEnvironmentRecord } from "@/parallax/environment-library-compatibility";

function environmentLimit(
  record: CompatibleEnvironmentRecord,
  version: CompatibleEnvironmentRecord["versions"][number],
) {
  if (record.builtin || ("readOnly" in record && record.readOnly) || record.saveState !== "SAVED")
    return "Save an owned editable Environment before publishing it.";
  if ("content" in version) {
    if (version.content.origin !== "MANUAL")
      return "A reconstructed or built-in room cannot be distributed. Create an owned synthetic Environment instead.";
    if (version.content.evidence.source !== "SIMULATED")
      return "Measured real-world room evidence cannot enter a Community package.";
    return null;
  }
  if (!version.room || version.room.origin !== "MANUAL")
    return "A reconstructed or built-in room cannot be distributed. Create an owned synthetic Environment instead.";
  if (
    version.room.scaleReference ||
    version.room.features.some(
      (feature) =>
        feature.provenance.sourceMediaIds.length > 0 ||
        !["SIMULATED", "CREATOR_CONFIRMED"].includes(feature.provenance.basis),
    )
  )
    return "Observed, measured or media-derived room features cannot enter a Community package.";
  return null;
}

/** Client presentation hint only. The server's exact-revision review remains authoritative. */
export function knownSpatialPublicationLimit(
  draft: SpatialDraft,
  environments: readonly CompatibleEnvironmentRecord[] = [],
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
  if (draft.content.studio?.assetInstances?.length)
    return "Placed reusable assets need verified source licenses and pinned package dependencies before publishing.";
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
  if (draft.content.anchors.some((anchor) => anchor.kind === "FIXED_WORLDSPACE"))
    return "A fixed real-world anchor can reveal location metadata. Use a portable local or surface anchor.";
  const reference = draft.content.environment;
  const record = environments.find((candidate) => candidate.id === reference?.environmentId);
  const pinned = record?.versions.find((version) => version.reference.versionId === reference?.versionId);
  if (record && pinned) {
    return environmentLimit(record, pinned);
  }
  return null;
}

export function knownEnvironmentPublicationLimit(
  environment: CompatibleEnvironmentRecord,
  versionId: string,
): string | null {
  const selected = environment.versions.find((version) => version.reference.versionId === versionId);
  return selected
    ? environmentLimit(environment, selected)
    : "Select an immutable Environment version before publishing.";
}
