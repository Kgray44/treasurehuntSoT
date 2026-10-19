// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import { initializeReachSqliteStorage } from "./admin-storage";
import { defaultReachRuntimePolicy, reachRuntimePolicyEnvelopeSchema } from "./runtime-policy";
import { executeReachRuntimePolicy, previewReachRuntimePolicy, reachRuntimePolicyPort } from "./admin-commands";
import {
  getReachAdminOverview,
  insertReachTelemetry,
  listReachTelemetry,
  readReachRuntimePolicy,
  reachPolicyHistory,
} from "./admin-service";
import { createReachTelemetryReport } from "./telemetry";

const directory = mkdtempSync("D:/CodexRuntime/reach-edge-motion-20261017/admin-storage-test-");
const url = `file:${directory.replaceAll("\\", "/")}/fixture.sqlite`;
const store = new PrismaClient({ datasources: { db: { url } } });
const now = new Date("2026-10-17T23:00:00Z");
const actor: AdmiraltyCurrentOperator = {
  accountId: "synthetic-reach-admin",
  accountSessionId: "synthetic-reach-session",
  displayName: "Synthetic operator",
  roles: ["ADMINISTRATOR"],
  capabilities: ["CONFIG_OBSERVE", "CONFIG_OPERATE"],
  csrfToken: "synthetic-csrf",
  sessionExpiresAt: new Date(now.getTime() + 3600000),
  authorizationBasis: "ROLE_CAPABILITY:ADMINISTRATOR",
};
const input = (change = {}) => ({
  expectedRevision: 0,
  policy: { ...defaultReachRuntimePolicy },
  reason: "Set the bounded synthetic Reach policy",
  idempotencyKey: "synthetic-reach-policy-command",
  ...change,
});
const submission = () => ({
  idempotencyKey: randomUUID(),
  reportVersion: 1,
  report: createReachTelemetryReport(),
});
async function update(change = {}) {
  const command = input(change),
    preview = await previewReachRuntimePolicy(actor, command, store, now);
  return executeReachRuntimePolicy(actor, command, preview.previewId, store, now);
}

beforeAll(async () => {
  await initializeReachSqliteStorage(store, url);
  await store.$executeRaw(
    Prisma.raw(
      "CREATE TABLE PlatformAuditEvent (id TEXT PRIMARY KEY NOT NULL, actorType TEXT NOT NULL, actorId TEXT, actorAccountId TEXT, action TEXT NOT NULL, resourceType TEXT NOT NULL, resourceId TEXT NOT NULL, outcome TEXT NOT NULL DEFAULT 'SUCCEEDED', correlationId TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
  );
});
beforeEach(async () => {
  for (const name of [
    "ReachRuntimePolicy",
    "ReachPolicyPreview",
    "ReachPolicyChange",
    "ReachTelemetryReport",
    "PlatformAuditEvent",
  ])
    await store.$executeRaw(Prisma.raw(`DELETE FROM ${name}`));
});
afterAll(async () => {
  await store.$disconnect();
  if (directory.startsWith("D:/CodexRuntime/reach-edge-motion-20261017/admin-storage-test-"))
    rmSync(directory, { recursive: true });
});

describe("Reach owner policy and automatic numeric storage in an isolated existing-client database", () => {
  it("returns real defaults and genuine empty reporting, not unavailable data", async () => {
    expect(await readReachRuntimePolicy(store)).toEqual({
      schemaVersion: 1,
      revision: 0,
      policy: defaultReachRuntimePolicy,
    });
    const result = await getReachAdminOverview(actor, store, now);
    expect(result.state).toBe("HEALTHY");
    expect(result.data?.reporting).toMatchObject({
      state: "NO_REPORTS",
      coverage: { totalReports: 0, distinctPeople: null, distinctSessions: null },
    });
    expect(result.data?.reporting.summary?.fractions.acceptedModelPackets.fraction).toBeNull();
  });
  it("requires exact actor/session/input-bound preview and preserves policy/history/audit atomically", async () => {
    const command = input(),
      preview = await previewReachRuntimePolicy(actor, command, store, now);
    await expect(executeReachRuntimePolicy(actor, command, randomUUID(), store, now)).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
    });
    await expect(
      executeReachRuntimePolicy({ ...actor, accountSessionId: "other" }, command, preview.previewId, store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await expect(
      executeReachRuntimePolicy(
        actor,
        { ...command, policy: { ...command.policy, normalMaximumHz: 10 } },
        preview.previewId,
        store,
        now,
      ),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    const result = await executeReachRuntimePolicy(actor, command, preview.previewId, store, now);
    expect(result).toMatchObject({ idempotent: false, envelope: { revision: 1 } });
    expect(await executeReachRuntimePolicy(actor, command, preview.previewId, store, now)).toEqual({
      ...result,
      idempotent: true,
    });
    expect(await reachPolicyHistory(store)).toHaveLength(1);
    expect(await store.platformAuditEvent.count()).toBe(1);
    expect(reachRuntimePolicyEnvelopeSchema.parse(await readReachRuntimePolicy(store)).revision).toBe(1);
  });
  it("rejects expired previews, stale revisions and unauthorized capabilities", async () => {
    const command = input(),
      preview = await previewReachRuntimePolicy(actor, command, store, now);
    await expect(
      executeReachRuntimePolicy(actor, command, preview.previewId, store, new Date(now.getTime() + 600000)),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await update();
    await expect(
      previewReachRuntimePolicy(actor, input({ idempotencyKey: "another-synthetic-policy-key" }), store, now),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
    await expect(
      previewReachRuntimePolicy({ ...actor, capabilities: ["CONFIG_OBSERVE"] }, input(), store, now),
    ).rejects.toMatchObject({ code: "ADMIRALTY_CAPABILITY_DENIED" });
    await expect(getReachAdminOverview({ ...actor, capabilities: [] }, store, now)).rejects.toMatchObject({
      code: "ADMIRALTY_CAPABILITY_DENIED",
    });
  });
  it("rolls back policy, preview use and receipt if canonical audit fails", async () => {
    const preview = await previewReachRuntimePolicy(actor, input(), store, now);
    await store.$executeRaw(
      Prisma.raw(
        "CREATE TRIGGER synthetic_reach_audit_failure BEFORE INSERT ON PlatformAuditEvent BEGIN SELECT RAISE(ABORT,'synthetic audit unavailable'); END",
      ),
    );
    try {
      await expect(executeReachRuntimePolicy(actor, input(), preview.previewId, store, now)).rejects.toThrow();
    } finally {
      await store.$executeRaw(Prisma.raw("DROP TRIGGER synthetic_reach_audit_failure"));
    }
    expect((await readReachRuntimePolicy(store)).revision).toBe(0);
    expect(await reachPolicyHistory(store)).toHaveLength(0);
    expect((await executeReachRuntimePolicy(actor, input(), preview.previewId, store, now)).envelope.revision).toBe(1);
  });
  it("keeps compensating revisions monotonic and rejects changed idempotent requests", async () => {
    await update({ policy: { ...defaultReachRuntimePolicy, normalMaximumHz: 10 } });
    await expect(update({ policy: { ...defaultReachRuntimePolicy, normalMaximumHz: 20 } })).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
    });
    await update({ expectedRevision: 1, idempotencyKey: "synthetic-reach-restore-policy" });
    expect(await readReachRuntimePolicy(store)).toMatchObject({ revision: 2, policy: { normalMaximumHz: 15 } });
    expect(await reachPolicyHistory(store)).toHaveLength(2);
  });
  it("only persists strict versioned numbers, deduplicates retries and never accepts payload identity", async () => {
    const report = submission();
    await expect(insertReachTelemetry({ ...report, reportVersion: 2 }, store, now)).rejects.toThrow();
    await expect(insertReachTelemetry({ ...report, accountId: actor.accountId }, store, now)).rejects.toThrow();
    await expect(
      insertReachTelemetry({ ...report, report: { ...report.report, landmarks: [] } }, store, now),
    ).rejects.toThrow();
    expect(await insertReachTelemetry(report, store, now)).toMatchObject({
      accepted: true,
      duplicate: false,
    });
    expect(await insertReachTelemetry(report, store, now)).toMatchObject({
      accepted: true,
      duplicate: true,
    });
    const changed = structuredClone(report);
    changed.report.events.pauses = 1;
    await expect(insertReachTelemetry(changed, store, now)).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
    });
    expect(await listReachTelemetry({ from: new Date(now.getTime() - 1), to: now }, store, now)).toHaveLength(1);
  });
  it.each(["featureEnabled", "telemetryEnabled"] as const)(
    "mandatory %s off blocks new uploads without erasing existing numeric data",
    async (field) => {
      await insertReachTelemetry(submission(), store, now);
      await update({ policy: { ...defaultReachRuntimePolicy, [field]: false } });
      expect(await insertReachTelemetry(submission(), store, now)).toMatchObject({
        accepted: false,
        reason: "COLLECTION_DISABLED",
      });
      const result = await getReachAdminOverview(actor, store, now);
      expect(result.data?.reporting).toMatchObject({
        collectionEnabled: false,
        state: "AVAILABLE",
        coverage: { totalReports: 1 },
      });
    },
  );
  it("counts report windows without inventing users or retaining identity", async () => {
    await insertReachTelemetry(submission(), store, now);
    await insertReachTelemetry(submission(), store, now);
    await insertReachTelemetry(submission(), store, now);
    const result = await getReachAdminOverview(actor, store, now);
    expect(result.data?.reporting.coverage).toMatchObject({
      totalReports: 3,
      distinctPeople: null,
      distinctSessions: null,
    });
    expect(JSON.stringify(result)).not.toContain(actor.accountId);
  });
  it("enforces original expiry and immediate shortened-retention purge without extending older reports", async () => {
    await insertReachTelemetry(submission(), store, now);
    const later = new Date(now.getTime() + 8 * 86400000);
    const command = input({ policy: { ...defaultReachRuntimePolicy, telemetryRetentionDays: 7 } });
    const preview = await previewReachRuntimePolicy(actor, command, store, later);
    await executeReachRuntimePolicy(actor, command, preview.previewId, store, later);
    expect((await getReachAdminOverview(actor, store, later)).data?.reporting.coverage.totalReports).toBe(0);
    await insertReachTelemetry(submission(), store, later);
    expect(
      await listReachTelemetry(
        { from: later, to: new Date(later.getTime() + 7 * 86400000) },
        store,
        new Date(later.getTime() + 7 * 86400000),
      ),
    ).toHaveLength(0);
  });
  it("fails unavailable storage rather than converting a database failure to zero/default", async () => {
    const unavailable = {
      $transaction: async () => {
        throw new Error("synthetic storage unavailable");
      },
      $queryRaw: async () => {
        throw new Error("synthetic storage unavailable");
      },
      $executeRaw: store.$executeRaw.bind(store),
    } as unknown as typeof store;
    await expect(readReachRuntimePolicy(unavailable)).rejects.toThrow("synthetic storage unavailable");
    await expect(getReachAdminOverview(actor, unavailable, now)).rejects.toThrow("synthetic storage unavailable");
  });
  it("refuses fixture DDL for a claimed or actual non-owned database", async () => {
    await expect(initializeReachSqliteStorage(store, "file:C:/unrelated.sqlite")).rejects.toThrow(
      "REACH_TASK_DATABASE_REQUIRED",
    );
    await expect(
      initializeReachSqliteStorage(store, "file:D:/CodexRuntime/reach-edge-motion-20261017/other.sqlite"),
    ).rejects.toThrow("REACH_TASK_DATABASE_MISMATCH");
  });
  it("provides the canonical high-risk command port without bypassing owner preview", async () => {
    const command = {
      commandId: randomUUID(),
      commandType: "REACH_RUNTIME_POLICY_UPDATE",
      actorAccountId: actor.accountId,
      targetType: "ReachRuntimePolicy",
      targetId: "REACH_RUNTIME_V1",
      reason: input().reason,
      idempotencyKey: input().idempotencyKey,
      requestedAt: now.toISOString(),
      input: { expectedRevision: 0, policy: { ...defaultReachRuntimePolicy } },
    };
    const port = reachRuntimePolicyPort(actor, undefined, store),
      preview = await port.preview(command);
    expect(preview).toMatchObject({
      requiredCapability: "CONFIG_OPERATE",
      risk: "HIGH",
      reauthenticationRequired: true,
    });
    await expect(port.execute(command, preview)).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
  });
});
