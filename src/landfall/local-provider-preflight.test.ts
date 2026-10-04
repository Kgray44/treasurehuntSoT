import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { localLandfallProviderPreflight } from "@/landfall/local-provider-preflight";
import { landfallProviderFindings } from "@/landfall/provider-authoring";
import type { LandfallDefinition } from "@/landfall/schema";
import type { LandfallProviderPlan } from "@/landfall/provider-policy";

type Requirement = LandfallProviderPlan["requirements"][number];
const requirement = (patch: Partial<Requirement> = {}): Requirement => ({
  worldspaceId: "town",
  family: "GEOCODING",
  capability: "forward",
  providerId: "authored-places",
  required: true,
  fallback: "NONE",
  offlineRequired: true,
  hardwareDisclosed: false,
  ...patch,
});
const withRequirement = (input: Requirement, definition: LandfallDefinition = landfallFixture): LandfallDefinition => ({
  ...definition,
  providerPlan: {
    version: 1,
    requirements: [input],
    offline: { requested: false, maxBytes: 1024, retentionHours: 1, mapIds: [], routeIds: [], assetIds: [] },
  },
});

describe("capability-scoped authored preflight", () => {
  it("recognizes implemented local data through the existing authoring/Drydock findings while explicit runtime absence wins", () => {
    const input = withRequirement(requirement());
    expect(localLandfallProviderPreflight(input, requirement())).toMatchObject([
      { id: "authored-places", health: "READY", configured: true, credentialAvailable: false },
    ]);
    expect(landfallProviderFindings(input)).toEqual([]);
    expect(landfallProviderFindings(input, undefined, [])).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_NOT_CONFIGURED", severity: "blocker" }),
    );
  });
  it("does not promote a cataloged external service, device, credential or inaccessible route", () => {
    for (const input of [
      requirement({ providerId: "configured-geocoder", offlineRequired: false }),
      requirement({ family: "LOCATION", capability: "foreground", providerId: "android-location" }),
      requirement({ family: "UWB", capability: "ranging", providerId: "native-uwb" }),
      requirement({ family: "ROUTING", capability: "accessible", providerId: "authored-routes", fallback: "AUTHORED" }),
    ]) {
      expect(localLandfallProviderPreflight(landfallFixture, input)).toEqual([]);
      const definition = structuredClone(landfallFixture);
      definition.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
      expect(landfallProviderFindings(withRequirement(input, definition))).toContainEqual(
        expect.objectContaining({ code: "LANDFALL_PROVIDER_NOT_CONFIGURED", severity: "blocker" }),
      );
    }
    expect(
      landfallProviderFindings(
        withRequirement(
          requirement({
            family: "ROUTING",
            capability: "accessible",
            providerId: "authored-routes",
            fallback: "AUTHORED",
          }),
        ),
      ),
    ).toContainEqual(expect.objectContaining({ code: "LANDFALL_PROVIDER_FALLBACK_INVALID" }));
  });
  it("uses the requested Worldspace and exact capability; an approximate search cannot expose reverse coordinates", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints[0].geometry = {
      type: "APPROXIMATE_REGION",
      center: physicalCoordinate(44, -72),
      radius: 100,
      publicRadius: 1000,
    };
    expect(localLandfallProviderPreflight(definition, requirement())).toHaveLength(1);
    const reverse = requirement({ capability: "reverse", fallback: "AUTHORED" });
    expect(localLandfallProviderPreflight(definition, reverse)).toEqual([]);
    expect(landfallProviderFindings(withRequirement(reverse, definition))).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_PROVIDER_FALLBACK_INVALID", severity: "blocker" }),
    );
    expect(localLandfallProviderPreflight(definition, requirement({ worldspaceId: "missing" }))).toEqual([]);
    expect(
      localLandfallProviderPreflight(definition, requirement({ worldspaceId: "isles", capability: "reverse" })),
    ).toEqual([]);
    expect(
      localLandfallProviderPreflight(definition, requirement({ worldspaceId: "isles", capability: "forward" })),
    ).toHaveLength(1);
  });
});
