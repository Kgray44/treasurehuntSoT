import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";

export type ReachSqlStore = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
export type ReachStore = ReachSqlStore & Pick<PrismaClient, "$transaction">;

/** Explicit local-fixture bootstrap only; never called by an HTTP request. */
export async function initializeReachSqliteStorage(store: ReachSqlStore, databaseUrl: string) {
  const target = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)).replaceAll("\\", "/") : "";
  const owned = "D:/CodexRuntime/reach-edge-motion-20261017/";
  if (!target.toLowerCase().startsWith(owned.toLowerCase())) throw new Error("REACH_TASK_DATABASE_REQUIRED");
  const databases = await store.$queryRaw<Array<{ name: string; file: string }>>`PRAGMA database_list`;
  const actual = databases.find((database) => database.name === "main")?.file;
  if (!actual || path.resolve(actual).replaceAll("\\", "/").toLowerCase() !== target.toLowerCase())
    throw new Error("REACH_TASK_DATABASE_MISMATCH");
  const statements = [
    "CREATE TABLE IF NOT EXISTS ReachRuntimePolicy (id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, policy TEXT NOT NULL, updatedAt DATETIME NOT NULL)",
    "CREATE TABLE IF NOT EXISTS ReachPolicyPreview (id TEXT PRIMARY KEY NOT NULL, actorAccountId TEXT NOT NULL, accountSessionId TEXT NOT NULL, fingerprint TEXT NOT NULL, expectedRevision INTEGER NOT NULL, expiresAt DATETIME NOT NULL, usedAt DATETIME, createdAt DATETIME NOT NULL)",
    "CREATE INDEX IF NOT EXISTS ReachPolicyPreview_expiresAt_idx ON ReachPolicyPreview(expiresAt)",
    "CREATE TABLE IF NOT EXISTS ReachPolicyChange (id TEXT PRIMARY KEY NOT NULL, actorAccountId TEXT NOT NULL, accountSessionId TEXT NOT NULL, idempotencyKey TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, expectedRevision INTEGER NOT NULL, resultingRevision INTEGER NOT NULL, beforeState TEXT NOT NULL, afterState TEXT NOT NULL, reason TEXT NOT NULL, correlationId TEXT NOT NULL, createdAt DATETIME NOT NULL)",
    "CREATE INDEX IF NOT EXISTS ReachPolicyChange_createdAt_idx ON ReachPolicyChange(createdAt)",
    "CREATE TABLE IF NOT EXISTS ReachTelemetryReport (id TEXT PRIMARY KEY NOT NULL, idempotencyKey TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, reportVersion INTEGER NOT NULL, report TEXT NOT NULL, receivedAt DATETIME NOT NULL, expiresAt DATETIME NOT NULL)",
    "CREATE INDEX IF NOT EXISTS ReachTelemetryReport_receivedAt_idx ON ReachTelemetryReport(receivedAt)",
    "CREATE INDEX IF NOT EXISTS ReachTelemetryReport_expiresAt_idx ON ReachTelemetryReport(expiresAt)",
  ];
  for (const statement of statements) await store.$executeRaw(Prisma.raw(statement));
}
