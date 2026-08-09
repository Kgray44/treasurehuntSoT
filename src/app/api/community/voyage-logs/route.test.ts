import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  db: {
    communityVoyageLog: { findMany: vi.fn(), findUnique: vi.fn() },
    communityVoyageLogShareRestriction: { findMany: vi.fn() },
    communityVoyageLogParticipant: { findMany: vi.fn() },
    communityVoyageLogParticipantConsent: { findMany: vi.fn() },
    communityVoyageLogMedia: { findMany: vi.fn() },
    communityVoyageLogMediaConsent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => dependencies);
vi.mock("@/platform/auth", () => ({ requireCanonicalAccountIdentity: vi.fn().mockResolvedValue(null) }));

import { GET as detail } from "@/app/api/community/voyage-logs/[slug]/route";
import { GET as list } from "@/app/api/community/voyage-logs/route";
import { readAnonymousVoyageLogMetadata } from "@/community/voyage-log-public";

const now = new Date("2026-07-25T12:00:00.000Z");

function configureRows() {
  dependencies.db.communityVoyageLog.findMany.mockResolvedValue([
    {
      id: "public",
      slug: "safe-voyage",
      title: "Safe Voyage",
      safeSummary: "A safe account of the Voyage.",
      spoilerLevel: "NONE",
    },
    { id: "restricted", slug: "restricted-voyage", title: "Restricted", safeSummary: null, spoilerLevel: "NONE" },
  ]);
  dependencies.db.communityVoyageLogShareRestriction.findMany.mockResolvedValue([
    { voyageLogId: "restricted", restrictionType: "NO_PUBLIC_SHARING" },
  ]);
  dependencies.db.communityVoyageLogParticipant.findMany.mockResolvedValue([
    { id: "participant-private-id", voyageLogId: "public" },
  ]);
  dependencies.db.communityVoyageLogParticipantConsent.findMany.mockResolvedValue([
    {
      voyageLogId: "public",
      participantId: "participant-private-id",
      purpose: "HARBORLIGHT_VOYAGE_LOG_PUBLICATION:DISPLAY_NAME",
      state: "APPROVED",
      expiresAt: null,
      grantedAt: now,
      revokedAt: null,
    },
  ]);
  dependencies.db.communityVoyageLogMedia.findMany.mockResolvedValue([
    {
      id: "media-private-id",
      voyageLogId: "public",
      processingStatus: "READY",
      scanStatus: "CLEAN",
      exifGpsRemoved: true,
    },
  ]);
  dependencies.db.communityVoyageLogMediaConsent.findMany.mockResolvedValue([
    { voyageLogMediaId: "media-private-id", purpose: "PUBLIC_MEDIA", grantedAt: now, revokedAt: null },
  ]);
}

describe("public Voyage Log reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configureRows();
  });

  it("returns only a minimal server-built Community projection", async () => {
    const response = await list(new Request("http://localhost/api/community/voyage-logs"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        slug: "safe-voyage",
        title: "Safe Voyage",
        safeSummary: "A safe account of the Voyage.",
        spoilerLevel: "NONE",
        verifiedCompletion: true,
      },
    ]);
    const wire = JSON.stringify(await (await list(new Request("http://localhost/api/community/voyage-logs"))).json());
    expect(wire).not.toContain("participant-private-id");
    expect(wire).not.toContain("media-private-id");
    expect(wire).not.toContain("storage");
    expect(wire).not.toContain("session");
  });

  it("fails closed for revoked consent, unclean media, and Creator restrictions", async () => {
    dependencies.db.communityVoyageLogParticipantConsent.findMany.mockResolvedValue([
      {
        voyageLogId: "public",
        participantId: "participant-private-id",
        purpose: "HARBORLIGHT_VOYAGE_LOG_PUBLICATION:DISPLAY_NAME",
        state: "REVOKED",
        expiresAt: null,
        grantedAt: now,
        revokedAt: now,
      },
    ]);
    const revoked = await list(new Request("http://localhost/api/community/voyage-logs"));
    expect(await revoked.json()).toEqual([]);

    configureRows();
    dependencies.db.communityVoyageLogMedia.findMany.mockResolvedValue([
      {
        id: "media-private-id",
        voyageLogId: "public",
        processingStatus: "READY",
        scanStatus: "CLEAN",
        exifGpsRemoved: false,
      },
    ]);
    const unsafeMedia = await list(new Request("http://localhost/api/community/voyage-logs"));
    expect(await unsafeMedia.json()).toEqual([]);
  });

  it("uses the same policy for detail and does not distinguish a private log from a missing one", async () => {
    dependencies.db.communityVoyageLog.findUnique.mockResolvedValue({
      id: "private",
      ownerAccountId: "another-account",
      visibility: "COMMUNITY",
      lifecycleState: "PUBLISHED",
      publishedAt: now,
      verifiedCompletion: true,
    });
    dependencies.db.communityVoyageLog.findMany.mockResolvedValue([
      { id: "private", slug: "not-public", title: "Not public", safeSummary: null, spoilerLevel: "NONE" },
    ]);
    dependencies.db.communityVoyageLogShareRestriction.findMany.mockResolvedValue([
      { voyageLogId: "private", restrictionType: "PRIVATE_ONLY" },
    ]);
    dependencies.db.communityVoyageLogParticipant.findMany.mockResolvedValue([]);
    dependencies.db.communityVoyageLogParticipantConsent.findMany.mockResolvedValue([]);
    dependencies.db.communityVoyageLogMedia.findMany.mockResolvedValue([]);
    const response = await detail(new Request("http://localhost/api/community/voyage-logs/not-public"), {
      params: Promise.resolve({ slug: "not-public" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "COMMUNITY_VOYAGE_LOG_NOT_FOUND" });
  });

  it("builds unlisted metadata from the same consent-filtered anonymous projection", async () => {
    dependencies.db.communityVoyageLog.findUnique.mockResolvedValue({ visibility: "UNLISTED" });
    dependencies.db.communityVoyageLog.findMany.mockResolvedValue([
      {
        id: "unlisted",
        slug: "exact-link-voyage",
        title: "Exact-link Voyage",
        safeSummary: "A consented preview-safe account.",
        spoilerLevel: "PREVIEW_SAFE",
      },
    ]);
    dependencies.db.communityVoyageLogShareRestriction.findMany.mockResolvedValue([]);
    dependencies.db.communityVoyageLogParticipant.findMany.mockResolvedValue([]);
    dependencies.db.communityVoyageLogParticipantConsent.findMany.mockResolvedValue([]);
    dependencies.db.communityVoyageLogMedia.findMany.mockResolvedValue([]);

    await expect(readAnonymousVoyageLogMetadata("exact-link-voyage")).resolves.toEqual({
      visibility: "UNLISTED",
      log: {
        slug: "exact-link-voyage",
        title: "Exact-link Voyage",
        safeSummary: "A consented preview-safe account.",
        spoilerLevel: "PREVIEW_SAFE",
        verifiedCompletion: true,
      },
    });

    dependencies.db.communityVoyageLog.findUnique.mockResolvedValue({ visibility: "PRIVATE" });
    await expect(readAnonymousVoyageLogMetadata("private-voyage")).resolves.toBeNull();
  });

  it("rejects unsupported list query parameters", async () => {
    const response = await list(new Request("http://localhost/api/community/voyage-logs?include=participants"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "COMMUNITY_INVALID_QUERY" });
  });
});
