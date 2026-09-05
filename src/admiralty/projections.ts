import packageManifest from "../../package.json";
import { communityOperationalSnapshot } from "@/community/operations";
import { db } from "@/lib/db";
import { privilegedAssuranceState } from "./assurance";
import type { AdmiraltyCurrentOperator } from "./authorization";
import { admiraltyRegistrySummary } from "./registry";
import { operatorSupportSummary } from "./support-access";

function safeBuildIdentity() {
  const candidate =
    process.env.VOYAGEWRIGHT_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SOURCE_VERSION ?? "";
  return /^[a-f0-9]{7,64}$/iu.test(candidate) ? candidate : null;
}

export async function admiraltyOverview(operator: AdmiraltyCurrentOperator) {
  const [assurance, support, recentAudits, recentAuditCount, community] = await Promise.all([
    privilegedAssuranceState(operator),
    operatorSupportSummary(operator.accountId),
    db.platformAuditEvent.findMany({
      where: { action: { startsWith: "ADMIRALTY_" } },
      select: {
        action: true,
        resourceType: true,
        resourceId: true,
        outcome: true,
        correlationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.platformAuditEvent.count({
      where: { action: { startsWith: "ADMIRALTY_" }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    communityOperationalSnapshot().catch(() => null),
  ]);
  return {
    operator: {
      accountId: operator.accountId,
      displayName: operator.displayName,
      roles: operator.roles,
      capabilities: operator.capabilities,
      sessionExpiresAt: operator.sessionExpiresAt,
      csrfToken: operator.csrfToken,
    },
    assurance,
    support,
    registry: admiraltyRegistrySummary(),
    environment: {
      application: "Voyagewright",
      version: packageManifest.version,
      environment: ["development", "test", "production"].includes(process.env.NODE_ENV ?? "")
        ? process.env.NODE_ENV
        : "unclassified",
      buildIdentity: safeBuildIdentity(),
    },
    audit: { recentCount24Hours: recentAuditCount, recent: recentAudits },
    attention: {
      pendingSupportCases: support.pendingRequestCount,
      activeSupportGrants: support.activeGrantCount,
      communityQueuedJobs: community?.queueDepth ?? null,
      communityDeadLetters: community?.deadLetters ?? null,
      communityModerationCases: community?.caseQueue ?? null,
    },
  };
}
