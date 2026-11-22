import { CommunityError } from "./domain";

export function assertArtifactExchangeType(itemType: string) {
  if (itemType !== "ARTIFACT_2D" && itemType !== "ARTIFACT_3D")
    throw new CommunityError(
      "COMMUNITY_DEDICATED_FLOW_REQUIRED",
      "Use the dedicated Community review flow for this content type.",
    );
}
