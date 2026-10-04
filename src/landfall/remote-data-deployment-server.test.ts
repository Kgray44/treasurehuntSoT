import { describe, expect, it, vi } from "vitest";
import { landfallFixture } from "./fixtures";
import { configuredRemoteServices, RemoteLandfallDataService } from "./remote-data-server";
import { landfallDeploymentProviderPreflight } from "./remote-data-deployment-server";
import { landfallProviderFindings } from "./provider-authoring";
import type { LandfallProviderPlan } from "./provider-policy";
const config = {
  kind: "NOMINATIM",
  baseUrl: "https://geo.example.test/",
  userAgent: "Synthetic Device Lab",
  license: "Synthetic license",
  attributionLabel: "Synthetic geography",
  attributionUrl: "https://geo.example.test/license",
  usageAgreementAccepted: true,
  authentication: "NONE",
};
const inputs = configuredRemoteServices({
  LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
  LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([config]),
});
const definition = (patch: Partial<LandfallProviderPlan["requirements"][number]> = {}) => {
  const d = structuredClone(landfallFixture);
  d.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
  d.providerPlan = {
    version: 1,
    requirements: [
      {
        worldspaceId: "town",
        family: "GEOCODING",
        capability: "forward",
        providerId: "configured-geocoder",
        required: true,
        fallback: "NONE",
        offlineRequired: false,
        hardwareDisclosed: false,
        ...patch,
      },
    ],
    offline: { requested: false, maxBytes: 1024, retentionHours: 1, mapIds: [], routeIds: [], assetIds: [] },
  };
  return d;
};
describe("server deployment provider preflight", () => {
  it("does not probe, expose secrets or promote configured metadata to readiness", () => {
    const transport = vi.fn();
    const service = new RemoteLandfallDataService(inputs, transport);
    const context = landfallDeploymentProviderPreflight(definition(), service, inputs);
    expect(transport).not.toHaveBeenCalled();
    expect(context.providers.find((value) => value.id === "configured-geocoder")).toMatchObject({
      requiresCredential: false,
      cacheRights: "PROHIBITED",
      offlineRights: "PROHIBITED",
    });
    expect(context.statuses(definition().providerPlan!.requirements[0])).toEqual([
      { id: "configured-geocoder", health: "CONFIGURED", enabled: true, configured: true, credentialAvailable: false },
    ]);
    expect(landfallProviderFindings(definition(), context.providers, context.statuses)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_NOT_CONFIGURED", severity: "blocker" }),
    );
    expect(JSON.stringify(context.providers)).not.toContain("baseUrl");
  });
  it("recognizes only a recent real adapter success and preserves offline prohibitions", async () => {
    let now = 10000;
    const transport = vi
      .fn()
      .mockResolvedValue([{ display_name: "Synthetic Square", lat: "40", lon: "-75", osm_type: "node", osm_id: 1 }]);
    const service = new RemoteLandfallDataService(inputs, transport, () => now);
    await service.execute({ operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 });
    const d = definition();
    let context = landfallDeploymentProviderPreflight(d, service, inputs);
    expect(landfallProviderFindings(d, context.providers, context.statuses)).toEqual([]);
    const offline = definition({ offlineRequired: true });
    context = landfallDeploymentProviderPreflight(offline, service, inputs);
    expect(landfallProviderFindings(offline, context.providers, context.statuses)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_OFFLINE" }),
    );
    now += 300001;
    context = landfallDeploymentProviderPreflight(d, service, inputs);
    expect(landfallProviderFindings(d, context.providers, context.statuses)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_NOT_CONFIGURED" }),
    );
  });
  it("never promotes a private Worldspace, unconfigured credentials or a different route mode", () => {
    const d = definition();
    d.worldspaces[0].privacyPolicy.classification = "PRIVATE_REAL_WORLD";
    const service = new RemoteLandfallDataService(inputs, vi.fn());
    const context = landfallDeploymentProviderPreflight(d, service, inputs);
    expect(context.statuses(d.providerPlan!.requirements[0])).toEqual([]);
    expect(landfallProviderFindings(d, context.providers, context.statuses)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_UNSUPPORTED" }),
    );
    const absent = configuredRemoteServices({
      LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
      LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([
        { ...config, authentication: "BEARER", bearerEnvironmentKey: "LANDFALL_SYNTHETIC_TOKEN" },
      ]),
    });
    expect(absent).toEqual([]);
    const routeInputs = configuredRemoteServices({
      LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
      LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([{ ...config, kind: "OSRM", mode: "WALKING", profile: "foot" }]),
    });
    const routeDefinition = definition({ family: "ROUTING", providerId: "configured-router", capability: "driving" });
    const routeContext = landfallDeploymentProviderPreflight(
      routeDefinition,
      new RemoteLandfallDataService(routeInputs, vi.fn()),
      routeInputs,
    );
    expect(landfallProviderFindings(routeDefinition, routeContext.providers, routeContext.statuses)).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_UNSUPPORTED" }),
    );
  });
  it("keeps local authored readiness scoped to each requirement", () => {
    const d = definition({ providerId: "authored-places", worldspaceId: "missing" });
    const context = landfallDeploymentProviderPreflight(d, new RemoteLandfallDataService([], vi.fn()), []);
    expect(context.statuses(d.providerPlan!.requirements[0])).toEqual([]);
    expect(context.statuses({ ...d.providerPlan!.requirements[0], worldspaceId: "town" })).toMatchObject([
      { id: "authored-places", health: "READY" },
    ]);
  });
});
