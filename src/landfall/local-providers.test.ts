import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate, virtualCoordinate } from "@/landfall/fixtures";
import {
  AuthoredGeocodingProvider,
  AuthoredRoutingProvider,
  PackagedElevationProvider,
  authoredVirtualPosition,
} from "@/landfall/local-providers";
import { LandfallConnectivityProvider } from "@/landfall/connectivity";
import {
  LandfallBackgroundNavigation,
  resolveLandfallNotificationReturn,
  type BackgroundHintStorage,
  type NativeJourneyScope,
} from "@/landfall/background-navigation";

describe("concrete authored providers", () => {
  it("searches only the released input and preserves explicit coordinate units", () => {
    const domain = structuredClone(landfallFixture);
    domain.waypoints = domain.waypoints.slice(0, 1);
    const provider = new AuthoredGeocodingProvider(domain);
    expect(
      provider.forward({ query: domain.waypoints[0].name, worldspaceId: domain.waypoints[0].worldspaceId }),
    ).toHaveLength(1);
    expect(provider.forward({ query: "unreleased secret", worldspaceId: "town" })).toEqual([]);
    expect(() => provider.forward({ query: "a", worldspaceId: "missing" })).toThrow("WORLDSPACE_UNAVAILABLE");
    expect(() => provider.reverse(virtualCoordinate(0.5, 0.5), Infinity)).toThrow("DISTANCE_INVALID");
    const virtual = authoredVirtualPosition(domain, {
      worldspaceId: "isles",
      coordinate: virtualCoordinate(0.5, 0.5),
      uncertaintyUnits: 0.2,
    });
    expect(virtual).toMatchObject({ source: "PLAYER_CONFIRMATION", automatic: false });
    expect(() =>
      authoredVirtualPosition(domain, {
        worldspaceId: "town",
        coordinate: physicalCoordinate(0, 0),
        uncertaintyUnits: 1,
      }),
    ).toThrow("WORLDSPACE");
  });
  it("cannot promote suggestions into canonical routes or invent precise floor height", () => {
    const provider = new AuthoredRoutingProvider(landfallFixture);
    const routes = provider.routes("town");
    expect(routes.every((route) => !route.authoritative && route.safety === "REVIEW_REQUIRED")).toBe(true);
    if (routes[0]) {
      routes[0].route.name = "changed";
      expect(landfallFixture.routes[0].name).not.toBe("changed");
    }
    const terrain = new PackagedElevationProvider(landfallFixture, [
      { coordinate: physicalCoordinate(0, 0), meters: 10, accuracyMeters: 30 },
    ]);
    expect(terrain.lookup(physicalCoordinate(0, 0), 100)).toEqual({
      state: "AVAILABLE",
      meters: 10,
      accuracyMeters: 30,
      floorConfirmed: false,
    });
    expect(terrain.lookup(physicalCoordinate(1, 1), 100)).toEqual({ state: "UNAVAILABLE" });
    expect(
      () =>
        new PackagedElevationProvider(landfallFixture, [
          { coordinate: physicalCoordinate(0, 0), meters: NaN, accuracyMeters: 1 },
        ]),
    ).toThrow("INVALID");
  });
});
describe("application reachability", () => {
  it("requires a bounded fresh same-origin challenge and detects captive responses", async () => {
    const transport = (async (url: string) =>
      Response.json({ landfall: "reachable", challenge: new URL(url).searchParams.get("challenge") })) as typeof fetch;
    expect((await new LandfallConnectivityProvider("https://journey.example", transport).probe(true)).state).toBe(
      "ONLINE",
    );
    const captive = (async () =>
      new Response("<html>login</html>", { headers: { "content-type": "text/html" } })) as typeof fetch;
    expect((await new LandfallConnectivityProvider("https://journey.example", captive).probe(true)).state).toBe(
      "CAPTIVE_OR_UNUSABLE",
    );
    expect((await new LandfallConnectivityProvider("https://journey.example", transport).probe(false)).state).toBe(
      "OFFLINE",
    );
    const replay = (async () => Response.json({ landfall: "reachable", challenge: "old" })) as typeof fetch;
    expect((await new LandfallConnectivityProvider("https://journey.example", replay).probe(true)).state).toBe(
      "CAPTIVE_OR_UNUSABLE",
    );
  });
});
const scope: NativeJourneyScope = {
  playerProfileId: "player",
  sessionId: "voyage",
  publishedVersionId: "edition",
  worldspaceId: "town",
  waypointId: "door",
  expectedSequence: 2,
};
const capability = { physical: true, backgroundConsent: true, permissionGranted: true };
describe("background hint recovery and private notification return", () => {
  it("survives restart, serializes duplicate callbacks, rejects stale/out-of-order input and clears on access changes", async () => {
    let journal: unknown = null;
    const storage: BackgroundHintStorage = {
      read: async () => structuredClone(journal),
      write: async (input) => {
        journal = structuredClone(input);
      },
      clear: async () => {
        journal = null;
      },
    };
    let now = 10000;
    const service = new LandfallBackgroundNavigation(storage, () => now);
    const hint = { version: 1, id: "event-1", scope, event: "ENTER", observedAt: 9000, receivedAt: 9500 };
    const results = await Promise.all([
      service.ingest(hint, scope, capability),
      service.ingest(hint, scope, capability),
    ]);
    expect(results.map((result) => result.result)).toEqual(["NEARBY_HINT", "DUPLICATE"]);
    expect(results[0].needsForegroundConfirmation).toBe(true);
    const restarted = new LandfallBackgroundNavigation(storage, () => now);
    expect(await restarted.pending(scope)).toHaveLength(1);
    expect((await restarted.ingest({ ...hint, id: "event-2", observedAt: 8000 }, scope, capability)).result).toBe(
      "OUT_OF_ORDER",
    );
    expect(
      (await restarted.ingest({ ...hint, id: "event-3", event: "EXIT", observedAt: 9500 }, scope, capability))
        .needsForegroundConfirmation,
    ).toBe(false);
    now += 400000;
    expect((await restarted.ingest(hint, scope, capability)).result).toBe("STALE");
    expect(await restarted.pending({ ...scope, playerProfileId: "other" })).toEqual([]);
    expect(journal).toBeNull();
    expect((await restarted.ingest(hint, scope, { ...capability, permissionGranted: false })).result).toBe(
      "PERMISSION_UNAVAILABLE",
    );
    expect((await restarted.ingest(hint, scope, { ...capability, physical: false })).result).toBe("NOT_PHYSICAL");
  });
  it("resolves current membership and pinned edition instead of payload state or arbitrary URLs", async () => {
    const notification = { version: 1, id: "reminder", returnHandle: "x".repeat(64), issuedAt: 100, expiresAt: 10000 };
    const current = {
      signedIn: true,
      membershipActive: true,
      sessionId: "voyage",
      publishedVersionId: "pinned-old-edition",
      status: "ACTIVE" as const,
    };
    expect(await resolveLandfallNotificationReturn(notification, async () => current, 1000)).toMatchObject({
      state: "CURRENT_JOURNEY",
      destination: "/player/playthroughs/voyage/journal",
    });
    expect(
      (
        await resolveLandfallNotificationReturn(
          notification,
          async () => ({ ...current, membershipActive: false }),
          1000,
        )
      ).state,
    ).toBe("UNAVAILABLE");
    expect(
      (await resolveLandfallNotificationReturn(notification, async () => ({ ...current, status: "COMPLETED" }), 1000))
        .state,
    ).toBe("COMPLETED_JOURNEY");
    expect((await resolveLandfallNotificationReturn(notification, async () => current, 10000)).state).toBe("EXPIRED");
    expect(
      (await resolveLandfallNotificationReturn({ ...notification, url: "javascript:evil" }, async () => current, 1000))
        .state,
    ).toBe("UNAVAILABLE");
  });
});
