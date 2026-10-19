import { expect, it } from "vitest";
import { identityTransform } from "./contracts";
import type { BrowserTrackingPlane } from "./browser-world-tracking";
import type { TrackingRay } from "./browser-tracking-rays";
import { intersectTrackingPlanes } from "./browser-tracking-planes";

const plane: BrowserTrackingPlane = {
  id: "table",
  alignment: "HORIZONTAL",
  evidence: "DETECTED",
  width: 2,
  depth: 1,
  transform: identityTransform(),
};
const ray: TrackingRay = { sessionId: "map", origin: { x: 0, y: 2, z: 0 }, direction: { x: 0, y: -1, z: 0 } };

it("hits the nearest bounded detected surface without an invented floor", () => {
  const top = { ...plane, id: "near", transform: { ...plane.transform, position: { x: 0, y: 1, z: 0 } } };
  expect(intersectTrackingPlanes(ray, [plane, top])).toMatchObject({
    planeId: "near",
    distance: 1,
    transform: { position: { x: 0, y: 1, z: 0 } },
  });
  expect(intersectTrackingPlanes(ray, [])).toBeNull();
  expect(intersectTrackingPlanes({ ...ray, origin: { x: 2, y: 2, z: 0 } }, [plane])).toBeNull();
  expect(intersectTrackingPlanes({ ...ray, direction: { x: 0, y: 1, z: 0 } }, [plane])).toBeNull();
  expect(intersectTrackingPlanes({ ...ray, direction: { x: 1, y: 0, z: 0 } }, [plane])).toBeNull();
});

it("refuses estimated, vertical, malformed and nonpositive surfaces", () => {
  for (const invalid of [
    { ...plane, evidence: "ESTIMATED" as const },
    { ...plane, alignment: "VERTICAL" as const },
    { ...plane, width: 0 },
    { ...plane, depth: NaN },
    { ...plane, transform: { ...plane.transform, scale: 2 } },
    { ...plane, transform: { ...plane.transform, rotation: { x: 0, y: 0, z: 0, w: 2 } } },
  ])
    expect(intersectTrackingPlanes(ray, [invalid])).toBeNull();
});

it("honors the plane transform and rotated finite extents", () => {
  const turned = {
    ...plane,
    transform: {
      ...plane.transform,
      position: { x: 4, y: 0.8, z: 3 },
      rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
    },
  };
  expect(
    intersectTrackingPlanes({ ...ray, origin: { x: 4, y: 2, z: 3.9 } }, [turned])?.transform.position.y,
  ).toBeCloseTo(0.8);
  expect(intersectTrackingPlanes({ ...ray, origin: { x: 4.9, y: 2, z: 3 } }, [turned])).toBeNull();
});
