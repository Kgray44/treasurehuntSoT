import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import type { DrydockScenario } from "@/drydock/simulation/model";
import { parseDrydockScenario } from "@/drydock/simulation/schema";

export class DrydockScenarioRevisionConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function parseStoredScenario(raw: string): DrydockScenario {
  try {
    return parseDrydockScenario(JSON.parse(raw));
  } catch {
    throw new Error("DRYDOCK_STORED_SCENARIO_INVALID");
  }
}

function scenarioSummary(scenario: DrydockScenario, createdAt: Date) {
  return {
    scenarioId: scenario.id,
    revision: scenario.revision,
    sourceChecksum: scenario.sourceChecksum,
    title: scenario.title,
    purpose: scenario.purpose,
    tags: [...scenario.tags],
    createdAt: createdAt.toISOString(),
  };
}

/**
 * Scenario persistence is revision-only. Callers must separately derive the
 * source checksum from their authorized current Chronicle before saving/running.
 */
export async function saveDrydockScenario(taleId: string, unchecked: unknown) {
  const scenario = parseDrydockScenario(unchecked);
  const saved = await db.$transaction(async (tx) => {
    const draft = await tx.taleDraft.findFirst({
      where: { taleId },
      orderBy: { revisionNumber: "desc" },
      select: { id: true },
    });
    if (!draft) throw new Error("This Chronicle has no editable draft.");
    const existing = await tx.drydockScenario.findFirst({
      where: { draftId: draft.id, scenarioId: scenario.id },
      select: { id: true, currentRevision: true },
    });
    const revisionData = {
      sourceChecksum: scenario.sourceChecksum,
      scenarioSchemaVersion: scenario.schemaVersion,
      scenarioDigest: canonicalChecksum(scenario),
      scenario: JSON.stringify(scenario),
    };
    if (!existing) {
      if (scenario.revision !== 1)
        throw new DrydockScenarioRevisionConflictError("A new Scenario must begin at revision 1.");
      return tx.drydockScenario.create({
        data: {
          draftId: draft.id,
          scenarioId: scenario.id,
          title: scenario.title,
          currentRevision: scenario.revision,
          revisions: { create: { revision: scenario.revision, ...revisionData } },
        },
        include: { revisions: true },
      });
    }
    if (scenario.revision !== existing.currentRevision + 1)
      throw new DrydockScenarioRevisionConflictError(
        "Scenario revision is stale. Reload the current revision before saving.",
      );
    return tx.drydockScenario.update({
      where: { id: existing.id },
      data: {
        title: scenario.title,
        currentRevision: scenario.revision,
        revisions: { create: { revision: scenario.revision, ...revisionData } },
      },
      include: { revisions: true },
    });
  });
  const revision = saved.revisions.find((candidate) => candidate.revision === scenario.revision);
  if (!revision) throw new Error("DRYDOCK_SCENARIO_REVISION_NOT_PERSISTED");
  return scenarioSummary(scenario, revision.createdAt);
}

export async function listDrydockScenarios(taleId: string) {
  const records = await db.drydockScenario.findMany({
    where: { draft: { is: { taleId } }, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
  });
  return records.flatMap((record) => {
    const revision = record.revisions[0];
    if (!revision) return [];
    const scenario = parseStoredScenario(revision.scenario);
    return [scenarioSummary(scenario, revision.createdAt)];
  });
}

export async function getDrydockScenario(taleId: string, scenarioId: string, revision?: number) {
  const record = await db.drydockScenario.findFirst({
    where: { draft: { is: { taleId } }, scenarioId, archivedAt: null },
    select: {
      revisions: {
        where: revision ? { revision } : undefined,
        orderBy: { revision: "desc" },
        take: 1,
        select: { scenario: true },
      },
    },
  });
  const stored = record?.revisions[0];
  return stored ? parseStoredScenario(stored.scenario) : null;
}

/** Duplicates only a parsed immutable Scenario revision; no client-owned fields are trusted. */
export async function duplicateDrydockScenario(taleId: string, scenarioId: string, revision?: number) {
  const source = await getDrydockScenario(taleId, scenarioId, revision);
  if (!source) return null;
  const duplicate: DrydockScenario = {
    ...source,
    id: `scenario-${crypto.randomUUID()}`,
    revision: 1,
    title: `${source.title} copy`.slice(0, 240),
  };
  return saveDrydockScenario(taleId, duplicate);
}

/** Archives Scenario discovery only; immutable revisions and existing Run receipts are retained. */
export async function archiveDrydockScenario(taleId: string, scenarioId: string) {
  const updated = await db.drydockScenario.updateMany({
    where: { scenarioId, archivedAt: null, draft: { is: { taleId } } },
    data: { archivedAt: new Date() },
  });
  return updated.count === 1;
}
