import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validationCount: vi.fn(),
  suiteCount: vi.fn(),
  compatibilityGroupBy: vi.fn(),
  staleExternalCount: vi.fn(),
  waiverGroupBy: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    drydockValidationRun: { count: mocks.validationCount },
    drydockScenarioSuiteEvidence: { count: mocks.suiteCount },
    drydockCompatibilityRun: { groupBy: mocks.compatibilityGroupBy },
    drydockExternalEvidenceReference: { count: mocks.staleExternalCount },
    drydockRuleWaiver: { groupBy: mocks.waiverGroupBy },
  },
}));

import { drydockSupportMetrics } from "@/drydock/metrics";

describe("Drydock support metrics", () => {
  beforeEach(() => {
    mocks.validationCount.mockResolvedValue(4);
    mocks.suiteCount.mockResolvedValue(3);
    mocks.compatibilityGroupBy.mockResolvedValue([{ status: "COMPATIBLE", _count: { _all: 2 } }]);
    mocks.staleExternalCount.mockResolvedValue(1);
    mocks.waiverGroupBy.mockResolvedValue([{ ruleCode: "DD-WARN", _count: { _all: 5 } }]);
  });

  it("returns only aggregate, deterministically ordered support facts", async () => {
    await expect(drydockSupportMetrics(new Date("2026-08-13T00:00:00.000Z"))).resolves.toMatchObject({
      validationRunCount: 4,
      scenarioSuiteEvidenceCount: 3,
      compatibilityResultCounts: { COMPATIBLE: 2 },
      staleExternalEvidenceCount: 1,
      waiverCountsByRuleCode: { "DD-WARN": 5 },
      unavailableMetrics: ["historicalReaderFailureCount", "publishingGateFailureCount", "readinessStateCounts"],
    });
  });
});
