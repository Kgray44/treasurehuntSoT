import { describe, expect, it } from "vitest";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { landfallFixture } from "@/landfall/fixtures";

const legacySnapshot = {
  schemaVersion: 1,
  tale: { id: "fixture-tale", slug: "fixture-tale", title: "Fixture Tale" },
  chapters: [],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt: "2026-09-29T12:00:00.000Z",
};

describe("published Landfall version pinning", () => {
  it("keeps old Landfall-free Chronicle snapshots readable", () => {
    expect(parsePublishedSnapshot(JSON.stringify(legacySnapshot)).landfall).toBeUndefined();
  });
  it("reads Landfall only from the immutable published snapshot and rejects unknown versions", () => {
    const draft = structuredClone(landfallFixture);
    const stored = JSON.stringify({ ...legacySnapshot, landfall: draft });
    draft.worldspaces[0].name = "Changed draft";
    const published = parsePublishedSnapshot(stored);
    expect(published.landfall?.worldspaces[0].name).toBe("Fixture Town");
    const unsupported = JSON.parse(stored);
    unsupported.landfall.schemaVersion = 2;
    expect(() => parsePublishedSnapshot(JSON.stringify(unsupported))).toThrow();
  });
});
