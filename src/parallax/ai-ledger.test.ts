// @vitest-environment node
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import {
  AI_CONTROL_ID,
  reserveAIUsage,
  markAIDispatched,
  settleAIUsage,
  failAIUsage,
  creatorAIUsage,
} from "./ai-ledger";
import { defaultAIGlobalPolicy, aiMaximumExposureNano, aiPricing } from "./ai-policy";

const fixtureRoot = mkdtempSync(join(tmpdir(), "voyagewright-parallax-a1-ledger-"));
const databasePath = join(fixtureRoot, "ledger.sqlite"),
  url = `file:${databasePath.replaceAll("\\", "/")}`;
const store = new PrismaClient({ datasources: { db: { url } } }),
  secondServer = new PrismaClient({ datasources: { db: { url } } });
const now = new Date("2026-10-11T18:00:00.000Z");
const exposure = aiMaximumExposureNano(aiPricing["gpt-6-luna"], 12000, 4000);
const usage = {
  inputTokens: 1000,
  cachedInputTokens: 100,
  cacheWriteTokens: 0,
  outputTokens: 500,
  reasoningTokens: 200,
};
const input = (id = "first", accountId = "synthetic-creator") => ({
  accountId,
  requestId: `request-${id}`,
  idempotencyKey: `idempotency-key-${id}`,
  fingerprint: `safe-fingerprint-${id}`,
  definitionId: "synthetic-draft",
  operationCategory: "AUTHORING",
  mode: "STANDARD" as const,
});
beforeAll(async () => {
  const sql =
    readFileSync(resolve("prisma/migrations/20261011180000_parallax_a1_ai_quotas/migration.sql"), "utf8") +
    "\n" +
    readFileSync(resolve("prisma/migrations/20261011210000_parallax_a1_application_receipt/migration.sql"), "utf8");
  for (const statement of sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean))
    await store.$executeRawUnsafe(statement);
});
beforeEach(async () => {
  await store.aIUsageLedger.deleteMany();
  await store.aIQuotaUserPolicy.deleteMany();
  await store.aIQuotaPolicyRevision.deleteMany();
  await store.aIQuotaControl.deleteMany();
  await store.aIQuotaControl.create({
    data: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
});
afterAll(async () => {
  await store.$disconnect();
  await secondServer.$disconnect();
  if (
    resolve(fixtureRoot).startsWith(resolve(tmpdir()) + "\\") ||
    resolve(fixtureRoot).startsWith(resolve(tmpdir()) + "/")
  ) {
    for (const suffix of ["", "-journal", "-wal", "-shm"])
      if (existsSync(databasePath + suffix)) unlinkSync(databasePath + suffix);
    rmdirSync(fixtureRoot);
  }
});
describe("Durable quota admission and settlement using actual isolated SQLite", () => {
  it("audits an automatic exposure disable and makes repeated settlement idempotent", async () => {
    const admission = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admission.record.id, store, now);
    const receipt = { usage: { ...usage, outputTokens: 20000 }, providerResponseId: "synthetic-excess-usage" };
    await settleAIUsage(admission.record.id, receipt, store, now);
    const control = await store.aIQuotaControl.findUniqueOrThrow({ where: { id: AI_CONTROL_ID } });
    expect(JSON.parse(control.policy).enabled).toBe(false);
    expect(control.lastFailureCode).toBe("EXPOSURE_EXCEEDED");
    const audit = await store.aIQuotaPolicyRevision.findFirstOrThrow();
    expect(audit.actorAccountId).toBe("SYSTEM:PARALLAX_EXPOSURE_GUARD");
    expect(JSON.parse(audit.beforeState).enabled).toBe(true);
    expect(JSON.parse(audit.afterState).enabled).toBe(false);
    await settleAIUsage(admission.record.id, receipt, secondServer, now);
    expect(await store.aIQuotaPolicyRevision.count()).toBe(1);
  });
  it("retains a validated proposal for replay while missing usage remains conservatively charged", async () => {
    const admission = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admission.record.id, store, now);
    const result = {
      status: "PROPOSED",
      proposal: { requestId: "synthetic-proposal" },
      accounting: "CONSERVATIVE_PENDING",
    };
    const unknown = await failAIUsage(admission.record.id, "UNKNOWN_PROVIDER_USAGE", false, store, now, {
      result,
      timings: { validationMs: 1 },
    });
    expect(unknown.status).toBe("UNKNOWN");
    expect(unknown.exposureNano).toBe(exposure);
    expect(JSON.parse(unknown.result!)).toEqual(result);
    expect(unknown.resultExpiresAt).toEqual(new Date(now.getTime() + 30 * 86400000));
    const replay = await reserveAIUsage(input(), secondServer, now);
    expect(replay.replay).toBe(true);
    expect(replay.record.result).toBe(unknown.result);
  });
  it("reserves money before dispatch and settles using pinned pricing", async () => {
    const admission = await reserveAIUsage(input(), store, now);
    expect(admission.record.status).toBe("RESERVED");
    expect(admission.record.exposureNano).toBe(exposure);
    await markAIDispatched(admission.record.id, store, now);
    const result = await settleAIUsage(
      admission.record.id,
      { usage, providerResponseId: "response-1", result: { status: "PROPOSED" } },
      store,
      now,
    );
    expect(result.exposureNano).toBe(BigInt(341000));
    expect(result.status).toBe("SETTLED");
    expect((await creatorAIUsage("synthetic-creator", store, now)).used).toBe(1);
  });
  it("deduplicates identities without dispatch or charge twice", async () => {
    const first = await reserveAIUsage(input(), store, now),
      replay = await reserveAIUsage(input(), secondServer, now);
    expect(replay.replay).toBe(true);
    expect(replay.record.id).toBe(first.record.id);
    await expect(reserveAIUsage({ ...input(), fingerprint: "different" }, store, now)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    await markAIDispatched(first.record.id, store, now);
    await expect(markAIDispatched(first.record.id, secondServer, now)).rejects.toMatchObject({
      code: "REQUEST_ALREADY_DISPATCHED",
    });
  });
  it("prevents independent servers and users reserving the same last budget", async () => {
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: {
        policy: JSON.stringify({
          ...defaultAIGlobalPolicy,
          enabled: true,
          monthlySpendNano: Number(exposure),
          warningSpendNano: 0,
        }),
      },
    });
    const results = await Promise.allSettled([
      reserveAIUsage(input("one", "user-one"), store, now),
      reserveAIUsage(input("two", "user-two"), secondServer, now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await store.aIUsageLedger.aggregate({ _sum: { exposureNano: true } }))._sum.exposureNano).toBe(exposure);
  }, 30000);
  it("enforces same-user concurrent requests even with distinct keys", async () => {
    await reserveAIUsage(input("one"), store, now);
    await expect(reserveAIUsage(input("two"), secondServer, now)).rejects.toMatchObject({ code: "USER_CONCURRENCY" });
  });
  it("retains conservative spending for a timed-out accepted request", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admitted.record.id, store, now);
    const failed = await failAIUsage(admitted.record.id, "UPSTREAM_TIMEOUT", false, secondServer, now);
    expect(failed.status).toBe("UNKNOWN");
    expect(failed.exposureNano).toBe(exposure);
    expect((await creatorAIUsage("synthetic-creator", store, now)).used).toBe(1);
    const settled = await settleAIUsage(
      admitted.record.id,
      { usage, providerResponseId: "delayed-receipt" },
      store,
      now,
    );
    expect(settled.status).toBe("SETTLED");
    expect(settled.exposureNano).toBeLessThan(exposure);
  });
  it("releases known undispatched failures without erasing the attempt", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    expect((await failAIUsage(admitted.record.id, "CONTEXT_TOO_LARGE", false, store, now)).exposureNano).toBe(
      BigInt(0),
    );
    expect(await store.aIUsageLedger.count()).toBe(1);
    expect((await creatorAIUsage("synthetic-creator", store, now)).used).toBe(0);
  });
  it("keeps expired dispatched reservations charged after process interruption", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admitted.record.id, store, now);
    await reserveAIUsage(input("next", "other-creator"), secondServer, new Date(now.getTime() + 100000));
    const interrupted = await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } });
    expect(interrupted.status).toBe("UNKNOWN");
    expect(interrupted.exposureNano).toBe(exposure);
  });
  it("expires provably undispatched leases and admits a new request", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    await reserveAIUsage(input("next"), secondServer, new Date(now.getTime() + 100000));
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } })).status).toBe(
      "RELEASED",
    );
  });
  it("preserves month history when delayed usage settles after rollover", async () => {
    const end = new Date("2026-10-31T23:59:59.000Z"),
      nextMonth = new Date("2026-11-01T00:00:01.000Z");
    const admitted = await reserveAIUsage(input(), store, end);
    await markAIDispatched(admitted.record.id, store, end);
    await settleAIUsage(admitted.record.id, { usage, providerResponseId: "late-month" }, store, nextMonth);
    expect((await creatorAIUsage("synthetic-creator", store, nextMonth)).used).toBe(0);
    expect((await creatorAIUsage("synthetic-creator", store, end)).used).toBe(1);
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } })).period).toBe("2026-10");
  });
  it("blocks new work after policy reduction and retains in-flight exposure", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admitted.record.id, store, now);
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: {
        policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, monthlySpendNano: 0, warningSpendNano: 0 }),
      },
    });
    await expect(reserveAIUsage(input("other", "another-creator"), secondServer, now)).rejects.toMatchObject({
      code: "USER_MONTHLY_BUDGET",
    });
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } })).exposureNano).toBe(
      exposure,
    );
  });
  it("honors suspension and disabled policy before any dispatch", async () => {
    await store.aIQuotaUserPolicy.create({
      data: {
        accountId: "synthetic-creator",
        policy: JSON.stringify({
          monthlyRequests: null,
          monthlySpendNano: null,
          advancedEnabled: null,
          requestsPerMinute: null,
          suspended: true,
          expiresAt: null,
        }),
      },
    });
    await expect(reserveAIUsage(input(), store, now)).rejects.toMatchObject({ code: "AI_SUSPENDED" });
    expect(await store.aIUsageLedger.count()).toBe(0);
  });
  it("settles idempotently but rejects contradictory receipts", async () => {
    const admitted = await reserveAIUsage(input(), store, now);
    await markAIDispatched(admitted.record.id, store, now);
    await settleAIUsage(admitted.record.id, { usage, providerResponseId: "receipt" }, store, now);
    expect(
      (await settleAIUsage(admitted.record.id, { usage, providerResponseId: "receipt" }, secondServer, now)).status,
    ).toBe("SETTLED");
    await expect(
      settleAIUsage(
        admitted.record.id,
        { usage: { ...usage, outputTokens: 501 }, providerResponseId: "receipt" },
        store,
        now,
      ),
    ).rejects.toMatchObject({ code: "SETTLEMENT_CONFLICT" });
  });
});
