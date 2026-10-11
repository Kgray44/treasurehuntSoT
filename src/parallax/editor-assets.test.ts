import { describe, expect, it } from "vitest";
import { createSpatialDraft, changeHistory, undo } from "./authoring";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { insertSpatialPreset } from "./editor-assets";

describe("asset insertion into the canonical scene", () => {
  it("preserves the definition, existing geometry and one-edit undo when inserting a reusable trail", () => {
    const draft = createSpatialDraft("original");
    const next = insertSpatialPreset(draft, "Ghost Footprint Trail", "trail");
    expect(next.content.definitionId).toBe(draft.content.definitionId);
    expect(next.content.entities).toHaveLength(6);
    expect(next.content.entities[0]).toEqual(draft.content.entities[0]);
    expect(new Set(next.content.entities.map((e) => e.id)).size).toBe(6);
    const history = changeHistory({ past: [], present: draft, future: [] }, { type: "REPLACE", draft: next });
    expect(undo(history).present).toEqual(draft);
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
