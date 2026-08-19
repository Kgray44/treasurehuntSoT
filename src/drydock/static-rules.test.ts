import { describe, expect, it } from "vitest";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { analyzeDrydockStaticRules } from "@/drydock/static-rules";

describe("Drydock asset, privacy, and accessibility static rules", () => {
  it("rejects a private image and missing text alternative", () => {
    const block: CanonicalDrydockBlock = {
      id: "image",
      blockType: "image",
      schemaVersion: 2,
      configuration: { assetId: "captain-map", altText: "" },
      presentation: {},
      completion: { mode: "playerConfirmation" },
      connections: [],
      nextBlockId: null,
    };
    const codes = analyzeDrydockStaticRules({
      blocks: [block],
      assets: [
        {
          id: "captain-map",
          mediaType: "IMAGE",
          roles: ["CAPTAIN_ONLY_REFERENCE"],
          variants: [{ processingState: "READY" }],
        },
      ],
    }).map((issue) => issue.code);
    expect(codes).toContain("DRYDOCK_ASSET_PRIVACY");
    expect(codes).toContain("DRYDOCK_ACCESS_IMAGE_TEXT_ALTERNATIVE");
  });
  it("reports incomplete proof instead of approving without asset metadata", () => {
    expect(analyzeDrydockStaticRules({ blocks: [] }).map((issue) => issue.code)).toEqual([
      "DRYDOCK_ASSET_PROOF_INCOMPLETE",
    ]);
  });
  it("respects an explicit decorative image and requires a non-motion equivalent for visual meaning", () => {
    const decorative: CanonicalDrydockBlock = {
      id: "decorative",
      blockType: "image",
      schemaVersion: 2,
      configuration: { assetId: "image", altText: "", decorative: true },
      presentation: {},
      completion: {},
      connections: [],
      nextBlockId: null,
    };
    const transformation: CanonicalDrydockBlock = {
      id: "transform",
      blockType: "imageTransformation",
      schemaVersion: 2,
      configuration: { beforeAssetId: "before", afterAssetId: "after", nonMotionMeaning: "" },
      presentation: {},
      completion: {},
      connections: [],
      nextBlockId: null,
    };
    const issues = analyzeDrydockStaticRules({
      blocks: [decorative, transformation],
      assets: [
        { id: "image", mediaType: "IMAGE", roles: [], variants: [{ processingState: "READY" }] },
        { id: "before", mediaType: "IMAGE", roles: [], variants: [{ processingState: "READY" }] },
        { id: "after", mediaType: "IMAGE", roles: [], variants: [{ processingState: "READY" }] },
      ],
    });
    expect(issues.map((issue) => issue.code)).not.toContain("DRYDOCK_ACCESS_IMAGE_TEXT_ALTERNATIVE");
    expect(issues.map((issue) => issue.code)).toContain("DRYDOCK_ACCESS_MOTION_MEANING");
  });
  it("requires an accessible fallback only when an arrival check uses an unavailable external provider", () => {
    const blocks: CanonicalDrydockBlock[] = [
      {
        id: "player-confirmation",
        blockType: "arrivalCheck",
        schemaVersion: 2,
        configuration: { prompt: "Confirm arrival.", allowCaptainOverride: true },
        presentation: {},
        completion: { mode: "playerConfirmation" },
        connections: [],
        nextBlockId: null,
      },
      {
        id: "external-provider",
        blockType: "arrivalCheck",
        schemaVersion: 2,
        configuration: { prompt: "Verify position.", allowCaptainOverride: true },
        presentation: {},
        completion: { mode: "visionLocation" },
        connections: [],
        nextBlockId: null,
      },
    ];
    const issues = analyzeDrydockStaticRules({ blocks, assets: [] });
    expect(issues.filter((issue) => issue.code === "DRYDOCK_ACCESS_PROVIDER_FALLBACK")).toEqual([
      expect.objectContaining({ location: expect.objectContaining({ blockId: "external-provider" }) }),
    ]);
  });
});
