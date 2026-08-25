import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, createProtectedMediaAssociation, listOwnerProtectedMedia } = vi.hoisted(() => ({
  db: {
    playerChronicleRecord: { findFirst: vi.fn() },
    chronicleMemory: { findFirst: vi.fn() },
  },
  createProtectedMediaAssociation: vi.fn(),
  listOwnerProtectedMedia: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/private-content/media/service", () => ({ createProtectedMediaAssociation, listOwnerProtectedMedia }));

import { attachMemoryMedia, listAvailableMemoryMedia } from "./memory-media";

describe("Wakebook Memory protected-media binding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.playerChronicleRecord.findFirst.mockResolvedValue({ id: "record-owner" });
    db.chronicleMemory.findFirst.mockResolvedValue({
      id: "memory-owner",
      updatedAt: new Date("2026-08-13T12:00:00.000Z"),
    });
  });

  it("offers only clean, available, non-withdrawn owner media without Sealed Hold metadata", async () => {
    listOwnerProtectedMedia.mockResolvedValue([
      {
        id: "media-clean",
        mediaKind: "IMAGE",
        accessibilityDescription: "Lighthouse",
        scanState: "CLEAN",
        availabilityState: "AVAILABLE",
        withdrawnAt: null,
        sha256: "must-not-leave",
      },
      {
        id: "media-pending",
        mediaKind: "IMAGE",
        accessibilityDescription: null,
        scanState: "PENDING",
        availabilityState: "AVAILABLE",
        withdrawnAt: null,
      },
      {
        id: "media-withdrawn",
        mediaKind: "AUDIO",
        accessibilityDescription: null,
        scanState: "CLEAN",
        availabilityState: "AVAILABLE",
        withdrawnAt: new Date(),
      },
    ]);

    await expect(listAvailableMemoryMedia("account-owner", "profile-owner", "record-owner")).resolves.toEqual([
      { id: "media-clean", kind: "IMAGE", description: "Lighthouse" },
    ]);
  });

  it("requires an active owner Memory before creating a Wayfarer-only private association", async () => {
    createProtectedMediaAssociation.mockResolvedValue({ id: "association-owner" });

    await attachMemoryMedia({
      ownerAccountId: "account-owner",
      playerProfileId: "profile-owner",
      recordId: "record-owner",
      memoryId: "memory-owner",
      mediaId: "media-owner",
    });

    expect(db.chronicleMemory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "memory-owner",
          playerProfileId: "profile-owner",
          playerChronicleRecordId: "record-owner",
          deletedAt: null,
        }),
      }),
    );
    expect(createProtectedMediaAssociation).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAccountId: "account-owner",
        mediaId: "media-owner",
        authority: "WAYFARER",
        subjectKind: "WAYFARER_MEMORY",
        subjectOpaqueId: "memory-owner",
        purpose: "MEMORY_PRIVATE",
        subjectOwnerConfirmed: true,
      }),
    );
  });

  it("fails closed before association when the Memory does not belong to the owner record", async () => {
    db.chronicleMemory.findFirst.mockResolvedValue(null);

    await expect(
      attachMemoryMedia({
        ownerAccountId: "account-owner",
        playerProfileId: "profile-owner",
        recordId: "record-owner",
        memoryId: "memory-foreign",
        mediaId: "media-owner",
      }),
    ).rejects.toThrow("not found");
    expect(createProtectedMediaAssociation).not.toHaveBeenCalled();
  });
});
