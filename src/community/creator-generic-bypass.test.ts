import { describe, expect, it } from "vitest";
import { assertArtifactExchangeType } from "./domain";

describe("Exchange source authority", () => {
  it.each(["CHRONICLE", "CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET", "SPATIAL_SCENE"])(
    "requires the dedicated publication path for %s",
    (itemType) => {
      expect(() => assertArtifactExchangeType(itemType)).toThrow(
        expect.objectContaining({ code: "COMMUNITY_DEDICATED_FLOW_REQUIRED" }),
      );
    },
  );
  it.each(["ARTIFACT_2D", "ARTIFACT_3D"])("keeps the existing scanned Exchange path for %s", (itemType) => {
    expect(() => assertArtifactExchangeType(itemType)).not.toThrow();
  });
});
