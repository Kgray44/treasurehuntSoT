import { describe, expect, it } from "vitest";
import { createSpatialDraft, changeHistory, undo } from "./authoring";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { insertSpatialPreset } from "./editor-assets";
import { composeTransform } from "./transforms";
import { identityTransform } from "./contracts";

describe("asset insertion into the canonical scene", () => {
  it("preserves the definition, existing geometry and one-edit undo when inserting a reusable trail", () => {
    const draft = createSpatialDraft("original");
    const next = insertSpatialPreset(draft, "Ghost Footprint Trail", "trail");
    expect(next.content.definitionId).toBe(draft.content.definitionId);
    expect(next.content.entities).toHaveLength(6);
    expect(next.content.entities[0]).toEqual(draft.content.entities[0]);
    expect(new Set(next.content.entities.map((e) => e.id)).size).toBe(6);
    for (const foot of next.content.entities.slice(1)) {
      const normal = composeTransform(
        { ...foot.transform, position: { x: 0, y: 0, z: 0 } },
        { ...identityTransform(), position: { x: 0, y: 0, z: 1 } },
      ).position;
      expect(normal.x).toBeCloseTo(0);
      expect(normal.y).toBeCloseTo(1);
      expect(normal.z).toBeCloseTo(0);
      const world = composeTransform(
        next.content.anchors.find((a) => a.id === foot.anchorId)!.transform,
        foot.transform,
      );
      expect(Math.abs(world.position.z) + foot.widthMeters * 0.375).toBeLessThan(2);
    }
    const history = changeHistory({ past: [], present: draft, future: [] }, { type: "REPLACE", draft: next });
    expect(undo(history).present).toEqual(draft);
  });
  it("does not rewrite a saved legacy trail pose when renaming or inserting another asset", () => {
    const legacy = createSpatialDraft("legacy", "Ghost Footprint Trail");
    for (const foot of legacy.content.entities) {
      foot.transform.rotation = identityTransform().rotation;
      foot.widthMeters = 0.16;
    }
    const loaded = JSON.parse(JSON.stringify(legacy));
    const next = insertSpatialPreset(loaded, "Peeking Letter", "new-letter");
    expect(next.content.entities.slice(0, 5)).toEqual(legacy.content.entities);
    expect(next.content.anchors.slice(0, 1)).toEqual(legacy.content.anchors);
  });
  it("creates recipes and discovery coverage and removes stale calibration claims after expansion", () => {
    const draft = enableAdaptiveAuthoring(createSpatialDraft("calibrated"));
    draft.content.placementPolicy = "CALIBRATED";
    draft.content.adaptive!.calibration.maturity = "CALIBRATED";
    draft.content.adaptive!.calibration.reviewReceiptId = "existing-review";
    const next = insertSpatialPreset(draft, "Peeking Letter", "letter");
    expect(next.content.adaptive!.recipes.map((r) => r.entityId)).toEqual(next.content.entities.map((e) => e.id));
    expect(next.content.adaptive!.discovery).toHaveLength(2);
    expect(next.content.adaptive!.calibration.maturity).toBe("SEMANTIC");
    expect(next.content.adaptive!.calibration.reviewReceiptId).toBeUndefined();
    expect(next.content.placementPolicy).toBe("ADAPTIVE_STICKY");
  });
});
