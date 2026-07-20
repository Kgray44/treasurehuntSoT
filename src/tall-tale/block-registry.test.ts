import { describe, expect, it } from "vitest";
import {
  blockRegistry,
  blockTypeIds,
  getBlockDefinition,
  providerForBlock,
  serializeBlockRegistry,
} from "@/tall-tale/block-registry";

describe("Voyagewright Studio Passage registry", () => {
  it("registers every required Phase 1 block type exactly once", () => {
    expect(blockTypeIds).toEqual([
      "narrative",
      "captainsNote",
      "riddle",
      "information",
      "travelDirection",
      "location",
      "arrivalCheck",
      "image",
      "imageTransformation",
      "cinematic",
      "audio",
      "artifactReveal",
      "hiddenMessageReveal",
      "collectionUpdate",
      "confirmation",
      "choice",
      "textAnswer",
      "captainApproval",
      "wait",
      "condition",
      "setVariable",
      "chapterComplete",
      "taleComplete",
    ]);
    expect(new Set(blockTypeIds).size).toBe(blockTypeIds.length);
  });

  it("keeps editor, renderer, validation, and migration metadata together", () => {
    for (const definition of Object.values(blockRegistry)) {
      expect(definition.type).toBeTruthy();
      expect(definition.displayName).toBeTruthy();
      expect(definition.fields).toBeInstanceOf(Array);
      expect(definition.defaultConfiguration).toBeTypeOf("object");
      expect(definition.schemaVersion).toBe(1);
      expect(definition.validationSchema).toBeTruthy();
    }
  });

  it("uses Chronicle, Passage, and Voyage terminology in creator-facing registry copy", () => {
    expect(blockRegistry.narrative.category).toBe("Narrative");
    expect(blockRegistry.narrative.description).toContain("Passage");
    expect(blockRegistry.choice.description).toContain("Chronicle flow");
    expect(blockRegistry.taleComplete.displayName).toBe("Voyage Complete");
    expect(blockRegistry.taleComplete.description).toContain("Voyage Record");
    expect(JSON.stringify(serializeBlockRegistry())).not.toMatch(/Tall Tale|story block|story graph/i);
  });

  it("validates required player-facing fields", () => {
    expect(
      blockRegistry.narrative.validationSchema.safeParse(blockRegistry.narrative.defaultConfiguration).success,
    ).toBe(true);
    expect(
      blockRegistry.image.validationSchema.safeParse({ assetId: "asset-1", altText: "Moonlit island" }).success,
    ).toBe(true);
    expect(blockRegistry.image.validationSchema.safeParse({ assetId: "asset-1", altText: "" }).success).toBe(false);
  });

  it("dispatches all completion modes through provider identifiers", () => {
    expect(providerForBlock("captainApproval", {})).toBe("captainManual");
    expect(providerForBlock("textAnswer", {})).toBe("textAnswer");
    expect(providerForBlock("wait", {})).toBe("timer");
    expect(providerForBlock("arrivalCheck", { verificationProvider: "visionLocation" })).toBe("visionLocation");
    expect(providerForBlock("narrative", { completionMode: "automatic" })).toBeNull();
  });

  it("returns no definition for an unknown future type", () => {
    expect(getBlockDefinition("uninstalled-future-block")).toBeUndefined();
  });
});
