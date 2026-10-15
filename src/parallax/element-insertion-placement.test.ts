import { describe, expect, it } from "vitest";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { createSpatialDraft } from "./authoring";
import { physicalAssets } from "./asset-catalog";
import { insertSpatialElement } from "./element-authoring";
import { planPhysicalAssetInsertion } from "./element-insertion-placement";
import { identityTransform, type Transform } from "./contracts";
import type { PreviewEnvironment } from "./environment-authoring";
import { createGenericRoomFeature } from "./room-feature-construction";
import { simulationEnvironments } from "./studio-validation";

function empty() {
  const draft = createSpatialDraft("insertion-test");
  draft.content.entities = [];
  draft.content.anchors = [];
  draft.content.studio!.layers = [];
  return draft;
}
const floor = () =>
  createGenericRoomFeature({
    id: "floor",
    classification: "FLOOR",
    dimensions: [4, 0.16, 4],
    position: { x: 0, y: -0.08, z: 0 },
  });
function room(features = [floor()]): PreviewEnvironment {
  return { ...simulationEnvironments[0], id: "authored-insertion-room", features };
}
function bounds(dimensions: readonly number[], transform: Transform) {
  return new Box3(
    new Vector3(-dimensions[0] / 2, 0, -dimensions[2] / 2),
    new Vector3(dimensions[0] / 2, dimensions[1], dimensions[2] / 2),
  ).applyMatrix4(
    new Matrix4().compose(
      new Vector3(transform.position.x, transform.position.y, transform.position.z),
      new Quaternion(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
      new Vector3(transform.scale, transform.scale, transform.scale),
    ),
  );
}

describe("bounded SC-02 physical insertion planning", () => {
  it("reproduces the old Bedroom overflow and finds an in-room sofa position without changing source", () => {
    const draft = empty(),
      environment = simulationEnvironments[0];
    const old = insertSpatialElement(draft, "sofa", "old").content.entities.at(-1)!;
    const descriptor = physicalAssets.find((a) => a.id === "sofa")!;
    expect(bounds(descriptor.dimensions, old.transform).max.z).toBeGreaterThan(environment.depth / 2);
    const before = JSON.stringify(draft);
    const plan = planPhysicalAssetInsertion({ draft, modelId: "sofa", environment });
    expect(plan.status).toBe("PLACED");
    if (plan.status !== "PLACED") return;
    const box = bounds(descriptor.dimensions, plan.transform);
    expect(box.min.x).toBeGreaterThanOrEqual(-2);
    expect(box.max.x).toBeLessThanOrEqual(2);
    expect(box.min.z).toBeGreaterThanOrEqual(-2);
    expect(box.max.z).toBeLessThanOrEqual(2);
    expect(plan.transform.scale).toBe(1);
    expect(JSON.stringify(draft)).toBe(before);
  });

  it.each(physicalAssets)("keeps $id within Bedroom when a clear support is found", (asset) => {
    const plan = planPhysicalAssetInsertion({
      draft: empty(),
      modelId: asset.id,
      environment: simulationEnvironments[0],
    });
    if (plan.status === "NO_FIT") {
      expect(plan.reason).toBe("NO_CLEAR_SUPPORT");
      expect(plan.message).toContain("No item was inserted");
      return;
    }
    const box = bounds(asset.dimensions, plan.transform);
    expect(box.min.x).toBeGreaterThanOrEqual(-2);
    expect(box.max.x).toBeLessThanOrEqual(2);
    expect(box.min.z).toBeGreaterThanOrEqual(-2);
    expect(box.max.z).toBeLessThanOrEqual(2);
    expect(plan.transform.scale).toBe(1);
    expect(
      new Vector3(0, 1, 0).applyQuaternion(
        new Quaternion(
          plan.transform.rotation.x,
          plan.transform.rotation.y,
          plan.transform.rotation.z,
          plan.transform.rotation.w,
        ),
      ).y,
    ).toBeCloseTo(1);
  });

  it("uses actual raised/rotated support height and a Y-up physical frame", () => {
    const table = createGenericRoomFeature({
      id: "raised-desk",
      classification: "DESK",
      dimensions: [1.4, 1.2, 0.9],
      position: { x: 0.3, y: 0.6, z: 0 },
      yawDegrees: 35,
    });
    const plan = planPhysicalAssetInsertion({
      draft: empty(),
      modelId: "decorative-vase",
      environment: room([floor(), table]),
    });
    expect(plan.status).toBe("PLACED");
    if (plan.status !== "PLACED") return;
    expect(plan.surfaceId).toContain("raised-desk");
    expect(plan.transform.position.y).toBeCloseTo(1.21);
    expect(plan.transform.rotation.y).not.toBeCloseTo(0);
  });

  it("does not put a table asset on the floor when no table exists", () => {
    expect(planPhysicalAssetInsertion({ draft: empty(), modelId: "brass-compass", environment: room() }).status).toBe(
      "NO_FIT",
    );
  });

  it("does not invent Bedroom geometry for an unknown environment", () => {
    const environment = { ...simulationEnvironments[0], id: "missing-custom-room" };
    expect(planPhysicalAssetInsertion({ draft: empty(), modelId: "treasure-chest", environment })).toMatchObject({
      status: "NO_FIT",
      reason: "ROOM_REQUIRED",
    });
  });

  it("preserves explicit empty authored geometry instead of supplying a fallback floor", () => {
    expect(
      planPhysicalAssetInsertion({ draft: empty(), modelId: "treasure-chest", environment: room([]) }),
    ).toMatchObject({ status: "NO_FIT", reason: "NO_CLEAR_SUPPORT" });
  });

  it("rejects a blocked floor and preserves all input entities", () => {
    const exclusion = createGenericRoomFeature({
      id: "blocked",
      classification: "EXCLUSION_ZONE",
      dimensions: [4, 0.5, 4],
      position: { x: 0, y: 0.25, z: 0 },
    });
    const draft = empty(),
      before = JSON.stringify(draft);
    expect(
      planPhysicalAssetInsertion({ draft, modelId: "treasure-chest", environment: room([floor(), exclusion]) }).status,
    ).toBe("NO_FIT");
    expect(JSON.stringify(draft)).toBe(before);
  });

  it("retains canonical low-clearance rejection", () => {
    expect(
      planPhysicalAssetInsertion({
        draft: empty(),
        modelId: "treasure-chest",
        environment: { ...room(), clutter: 0.95 },
      }).status,
    ).toBe("NO_FIT");
  });

  it("does not overlap an already authored solid or shrink the new one", () => {
    const draft = insertSpatialElement(empty(), "treasure-chest", "existing");
    draft.content.entities[0].transform = identityTransform();
    const plan = planPhysicalAssetInsertion({
      draft,
      modelId: "treasure-chest",
      environment: room(),
      preferredPosition: { x: 0, y: 0, z: 0 },
    });
    expect(plan.status).toBe("PLACED");
    if (plan.status !== "PLACED") return;
    const descriptor = physicalAssets.find((a) => a.id === "treasure-chest")!;
    expect(
      bounds(descriptor.dimensions, plan.transform).intersectsBox(bounds(descriptor.dimensions, identityTransform())),
    ).toBe(false);
    expect(plan.transform.scale).toBe(1);
  });

  it("returns manual recovery when an open model has unqualified expanded bounds", () => {
    const draft = insertSpatialElement(empty(), "hinged-door", "open-door");
    const element = draft.content.entities[0].element!;
    if (element.kind !== "PHYSICAL_ASSET") throw new Error("Expected physical fixture");
    element.articulation = 1;
    expect(planPhysicalAssetInsertion({ draft, modelId: "treasure-chest", environment: room() })).toMatchObject({
      status: "NO_FIT",
      reason: "OPEN_ARTICULATION",
    });
    expect(element.articulation).toBe(1);
  });

  it("keeps a wall model out of the actual window opening", () => {
    const wall = createGenericRoomFeature({
      id: "back-wall",
      classification: "WALL",
      dimensions: [4, 2.8, 0.16],
      position: { x: 0, y: 1.4, z: -2 },
    });
    const window = createGenericRoomFeature({
      id: "opening",
      classification: "WINDOW",
      dimensions: [1.2, 1.2, 0.16],
      position: { x: 0, y: 1.7, z: -2 },
    });
    const plan = planPhysicalAssetInsertion({
      draft: empty(),
      modelId: "framed-painting",
      environment: room([floor(), wall, window]),
      preferredPosition: { x: 0, y: 1.7, z: -1.92 },
    });
    expect(plan.status).toBe("PLACED");
    if (plan.status !== "PLACED") return;
    expect(plan.surfaceId).toContain("back-wall");
    const box = bounds(physicalAssets.find((a) => a.id === "framed-painting")!.dimensions, plan.transform);
    expect(box.max.x <= -0.6 || box.min.x >= 0.6 || box.max.y <= 1.1 || box.min.y >= 2.3).toBe(true);
  });

  it("checks full asset height above support, beyond the discovery clearance slice", () => {
    const table = createGenericRoomFeature({
      id: "support",
      classification: "TABLE",
      dimensions: [1.4, 1, 0.9],
      position: { x: 0, y: 0.5, z: 0 },
    });
    const overhead = createGenericRoomFeature({
      id: "overhead",
      classification: "OTHER",
      dimensions: [2, 0.1, 1.3],
      position: { x: 0, y: 1.4, z: 0 },
    });
    const environment = room([floor(), table, overhead]);
    expect(planPhysicalAssetInsertion({ draft: empty(), modelId: "candelabra", environment }).status).toBe("NO_FIT");
    expect(planPhysicalAssetInsertion({ draft: empty(), modelId: "ornate-key", environment }).status).toBe("PLACED");
  });

  it("returns manual recovery for an asset wider than the actual room", () => {
    const environment = {
      ...room([
        createGenericRoomFeature({
          id: "small-floor",
          classification: "FLOOR",
          dimensions: [1.8, 0.16, 2],
          position: { x: 0, y: -0.08, z: 0 },
        }),
      ]),
      width: 1.8,
      depth: 2,
    };
    expect(planPhysicalAssetInsertion({ draft: empty(), modelId: "sofa", environment })).toMatchObject({
      status: "NO_FIT",
      reason: "NO_CLEAR_SUPPORT",
      message: expect.stringContaining("manual placement"),
    });
  });
});
