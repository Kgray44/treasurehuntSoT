import { describe, expect, it } from "vitest";
import {
  landfallProviderCatalog,
  landfallSimulationCatalog,
  unconfiguredLandfallStatuses,
} from "@/landfall/provider-catalog";
import {
  LandfallProviderHealthRegistry,
  selectLandfallProviders,
  type ProviderSelectionContext,
} from "@/landfall/provider-policy";
import { contextualLandfallPermission, landfallPowerPolicy } from "@/landfall/device-policy";
import { landfallProviderFindings } from "@/landfall/provider-authoring";
import { landfallFixture } from "@/landfall/fixtures";
import { validateLandfallDefinition } from "@/landfall/definition";

const context: ProviderSelectionContext = {
  worldspaceKind: "PHYSICAL",
  platform: "WEB",
  connectivity: "ONLINE",
  permissions: { FOREGROUND_LOCATION: "GRANTED" },
  hardware: ["LOCATION"],
  allowThirdParty: false,
  offlinePackageReady: false,
  simulation: false,
  now: 1000,
};
const requirement = { family: "LOCATION" as const, capability: "foreground", offlineRequired: false };
const browser = landfallProviderCatalog().find((provider) => provider.id === "browser-geolocation")!;
function ready() {
  const registry = new LandfallProviderHealthRegistry([browser]);
  registry.configure(browser.id, { enabled: true, credentialAvailable: false });
  registry.record(browser.id, "READY", 900, 3);
  return registry;
}
describe("provider capability truth", () => {
  it("has one or more real contracts and a test adapter contract for every family without startup success", () => {
    const catalog = landfallProviderCatalog();
    const synthetic = landfallSimulationCatalog();
    expect(new Set(catalog.map((provider) => provider.family)).size).toBe(26);
    expect(synthetic).toHaveLength(26);
    expect(new Set(catalog.map((provider) => provider.id)).size).toBe(catalog.length);
    expect(unconfiguredLandfallStatuses().every((status) => status.health === "NOT_CONFIGURED")).toBe(true);
  });
  it("rejects absence, permission loss, unsupported hardware and virtual physical mixing even with ready health", () => {
    expect(selectLandfallProviders([browser], [], requirement, context)[0].usable).toBe(false);
    for (const [change, reason] of [
      [{ worldspaceKind: "VIRTUAL" }, "WORLDSPACE"],
      [{ permissions: { FOREGROUND_LOCATION: "REVOKED" } }, "PERMISSION"],
      [{ hardware: [] }, "HARDWARE"],
      [{ platform: "ANDROID" }, "PLATFORM"],
    ] as const) {
      const result = selectLandfallProviders([browser], ready().snapshot(), requirement, {
        ...context,
        ...change,
      } as ProviderSelectionContext)[0];
      expect(result.usable).toBe(false);
      expect(result.reasons).toContain(reason);
    }
    expect(
      selectLandfallProviders([browser], ready().snapshot(), requirement, {
        ...context,
        permissions: { FOREGROUND_LOCATION: "APPROXIMATE" },
      })[0].usable,
    ).toBe(true);
  });
  it("has a real disable boundary and cannot turn an unconfigured contract green", () => {
    const registry = new LandfallProviderHealthRegistry([browser]);
    expect(() => registry.record(browser.id, "READY", 900)).toThrow("NOT_CONFIGURED");
    registry.configure(browser.id, { enabled: true, credentialAvailable: false });
    registry.record(browser.id, "RATE_LIMITED", 900, 10, 3000);
    expect(selectLandfallProviders([browser], registry.snapshot(), requirement, context)[0].reasons).toContain(
      "RATE_LIMIT",
    );
    registry.disable(browser.id);
    expect(() => registry.record(browser.id, "READY", 1100)).toThrow("DISABLED");
    expect(selectLandfallProviders([browser], registry.snapshot(), requirement, context)[0].reasons).toContain(
      "DISABLED",
    );
    expect(() => registry.record(browser.id, "SUSPENDED", NaN)).toThrow("TIME_INVALID");
    const snapshot = registry.snapshot();
    snapshot[0] = { ...snapshot[0], health: "READY" };
    expect(registry.snapshot()[0].health).toBe("SUSPENDED");
  });
  it("does not allow synthetic providers into ordinary runtime", () => {
    const provider = landfallSimulationCatalog()[0];
    const registry = new LandfallProviderHealthRegistry([provider]);
    registry.configure(provider.id, { enabled: true, credentialAvailable: false });
    registry.record(provider.id, "READY", 900);
    const required = { family: provider.family, capability: "simulation", offlineRequired: false };
    expect(
      selectLandfallProviders([provider], registry.snapshot(), required, { ...context, platform: "TEST" })[0].reasons,
    ).toContain("SIMULATION_ONLY");
    expect(
      selectLandfallProviders([provider], registry.snapshot(), required, {
        ...context,
        platform: "TEST",
        simulation: true,
      })[0].usable,
    ).toBe(true);
  });
  it("applies privacy, credential expiry, reachability and offline rights independently", () => {
    const provider = landfallProviderCatalog().find((item) => item.id === "configured-geocoder")!;
    const registry = new LandfallProviderHealthRegistry([provider]);
    registry.configure(provider.id, { enabled: true, credentialAvailable: true, credentialExpiresAt: 950 });
    registry.record(provider.id, "READY", 900);
    const selected = selectLandfallProviders(
      [provider],
      registry.snapshot(),
      { family: "GEOCODING", capability: "forward", offlineRequired: true },
      { ...context, platform: "SERVER", connectivity: "CAPTIVE_OR_UNUSABLE" },
    )[0];
    expect(selected.reasons).toEqual(expect.arrayContaining(["CREDENTIAL", "NETWORK", "PRIVACY", "OFFLINE_RIGHTS"]));
  });
});
describe("contextual permission and bounded power", () => {
  const policy = {
    lifecycle: "FOREGROUND" as const,
    connectivity: "ONLINE" as const,
    foregroundConsent: true,
    backgroundConsent: false,
    foregroundPermission: "GRANTED" as const,
    backgroundPermission: "PROMPTABLE" as const,
    lowPower: false,
    thermalPressure: false,
    precisionRequested: true,
  };
  it("never prompts on first launch or escalates background permission without a foreground grant", () => {
    const permission = {
      permission: "BACKGROUND_LOCATION" as const,
      state: "PROMPTABLE" as const,
      userAction: true,
      backgroundRequested: true,
      foregroundState: "DENIED" as const,
    };
    expect(contextualLandfallPermission(permission).mayPrompt).toBe(false);
    expect(
      contextualLandfallPermission({ ...permission, foregroundState: "GRANTED", userAction: false }).mayPrompt,
    ).toBe(false);
    expect(contextualLandfallPermission({ ...permission, foregroundState: "GRANTED" }).mayPrompt).toBe(true);
    expect(contextualLandfallPermission({ ...permission, state: "DENIED_PERMANENTLY" }).openSettings).toBe(true);
  });
  it("stops hidden sensors and rendering, suspension and revoked consent; low power explicitly reduces precision", () => {
    expect(landfallPowerPolicy(policy).profile).toBe("PRECISION_ACTIVE");
    expect(landfallPowerPolicy({ ...policy, lowPower: true })).toMatchObject({
      profile: "BALANCED_ACTIVE",
      precisionReduced: true,
      sensorIntervalMs: null,
      allowDownloads: false,
    });
    expect(landfallPowerPolicy({ ...policy, foregroundPermission: "APPROXIMATE" }).profile).toBe("BALANCED_ACTIVE");
    expect(
      landfallPowerPolicy({
        ...policy,
        lifecycle: "SCREEN_LOCKED",
        backgroundConsent: true,
        backgroundPermission: "GRANTED",
      }),
    ).toMatchObject({ profile: "BACKGROUND_LOW_POWER", renderMap: false, sensorIntervalMs: null, geofenceWake: true });
    for (const lifecycle of ["SUSPENDED", "TERMINATED"] as const)
      expect(
        landfallPowerPolicy({ ...policy, lifecycle, backgroundConsent: true, backgroundPermission: "GRANTED" })
          .locationIntervalMs,
      ).toBeNull();
    expect(landfallPowerPolicy({ ...policy, foregroundConsent: false }).profile).toBe("SUSPENDED");
  });
});
describe("provider authoring preserves old snapshots and rejects false fallback", () => {
  it("accepts unchanged Phase 1-3 fixtures and rejects mandatory missing providers", () => {
    expect(validateLandfallDefinition(landfallFixture)).toEqual(landfallFixture);
    expect(landfallProviderFindings(landfallFixture)).toEqual([]);
    const definition = validateLandfallDefinition({
      ...landfallFixture,
      providerPlan: {
        version: 1,
        requirements: [
          {
            worldspaceId: "town",
            family: "UWB",
            capability: "ranging",
            required: true,
            fallback: "NONE",
            offlineRequired: true,
            hardwareDisclosed: false,
          },
        ],
        offline: { requested: false, maxBytes: 1024, retentionHours: 1, mapIds: [], routeIds: [], assetIds: [] },
      },
    });
    const findings = landfallProviderFindings(definition);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LANDFALL_PROVIDER_NOT_CONFIGURED", severity: "blocker" }),
        expect.objectContaining({ code: "LANDFALL_PROVIDER_HARDWARE_DISCLOSURE", severity: "blocker" }),
      ]),
    );
    definition.providerPlan!.requirements[0].fallback = "AUTHORED";
    expect(landfallProviderFindings(definition)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_FALLBACK_INVALID" }),
    );
  });
});
