// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { aiEconomicsOverview, aiEconomicsHistory, aiEconomicsOperation } from "./ai-economics";
import { reserveAIUsage, markAIDispatched, settleAIUsage, failAIUsage, AI_CONTROL_ID } from "./ai-ledger";
import { beginAIProviderRetry, reconcileAIProviderAttempt } from "./ai-attempts";
import { defaultAIGlobalPolicy, aiPricing, effectiveAIUserPolicy } from "./ai-policy";
import { recordAIPreviewDecision, recordAICanonicalSave } from "./ai-outcomes";
import { seedAIEconomicsFixture } from "../../scripts/admiralty/ai-economics-fixture";

const root = mkdtempSync(join(tmpdir(), "admiralty-economics-"));
const url = `file:${join(root, "ledger.sqlite").replaceAll("\\", "/")}`;
const store = new PrismaClient({ datasources: { db: { url } } });
const other = new PrismaClient({ datasources: { db: { url } } });
const now = new Date("2026-10-14T16:00:00Z");
const filter = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-11-01T00:00:00Z") };
const usage = { inputTokens: 1000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 700, reasoningTokens: 0 };
const request = (id: string) => ({
  accountId: "A",
  requestId: id,
  idempotencyKey: `synthetic-key-${id}`,
  fingerprint: id,
  definitionId: "synthetic-owned-room",
  operationCategory: "AUTHORING",
  mode: "STANDARD" as const,
});
beforeAll(async () => {
  for (const file of [
    "20261011180000_parallax_a1_ai_quotas",
    "20261011210000_parallax_a1_application_receipt",
    "20261015010000_admiralty_ai_economics",
  ])
    for (const sql of readFileSync(resolve(`prisma/migrations/${file}/migration.sql`), "utf8")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean))
      await store.$executeRawUnsafe(sql);
  await store.$executeRawUnsafe('CREATE TABLE "UserAccount" ("id" TEXT PRIMARY KEY)');
  await store.$executeRawUnsafe(
    'CREATE TABLE "PlayerProfile" ("id" TEXT PRIMARY KEY, "accountId" TEXT UNIQUE, "displayName" TEXT)',
  );
  for (const name of ["A", "B", "C", "D", "E"]) {
    await store.$executeRawUnsafe('INSERT INTO "UserAccount" ("id") VALUES (?)', name);
    await store.$executeRawUnsafe(
      'INSERT INTO "PlayerProfile" ("id", "accountId", "displayName") VALUES (?, ?, ?)',
      `profile-${name}`,
      name,
      `Creator ${name}`,
    );
  }
});
beforeEach(async () => {
  await store.aIProviderAttempt.deleteMany();
  await store.aIUsageLedger.deleteMany();
  await store.aIQuotaUserPolicy.deleteMany();
  await store.aIQuotaControl.deleteMany();
  await store.aIQuotaControl.create({
    data: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
});
afterAll(async () => {
  await store.$disconnect();
  await other.$disconnect();
  if (resolve(root).startsWith(resolve(tmpdir()))) rmSync(root, { recursive: true, force: true });
});
describe("Capability economics over real isolated SQLite", () => {
  it("distinguishes Creators A-E, true acceptance, retry costs and unresolved exposure", async () => {
    const seeded = await seedAIEconomicsFixture(store, { A: "A", B: "B", C: "C", D: "D", E: "E" }, now);
    const result = await aiEconomicsOverview(filter, store);
    expect(result.totals.operations).toBe(seeded.operations);
    expect(result.totals.providerAttempts).toBe(seeded.attempts);
    expect(result.totals.retriedOperations).toBe(1);
    expect(result.totals.unresolvedOperations).toBe(2);
    expect(result.totals.unresolvedExposureNano).toBe("200000000");
    expect(result.totals.confirmedCostNano).toBeNull();
    expect(result.people.find((person) => person.accountId === "A")).toMatchObject({
      reconstructions: 40,
      accepted: 2,
      acceptanceRate: 0.05,
    });
    expect(result.people.find((person) => person.accountId === "A")!.investigation).toContain(
      "does not establish a cause",
    );
    expect(result.people.find((person) => person.accountId === "B")).toMatchObject({
      accepted: 10,
      acceptanceRate: 1,
      investigation: null,
    });
    const rooms = result.capabilities.find((item) => item.id === "ROOM_RECONSTRUCTION")!;
    expect(rooms.successRate).toBe(12 / 50);
    expect(rooms.costPerUsefulResultNano).toBe("266666667");
    const first = await aiEconomicsHistory(filter, { take: 10 }, store);
    const second = await aiEconomicsHistory(filter, { take: 10, cursor: first.nextCursor! }, store);
    expect(new Set([...first.records, ...second.records].map((item) => item.id)).size).toBe(20);
    const costly = await aiEconomicsHistory(filter, { take: 10, sort: "COST_HIGHEST" }, store);
    expect(costly.records.every((item) => item.capabilityId === "ROOM_RECONSTRUCTION")).toBe(true);
    expect((await aiEconomicsHistory({ ...filter, costBasis: "UNKNOWN" }, { take: 100 }, store)).records).toHaveLength(
      2,
    );
    const detail = await aiEconomicsOperation(first.records[0].id, store);
    expect(JSON.stringify(detail)).not.toContain("fingerprint");
    expect(detail).not.toHaveProperty("result");
  });
  it("preserves fractional-cent usage, versions and delayed failed-attempt reconciliation", async () => {
    const admission = await reserveAIUsage(request("failed"), store, now);
    await markAIDispatched(admission.record.id, store, now);
    await failAIUsage(admission.record.id, "UPSTREAM_TIMEOUT", false, store, now);
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: {
        policy: JSON.stringify({
          ...defaultAIGlobalPolicy,
          enabled: true,
          pricingVersions: [
            {
              ...aiPricing["gpt-6-luna"],
              revision: "new-price",
              effectiveAt: "2026-10-14T00:00:00.000Z",
              inputNanoPerToken: 10000,
            },
          ],
        }),
      },
    });
    const reconciled = await reconcileAIProviderAttempt(
      `${admission.record.id}:1`,
      { providerResponseId: "response-one", usage },
      store,
      now,
    );
    expect(reconciled.settledCostNano).toBe(BigInt(450000));
    expect(reconciled.outcome).toBe("TIMEOUT");
    await reconcileAIProviderAttempt(
      `${admission.record.id}:1`,
      { providerResponseId: "response-one", usage },
      other,
      now,
    );
    expect(await store.aIProviderAttempt.count()).toBe(1);
    const confirmed = await reconcileAIProviderAttempt(
      `${admission.record.id}:1`,
      { providerResponseId: "response-one", confirmedCostNano: "451234" },
      store,
      now,
    );
    expect(confirmed.confirmedCostNano).toBe(BigInt(451234));
    await expect(
      reconcileAIProviderAttempt(
        `${admission.record.id}:1`,
        { providerResponseId: "response-one", confirmedCostNano: "451235" },
        store,
        now,
      ),
    ).rejects.toMatchObject({ code: "SETTLEMENT_CONFLICT" });
  });
  it("counts one logical operation and every explicitly reserved retry attempt", async () => {
    const admitted = await reserveAIUsage(request("retry"), store, now);
    await markAIDispatched(admitted.record.id, store, now);
    await settleAIUsage(
      admitted.record.id,
      { usage, providerResponseId: "first", result: { status: "FAILED", code: "INCOMPLETE_OUTPUT" } },
      store,
      now,
    );
    const retry = await beginAIProviderRetry(admitted.record.id, store, new Date(now.getTime() + 61000));
    await reconcileAIProviderAttempt(retry.id, { usage, providerResponseId: "second" }, store, now);
    expect(await store.aIUsageLedger.count()).toBe(1);
    expect(await store.aIProviderAttempt.count()).toBe(2);
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } })).settledCostNano).toBe(
      BigInt(900000),
    );
  });
  it("keeps omitted usage dimensions unknown and separates estimated cost until reconciliation", async () => {
    const admission = await reserveAIUsage(request("partial-usage"), store, now);
    await markAIDispatched(admission.record.id, store, now);
    const reportedUsage = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      reasoningTokens: null,
    };
    const estimated = await settleAIUsage(
      admission.record.id,
      { usage, reportedUsage, providerResponseId: "partial-response" },
      store,
      now,
    );
    expect(estimated.costBasis).toBe("ESTIMATED");
    expect(estimated.cachedInputTokens).toBeNull();
    expect(estimated.reasoningTokens).toBeNull();
    expect(JSON.parse((await store.aIProviderAttempt.findFirstOrThrow()).usage!).cachedInputTokens).toBeNull();
    const overview = await aiEconomicsOverview(filter, store);
    expect(overview.totals.estimatedCostNano).toBe("475000");
    await reconcileAIProviderAttempt(
      `${admission.record.id}:1`,
      { usage, providerResponseId: "partial-response" },
      store,
      now,
    );
    const settled = await aiEconomicsOverview(filter, store);
    expect(settled.totals.estimatedCostNano).toBe("0");
    expect(settled.totals.calculatedCostNano).toBe("450000");
  });
  it("enforces capability overrides and simultaneous reservations without removing inherited access", async () => {
    const inherited = effectiveAIUserPolicy({ ...defaultAIGlobalPolicy, enabled: true }, null, now);
    expect(inherited.capabilities.GROUNDED_ASSISTANT_EDIT.enabled).toBe(true);
    expect(inherited.capabilities.ADVANCED_ASSISTANT.enabled).toBe(false);
    await store.aIQuotaUserPolicy.create({
      data: {
        accountId: "A",
        policy: JSON.stringify({
          monthlyRequests: null,
          monthlySpendNano: null,
          advancedEnabled: null,
          requestsPerMinute: null,
          suspended: false,
          expiresAt: null,
          capabilityPolicies: {
            GROUNDED_ASSISTANT_EDIT: { monthlyRequests: 1 },
            ROOM_RECONSTRUCTION: { enabled: false },
          },
        }),
      },
    });
    const results = await Promise.allSettled([
      reserveAIUsage(request("concurrent1"), store, now),
      reserveAIUsage(request("concurrent2"), other, now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(
      reserveAIUsage({ ...request("room-denied"), operationCategory: "ROOM_RECONSTRUCTION" }, store, now),
    ).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
  });
  it("does not infer acceptance from settlement, previews, rejection or incomplete history", async () => {
    const admitted = await reserveAIUsage(
      { ...request("preview"), operationCategory: "ROOM_RECONSTRUCTION" },
      store,
      now,
    );
    await markAIDispatched(admitted.record.id, store, now);
    await settleAIUsage(
      admitted.record.id,
      { usage, providerResponseId: "preview-response", result: { status: "PROPOSED" } },
      store,
      now,
    );
    await recordAIPreviewDecision("A", "preview", "PREVIEWED", store, now);
    await recordAIPreviewDecision("A", "preview", "REJECTED", store, now);
    await recordAIPreviewDecision("A", "preview", "PREVIEWED", store, now);
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admitted.record.id } })).outcome).toBe(
      "REJECTED",
    );
    await expect(recordAIPreviewDecision("B", "preview", "REJECTED", store, now)).rejects.toMatchObject({
      status: 404,
    });
    const overview = await aiEconomicsOverview(filter, store);
    expect(overview.capabilities[0]).toMatchObject({
      generated: 1,
      previewed: 1,
      rejected: 1,
      usefulResults: 0,
      costPerUsefulResultNano: null,
    });
    await store.aIUsageLedger.update({
      where: { id: admitted.record.id },
      data: { capabilityVersion: null, outcome: "UNKNOWN" },
    });
    const historical = await aiEconomicsOverview(filter, store);
    expect(historical.capabilities[0].successRate).toBeNull();
    expect(historical.totals.historicalIncompleteOperations).toBe(1);
  });
  it("records later room editing and a verified canonical undo independently of billing", async () => {
    const admission = await reserveAIUsage(request("applied"), store, now);
    await store.aIUsageLedger.update({
      where: { id: admission.record.id },
      data: {
        outcome: "APPLIED",
        appliedAt: now,
        outcomeEvidence: JSON.stringify({ previousChecksum: "before-apply" }),
      },
    });
    await store.$transaction((tx) => recordAICanonicalSave(tx, "A", "synthetic-owned-room", null, "before-apply", now));
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admission.record.id } })).outcome).toBe(
      "UNDONE",
    );
    await store.aIUsageLedger.update({
      where: { id: admission.record.id },
      data: {
        outcome: "ACCEPTED",
        acceptedResourceId: "synthetic-owned-room",
        acceptedVersion: "old-room",
        acceptedAt: now,
      },
    });
    await store.$transaction((tx) =>
      recordAICanonicalSave(tx, "A", "synthetic-owned-room", "new-room", "new-scene", now),
    );
    expect((await store.aIUsageLedger.findUniqueOrThrow({ where: { id: admission.record.id } })).outcome).toBe(
      "ACCEPTED_THEN_EDITED",
    );
  });
  it("rechecks a reserved model against a later capability restriction", async () => {
    const admitted = await reserveAIUsage(request("reserved-model"), store, now);
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: {
        policy: JSON.stringify({
          ...defaultAIGlobalPolicy,
          enabled: true,
          standardModel: "gpt-6.1-sol",
          capabilityPolicies: { GROUNDED_ASSISTANT_EDIT: { allowedModels: ["gpt-6.1-sol"] } },
        }),
      },
    });
    await expect(markAIDispatched(admitted.record.id, store, now)).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
    expect(await store.aIProviderAttempt.count()).toBe(0);
  });
  it("preserves a genuinely saved outcome when delayed cost usage arrives", async () => {
    const admitted = await reserveAIUsage(
      { ...request("late-usage"), operationCategory: "ROOM_RECONSTRUCTION" },
      store,
      now,
    );
    await markAIDispatched(admitted.record.id, store, now);
    await failAIUsage(admitted.record.id, "UNKNOWN_PROVIDER_USAGE", false, store, now, {
      result: { status: "PROPOSED" },
      timings: {},
      providerResponseId: "late-response",
    });
    await store.aIUsageLedger.update({
      where: { id: admitted.record.id },
      data: {
        outcome: "ACCEPTED",
        acceptedAt: now,
        acceptedResourceId: "canonical-room",
        acceptedVersion: "owner-version",
      },
    });
    const settled = await settleAIUsage(
      admitted.record.id,
      {
        usage,
        providerResponseId: "late-response",
        result: { status: "PROPOSED" },
      },
      store,
      now,
    );
    expect(settled.outcome).toBe("ACCEPTED");
    const overview = await aiEconomicsOverview(filter, store);
    expect(overview.capabilities[0].usefulResults).toBe(1);
    expect(overview.totals.failedProviderAttempts).toBe(0);
  });
});
