// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { createSpatialDraft } from "./authoring";
import { canonicalChecksum } from "@/drydock/canonical";
import { materializeLibraryMoment } from "./library-service";
import { listSpatialBootstrapItems } from "./spatial-library-bootstrap";
import { spatialReleaseIndex } from "./library-release-index";
import { readOwnedSpatialCatalogItem } from "./spatial-catalog-page-service";

const mocks = vi.hoisted(() => ({ list: vi.fn(), query: vi.fn(), exact: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    reusableAuthoringItem: { findMany: mocks.list, findFirst: mocks.exact },
    $queryRaw: mocks.query,
  },
}));
let sqlite: DatabaseSync;
const owner = "synthetic-bootstrap-owner";
const draft = createSpatialDraft("indexed-scene");
const at = "2026-10-15T12:00:00.000Z";
const workingRow = () => ({
  id: draft.content.definitionId,
  ownerAccountId: owner,
  kind: "PARALLAX_STUDIO",
  status: "SAVED",
  archivedAt: null,
  currentVersionNumber: 9,
  updatedAt: new Date(at),
  _count: { usages: 0 },
  versions: [{ id: "working", versionNumber: 0, envelope: JSON.stringify(draft), checksum: canonicalChecksum(draft) }],
});
function insert(itemId: string, account: string, number: number) {
  sqlite
    .prepare("INSERT OR IGNORE INTO ReusableAuthoringItem VALUES (?, ?, ?)")
    .run(itemId, account, "PARALLAX_STUDIO");
  const copy = createSpatialDraft(itemId);
  const moment = materializeLibraryMoment(copy, account, number);
  sqlite
    .prepare("INSERT INTO ReusableAuthoringItemVersion VALUES (?, ?, ?, ?, ?, ?)")
    .run(moment.version.id, itemId, number, JSON.stringify(moment), moment.version.checksum, new Date(at).getTime());
  return moment;
}
beforeEach(() => {
  vi.clearAllMocks();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE ReusableAuthoringItem (id TEXT PRIMARY KEY, ownerAccountId TEXT, kind TEXT);
    CREATE TABLE ReusableAuthoringItemVersion (id TEXT PRIMARY KEY, itemId TEXT, versionNumber INTEGER, envelope TEXT, checksum TEXT, createdAt INTEGER);`);
  mocks.list.mockResolvedValue([workingRow()]);
  mocks.query.mockImplementation((query: Prisma.Sql) => sqlite.prepare(query.sql).all(...(query.values as string[])));
});
afterEach(() => sqlite.close());

describe("bounded release-only Studio read projection", () => {
  it("pages release metadata without selecting full envelopes and excludes another owner", async () => {
    for (let n = 1; n <= 257; n++) insert(draft.content.definitionId, owner, n);
    insert(draft.content.definitionId + "-foreign", "foreign-owner", 1);
    const result = await listSpatialBootstrapItems(owner);
    const record = result.items[0];
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerAccountId: owner, kind: "PARALLAX_STUDIO" },
        include: expect.objectContaining({ versions: { where: { versionNumber: 0 } } }),
      }),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(record.releasesState).toBe("INDEX_ONLY");
    expect(record.releases).toEqual([]);
    expect(record.revision).toBe(9);
    expect(record.saveState).toBe("SAVED");
    expect(spatialReleaseIndex(record)).toHaveLength(257);
    expect(spatialReleaseIndex(record)[0]).toMatchObject({
      id: "indexed-scene:v257",
      semanticVersion: "257.0.0",
      createdAt: at,
    });
    const page = sqlite.prepare(mocks.query.mock.calls[0][0].sql).all(...mocks.query.mock.calls[0][0].values);
    expect(page).toHaveLength(256);
    expect(page[0]).not.toHaveProperty("envelope");
    expect(JSON.stringify(page)).not.toContain('"entities"');
    expect(JSON.stringify(result)).not.toContain("foreign-owner");
  });
  it("retains historical exact pins, asset references and matching usage timestamps", async () => {
    const moment = insert(draft.content.definitionId, owner, 1);
    const pin = { environmentId: "historic-room", versionId: "v".repeat(150), revision: 3, checksum: "a".repeat(64) };
    moment.version.environment = pin;
    moment.version.studio!.environmentBinding = {
      definitionId: pin.environmentId,
      versionId: pin.versionId,
      revision: pin.revision,
      checksum: pin.checksum,
      usedAt: at,
      policy: "INDEPENDENT_PINNED_SNAPSHOT",
    };
    moment.version.studio!.assetInstances = [
      {
        id: "instance",
        definitionId: "historic-asset",
        versionId: "asset:v3",
        checksum: "b".repeat(64),
        entityIds: ["member"],
        insertedAt: at,
      },
    ];
    moment.version.studio!.releaseNotes = "Synthetic historical release";
    sqlite
      .prepare("UPDATE ReusableAuthoringItemVersion SET envelope = ? WHERE id = ?")
      .run(JSON.stringify(moment), moment.version.id);
    const result = await listSpatialBootstrapItems(owner);
    expect(result.releaseBindings.get(draft.content.definitionId)).toEqual([
      { definitionId: "historic-asset", versionId: "asset:v3", at },
      { definitionId: pin.environmentId, versionId: pin.versionId, at },
    ]);
    expect(result.items[0].releaseIndex![0].notes).toBe("Synthetic historical release");
  });
  it("rejects a metadata binding mismatch and still checks full integrity when content is opened", async () => {
    const moment = insert(draft.content.definitionId, owner, 1);
    moment.definition.ownerPersonId = "foreign-owner";
    sqlite.prepare("UPDATE ReusableAuthoringItemVersion SET envelope = ?").run(JSON.stringify(moment));
    await expect(listSpatialBootstrapItems(owner)).rejects.toThrow("version binding");
    moment.definition.ownerPersonId = owner;
    moment.version.title = "Changed without recomputing checksum";
    sqlite.prepare("UPDATE ReusableAuthoringItemVersion SET envelope = ?").run(JSON.stringify(moment));
    expect((await listSpatialBootstrapItems(owner)).items[0].releases).toEqual([]);
    mocks.exact.mockResolvedValue({
      ...workingRow(),
      versions: [
        ...workingRow().versions,
        {
          id: moment.version.id,
          versionNumber: 1,
          checksum: moment.version.checksum,
          envelope: JSON.stringify(moment),
          createdAt: new Date(at),
        },
      ],
    });
    await expect(readOwnedSpatialCatalogItem(owner, draft.content.definitionId)).rejects.toThrow("CHECKSUM_INVALID");
  });
  it("accepts object-valued JSON projections without changing nested pin semantics", async () => {
    insert(draft.content.definitionId, owner, 1);
    const query = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: Prisma.Sql) => {
      const rows = await query(sql);
      return rows.map((row: Record<string, unknown>) => ({ ...row, metadata: JSON.parse(row.metadata as string) }));
    });
    const result = await listSpatialBootstrapItems(owner);
    expect(result.items[0].releaseIndex![0].id).toBe("indexed-scene:v1");
  });
});
