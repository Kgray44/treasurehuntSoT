import { parsePublishedSnapshot } from "@/chronicle/publishing";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { canonicalChecksum } from "@/drydock/canonical";
import {
  DRYDOCK_SIMULATION_ENGINE_VERSION,
  ONE_VOYAGE_TRANSITION_ADAPTER_VERSION,
  runDrydockScenario,
  type DrydockSimulationResult,
} from "@/drydock/simulation/engine";
import { parseDrydockScenario } from "@/drydock/simulation/schema";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import { db } from "@/lib/db";

const LEASE_DURATION_MS = 10 * 60_000;

export class DrydockSimulationSourceChangedError extends Error {
  constructor() {
    super("This Scenario no longer matches the current Chronicle source. Save a new Scenario revision before running it.");
  }
}

export class DrydockSimulationUnavailableError extends Error {
  constructor(message = "This simulation run is not available for the current Chronicle.") {
    super(message);
  }
}

export type DrydockSimulationRunSummary = Readonly<{
  runId: string;
  scenarioId: string | null;
  sourceChecksum: string;
  sourceRevision: number;
  status: string;
  resultDigest: string | null;
  coverageDigest: string | null;
  completedInputs: number;
  cancellationRequested: boolean;
  createdAt: string;
  completedAt: string | null;
}>;

function summary(run: {
  runId: string;
  sourceChecksum: string;
  sourceRevision: number;
  status: string;
  resultDigest: string | null;
  coverageDigest: string | null;
  completedInputs: number;
  cancellationRequestedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  scenarioRevision?: { scenarioRecord?: { scenarioId: string } | null } | null;
}): DrydockSimulationRunSummary {
  return {
    runId: run.runId,
    scenarioId: run.scenarioRevision?.scenarioRecord?.scenarioId ?? null,
    sourceChecksum: run.sourceChecksum,
    sourceRevision: run.sourceRevision,
    status: run.status,
    resultDigest: run.resultDigest,
    coverageDigest: run.coverageDigest,
    completedInputs: run.completedInputs,
    cancellationRequested: Boolean(run.cancellationRequestedAt),
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

function terminalResult(result: DrydockSimulationResult) {
  return {
    engineVersion: result.engineVersion,
    runtimeAdapterVersion: result.runtimeAdapterVersion,
    sourceChecksum: result.sourceChecksum,
    scenarioId: result.scenarioId,
    scenarioRevision: result.scenarioRevision,
    status: result.status,
    clock: result.clock,
    random: result.random,
    coverage: result.coverage,
    assertions: result.assertions,
    traceDigest: result.traceDigest,
  };
}

/**
 * Creates a durable, source-frozen run. The caller supplies only a server-derived
 * Studio snapshot; the Scenario itself is reloaded from its immutable revision.
 */
export async function scheduleDrydockSimulation(input: {
  taleId: string;
  scenarioId: string;
  revision?: number;
  snapshot: PublishedTaleSnapshot;
}) {
  const sourceChecksum = drydockSimulationSourceChecksum(input.snapshot);
  return db.$transaction(async (tx) => {
    const draft = await tx.taleDraft.findFirst({
      where: { taleId: input.taleId },
      orderBy: { revisionNumber: "desc" },
      select: { id: true, revisionNumber: true },
    });
    if (!draft) throw new DrydockSimulationUnavailableError("This Chronicle has no editable draft.");
    const record = await tx.drydockScenario.findFirst({
      where: { draftId: draft.id, scenarioId: input.scenarioId, archivedAt: null },
      select: {
        revisions: {
          where: input.revision ? { revision: input.revision } : undefined,
          orderBy: { revision: "desc" },
          take: 1,
          select: { id: true, revision: true, sourceChecksum: true, scenario: true },
        },
      },
    });
    const storedRevision = record?.revisions[0];
    if (!storedRevision) throw new DrydockSimulationUnavailableError("This Scenario revision is not available for the current Chronicle.");
    const scenario = parseDrydockScenario(JSON.parse(storedRevision.scenario));
    if (storedRevision.sourceChecksum !== sourceChecksum || scenario.sourceChecksum !== sourceChecksum)
      throw new DrydockSimulationSourceChangedError();
    const created = await tx.drydockSimulationRun.create({
      data: {
        draftId: draft.id,
        runId: `drydock-simulation-${crypto.randomUUID()}`,
        scenarioRevisionId: storedRevision.id,
        sourceChecksum,
        sourceRevision: draft.revisionNumber,
        engineVersion: DRYDOCK_SIMULATION_ENGINE_VERSION,
        adapterVersion: ONE_VOYAGE_TRANSITION_ADAPTER_VERSION,
        status: "QUEUED",
        sourceSnapshot: JSON.stringify(input.snapshot),
      },
      select: {
        runId: true,
        sourceChecksum: true,
        sourceRevision: true,
        status: true,
        resultDigest: true,
        coverageDigest: true,
        completedInputs: true,
        cancellationRequestedAt: true,
        createdAt: true,
        completedAt: true,
      },
    });
    return { ...summary(created), scenarioId: scenario.id, scenarioRevision: storedRevision.revision };
  });
}

/** Reclaims abandoned leases without altering completed receipts. Safe to call repeatedly from a worker tick. */
export async function recoverExpiredDrydockSimulationLeases(now = new Date()) {
  return db.drydockSimulationRun.updateMany({
    where: { status: "RUNNING", leaseExpiresAt: { lt: now }, completedAt: null },
    data: { status: "QUEUED", leaseToken: null, leaseExpiresAt: null },
  });
}

async function claimDrydockSimulationRun(taleId: string, runId: string) {
  const candidate = await db.drydockSimulationRun.findFirst({
    where: { runId, draft: { is: { taleId } } },
    select: { id: true, status: true },
  });
  if (!candidate) throw new DrydockSimulationUnavailableError();
  if (candidate.status !== "QUEUED") return null;
  const leaseToken = crypto.randomUUID();
  const now = new Date();
  const claimed = await db.drydockSimulationRun.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", leaseToken, leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS), startedAt: now },
  });
  if (claimed.count !== 1) return null;
  return db.drydockSimulationRun.findFirst({
    where: { id: candidate.id, leaseToken },
    include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } }, draft: { select: { taleId: true } } },
  });
}

/**
 * Executes a claimed run with bounded, pure semantics and writes a terminal receipt.
 * A separate worker can invoke this after schedule/recovery; it never reads or mutates a live TaleSession.
 */
export async function executeDrydockSimulationRun(taleId: string, runId: string) {
  const claimed = await claimDrydockSimulationRun(taleId, runId);
  if (!claimed) return getDrydockSimulationRun(taleId, runId);
  if (!claimed.scenarioRevision || !claimed.leaseToken) throw new DrydockSimulationUnavailableError("The Scenario revision is unavailable.");
  const scenario = parseDrydockScenario(JSON.parse(claimed.scenarioRevision.scenario));
  const snapshot = parsePublishedSnapshot(claimed.sourceSnapshot);
  const cancellationRequested = Boolean(claimed.cancellationRequestedAt);
  let result: DrydockSimulationResult;
  try {
    result = runDrydockScenario(snapshot, scenario, { cancelled: () => cancellationRequested });
  } catch {
    await db.drydockSimulationRun.updateMany({
      where: { id: claimed.id, leaseToken: claimed.leaseToken, status: "RUNNING" },
      data: { status: "FAILED", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, checkpoint: JSON.stringify({ status: "FAILED" }) },
    });
    return getDrydockSimulationRun(taleId, runId);
  }
  const persisted = terminalResult(result);
  await db.drydockSimulationRun.updateMany({
    where: { id: claimed.id, leaseToken: claimed.leaseToken, status: "RUNNING" },
    data: {
      status: result.status,
      resultDigest: canonicalChecksum(persisted),
      coverageDigest: canonicalChecksum(result.coverage),
      result: JSON.stringify(persisted),
      trace: JSON.stringify(result.trace),
      checkpoint: JSON.stringify({ status: result.status, traceDigest: result.traceDigest, completedInputs: result.trace.length }),
      completedInputs: result.trace.length,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  return getDrydockSimulationRun(taleId, runId);
}

export async function requestDrydockSimulationCancellation(taleId: string, runId: string) {
  const updated = await db.drydockSimulationRun.updateMany({
    where: { runId, draft: { is: { taleId } }, status: { in: ["QUEUED", "RUNNING"] } },
    data: { cancellationRequestedAt: new Date() },
  });
  return updated.count === 1;
}

export async function listDrydockSimulationRuns(taleId: string) {
  const runs = await db.drydockSimulationRun.findMany({
    where: { draft: { is: { taleId } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } },
  });
  return runs.map(summary);
}

/** The projection intentionally excludes the stored source snapshot and private scenario content. */
export async function getDrydockSimulationRun(taleId: string, runId: string) {
  const run = await db.drydockSimulationRun.findFirst({
    where: { runId, draft: { is: { taleId } } },
    include: { scenarioRevision: { include: { scenarioRecord: { select: { scenarioId: true } } } } },
  });
  if (!run) throw new DrydockSimulationUnavailableError();
  let result: unknown = {};
  let trace: unknown = [];
  try {
    result = JSON.parse(run.result);
    trace = JSON.parse(run.trace);
  } catch {
    throw new DrydockSimulationUnavailableError("This simulation receipt is malformed.");
  }
  return { summary: summary(run), result, trace };
}
