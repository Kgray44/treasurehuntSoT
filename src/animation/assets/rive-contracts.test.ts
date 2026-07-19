import { describe, expect, it } from "vitest";
import { riveAssets, type RiveAssetContract } from "./rive-contracts";

const playerObjectContracts = [riveAssets.journalClasp, riveAssets.voyageCompass, riveAssets.finaleMechanism];

function inputNames(asset: RiveAssetContract) {
  return new Set(asset.inputs.map((input) => input.name));
}

describe("Phase 3 Rive fallback contracts", () => {
  it.each(playerObjectContracts)(
    "freezes nonempty semantic state, input, reduced-pose, and fallback data for $key",
    (asset) => {
      expect(asset.states.length).toBeGreaterThan(1);
      expect(asset.inputs.length).toBeGreaterThan(0);
      expect(Object.keys(asset.reducedPose).length).toBeGreaterThan(0);
      expect(asset.reducedSemanticSignals.length).toBeGreaterThan(0);
      expect(asset.fallback).toMatch(/^\/animations\/stills\/.+\.svg$/);
      expect(asset.availability).toBe("blocked_external_asset");
      expect(asset.path).toBeUndefined();

      const names = inputNames(asset);
      for (const name of Object.keys(asset.reducedPose)) expect(names.has(name)).toBe(true);
      for (const name of asset.reducedSemanticSignals) expect(names.has(name)).toBe(true);
    },
  );

  it("keeps the Finale Mechanism interface ready for state, progress, bounded triggers, and optional silent-safe accents", () => {
    expect(riveAssets.finaleMechanism.inputs).toEqual([
      { name: "state", type: "number" },
      { name: "progress", type: "number" },
      { name: "wake", type: "trigger" },
      { name: "unlock", type: "trigger" },
      { name: "audioLevel", type: "number" },
    ]);
    expect(riveAssets.finaleMechanism.states).toEqual([
      "dormant",
      "teased",
      "sealed",
      "partial",
      "ready",
      "unlocking",
      "unlocked",
      "complete",
    ]);
    expect(riveAssets.finaleMechanism.reducedPose).toEqual({ state: 0, progress: 0, audioLevel: 0 });
    expect(riveAssets.finaleMechanism.reducedSemanticSignals).toEqual(["state", "progress"]);
    expect(riveAssets.finaleMechanism.reducedSemanticSignals).not.toContain("audioLevel");
  });
});
