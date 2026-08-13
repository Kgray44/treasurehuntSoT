import type { TideglassResult, TideglassComparisonResult } from "./core";

/**
 * The only operational projection Tideglass offers to privileged consumers.
 * It intentionally excludes authored snapshot, annotation, and account data.
 */
export function tideglassDiagnosticProjection(result: TideglassResult<TideglassComparisonResult>) {
  if (!result.ok)
    return {
      available: false,
      failureCode: result.code,
      correlationId: result.correlationId ?? null,
    };

  const { changeSet, operation } = result.value;
  return {
    available: true,
    comparisonId: changeSet.comparisonId,
    chronicleId: changeSet.pair.chronicleId,
    sourceEditionId: changeSet.pair.source.editionId,
    sourceChecksum: changeSet.pair.source.editionChecksum,
    targetEditionId: changeSet.pair.target.editionId,
    targetChecksum: changeSet.pair.target.editionChecksum,
    semanticSchemaVersion: changeSet.semanticSchemaVersion,
    comparisonPolicyVersion: changeSet.comparisonPolicyVersion,
    changeSetDigest: changeSet.deterministicDigest,
    comparisonStatus: changeSet.status,
    categoryCounts: changeSet.categoryCounts,
    unsupportedSections: changeSet.unsupportedSections.map(({ section, code, sourceSchemaVersion }) => ({
      section,
      code,
      ...(sourceSchemaVersion === undefined ? {} : { sourceSchemaVersion }),
    })),
    cacheStatus: operation.cacheStatus,
    timing: {
      normalizationDurationMs: operation.normalizationDurationMs,
      comparisonDurationMs: operation.comparisonDurationMs,
      totalDurationMs: operation.totalDurationMs,
    },
    correlationId: operation.correlationId,
  };
}
