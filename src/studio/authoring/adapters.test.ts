import { describe, expect, it } from "vitest";
import { blockTypeIds } from "@/chronicle/block-registry";
import { getShipwrightAuthoringAdapter, sectionForFieldPath } from "@/studio/authoring/adapters";
import { effectiveValue, effectiveValueLabel } from "@/studio/authoring/effective-values";

describe("Shipwright contract-aware authoring adapters", () => {
  it("resolves every active Drydock contract to an editor strategy", () => {
    const resolutions = blockTypeIds.map((blockType) => getShipwrightAuthoringAdapter(blockType, true));
    expect(resolutions).toHaveLength(blockTypeIds.length);
    expect(resolutions.every((adapter) => adapter.strategy !== "SAFE_GENERIC_FALLBACK")).toBe(true);
  });

  it("keeps unknown future types safely editable through the fallback", () => {
    expect(getShipwrightAuthoringAdapter("futureWaypoint").strategy).toBe("SAFE_GENERIC_FALLBACK");
  });

  it("maps canonical paths to the readable Inspector sections", () => {
    expect(sectionForFieldPath("configuration.altText")).toBe("ACCESSIBILITY");
    expect(sectionForFieldPath("completion.mode")).toBe("COMPLETION");
    expect(sectionForFieldPath("presentation.transitionIn")).toBe("PRESENTATION");
    expect(sectionForFieldPath("configuration.successTargetBlockId")).toBe("BEHAVIOR");
  });

  it("distinguishes explicit values from canonical defaults without writing them", () => {
    const explicit = effectiveValue({ enabled: false }, { enabled: true }, "enabled");
    const fallback = effectiveValue({}, { enabled: true }, "enabled");
    expect(explicit.state).toBe("CONFIGURED");
    expect(explicit.effective).toBe(false);
    expect(fallback.state).toBe("CANONICAL_DEFAULT");
    expect(effectiveValueLabel(fallback)).toBe("Canonical default");
  });
});
