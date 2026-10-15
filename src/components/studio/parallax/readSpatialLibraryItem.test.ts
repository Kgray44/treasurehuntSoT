// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
import { materializeLibraryMoment, type SpatialLibraryRecord } from "@/parallax/library-service";
import { readSpatialLibraryItem } from "./readSpatialLibraryItem";

const draft = createSpatialDraft("selected-scene");
const version = materializeLibraryMoment(draft, "synthetic-owner", 1).version;
const indexed: SpatialLibraryRecord = {
  id: draft.content.definitionId,
  revision: 7,
  draft,
  releases: [],
  releasesState: "INDEX_ONLY",
  usageCount: 2,
  updatedAt: "2026-10-15T12:00:00.000Z",
  releaseIndex: [
    {
      id: version.id,
      semanticVersion: version.semanticVersion,
      checksum: version.checksum,
      createdAt: "2026-10-14T12:00:00.000Z",
      notes: "Synthetic note",
      usageCount: 2,
    },
  ],
};
const full = {
  ...indexed,
  draft: { ...draft, tags: ["server-draft"] },
  releasesState: "LOADED",
  releases: [version],
  releaseMetadata: [{ id: version.id, createdAt: indexed.updatedAt, notes: "Synthetic note", usageCount: 0 }],
};
afterEach(() => vi.unstubAllGlobals());
describe("selected immutable snapshot hydration", () => {
  it("requests only the selected owner-scoped item and preserves working/CAS and usage metadata", async () => {
    const fetcher = vi.fn(async () => Response.json({ kind: "SPATIAL", record: full }));
    vi.stubGlobal("fetch", fetcher);
    const result = await readSpatialLibraryItem(indexed.id, indexed);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("entryId=saved%3Aselected-scene"), {
      cache: "no-store",
    });
    expect(result.draft).toBe(indexed.draft);
    expect(result.revision).toBe(7);
    expect(result.releasesState).toBe("LOADED");
    expect(result.releases[0].checksum).toBe(version.checksum);
    expect(result.releaseMetadata![0].usageCount).toBe(2);
    expect(indexed.releases).toEqual([]);
  });
  it.each([
    ["newer working revision", { ...full, revision: 8 }, "changed while"],
    ["different definition", { ...full, id: "other-scene" }, "unavailable"],
    ["index masquerading as content", { ...full, releasesState: "INDEX_ONLY" }, "unavailable"],
    ["missing full snapshot", { ...full, releases: [] }, "immutable Library pin"],
    [
      "changed immutable pin",
      { ...full, releases: [{ ...version, checksum: "b".repeat(64) }] },
      "immutable Library pin",
    ],
  ])("rejects %s without modifying the indexed record", async (_label, record, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ kind: "SPATIAL", record })),
    );
    await expect(readSpatialLibraryItem(indexed.id, indexed)).rejects.toThrow(message as string);
    expect(indexed.revision).toBe(7);
    expect(indexed.releasesState).toBe("INDEX_ONLY");
  });
  it("surfaces an exact-selection failure for recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Library item unavailable." }, { status: 404 })),
    );
    await expect(readSpatialLibraryItem(indexed.id, indexed)).rejects.toThrow("Library item unavailable");
  });
});
