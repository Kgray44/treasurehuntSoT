// @sounding-line suite=unit.landfall contract=landfall.player-live-position
import { describe, expect, it, vi } from "vitest";
import { landfallOperationsProviders } from "./provider-operations-server";
import { configuredRemoteServices, RemoteLandfallDataService } from "./remote-data-server";
import { RemoteDataFailure } from "./remote-network-server";

const inputs = configuredRemoteServices({
  LANDFALL_REMOTE_DATA_MODE: "ephemeral-instance",
  LANDFALL_REMOTE_DATA_CONFIG: JSON.stringify([
    {
      kind: "NOMINATIM",
      baseUrl: "https://geo.example.test/",
      userAgent: "Synthetic operator contact",
      license: "Synthetic fixture rights",
      attributionLabel: "Synthetic source",
      attributionUrl: "https://rights.example.test/",
      usageAgreementAccepted: true,
      authentication: "BEARER",
      bearerEnvironmentKey: "LANDFALL_SYNTHETIC_KEY",
    },
  ]),
  LANDFALL_SYNTHETIC_KEY: "synthetic-private-key-never-projected",
});
describe("Landfall metadata through existing operations", () => {
  it("shows configuration separately from demand and never probes on repeated reads", () => {
    const transport = vi.fn();
    const service = new RemoteLandfallDataService(inputs, transport);
    for (let index = 0; index < 5; index++) {
      const cards = landfallOperationsProviders(service);
      expect(cards).toHaveLength(3);
      expect(cards[0]).toMatchObject({
        configured: true,
        health: "UNKNOWN",
        liveValidation: "NOT_LIVE_VALIDATED",
        safeCode: "CONFIGURED",
        demand: { lastSuccessAt: null, lastFailureAt: null, latencyMs: null },
      });
      expect(cards[1]).toMatchObject({ configured: false, safeCode: "NOT_CONFIGURED" });
      expect(JSON.stringify(cards)).not.toMatch(/geo\.example|synthetic-private-key|LANDFALL_SYNTHETIC_KEY/);
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it("keeps bounded success and failure history, ages readiness and resets history on process replacement", async () => {
    let now = 1000;
    const transport = vi.fn(async () => {
      now += 40;
      return [{ display_name: "Synthetic place", osm_type: "node", osm_id: 1, lat: "44.1", lon: "-72.2" }];
    });
    const service = new RemoteLandfallDataService(inputs, transport, () => now);
    const command = { operation: "SEARCH" as const, consent: true as const, query: "synthetic secret query", limit: 1 };
    await service.execute(command);
    let card = landfallOperationsProviders(service)[0];
    expect(card).toMatchObject({
      health: "HEALTHY",
      demand: { lastSuccessAt: 1040, lastFailureAt: null, latencyMs: 40 },
    });
    now += 300001;
    expect(landfallOperationsProviders(service)[0]).toMatchObject({ health: "UNKNOWN", safeCode: "CONFIGURED" });
    transport.mockImplementationOnce(async () => {
      now += 20;
      throw new RemoteDataFailure("RATE_LIMITED", 12);
    });
    await service.execute(command);
    card = landfallOperationsProviders(service)[0];
    expect(card).toMatchObject({
      health: "DEGRADED",
      safeCode: "RATE_LIMITED",
      demand: { lastSuccessAt: 1040, lastFailureAt: now, latencyMs: 20, retryAfter: now + 12000 },
    });
    expect(JSON.stringify(card)).not.toMatch(/secret query|44\.1|-72\.2|geo\.example|synthetic-private-key/);
    expect(
      landfallOperationsProviders(new RemoteLandfallDataService(inputs, vi.fn()))[0].demand.lastSuccessAt,
    ).toBeNull();
  });
});
