import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, draftSchema } from "./authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { createEnvironmentDraft } from "./library-lifecycle-contracts";
import { simulationEnvironments } from "./studio-validation";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { environmentVersionSchema as legacyVersionSchema } from "./legacy-scene-environment-contracts";
import {
  changedEnvironmentSupportIds,
  createSceneFromEnvironment,
  reviewSceneEnvironmentImpact,
  sceneEnvironmentId,
  updateSceneEnvironmentVersion,
  type SceneEnvironmentVersion,
} from "./scene-environment-authoring";
import legacyBuiltins from "./builtin-environments.v1.json";
function richVersion() {
  const document = createEnvironmentDraft("shared-room", createRoomEnvironment(simulationEnvironments[0]));
  return {
    reference: {
      environmentId: document.id,
      versionId: "v".repeat(150),
      revision: 1,
      checksum: canonicalChecksum(document),
    },
    room: document.room!,
  };
}
it("creates independently editable Scenes sharing one rich immutable pin and preserves all room geometry", () => {
  const version = richVersion(),
    before = JSON.stringify(version);
  const first = createSceneFromEnvironment("ordinary", "Ordinary Room", version);
  const second = createSceneFromEnvironment("haunting", "The Haunting", version, null, "Ghost Footprint Trail");
  first.content.entities[0].content = "An independent message";
  first.content.studio!.environment!.features[0].name = "Local mutation only";
  expect(first.content.environment).toEqual(second.content.environment);
  expect(second.library?.type).toBe("SCENE");
  expect(second.content.studio!.environment).toEqual(version.room);
  expect(second.content.entities).toHaveLength(5);
  expect(second.content.studio).not.toHaveProperty("environmentBinding");
  expect(second.content.environment!.versionId).toHaveLength(150);
  expect(JSON.stringify(version)).toBe(before);
  expect(first.content.entities[0].id).not.toBe(second.content.entities[0].id);
});
it("keeps schema-one fixture and semantic data in their exact format without fabricating a room snapshot", () => {
  const version = legacyVersionSchema.parse(legacyBuiltins[0]);
  const scene = createSceneFromEnvironment("legacy-scene", "Ordinary Room", version);
  expect(scene.content.environment).toEqual(version.reference);
  expect(scene.content.studio).not.toHaveProperty("environment");
  expect(scene.content.entities[0]).toMatchObject({
    kind: "TEXT",
    name: "Room description",
    content: version.content.description,
  });
  expect(draftSchema.parse(scene)).toEqual(scene);
});
it("uses the immutable root pin before a working source association", () => {
  const scene = createSceneFromEnvironment("associated", "Associated", richVersion());
  scene.content.studio!.environmentBinding = {
    definitionId: "different-working-room",
    versionId: null,
    checksum: "a".repeat(64),
    revision: 19,
    usedAt: "2026-10-15T00:00:00.000Z",
    policy: "INDEPENDENT_PINNED_SNAPSHOT",
  };
  expect(sceneEnvironmentId(scene)).toBe("shared-room");
  delete scene.content.environment;
  expect(sceneEnvironmentId(scene)).toBe("different-working-room");
});
it("identifies moved attached supports before an update without mutating either Scene or version", () => {
  const version = richVersion();
  const scene = createSceneFromEnvironment("bound", "Bound Scene", version);
  const target = structuredClone(version);
  target.reference.versionId = "shared-room:v2";
  target.reference.revision = 2;
  target.room.features
    .filter((feature) => ["DESK", "TABLE"].includes(feature.classification))
    .forEach((feature) => (feature.position.x += 0.5));
  const before = JSON.stringify(scene);
  expect(changedEnvironmentSupportIds(scene, target.room).length).toBeGreaterThan(0);
  expect(reviewSceneEnvironmentImpact(scene, target, version)).toMatchObject({ status: "INVALID" });
  expect(() => updateSceneEnvironmentVersion(scene, target)).toThrow(/support/);
  expect(JSON.stringify(scene)).toBe(before);
});
it("allows lighting-only shared revisions while preserving Scene overrides and the old published snapshot", () => {
  const version = richVersion();
  const scene = createSceneFromEnvironment("light-update", "Light update", version);
  scene.content.scenePresentation = { lighting: "NORMAL" };
  const target = structuredClone(version);
  target.room.light = "LOW";
  target.reference = {
    ...target.reference,
    versionId: "shared-room:v2",
    revision: 2,
    checksum: canonicalChecksum(target.room),
  };
  const before = JSON.stringify(scene);
  const review = reviewSceneEnvironmentImpact(scene, target, version);
  expect(review.status).toBe("REVIEW_REQUIRED");
  expect(review.changes.join(" ")).toContain("base lighting");
  const updated = updateSceneEnvironmentVersion(scene, target);
  expect(updated.content.environment).toEqual(target.reference);
  expect(updated.content.studio!.environment!.light).toBe("LOW");
  expect(updated.content.scenePresentation).toEqual({ lighting: "NORMAL" });
  expect(JSON.stringify(scene)).toBe(before);
});
it("rejects missing declared semantic references and placements outside revised room bounds", () => {
  const version = richVersion();
  const scene = createSceneFromEnvironment("invalid-placement", "Invalid placement", version);
  scene.content.environmentPlacements = [{ entityId: scene.content.entities[0].id, featureId: "missing-feature" }];
  expect(
    reviewSceneEnvironmentImpact(scene, version).findings.some((finding) =>
      finding.message.includes("missing-feature"),
    ),
  ).toBe(true);
  delete scene.content.environmentPlacements;
  const local = createSpatialDraft("outside");
  const anchor = local.content.anchors[0];
  local.content.anchors[0] = {
    id: anchor.id,
    frameId: anchor.frameId,
    transform: anchor.transform,
    kind: "LOCAL_WORLD",
  };
  local.content.entities[0].transform.position.x = 99;
  expect(
    reviewSceneEnvironmentImpact(local, version).findings.some((finding) => finding.message.includes("outside")),
  ).toBe(true);
});
it("invalidates derived calibration only on the replacement copy", () => {
  const version = richVersion();
  const scene = enableAdaptiveAuthoring(createSceneFromEnvironment("adaptive-update", "Adaptive", version));
  scene.content.adaptive!.calibration.maturity = "CALIBRATED";
  scene.content.adaptive!.calibration.reviewReceiptId = "old-receipt";
  scene.content.placementPolicy = "CALIBRATED";
  const updated = updateSceneEnvironmentVersion(scene, version);
  expect(updated.content.adaptive!.calibration.maturity).toBe("SEMANTIC");
  expect(updated.content.adaptive!.calibration).not.toHaveProperty("reviewReceiptId");
  expect(updated.content.placementPolicy).toBe("ADAPTIVE_STICKY");
  expect(scene.content.adaptive!.calibration.reviewReceiptId).toBe("old-receipt");
});
it("keeps legacy impact rejection and fails closed for unconstructed rich versions", () => {
  const legacy = legacyVersionSchema.parse(legacyBuiltins[0]);
  const scene = createSceneFromEnvironment("legacy-outside", "Outside", legacy);
  scene.content.entities[0].transform.position.x = 99;
  expect(() => updateSceneEnvironmentVersion(scene, legacy)).toThrow(/outside/);
  const missing: SceneEnvironmentVersion = { reference: richVersion().reference, room: null };
  expect(reviewSceneEnvironmentImpact(scene, missing).status).toBe("INVALID");
  expect(() => createSceneFromEnvironment("missing-room", "Missing", missing)).toThrow(/constructed room/);
});
