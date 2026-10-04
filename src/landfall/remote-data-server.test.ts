import { describe, expect, it, vi } from "vitest";
import { configuredRemoteServices, RemoteLandfallDataService } from "./remote-data-server";
import { isPublicRemoteIpv4, isRemoteServiceUrl, RemoteDataFailure } from "./remote-network-server";
import type { RemoteJsonRequest } from "./remote-network-server";
import type { RemoteDataRequest } from "./remote-data";

const base = {
  userAgent: "Synthetic Landfall test-only contact",
  license: "Synthetic licensed fixture",
  attributionLabel: "Synthetic provider",
  attributionUrl: "https://license.example.test/terms",
  usageAgreementAccepted: true,
  authentication: "NONE",
};
const configs = [
  { ...base, kind: "NOMINATIM", baseUrl: "https://geo.example.test/data/" },
  { ...base, kind: "OSRM", baseUrl: "https://route.example.test/", mode: "WALKING", profile: "foot" },
  { ...base, kind: "OPEN_ELEVATION", baseUrl: "https://height.example.test/" },
];
const inputs = () =>
  configuredRemoteServices({
    LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
    LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify(configs),
  });
const search: RemoteDataRequest = { operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 };
const place = { display_name: "Synthetic Square", osm_type: "node", osm_id: 1, lat: "44.1", lon: "-72.2" };

describe("bounded replaceable online data", () => {
  it("reports explicit configuration without a request or credential/URL disclosure", () => {
    const transport = vi.fn();
    const service = new RemoteLandfallDataService(inputs(), transport);
    expect(service.status()).toMatchObject({
      state: "STATUS",
      services: [
        { id: "configured-geocoder", state: "CONFIGURED", recipient: "geo.example.test" },
        { id: "configured-router", state: "CONFIGURED", mode: "WALKING" },
        { id: "configured-elevation", state: "CONFIGURED", offlineRights: "PROHIBITED" },
      ],
    });
    expect(transport).not.toHaveBeenCalled();
    expect(configuredRemoteServices({})).toEqual([]);
    expect(configuredRemoteServices({ LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify(configs) })).toEqual([]);
    expect(
      configuredRemoteServices({
        LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
        LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([{ ...configs[0], usageAgreementAccepted: false }]),
      }),
    ).toEqual([]);
    expect(
      configuredRemoteServices({
        LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
        LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([configs[0], configs[0]]),
      }),
    ).toEqual([]);
  });
  it("rejects endpoints and DNS addresses that could reach private, reserved or public demo infrastructure", () => {
    for (const url of [
      "http://geo.example.test/",
      "https://secret:token@geo.example.test/",
      "https://geo.example.test/?key=secret",
      "https://geo.example.test:8443/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://server.internal/",
      "https://localhost/",
      "https://nominatim.openstreetmap.org/",
      "https://router.project-osrm.org/",
      "https://api.open-elevation.com/",
    ])
      expect(isRemoteServiceUrl(url)).toBe(false);
    for (const address of [
      "0.0.0.0",
      "10.1.1.1",
      "127.0.0.1",
      "169.254.169.254",
      "100.100.100.200",
      "172.16.1.1",
      "192.168.1.1",
      "192.0.2.4",
      "198.19.0.1",
      "198.51.100.2",
      "203.0.113.1",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "168.63.129.16",
    ])
      expect(isPublicRemoteIpv4(address)).toBe(false);
    expect(isRemoteServiceUrl(configs[0].baseUrl)).toBe(true);
    expect(isPublicRemoteIpv4("8.8.8.8")).toBe(true);
  });
  it("keeps deployment bearer credentials server-only and fails closed on absent/revoked configuration", () => {
    const config = { ...configs[0], authentication: "BEARER", bearerEnvironmentKey: "LANDFALL_SYNTHETIC_TOKEN" };
    const env = {
      LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
      LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([config]),
    };
    expect(configuredRemoteServices(env)).toEqual([]);
    const token = "SYNTHETIC-TEST-TOKEN-ONLY";
    const summary = new RemoteLandfallDataService(
      configuredRemoteServices({ ...env, LANDFALL_SYNTHETIC_TOKEN: token }),
    ).status();
    expect(JSON.stringify(summary)).not.toContain(token);
    expect(JSON.stringify(summary)).not.toContain("bearerEnvironmentKey");
  });
  it("uses only declared protocols and returns bounded untrusted data with no progression authority", async () => {
    const transport = vi.fn(async (request: RemoteJsonRequest) => {
      if (request.url.pathname.includes("search")) return [place];
      if (request.url.pathname.includes("reverse")) return place;
      if (request.url.pathname.includes("route/v1"))
        return {
          code: "Ok",
          routes: [
            {
              distance: 10,
              duration: 8,
              geometry: {
                type: "LineString",
                coordinates: [
                  [-72.2, 44.1],
                  [-72.3, 44.2],
                ],
              },
            },
          ],
        };
      return { results: [{ latitude: 44.1, longitude: -72.2, elevation: 0 }] };
    });
    let now = 10000;
    const service = new RemoteLandfallDataService(inputs(), transport, () => now);
    expect(await service.execute(search)).toMatchObject({
      state: "RESULT",
      canComplete: false,
      places: [{ accuracy: "UNKNOWN", authoritative: false }],
    });
    const query = transport.mock.calls[0][0].url;
    expect(query.hostname).toBe("geo.example.test");
    expect(query.pathname).toBe("/data/search");
    expect(query.searchParams.get("q")).toBe(search.query);
    now += 1100;
    expect(
      await service.execute({ operation: "REVERSE", consent: true, point: { latitude: 44.1, longitude: -72.2 } }),
    ).toMatchObject({ state: "RESULT" });
    expect(
      await service.execute({
        operation: "ROUTE",
        consent: true,
        mode: "WALKING",
        from: { latitude: 44.1, longitude: -72.2 },
        to: { latitude: 44.2, longitude: -72.3 },
      }),
    ).toMatchObject({
      state: "RESULT",
      route: { safety: "REVIEW_REQUIRED", accessibility: "NOT_ASSESSED", authoritative: false },
    });
    expect(
      await service.execute({ operation: "ELEVATION", consent: true, point: { latitude: 44.1, longitude: -72.2 } }),
    ).toMatchObject({
      state: "RESULT",
      elevation: { meters: 0, uncertainty: "UNKNOWN", missingCoveragePossible: true, floorConfirmed: false },
    });
    expect(transport.mock.calls.at(-1)?.[0].method).toBe("POST");
    expect(
      await service.execute({
        operation: "ROUTE",
        consent: true,
        mode: "DRIVING",
        from: { latitude: 44.1, longitude: -72.2 },
        to: { latitude: 44.2, longitude: -72.3 },
      }),
    ).not.toMatchObject({ state: "RESULT" });
  });
  it("requires deliberate consent and rejects overlong, executable, out-of-bounds or malformed results", async () => {
    const transport = vi.fn(async () => [place]);
    const service = new RemoteLandfallDataService(inputs(), transport, () => 10000);
    await expect(service.execute({ ...search, consent: false } as unknown as RemoteDataRequest)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    expect(await service.execute({ ...search, bounds: { west: 0, east: 1, south: 0, north: 1 } })).toMatchObject({
      state: "UNAVAILABLE",
      canComplete: false,
    });
    const malformed = new RemoteLandfallDataService(
      inputs(),
      vi.fn(async () => [{ ...place, display_name: "<script>alert(1)</script>" }]),
      () => 10000,
    );
    expect(await malformed.execute(search)).toMatchObject({ state: "UNAVAILABLE" });
  });
  it("bounds concurrency, rate recovery and backward clocks without retries or retained queries", async () => {
    let now = 10000;
    const transport = vi.fn(async () => {
      throw new RemoteDataFailure("RATE_LIMITED", 9999);
    });
    const service = new RemoteLandfallDataService(inputs(), transport, () => now);
    expect(await service.execute(search)).toMatchObject({ state: "RATE_LIMITED", retryAfterSeconds: 60 });
    now += 10000;
    expect(await service.execute(search)).toMatchObject({ state: "RATE_LIMITED" });
    expect(transport).toHaveBeenCalledTimes(1);
    now += 61000;
    expect(await service.execute(search)).toMatchObject({ state: "RATE_LIMITED", retryAfterSeconds: 60 });
    expect(transport).toHaveBeenCalledTimes(1);
    now = 9000;
    expect(await service.execute(search)).toEqual({ state: "UNAVAILABLE", canComplete: false });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(service.status())).not.toContain(search.query);
  });
});
