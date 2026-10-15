import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import type { EnvironmentCatalogItem } from "./spatial-library-environment-catalog";
import type { IndexedSummary } from "./spatial-catalog-page-service";
import type { CompactSpatialCatalogEntry } from "./spatial-catalog-read-projection";

const mocks = vi.hoisted(() => ({
  environments: vi.fn(),
  projectEnvironments: vi.fn(),
  owned: vi.fn(),
  readOwned: vi.fn(),
}));
vi.mock("./environment-library-compatibility", () => ({ listCompatibleEnvironments: mocks.environments }));
vi.mock("./spatial-library-environment-catalog", async (original) => ({
  ...(await original<typeof import("./spatial-library-environment-catalog")>()),
  projectEnvironmentCatalog: mocks.projectEnvironments,
}));
vi.mock("./spatial-catalog-page-service", async (original) => ({
  ...(await original<typeof import("./spatial-catalog-page-service")>()),
  listOwnedSpatialCatalogSummaries: mocks.owned,
  readOwnedSpatialCatalogItem: mocks.readOwned,
}));
import {
  pageCompactSpatialCatalog,
  readCompactSpatialCatalogPage,
  readExactSpatialCatalogItem,
  UnsupportedSpatialCatalogFilter,
} from "./spatial-catalog-read-projection";

function owned(index: number): IndexedSummary {
  const id = `owner-${String(index).padStart(3, "0")}`;
  return {
    checksum: canonicalChecksum(id),
    searchText: `owned scene ${index} deep-tag`,
    summary: {
      id,
      kind: "SCENES",
      origin: "MY_CREATIONS",
      name: `Owned Scene ${String(index).padStart(3, "0")}`,
      description: "",
      classification: "",
      tags: ["deep-tag"],
      collection: "",
      favorite: index === 109,
      environmentId: index === 109 ? "room" : null,
      environmentName: index === 109 ? "A Room" : null,
      objectCount: 1,
      includedElements: [],
      previewMarks: [{ id: `${id}:mark`, kind: "PARCHMENT", x: 0, z: 0 }],
      revision: 1,
      saveState: "SAVED",
      archived: false,
      usageCount: 0,
      releaseCount: 5,
      updatedAt: "2026-10-15T00:00:00.000Z",
    },
  };
}

const room = {
  id: "room",
  record: { representation: "SC01_SCHEMA1" },
  name: "A Room",
  description: "Real fixture source",
  origin: "BUILT_IN",
  saveState: null,
  archived: false,
  workingRevision: null,
  immutableVersions: [],
  collection: null,
  favorite: null,
  updatedAt: null,
  widthMeters: 4,
  depthMeters: 4,
  authoredFeatureCount: 1,
  preview: null,
  searchText: "a room real fixture source",
} as unknown as EnvironmentCatalogItem;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.environments.mockResolvedValue([{ id: "room", representation: "SC01_SCHEMA1" }]);
  mocks.projectEnvironments.mockReturnValue([room]);
  mocks.owned.mockResolvedValue(Array.from({ length: 110 }, (_, index) => owned(index)));
  mocks.readOwned.mockResolvedValue(null);
});

describe("global compact Spatial Library read projection", () => {
  it("includes the implemented physical, effect and composition providers without caller injection", async () => {
    const effects = await readCompactSpatialCatalogPage("creator", { kind: "EFFECTS" });
    expect(effects.items.some((entry) => entry.id === "sc02:point-light")).toBe(true);
    expect(effects.items.every((entry) => entry.origin === "BUILT_IN")).toBe(true);
    const assets = await readCompactSpatialCatalogPage("creator", { kind: "ASSETS" });
    expect(assets.items.some((entry) => entry.id === "sc02:articulated-chest")).toBe(true);
    const compositions = await readCompactSpatialCatalogPage("creator", { kind: "COMPOSITIONS" });
    expect(compositions.items.some((entry) => entry.id.startsWith("sc02:"))).toBe(true);
  });

  it("merges existing providers before global search, source filter, sort and pagination", async () => {
    const installed = {
      id: "installed:scene",
      kind: "SCENES" as const,
      origin: "INSTALLED" as const,
      name: "A Installed Scene",
      description: "Community test fixture",
      family: "Installed",
    };
    const first = await readCompactSpatialCatalogPage("creator", { kind: "SCENES", limit: 48 }, [installed]);
    expect(first.total).toBe(111);
    expect(first.items).toHaveLength(48);
    expect(first.items[0].id).toBe("installed:scene");
    expect(first.items.every((item) => !("scene" in item) && !("environment" in item))).toBe(true);
    const second = await readCompactSpatialCatalogPage(
      "creator",
      { kind: "SCENES", limit: 48, cursor: first.nextCursor! },
      [installed],
    );
    const third = await readCompactSpatialCatalogPage(
      "creator",
      { kind: "SCENES", limit: 48, cursor: second.nextCursor! },
      [installed],
    );
    expect([first.items.length, second.items.length, third.items.length]).toEqual([48, 48, 15]);
    expect(new Set([...first.items, ...second.items, ...third.items].map((entry) => entry.id)).size).toBe(111);
    const far = await readCompactSpatialCatalogPage("creator", { kind: "SCENES", search: "owned scene 109" }, [
      installed,
    ]);
    expect(far.items.map((item) => item.id)).toEqual(["saved:owner-109"]);
    const byParent = await readCompactSpatialCatalogPage("creator", { kind: "SCENES", environmentId: "room" }, [
      installed,
    ]);
    expect(byParent.items.map((item) => item.id)).toEqual(["saved:owner-109"]);
    const installedOnly = await readCompactSpatialCatalogPage("creator", { kind: "SCENES", origin: "INSTALLED" }, [
      installed,
    ]);
    expect(installedOnly.total).toBe(1);
    const builtinPlaces = await readCompactSpatialCatalogPage("creator", { kind: "ENVIRONMENTS", origin: "BUILT_IN" }, [
      installed,
    ]);
    expect(builtinPlaces.items.map((item) => item.id)).toEqual(["environment:room"]);
    expect(mocks.owned).toHaveBeenCalledWith("creator", { room: "A Room" });
  });

  it("binds global cursors to provider changes, query and owner, and refuses unsupported usage filters", () => {
    const entries: { entry: CompactSpatialCatalogEntry; checksum: string }[] = Array.from({ length: 3 }, (_, index) => {
      const entry: CompactSpatialCatalogEntry = {
        id: `saved:${index}`,
        kind: "SCENES",
        origin: "MY_CREATIONS",
        name: `Scene ${index}`,
        description: "",
        family: "Saved Scene",
        searchText: `scene ${index}`,
        archived: false,
      };
      return { entry, checksum: canonicalChecksum(entry) };
    });
    const first = pageCompactSpatialCatalog(entries, { kind: "SCENES", limit: 1 }, "creator");
    expect(
      pageCompactSpatialCatalog(
        [...entries].reverse(),
        { kind: "SCENES", limit: 1, cursor: first.nextCursor! },
        "creator",
      ).items[0].id,
    ).toBe("saved:1");
    expect(() =>
      pageCompactSpatialCatalog(entries, { kind: "SCENES", limit: 1, cursor: first.nextCursor! }, "other"),
    ).toThrow(/stale/);
    expect(() =>
      pageCompactSpatialCatalog(entries.slice(1), { kind: "SCENES", limit: 1, cursor: first.nextCursor! }, "creator"),
    ).toThrow(/stale/);
    expect(() =>
      pageCompactSpatialCatalog(
        entries,
        { kind: "SCENES", search: "other", limit: 1, cursor: first.nextCursor! },
        "creator",
      ),
    ).toThrow(/stale/);
    expect(() => pageCompactSpatialCatalog(entries, { kind: "SCENES", origin: "RECENTLY_USED" }, "creator")).toThrow(
      UnsupportedSpatialCatalogFilter,
    );
    expect(() => pageCompactSpatialCatalog(entries, { kind: "SCENES", origin: "IN_USE" }, "creator")).toThrow(
      UnsupportedSpatialCatalogFilter,
    );
  });

  it("returns exact canonical records by selected ID, with no inferred current Environment pin", async () => {
    const source = { id: "owner-109", releases: [{ id: "positive-release" }] };
    mocks.readOwned.mockResolvedValueOnce(source);
    expect(await readExactSpatialCatalogItem("creator", "saved:owner-109")).toEqual({
      kind: "SPATIAL",
      record: source,
    });
    expect(mocks.readOwned).toHaveBeenCalledWith("creator", "owner-109");
    expect(await readExactSpatialCatalogItem("creator", "environment:room")).toEqual({
      kind: "ENVIRONMENT",
      record: { id: "room", representation: "SC01_SCHEMA1" },
    });
    expect(await readExactSpatialCatalogItem("creator", "classic:Desk Map")).toBeNull();
    expect(await readExactSpatialCatalogItem("creator", "saved:foreign")).toBeNull();
  });
});
