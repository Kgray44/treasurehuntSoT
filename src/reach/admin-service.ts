import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import { AdmiraltyError } from "@/admiralty/errors";
import { projection } from "@/admiralty/read-models";
import type { ReachSqlStore, ReachStore } from "./admin-storage";
import {
  defaultReachRuntimePolicyEnvelope,
  reachRuntimePolicyEnvelopeSchema,
  type ReachRuntimePolicyEnvelope,
} from "./runtime-policy";
import {
  MAX_REACH_TELEMETRY_BYTES,
  reachTelemetrySubmissionSchema,
  reachTelemetryReportSchema,
  createReachTelemetryAccumulator,
  type ReachTelemetryReport,
} from "./telemetry";

export const REACH_RUNTIME_POLICY_ID = "REACH_RUNTIME_V1";
const dayMs = 86_400_000;
export const reachFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function reachStoredInteger(value: number | bigint) {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("REACH_STORED_INTEGER_INVALID");
  return result;
}
export function requireReachCapability(
  actor: Pick<AdmiraltyCurrentOperator, "capabilities">,
  capability: "CONFIG_OBSERVE" | "CONFIG_OPERATE",
) {
  if (!actor.capabilities.includes(capability))
    throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "Reach administrative authority is required.", 403);
}
export function requireReachDate(now: Date) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The report time is invalid.", 400);
}

export async function readReachRuntimePolicy(store: ReachSqlStore = db): Promise<ReachRuntimePolicyEnvelope> {
  const rows = await store.$queryRaw<
    Array<{ revision: number; policy: string }>
  >`SELECT revision, policy FROM ReachRuntimePolicy WHERE id = ${REACH_RUNTIME_POLICY_ID}`;
  if (!rows.length) return reachRuntimePolicyEnvelopeSchema.parse(defaultReachRuntimePolicyEnvelope);
  return reachRuntimePolicyEnvelopeSchema.parse({
    schemaVersion: 1,
    revision: reachStoredInteger(rows[0].revision),
    policy: JSON.parse(rows[0].policy),
  });
}

export async function purgeReachTelemetry(
  store: ReachSqlStore = db,
  now = new Date(),
  envelope?: ReachRuntimePolicyEnvelope,
) {
  requireReachDate(now);
  const policy = envelope ?? (await readReachRuntimePolicy(store));
  const cutoff = new Date(now.getTime() - policy.policy.telemetryRetentionDays * dayMs);
  return store.$executeRaw`DELETE FROM ReachTelemetryReport WHERE expiresAt <= ${now} OR receivedAt < ${cutoff}`;
}

export type ReachStoredTelemetry = { report: ReachTelemetryReport; receivedAt: string };
export async function insertReachTelemetry(input: unknown, store: ReachStore = db, now = new Date()) {
  requireReachDate(now);
  const parsed = reachTelemetrySubmissionSchema.parse(input);
  const submission = { ...parsed, idempotencyKey: parsed.idempotencyKey.toLowerCase() };
  const serialized = JSON.stringify(submission.report);
  if (Buffer.byteLength(JSON.stringify(submission), "utf8") > MAX_REACH_TELEMETRY_BYTES)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The aggregate report is too large.", 400);
  const fingerprint = reachFingerprint(submission);
  return store.$transaction(async (tx) => {
    const envelope = await readReachRuntimePolicy(tx);
    await purgeReachTelemetry(tx, now, envelope);
    if (!envelope.policy.featureEnabled || !envelope.policy.telemetryEnabled)
      return { accepted: false, duplicate: false, reason: "COLLECTION_DISABLED" as const };
    const previous = await tx.$queryRaw<
      Array<{ fingerprint: string }>
    >`SELECT fingerprint FROM ReachTelemetryReport WHERE idempotencyKey = ${submission.idempotencyKey}`;
    if (previous.length) {
      if (previous[0].fingerprint !== fingerprint)
        throw new AdmiraltyError("ADMIN_CONFLICT", "This report key already belongs to a different contribution.", 409);
      return { accepted: true, duplicate: true, reason: null };
    }
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + envelope.policy.telemetryRetentionDays * dayMs);
    await tx.$executeRaw`INSERT INTO ReachTelemetryReport (id,idempotencyKey,fingerprint,reportVersion,report,receivedAt,expiresAt) VALUES (${id},${submission.idempotencyKey},${fingerprint},${submission.reportVersion},${serialized},${now},${expiresAt})`;
    return { accepted: true, duplicate: false, reason: null };
  });
}

export async function listReachTelemetry(
  options: { from: Date; to: Date; limit?: number },
  store: ReachSqlStore = db,
  now = new Date(),
): Promise<ReachStoredTelemetry[]> {
  requireReachDate(now);
  requireReachDate(options.from);
  requireReachDate(options.to);
  if (options.to <= options.from || options.to.getTime() - options.from.getTime() > 90 * dayMs)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "Choose a reporting window of at most90 days.", 400);
  const limit = options.limit ?? 10_000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_001)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The report limit is invalid.", 400);
  await purgeReachTelemetry(store, now);
  const rows = await store.$queryRaw<
    Array<{ report: string; receivedAt: Date }>
  >`SELECT report,receivedAt FROM ReachTelemetryReport WHERE receivedAt >= ${options.from} AND receivedAt <= ${options.to} ORDER BY receivedAt DESC,id DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    report: reachTelemetryReportSchema.parse(JSON.parse(row.report)),
    receivedAt: new Date(row.receivedAt).toISOString(),
  }));
}

export async function reachPolicyHistory(store: ReachSqlStore = db, limit = 30) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The history limit is invalid.", 400);
  const rows = await store.$queryRaw<
    Array<{
      id: string;
      expectedRevision: number;
      resultingRevision: number;
      beforeState: string;
      afterState: string;
      reason: string;
      createdAt: Date;
    }>
  >`SELECT id,expectedRevision,resultingRevision,beforeState,afterState,reason,createdAt FROM ReachPolicyChange ORDER BY createdAt DESC,id DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    ...row,
    expectedRevision: reachStoredInteger(row.expectedRevision),
    resultingRevision: reachStoredInteger(row.resultingRevision),
    beforeState: reachRuntimePolicyEnvelopeSchema.parse(JSON.parse(row.beforeState)),
    afterState: reachRuntimePolicyEnvelopeSchema.parse(JSON.parse(row.afterState)),
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

export async function getReachAdminOverview(actor: AdmiraltyCurrentOperator, store: ReachStore = db, now = new Date()) {
  requireReachCapability(actor, "CONFIG_OBSERVE");
  requireReachDate(now);
  return store.$transaction(
    async (tx) => {
      const envelope = await readReachRuntimePolicy(tx);
      await purgeReachTelemetry(tx, now, envelope);
      const from = new Date(now.getTime() - envelope.policy.telemetryRetentionDays * dayMs);
      const totals = await tx.$queryRaw<
        Array<{ reports: number | bigint }>
      >`SELECT COUNT(*) AS reports FROM ReachTelemetryReport WHERE receivedAt >= ${from} AND receivedAt <= ${now}`;
      const expected = reachStoredInteger(totals[0].reports),
        accumulator = createReachTelemetryAccumulator();
      const pageSize = 1000;
      let processed = 0,
        pagesRead = 0,
        cursor: { receivedAt: Date; id: string } | null = null;
      type Row = { id: string; report: string; receivedAt: Date };
      while (processed < expected) {
        const page: Row[] = cursor
          ? await tx.$queryRaw<
              Row[]
            >`SELECT id,report,receivedAt FROM ReachTelemetryReport WHERE receivedAt >= ${from} AND receivedAt <= ${now} AND (receivedAt < ${cursor.receivedAt} OR (receivedAt = ${cursor.receivedAt} AND id < ${cursor.id})) ORDER BY receivedAt DESC,id DESC LIMIT ${pageSize}`
          : await tx.$queryRaw<
              Row[]
            >`SELECT id,report,receivedAt FROM ReachTelemetryReport WHERE receivedAt >= ${from} AND receivedAt <= ${now} ORDER BY receivedAt DESC,id DESC LIMIT ${pageSize}`;
        pagesRead++;
        if (!page.length || page.length > pageSize || processed + page.length > expected)
          throw new Error("REACH_REPORT_SNAPSHOT_MISMATCH");
        for (const row of page) accumulator.add(JSON.parse(row.report));
        const last = page.at(-1)!;
        const next = { receivedAt: new Date(last.receivedAt), id: last.id };
        if (
          !Number.isFinite(next.receivedAt.getTime()) ||
          (cursor &&
            (next.receivedAt > cursor.receivedAt ||
              (next.receivedAt.getTime() === cursor.receivedAt.getTime() && next.id >= cursor.id)))
        )
          throw new Error("REACH_REPORT_CURSOR_INVALID");
        cursor = next;
        processed += page.length;
      }
      const summary = accumulator.finish();
      if (summary.totalReports !== expected || processed !== expected)
        throw new Error("REACH_REPORT_SNAPSHOT_MISMATCH");
      return projection(
        "Reach automatic numeric aggregate store + Reach runtime policy",
        {
          envelope,
          reporting: {
            state: expected ? "AVAILABLE" : "NO_REPORTS",
            collectionEnabled: envelope.policy.featureEnabled && envelope.policy.telemetryEnabled,
            coverage: {
              from: from.toISOString(),
              to: now.toISOString(),
              returnedReports: processed,
              totalReports: expected,
              truncated: false,
              distinctPeople: null,
              distinctSessions: null,
              pagesRead,
              pageSize,
            },
            summary,
          },
          history: await reachPolicyHistory(tx),
        },
        { observedAt: now, state: "HEALTHY" },
      );
    },
    { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 },
  );
}
