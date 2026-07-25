import { describe, expect, it, vi } from "vitest";

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
});
