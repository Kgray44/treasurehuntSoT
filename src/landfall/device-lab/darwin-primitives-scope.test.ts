import { describe, expect, it, vi } from "vitest";
import { dispatchLandfallHostedLab } from "../../../scripts/landfall/device-lab/hosted";
import { labTool } from "../../../scripts/landfall/device-lab/host";

vi.mock("../../../scripts/landfall/device-lab/host", () => ({
  labTool: vi.fn(() => {
    throw new Error("EXTERNAL_TOOL_MUST_NOT_START");
  }),
}));

describe("Darwin host primitive feasibility admission", () => {
  it("refuses qualification tiers and caller-selected scenarios/profiles before any external operation", async () => {
    for (const [tier, scenario, profile] of [
      ["candidate", undefined, undefined],
      ["closure", undefined, undefined],
      ["development", "gps-perfect-walk", undefined],
      ["development", undefined, "primary-phone"],
    ]) {
      await expect(
        dispatchLandfallHostedLab("a".repeat(40), process.cwd(), "darwin-primitives", tier, scenario, profile),
      ).rejects.toThrow("LANDFALL_HOSTED_DARWIN_PRIMITIVES_SCOPE_INVALID");
    }
    expect(labTool).not.toHaveBeenCalled();
  });

  it("refuses audit-signal qualification and overrides before any external operation", async () => {
    for (const [tier, scenario, profile] of [
      ["candidate", undefined, undefined],
      ["closure", undefined, undefined],
      ["development", "gps-perfect-walk", undefined],
      ["development", undefined, "primary-phone"],
    ]) {
      await expect(
        dispatchLandfallHostedLab("a".repeat(40), process.cwd(), "darwin-audit-signal", tier, scenario, profile),
      ).rejects.toThrow("LANDFALL_HOSTED_DARWIN_AUDIT_SIGNAL_SCOPE_INVALID");
    }
    expect(labTool).not.toHaveBeenCalled();
  });
});
