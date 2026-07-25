import { describe, expect, it, vi } from "vitest";

import {
  assertVoyageLogPublicationAllowed,
  createKeepsakeSafeSnapshot,
  generatePrivateVoyageKeepsake,
  isPublicMediaReady,
  toPublicVoyageLogProjection,
  type CanonicalCompletedTaleSession,
  type ConsentRecord,
  type KeepsakeStore,
  type PrivateVoyageKeepsake,
  type VoyageLogPublicationInput,
} from "@/community/keepsakes";

const completed: CanonicalCompletedTaleSession = {
  id: "session-1",
  taleId: "tale-1",
  publishedVersionId: "version-1",
  status: "COMPLETED",
  completedAt: new Date("2026-07-25T12:00:00.000Z"),
  previewMode: false,
};

const stored: PrivateVoyageKeepsake = {
  id: "keepsake-1",
  ownerAccountId: "account-1",
  taleSessionId: "session-1",
  publishedVersionId: "version-1",
  safeSnapshot: "{}",
  favoriteMoment: null,
  representationChecksum: "checksum",
  status: "READY",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const granted = (purpose: string): ConsentRecord => ({ purpose, grantedAt: new Date(), revokedAt: null });
const basePublication = (): VoyageLogPublicationInput => ({
  visibility: "COMMUNITY" as const,
  restrictions: [],
  participants: [{ id: "p-1", displayNameSnapshot: "First Mate", isChild: false, consents: [granted("DISPLAY_IN_LOG"), granted("PUBLIC_NAME")] }],
  media: [{ id: "media-1", derivativeChecksum: "derivative", processingStatus: "READY", scanStatus: "CLEAN", exifGpsRemoved: true, consents: [granted("PUBLIC_MEDIA")] }],
  location: { classification: "APPROXIMATE" as const, generalizedLabel: "North Shore" },
});

describe("Voyage Keepsakes", () => {
  it("builds a frozen allowlisted snapshot without session state", () => {
    const snapshot = createKeepsakeSafeSnapshot({ session: completed, taleTitle: "The Safe Voyage" });
    expect(snapshot).toEqual({
      schemaVersion: 1,
      taleId: "tale-1",
      taleTitle: "The Safe Voyage",
      publishedVersionId: "version-1",
      completedAt: "2026-07-25T12:00:00.000Z",
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).not.toHaveProperty("variables");
    expect(snapshot).not.toHaveProperty("sessionId");
  });

  it("requires a completed, canonical non-preview session and atomically retries generation", async () => {
    const createKeepsakeIfMissing = vi.fn().mockResolvedValue({ keepsake: stored, created: false });
    const store: KeepsakeStore = {
      findCompletedSessionForOwner: vi.fn().mockResolvedValue(completed),
      createKeepsakeIfMissing,
    };
    await expect(generatePrivateVoyageKeepsake(store, { ownerAccountId: "account-1", taleSessionId: "session-1", taleTitle: "Safe" })).resolves.toEqual({
      keepsake: stored,
      created: false,
    });
    expect(createKeepsakeIfMissing).toHaveBeenCalledOnce();
    expect(createKeepsakeIfMissing.mock.calls[0][0]).not.toHaveProperty("variables");

    store.findCompletedSessionForOwner = vi.fn().mockResolvedValue({ ...completed, status: "ACTIVE" });
    await expect(generatePrivateVoyageKeepsake(store, { ownerAccountId: "account-1", taleSessionId: "session-1", taleTitle: "Safe" })).rejects.toMatchObject({
      code: "COMMUNITY_COMPLETION_REQUIRED",
    });
    expect(createKeepsakeIfMissing).toHaveBeenCalledOnce();
  });
});

describe("Voyage Log sharing", () => {
  it("fails closed after consent revocation or incomplete media sanitization", () => {
    const original = basePublication();
    const revoked: VoyageLogPublicationInput = {
      ...original,
      participants: [{ ...original.participants[0], consents: [{ ...granted("DISPLAY_IN_LOG"), revokedAt: new Date() }] }],
    };
    expect(() => assertVoyageLogPublicationAllowed(revoked)).toThrow(/consent/i);

    const unsanitized: VoyageLogPublicationInput = {
      ...original,
      media: [{ ...original.media[0], exifGpsRemoved: false }],
    };
    expect(isPublicMediaReady(unsanitized.media[0])).toBe(false);
    expect(() => assertVoyageLogPublicationAllowed(unsanitized)).toThrow(/GPS-sanitized/i);
  });

  it("removes child names, private source IDs, exact locations, and unsafe media from public projections", () => {
    const publicLog = toPublicVoyageLogProjection({
      ...basePublication(),
      slug: "safe-voyage",
      title: "A Safe Voyage",
      safeSummary: "A bright day at sea.",
      spoilerLevel: "FINALE",
      verifiedCompletion: true,
      publishedAt: new Date(),
    });
    expect(publicLog).toEqual({
      slug: "safe-voyage",
      title: "A Safe Voyage",
      safeSummary: "A bright day at sea.",
      spoilerLevel: "PREVIEW_SAFE",
      approximateLocation: "North Shore",
      verifiedCompletion: true,
      participants: [{ displayName: "First Mate" }],
      media: [{ id: "media-1", checksum: "derivative" }],
    });
    expect(JSON.stringify(publicLog)).not.toContain("privateMediaReference");
    expect(JSON.stringify(publicLog)).not.toContain("taleSessionId");

    const original = basePublication();
    const privateLocation: VoyageLogPublicationInput = {
      ...original,
      location: { classification: "EXACT", generalizedLabel: "44.100,-72.200" },
      participants: [
        ...original.participants,
        { id: "child", displayNameSnapshot: "Child", isChild: true, consents: [granted("DISPLAY_IN_LOG"), granted("PUBLIC_NAME")] },
      ],
    };
    const sanitized = toPublicVoyageLogProjection({
      ...privateLocation,
      slug: "safe-voyage",
      title: "A Safe Voyage",
      spoilerLevel: "NONE",
      verifiedCompletion: true,
      publishedAt: new Date(),
    });
    expect(sanitized).not.toHaveProperty("approximateLocation");
    expect(sanitized?.participants).toEqual([{ displayName: "First Mate" }]);
  });

  it("enforces Creator sharing restrictions before publication", () => {
    const privateOnly = { ...basePublication(), restrictions: ["PRIVATE_ONLY" as const] };
    expect(() => assertVoyageLogPublicationAllowed(privateOnly)).toThrow(/private Keepsakes only/i);
    const noMedia = { ...basePublication(), restrictions: ["NO_MEDIA" as const] };
    expect(() => assertVoyageLogPublicationAllowed(noMedia)).toThrow(/does not permit media/i);
  });
});
