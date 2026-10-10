import type { DeviceLabReceipt } from "./receipt";
import { validateDeviceLabFidelity } from "./receipt";
import { deviceLabTierForTarget } from "./registry";

/** Read-only projection. This neither relabels v1 evidence nor upgrades its fidelity. */
export function projectLandfallDeviceLabReceipt(receipt: DeviceLabReceipt) {
  validateDeviceLabFidelity(receipt);
  return {
    version: 1 as const,
    owningProject: "LANDFALL" as const,
    historicalScenarioId: receipt.scenarioId,
    scenarioId: `landfall.${receipt.scenarioId}`,
    tier: deviceLabTierForTarget(receipt.target),
    original: structuredClone(receipt),
  };
}
