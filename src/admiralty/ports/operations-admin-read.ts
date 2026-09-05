import packageManifest from "../../../package.json";
import { communityOperationalSnapshot, collectCommunityProviderHealth } from "@/community/operations";
import { readCommunityOutboxRuntimePolicy } from "@/community/operational-policy";
import { db } from "@/lib/db";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { collectPrivateProviderHealth, createPrivateProviderRuntime } from "@/private-content/providers";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
import { admiraltyConfigurationRegistry } from "../configuration-registry";
import { environmentLabel, projection, unavailableProjection, type AdmiraltyProjection } from "../read-models";

type ProviderCard = {
  domain: string;
  kind: string;
  provider: string;
  codeSupport: "IMPLEMENTED" | "UNKNOWN";
  configured: boolean;
  liveValidation: "LIVE_VALIDATED" | "NOT_LIVE_VALIDATED";
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
  safeCode: string;
  observedAt: string;
  capabilities: readonly string[];
};

let providerCache: { expiresAt: number; value: AdmiraltyProjection<ProviderCard[]> } | null = null;
const providerCacheMs = 30_000;

function buildIdentity() {
  const value =
    process.env.VOYAGEWRIGHT_BUILD_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.SOURCE_VERSION ??
    process.env.GIT_COMMIT ??
    "";
  return /^[a-f0-9]{7,64}$/iu.test(value) ? value : null;
}

export async function getProviderOverview(operator: AdmiraltyCurrentOperator, force = false) {
  if (!force && providerCache && providerCache.expiresAt > Date.now()) return providerCache.value;
  const observedAt = new Date();
  const community = await collectCommunityProviderHealth().catch(() => []);
  let sealed: Awaited<ReturnType<typeof collectPrivateProviderHealth>> = [];
  let sealedError = "";
  try {
    const configuration = parsePrivateContentConfiguration();
    sealed = await collectPrivateProviderHealth(createPrivateProviderRuntime(configuration));
  } catch {
    sealedError = "Sealed Hold provider configuration or its bounded live probe is unavailable.";
  }
  const cards: ProviderCard[] = [
    ...community.map((item) => ({
      domain: "Harborlight",
      kind: item.kind,
      provider: item.provider,
      codeSupport: item.codeImplemented ? ("IMPLEMENTED" as const) : ("UNKNOWN" as const),
      configured: item.configured,
      liveValidation: item.liveValidated ? ("LIVE_VALIDATED" as const) : ("NOT_LIVE_VALIDATED" as const),
      health: item.healthy ? ("HEALTHY" as const) : item.configured ? ("DEGRADED" as const) : ("UNAVAILABLE" as const),
      safeCode: item.safeCode,
      observedAt: item.observedAt,
      capabilities:
        item.serviceReachable === null ? [] : [item.serviceReachable ? "service-reachable" : "service-unreachable"],
    })),
    ...sealed.map((item) => ({
      domain: "Sealed Hold",
      kind: item.kind,
      provider: item.provider,
      codeSupport: "IMPLEMENTED" as const,
      configured: item.configured,
      liveValidation: "NOT_LIVE_VALIDATED" as const,
      health: item.healthy ? ("HEALTHY" as const) : item.configured ? ("DEGRADED" as const) : ("UNAVAILABLE" as const),
      safeCode: item.safeCode,
      observedAt: item.checkedAt,
      capabilities: item.capabilities,
    })),
    {
      domain: "Wayfarer",
      kind: "TRANSACTIONAL_EMAIL",
      provider: process.env.EMAIL_PROVIDER ?? "not-configured",
      codeSupport: "IMPLEMENTED",
      configured: Boolean(process.env.EMAIL_PROVIDER),
      liveValidation: "NOT_LIVE_VALIDATED",
      health: "UNKNOWN",
      safeCode: "BLOCKED_BY_MISSING_OWNER_CONTRACT",
      observedAt: observedAt.toISOString(),
      capabilities: ["delivery-health-contract-pending"],
    },
  ];
  const value = cards.length
    ? projection("Harborlight + SealedHold Admin Read Ports", cards, {
        observedAt,
        state: cards.some((card) => card.health === "DEGRADED" || card.health === "UNKNOWN") ? "DEGRADED" : "HEALTHY",
      })
    : unavailableProjection<ProviderCard[]>(
        "Provider admin read ports",
        sealedError || "No provider projection is available.",
      );
  providerCache = { expiresAt: Date.now() + providerCacheMs, value };
  await auditOperationsRead(operator, "ADMIRALTY_PROVIDERS_READ", "ProviderOverview", "current", {
    providerCount: cards.length,
    cachedForSeconds: providerCacheMs / 1000,
    sealedProjectionError: Boolean(sealedError),
  });
  return value;
}

export async function getOperationsOverview(operator: AdmiraltyCurrentOperator) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [
    databaseProbe,
    activeUsers,
    activeSessions,
    activeVoyages,
    queuedJobs,
    failedJobs,
    oldestJob,
    pendingLifecycle,
    latestHealth,
    latestBackup,
    latestRestore,
    schedules,
    community,
    expiredCommunityClaims,
  ] = await Promise.all([
    db.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`.then((rows) => rows.length === 1).catch(() => false),
    db.userAccount.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    db.accountSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    db.taleSession.count({ where: { status: { in: ["ACTIVE", "SCHEDULED", "PAUSED"] }, previewMode: false } }),
    db.privateContentJob.count({ where: { state: { in: ["PENDING", "RETRY"] } } }),
    db.privateContentJob.count({ where: { OR: [{ state: "FAILED" }, { failureCode: { not: null } }] } }),
    db.privateContentJob.findFirst({
      where: { state: { in: ["PENDING", "RETRY"] } },
      select: {
        id: true,
        type: true,
        state: true,
        availableAt: true,
        attemptCount: true,
        maxAttempts: true,
        correlationId: true,
      },
      orderBy: { availableAt: "asc" },
    }),
    db.accountLifecycleRequest.count({ where: { state: { in: ["REQUESTED", "SCHEDULED", "PROCESSING"] } } }),
    db.privateProviderHealthSnapshot.findMany({
      select: { kind: true, provider: true, state: true, safeCode: true, checkedAt: true },
      orderBy: { checkedAt: "desc" },
      distinct: ["kind"],
      take: 10,
    }),
    db.privateBackupRun.findFirst({
      select: { id: true, state: true, verifiedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.privateRestoreDrill.findFirst({
      select: { id: true, state: true, resultCode: true, cleanupCompletedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.privateScheduledOperation.findMany({
      select: { id: true, kind: true, state: true, runAfter: true, leaseUntil: true, createdAt: true, updatedAt: true },
      orderBy: { runAfter: "asc" },
      take: 30,
    }),
    communityOperationalSnapshot(now).catch(() => null),
    db.communityOutboxEvent.count({
      where: { processedAt: null, terminalFailureAt: null, claimExpiresAt: { lt: now } },
    }),
  ]);
  const providers = await getProviderOverview(operator);
  await auditOperationsRead(operator, "ADMIRALTY_OPERATIONS_OVERVIEW_READ", "OperationsOverview", "current", {
    databaseHealthy: databaseProbe,
    partial: !community,
  });
  return projection(
    "Platform + SealedHold + Harborlight Admin Read Ports",
    {
      platform: {
        database: {
          provider: process.env.DATABASE_URL?.startsWith("mysql:") ? "mysql" : "sqlite",
          healthy: databaseProbe,
          schemaLevel: "Prisma migration history",
        },
        activeUsers24Hours: activeUsers,
        activeSessions,
        activeVoyages,
        pendingLifecycle,
      },
      jobs: {
        queued: queuedJobs,
        failed: failedJobs,
        oldestPending: oldestJob,
        oldestPendingAgeSeconds: oldestJob
          ? Math.max(0, Math.floor((now.getTime() - oldestJob.availableAt.getTime()) / 1000))
          : 0,
      },
      privateOperations: { latestHealth, latestBackup, latestRestore, schedules },
      community: community ? { ...community, expiredClaims: expiredCommunityClaims } : null,
      providers,
    },
    { observedAt: now, state: databaseProbe ? (community ? "HEALTHY" : "DEGRADED") : "DEGRADED" },
  );
}

export async function getConfigurationProjection(operator: AdmiraltyCurrentOperator) {
  const policy = await readCommunityOutboxRuntimePolicy();
  const values: Record<string, string> = {
    "platform.environment": environmentLabel(),
    "platform.database-provider": process.env.DATABASE_URL?.startsWith("mysql:")
      ? "MySQL configured"
      : process.env.DATABASE_URL
        ? "SQLite configured"
        : "Not configured",
    "wayfarer.oauth.google": process.env.GOOGLE_CLIENT_ID ? "Configured" : "Not configured",
    "wayfarer.oauth.github": process.env.GITHUB_CLIENT_ID ? "Configured" : "Not configured",
    "wayfarer.transactional-email": process.env.EMAIL_PROVIDER
      ? "Configured; owner health contract pending"
      : "Not configured",
    "sealed-hold.storage": process.env.PRIVATE_CONTENT_STORAGE_PROVIDER ? "Configured" : "Not configured",
    "sealed-hold.scanner": process.env.PRIVATE_CONTENT_SCANNER_PROVIDER ? "Configured" : "Not configured",
    "sealed-hold.worker-enabled": process.env.PRIVATE_CONTENT_WORKER_ENABLED === "true" ? "Enabled" : "Disabled",
    "harborlight.storage": process.env.COMMUNITY_ASSET_STORAGE_PROVIDER ? "Configured" : "Not configured",
    "harborlight.scanner": process.env.COMMUNITY_BINARY_SCANNER_PROVIDER ? "Configured" : "Not configured",
    "harborlight.worker-deployment": process.env.COMMUNITY_WORKER_ENABLED === "true" ? "Enabled" : "Disabled",
    "harborlight.rate-limit-provider": process.env.COMMUNITY_RATE_LIMIT_PROVIDER ?? "Process-local development default",
    "harborlight.outbox.dispatch-enabled": policy.dispatchEnabled ? "Accepting new work" : "Paused",
    "harborlight.outbox.batch-size": `${policy.batchSize} jobs per batch`,
    "harborlight.outbox.poll-interval": `${Math.round(policy.pollIntervalMs / 1_000)} seconds`,
  };
  const settings = admiraltyConfigurationRegistry.map((definition) => ({
    ...definition,
    effectiveValue: values[definition.key] ?? "Not available",
    configured: definition.managementClass === "POLICY_EDITABLE" || Boolean(process.env[definition.sourceReference]),
    mutableHere: definition.managementClass === "POLICY_EDITABLE",
  }));
  await auditOperationsRead(operator, "ADMIRALTY_CONFIGURATION_READ", "ConfigurationProjection", "current", {
    settingCount: settings.length,
    editableSettingCount: settings.filter((setting) => setting.mutableHere).length,
  });
  return projection("Source-bound configuration registry", { settings, communityOutboxRuntimePolicy: policy });
}

export async function getReleaseProjection(operator: AdmiraltyCurrentOperator) {
  const source = buildIdentity();
  const data = {
    application: packageManifest.name,
    version: packageManifest.version,
    buildId: process.env.VOYAGEWRIGHT_BUILD_ID ?? null,
    sourceRevision: source,
    environment: environmentLabel(),
    featureCatalogIdentity: "FT-B010",
    soundingLineDecision: process.env.SOUNDING_LINE_DECISION ?? "Not recorded by this runtime",
    deploymentActionsAvailable: false,
    lastDeployment: null,
    rollbackTarget: null,
  };
  await auditOperationsRead(operator, "ADMIRALTY_RELEASE_READ", "ReleaseProjection", source ?? "unavailable");
  return projection("Platform release environment", data, { state: source ? "CONFIGURED" : "NOT_CONFIGURED" });
}

async function auditOperationsRead(
  operator: AdmiraltyCurrentOperator,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
) {
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "OPERATIONS_OPERATOR",
    capability:
      targetType === "ConfigurationProjection"
        ? "CONFIG_OBSERVE"
        : targetType === "ReleaseProjection"
          ? "RELEASE_OBSERVE"
          : "PLATFORM_OBSERVE",
    action,
    targetType,
    targetId,
    reason: "Read-only operational inspection",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail,
  });
}
