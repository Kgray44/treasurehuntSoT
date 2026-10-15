import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "./authoring";
import { materializeLibraryMoment, listSpatialItems } from "./library-service";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { reusableAuthoringItem: { findMany: mocks.findMany, findFirst: mocks.findFirst } },
}));
import { pageOwnedSpatialCatalog, readOwnedSpatialCatalogItem } from "./spatial-catalog-page-service";

function row(
  index: number,
  overrides?: {
    owner?: string;
    archived?: boolean;
    released?: boolean;
    composition?: boolean;
    effect?: boolean;
    installed?: boolean;
  },
) {
  const id = `scene-${String(index).padStart(4, "0")}`;
  const draft = createSpatialDraft(id);
  draft.content.title = `Scale Scene ${String(index).padStart(4, "0")}`;
  draft.tags = index === 119 ? ["far-end-tag"] : [];
  draft.collection = index >= 100 ? "Late collection" : "First collection";
  draft.favorite = index === 119;
  if (overrides?.composition) {
    draft.library = { type: "TEMPLATE", description: "Reusable composition" };
    draft.category = "SCENE_TEMPLATE";
    draft.tags.push("composition");
  }
  if (overrides?.effect) draft.category = "EFFECT";
  const versions = [
    {
      id: `${id}:working`,
      itemId: id,
      versionNumber: 0,
      envelope: JSON.stringify(draft),
      checksum: canonicalChecksum(draft),
      createdAt: new Date("2026-10-15T00:00:00Z"),
    },
  ];
  if (overrides?.released) {
    const moment = materializeLibraryMoment(draft, overrides.owner ?? "creator", 1);
    versions.push({
      id: moment.version.id,
      itemId: id,
      versionNumber: 1,
      envelope: JSON.stringify(moment),
      checksum: moment.version.checksum,
      createdAt: new Date("2026-10-15T01:00:00Z"),
    });
  }
  return {
    id,
    ownerAccountId: overrides?.owner ?? "creator",
    kind: "PARALLAX_STUDIO",
    currentVersionNumber: 1,
    status: overrides?.installed ? "INSTALLED_READ_ONLY" : overrides?.released ? "SAVED" : "WORKING",
    archivedAt: overrides?.archived ? new Date("2026-10-15T02:00:00Z") : null,
    updatedAt: new Date(`2026-10-15T${String(Math.floor(index / 60)).padStart(2, "0")}:00:00Z`),
    versions,
    _count: { versions: versions.length, usages: 0 },
  };
}

let rows: ReturnType<typeof row>[];
beforeEach(() => {
  vi.clearAllMocks();
  rows = Array.from({ length: 120 }, (_, index) => row(index));
  mocks.findMany.mockImplementation(
    async ({
      where,
      select,
    }: {
      where: { ownerAccountId: string; kind: string; status?: { not: string } };
      select?: unknown;
    }) =>
      rows
        .filter(
          (item) =>
            item.ownerAccountId === where.ownerAccountId &&
            item.kind === where.kind &&
            (!where.status || item.status !== where.status.not),
        )
        .map((item) =>
          select ? { ...item, versions: item.versions.filter((version) => version.versionNumber === 0) } : item,
        ),
  );
  mocks.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; ownerAccountId: string; kind: string } }) =>
      rows.find(
        (item) => item.id === where.id && item.ownerAccountId === where.ownerAccountId && item.kind === where.kind,
      ) ?? null,
  );
});

describe("owner-scoped Spatial catalog pages", () => {
  it("searches all owner records before slicing, and pages without repeats", async () => {
    const query = { kind: "SCENES" as const, search: "scale scene", limit: 48 };
    const first = await pageOwnedSpatialCatalog("creator", query);
    rows.reverse(); // Database iteration order is not a cursor contract.
    const second = await pageOwnedSpatialCatalog("creator", { ...query, cursor: first.nextCursor! });
    const third = await pageOwnedSpatialCatalog("creator", { ...query, cursor: second.nextCursor! });
    expect(first.total).toBe(120);
    expect([first.items.length, second.items.length, third.items.length]).toEqual([48, 48, 24]);
    expect(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size).toBe(120);
    expect(third.nextCursor).toBeNull();
    const far = await pageOwnedSpatialCatalog("creator", { ...query, search: "far-end-tag" });
    expect(far.items.map((item) => item.id)).toEqual(["scene-0119"]);
    expect(far.items[0]).not.toHaveProperty("draft");
    expect(far.items[0]).not.toHaveProperty("releases");
  });

  it("rejects stale and malformed cursors instead of skipping changed rows", async () => {
    const query = { kind: "SCENES" as const, limit: 10 };
    const first = await pageOwnedSpatialCatalog("creator", query);
    rows[0] = row(0, { archived: true });
    await expect(pageOwnedSpatialCatalog("creator", { ...query, cursor: first.nextCursor! })).rejects.toThrow(/stale/);
    await expect(pageOwnedSpatialCatalog("creator", { ...query, cursor: "tampered" })).rejects.toThrow(/invalid/);
    await expect(
      pageOwnedSpatialCatalog("creator", { ...query, search: "other", cursor: first.nextCursor! }),
    ).rejects.toThrow(/stale/);
  });

  it("keeps explicit Scene metadata authoritative over retained composition markers", async () => {
    const original = row(2, { composition: true });
    const draft = JSON.parse(original.versions[0].envelope);
    draft.library.type = "SCENE";
    original.versions[0].envelope = JSON.stringify(draft);
    original.versions[0].checksum = canonicalChecksum(draft);
    rows = [original];
    expect((await pageOwnedSpatialCatalog("creator", { kind: "COMPOSITIONS" })).total).toBe(0);
    expect((await pageOwnedSpatialCatalog("creator", { kind: "SCENES" })).items.map((item) => item.id)).toEqual(["scene-0002"]);
  });

  it("honors ownership, archive, favorite, collection, environment and composition filters", async () => {
    rows[0] = row(0, { owner: "another" });
    rows[1] = row(1, { archived: true });
    rows[2] = row(2, { composition: true });
    const favorite = await pageOwnedSpatialCatalog("creator", { kind: "SCENES", origin: "FAVORITES" });
    expect(favorite.items.map((item) => item.id)).toEqual(["scene-0119"]);
    const archived = await pageOwnedSpatialCatalog("creator", { kind: "SCENES", state: "ARCHIVED" });
    expect(archived.items.map((item) => item.id)).toEqual(["scene-0001"]);
    const late = await pageOwnedSpatialCatalog("creator", { kind: "SCENES", search: "late collection" });
    expect(late.total).toBe(20);
    const compositions = await pageOwnedSpatialCatalog("creator", { kind: "COMPOSITIONS" });
    expect(compositions.items.map((item) => item.id)).toEqual(["scene-0002"]);
    const bound = createSpatialDraft("scene-0003");
    bound.content.studio!.environmentBinding = {
      definitionId: "owned-room",
      versionId: null,
      revision: 1,
      checksum: "a".repeat(64),
      usedAt: "2026-10-15T01:00:00.000Z",
      policy: "INDEPENDENT_PINNED_SNAPSHOT",
    };
    rows[3].versions[0].envelope = JSON.stringify(bound);
    rows[3].versions[0].checksum = canonicalChecksum(bound);
    const byParent = await pageOwnedSpatialCatalog(
      "creator",
      { kind: "SCENES", search: "parlor", environmentId: "owned-room" },
      { "owned-room": "Parlor" },
    );
    expect(byParent.items.map((item) => item.id)).toEqual(["scene-0003"]);
    expect(byParent.items[0].environmentName).toBe("Parlor");
  });

  it("fails closed on broken working integrity and preserves exact read-by-id parity", async () => {
    rows = [row(3, { released: true })];
    const exact = await readOwnedSpatialCatalogItem("creator", "scene-0003");
    const legacy = await listSpatialItems("creator", true);
    expect(exact).toEqual(legacy[0]);
    expect(await readOwnedSpatialCatalogItem("another", "scene-0003")).toBeNull();
    rows[0].versions[0].checksum = "bad";
    await expect(pageOwnedSpatialCatalog("creator", { kind: "SCENES" })).rejects.toThrow(/integrity/);
    await expect(readOwnedSpatialCatalogItem("creator", "scene-0003")).rejects.toThrow(/integrity/);
  });

  it("leaves legacy Environments to their owner and verifies full release binding on selection", async () => {
    rows = [row(4, { released: true }), row(5)];
    const legacy = { format: "PARALLAX_ENVIRONMENT_DRAFT_1" };
    rows[1].versions[0].envelope = JSON.stringify(legacy);
    rows[1].versions[0].checksum = canonicalChecksum(legacy);
    const page = await pageOwnedSpatialCatalog("creator", { kind: "SCENES" });
    expect(page.items.map((item) => item.id)).toEqual(["scene-0004"]);
    expect(await readOwnedSpatialCatalogItem("creator", "scene-0005")).toBeNull();
    rows[0].versions[1].checksum = "bad";
    await expect(readOwnedSpatialCatalogItem("creator", "scene-0004")).rejects.toThrow(/binding/);
  });

  it("keeps installed local targets out of My Creations and marks exact reads read-only", async () => {
    rows = [row(6, { released: true }), row(7, { released: true, installed: true })];
    const page = await pageOwnedSpatialCatalog("creator", { kind: "SCENES" });
    expect(page.items.map((item) => item.id)).toEqual(["scene-0006"]);
    expect(await readOwnedSpatialCatalogItem("creator", "scene-0007")).toMatchObject({
      id: "scene-0007",
      readOnly: true,
    });
    expect(await readOwnedSpatialCatalogItem("foreign", "scene-0007")).toBeNull();
  });

  it("keeps a saved procedural Effect in Effects rather than Scenes", async () => {
    rows = [row(8, { released: true, effect: true })];
    const effects = await pageOwnedSpatialCatalog("creator", { kind: "EFFECTS" });
    expect(effects.items).toMatchObject([{ id: "scene-0008", kind: "EFFECTS", saveState: "SAVED" }]);
    expect((await pageOwnedSpatialCatalog("creator", { kind: "SCENES" })).items).toHaveLength(0);
  });
});
