import { beforeEach, describe, expect, it, vi } from "vitest";

const { compare, createPlayerIdentitySession, ensureGuestAccountForProfile, recordCompatibilityObservation } =
  vi.hoisted(() => ({
    compare: vi.fn(),
    createPlayerIdentitySession: vi.fn(),
    ensureGuestAccountForProfile: vi.fn(),
    recordCompatibilityObservation: vi.fn(),
  }));

const db = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  legacyEntityReference: { findFirst: vi.fn(), create: vi.fn() },
  playthroughMembership: { findUnique: vi.fn() },
  playerProfile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { compare } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/platform/auth", () => ({
  createPlayerIdentitySession,
  playerCanAccessPlaythrough: vi.fn(),
  requirePlayerIdentity: vi.fn(),
}));
vi.mock("@/wayfarer/accounts", () => ({ ensureGuestAccountForProfile }));
vi.mock("@/compatibility/compatibility-observation", () => ({
  compatibilityTestTraffic: vi.fn(() => true),
  recordCompatibilityObservation,
}));

import { exchangeLegacyAccessCode, LegacyCompatibilityError } from "./legacy-companion";

describe("legacy credential exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaign.findUnique.mockResolvedValue({
      id: "legacy-campaign",
      accessCodeHash: "hash",
      slug: "legacy-voyage",
      title: "Voyage",
    });
    compare.mockResolvedValue(true);
    db.legacyEntityReference.findFirst.mockImplementation(({ where }: { where: { canonicalModel: string } }) => {
      const mapped = {
        Chronicle: "chronicle-1",
        PublishedTaleVersion: "version-1",
        TaleSession: "session-1",
        PlayerProfile: "player-1",
        PlaythroughMembership: "membership-1",
      }[where.canonicalModel];
      return Promise.resolve(mapped ? { canonicalId: mapped } : null);
    });
  });

  it("refuses a revoked mapped membership before issuing any canonical session", async () => {
    db.playthroughMembership.findUnique.mockResolvedValue({ status: "REVOKED" });

    await expect(exchangeLegacyAccessCode("legacy-voyage", "synthetic-access-code")).rejects.toMatchObject({
      code: "ACCESS_DENIED",
    } satisfies Partial<LegacyCompatibilityError>);

    expect(createPlayerIdentitySession).not.toHaveBeenCalled();
    expect(recordCompatibilityObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "LEGACY_ACCESS_EXCHANGE",
        disposition: "DENIED",
        canonicalSessionId: "session-1",
      }),
    );
  });
});
