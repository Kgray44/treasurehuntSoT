import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";

export type CommunityProviderState =
  | "IMPLEMENTED"
  | "CONFIGURED"
  | "SIMULATED_LOCAL"
  | "LIVE_VALIDATED"
  | "BLOCKED_EXTERNAL"
  | "UNAVAILABLE"
  | "FAILED";
export type CommunityProviderHealth = {
  kind: string;
  provider: string;
  configured: boolean;
  healthy: boolean;
  ready: boolean;
  state: CommunityProviderState;
  safeCode: string;
};

function bool(value: string | undefined) {
  return value === "true";
}
function providerState(configured: boolean, healthy: boolean, simulated = false): CommunityProviderState {
  if (simulated) return "SIMULATED_LOCAL";
  if (configured && healthy) return "CONFIGURED";
  return configured ? "FAILED" : "UNAVAILABLE";
}

/** Safe diagnostics: no endpoints, bucket names, account IDs, object keys, or raw errors. */
export async function collectCommunityProviderHealth(): Promise<CommunityProviderHealth[]> {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const probe = databaseConfigured ? await db.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value` : [];
  const databaseHealthy = databaseConfigured && probe.length === 1;
  const scanner = process.env.COMMUNITY_SCANNER_PROVIDER ?? "not-configured";
  const storage = process.env.COMMUNITY_ASSET_STORAGE_PROVIDER ?? "local";
  const workerEnabled = bool(process.env.COMMUNITY_WORKER_ENABLED);
  const sharedRate = process.env.COMMUNITY_RATE_LIMIT_PROVIDER === "database";
  return [
    {
      kind: "DATABASE",
      provider: process.env.DATABASE_URL?.startsWith("mysql:") ? "mysql" : "sqlite",
      configured: databaseConfigured,
      healthy: databaseHealthy,
      ready: databaseHealthy,
      state: providerState(databaseConfigured, databaseHealthy),
      safeCode: databaseHealthy ? "DATABASE_READY" : "DATABASE_UNAVAILABLE",
    },
    {
      kind: "SCANNER",
      provider: scanner === "clamav" ? "clamav-adapter" : scanner,
      configured: scanner !== "not-configured",
      healthy: scanner === "clamav" ? bool(process.env.COMMUNITY_SCANNER_HEALTHY) : false,
      ready: scanner === "clamav" && bool(process.env.COMMUNITY_SCANNER_HEALTHY),
      state:
        scanner === "synthetic-test"
          ? "SIMULATED_LOCAL"
          : scanner === "not-configured"
            ? "UNAVAILABLE"
            : bool(process.env.COMMUNITY_SCANNER_HEALTHY)
              ? "CONFIGURED"
              : "BLOCKED_EXTERNAL",
      safeCode: scanner === "not-configured" ? "SCANNER_NOT_CONFIGURED" : "SCANNER_PROBE_REQUIRED",
    },
    {
      kind: "STORAGE",
      provider: storage,
      configured: storage !== "local" || Boolean(process.env.COMMUNITY_ASSET_ROOT),
      healthy:
        storage === "local" ? Boolean(process.env.COMMUNITY_ASSET_ROOT) : bool(process.env.COMMUNITY_STORAGE_HEALTHY),
      ready:
        storage === "local" ? Boolean(process.env.COMMUNITY_ASSET_ROOT) : bool(process.env.COMMUNITY_STORAGE_HEALTHY),
      state:
        storage === "local"
          ? "SIMULATED_LOCAL"
          : bool(process.env.COMMUNITY_STORAGE_HEALTHY)
            ? "CONFIGURED"
            : "BLOCKED_EXTERNAL",
      safeCode: storage === "local" ? "LOCAL_STORAGE_ONLY" : "STORAGE_PROBE_REQUIRED",
    },
    {
      kind: "WORKER",
      provider: "community-durable-worker",
      configured: workerEnabled,
      healthy: workerEnabled,
      ready: workerEnabled,
      state: workerEnabled ? "IMPLEMENTED" : "UNAVAILABLE",
      safeCode: workerEnabled ? "WORKER_ENABLED" : "WORKER_DISABLED",
    },
    {
      kind: "RATE_LIMITER",
      provider: sharedRate ? "database-optimistic" : "process-local",
      configured: sharedRate,
      healthy: true,
      ready: sharedRate,
      state: sharedRate ? "IMPLEMENTED" : "SIMULATED_LOCAL",
      safeCode: sharedRate ? "DATABASE_RATE_LIMIT_IMPLEMENTED" : "LOCAL_RATE_LIMIT_ONLY",
    },
    {
      kind: "SEARCH",
      provider: "relational-search",
      configured: true,
      healthy: true,
      ready: true,
      state: "IMPLEMENTED",
      safeCode: "RELATIONAL_SEARCH_READY",
    },
    {
      kind: "ALERTING",
      provider: "sanitized-structured-log",
      configured: Boolean(process.env.COMMUNITY_ALERT_WEBHOOK_URL),
      healthy: Boolean(process.env.COMMUNITY_ALERT_WEBHOOK_URL),
      ready: false,
      state: process.env.COMMUNITY_ALERT_WEBHOOK_URL ? "IMPLEMENTED" : "UNAVAILABLE",
      safeCode: process.env.COMMUNITY_ALERT_WEBHOOK_URL ? "ALERT_DELIVERY_UNVERIFIED" : "ALERTING_NOT_CONFIGURED",
    },
    {
      kind: "BACKUP_TARGET",
      provider: "local-isolated-manifest",
      configured: Boolean(process.env.COMMUNITY_BACKUP_ROOT),
      healthy: Boolean(process.env.COMMUNITY_BACKUP_ROOT),
      ready: Boolean(process.env.COMMUNITY_BACKUP_ROOT),
      state: process.env.COMMUNITY_BACKUP_ROOT ? "SIMULATED_LOCAL" : "UNAVAILABLE",
      safeCode: process.env.COMMUNITY_BACKUP_ROOT ? "BACKUP_ROOT_CONFIGURED" : "BACKUP_ROOT_NOT_CONFIGURED",
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
  const [queueDepth, deadLetters, oldestClaim, staleScans, quarantined, caseQueue, oldestCase, backupSchedules] =
    await Promise.all([
      db.communityOutboxEvent.count({ where: { processedAt: null, terminalFailureAt: null } }),
      db.communityOutboxEvent.count({ where: { terminalFailureAt: { not: null } } }),
      db.communityOutboxEvent.findFirst({
        where: { processedAt: null, claimExpiresAt: { not: null } },
        orderBy: { claimedAt: "asc" },
        select: { claimedAt: true },
      }),
      db.communityScanReceipt.count({ where: { expiresAt: { lt: now } } }),
      db.communityRelease.count({ where: { moderationStatus: "QUARANTINED" } }),
      db.communityModerationCase.count({
        where: { status: { in: ["OPEN", "TRIAGED", "ACTION_REQUIRED", "APPEAL_PENDING"] } },
      }),
      db.communityModerationCase.findFirst({ orderBy: { openedAt: "asc" }, select: { openedAt: true } }),
      db.communityOperationalSchedule.findMany({
        where: { scheduleType: { in: ["BACKUP", "RESTORE_DRILL_REMINDER"] } },
        select: { scheduleType: true, lastRunAt: true },
      }),
    ]);
  return {
    queueDepth,
    deadLetters,
    leaseAgeSeconds: oldestClaim?.claimedAt
      ? Math.max(0, Math.floor((now.getTime() - oldestClaim.claimedAt.getTime()) / 1000))
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
