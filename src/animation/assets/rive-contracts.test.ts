import { describe, expect, it } from "vitest";
import {
  finaleMechanismStage,
  invitationSealStatus,
  journalClaspOpeningPhase,
  riveAssets,
  voyageCompassConnectionStatus,
  type RiveAssetContract,
} from "./rive-contracts";

const productionAssets = [
  riveAssets.invitationSeal,
  riveAssets.journalClasp,
  riveAssets.voyageCompass,
  riveAssets.finaleMechanism,
];

function inputNames(asset: RiveAssetContract) {
  return new Set(asset.inputs.map((input) => input.name));
}

describe("Project Lanternwake Phase 5 Rive asset contracts", () => {
  it.each(productionAssets)(
    "keeps the frozen production contract and distinguishes validated source pairs from the remaining external authoring gap for $assetId",
    (asset) => {
      expect(asset.path).toMatch(/^\/animations\/rive\/.+-v1\.riv$/);
      expect(asset.artboard).toBeTruthy();
      expect(asset.stateMachine).toMatch(/SM$/);
      expect(asset.states.length).toBeGreaterThan(3);
      expect(asset.inputs.length).toBeGreaterThan(3);
      expect(asset.fallbackStates.length).toBeGreaterThan(2);
      expect(asset.loadTimeoutMs).toBeGreaterThan(0);
      if (asset.assetId === "finaleMechanism") {
        expect(asset.availability).toBe("blocked_external_asset");
        expect(asset.provenance).toMatch(/external Rive authoring handoff/i);
      } else {
        expect(asset.availability).toBe("runtime-ready");
        expect(asset.provenance).toMatch(/Project-owned Lanternwake source SVG and Rive \.rev backup/i);
      }

      const names = inputNames(asset);
      for (const name of Object.keys(asset.reducedPose)) expect(names.has(name)).toBe(true);
      for (const name of asset.reducedSemanticSignals) expect(names.has(name)).toBe(true);
    },
  );

  it("uses documented numeric enums rather than magic state values", () => {
    expect(invitationSealStatus).toEqual({
      idle: 0,
      validating: 1,
      accepted: 2,
      rejected: 3,
      expired: 4,
      revoked: 5,
      opening: 6,
      open: 7,
    });
    expect(journalClaspOpeningPhase).toEqual({
      locked: 0,
      awake: 1,
      releasing: 2,
      opening: 3,
      open: 4,
      interrupted: 5,
      resetting: 6,
    });
    expect(voyageCompassConnectionStatus.arrived).toBe(4);
    expect(finaleMechanismStage.historical).toBe(8);
  });

  it("keeps the development Rive sample explicitly outside production readiness", () => {
    expect(riveAssets.developmentRating.availability).toBe("runtime-ready");
    expect(riveAssets.developmentRating.developmentOnly).toBe(true);
    expect(riveAssets.developmentRating.provenance).toMatch(/Development-only/);
  });
});
