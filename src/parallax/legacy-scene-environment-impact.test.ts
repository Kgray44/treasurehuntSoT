import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, previewEntityTransforms } from "./authoring";
import { environmentVersionSchema } from "./legacy-scene-environment-contracts";
import { reviewEnvironmentImpact } from "./legacy-scene-environment-impact";
import { projectLegacyEnvironmentPreview } from "./legacy-environment-preview";
import { surfaceFrameRotation } from "./surface-placement";
import builtins from "./builtin-environments.v1.json";
function fixture() {
  const target = environmentVersionSchema.parse(builtins[0]);
  target.content.id = "legacy-impact-room";
  target.content.origin = "MANUAL";
  target.content.fixtures = [];
  const candidate = structuredClone(
    target.content.evidence.candidates.find((candidate) => candidate.surface === "DESK")!,
  );
  candidate.id = "target-desk";
  candidate.position = { x: 0, y: 0.8, z: 0 };
  candidate.safe = true;
  candidate.occluded = false;
  target.content.evidence.candidates = [candidate];
  target.reference = {
    environmentId: target.content.id,
    versionId: "legacy-impact-room:v2",
    revision: 2,
    checksum: canonicalChecksum(target.content),
  };
  const scene = createSpatialDraft("legacy-impact-scene");
  scene.content.environment = { ...target.reference, versionId: "legacy-impact-room:v1", revision: 1 };
  return { scene, target, candidate };
}
it("checks bounds in the actual target support frame instead of the generic Bedroom", () => {
  const { scene, target, candidate } = fixture();
  candidate.position.x = 1.8;
  scene.content.entities[0].transform.position.x = 0.5;
  const actual = previewEntityTransforms(
    scene.content,
    target.content.id,
    projectLegacyEnvironmentPreview(target),
    target.content.evidence.candidates,
  );
  expect(actual[scene.content.entities[0].id].position.x).toBeCloseTo(2.3);
  const before = JSON.stringify([scene, target]);
  expect(reviewEnvironmentImpact(scene, target).findings.some((finding) => finding.message.includes("outside"))).toBe(
    true,
  );
  expect(JSON.stringify([scene, target])).toBe(before);
});
it("does not reject a placement that fits its actual target frame but lies outside the generic frame", () => {
  const { scene, target, candidate } = fixture();
  target.content.width = 2;
  target.content.depth = 2;
  candidate.position.x = -0.8;
  candidate.widthMeters = 0.3;
  scene.content.entities[0].transform.position.x = 1.3;
  expect(reviewEnvironmentImpact(scene, target).findings.some((finding) => finding.message.includes("outside"))).toBe(
    false,
  );
});
it("uses target rotation when reviewing wall-relative room bounds", () => {
  const { target, candidate } = fixture();
  candidate.id = "wall-window";
  candidate.surface = "WALL";
  candidate.normal = { x: 1, y: 0, z: 0 };
  candidate.rotation = surfaceFrameRotation(candidate);
  candidate.position = { x: 0, y: 1.2, z: 1.8 };
  const scene = createSpatialDraft("rotated-legacy-impact", "Hidden Wall Message");
  scene.content.environment = target.reference;
  scene.content.entities[0].transform.position.x = -0.5;
  expect(reviewEnvironmentImpact(scene, target).findings.some((finding) => finding.message.includes("outside"))).toBe(
    true,
  );
});
it.each(["missing", "moved", "rotated", "unsafe", "occluded", "wrong-environment"])(
  "rejects a %s stored support dependency without an explicit Environment placement declaration",
  (change) => {
    const { scene, target, candidate } = fixture();
    scene.content.studio!.surfacePreviewFrames = [
      {
        anchorId: scene.content.anchors[0].id,
        environmentId: target.content.id,
        surfaceId: candidate.id,
        position: structuredClone(candidate.position),
        rotation: surfaceFrameRotation(candidate),
      },
    ];
    expect(scene.content.environmentPlacements).toBeUndefined();
    if (change === "missing") target.content.evidence.candidates = [];
    if (change === "moved") candidate.position.x += 0.5;
    if (change === "rotated") candidate.normal = { x: 0, y: -1, z: 0 };
    if (change === "unsafe") candidate.safe = false;
    if (change === "occluded") candidate.occluded = true;
    if (change === "wrong-environment") scene.content.studio!.surfacePreviewFrames[0].environmentId = "different-room";
    const before = JSON.stringify([scene, target]);
    const review = reviewEnvironmentImpact(scene, target);
    expect(review.status).toBe("INVALID");
    expect(
      review.findings.some(
        (finding) => finding.entityId === scene.content.entities[0].id && finding.message.includes("support"),
      ),
    ).toBe(true);
    expect(JSON.stringify([scene, target])).toBe(before);
  },
);
it("retains unchanged supports and recognizes equivalent quaternion signs", () => {
  const { scene, target, candidate } = fixture();
  const rotation = surfaceFrameRotation(candidate);
  scene.content.studio!.surfacePreviewFrames = [
    {
      anchorId: scene.content.anchors[0].id,
      environmentId: target.content.id,
      surfaceId: candidate.id,
      position: structuredClone(candidate.position),
      rotation: { x: -rotation.x, y: -rotation.y, z: -rotation.z, w: -rotation.w },
    },
  ];
  expect(reviewEnvironmentImpact(scene, target).findings).toEqual([]);
});

it("requires an explicit reference update for a distinct release with identical content", () => {
  const { scene, target } = fixture();
  expect(scene.content.environment!.checksum).toBe(target.reference.checksum);
  expect(reviewEnvironmentImpact(scene, target).status).toBe("REVIEW_REQUIRED");
  scene.content.environment = structuredClone(target.reference);
  expect(reviewEnvironmentImpact(scene, target).status).toBe("CURRENT");
});
