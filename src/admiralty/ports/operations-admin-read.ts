import packageManifest from "../../../package.json";
import { communityOperationalSnapshot, collectCommunityProviderHealth } from "@/community/operations";
import { db } from "@/lib/db";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { collectPrivateProviderHealth, createPrivateProviderRuntime } from "@/private-content/providers";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
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
      codeSupport: "IMPLEMENTED" as const,
      configured: item.configured,
      liveValidation: item.state === "LIVE_VALIDATED" ? ("LIVE_VALIDATED" as const) : ("NOT_LIVE_VALIDATED" as const),
      health: item.healthy ? ("HEALTHY" as const) : item.configured ? ("DEGRADED" as const) : ("UNAVAILABLE" as const),
      safeCode: item.safeCode,
      observedAt: observedAt.toISOString(),
      capabilities: [] as string[],
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
      community,
      providers,
    },
    { observedAt: now, state: databaseProbe ? (community ? "HEALTHY" : "DEGRADED") : "DEGRADED" },
  );
}

const settings = [
  { key: "environment", source: "NODE_ENV", class: "PUBLIC_SAFE", value: () => environmentLabel() },
  {
    key: "database.provider",
    source: "DATABASE_URL",
    class: "SECRET_REFERENCE_ONLY",
    value: () =>
      process.env.DATABASE_URL?.startsWith("mysql:") ? "mysql" : process.env.DATABASE_URL ? "sqlite" : "not configured",
  },
  {
    key: "oauth.google",
    source: "GOOGLE_CLIENT_ID",
    class: "SECRET_REFERENCE_ONLY",
    value: () => (process.env.GOOGLE_CLIENT_ID ? "configured" : "not configured"),
  },
  {
    key: "oauth.github",
    source: "GITHUB_CLIENT_ID",
    class: "SECRET_REFERENCE_ONLY",
    value: () => (process.env.GITHUB_CLIENT_ID ? "configured" : "not configured"),
  },
  {
    key: "transactional-email",
    source: "EMAIL_PROVIDER",
    class: "SECRET_REFERENCE_ONLY",
    value: () => (process.env.EMAIL_PROVIDER ? "configured; health contract pending" : "not configured"),
  },
  {
    key: "private.storage",
    source: "PRIVATE_CONTENT_STORAGE_PROVIDER",
    class: "SECRET_REFERENCE_ONLY",
    value: () => process.env.PRIVATE_CONTENT_STORAGE_PROVIDER ?? "not configured",
  },
  {
    key: "private.scanner",
    source: "PRIVATE_CONTENT_SCANNER_PROVIDER",
    class: "SECRET_REFERENCE_ONLY",
    value: () => process.env.PRIVATE_CONTENT_SCANNER_PROVIDER ?? "not configured",
  },
  {
    key: "private.worker",
    source: "PRIVATE_CONTENT_WORKER_ENABLED",
    class: "RUNTIME_SETTING",
    value: () => (process.env.PRIVATE_CONTENT_WORKER_ENABLED === "true" ? "enabled" : "disabled"),
  },
  {
    key: "community.storage",
    source: "COMMUNITY_ASSET_STORAGE_PROVIDER",
    class: "SECRET_REFERENCE_ONLY",
    value: () => process.env.COMMUNITY_ASSET_STORAGE_PROVIDER ?? "local",
  },
  {
    key: "community.scanner",
    source: "COMMUNITY_SCANNER_PROVIDER",
    class: "SECRET_REFERENCE_ONLY",
    value: () => process.env.COMMUNITY_SCANNER_PROVIDER ?? "not configured",
  },
  {
    key: "community.worker",
    source: "COMMUNITY_WORKER_ENABLED",
    class: "RUNTIME_SETTING",
    value: () => (process.env.COMMUNITY_WORKER_ENABLED === "true" ? "enabled" : "disabled"),
  },
  {
    key: "community.rate-limit",
    source: "COMMUNITY_RATE_LIMIT_PROVIDER",
    class: "RUNTIME_SETTING",
    value: () => process.env.COMMUNITY_RATE_LIMIT_PROVIDER ?? "process-local",
  },
] as const;

export async function getConfigurationProjection(operator: AdmiraltyCurrentOperator) {
  const data = settings.map((setting) => ({
    key: setting.key,
    classification: setting.class,
    value: setting.value(),
    reference: setting.source,
    configured: Boolean(process.env[setting.source]),
    lastValidated: null,
    lastRotated: null,
    expires: null,
    mutableHere: false,
  }));
  await auditOperationsRead(operator, "ADMIRALTY_CONFIGURATION_READ", "ConfigurationProjection", "current", {
    settingCount: data.length,
    mutationAvailable: false,
  });
  return projection("Platform configuration allowlist", data);
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
