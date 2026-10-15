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
    reusableAuthoringItem: { findMany: mocks.list, findFirst: mocks.find, updateMany: mocks.claim },
    reusableAuthoringItemVersion: { findFirst: mocks.findVersion },
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        reusableAuthoringItem: { findUnique: mocks.find, create: mocks.create, updateMany: mocks.claim },
        reusableAuthoringItemVersion: {
          update: mocks.updateDraft,
          create: mocks.createVersion,
          findFirst: mocks.findVersion,
        },
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
  restoreSpatialAttachment,
  materializeLibraryMoment,
  saveReusableAsset,
  reuseSpatialAsset,
  archiveSpatialItem,
  updateEnvironmentLibraryEntry,
} from "./library-service";
import { createReusableSpatialAsset } from "./reusable-assets";
import { simulationEnvironments } from "./studio-validation";
import { createRoomEnvironment } from "./environment-authoring";
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
  it("projects installed status and refuses direct save, release and discovery edits", async () => {
    const source = { ...item(), status: "INSTALLED_READ_ONLY" };
    mocks.find.mockResolvedValue(source);
    mocks.list.mockResolvedValue([source]);
    const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
    expect((await listSpatialItems("creator"))[0].readOnly).toBe(true);
    await expect(saveSpatialDraft("creator", draft, 1)).rejects.toThrow("Installed content is read-only");
    await expect(releaseSpatialVersion("creator", "owned", 1)).rejects.toThrow("Installed content is read-only");
    await expect(
      saveReusableAsset(
        "creator",
        draft,
        1,
        draft.content.entities[0].id,
        { name: "Unlicensed export", description: "Synthetic", classification: "Map" },
        simulationEnvironments[0],
      ),
    ).rejects.toThrow("Installed content is read-only");
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    source.versions[0].envelope = JSON.stringify(draft);
    source.versions[0].checksum = canonicalChecksum(draft);
    await expect(updateEnvironmentLibraryEntry("creator", "owned", 1, { name: "Must not rename" })).rejects.toThrow(
      "Installed content is read-only",
    );
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect(mocks.createVersion).not.toHaveBeenCalled();
  });

  it("keeps the installed read-only guard in the atomic archive claim", async () => {
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(archiveSpatialItem("creator", "owned", 1)).rejects.toThrow("Conflict");
    expect(mocks.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "INSTALLED_READ_ONLY" },
          kind: "PARALLAX_STUDIO",
          archivedAt: null,
        }),
      }),
    );
  });
  it("renames and deletes environment discovery through existing scene CAS without deleting geometry", async () => {
    const source = item();
    const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    source.versions[0].envelope = JSON.stringify(draft);
    source.versions[0].checksum = canonicalChecksum(draft);
    mocks.find.mockResolvedValue(source);
    const renamed = await updateEnvironmentLibraryEntry("creator", "owned", 1, { name: "Workshop" });
    expect(renamed.draft.content.studio!.environment!.name).toBe("Workshop");
    expect(renamed.draft.content.studio!.environment!.features).toEqual(draft.content.studio!.environment!.features);
    const archived = await updateEnvironmentLibraryEntry("creator", "owned", 1, { archive: true });
    expect(archived.draft.content.studio!.environmentLibraryArchived).toBe(true);
    expect(archived.draft.content.studio!.environment).toEqual(draft.content.studio!.environment);
    expect(mocks.createVersion).not.toHaveBeenCalled();
  });
  it("refuses foreign or stale environment edits and keeps published versions immutable", async () => {
    const source = item();
    source.ownerAccountId = "someone-else";
    mocks.find.mockResolvedValue(source);
    await expect(updateEnvironmentLibraryEntry("creator", "owned", 1, { archive: true })).rejects.toThrow(
      /unavailable/,
    );
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    const owned = item();
    const draft = createSpatialDraft("owned");
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    owned.versions[0].envelope = JSON.stringify(draft);
    owned.versions[0].checksum = canonicalChecksum(draft);
    mocks.find.mockResolvedValue(owned);
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(updateEnvironmentLibraryEntry("creator", "owned", 0, { name: "Stale" })).rejects.toThrow(/Conflict/);
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });
  it("atomically creates separate asset working and immutable records without altering its source scene", async () => {
    const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
    mocks.find.mockResolvedValueOnce(item()).mockResolvedValueOnce(null);
    const result = await saveReusableAsset(
      "creator",
      draft,
      1,
      draft.content.entities[0].id,
      { name: "Reusable chart", description: "Synthetic", classification: "Map" },
      simulationEnvironments[0],
    );
    expect(result.definitionId).not.toBe("owned");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.createVersion).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: result.definitionId, versionNumber: 1 }),
    });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("rejects a foreign or stale asset export before creating any definition", async () => {
    const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
    const args = [
      draft,
      1,
      draft.content.entities[0].id,
      { name: "Chart", description: "", classification: "Map" },
      simulationEnvironments[0],
    ] as const;
    await expect(saveReusableAsset("other", ...args)).rejects.toThrow(/unavailable/);
    expect(mocks.create).not.toHaveBeenCalled();
    await expect(saveReusableAsset("creator", draft, 2, args[2], args[3], args[4])).rejects.toThrow(/Conflict/);
    expect(mocks.createVersion).not.toHaveBeenCalled();
  });
  it("reuses only an owned pinned release and leaves installation to ordinary editor history", async () => {
    const draft = createSpatialDraft("owned");
    const asset = createReusableSpatialAsset(
      draft,
      draft.content.entities[0].id,
      "asset",
      { name: "Map", description: "", classification: "Map" },
      simulationEnvironments[0],
    );
    const moment = materializeLibraryMoment(asset, "creator", 1);
    mocks.findVersion.mockResolvedValue({ checksum: moment.version.checksum, envelope: JSON.stringify(moment) });
    const result = await reuseSpatialAsset("creator", draft, 1, "asset", moment.version.id);
    expect(result.draft.content.entities).toHaveLength(2);
    expect(mocks.findVersion.mock.calls[0][0].where.item).toMatchObject({
      ownerAccountId: "creator",
      archivedAt: null,
    });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
    mocks.findVersion.mockResolvedValue(null);
    await expect(reuseSpatialAsset("other", draft, 1, "asset", moment.version.id)).rejects.toThrow(/owned/);
  });
  it("archives by owned active revision without deleting immutable releases", async () => {
    await archiveSpatialItem("creator", "owned", 1);
    expect(mocks.claim).toHaveBeenCalledWith({
      where: {
        id: "owned",
        ownerAccountId: "creator",
        kind: "PARALLAX_STUDIO",
        archivedAt: null,
        status: { not: "INSTALLED_READ_ONLY" },
        currentVersionNumber: 1,
      },
      data: { archivedAt: expect.any(Date), currentVersionNumber: { increment: 1 } },
    });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(archiveSpatialItem("other", "owned", 1)).rejects.toThrow(/Conflict/);
  });
  it("uses a revision claim and mutates only the working copy", async () => {
    expect(await saveSpatialDraft("creator", createSpatialDraft("owned", "Desk Map", "chronicle"), 1)).toBe(2);
    expect(mocks.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "owned",
          ownerAccountId: "creator",
          kind: "PARALLAX_STUDIO",
          archivedAt: null,
          status: { not: "INSTALLED_READ_ONLY" },
          currentVersionNumber: 1,
        },
      }),
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
  it("undoes a new attachment through normal Chronicle revision control", async () => {
    mocks.studio.mockResolvedValue({
      tale: { title: "Synthetic" },
      draft: {
        autosaveVersion: 8,
        chapters: [{ blocks: [{ id: "block", presentation: { spatialMoment: "existing", other: true } }] }],
      },
    });
    await restoreSpatialAttachment({
      ownerAccountId: "creator",
      chronicleId: "chronicle",
      blockId: "block",
      autosaveVersion: 8,
      moment: null,
    });
    const saved = mocks.save.mock.calls[0][1];
    expect(saved.autosaveVersion).toBe(8);
    expect(saved.chapters[0].blocks[0].presentation).toEqual({ other: true });
    mocks.owned.mockResolvedValue(null);
    await expect(
      restoreSpatialAttachment({
        ownerAccountId: "creator",
        chronicleId: "chronicle",
        blockId: "block",
        autosaveVersion: 8,
        moment: null,
      }),
    ).rejects.toThrow(/unavailable/);
  });
  it("rejects counterfeit history instead of overwriting an immutable release", async () => {
    const capsule = materializeLibraryMoment(createSpatialDraft("owned"), "creator", 1);
    capsule.attachment.storyMomentId = "block";
    mocks.findVersion.mockResolvedValue({ checksum: "f".repeat(64), envelope: JSON.stringify(capsule) });
    await expect(
      restoreSpatialAttachment({
        ownerAccountId: "creator",
        chronicleId: "chronicle",
        blockId: "block",
        autosaveVersion: 8,
        moment: capsule,
      }),
    ).rejects.toThrow(/owned immutable/);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });
});
