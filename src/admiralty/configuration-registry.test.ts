import { describe, expect, it } from "vitest";
import { admiraltyConfigurationRegistry, configurationManagementClasses } from "./configuration-registry";

describe("Admiralty configuration registry", () => {
  it("classifies settings and limits mutability to governed owner-backed policies", () => {
    expect(new Set(admiraltyConfigurationRegistry.map((setting) => setting.id)).size).toBe(
      admiraltyConfigurationRegistry.length,
    );
    expect(admiraltyConfigurationRegistry).toHaveLength(23);
    expect(
      admiraltyConfigurationRegistry.every((setting) =>
        configurationManagementClasses.includes(setting.managementClass),
      ),
    ).toBe(true);
    const editable = admiraltyConfigurationRegistry.filter((setting) => setting.managementClass === "POLICY_EDITABLE");
    expect(editable.filter((setting) => setting.owner === "Harborlight").map((setting) => setting.key)).toEqual([
      "harborlight.outbox.dispatch-enabled",
      "harborlight.outbox.batch-size",
      "harborlight.outbox.poll-interval",
    ]);
    const reach = editable.filter((setting) => setting.owner === "Reach");
    expect(reach.map((setting) => setting.key)).toEqual([
      "reach.feature-enabled",
      "reach.normal-maximum-hz",
      "reach.calibration-maximum-hz",
      "reach.unfocused-maximum-hz",
      "reach.model-maximum-hz",
      "reach.telemetry-enabled",
      "reach.telemetry-retention-days",
      "reach.local-recorder-enabled",
    ]);
    expect(
      reach.every(
        (setting) =>
          setting.requiredCapability === "CONFIG_OPERATE" &&
          setting.reauthenticationRequired &&
          setting.mutationCommandOwner === "Reach REACH_RUNTIME_POLICY_UPDATE",
      ),
    ).toBe(true);
    expect(reach.some((setting) => /accuracy|model weights|freshness/.test(setting.key))).toBe(false);
    expect(
      admiraltyConfigurationRegistry
        .filter((setting) => setting.secretClassification === "REFERENCE_ONLY")
        .every((setting) => setting.mutationCommandOwner === null),
    ).toBe(true);
  });
});
