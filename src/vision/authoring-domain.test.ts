import { describe, expect, it } from "vitest";
import {
  applyStep,
  authoringMutationSchema,
  defaultAuthoringState,
  visualGeometrySchema,
} from "@/vision/authoring-domain";
import { assessDataHealth, stableStringify } from "@/vision/authoring";

describe("Vision authoring contracts", () => {
  it("validates all initial waypoint types through the Purpose step", () => {
    for (const waypointType of [
      "AREA_ARRIVAL",
      "EXACT_LANDMARK",
      "VIEWPOINT",
      "OBJECT_INSPECTION",
      "ITEM_PICKUP",
      "SEQUENCE",
      "ADVANCED",
    ]) {
      const parsed = authoringMutationSchema.parse({
        operation: "SAVE_STEP",
        expectedRevision: 1,
        step: 1,
        complete: true,
        data: {
          summary: "A reusable location purpose",
          successDefinition: "The player reaches the intended evidence area",
          waypointType,
          verificationProfile: "BALANCED",
          buildPreference: "LOCAL",
        },
      });
      expect("data" in parsed && "step" in parsed && parsed.step === 1 ? parsed.data.waypointType : null).toBe(
        waypointType,
      );
    }
  });

  it("resumes completed step state deterministically", () => {
    const state = applyStep(
      defaultAuthoringState(),
      2,
      {
        playerTask: "Inspect the lantern",
        narrativeImportance: "Confirms the correct story location",
        failureConsequence: "Retry without advancing",
      },
      true,
    );
    expect(state.completedSteps).toEqual([2]);
    expect(state.steps.storyIntent?.playerTask).toBe("Inspect the lantern");
  });

  it("accepts pointer and accessible region geometry but rejects out-of-range coordinates", () => {
    expect(visualGeometrySchema.parse({ tool: "RECTANGLE", x: 0.1, y: 0.2, width: 0.5, height: 0.4 })).toBeTruthy();
    expect(
      visualGeometrySchema.parse({
        tool: "POLYGON",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      }),
    ).toBeTruthy();
    expect(() => visualGeometrySchema.parse({ tool: "RECTANGLE", x: -1, y: 0, width: 0.5, height: 0.5 })).toThrow();
  });

  it("makes Story-Critical hard negatives and locked tests real blockers", () => {
    const health = assessDataHealth({
      version: { verificationProfile: "STORY_CRITICAL" },
      waypoint: { type: "EXACT_LANDMARK" },
      authoring: defaultAuthoringState(),
      assets: [],
      poseRegions: [],
      visualRegions: [],
      hardNegatives: [],
      tests: [],
    });
    expect(health.readyToPrepare).toBe(false);
    expect(health.items.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "NEARBY_HARD_NEGATIVE_REQUIRED",
        "DISTANT_HARD_NEGATIVE_REQUIRED",
        "LOCKED_TEST_REQUIRED",
      ]),
    );
  });

  it("canonicalizes equivalent BuildInput objects to the same bytes", () => {
    expect(stableStringify({ z: 1, nested: { b: 2, a: 1 } })).toBe(stableStringify({ nested: { a: 1, b: 2 }, z: 1 }));
  });
});
