import { db } from "@/lib/db";
import { drydockAdjacentAdapters } from "@/drydock/adapters";

type CountRow = { status?: string; ruleCode?: string; _count: { _all: number } };
type MetricsDb = {
  drydockValidationRun: { count(): Promise<number> };
  drydockScenarioSuiteEvidence: { count(): Promise<number> };
  drydockCompatibilityRun: { groupBy(input: unknown): Promise<CountRow[]> };
  drydockExternalEvidenceReference: { count(input: unknown): Promise<number> };
  drydockRuleWaiver: { groupBy(input: unknown): Promise<CountRow[]> };
};
const metricsDb = db as unknown as MetricsDb;

const orderedCounts = (rows: readonly CountRow[], field: "status" | "ruleCode") =>
  Object.fromEntries(
    rows
      .filter((row): row is CountRow & Required<Pick<CountRow, typeof field>> => typeof row[field] === "string")
      .map((row) => [row[field], row._count._all] as const)
      .sort(([left], [right]) => left.localeCompare(right, "en")),
  );

/**
 * Aggregate-only support projection. It intentionally has no Chronicle, account,
 * narrative, location, answer, raw evidence, session, or storage-key dimensions.
 */
export async function drydockSupportMetrics(now = new Date()) {
  const [validationRunCount, scenarioSuiteEvidenceCount, compatibilityRows, staleExternalEvidenceCount, waiverRows] =
    await Promise.all([
      metricsDb.drydockValidationRun.count(),
      metricsDb.drydockScenarioSuiteEvidence.count(),
      metricsDb.drydockCompatibilityRun.groupBy({ by: ["status"], _count: { _all: true } }),
      metricsDb.drydockExternalEvidenceReference.count({
        where: {
          OR: [
            { status: { in: ["EXPIRED", "MISSING", "UNAVAILABLE", "EXTERNAL_VALIDATION_REQUIRED"] } },
            { expiresAt: { lt: now } },
          ],
        },
      }),
      metricsDb.drydockRuleWaiver.groupBy({ by: ["ruleCode"], _count: { _all: true } }),
    ]);
  return {
    schemaVersion: 1 as const,
    generatedAt: now.toISOString(),
    validationRunCount,
    scenarioSuiteEvidenceCount,
    compatibilityResultCounts: orderedCounts(compatibilityRows, "status"),
    staleExternalEvidenceCount,
    waiverCountsByRuleCode: orderedCounts(waiverRows, "ruleCode"),
    adapterStateCounts: Object.fromEntries(
      [...new Set(drydockAdjacentAdapters.map((adapter) => adapter.state))]
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((state) => [state, drydockAdjacentAdapters.filter((adapter) => adapter.state === state).length]),
    ),
    unavailableMetrics: ["historicalReaderFailureCount", "publishingGateFailureCount", "readinessStateCounts"],
  };
}
