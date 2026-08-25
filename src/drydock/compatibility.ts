import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { canonicalChecksum } from "@/drydock/canonical";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import {
  DRYDOCK_COMPATIBILITY_POLICY_VERSION,
  type DrydockCompatibilityResult,
  type DrydockCompatibilityStatus,
} from "@/drydock/readiness";

export type DrydockCompatibilityFinding = Readonly<{
  code: string;
  status: DrydockCompatibilityStatus;
  blockId?: string;
  message: string;
}>;

export type DrydockCompatibilityAssessment = DrydockCompatibilityResult &
  Readonly<{
    findings: readonly DrydockCompatibilityFinding[];
    sourceSchemaVersion: number;
    supportedBlockCount: number;
  }>;

function resultStatus(findings: readonly DrydockCompatibilityFinding[]): DrydockCompatibilityStatus {
  if (findings.some((finding) => finding.status === "CORRUPT_OR_INVALID")) return "CORRUPT_OR_INVALID";
  if (findings.some((finding) => finding.status === "UNSUPPORTED")) return "UNSUPPORTED";
  if (findings.some((finding) => finding.status === "EXTERNAL_REQUIREMENT_PENDING"))
    return "EXTERNAL_REQUIREMENT_PENDING";
  if (findings.some((finding) => finding.status === "MIGRATION_AVAILABLE")) return "MIGRATION_AVAILABLE";
  if (findings.some((finding) => finding.status === "COMPATIBLE_WITH_UPCAST")) return "COMPATIBLE_WITH_UPCAST";
  if (findings.length) return "COMPATIBLE_WITH_WARNINGS";
  return "COMPATIBLE";
}

/**
 * A bounded, side-effect-free reader assessment. It uses the Phase 1 parser and
 * in-memory upcasts; no historical snapshot is altered and no draft is created.
 */
export function assessDrydockCompatibility(snapshot: PublishedTaleSnapshot): DrydockCompatibilityAssessment {
  const sourceChecksum = publishedSourceChecksum(snapshot);
  const findings: DrydockCompatibilityFinding[] = [];
  if (snapshot.schemaVersion !== 1)
    findings.push({
      code: "DRYDOCK_SNAPSHOT_SCHEMA_UNSUPPORTED",
      status: "UNSUPPORTED",
      message: "This published Chronicle schema is not supported by the current governed reader.",
    });
  let supportedBlockCount = 0;
  for (const chapter of snapshot.chapters) {
    for (const block of chapter.blocks) {
      const parsed = parseDrydockBlock({
        id: block.id,
        blockType: block.blockType,
        schemaVersion: block.schemaVersion ?? 1,
        configuration: block.configuration,
        presentation: block.presentation,
        completion: block.completion,
        nextBlockId: block.nextBlockId,
        connections: block.connections.map((connection) => ({
          targetBlockId: connection.targetBlockId,
          connectionType: connection.connectionType,
          conditionExpression: connection.conditionExpression,
          label: connection.label,
        })),
      });
      if (parsed.success) {
        supportedBlockCount += 1;
        if (parsed.migrationsApplied.length)
          findings.push({
            code: "DRYDOCK_BLOCK_UPCAST_AVAILABLE",
            status: "COMPATIBLE_WITH_UPCAST",
            blockId: block.id,
            message: "This Passage is safely upcast in memory for the governed reader.",
          });
      } else {
        findings.push({
          code: parsed.compatibilityStatus === "UNSUPPORTED" ? "DRYDOCK_BLOCK_UNSUPPORTED" : "DRYDOCK_BLOCK_CORRUPT",
          status: parsed.compatibilityStatus === "UNSUPPORTED" ? "UNSUPPORTED" : "CORRUPT_OR_INVALID",
          blockId: block.id,
          message: "This Passage cannot be interpreted by the governed reader.",
        });
      }
    }
  }
  const status = resultStatus(findings);
  const warnings = findings.map((finding) => finding.code).sort((left, right) => left.localeCompare(right, "en"));
  const unsigned = {
    sourceChecksum,
    policyVersion: DRYDOCK_COMPATIBILITY_POLICY_VERSION,
    status,
    warnings,
    findings,
    sourceSchemaVersion: snapshot.schemaVersion,
    supportedBlockCount,
  };
  return { ...unsigned, digest: canonicalChecksum(unsigned) };
}

export function migrationPreviewForHistoricalSnapshot(snapshot: PublishedTaleSnapshot) {
  const assessment = assessDrydockCompatibility(snapshot);
  return {
    sourceChecksum: assessment.sourceChecksum,
    status: assessment.status,
    safeSummary: assessment.findings.map((finding) => ({
      code: finding.code,
      blockId: finding.blockId ?? null,
      message: finding.message,
    })),
    createsNewDraftOnly: true,
    mutatesPublishedSnapshot: false,
  };
}
