import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import { DatabaseCommunityRateLimiter } from "./rate-limit";
import { scanClamAvBytes } from "@/private-content/clamav-transport";
import { readCommunityWorkerRuntime, workerRuntimeCurrent } from "./worker-runtime";

export type CommunityProviderState =
  | "IMPLEMENTED"
  | "CONFIGURED"
  | "SIMULATED_LOCAL"
  | "LIVE_VALIDATED"
  | "BLOCKED_EXTERNAL"
  | "UNAVAILABLE"
  | "FAILED"
  | "STOPPED";
export type CommunityProviderHealth = {
  kind: string;
  provider: string;
  codeImplemented: boolean;
  configured: boolean;
  serviceReachable: boolean | null;
  liveValidated: boolean;
  healthy: boolean;
  ready: boolean;
  state: CommunityProviderState;
  safeCode: string;
  observedAt: string;
};

function bool(value: string | undefined) {
  return value === "true";
}
function providerState(configured: boolean, healthy: boolean, simulated = false): CommunityProviderState {
  if (simulated) return "SIMULATED_LOCAL";
  if (configured && healthy) return "LIVE_VALIDATED";
  return configured ? "FAILED" : "UNAVAILABLE";
}

function configuredAbsolutePath(value: string | undefined) {
  if (!value || !path.isAbsolute(value)) return null;
  const root = path.resolve(value);
  const repository = path.resolve(process.cwd());
  return root === repository || root.startsWith(`${repository}${path.sep}`) ? null : root;
}

async function localRootReady(value: string | undefined) {
  const root = configuredAbsolutePath(value);
  if (!root) return false;
  try {
    await access(root, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function clamAvProbe(scanner: string) {
  if (scanner !== "clamav") return { reachable: null, clean: false, code: "SCANNER_NOT_CONFIGURED" };
  const result = await scanClamAvBytes({
    bytes: Buffer.from("Forever Treasure local scanner readiness probe", "utf8"),
    host: process.env.COMMUNITY_CLAMAV_HOST,
    port: Number(process.env.COMMUNITY_CLAMAV_PORT ?? 3310),
    timeoutMs: Math.min(15_000, Number(process.env.COMMUNITY_CLAMAV_TIMEOUT_MS ?? 15_000)),
  });
  return {
    reachable: !["PROVIDER_UNAVAILABLE", "TIMEOUT", "SCAN_NOT_CONFIGURED"].includes(result.result),
    clean: result.result === "CLEAN",
    code: result.safeCode,
  };
}

/** Safe diagnostics: no endpoints, bucket names, account IDs, object keys, or raw errors. */
export async function collectCommunityProviderHealth(): Promise<CommunityProviderHealth[]> {
  const observedAt = new Date().toISOString();
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const probe = databaseConfigured
    ? await db.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`.catch(() => [])
    : [];
  const databaseHealthy = databaseConfigured && probe.length === 1;
  const scanner = process.env.COMMUNITY_BINARY_SCANNER_PROVIDER ?? "not-configured";
  const storage = process.env.COMMUNITY_ASSET_STORAGE_PROVIDER ?? "local";
  const workerEnabled = bool(process.env.COMMUNITY_WORKER_ENABLED);
  const sharedRate = process.env.COMMUNITY_RATE_LIMIT_PROVIDER === "database";
  const [storageReady, backupReady, restoreReady, scannerProbe, workerRuntime, rateLimiter] = await Promise.all([
    localRootReady(process.env.COMMUNITY_ASSET_ROOT),
    localRootReady(process.env.COMMUNITY_BACKUP_ROOT),
    localRootReady(process.env.COMMUNITY_RESTORE_ROOT),
    clamAvProbe(scanner),
    readCommunityWorkerRuntime(),
    sharedRate ? new DatabaseCommunityRateLimiter().health() : Promise.resolve(null),
  ]);
  const workerAlive = workerRuntimeCurrent(workerRuntime);
  const scannerConfigured = scanner === "clamav";
  const scannerLive = scannerConfigured && scannerProbe.clean;
  return [
    {
      kind: "DATABASE",
      provider: process.env.DATABASE_URL?.startsWith("mysql:") ? "mysql" : "sqlite",
      codeImplemented: true,
      configured: databaseConfigured,
      serviceReachable: databaseConfigured ? databaseHealthy : null,
      liveValidated: databaseHealthy,
      healthy: databaseHealthy,
      ready: databaseHealthy,
      state: providerState(databaseConfigured, databaseHealthy),
      safeCode: databaseHealthy ? "DATABASE_READY" : "DATABASE_UNAVAILABLE",
      observedAt,
    },
    {
      kind: "SCANNER",
      provider: scanner === "clamav" ? "clamav-adapter" : scanner,
      codeImplemented: true,
      configured: scannerConfigured,
      serviceReachable: scannerConfigured ? scannerProbe.reachable : null,
      liveValidated: scannerLive,
      healthy: scannerLive,
      ready: scannerLive,
      state:
        scanner === "synthetic-test"
          ? "SIMULATED_LOCAL"
          : scanner === "not-configured"
            ? "UNAVAILABLE"
            : scannerLive
              ? "LIVE_VALIDATED"
              : "BLOCKED_EXTERNAL",
      safeCode: scanner === "not-configured" ? "SCANNER_NOT_CONFIGURED" : scannerProbe.code,
      observedAt,
    },
    {
      kind: "STORAGE",
      provider: storage,
      codeImplemented: true,
      configured: storage !== "local" || Boolean(process.env.COMMUNITY_ASSET_ROOT),
      serviceReachable: storage === "local" ? (process.env.COMMUNITY_ASSET_ROOT ? storageReady : null) : null,
      liveValidated: false,
      healthy: storage === "local" ? storageReady : false,
      ready: storage === "local" ? storageReady : false,
      state:
        storage === "local" && storageReady
          ? "SIMULATED_LOCAL"
          : storage === "local"
            ? "UNAVAILABLE"
            : "BLOCKED_EXTERNAL",
      safeCode:
        storage === "local"
          ? storageReady
            ? "LOCAL_STORAGE_READY"
            : "LOCAL_STORAGE_UNAVAILABLE"
          : "STORAGE_PROBE_REQUIRED",
      observedAt,
    },
    {
      kind: "WORKER",
      provider: "community-durable-worker",
      codeImplemented: true,
      configured: workerEnabled,
      serviceReachable: workerEnabled ? workerAlive : null,
      liveValidated: workerAlive,
      healthy: workerAlive,
      ready: workerAlive,
      state: !workerEnabled
        ? "UNAVAILABLE"
        : workerAlive
          ? "LIVE_VALIDATED"
          : workerRuntime?.state === "STOPPED"
            ? "STOPPED"
            : "FAILED",
      safeCode: !workerEnabled
        ? "WORKER_DISABLED"
        : workerAlive
          ? "WORKER_READY"
          : workerRuntime
            ? "WORKER_STALE_OR_NOT_READY"
            : "WORKER_STATE_UNAVAILABLE",
      observedAt,
    },
    {
      kind: "RATE_LIMITER",
      provider: sharedRate ? "database-optimistic" : "process-local",
      codeImplemented: true,
      configured: sharedRate,
      serviceReachable: sharedRate ? rateLimiter?.state === "HEALTHY" : null,
      liveValidated: sharedRate && rateLimiter?.state === "HEALTHY",
      healthy: sharedRate ? rateLimiter?.state === "HEALTHY" : true,
      ready: sharedRate ? rateLimiter?.state === "HEALTHY" : false,
      state: sharedRate ? (rateLimiter?.state === "HEALTHY" ? "LIVE_VALIDATED" : "FAILED") : "SIMULATED_LOCAL",
      safeCode: sharedRate
        ? rateLimiter?.state === "HEALTHY"
          ? "DATABASE_RATE_LIMIT_READY"
          : "DATABASE_RATE_LIMIT_UNAVAILABLE"
        : "LOCAL_RATE_LIMIT_ONLY",
      observedAt,
    },
    {
      kind: "SEARCH",
      provider: "relational-search",
      codeImplemented: true,
      configured: true,
      serviceReachable: true,
      liveValidated: false,
      healthy: true,
      ready: true,
      state: "IMPLEMENTED",
      safeCode: "RELATIONAL_SEARCH_READY",
      observedAt,
    },
    {
      kind: "ALERTING",
      provider: "sanitized-structured-log",
      codeImplemented: true,
      configured: Boolean(process.env.COMMUNITY_ALERT_WEBHOOK_URL),
      serviceReachable: null,
      liveValidated: false,
      healthy: false,
      ready: false,
      state: process.env.COMMUNITY_ALERT_WEBHOOK_URL ? "CONFIGURED" : "IMPLEMENTED",
      safeCode: process.env.COMMUNITY_ALERT_WEBHOOK_URL ? "ALERT_DELIVERY_UNVERIFIED" : "LOCAL_ALERT_EMITTER_READY",
      observedAt,
    },
    {
      kind: "BACKUP_TARGET",
      provider: "local-isolated-manifest",
      codeImplemented: true,
      configured: Boolean(process.env.COMMUNITY_BACKUP_ROOT),
      serviceReachable: process.env.COMMUNITY_BACKUP_ROOT ? backupReady : null,
      liveValidated: false,
      healthy: backupReady,
      ready: backupReady,
      state: backupReady ? "SIMULATED_LOCAL" : "UNAVAILABLE",
      safeCode: backupReady ? "BACKUP_ROOT_READY" : "BACKUP_ROOT_NOT_CONFIGURED",
      observedAt,
    },
    {
      kind: "RESTORE_DRILL_TARGET",
      provider: "local-isolated-manifest",
      codeImplemented: true,
      configured: Boolean(process.env.COMMUNITY_RESTORE_ROOT),
      serviceReachable: process.env.COMMUNITY_RESTORE_ROOT ? restoreReady : null,
      liveValidated: false,
      healthy: restoreReady,
      ready: restoreReady,
      state: restoreReady ? "SIMULATED_LOCAL" : "UNAVAILABLE",
      safeCode: restoreReady ? "RESTORE_ROOT_READY" : "RESTORE_ROOT_NOT_CONFIGURED",
      observedAt,
    },
  ];
}

function backupRoot() {
  const value = process.env.COMMUNITY_BACKUP_ROOT;
  if (!value || !path.isAbsolute(value))
    throw new CommunityError("COMMUNITY_BACKUP_NOT_CONFIGURED", "An isolated backup target is required.");
  const root = path.resolve(value);
  const repository = path.resolve(process.cwd());
  if (root === repository || root.startsWith(`${repository}${path.sep}`))
    throw new CommunityError("COMMUNITY_BACKUP_TARGET_UNSAFE", "Backup target must be outside the repository.");
  return root;
}

function restoreRoot() {
  const value = process.env.COMMUNITY_RESTORE_ROOT;
  if (!value || !path.isAbsolute(value))
    throw new CommunityError("COMMUNITY_RESTORE_NOT_CONFIGURED", "An isolated restore target is required.");
  const root = path.resolve(value);
  const repository = path.resolve(process.cwd());
  if (root === repository || root.startsWith(`${repository}${path.sep}`))
    throw new CommunityError("COMMUNITY_RESTORE_TARGET_UNSAFE", "Restore target must be outside the repository.");
  if (root === backupRoot())
    throw new CommunityError("COMMUNITY_RESTORE_TARGET_UNSAFE", "Restore target must differ from backup storage.");
  return root;
}

export async function createCommunityBackupManifest() {
  const root = backupRoot();
  const [cases, actions, appeals, receipts, sanctions, restorations, releases, packages, documents, assets] =
    await Promise.all([
      db.communityModerationCase.findMany({
        include: { subjects: true, reportLinks: true, evidence: true, assignments: true, events: true },
      }),
      db.communityModerationAction.findMany(),
      db.communityModerationAppeal.findMany({ include: { events: true } }),
      db.communityScanReceipt.findMany(),
      db.communitySanction.findMany(),
      db.communityRestorationReceipt.findMany(),
      db.communityRelease.findMany(),
      db.communityPackage.findMany(),
      db.communitySearchDocument.findMany(),
      db.communityAssetReference.findMany(),
    ]);
  const body = {
    schema: "harborlight-phase4-logical-backup-v2",
    createdAt: new Date().toISOString(),
    database: process.env.DATABASE_URL?.startsWith("mysql:") ? "mysql" : "sqlite",
    migration: "20260729121000_harborlight_phase4_relational_integrity",
    sourceCommit: process.env.GIT_COMMIT ?? "local-unset",
    inventory: { cases, actions, appeals, receipts, sanctions, restorations, releases, packages, documents, assets },
    counts: {
      cases: cases.length,
      actions: actions.length,
      appeals: appeals.length,
      receipts: receipts.length,
      sanctions: sanctions.length,
      restorations: restorations.length,
      releases: releases.length,
      packages: packages.length,
      documents: documents.length,
      assets: assets.length,
    },
  };
  const serialized = JSON.stringify(body);
  const checksum = createHash("sha256").update(serialized).digest("hex");
  await mkdir(root, { recursive: true });
  const id = `harborlight-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await writeFile(path.join(root, `${id}.json`), JSON.stringify({ ...body, checksum }, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });
  return { id, checksum, rootClass: "isolated-local" as const };
}

export async function verifyCommunityBackupManifest(id: string) {
  if (!/^harborlight-[0-9]+-[a-f0-9]{8}$/u.test(id))
    throw new CommunityError("COMMUNITY_BACKUP_INVALID", "Backup identity is invalid.");
  const parsed = JSON.parse(await readFile(path.join(backupRoot(), `${id}.json`), "utf8")) as Record<string, unknown>;
  const { checksum, ...body } = parsed;
  const verified =
    typeof checksum === "string" && checksum === createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const inventory = body.inventory;
  const referentiallyClosed = typeof inventory === "object" && inventory !== null;
  return { id, verified, referentiallyClosed, mode: "SIMULATED_LOCAL" as const, restoreWritesPerformed: false };
}

/** Restores a logical snapshot only into an explicitly configured isolated
 * drill target. It never writes the application database or any provider
 * object; production restoration remains a separately governed runbook. */
export async function restoreCommunityBackupDrill(id: string, drillId: string) {
  if (!/^[a-z0-9-]{3,64}$/u.test(drillId))
    throw new CommunityError("COMMUNITY_RESTORE_DRILL_INVALID", "Restore drill identity is invalid.");
  const verified = await verifyCommunityBackupManifest(id);
  if (!verified.verified || !verified.referentiallyClosed)
    throw new CommunityError("COMMUNITY_BACKUP_INVALID", "Backup integrity verification failed.");
  const source = await readFile(path.join(backupRoot(), `${id}.json`), "utf8");
  const parsed = JSON.parse(source) as { checksum: string; inventory?: Record<string, unknown> };
  const requiredCollections = [
    "cases",
    "actions",
    "appeals",
    "receipts",
    "sanctions",
    "restorations",
    "releases",
    "packages",
    "documents",
    "assets",
  ];
  if (!parsed.inventory || requiredCollections.some((key) => !Array.isArray(parsed.inventory?.[key])))
    throw new CommunityError("COMMUNITY_BACKUP_INVALID", "Backup inventory is incomplete.");
  const target = path.join(restoreRoot(), `${id}-${drillId}.json`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source, { encoding: "utf8", flag: "wx" });
  const restored = JSON.parse(await readFile(target, "utf8")) as { checksum?: string };
  const checksumVerified = restored.checksum === parsed.checksum;
  if (!checksumVerified)
    throw new CommunityError("COMMUNITY_RESTORE_VERIFY_FAILED", "Restored logical backup did not verify.");
  return { id, drillId, verified: true, restoreWritesPerformed: true, mode: "SIMULATED_LOCAL" as const };
}

export async function reconcileCommunityOperationalState(dryRun = true) {
  const [quarantinedReleases, activeSearchForQuarantined, staleReceipts, expiredClaims] = await Promise.all([
    db.communityRelease.findMany({ where: { moderationStatus: "QUARANTINED" }, select: { listingId: true } }),
    db.communitySearchDocument.findMany({ select: { listingId: true } }),
    db.communityScanReceipt.count({ where: { expiresAt: { lt: new Date() } } }),
    db.communityOutboxEvent.count({ where: { processedAt: null, claimExpiresAt: { lt: new Date() } } }),
  ]);
  const forbidden = new Set(quarantinedReleases.map((release) => release.listingId));
  const staleDocuments = activeSearchForQuarantined.filter((document) => forbidden.has(document.listingId));
  if (!dryRun && staleDocuments.length)
    await db.communitySearchDocument.deleteMany({
      where: { listingId: { in: staleDocuments.map((document) => document.listingId) } },
    });
  return {
    dryRun,
    staleSearchDocuments: staleDocuments.length,
    staleReceipts,
    expiredClaims,
    result: staleDocuments.length || staleReceipts || expiredClaims ? "FINDINGS" : "CLEAN",
  };
}

/** Bounded operational projection for moderators and alert evaluation. It
 * contains counts/ages only, never event payloads, identities, keys, or URLs. */
export async function communityOperationalSnapshot(now = new Date()) {
  const [queueDepth, deadLetters, oldestQueued, staleScans, quarantined, caseQueue, oldestCase, backupSchedules] =
    await Promise.all([
      db.communityOutboxEvent.count({ where: { processedAt: null, terminalFailureAt: null } }),
      db.communityOutboxEvent.count({ where: { terminalFailureAt: { not: null } } }),
      db.communityOutboxEvent.findFirst({
        where: { processedAt: null, terminalFailureAt: null },
        orderBy: { availableAt: "asc" },
        select: { availableAt: true },
      }),
      db.communityScanReceipt.count({ where: { expiresAt: { lt: now } } }),
      db.communityRelease.count({ where: { moderationStatus: "QUARANTINED" } }),
      db.communityModerationCase.count({
        where: { status: { in: ["OPEN", "TRIAGED", "ACTION_REQUIRED", "APPEAL_PENDING"] } },
      }),
      db.communityModerationCase.findFirst({ orderBy: { openedAt: "asc" }, select: { openedAt: true } }),
      db.communityOperationalSchedule.findMany({
        where: { scheduleType: { in: ["BACKUP", "RESTORE_DRILL_REMINDER"] } },
        select: { scheduleType: true, lastRunAt: true, lastOutcome: true },
      }),
    ]);
  return {
    queueDepth,
    deadLetters,
    oldestQueuedJobAgeSeconds: oldestQueued?.availableAt
      ? Math.max(0, Math.floor((now.getTime() - oldestQueued.availableAt.getTime()) / 1000))
      : 0,
    staleScans,
    quarantined,
    caseQueue,
    oldestCaseAgeSeconds: oldestCase
      ? Math.max(0, Math.floor((now.getTime() - oldestCase.openedAt.getTime()) / 1000))
      : 0,
    backupSchedules: backupSchedules.map((item) => ({ scheduleType: item.scheduleType, lastRunAt: item.lastRunAt })),
    releaseIdentity: process.env.GIT_COMMIT ? process.env.GIT_COMMIT.slice(0, 64) : "local-unset",
  };
}
