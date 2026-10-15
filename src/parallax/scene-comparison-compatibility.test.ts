import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, forkSpatialDraft } from "./authoring";
import { createMotionTrack, recordAnimationKeyframe, retimeAnimationTrack } from "./animation-authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { createEnvironmentDraft } from "./library-lifecycle-contracts";
import { simulationEnvironments } from "./studio-validation";
import { compareScenes } from "./scene-comparison";
import legacyBuiltins from "./builtin-environments.v1.json";

function pinnedScene() {
  const draft = createSpatialDraft("comparison-source");
  draft.content.environment = structuredClone(legacyBuiltins[0].reference);
  return draft;
}

function workingScene() {
  const document = createEnvironmentDraft("comparison-room", createRoomEnvironment(simulationEnvironments[0]));
  const draft = createSpatialDraft("comparison-source");
  draft.content.studio!.environment = structuredClone(document.room!);
  draft.content.studio!.environmentBinding = {
    definitionId: document.id,
    versionId: null,
    revision: 7,
    checksum: canonicalChecksum(document),
    usedAt: "2026-10-15T00:00:00.000Z",
    policy: "INDEPENDENT_PINNED_SNAPSHOT",
  };
  return draft;
}

describe("comparison across the canonical Studio compatibility boundary", () => {
  it("treats omitted historical animation tracks and an empty track list as the same authored state", () => {
    const source = pinnedScene();
    const target = forkSpatialDraft(source, "comparison-target");
    target.content.studio!.animationTracks = [];
    expect(compareScenes(source, target).differences).toEqual([]);
  });

  it("reports recorded animation tracks without changing static objects or the source Scene", () => {
    const source = pinnedScene();
    const before = canonicalChecksum(source);
    const target = recordAnimationKeyframe(
      forkSpatialDraft(source, "comparison-target"),
      source.content.entities[0].id,
      "POSITION",
      250,
      "AUTHORED",
    );

    expect(target.content.entities).toEqual(source.content.entities);
    expect(compareScenes(source, target).differences).toEqual([
      { category: "ANIMATION", message: "Animation tracks or clip timing changed" },
    ]);
    expect(canonicalChecksum(source)).toBe(before);
  });

  it("reports retimed clips through the existing animation authoring model", () => {
    let source = pinnedScene();
    source = createMotionTrack(source, source.content.entities[0].id, "POSITION", 0);
    const before = canonicalChecksum(source);
    const track = source.content.studio!.animationTracks![0];
    const target = retimeAnimationTrack(forkSpatialDraft(source, "comparison-target"), track.id, 500, 2500);

    expect(target.content.entities).toEqual(source.content.entities);
    expect(compareScenes(source, target).differences).toEqual([
      { category: "ANIMATION", message: "Animation tracks or clip timing changed" },
    ]);
    expect(canonicalChecksum(source)).toBe(before);
  });

  it("compares Scenes from the same working Environment without inventing a released pin", () => {
    const source = workingScene();
    const target = forkSpatialDraft(source, "comparison-target");
    target.content.studio!.environmentBinding!.usedAt = "2026-10-15T01:00:00.000Z";

    expect(source.content.environment).toBeUndefined();
    expect(target.content.environment).toBeUndefined();
    expect(compareScenes(source, target).differences).toEqual([]);
  });

  it.each(["working revision", "room snapshot"])("reports a changed %s", (change) => {
    const source = workingScene();
    const before = canonicalChecksum(source);
    const target = forkSpatialDraft(source, "comparison-target");
    if (change === "working revision") target.content.studio!.environmentBinding!.revision += 1;
    else target.content.studio!.environment!.features[0].yawDegrees += 5;

    expect(compareScenes(source, target).differences).toEqual([
      { category: "ENVIRONMENT_REFERENCE", message: "Environment revision or semantic references changed" },
    ]);
    expect(canonicalChecksum(source)).toBe(before);
  });

  it.each([true, false])(
    "ignores source CAS/usage metadata for an unchanged immutable association (root pin: %s)",
    (rootPin) => {
      const source = pinnedScene();
      const pin = source.content.environment!;
      source.content.studio!.environmentBinding = {
        definitionId: pin.environmentId,
        versionId: pin.versionId,
        revision: 19,
        checksum: pin.checksum,
        usedAt: "2026-10-15T00:00:00.000Z",
        policy: "INDEPENDENT_PINNED_SNAPSHOT",
      };
      if (!rootPin) delete source.content.environment;
      const target = forkSpatialDraft(source, "comparison-target");
      target.content.studio!.environmentBinding!.revision = 25;
      target.content.studio!.environmentBinding!.usedAt = "2026-10-15T01:00:00.000Z";
      expect(compareScenes(source, target).differences).toEqual([]);
    },
  );

  it("rejects different Environment definitions despite matching room geometry", () => {
    const source = workingScene();
    const target = forkSpatialDraft(source, "comparison-target");
    target.content.studio!.environmentBinding!.definitionId = "another-environment";
    target.content.studio!.environment!.id = "another-environment";
    expect(() => compareScenes(source, target)).toThrow("same Environment");
  });

  it("rejects a conflicting source binding instead of comparing it as the pinned Environment", () => {
    const source = pinnedScene();
    const target = forkSpatialDraft(source, "comparison-target");
    const pin = target.content.environment!;
    target.content.studio!.environmentBinding = {
      definitionId: pin.environmentId,
      versionId: pin.versionId,
      revision: 19,
      checksum: "0".repeat(64),
      usedAt: "2026-10-15T00:00:00.000Z",
      policy: "INDEPENDENT_PINNED_SNAPSHOT",
    };
    expect(() => compareScenes(source, target)).toThrow("conflicts with its immutable pin");
  });
});
