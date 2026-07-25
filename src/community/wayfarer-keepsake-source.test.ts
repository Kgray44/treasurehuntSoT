import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityError } from "@/community/domain";
import {
  createVoyageLogDraftFromWayfarer,
  type HarborlightKeepsakeSource,
  type HarborlightSharingPreparationStore,
} from "./wayfarer-keepsake-source";

const source: HarborlightKeepsakeSource = {
  getEligiblePrivateKeepsake: vi.fn().mockResolvedValue({
    sourceKeepsakeId: "wayfarer-keepsake-1",
    sourceWatermark: "watermark-1",
    sourceProjectionChecksum: "projection-checksum-1",
    publishedVersionId: "published-version-1",
    publishedVersionChecksum: "published-checksum-1",
    completedAt: "2026-07-25T00:00:00.000Z",
    title: "Safe Voyage",
    selectedSafeCandidates: [{ kind: "MOMENT", label: "A shared sunrise" }],
  }),
  getPublicSharingCandidates: vi.fn(),
  verifySourceWatermark: vi.fn().mockResolvedValue({
    sourceKeepsakeId: "wayfarer-keepsake-1",
    valid: true,
    sourceWatermark: "watermark-1",
    sourceProjectionChecksum: "projection-checksum-1",
  }),
};

describe("Harborlight Wayfarer Keepsake source port", () => {
  beforeEach(() => {
    vi.mocked(source.getEligiblePrivateKeepsake).mockResolvedValue({
      sourceKeepsakeId: "wayfarer-keepsake-1", sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1",
      publishedVersionId: "published-version-1", publishedVersionChecksum: "published-checksum-1", completedAt: "2026-07-25T00:00:00.000Z",
      title: "Safe Voyage", selectedSafeCandidates: [{ kind: "MOMENT", label: "A shared sunrise" }],
    });
    vi.mocked(source.verifySourceWatermark).mockResolvedValue({
      sourceKeepsakeId: "wayfarer-keepsake-1", valid: true, sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1",
    });
  });
  it("creates only a sharing-preparation draft after exact source verification", async () => {
    const store: HarborlightSharingPreparationStore = {
      createIfMissing: vi.fn().mockResolvedValue({
        created: true,
        record: {
          id: "preparation-1", ownerAccountId: "account-1", wayfarerKeepsakeId: "wayfarer-keepsake-1",
          sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1", preparationState: "DRAFT_CREATED",
          safeSnapshot: "{}", representationChecksum: "checksum", createdAt: new Date(), updatedAt: new Date(),
        },
      }),
    };
    const result = await createVoyageLogDraftFromWayfarer(source, store, {
      ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1",
    });
    expect(result.created).toBe(true);
    expect(store.createIfMissing).toHaveBeenCalledWith(expect.objectContaining({
      ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1", sourceWatermark: "watermark-1",
    }));
    expect(JSON.stringify(vi.mocked(store.createIfMissing).mock.calls[0][0])).not.toContain("privateNote");
    expect(JSON.stringify(vi.mocked(store.createIfMissing).mock.calls[0][0])).not.toContain("taleSessionId");
  });

  it("rejects a stale source without creating a draft", async () => {
    const staleSource = { ...source, verifySourceWatermark: vi.fn().mockResolvedValue({
      sourceKeepsakeId: "wayfarer-keepsake-1", valid: false, sourceWatermark: "changed", sourceProjectionChecksum: "changed",
    }) };
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn() };
    await expect(createVoyageLogDraftFromWayfarer(staleSource, store, {
      ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1",
    })).rejects.toMatchObject({ code: "COMMUNITY_KEEPSAKE_SOURCE_STALE" } satisfies Partial<CommunityError>);
    expect(store.createIfMissing).not.toHaveBeenCalled();
  });

  it("rejects a projection that names a different opaque source", async () => {
    vi.mocked(source.getEligiblePrivateKeepsake).mockResolvedValueOnce({
      sourceKeepsakeId: "other-source", sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1",
      publishedVersionId: "published-version-1", publishedVersionChecksum: "published-checksum-1", completedAt: "2026-07-25T00:00:00.000Z",
      title: "Safe Voyage", selectedSafeCandidates: [],
    });
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn() };
    await expect(createVoyageLogDraftFromWayfarer(source, store, { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" }))
      .rejects.toMatchObject({ code: "COMMUNITY_KEEPSAKE_SOURCE_MISMATCH" } satisfies Partial<CommunityError>);
    expect(store.createIfMissing).not.toHaveBeenCalled();
  });

  it("rejects a verification that names a different opaque source", async () => {
    vi.mocked(source.verifySourceWatermark).mockResolvedValueOnce({
      sourceKeepsakeId: "other-source", valid: true, sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1",
    });
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn() };
    await expect(createVoyageLogDraftFromWayfarer(source, store, { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" }))
      .rejects.toMatchObject({ code: "COMMUNITY_KEEPSAKE_SOURCE_MISMATCH" } satisfies Partial<CommunityError>);
    expect(store.createIfMissing).not.toHaveBeenCalled();
  });

  it.each([
    ["changed watermark", { sourceWatermark: "changed", sourceProjectionChecksum: "projection-checksum-1" }],
    ["changed checksum", { sourceWatermark: "watermark-1", sourceProjectionChecksum: "changed" }],
  ])("rejects %s without persisting", async (_label, changed) => {
    vi.mocked(source.verifySourceWatermark).mockResolvedValueOnce({ sourceKeepsakeId: "wayfarer-keepsake-1", valid: true, ...changed });
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn() };
    await expect(createVoyageLogDraftFromWayfarer(source, store, { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" }))
      .rejects.toMatchObject({ code: "COMMUNITY_KEEPSAKE_SOURCE_STALE" } satisfies Partial<CommunityError>);
    expect(store.createIfMissing).not.toHaveBeenCalled();
  });

  it("propagates typed upstream unavailability without persisting", async () => {
    vi.mocked(source.getEligiblePrivateKeepsake).mockRejectedValueOnce(new CommunityError("COMMUNITY_WAYFARER_SOURCE_UNAVAILABLE", "unavailable"));
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn() };
    await expect(createVoyageLogDraftFromWayfarer(source, store, { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" }))
      .rejects.toMatchObject({ code: "COMMUNITY_WAYFARER_SOURCE_UNAVAILABLE" } satisfies Partial<CommunityError>);
    expect(store.createIfMissing).not.toHaveBeenCalled();
  });

  it("returns the pre-existing preparation on a repeated idempotent request", async () => {
    const record = { id: "preparation-1", ownerAccountId: "account-1", wayfarerKeepsakeId: "wayfarer-keepsake-1", sourceWatermark: "watermark-1", sourceProjectionChecksum: "projection-checksum-1", preparationState: "DRAFT_CREATED", safeSnapshot: "{}", representationChecksum: "checksum", createdAt: new Date(), updatedAt: new Date() };
    const store: HarborlightSharingPreparationStore = { createIfMissing: vi.fn().mockResolvedValue({ record, created: false }) };
    const result = await createVoyageLogDraftFromWayfarer(source, store, { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" });
    expect(result).toEqual({ record, created: false });
  });
});
