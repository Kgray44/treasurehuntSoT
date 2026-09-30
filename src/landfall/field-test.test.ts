import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";

const mocks = vi.hoisted(() => ({
  draft: vi.fn(),
  create: vi.fn(),
  findReceipts: vi.fn(),
  deleteReceipts: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    taleDraft: { findFirst: mocks.draft },
    landfallFieldTestReceipt: { create: mocks.create, findMany: mocks.findReceipts, deleteMany: mocks.deleteReceipts },
  },
}));

import { listLandfallFieldTests, recordLandfallFieldTest } from "@/landfall/field-test";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.draft.mockResolvedValue({
    id: "draft-1",
    autosaveVersion: 2,
    landfallDefinition: JSON.stringify(landfallFixture),
  });
  mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: "receipt-1", testedAt: new Date() }));
  mocks.findReceipts.mockResolvedValue([]);
});

describe("Creator Landfall field-test receipts", () => {
  it("stores only bounded diagnostic classes and rejects a stale draft revision", async () => {
    const now = Date.now();
    const observations = [
      physicalObservation("first", new Date(now - 1000).toISOString()),
      physicalObservation("second", new Date(now).toISOString()),
    ].map((item) => ({
      ...item,
      sessionId: "field-test-draft-1",
      publishedVersionId: "draft-draft-1-2",
      providerId: "browser-geolocation",
    }));
    const result = await recordLandfallFieldTest("fixture-tale", {
      sourceVersion: 2,
      worldspaceId: "town",
      mapId: "town-map",
      waypointId: "town-arrival",
      mode: "PHYSICAL_WALK",
      permission: "GRANTED",
      networkState: "ONLINE",
      observations,
    });
    expect(result.sampleCount).toBe(2);
    const stored = mocks.create.mock.calls[0][0].data;
    expect(stored.definitionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.providerClass).toBe("BROWSER_REPORTED_GEOLOCATION");
    expect(JSON.stringify(stored)).not.toContain("latitude");
    expect(JSON.stringify(stored)).not.toContain("longitude");
    await expect(
      recordLandfallFieldTest("fixture-tale", {
        sourceVersion: 1,
        worldspaceId: "town",
        mapId: "town-map",
        waypointId: "town-arrival",
        mode: "PHYSICAL_WALK",
        permission: "GRANTED",
        networkState: "ONLINE",
        observations,
      }),
    ).rejects.toThrow("SOURCE_CHANGED");
  });

  it("marks receipts stale after the draft changes", async () => {
    mocks.findReceipts.mockResolvedValue([
      {
        id: "old",
        testedAt: new Date(),
        sourceVersion: 1,
        definitionHash: "old-hash",
        worldspaceId: "town",
        mapId: "town-map",
        waypointId: null,
        routeId: null,
        providerClass: "VIRTUAL_PREVIEW",
        result: "INCOMPLETE",
        permission: "UNAVAILABLE",
        accuracyBand: null,
        confidence: "UNAVAILABLE",
        sampleCount: 0,
        dwellSeconds: 0,
        networkState: "ONLINE",
        warnings: "[]",
      },
    ]);
    const result = await listLandfallFieldTests("fixture-tale");
    expect(result.receipts[0].stale).toBe(true);
  });
});
