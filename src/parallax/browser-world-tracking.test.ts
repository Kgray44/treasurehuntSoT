import { expect, it } from "vitest";
import {
  alignRoomPoints,
  alignmentApplies,
  hasLiveWorldPose,
  type BrowserTrackingSample,
} from "./browser-world-tracking";
import { identityTransform, type Transform } from "./contracts";
import { composeTransform } from "./transforms";
const sample: BrowserTrackingSample = {
  sessionId: "local-tracking-session",
  timestampMs: 1000,
  method: "VISUAL_INERTIAL_SLAM",
  status: "TRACKING",
  confidence: "METRIC_6DOF",
  sessionFromCamera: identityTransform(),
  reason: "",
};
const scenePoints = [
  { x: -1, y: 0.9, z: -0.5 },
  { x: 1, y: 0.9, z: -0.5 },
  { x: 1, y: 0.9, z: 0.5 },
];
const expected: Transform = {
  position: { x: 3, y: -0.2, z: -2 },
  rotation: { x: 0, y: Math.sin(0.4), z: 0, w: Math.cos(0.4) },
  scale: 1.12,
};
const pairs = () =>
  scenePoints.map((scene) => ({
    scene,
    tracked: composeTransform(expected, { ...identityTransform(), position: scene }).position,
  }));
const input = () => ({
  sample,
  nowMs: 1100,
  versionChecksum: "a".repeat(64),
  semanticFeatureId: "room:table",
  points: pairs(),
});

it("rejects target, marker, orientation, GPS and replay as live world poses, including stale and prior sessions", () => {
  expect(hasLiveWorldPose(sample, 1100, sample.sessionId)).toBe(true);
  for (const method of ["IMAGE_TARGET", "MARKER", "ORIENTATION", "GPS", "REPLAY"])
    expect(hasLiveWorldPose({ ...sample, method }, 1100, sample.sessionId)).toBe(false);
  for (const confidence of ["NONE", "ROTATION_ONLY"])
    expect(hasLiveWorldPose({ ...sample, confidence }, 1100, sample.sessionId)).toBe(false);
  for (const status of ["INITIALIZING", "LIMITED", "LOST", "SUSPENDED"])
    expect(hasLiveWorldPose({ ...sample, status }, 1100, sample.sessionId)).toBe(false);
  expect(hasLiveWorldPose(sample, 1600, sample.sessionId)).toBe(false);
  expect(hasLiveWorldPose(sample, 999, sample.sessionId)).toBe(false);
  expect(hasLiveWorldPose(sample, 1100, "next-session")).toBe(false);
  expect(
    hasLiveWorldPose({ ...sample, sessionFromCamera: { ...identityTransform(), scale: 2 } }, 1100, sample.sessionId),
  ).toBe(false);
});

it("fits upright room alignment without a measurement and keeps authored points intact", () => {
  const original = structuredClone(input());
  const alignment = alignRoomPoints(original);
  for (const key of ["x", "y", "z"] as const)
    expect(alignment.sessionFromScene.position[key]).toBeCloseTo(expected.position[key], 8);
  expect(alignment.sessionFromScene.rotation.y).toBeCloseTo(expected.rotation.y, 8);
  expect(alignment.sessionFromScene.scale).toBeCloseTo(expected.scale, 8);
  expect(alignment.normalizedResidual).toBeLessThan(1e-10);
  expect(original).toEqual(input());
  expect(alignmentApplies(alignment, sample, 1100, "a".repeat(64))).toBe(true);
  expect(alignmentApplies(alignment, sample, 1100, "b".repeat(64))).toBe(false);
  expect(alignmentApplies(alignment, { ...sample, sessionId: "new-map" }, 1100, "a".repeat(64))).toBe(false);
  expect(alignmentApplies(alignment, { ...sample, status: "LOST" }, 1100, "a".repeat(64))).toBe(false);
});

it("labels unscaled visual SLAM as relative and refuses mirrored, collinear or inconsistent corners", () => {
  expect(
    alignRoomPoints({ ...input(), sample: { ...sample, confidence: "POSITION_NO_SCALE", method: "VISUAL_SLAM" } })
      .trackingScale,
  ).toBe("RELATIVE");
  const mirrored = pairs().map((p) => ({ ...p, tracked: { ...p.tracked, x: -p.tracked.x } }));
  expect(() => alignRoomPoints({ ...input(), points: mirrored })).toThrow(/ORDERED_CORNERS/);
  expect(() => alignRoomPoints({ ...input(), points: pairs().slice(0, 2) })).toThrow(/THREE_POINTS/);
  const inconsistent = pairs();
  inconsistent[2].tracked.y += 0.3;
  expect(() => alignRoomPoints({ ...input(), points: inconsistent })).toThrow(/CORNERS_DISAGREE/);
  expect(() =>
    alignRoomPoints({
      ...input(),
      points: pairs().map((p) => ({ ...p, scene: { x: p.scene.x, y: p.scene.y, z: 0 } })),
    }),
  ).toThrow(/ORDERED_CORNERS/);
});
