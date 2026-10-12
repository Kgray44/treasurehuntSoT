// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient, Prisma } from "@prisma/client";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  CROSSDECK_EXPERIENCE_EMAIL,
  CROSSDECK_EXPERIENCE_PASSWORD,
  CROSSDECK_EXPERIENCE_SECONDARY_EMAIL,
  CROSSDECK_EXPERIENCE_USERNAME,
  STATIC_ACCOUNT_ID,
  STATIC_CHRONICLE_ID,
  STATIC_EDITION_ID,
  STATIC_PROFILE_ID,
  STATIC_VOYAGE_ID,
  prepareCrossdeckExperienceFixture,
} from "../../tests/e2e/fixtures/crossdeck-experience";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { landfallFixture } from "@/landfall/fixtures";
import { getPlayerJournalReadingState } from "@/platform/libraries";
import { findActiveAccountByLogin } from "@/wayfarer/accounts";

const readingDatabase = vi.hoisted(() => ({
  playthroughMembership: { findFirst: vi.fn() },
  accountEmail: { findUnique: vi.fn() },
  playerProfile: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: readingDatabase }));

afterEach(() => {
  vi.unstubAllEnvs();
  readingDatabase.playthroughMembership.findFirst.mockReset();
  readingDatabase.accountEmail.findUnique.mockReset();
  readingDatabase.playerProfile.findUnique.mockReset();
});

const filename = `validation-isolated-20261011-123456789-${"a".repeat(32)}.db`;
function ownedEnvironment() {
  vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
  vi.stubEnv("SOUNDING_LINE_SUITE_PROFILE", "generic");
  vi.stubEnv("SOUNDING_LINE_TASK_OWNED_HTTP", "1");
  vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "b".repeat(64));
  vi.stubEnv("DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef", filename)}`);
}

function fixtureStore(existing = false) {
  const tx = {
    userAccount: { create: vi.fn().mockResolvedValue(null) },
    chronicle: { create: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) },
    publishedTaleVersion: { create: vi.fn().mockResolvedValue(null) },
    taleSession: { create: vi.fn().mockResolvedValue(null) },
    playthroughMembership: { create: vi.fn().mockResolvedValue(null) },
    taleSessionEvent: { createMany: vi.fn().mockResolvedValue(null) },
    revealState: { createMany: vi.fn().mockResolvedValue(null) },
  };
  // Any session, Crossdeck surface, browser, or marker enrollment is a failure.
  const protectedTx = new Proxy(tx, {
    get(target, name) {
      if (!(name in target)) throw new Error(`Unexpected fixture model: ${String(name)}`);
      return Reflect.get(target, name);
    },
  });
  const findUnique = vi.fn().mockResolvedValue(existing ? { id: STATIC_VOYAGE_ID } : null);
  const transaction = vi.fn(async (write: (store: typeof tx) => Promise<void>) => write(protectedTx));
  return {
    tx,
    findUnique,
    transaction,
    store: { taleSession: { findUnique }, $transaction: transaction } as unknown as PrismaClient,
  };
}

describe("deterministic Crossdeck experience seed", () => {
  it.each([
    ["FOREVER_VALIDATION_ISOLATION", ""],
    ["SOUNDING_LINE_SUITE_PROFILE", "oauth"],
    ["SOUNDING_LINE_TASK_OWNED_HTTP", "0"],
    ["FOREVER_VALIDATION_NONCE_HASH", "invalid"],
    ["FOREVER_VALIDATION_NONCE_HASH", "a".repeat(63)],
    ["DATABASE_URL", "mysql://synthetic.invalid/crossdeck"],
    ["DATABASE_URL", "file:./prisma/dev.db"],
    ["DATABASE_URL", `file:${path.resolve("prisma/dev.db")}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-owned", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef/nested", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line-elsewhere/generic-123456abcdef", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef", "real.db")}`],
  ])("refuses %s=%s before any database access", async (name, value) => {
    ownedEnvironment();
    vi.stubEnv(name, value);
    const access = vi.fn();
    const store = new Proxy({}, { get: access }) as PrismaClient;
    await expect(prepareCrossdeckExperienceFixture(store)).rejects.toThrow(
      "CROSSDECK_EXPERIENCE_OWNED_FIXTURE_REQUIRED",
    );
    expect(access).not.toHaveBeenCalled();
  });

  it("seeds real credentials and valid private released content without pre-enrolling a session or device", async () => {
    ownedEnvironment();
    const originalDefinition = structuredClone(landfallFixture);
    const { store, tx, transaction } = fixtureStore();
    const identity = await prepareCrossdeckExperienceFixture(store);
    expect(transaction).toHaveBeenCalledOnce();
    expect(identity).toMatchObject({
      accountId: STATIC_ACCOUNT_ID,
      voyageId: STATIC_VOYAGE_ID,
      versionId: STATIC_EDITION_ID,
      profileId: STATIC_PROFILE_ID,
      taleId: STATIC_CHRONICLE_ID,
    });
    const account = tx.userAccount.create.mock.calls[0][0].data as Prisma.UserAccountCreateInput;
    expect(tx.userAccount.create).toHaveBeenCalledOnce();
    expect(account).toMatchObject({
      id: STATIC_ACCOUNT_ID,
      status: "ACTIVE",
      profile: {
        create: {
          id: STATIC_PROFILE_ID,
          username: CROSSDECK_EXPERIENCE_USERNAME,
          displayName: "Crossdeck synthetic navigator",
          status: "ACTIVE",
        },
      },
      emails: {
        create: [
          expect.objectContaining({
            normalizedEmail: CROSSDECK_EXPERIENCE_EMAIL,
            verificationState: "VERIFIED",
            isPrimary: true,
          }),
          expect.objectContaining({
            normalizedEmail: CROSSDECK_EXPERIENCE_SECONDARY_EMAIL,
            verificationState: "VERIFIED",
            isPrimary: false,
          }),
        ],
      },
    });
    const emails = account.emails!.create;
    if (!Array.isArray(emails)) throw new Error("The fixture must persist both email identifiers on one account.");
    expect(emails).toHaveLength(2);
    expect(new Set(emails.map((email) => email.id)).size).toBe(2);
    expect(new Set(emails.map((email) => email.normalizedEmail)).size).toBe(2);
    expect(emails.filter((email) => email.isPrimary === true)).toHaveLength(1);
    expect(emails.filter((email) => email.isPrimary === false)).toHaveLength(1);
    expect(emails.every((email) => email.verificationState === "VERIFIED" && email.verifiedAt instanceof Date)).toBe(
      true,
    );
    const profile = account.profile!.create!;
    const savedAccount = {
      id: account.id,
      status: account.status,
      profile: { ...profile, accountId: account.id },
      credential: account.credential!.create!,
      roles: [],
    };
    readingDatabase.accountEmail.findUnique.mockImplementation(({ where }: { where: { normalizedEmail: string } }) => {
      const email = emails.find((item) => item.normalizedEmail === where.normalizedEmail);
      return email ? { ...email, accountId: account.id, account: savedAccount } : null;
    });
    readingDatabase.playerProfile.findUnique.mockImplementation(({ where }: { where: { username: string } }) =>
      where.username === profile.username ? { ...savedAccount.profile, account: savedAccount } : null,
    );
    for (const login of [
      CROSSDECK_EXPERIENCE_EMAIL,
      CROSSDECK_EXPERIENCE_SECONDARY_EMAIL,
      CROSSDECK_EXPERIENCE_USERNAME,
    ]) {
      const resolved = await findActiveAccountByLogin(` ${login.toUpperCase()} `);
      expect(resolved).toBe(savedAccount);
      expect(resolved).toMatchObject({
        id: STATIC_ACCOUNT_ID,
        profile: { id: STATIC_PROFILE_ID, accountId: STATIC_ACCOUNT_ID },
      });
    }
    expect(await findActiveAccountByLogin("unseeded-synthetic@example.test")).toBeNull();
    expect(await findActiveAccountByLogin("unseeded-synthetic-username")).toBeNull();
    expect(account.claimedAt).toBeInstanceOf(Date);
    expect(account.ordinaryWorkspaceEntryAt).toBeInstanceOf(Date);
    const preferences = account.profile!.create!.preferences;
    if (typeof preferences !== "string") throw new Error("The seeded profile must persist its Journal state.");
    readingDatabase.playthroughMembership.findFirst.mockResolvedValue({ player: { preferences } });
    expect(await getPlayerJournalReadingState(STATIC_PROFILE_ID, STATIC_VOYAGE_ID)).toEqual({
      pageId: `block:${identity.activeId}:primary`,
      openDrawer: null,
      hasOpened: true,
      lastEventSequence: 4,
      textScale: 1,
      updatedAt: "2026-10-11T12:00:00.000Z",
    });
    expect(readingDatabase.playthroughMembership.findFirst).toHaveBeenCalledWith({
      where: {
        playerProfileId: STATIC_PROFILE_ID,
        playthroughId: STATIC_VOYAGE_ID,
        status: { in: ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
      },
      include: { player: { select: { preferences: true } } },
    });
    const passwordHash = account.credential!.create!.passwordHash;
    expect(passwordHash).not.toBe(CROSSDECK_EXPERIENCE_PASSWORD);
    expect(await compare(CROSSDECK_EXPERIENCE_PASSWORD, passwordHash)).toBe(true);
    expect(await compare("incorrect-synthetic-password", passwordHash)).toBe(false);
    expect(account).not.toHaveProperty("sessions");
    expect(tx.chronicle.create.mock.calls[0][0].data).toMatchObject({
      id: STATIC_CHRONICLE_ID,
      creatorAccountId: STATIC_ACCOUNT_ID,
      status: "PUBLISHED",
      visibility: "PRIVATE",
    });
    const edition = tx.publishedTaleVersion.create.mock.calls[0][0]
      .data as Prisma.PublishedTaleVersionUncheckedCreateInput;
    expect(edition.id).toBe(STATIC_EDITION_ID);
    expect(edition.checksum).toBe(createHash("sha256").update(edition.contentSnapshot).digest("hex"));
    const snapshot = parsePublishedSnapshot(edition.contentSnapshot);
    expect(snapshot.tale.visibility).toBe("PRIVATE");
    expect(snapshot.tale.title).toBe("Synthetic Crossdeck refit Voyage");
    expect(snapshot.chapters[0].title).toBe("The island course");
    const [active, complete, note, artifact] = snapshot.chapters[0].blocks;
    expect(active.configuration.heading).toBe("Follow the lanterns");
    expect(projectPlayerBlock(active)?.presentation.spatialMoment?.attachment.storyMomentId).toBe(identity.activeId);
    expect(projectPlayerBlock(note)).toMatchObject({ journalKind: "message", title: "A letter from the Captain" });
    expect(projectPlayerBlock(artifact)).toMatchObject({ journalKind: "artifact", title: "The brass compass" });
    expect(complete.id).toBe(identity.nextId);
    expect(note.configuration.crossdeck).toBeUndefined();
    const session = tx.taleSession.create.mock.calls[0][0].data as Prisma.TaleSessionUncheckedCreateInput;
    expect(session).toMatchObject({
      id: STATIC_VOYAGE_ID,
      status: "ACTIVE",
      currentBlockId: active.id,
      currentSequence: 4,
    });
    expect(tx.playthroughMembership.create.mock.calls[0][0].data).toMatchObject({
      playthroughId: STATIC_VOYAGE_ID,
      playerProfileId: STATIC_PROFILE_ID,
      status: "ACTIVE_MEMBER",
    });
    const events = tx.taleSessionEvent.createMany.mock.calls[0][0].data as Prisma.TaleSessionEventCreateManyInput[];
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(
      events.every((event) => event.sessionId === STATIC_VOYAGE_ID && event.publishedVersionId === STATIC_EDITION_ID),
    ).toBe(true);
    const journeyEvents = events.map((event) => {
      const { id, payload, createdAt } = event;
      if (
        typeof id !== "string" ||
        !id ||
        typeof payload !== "string" ||
        !(createdAt instanceof Date) ||
        !Number.isFinite(createdAt.getTime())
      )
        throw new Error("Seeded journey events require an ID, serialized payload, and valid timestamp.");
      return { id, sequence: event.sequence, eventType: event.eventType, payload, createdAt };
    });
    const chart = projectPlayerLandfallBootstrap(
      {
        sessionId: STATIC_VOYAGE_ID,
        publishedVersionId: STATIC_EDITION_ID,
        taleId: STATIC_CHRONICLE_ID,
        currentSequence: 4,
        definition: snapshot.landfall!,
      },
      { blockId: active.id, chapterId: active.chapterId, releasedAssets: [], events: journeyEvents },
    );
    expect(chart).toMatchObject({
      activeWaypointId: "isle-region",
      worldspaceName: "Imaginary Isles",
      replayOnly: false,
    });
    expect(chart.scene.worldspaceKind).toBe("VIRTUAL");
    expect(chart.scene.renderer).toBe("VECTOR_2D");
    expect(chart.scene.features.some((feature) => feature.label === "Secret Isle")).toBe(true);
    expect(chart.visitedIds).toEqual([]);
    expect(tx.revealState.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        playthroughId: STATIC_VOYAGE_ID,
        contentKey: identity.noteId,
        revealedByAccountId: STATIC_ACCOUNT_ID,
      }),
      expect.objectContaining({
        playthroughId: STATIC_VOYAGE_ID,
        contentKey: identity.artifactId,
        revealedByAccountId: STATIC_ACCOUNT_ID,
      }),
    ]);
    expect(landfallFixture).toEqual(originalDefinition);
  });

  it("preserves an existing static Voyage, updated reading preferences, and UI-created sessions on repeated ensure seeds", async () => {
    ownedEnvironment();
    const returningState = {
      pageId: "block:00000000-0000-4000-8000-00000000cd18:primary",
      openDrawer: "messages",
      hasOpened: true,
      lastEventSequence: 7,
      textScale: 1.2,
      updatedAt: "2026-10-12T07:00:00.000Z",
    };
    readingDatabase.playthroughMembership.findFirst.mockResolvedValue({
      player: { preferences: JSON.stringify({ journals: { [STATIC_VOYAGE_ID]: returningState } }) },
    });
    const { store, findUnique, transaction } = fixtureStore(true);
    const identity = await prepareCrossdeckExperienceFixture(store);
    expect(identity.voyageId).toBe(STATIC_VOYAGE_ID);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: STATIC_VOYAGE_ID } });
    expect(transaction).not.toHaveBeenCalled();
    expect(await getPlayerJournalReadingState(STATIC_PROFILE_ID, STATIC_VOYAGE_ID)).toEqual(returningState);
  });

  it("publishes the same immutable snapshot and static IDs in each fresh owned seed", async () => {
    ownedEnvironment();
    const first = fixtureStore(),
      second = fixtureStore();
    const firstIdentity = await prepareCrossdeckExperienceFixture(first.store);
    const secondIdentity = await prepareCrossdeckExperienceFixture(second.store);
    expect(firstIdentity).toEqual(secondIdentity);
    expect(first.tx.publishedTaleVersion.create.mock.calls[0][0].data).toEqual(
      second.tx.publishedTaleVersion.create.mock.calls[0][0].data,
    );
    expect(first.tx.taleSessionEvent.createMany.mock.calls[0][0].data).toEqual(
      second.tx.taleSessionEvent.createMany.mock.calls[0][0].data,
    );
  });
});
