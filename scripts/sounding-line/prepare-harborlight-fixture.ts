import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createDrydockPublishingEvidencePayload } from "../../src/drydock/publishing-evidence";

const databaseUrl = process.env.DATABASE_URL ?? "";
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice("file:".length)) : "";

async function main() {
  if (
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !["harborlight-phase2", "harborlight-phase3", "harborlight-phase4"].includes(process.env.SOUNDING_LINE_SUITE_PROFILE ?? "") ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(databasePath))
  ) {
    throw new Error("SOUNDING_LINE_HARBORLIGHT_FIXTURE_CONTRACT_UNSATISFIED");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const version = await prisma.publishedTaleVersion.findFirst({
      where: { isCurrent: true },
      orderBy: { publishedAt: "desc" },
      select: { id: true, checksum: true },
    });
    if (!version) throw new Error("SOUNDING_LINE_HARBORLIGHT_FIXTURE_SOURCE_MISSING");

    const digest = (label: string) => createHash("sha256").update(`${label}:${version.checksum}`).digest("hex");
    const payload = createDrydockPublishingEvidencePayload({
      draft: {
        schemaVersion: 1,
        sourceChecksum: version.checksum,
        schemaRegistryVersion: 1,
        ruleCatalogVersion: 1,
        validationRunId: `sounding-line-harborlight-${digest("validation").slice(0, 16)}`,
        requiredSuitePolicyVersion: "sounding-line-harborlight-v1",
        requiredScenarioSuiteIds: ["harborlight-synthetic-publication"],
        scenarioRunIds: [`sounding-line-harborlight-${digest("scenario").slice(0, 16)}`],
        coverageDigest: digest("coverage"),
        compatibilityPolicyVersion: "sounding-line-harborlight-v1",
        compatibilityDigest: digest("compatibility"),
        externalEvidenceDigest: digest("external"),
        waiverIds: [],
        draftDigest: digest("draft"),
      },
      scenarioRunIds: [`sounding-line-harborlight-${digest("scenario").slice(0, 16)}`],
      coverageDigest: digest("coverage"),
      platformVersion: "forever-treasure-companion-sounding-line",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await prisma.drydockPublishingEvidence.upsert({
      where: { publishedVersionId: version.id },
      update: {
        sourceChecksum: version.checksum,
        schemaVersion: payload.schemaVersion,
        schemaRegistryVersion: payload.schemaRegistryVersion,
        ruleCatalogVersion: payload.ruleCatalogVersion,
        validationRunId: payload.validationRunId,
        requiredSuitePolicyVersion: payload.requiredSuitePolicyVersion,
        compatibilityPolicyVersion: payload.compatibilityPolicyVersion,
        compatibilityDigest: payload.compatibilityDigest,
        externalEvidenceDigest: payload.externalEvidenceDigest,
        evidence: JSON.stringify(payload),
        digest: payload.digest,
      },
      create: {
        publishedVersionId: version.id,
        sourceChecksum: version.checksum,
        schemaVersion: payload.schemaVersion,
        schemaRegistryVersion: payload.schemaRegistryVersion,
        ruleCatalogVersion: payload.ruleCatalogVersion,
        validationRunId: payload.validationRunId,
        requiredSuitePolicyVersion: payload.requiredSuitePolicyVersion,
        compatibilityPolicyVersion: payload.compatibilityPolicyVersion,
        compatibilityDigest: payload.compatibilityDigest,
        externalEvidenceDigest: payload.externalEvidenceDigest,
        evidence: JSON.stringify(payload),
        digest: payload.digest,
      },
    });
    process.stdout.write('{"status":"SOUNDING_LINE_HARBORLIGHT_FIXTURE_READY"}\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
