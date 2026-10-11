import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft } from "./authoring";
import { canonicalChecksum } from "@/drydock/canonical";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  claim: vi.fn(),
  updateDraft: vi.fn(),
  createVersion: vi.fn(),
  findVersion: vi.fn(),
  owned: vi.fn(),
  studio: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    reusableAuthoringItem: { findMany: mocks.list },
    reusableAuthoringItemVersion: { findFirst: mocks.findVersion },
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        reusableAuthoringItem: { findUnique: mocks.find, create: mocks.create, updateMany: mocks.claim },
        reusableAuthoringItemVersion: { update: mocks.updateDraft, create: mocks.createVersion },
      }),
  },
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.owned }));
vi.mock("@/chronicle/studio-service", () => ({
  getStudioTale: mocks.studio,
  saveStudioDraft: mocks.save,
  DraftConflictError: class extends Error {
    constructor(public currentVersion: number) {
      super("Conflict");
    }
  },
}));
import {
  listSpatialItems,
  saveSpatialDraft,
  releaseSpatialVersion,
  attachSpatialVersion,
  materializeLibraryMoment,
} from "./library-service";
function item() {
  const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
  return {
    id: "owned",
    ownerAccountId: "creator",
    kind: "PARALLAX_STUDIO",
    archivedAt: null,
    currentVersionNumber: 1,
    versions: [
      { id: "owned:working", versionNumber: 0, envelope: JSON.stringify(draft), checksum: canonicalChecksum(draft) },
    ],
    _count: { usages: 0 },
    updatedAt: new Date(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue({});
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.list.mockResolvedValue([item()]);
  mocks.find.mockResolvedValue(item());
});
describe("owner-scoped Spatial Library storage", () => {
  it("uses a revision claim and mutates only the working copy", async () => {
    expect(await saveSpatialDraft("creator", createSpatialDraft("owned", "Desk Map", "chronicle"), 1)).toBe(2);
    expect(mocks.claim).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "owned", ownerAccountId: "creator", currentVersionNumber: 1 } }),
    );
    expect(mocks.updateDraft.mock.calls[0][0].where.itemId_versionNumber.versionNumber).toBe(0);
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(saveSpatialDraft("creator", createSpatialDraft("owned"), 1)).rejects.toThrow("Conflict");
  });
  it("refuses foreign ownership and revoked Chronicle access", async () => {
    await expect(saveSpatialDraft("other", createSpatialDraft("owned"), 1)).rejects.toThrow(/unavailable/);
    mocks.owned.mockResolvedValue(null);
    await expect(saveSpatialDraft("creator", createSpatialDraft("owned", "Desk Map", "chronicle"), 1)).rejects.toThrow(
      /not available/,
    );
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });
  it("creates an immutable pinned release and never updates a released envelope", async () => {
    const result = await releaseSpatialVersion("creator", "owned", 1);
    expect(result.version.id).toBe("owned:v1");
    expect(result.version.semanticVersion).toBe("1.0.0");
    expect(mocks.createVersion).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: "owned:v1", versionNumber: 1, checksum: result.version.checksum }),
    });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect(() => materializeLibraryMoment(createSpatialDraft("owned"), "creator", 1)).not.toThrow();
  });
  it("detects corrupt working and release bindings", async () => {
    const broken = item();
    broken.versions[0].checksum = "a".repeat(64);
    mocks.list.mockResolvedValue([broken]);
    await expect(listSpatialItems("creator")).rejects.toThrow(/integrity/);
    const original = item();
    const capsule = materializeLibraryMoment(createSpatialDraft("different"), "creator", 1);
    original.versions.push({
      id: capsule.version.id,
      versionNumber: 1,
      envelope: JSON.stringify(capsule),
      checksum: capsule.version.checksum,
    });
    mocks.list.mockResolvedValue([original]);
    await expect(listSpatialItems("creator")).rejects.toThrow(/binding/);
  });
  it("attaches an exact release through normal Chronicle save/provenance and conflict control", async () => {
    const capsule = materializeLibraryMoment(createSpatialDraft("owned", "Desk Map", "chronicle"), "creator", 1);
    mocks.findVersion.mockResolvedValue({ checksum: capsule.version.checksum, envelope: JSON.stringify(capsule) });
    mocks.studio.mockResolvedValue({
      tale: { title: "Synthetic", slug: "synthetic" },
      draft: { autosaveVersion: 7, chapters: [{ id: "chapter", blocks: [{ id: "block", presentation: {} }] }] },
    });
    await attachSpatialVersion({
      ownerAccountId: "creator",
      definitionId: "owned",
      versionId: "owned:v1",
      chronicleId: "chronicle",
      blockId: "block",
      autosaveVersion: 7,
      narrative: "Contextual clue",
    });
    const saved = mocks.save.mock.calls[0][1];
    expect(saved.autosaveVersion).toBe(7);
    expect(saved.reusableUsage.versionId).toBe("owned:v1");
    expect(saved.chapters[0].blocks[0].presentation.spatialMoment.attachment).toMatchObject({
      storyMomentId: "block",
      versionChecksum: capsule.version.checksum,
      overrides: { narrative: "Contextual clue" },
    });
    expect(capsule.attachment.storyMomentId).toBe("library-preview");
  });
  it("requires explicit promotion before cross-Chronicle reuse", async () => {
    const capsule = materializeLibraryMoment(createSpatialDraft("owned", "Desk Map", "chronicle"), "creator", 1);
    mocks.findVersion.mockResolvedValue({ checksum: capsule.version.checksum, envelope: JSON.stringify(capsule) });
    await expect(
      attachSpatialVersion({
        ownerAccountId: "creator",
        definitionId: "owned",
        versionId: "owned:v1",
        chronicleId: "different",
        blockId: "block",
        autosaveVersion: 7,
      }),
    ).rejects.toThrow(/My Spatial Library/);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
