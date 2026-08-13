import { describe, expect, it } from "vitest";
import { drydockAdjacentAdapter, drydockAdjacentAdapters } from "@/drydock/adapters";

describe("Drydock adjacent adapter registry", () => {
  it("declares every Phase 4 adjacent owner without claiming an unconnected runtime handoff", () => {
    expect(drydockAdjacentAdapters.map((adapter) => adapter.id)).toEqual(["harborlight", "sealed-hold", "lanternwake", "landfall", "artifact"]);
    expect(drydockAdjacentAdapter("harborlight")).toMatchObject({ state: "CONTRACT_ONLY", unsupportedBehavior: "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED" });
    expect(drydockAdjacentAdapter("landfall")).toMatchObject({ state: "UNAVAILABLE", unsupportedBehavior: "EXTERNAL_EVIDENCE_REQUIRED_WHEN_USED" });
  });
});
