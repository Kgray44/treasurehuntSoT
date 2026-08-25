import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    playerChronicleRecord: { findFirst: vi.fn() },
    playerArtifactRecord: { count: vi.fn() },
    chronicleReflection: { upsert: vi.fn() },
    chronicleMemory: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { addMemory, saveReflection, updateMemory } from "./chronicle-history";

const record = {
  id: "record-owner",
  sourcePlaythroughId: "voyage-owner",
  completedChapters: JSON.stringify([
    {
      schemaVersion: 1,
      blockId: "chapter-block",
      chapterId: "chapter-id",
      title: "The First Tide",
      completedAt: "2026-01-02T00:00:00.000Z",
      sourceSequence: 1,
      accuracy: "EXACT",
    },
  ]),
};

describe("Wayfarer remembrance reference integrity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.playerChronicleRecord.findFirst.mockResolvedValue(record);
    db.playerArtifactRecord.count.mockResolvedValue(1);
    db.chronicleMemory.create.mockResolvedValue({ id: "memory-1" });
    db.chronicleMemory.updateMany.mockResolvedValue({ count: 1 });
    db.chronicleMemory.findFirst.mockResolvedValue({ id: "memory-1", title: "Remember" });
    db.chronicleReflection.upsert.mockResolvedValue({ id: "reflection-1" });
  });

  it("accepts an owner Memory reference only when the chapter belongs to the historical Voyage", async () => {
    await addMemory("profile-owner", "record-owner", {
      title: "The turn",
      referenceType: "CHAPTER",
      referenceId: "chapter-block",
    });

    expect(db.chronicleMemory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ playerChronicleRecordId: "record-owner", playerProfileId: "profile-owner" }),
      }),
    );
  });

  it("rejects a forged chapter, cross-Voyage artifact, and unsupported raw clue reference", async () => {
    await expect(
      addMemory("profile-owner", "record-owner", {
        title: "Forged chapter",
        referenceType: "CHAPTER",
        referenceId: "chapter-foreign",
      }),
    ).rejects.toThrow("does not belong");

    db.playerArtifactRecord.count.mockResolvedValue(0);
    await expect(
      saveReflection("profile-owner", "record-owner", { favoriteArtifactReference: "artifact-foreign" }),
    ).rejects.toThrow("does not belong");

    await expect(
      addMemory("profile-owner", "record-owner", {
        title: "Raw clue",
        referenceType: "CLUE",
        referenceId: "secret-clue",
      }),
    ).rejects.toThrow("did not preserve");
  });

  it("updates only an active Memory belonging to the authenticated owner and record", async () => {
    await updateMemory("profile-owner", "record-owner", "memory-1", { title: "Revised" });

    expect(db.chronicleMemory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "memory-1",
          playerChronicleRecordId: "record-owner",
          playerProfileId: "profile-owner",
          deletedAt: null,
        },
      }),
    );
  });
});
