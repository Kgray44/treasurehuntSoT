import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type NightwatchProjectionState = "AVAILABLE" | "UNAVAILABLE" | "DEGRADED";

export interface BridgewatchNightwatchProjection {
  schemaVersion: 1;
  observedAt: string;
  state: NightwatchProjectionState;
  detail: string | null;
  candidates: Array<{
    id: string;
    objectiveId: string;
    project: string;
    increment: string;
    branch: string;
    productHeadSha: string;
    localBaseSha: string;
    createdAt: string;
    state: string;
    active: boolean;
    predecessorId: string | null;
    terminalReason: string | null;
    ageMs: number;
    blockers: string[];
  }>;
  queue: Array<{
    candidateId: string;
    readyAt: string;
    priority: number;
    dependencies: string[];
    migrationReservationIds: string[];
    sharedOwnershipClasses: string[];
    blockers: string[];
    focusedEvidence: string[];
    downstreamUnblockValue: number;
    risk: number;
    estimatedSize: number;
    queueState: string;
    reconciliationCount: number;
  }>;
  queueFront: string | null;
  migrationReservations: Array<{
    id: string;
    family: string;
    startId: number;
    endId: number;
    project: string;
    objectiveId: string;
    candidateId: string | null;
    allocatedAt: string;
    expiresAt: string;
    state: string;
  }>;
  migrationCollisions: Array<{ family: string; id: number; directories: string[] }>;
  leases: Array<{
    id: string;
    type: string;
    scope: string;
    owner: string;
    candidateId: string | null;
    issuedAt: string;
    expiresAt: string;
    state: string;
  }>;
  integrationLifecycleState: string;
  acceptanceOwnership: string | null;
  transactions: Array<{
    id: string;
    candidateId: string;
    cascadeId: string;
    candidateSha: string;
    candidateTreeSha: string;
    baseSha: string;
    baseTreeSha: string;
    candidateRef: string;
    state: string;
    authorityRunId: string | null;
    bindingRunId: string | null;
    authorityResult: string | null;
    bindingResult: string | null;
    leaseId: string | null;
    lastSemanticInvalidation: string | null;
    preservedEvidenceCount: number;
    rerunEvidenceCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  cascades: Array<{
    id: string;
    rootFingerprint: string;
    maintenancePrCount: number;
    authorityAttempts: number;
    mainlineRebuilds: number;
    blockedCandidates: string[];
    status: string;
  }>;
}

const unavailable = (
  state: Exclude<NightwatchProjectionState, "AVAILABLE">,
  detail: string | null,
): BridgewatchNightwatchProjection => ({
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  state,
  detail,
  candidates: [],
  queue: [],
  queueFront: null,
  migrationReservations: [],
  migrationCollisions: [],
  leases: [],
  integrationLifecycleState: "IDLE",
  acceptanceOwnership: null,
  transactions: [],
  cascades: [],
});

const array = (value: string, label: string) => {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string"))
    throw new Error(`Malformed ${label}`);
  return parsed;
};

const repositoryCollisions = (repositoryRoot: string) => {
  const families: Array<{ family: string; path: string; pattern: RegExp }> = [
    { family: "sqlite", path: resolve(repositoryRoot, "prisma", "migrations"), pattern: /^(\d{14})_/u },
    { family: "mysql", path: resolve(repositoryRoot, "prisma", "mysql-migrations"), pattern: /^(\d+)_/u },
  ];
  return families.flatMap((family) => {
    if (!existsSync(family.path)) return [];
    const found = new Map<number, string[]>();
    for (const entry of readdirSync(family.path, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(family.pattern);
      if (!match) continue;
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id)) continue;
      found.set(id, [...(found.get(id) ?? []), entry.name]);
    }
    return [...found.entries()]
      .filter(([, directories]) => directories.length > 1)
      .map(([id, directories]) => ({ family: family.family, id, directories: directories.sort() }));
  });
};

export function readNightwatchProjection(
  databasePath: string,
  repositoryRoot: string,
  now = Date.now(),
): BridgewatchNightwatchProjection {
  if (!existsSync(databasePath)) return unavailable("UNAVAILABLE", "Nightwatch has not created a local ledger yet.");
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(databasePath);
    const queues = (
      db.prepare("SELECT * FROM integration_queue ORDER BY ready_at, candidate_id").all() as Array<
        Record<string, unknown>
      >
    ).map((row) => ({
      candidateId: String(row.candidate_id),
      readyAt: String(row.ready_at),
      priority: Number(row.priority),
      dependencies: array(String(row.dependencies_json), "dependencies"),
      migrationReservationIds: array(String(row.migration_reservations_json), "migration reservations"),
      sharedOwnershipClasses: array(String(row.ownership_classes_json), "ownership classes"),
      blockers: array(String(row.blockers_json), "blockers"),
      focusedEvidence: array(String(row.focused_evidence_json), "focused evidence"),
      downstreamUnblockValue: Number(row.downstream_unblock_value),
      risk: Number(row.risk),
      estimatedSize: Number(row.estimated_size),
      queueState: String(row.queue_state),
      reconciliationCount: Number(row.reconciliation_count),
    }));
    const candidates = (
      db.prepare("SELECT * FROM candidates ORDER BY created_at, candidate_id").all() as Array<Record<string, unknown>>
    ).map((row) => {
      const queue = queues.find((entry) => entry.candidateId === row.candidate_id);
      const ageFrom = queue?.readyAt ?? String(row.created_at);
      return {
        id: String(row.candidate_id),
        objectiveId: String(row.objective_id),
        project: String(row.project),
        increment: String(row.increment),
        branch: String(row.branch),
        productHeadSha: String(row.product_head_sha),
        localBaseSha: String(row.local_base_sha),
        createdAt: String(row.created_at),
        state: String(row.state),
        active: Boolean(row.active),
        predecessorId: row.predecessor_id ? String(row.predecessor_id) : null,
        terminalReason: row.terminal_reason ? String(row.terminal_reason) : null,
        ageMs: Math.max(0, now - Date.parse(ageFrom)),
        blockers: queue?.blockers ?? [],
      };
    });
    const leases = (
      db.prepare("SELECT * FROM leases ORDER BY issued_at, lease_id").all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.lease_id),
      type: String(row.lease_type),
      scope: String(row.scope),
      owner: String(row.owner),
      candidateId: row.candidate_id ? String(row.candidate_id) : null,
      issuedAt: String(row.issued_at),
      expiresAt: String(row.expires_at),
      state: String(row.state),
    }));
    const tableExists = (name: string) =>
      Boolean(db!.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
    const transactions = tableExists("acceptance_transactions")
      ? (db.prepare("SELECT * FROM acceptance_transactions ORDER BY updated_at DESC, transaction_id").all() as Array<Record<string, unknown>>).map(
          (row) => ({
            id: String(row.transaction_id),
            candidateId: String(row.candidate_id),
            cascadeId: String(row.cascade_id),
            candidateSha: String(row.candidate_sha),
            candidateTreeSha: String(row.candidate_tree_sha),
            baseSha: String(row.base_sha),
            baseTreeSha: String(row.base_tree_sha),
            candidateRef: String(row.candidate_ref),
            state: String(row.state),
            authorityRunId: row.authority_run_id ? String(row.authority_run_id) : null,
            bindingRunId: row.binding_run_id ? String(row.binding_run_id) : null,
            authorityResult: row.authority_result ? String(row.authority_result) : null,
            bindingResult: row.binding_result ? String(row.binding_result) : null,
            leaseId: row.lease_id ? String(row.lease_id) : null,
            lastSemanticInvalidation: row.last_semantic_invalidation ? String(row.last_semantic_invalidation) : null,
            preservedEvidenceCount: Number(row.preserved_evidence_count),
            rerunEvidenceCount: Number(row.rerun_evidence_count),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
          }),
        )
      : [];
    const cascades = tableExists("integration_cascades")
      ? (db.prepare("SELECT * FROM integration_cascades ORDER BY started_at, cascade_id").all() as Array<Record<string, unknown>>).map(
          (row) => ({
            id: String(row.cascade_id),
            rootFingerprint: String(row.root_fingerprint),
            maintenancePrCount: Number(row.maintenance_pr_count),
            authorityAttempts: Number(row.authority_attempts),
            mainlineRebuilds: Number(row.mainline_rebuilds),
            blockedCandidates: array(String(row.blocked_candidates_json), "cascade blocked candidates"),
            status: String(row.status),
          }),
        )
      : [];
    const reservations = (
      db.prepare("SELECT * FROM migration_reservations ORDER BY allocated_at, reservation_id").all() as Array<
        Record<string, unknown>
      >
    ).map((row) => ({
      id: String(row.reservation_id),
      family: String(row.family),
      startId: Number(row.start_id),
      endId: Number(row.end_id),
      project: String(row.project),
      objectiveId: String(row.objective_id),
      candidateId: row.candidate_id ? String(row.candidate_id) : null,
      allocatedAt: String(row.allocated_at),
      expiresAt: String(row.expires_at),
      state: String(row.state),
    }));
    const front = candidates.find((candidate) =>
      ["QUEUE_FRONT", "RECONCILING", "QUALIFYING", "ACCEPTANCE_PENDING"].includes(candidate.state),
    );
    const acceptance = leases.find((lease) => lease.type === "INTEGRATION_ACCEPTANCE" && lease.state === "ACTIVE");
    return {
      schemaVersion: 1,
      observedAt: new Date(now).toISOString(),
      state: "AVAILABLE",
      detail: null,
      candidates,
      queue: queues,
      queueFront: front?.id ?? null,
      migrationReservations: reservations,
      migrationCollisions: repositoryCollisions(repositoryRoot),
      leases,
      integrationLifecycleState: transactions.find((transaction) => !["INTEGRATED", "POST_MERGE_VERIFIED"].includes(transaction.state))?.state ?? front?.state ?? "IDLE",
      acceptanceOwnership: acceptance?.id ?? null,
      transactions,
      cascades,
    };
  } catch {
    return unavailable("DEGRADED", "Nightwatch ledger data is unavailable or malformed; no mutation was attempted.");
  } finally {
    db?.close();
  }
}
