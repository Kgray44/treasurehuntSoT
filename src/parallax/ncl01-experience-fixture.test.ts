import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import path from "node:path";
import { parsePublishedSnapshot } from "@/chronicle/types";
import {
  NCL01_EXPERIENCE_ACCOUNTS,
  NCL01_EXPERIENCE_CHRONICLE_ID,
  NCL01_EXPERIENCE_DRAFT_ID,
  NCL01_EXPERIENCE_EDITION_ID,
  NCL01_EXPERIENCE_PASSWORD,
  NCL01_EXPERIENCE_VOYAGE_ID,
  prepareNcl01ExperienceFixture,
} from "../../tests/e2e/fixtures/ncl01-experience";

afterEach(() => vi.unstubAllEnvs());
const filename = `validation-isolated-20261021-123456789-${"a".repeat(32)}.db`;
function ownedEnvironment() {
  vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
  vi.stubEnv("SOUNDING_LINE_SUITE_PROFILE", "generic");
  vi.stubEnv("SOUNDING_LINE_TASK_OWNED_HTTP", "1");
  vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "b".repeat(64));
  vi.stubEnv("DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef", filename)}`);
}
function fixtureStore(existingAccounts: string[] = [], voyageExists = false) {
  const tx = {
    userAccount: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        existingAccounts.includes(where.id) ? { id: where.id } : null,
      ),
      create: vi.fn().mockResolvedValue(null),
    },
    chronicle: { create: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) },
    publishedTaleVersion: { create: vi.fn().mockResolvedValue(null) },
    taleSession: {
      findUnique: vi.fn().mockResolvedValue(voyageExists ? { id: NCL01_EXPERIENCE_VOYAGE_ID } : null),
      create: vi.fn().mockResolvedValue(null),
    },
    playthroughMembership: { create: vi.fn().mockResolvedValue(null) },
    taleSessionEvent: { createMany: vi.fn().mockResolvedValue(null) },
  };
  // Any pre-established auth, pairing, history or qualification row is outside this fixture.
  const protectedTx = new Proxy(tx, {
    get(target, name) {
      if (!(name in target)) throw new Error(`Unexpected fixture model: ${String(name)}`);
      return Reflect.get(target, name);
    },
  });
  const transaction = vi.fn(async (write: (store: typeof tx) => Promise<void>) => write(protectedTx));
  return { store: { $transaction: transaction } as unknown as PrismaClient, tx, transaction };
}

describe("NCL01 isolated consumer experience fixture", () => {
  it.each([
    ["FOREVER_VALIDATION_ISOLATION", ""],
    ["SOUNDING_LINE_SUITE_PROFILE", "ncl01"],
    ["SOUNDING_LINE_TASK_OWNED_HTTP", "0"],
    ["FOREVER_VALIDATION_NONCE_HASH", "b".repeat(63)],
    ["DATABASE_URL", "mysql://synthetic.invalid/ncl01"],
    ["DATABASE_URL", "file:./prisma/dev.db"],
    ["DATABASE_URL", `file:${path.resolve("prisma/dev.db")}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-owned", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef/nested", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line-elsewhere/generic-123456abcdef", filename)}`],
    ["DATABASE_URL", `file:${path.resolve("artifacts/sounding-line/generic-123456abcdef/real.db")}`],
  ])("rejects %s=%s before database access", async (name, value) => {
    ownedEnvironment();
    vi.stubEnv(name, value);
    const access = vi.fn();
    const store = new Proxy({}, { get: access }) as PrismaClient;
    await expect(prepareNcl01ExperienceFixture(store)).rejects.toThrow("NCL01_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
    expect(access).not.toHaveBeenCalled();
  });

  it("creates fresh least-privileged identities with real hashed credentials, without sessions or enrollment", async () => {
    ownedEnvironment();
    const { store, tx, transaction } = fixtureStore();
    await prepareNcl01ExperienceFixture(store);
    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.userAccount.create).toHaveBeenCalledTimes(5);
    const accounts = tx.userAccount.create.mock.calls.map(([input]) => input.data as Prisma.UserAccountCreateInput);
    for (const [index, account] of accounts.entries()) {
      const expected = NCL01_EXPERIENCE_ACCOUNTS[index];
      expect(account).toMatchObject({
        id: expected.id,
        status: "ACTIVE",
        profile: { create: { displayName: `Synthetic NCL01 ${expected.label}`, status: "ACTIVE" } },
        emails: {
          create: {
            normalizedEmail: `ncl01-review-${expected.label.toLowerCase()}@example.test`,
            verificationState: "VERIFIED",
            isPrimary: true,
          },
        },
      });
      expect(account.claimedAt).toBeInstanceOf(Date);
      expect(account.ordinaryWorkspaceEntryAt).toBeInstanceOf(Date);
      const passwordHash = account.credential!.create!.passwordHash;
      expect(passwordHash).not.toBe(NCL01_EXPERIENCE_PASSWORD);
      expect(await compare(NCL01_EXPERIENCE_PASSWORD, passwordHash)).toBe(true);
      expect(await compare("unaccepted-synthetic-password", passwordHash)).toBe(false);
      if (expected.role) expect(account.roles).toEqual({ create: { role: expected.role, scopeType: "GLOBAL" } });
      else expect(account).not.toHaveProperty("roles");
      expect(account).not.toHaveProperty("sessions");
      expect(account).not.toHaveProperty("devices");
    }
  });

  it("pins completed canonical source data for real history materialization and leaves authoring unqualified", async () => {
    ownedEnvironment();
    const { store, tx } = fixtureStore();
    await prepareNcl01ExperienceFixture(store);
    const edition = tx.publishedTaleVersion.create.mock.calls[0][0].data;
    const snapshot = parsePublishedSnapshot(edition.contentSnapshot);
    expect(edition.checksum).toBe(createHash("sha256").update(edition.contentSnapshot).digest("hex"));
    expect(snapshot.tale).toMatchObject({
      id: NCL01_EXPERIENCE_CHRONICLE_ID,
      title: "NCL01 Consumer Chronicle",
      visibility: "PRIVATE",
    });
    const chapter = snapshot.chapters[0];
    const completion = chapter.blocks[0];
    expect(completion.id).toBe(chapter.entryBlockId);
    expect(completion.id).toBe(chapter.completionBlockId);
    expect(completion).toMatchObject({ blockType: "taleComplete", nextBlockId: null, connections: [] });
    expect(tx.chronicle.create.mock.calls[0][0].data).toMatchObject({
      creatorAccountId: NCL01_EXPERIENCE_ACCOUNTS[2].id,
      visibility: "PRIVATE",
      drafts: { create: { id: NCL01_EXPERIENCE_DRAFT_ID, validationState: "NOT_VALIDATED" } },
    });
    expect(tx.chronicle.update).toHaveBeenCalledWith({
      where: { id: NCL01_EXPERIENCE_CHRONICLE_ID },
      data: {
        currentDraftRevisionId: NCL01_EXPERIENCE_DRAFT_ID,
        latestPublishedVersionId: NCL01_EXPERIENCE_EDITION_ID,
      },
    });
    const voyage = tx.taleSession.create.mock.calls[0][0].data;
    const membership = tx.playthroughMembership.create.mock.calls[0][0].data;
    expect(voyage).toMatchObject({
      id: NCL01_EXPERIENCE_VOYAGE_ID,
      taleId: snapshot.tale.id,
      publishedVersionId: edition.id,
      status: "COMPLETED",
      currentBlockId: completion.id,
      currentSequence: 2,
    });
    expect(membership).toMatchObject({
      playthroughId: voyage.id,
      playerProfileId: `${NCL01_EXPERIENCE_ACCOUNTS[0].id}:profile`,
      status: "COMPLETED_MEMBER",
      joinedAt: voyage.startedAt,
      completedAt: voyage.completedAt,
    });
    expect(tx.taleSessionEvent.createMany.mock.calls[0][0].data).toEqual(
      ["chapterCompleted", "sessionCompleted"].map((eventType, index) =>
        expect.objectContaining({
          sessionId: voyage.id,
          publishedVersionId: edition.id,
          blockId: completion.id,
          eventType,
          sequence: index + 1,
          createdAt: voyage.completedAt,
        }),
      ),
    );
  });

  it("preserves a pre-existing fixed Sea Trials owner without changing its credentials, roles or data", async () => {
    ownedEnvironment();
    const { store, tx } = fixtureStore(["spatial-pilot-navigator"]);
    await prepareNcl01ExperienceFixture(store);
    expect(tx.userAccount.create).toHaveBeenCalledTimes(4);
    expect(tx.userAccount.create.mock.calls.map(([input]) => input.data.id)).not.toContain("spatial-pilot-navigator");
  });

  it("preserves all existing identity and Voyage state on repeated ensure seeds", async () => {
    ownedEnvironment();
    const { store, tx } = fixtureStore(
      NCL01_EXPERIENCE_ACCOUNTS.map(({ id }) => id),
      true,
    );
    await prepareNcl01ExperienceFixture(store);
    for (const model of [
      tx.userAccount,
      tx.chronicle,
      tx.publishedTaleVersion,
      tx.taleSession,
      tx.playthroughMembership,
    ])
      expect(model.create).not.toHaveBeenCalled();
    expect(tx.chronicle.update).not.toHaveBeenCalled();
    expect(tx.taleSessionEvent.createMany).not.toHaveBeenCalled();
  });
});
