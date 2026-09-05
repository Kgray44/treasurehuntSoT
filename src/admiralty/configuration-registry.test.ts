import { describe, expect, it } from "vitest";
import { admiraltyConfigurationRegistry, configurationManagementClasses } from "./configuration-registry";

describe("Admiralty configuration registry", () => {
  it("classifies every projected setting and limits mutability to owner-backed Community policy", () => {
    expect(new Set(admiraltyConfigurationRegistry.map((setting) => setting.id)).size).toBe(
      admiraltyConfigurationRegistry.length,
    );
    expect(admiraltyConfigurationRegistry).toHaveLength(15);
    expect(
      admiraltyConfigurationRegistry.every((setting) =>
        configurationManagementClasses.includes(setting.managementClass),
      ),
    ).toBe(true);
    const editable = admiraltyConfigurationRegistry.filter((setting) => setting.managementClass === "POLICY_EDITABLE");
    expect(editable.map((setting) => setting.key)).toEqual([
      "harborlight.outbox.dispatch-enabled",
      "harborlight.outbox.batch-size",
      "harborlight.outbox.poll-interval",
    ]);
    expect(editable.every((setting) => setting.mutationCommandOwner?.startsWith("Harborlight "))).toBe(true);
    expect(
      admiraltyConfigurationRegistry
        .filter((setting) => setting.secretClassification === "REFERENCE_ONLY")
        .every((setting) => setting.mutationCommandOwner === null),
    ).toBe(true);
  });
});
