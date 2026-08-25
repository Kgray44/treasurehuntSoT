import type { PublishedTaleSnapshot } from "@/chronicle/types";
import {
  executeDrydockSimulationRun,
  scheduleDrydockSimulation,
  type DrydockSimulationRunSummary,
} from "@/drydock/simulation-store";
import { createDrydockCoverageReport } from "@/drydock/simulation/coverage";
import { canonicalChecksum } from "@/drydock/canonical";
import type { DrydockSimulationResult } from "@/drydock/simulation/engine";
import { parseDrydockScenarioSuite } from "@/drydock/simulation/suite";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import { DRYDOCK_COMPATIBILITY_POLICY_VERSION, DRYDOCK_REQUIRED_SUITE_POLICY_VERSION } from "@/drydock/readiness";
import { ONE_VOYAGE_TRANSITION_ADAPTER_VERSION } from "@/drydock/simulation/engine";
import { db } from "@/lib/db";

export class DrydockScenarioSuiteUnavailableError extends Error {
  constructor(message = "This Scenario Suite is not available for the current Chronicle.") {
    super(message);
  }
}

function suiteProjection(record: {
  suiteId: string;
  title: string;
  sourceChecksum: string;
  revision: number;
  updatedAt: Date;
  members: Array<{
    orderIndex: number;
    scenarioRevision: { revision: number; scenarioRecord: { scenarioId: string } };
  }>;
}) {
  return {
    suiteId: record.suiteId,
    title: record.title,
    sourceChecksum: record.sourceChecksum,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
    members: record.members
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((member) => ({
        scenarioId: member.scenarioRevision.scenarioRecord.scenarioId,
        revision: member.scenarioRevision.revision,
      })),
  };
}

export async function saveDrydockScenarioSuite(taleId: string, unchecked: unknown, currentSourceChecksum: string) {
  const suite = parseDrydockScenarioSuite(unchecked);
  if (suite.sourceChecksum !== currentSourceChecksum) throw new Error("DRYDOCK_SUITE_STALE_SOURCE");
  return db.$transaction(async (tx) => {
    const draft = await tx.taleDraft.findFirst({
      where: { taleId },
      orderBy: { revisionNumber: "desc" },
      select: { id: true },
    });
    if (!draft) throw new DrydockScenarioSuiteUnavailableError("This Chronicle has no editable draft.");
    const revisionIds: string[] = [];
    for (const member of suite.members) {
      const record = await tx.drydockScenario.findFirst({
        where: { draftId: draft.id, scenarioId: member.scenarioId, archivedAt: null },
        select: {
          revisions: { where: { revision: member.revision }, take: 1, select: { id: true, sourceChecksum: true } },
        },
      });
      const revision = record?.revisions[0];
      if (!revision || revision.sourceChecksum !== currentSourceChecksum)
        throw new DrydockScenarioSuiteUnavailableError(
          "Every Suite member must be a current-source Scenario revision.",
        );
      revisionIds.push(revision.id);
    }
    const existing = await tx.drydockScenarioSuite.findFirst({
      where: { draftId: draft.id, suiteId: suite.id },
      select: { id: true },
    });
    const memberData = revisionIds.map((scenarioRevisionId, orderIndex) => ({ scenarioRevisionId, orderIndex }));
    const record = existing
      ? await tx.drydockScenarioSuite.update({
          where: { id: existing.id },
          data: {
            title: suite.title,
            sourceChecksum: suite.sourceChecksum,
            revision: { increment: 1 },
            archivedAt: null,
            members: { deleteMany: {}, create: memberData },
          },
          include: {
            members: {
              include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } },
            },
          },
        })
      : await tx.drydockScenarioSuite.create({
          data: {
            draftId: draft.id,
            suiteId: suite.id,
            title: suite.title,
            sourceChecksum: suite.sourceChecksum,
            members: { create: memberData },
          },
          include: {
            members: {
              include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } },
            },
          },
        });
    return suiteProjection(record);
  });
}

export async function listDrydockScenarioSuites(taleId: string) {
  const records = await db.drydockScenarioSuite.findMany({
    where: { draft: { is: { taleId } }, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } } },
    },
  });
  return records.map(suiteProjection);
}

export async function runDrydockScenarioSuite(taleId: string, suiteId: string, snapshot: PublishedTaleSnapshot) {
  const record = await db.drydockScenarioSuite.findFirst({
    where: { draft: { is: { taleId } }, suiteId, archivedAt: null },
    include: {
      members: {
        orderBy: { orderIndex: "asc" },
        include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } },
      },
    },
  });
  if (!record) throw new DrydockScenarioSuiteUnavailableError();
  const sourceChecksum = drydockSimulationSourceChecksum(snapshot);
  if (record.sourceChecksum !== sourceChecksum)
    throw new DrydockScenarioSuiteUnavailableError(
      "This Scenario Suite no longer matches the current Chronicle source. Save a current-source Suite before running it.",
    );
  const runs: Array<{
    scenarioId: string;
    revision: number;
    run: Awaited<ReturnType<typeof executeDrydockSimulationRun>>;
  }> = [];
  for (const member of record.members) {
    const queued = await scheduleDrydockSimulation({
      taleId,
      scenarioId: member.scenarioRevision.scenarioRecord.scenarioId,
      revision: member.scenarioRevision.revision,
      snapshot,
    });
    runs.push({
      scenarioId: member.scenarioRevision.scenarioRecord.scenarioId,
      revision: member.scenarioRevision.revision,
      run: await executeDrydockSimulationRun(taleId, queued.runId),
    });
  }
  const summaries = runs.map(({ run }) => run.summary as DrydockSimulationRunSummary);
  const results = runs.map(({ run }) => run.result as DrydockSimulationResult);
  const coverage = createDrydockCoverageReport(snapshot, results);
  const proofStatus =
    summaries.every((run) => run.status === "COMPLETED") && coverage.proofStatus === "COMPLETE"
      ? "COMPLETE"
      : "INCOMPLETE_PROOF";
  const evidence = await db.drydockScenarioSuiteEvidence.create({
    data: {
      draftId: record.draftId,
      suiteRecordId: record.id,
      suiteRevision: record.revision,
      sourceChecksum,
      schemaRegistryVersion: 2,
      ruleCatalogVersion: 1,
      runtimeAdapterVersion: ONE_VOYAGE_TRANSITION_ADAPTER_VERSION,
      requiredSuitePolicyVersion: DRYDOCK_REQUIRED_SUITE_POLICY_VERSION,
      compatibilityPolicyVersion: DRYDOCK_COMPATIBILITY_POLICY_VERSION,
      runIds: JSON.stringify(runs.map(({ run }) => run.summary.runId).sort()),
      coverageDigest: canonicalChecksum(coverage),
      proofStatus,
    },
    select: {
      id: true,
      sourceChecksum: true,
      suiteRevision: true,
      coverageDigest: true,
      proofStatus: true,
      createdAt: true,
    },
  });
  return {
    suite: suiteProjection(record),
    runs,
    coverage,
    proofStatus,
    evidence: { ...evidence, createdAt: evidence.createdAt.toISOString() },
  };
}
