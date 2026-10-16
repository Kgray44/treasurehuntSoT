// @vitest-environment node
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { previewAIQuotaPolicy, executeAIQuotaPolicy, type AIQuotaCommandInput } from "./ai-quota-commands";
import { defaultAIGlobalPolicy } from "./ai-policy";
import { AI_CONTROL_ID } from "./ai-ledger";
const root = mkdtempSync(join(tmpdir(), "voyagewright-parallax-a1-policy-")),
  database = join(root, "policy.sqlite");
const store = new PrismaClient({ datasources: { db: { url: `file:${database.replaceAll("\\", "/")}` } } });
const actor = {
  accountId: "synthetic-admin",
  accountSessionId: "synthetic-session",
  roles: ["ADMINISTRATOR"],
  capabilities: ["CONFIG_OPERATE" as const],
  authorizationBasis: "ROLE_CAPABILITY:ADMINISTRATOR",
};
const now = new Date("2026-10-11T18:00:00Z");
const command = (rest: Partial<Extract<AIQuotaCommandInput, { target: "GLOBAL" }>> = {}): AIQuotaCommandInput => ({
  target: "GLOBAL",
  expectedRevision: 0,
  idempotencyKey: "synthetic-ai-policy-0001",
  reason: "Set a bounded synthetic test policy",
  policy: { ...defaultAIGlobalPolicy, enabled: true },
  ...rest,
});
beforeAll(async () => {
  for (const sql of (
    readFileSync(resolve("prisma/migrations/20261011180000_parallax_a1_ai_quotas/migration.sql"), "utf8") +
    "\n" +
    readFileSync(resolve("prisma/migrations/20261011210000_parallax_a1_application_receipt/migration.sql"), "utf8")
  )
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean))
    await store.$executeRawUnsafe(sql);
  await store.$executeRawUnsafe('CREATE TABLE "UserAccount" ("id" TEXT PRIMARY KEY NOT NULL)');
  await store.$executeRawUnsafe(
    'CREATE TABLE "PlatformAuditEvent" ("id" TEXT PRIMARY KEY NOT NULL, "actorType" TEXT NOT NULL, "actorId" TEXT, "actorAccountId" TEXT, "action" TEXT NOT NULL, "resourceType" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "outcome" TEXT NOT NULL DEFAULT \'SUCCEEDED\', "correlationId" TEXT NOT NULL, "metadata" TEXT NOT NULL DEFAULT \'{}\', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  await store.$executeRawUnsafe('INSERT INTO "UserAccount" ("id") VALUES (\'synthetic-user\')');
});
beforeEach(async () => {
  await store.aIQuotaCommandPreview.deleteMany();
  await store.aIQuotaPolicyRevision.deleteMany();
  await store.aIQuotaUserPolicy.deleteMany();
  await store.aIQuotaControl.deleteMany();
  await store.platformAuditEvent.deleteMany();
});
afterAll(async () => {
  await store.$disconnect();
  if (resolve(root).startsWith(resolve(tmpdir()) + "\\") || resolve(root).startsWith(resolve(tmpdir()) + "/")) {
    unlinkSync(database);
    rmdirSync(root);
  }
});
describe("Revisioned Admiralty owner policy commands with durable preview and audit", () => {
  it("requires the exact preview before any policy mutation", async () => {
    await expect(executeAIQuotaPolicy(actor, command(), "missing", store, now)).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
    });
    expect(await store.aIQuotaPolicyRevision.count()).toBe(0);
  });
  it("persists policy, revision, idempotent receipt and audit in one transaction", async () => {
    const input = command(),
      preview = await previewAIQuotaPolicy(actor, input, store, now);
    const receipt = await executeAIQuotaPolicy(actor, input, preview.previewId, store, now);
    expect(receipt.revision).toBe(1);
    expect(receipt.idempotent).toBe(false);
    const replay = await executeAIQuotaPolicy(actor, input, preview.previewId, store, now);
    expect(replay.id).toBe(receipt.id);
    expect(replay.idempotent).toBe(true);
    expect(await store.aIQuotaPolicyRevision.count()).toBe(1);
    expect(await store.platformAuditEvent.count()).toBe(1);
    expect(
      JSON.parse((await store.aIQuotaControl.findUniqueOrThrow({ where: { id: AI_CONTROL_ID } })).policy).enabled,
    ).toBe(true);
  });
  it("rejects changed input, session, actor and expired previews", async () => {
    const input = command(),
      preview = await previewAIQuotaPolicy(actor, input, store, now);
    await expect(
      executeAIQuotaPolicy(actor, { ...input, reason: "A different requested reason" }, preview.previewId, store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await expect(
      executeAIQuotaPolicy({ ...actor, accountSessionId: "different" }, input, preview.previewId, store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await expect(
      executeAIQuotaPolicy({ ...actor, accountId: "other-admin" }, input, preview.previewId, store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await expect(
      executeAIQuotaPolicy(actor, input, preview.previewId, store, new Date(now.getTime() + 600001)),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
  });
  it("rejects stale revisions and preserves history through a new compensating revision", async () => {
    const first = command(),
      preview = await previewAIQuotaPolicy(actor, first, store, now);
    await executeAIQuotaPolicy(actor, first, preview.previewId, store, now);
    await expect(
      previewAIQuotaPolicy(actor, command({ idempotencyKey: "synthetic-ai-policy-0002" }), store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    const restore = command({
      expectedRevision: 1,
      idempotencyKey: "synthetic-ai-policy-0002",
      policy: { ...defaultAIGlobalPolicy },
    });
    const next = await previewAIQuotaPolicy(actor, restore, store, now);
    expect((await executeAIQuotaPolicy(actor, restore, next.previewId, store, now)).revision).toBe(2);
    expect(await store.aIQuotaPolicyRevision.count()).toBe(2);
  });
  it("previews effective user ceilings and restores inheritance monotonically", async () => {
    const input: AIQuotaCommandInput = {
      target: "USER",
      accountId: "synthetic-user",
      expectedRevision: 0,
      idempotencyKey: "synthetic-user-policy-01",
      reason: "Approve a bounded user exception",
      policy: {
        monthlyRequests: 1000,
        monthlySpendNano: 20_000_000_000,
        advancedEnabled: true,
        requestsPerMinute: 40,
        suspended: false,
        expiresAt: "2026-10-20T00:00:00Z",
        standardModel: "gpt-6.1-sol",
        roomModel: "gpt-6-luna",
      },
    };
    const preview = await previewAIQuotaPolicy(actor, input, store, now);
    expect(preview.resultingState.effective).toMatchObject({
      monthlySpendNano: 10_000_000_000,
      advancedEnabled: false,
      requestsPerMinute: 10,
      standardModel: "gpt-6.1-sol",
      roomModel: "gpt-6-luna",
    });
    await executeAIQuotaPolicy(actor, input, preview.previewId, store, now);
    const restore = { ...input, expectedRevision: 1, idempotencyKey: "synthetic-user-policy-02", policy: null };
    const restored = await previewAIQuotaPolicy(actor, restore, store, now);
    expect(restored.resultingState.effective).toMatchObject({
      source: "INHERITED",
      monthlyRequests: 500,
      standardModel: "gpt-6-luna",
      roomModel: "gpt-6.1-sol",
    });
    expect((await executeAIQuotaPolicy(actor, restore, restored.previewId, store, now)).revision).toBe(2);
    expect((await store.aIQuotaUserPolicy.findUniqueOrThrow({ where: { accountId: input.accountId } })).policy).toBe(
      "null",
    );
  });
  it("requires renewed effective-policy review when global ceilings change", async () => {
    const user: AIQuotaCommandInput = {
      target: "USER",
      accountId: "synthetic-user",
      expectedRevision: 0,
      idempotencyKey: "synthetic-user-policy-01",
      reason: "Restore platform quota defaults",
      policy: null,
    };
    const userPreview = await previewAIQuotaPolicy(actor, user, store, now);
    const global = command(),
      globalPreview = await previewAIQuotaPolicy(actor, global, store, now);
    await executeAIQuotaPolicy(actor, global, globalPreview.previewId, store, now);
    await expect(executeAIQuotaPolicy(actor, user, userPreview.previewId, store, now)).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
    });
  });
  it("denies ordinary Creators and support grants without quota authority", async () => {
    await expect(
      previewAIQuotaPolicy({ ...actor, roles: ["CREATOR"], capabilities: [] }, command(), store, now),
    ).rejects.toMatchObject({ code: "ADMIRALTY_CAPABILITY_DENIED" });
    await expect(
      previewAIQuotaPolicy({ ...actor, roles: ["SUPPORT_OPERATOR"] }, command(), store, now),
    ).rejects.toMatchObject({ code: "ADMIRALTY_CAPABILITY_DENIED" });
    expect(await store.aIQuotaPolicyRevision.count()).toBe(0);
  });
  it("rejects missing canonical users, past exceptions and sensitive reasons", async () => {
    const input: AIQuotaCommandInput = {
      target: "USER",
      accountId: "missing",
      expectedRevision: 0,
      idempotencyKey: "synthetic-user-policy-01",
      reason: "Restore platform quota defaults",
      policy: null,
    };
    await expect(previewAIQuotaPolicy(actor, input, store, now)).rejects.toMatchObject({
      code: "ADMIN_TARGET_NOT_FOUND",
    });
    await expect(
      previewAIQuotaPolicy(actor, command({ reason: "Password is private data" }), store, now),
    ).rejects.toMatchObject({ code: "ADMIN_REASON_INVALID" });
  });
});
