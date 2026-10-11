import { it, expect } from "vitest";
import { validateDrydockExtensions } from "./extensions";
import { requirementFixture } from "@/sextant/phase3-fixtures";
import { parseDrydockBlock, serializeCanonicalDrydockBlock } from "./contracts/parser";
it("validates Sextant through the existing authored extension path, preserving old content", () => {
  expect(validateDrydockExtensions(undefined, { fieldPath: "configuration.extensions" }).issues).toEqual([]);
  const input = { "voyagewright.sextant": { version: 1, payload: requirementFixture } };
  expect(validateDrydockExtensions(input, { fieldPath: "configuration.extensions" }).issues).toEqual([]);
  const unsafe = {
    "voyagewright.sextant": {
      version: 1,
      payload: {
        ...requirementFixture,
        audience: "GENERAL",
        requirements: [{ ...requirementFixture.requirements[0], importance: "REQUIRED_RESTRICTED" }],
      },
    },
  };
  expect(validateDrydockExtensions(unsafe, { fieldPath: "configuration.extensions" }).issues[0]).toMatchObject({
    code: "DRYDOCK_EXTENSION_PAYLOAD_INVALID",
    severity: "ERROR",
  });
});
it("round-trips optional Sextant requirements through the actual immutable block parser", () => {
  const block = {
    id: "device-clue",
    blockType: "image",
    schemaVersion: 2,
    configuration: {
      assetId: "reference-prop",
      altText: "Read the clue on screen",
      displayMode: "inline",
      objectFit: "contain",
      focalX: 0.5,
      focalY: 0.5,
      extensions: { "voyagewright.sextant": { version: 1, payload: requirementFixture } },
    },
    presentation: {},
    completion: { mode: "playerConfirmation" },
    connections: [],
    nextBlockId: null,
  };
  const parsed = parseDrydockBlock(block);
  expect(parsed.success).toBe(true);
  if (parsed.success)
    expect(
      JSON.parse(serializeCanonicalDrydockBlock(parsed.block)).configuration.extensions["voyagewright.sextant"].payload,
    ).toEqual(requirementFixture);
  const bad = parseDrydockBlock({
    ...block,
    configuration: {
      ...block.configuration,
      extensions: { "voyagewright.sextant": { version: 1, payload: { ...requirementFixture, fallbacks: [] } } },
    },
  });
  expect(bad.success).toBe(false);
});
