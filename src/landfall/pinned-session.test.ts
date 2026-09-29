import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { taleSession: { findUnique: mocks.findUnique } } }));

import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { landfallFixture } from "@/landfall/fixtures";

const snapshot = {
  schemaVersion: 1,
  tale: { id: "fixture-tale", slug: "fixture-tale", title: "Fixture Tale" },
  chapters: [],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt: "2026-09-29T12:00:00.000Z",
  landfall: landfallFixture,
};
const session = {
  id: "session-1",
  taleId: "fixture-tale",
  publishedVersionId: "version-1",
  currentSequence: 7,
  version: { id: "version-1", taleId: "fixture-tale", contentSnapshot: JSON.stringify(snapshot) },
};

describe("pinned Landfall session source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(session);
  });

  it("loads only the exact immutable edition attached to the active session", async () => {
    expect(await loadPinnedLandfallDefinition("session-1")).toMatchObject({
      publishedVersionId: "version-1",
      currentSequence: 7,
      definition: { worldspaces: [{ id: "town" }, { id: "isles" }] },
    });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-1" } }));
  });

  it("rejects mismatched edition identity and tolerates Landfall-free sessions", async () => {
    mocks.findUnique.mockResolvedValueOnce({ ...session, version: { ...session.version, id: "other-version" } });
    await expect(loadPinnedLandfallDefinition("session-1")).rejects.toThrow("LANDFALL_PINNED_VERSION_MISMATCH");
    mocks.findUnique.mockResolvedValueOnce({
      ...session,
      version: { ...session.version, contentSnapshot: JSON.stringify({ ...snapshot, landfall: undefined }) },
    });
    await expect(loadPinnedLandfallDefinition("session-1")).resolves.toBeNull();
  });
});
