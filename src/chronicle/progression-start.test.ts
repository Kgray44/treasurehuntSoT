import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chronicleFind: vi.fn(),
  profileFind: vi.fn(),
  profileCreate: vi.fn(),
  sessionCreate: vi.fn(),
  sessionUpdate: vi.fn(),
  membershipCreate: vi.fn(),
  eventFind: vi.fn(),
  eventCreate: vi.fn(),
  revealUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    chronicle: { findFirst: mocks.chronicleFind },
    playerProfile: { findUniqueOrThrow: mocks.profileFind, create: mocks.profileCreate },
    taleSession: { create: mocks.sessionCreate, update: mocks.sessionUpdate },
    playthroughMembership: { create: mocks.membershipCreate },
    taleSessionEvent: { findUnique: mocks.eventFind, create: mocks.eventCreate },
    revealState: { upsert: mocks.revealUpsert },
    taleVerificationRequest: { findFirst: vi.fn(), create: vi.fn() },
    platformAuditEvent: { create: mocks.auditCreate },
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(db)),
  };
  return { db };
});
vi.mock("@/lib/events", () => ({ publishTaleSessionEvent: vi.fn() }));

import { startTaleSession } from "./progression";

const snapshot = {
  schemaVersion: 1,
  tale: {
    id: "tale-1",
    slug: "moonlit-map",
    title: "The Moonlit Map",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "MYSTERY",
    visibility: "PUBLIC",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: 60,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "chapter-1",
      title: "Arrival",
      orderIndex: 0,
      entryBlockId: "block-first",
      completionBlockId: "block-first",
      blocks: [
        {
          id: "block-first",
          chapterId: "chapter-1",
          blockType: "narrative",
          title: "First light",
          configuration: {},
          isEnabled: true,
          orderIndex: 0,
          nextBlockId: null,
          connections: [],
        },
      ],
    },
  ],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt: "2026-08-04T00:00:00.000Z",
};

describe("Project Homeport Chronicle-specific participant identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chronicleFind.mockResolvedValue({
      id: "tale-1",
      versions: [{ id: "version-1", contentSnapshot: JSON.stringify(snapshot) }],
    });
    mocks.profileFind.mockResolvedValue({ id: "profile-1", displayName: "Canonical Navigator" });
    mocks.profileCreate.mockResolvedValue({ id: "guest-profile" });
    mocks.sessionCreate.mockResolvedValue({
      id: "session-1",
      publishedVersionId: "version-1",
      draftRevisionId: null,
      startedAt: new Date("2026-08-04T00:00:00.000Z"),
    });
    mocks.sessionUpdate.mockResolvedValue({ currentSequence: 1 });
    mocks.eventFind.mockResolvedValue(null);
    mocks.eventCreate.mockResolvedValue({
      id: "event-1",
      eventType: "blockEntered",
      sequence: 2,
      createdAt: new Date("2026-08-04T00:00:00.000Z"),
    });
  });

  it("homeport.owner-correction.round1.alias.default reuses the canonical Profile without creating a second identity", async () => {
    await startTaleSession("moonlit-map", {
      accountId: "account-1",
      profileId: "profile-1",
      canonicalDisplayName: "Canonical Navigator",
    });
    expect(mocks.profileFind).toHaveBeenCalledWith({ where: { id: "profile-1" } });
    expect(mocks.profileCreate).not.toHaveBeenCalled();
    expect(mocks.membershipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerProfileId: "profile-1",
        participationAlias: "Canonical Navigator",
        participationAliasEditedAt: null,
      }),
    });
  });

  it("homeport.owner-correction.round1.alias.isolation persists an explicit Chronicle alias without changing global Profile identity", async () => {
    await startTaleSession("moonlit-map", {
      ownerLabel: "Night Cartographer",
      aliasEdited: true,
      accountId: "account-1",
      profileId: "profile-1",
      canonicalDisplayName: "Canonical Navigator",
    });
    expect(mocks.membershipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerProfileId: "profile-1",
        participationAlias: "Night Cartographer",
        participationAliasEditedAt: expect.any(Date),
      }),
    });
    expect(mocks.sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerLabel: "Night Cartographer", voyageName: "Night Cartographer's voyage" }),
    });
    expect(mocks.profileCreate).not.toHaveBeenCalled();
  });

  it("rejects a silent signed-in identity override unless the explicit Chronicle edit action was used", async () => {
    await expect(
      startTaleSession("moonlit-map", {
        ownerLabel: "Hidden Override",
        accountId: "account-1",
        profileId: "profile-1",
        canonicalDisplayName: "Canonical Navigator",
      }),
    ).rejects.toThrow("Use Edit for this Chronicle");
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.alias.anonymous creates an isolated editable guest identity", async () => {
    await startTaleSession("moonlit-map", { ownerLabel: "Guest Mariner" });
    expect(mocks.profileCreate).toHaveBeenCalledWith({
      data: {
        displayName: "Guest Mariner",
        preferences: JSON.stringify({ compatibilitySessionCookie: true }),
      },
    });
    expect(mocks.membershipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerProfileId: "guest-profile",
        participationAlias: "Guest Mariner",
        participationAliasEditedAt: null,
      }),
    });
  });
});
