import { db } from "@/lib/db";

function jsonValue<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getVisionReleaseReadiness() {
  const release = await db.visionRelease.findFirst({
    orderBy: { updatedAt: "desc" },
    include: {
      issues: { orderBy: [{ releaseBlocking: "desc" }, { severity: "asc" }, { id: "asc" }] },
      artifacts: { orderBy: { createdAt: "desc" } },
      compatibilityRules: { orderBy: { component: "asc" } },
      reliabilityRuns: { orderBy: { createdAt: "desc" }, take: 10 },
      testRuns: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!release) return null;
  const openBlockers = release.issues.filter(
    (issue) => issue.releaseBlocking && !["CLOSED", "RESOLVED"].includes(issue.status),
  );
  const readiness = jsonValue<{
    sections?: Array<{ id: string; label: string; status: string; summary: string }>;
    knownLimitations?: string[];
  }>(release.releaseManifest, {});
  return {
    id: release.id,
    version: release.version,
    channel: release.channel,
    status: release.status,
    readinessStatus: release.readinessStatus,
    sourceCommit: release.sourceCommit,
    buildId: release.buildId,
    updatedAt: release.updatedAt.toISOString(),
    openBlockerCount: openBlockers.length,
    sections: readiness.sections ?? [],
    knownLimitations: jsonValue<string[]>(release.knownLimitations, readiness.knownLimitations ?? []),
    issues: release.issues.map((issue) => ({
      id: issue.id,
      category: issue.category,
      severity: issue.severity,
      component: issue.component,
      title: issue.title,
      owner: issue.owner,
      status: issue.status,
      releaseBlocking: issue.releaseBlocking,
      regressionTest: issue.regressionTest,
      affectedVersions: jsonValue<string[]>(issue.affectedVersions, []),
      evidence: jsonValue<Record<string, unknown>>(issue.evidence, {}),
    })),
    compatibility: release.compatibilityRules.map((rule) => ({
      component: rule.component,
      currentVersion: rule.currentVersion,
      minimumVersion: rule.minimumVersion,
      maximumVersion: rule.maximumVersion,
      status: rule.status,
      reason: rule.reason,
    })),
    artifacts: release.artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.artifactType,
      version: artifact.version,
      platform: artifact.platform,
      architecture: artifact.architecture,
      contentHash: artifact.contentHash,
      signatureStatus: artifact.signatureStatus,
      rollbackTarget: artifact.rollbackTarget,
      createdAt: artifact.createdAt.toISOString(),
    })),
    reliabilityRuns: release.reliabilityRuns.map((run) => ({
      id: run.id,
      status: run.status,
      engineVersion: run.engineVersion,
      modelBundleVersion: run.modelBundleVersion,
      falseAccepts: run.falseAccepts,
      firstAttemptSuccess: run.firstAttemptSuccess,
      twoAttemptSuccess: run.twoAttemptSuccess,
      p95DurationMs: run.p95DurationMs,
      reportHash: run.reportHash,
      createdAt: run.createdAt.toISOString(),
    })),
    testRuns: release.testRuns.map((run) => ({
      id: run.id,
      suite: run.suite,
      category: run.category,
      status: run.status,
      evidence: jsonValue<Record<string, unknown>>(run.evidence, {}),
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
  };
}

export type VisionReleaseReadiness = NonNullable<Awaited<ReturnType<typeof getVisionReleaseReadiness>>>;
