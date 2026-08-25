import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { deriveDrydockEvidenceRequirements } from "@/drydock/evidence-requirements";

const snapshot = (mode: string, artifacts: Array<Record<string, unknown>> = []): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: {
    id: "t",
    slug: "t",
    title: "T",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "CARTOGRAPHERS_TABLE",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 1,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "c",
      title: "C",
      subtitle: null,
      description: null,
      coverAssetId: null,
      estimatedDuration: null,
      isOptional: false,
      metadata: {},
      orderIndex: 0,
      entryBlockId: "b",
      completionBlockId: "b",
      blocks: [
        {
          id: "b",
          chapterId: "c",
          blockType: "arrivalCheck",
          title: "B",
          configuration: {},
          presentation: {},
          completion: { mode },
          isEnabled: true,
          schemaVersion: 2,
          orderIndex: 0,
          nextBlockId: null,
          connections: [],
        },
      ],
    },
  ],
  assets: [],
  locations: [],
  artifacts,
  publishedAt: "2026-08-13T00:00:00.000Z",
});

describe("Drydock evidence requirement registry", () => {
  it("adds only the applicable provider evidence requirement", () => {
    expect(deriveDrydockEvidenceRequirements(snapshot("playerConfirmation")).map((item) => item.id)).toEqual([
      "DD-R-STATIC",
      "DD-R-SCENARIOS",
      "DD-R-COMPATIBILITY",
    ]);
    expect(deriveDrydockEvidenceRequirements(snapshot("visionLocation"))).toContainEqual(
      expect.objectContaining({ id: "DD-R-LANDFALL-FIELD", providerId: "landfall", evidenceKind: "field-evidence" }),
    );
  });

  it("requires performance and accessibility evidence only for a 3D artifact", () => {
    expect(
      deriveDrydockEvidenceRequirements(snapshot("playerConfirmation", [{ id: "artifact-1" }])).map((item) => item.id),
    ).not.toContain("DD-R-ARTIFACT-3D-PERFORMANCE");
    expect(
      deriveDrydockEvidenceRequirements(snapshot("playerConfirmation", [{ id: "artifact-3d", type: "ARTIFACT_3D" }])),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "DD-R-ARTIFACT-3D-PERFORMANCE",
          providerId: "artifact",
          evidenceKind: "performance-evidence",
        }),
        expect.objectContaining({
          id: "DD-R-ARTIFACT-3D-ACCESSIBILITY",
          requirementType: "ACCESSIBILITY",
          evidenceKind: "accessibility-evidence",
        }),
      ]),
    );
  });
});
