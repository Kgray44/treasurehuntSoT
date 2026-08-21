import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const candidateStates = [
  "IMPLEMENTING",
  "LOCALLY_COMPLETE",
  "QUEUE_READY",
  "QUEUED",
  "QUEUE_FRONT",
  "RECONCILING",
  "QUALIFYING",
  "ACCEPTANCE_PENDING",
  "INTEGRATED",
  "POST_MERGE_VERIFIED",
  "BLOCKED_BY_BOSUN",
  "PARKED_OWNER_REQUIRED",
  "PARKED_LOOP_GUARD",
  "SUPERSEDED",
  "WITHDRAWN",
] as const;

export type CandidateState = (typeof candidateStates)[number];
export type LeaseType =
  | "SOURCE_WRITE"
  | "MIGRATION_RANGE"
  | "SOUNDING_LINE_POLICY"
  | "BROWSER_RUNTIME"
  | "GENERATED_REGISTRY"
  | "GITHUB_PR_LINEAGE"
  | "WORKTREE"
  | "INTEGRATION_ACCEPTANCE"
  | "CONTROLLER";
export type ReservationState = "ACTIVE" | "RELEASED" | "EXPIRED" | "CONSUMED";
export type LeaseState = "ACTIVE" | "RELEASED" | "EXPIRED";

/** The A.1 acceptance state is deliberately separate from the broad queue state. */
export const acceptanceTransactionStates = [
  "RECONCILING",
  "REQUALIFYING",
  "CANDIDATE_FROZEN",
  "AWAITING_AUTHORITY",
  "AUTHORITY_RUNNING",
  "AUTHORITY_ACCEPTED",
  "AUTHORITY_REJECTED",
  "BINDING_PENDING",
  "BINDING_RUNNING",
  "BINDING_PASS",
  "BINDING_REJECTED",
  "MERGING",
  "MERGE_RACE",
  "INTEGRATED",
  "POST_MERGE_VERIFIED",
  "SHARED_BLOCKED",
  "PARKED_INTEGRATION_BREAKER",
] as const;
export type AcceptanceTransactionState = (typeof acceptanceTransactionStates)[number];
export type AcceptanceRunStage = "AUTHORITY" | "BINDING";
export type AcceptanceRunStatus = "RUNNING" | "RELEASE_GO" | "REJECTED" | "BINDING_PASS" | "BINDING_REJECTED";

export interface ExactCandidateIdentity {
  candidateSha: string;
  candidateTreeSha: string;
  baseSha: string;
  baseTreeSha: string;
  candidateRef: string;
}

export interface AcceptanceTransaction extends ExactCandidateIdentity {
  id: string;
  candidateId: string;
  cascadeId: string;
  state: AcceptanceTransactionState;
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
}

export interface AcceptanceRun {
  id: string;
  transactionId: string;
  stage: AcceptanceRunStage;
  dispatchKey: string;
  externalRunId: string | null;
  status: AcceptanceRunStatus;
  dispatchedAt: string;
  completedAt: string | null;
}

export interface IntegrationCascade {
  id: string;
  rootFingerprint: string;
  rootIdentity: string;
  startedAt: string;
  maintenancePrCount: number;
  authorityAttempts: number;
  mainlineRebuilds: number;
  blockedCandidates: string[];
  status: "ACTIVE" | "WARNING" | "CONTROL_PLANE_REVIEW" | "PARKED_BREAKER";
}

export interface IntegrationBudgetStatus {
  cascadeId: string;
  elapsedMs: number;
  maintenanceAmplificationRatio: number;
  status: IntegrationCascade["status"];
  transactionId: string;
  productValueMs: number;
  controlPlaneActiveMs: number;
  controlPlaneWaitMs: number;
  externallyBlockedMs: number;
  descendantMaintenanceMs: number;
  authorityMs: number;
  browserMatrixMs: number;
  retryAndCooldownMs: number;
  noProgressCycles: number;
  remainingClosureSteps: string[];
  warningAtMs: number;
  hardReviewAtMs: number;
  breakerAtMs: number;
}

export interface IntegrationCostLedger {
  transactionId: string;
  cascadeId: string;
  startedAt: string;
  productValueMs: number;
  controlPlaneActiveMs: number;
  controlPlaneWaitMs: number;
  externallyBlockedMs: number;
  descendantMaintenanceMs: number;
  authorityMs: number;
  browserMatrixMs: number;
  retryAndCooldownMs: number;
  noProgressCycles: number;
  remainingClosureSteps: string[];
  warningAtMs: number;
  hardReviewAtMs: number;
  breakerAtMs: number;
}

export type NightwatchControllerState = "LIVE" | "DEGRADED" | "DOWN";

export interface NightwatchControllerHealth {
  instanceId: string | null;
  state: NightwatchControllerState;
  heartbeatAt: string | null;
  lastSuccessfulReconciliationAt: string | null;
  detail: string | null;
}

const terminalStates = new Set<CandidateState>(["POST_MERGE_VERIFIED", "SUPERSEDED", "WITHDRAWN"]);
const activeStates = new Set<CandidateState>(candidateStates.filter((state) => !terminalStates.has(state)));
const stateSet = new Set<string>(candidateStates);
const leaseTypes = new Set<string>([
  "SOURCE_WRITE",
  "MIGRATION_RANGE",
  "SOUNDING_LINE_POLICY",
  "BROWSER_RUNTIME",
  "GENERATED_REGISTRY",
  "GITHUB_PR_LINEAGE",
  "WORKTREE",
  "INTEGRATION_ACCEPTANCE",
  "CONTROLLER",
]);

const transitions: Record<CandidateState, readonly CandidateState[]> = {
  IMPLEMENTING: [
    "LOCALLY_COMPLETE",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  LOCALLY_COMPLETE: [
    "QUEUE_READY",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  QUEUE_READY: ["QUEUED", "BLOCKED_BY_BOSUN", "PARKED_OWNER_REQUIRED", "PARKED_LOOP_GUARD", "SUPERSEDED", "WITHDRAWN"],
  QUEUED: ["QUEUE_FRONT", "BLOCKED_BY_BOSUN", "PARKED_OWNER_REQUIRED", "PARKED_LOOP_GUARD", "SUPERSEDED", "WITHDRAWN"],
  QUEUE_FRONT: [
    "RECONCILING",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  RECONCILING: [
    "QUALIFYING",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  QUALIFYING: [
    "ACCEPTANCE_PENDING",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  ACCEPTANCE_PENDING: [
    "RECONCILING",
    "INTEGRATED",
    "BLOCKED_BY_BOSUN",
    "PARKED_OWNER_REQUIRED",
    "PARKED_LOOP_GUARD",
    "SUPERSEDED",
    "WITHDRAWN",
  ],
  INTEGRATED: ["POST_MERGE_VERIFIED"],
  POST_MERGE_VERIFIED: [],
  BLOCKED_BY_BOSUN: ["QUEUED", "PARKED_OWNER_REQUIRED", "PARKED_LOOP_GUARD", "SUPERSEDED", "WITHDRAWN"],
  PARKED_OWNER_REQUIRED: ["QUEUED", "SUPERSEDED", "WITHDRAWN"],
  PARKED_LOOP_GUARD: ["QUEUED", "SUPERSEDED", "WITHDRAWN"],
  SUPERSEDED: [],
  WITHDRAWN: [],
};

const forbiddenKey = /(?:secret|password|passwd|token|credential|cookie|authorization|private.?key)/iu;
const forbiddenValue = /(?:bearer\s+|gh[pousr]_)/iu;

export class NightwatchInvariantError extends Error {
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "NightwatchInvariantError";
  }
}

export interface CandidateInput {
  id: string;
  objectiveId: string;
  project: string;
  increment: string;
  branch: string;
  productHeadSha: string;
  localBaseSha: string;
  createdAt?: string;
  predecessorId?: string;
}

export interface Candidate extends CandidateInput {
  createdAt: string;
  state: CandidateState;
  active: boolean;
  terminalReason: string | null;
}

export interface QueueInput {
  priority?: number;
  readyAt?: string;
  dependencies?: string[];
  migrationReservationIds?: string[];
  sharedOwnershipClasses?: string[];
  blockers?: string[];
  focusedEvidence?: string[];
  downstreamUnblockValue?: number;
  risk?: number;
  estimatedSize?: number;
}

export interface QueueEntry extends Required<QueueInput> {
  candidateId: string;
  queueState: "WAITING" | "FRONT" | "BLOCKED" | "INTEGRATED";
  reconciliationCount: number;
}

export interface Lease {
  id: string;
  type: LeaseType;
  scope: string;
  owner: string;
  candidateId: string | null;
  issuedAt: string;
  expiresAt: string;
  state: LeaseState;
}

export interface MigrationReservation {
  id: string;
  family: string;
  startId: number;
  endId: number;
  project: string;
  objectiveId: string;
  candidateId: string | null;
  allocatedAt: string;
  expiresAt: string;
  state: ReservationState;
}

export interface MigrationFamilyInspection {
  family: "sqlite" | "mysql";
  path: string;
  ids: number[];
  ambiguous: boolean;
  collisions: Array<{ id: number; directories: string[] }>;
}

export interface NightwatchProjection {
  schemaVersion: 1;
  observedAt: string;
  state: "AVAILABLE";
  candidates: Array<Candidate & { ageMs: number; blockers: string[] }>;
  queue: QueueEntry[];
  queueFront: (Candidate & { ageMs: number; blockers: string[] }) | null;
  migrationReservations: MigrationReservation[];
  migrationCollisions: MigrationFamilyInspection[];
  leases: Lease[];
  integrationLifecycleState: CandidateState | "IDLE";
  acceptanceOwnership: Lease | null;
  controller: NightwatchControllerHealth;
}

type CandidateRow = {
  candidate_id: string;
  objective_id: string;
  project: string;
  increment: string;
  branch: string;
  product_head_sha: string;
  local_base_sha: string;
  created_at: string;
  state: string;
  active: number;
  predecessor_id: string | null;
  terminal_reason: string | null;
};

type QueueRow = {
  candidate_id: string;
  ready_at: string;
  priority: number;
  dependencies_json: string;
  migration_reservations_json: string;
  ownership_classes_json: string;
  blockers_json: string;
  focused_evidence_json: string;
  downstream_unblock_value: number;
  risk: number;
  estimated_size: number;
  queue_state: QueueEntry["queueState"];
  reconciliation_count: number;
};

type ReservationRow = {
  reservation_id: string;
  family: string;
  start_id: number;
  end_id: number;
  project: string;
  objective_id: string;
  candidate_id: string | null;
  allocated_at: string;
  expires_at: string;
  state: ReservationState;
};

type LeaseRow = {
  lease_id: string;
  lease_type: LeaseType;
  scope: string;
  owner: string;
  candidate_id: string | null;
  issued_at: string;
  expires_at: string;
  state: LeaseState;
};

const iso = (value = Date.now()) => new Date(value).toISOString();
const parse = <T>(value: string, label: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new NightwatchInvariantError("MALFORMED_PERSISTED_STATE", label);
  }
};
const requireText = (value: string, label: string) => {
  if (!value?.trim()) throw new NightwatchInvariantError("REQUIRED_VALUE_MISSING", label);
  return value.trim();
};
const assertSafe = (value: unknown, path = "value"): void => {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value).forEach(([key, item]) => {
      if (forbiddenKey.test(key)) throw new NightwatchInvariantError("SENSITIVE_DATA_REJECTED", path);
      assertSafe(item, `${path}.${key}`);
    });
  if (typeof value === "string" && forbiddenValue.test(value))
    throw new NightwatchInvariantError("SENSITIVE_DATA_REJECTED", path);
};
const json = (value: unknown) => {
  assertSafe(value);
  return JSON.stringify(value);
};
const boundedNumber = (value: number | undefined, fallback: number, label: string) => {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < 0) throw new NightwatchInvariantError("INVALID_NUMERIC_VALUE", label);
  return result;
};

export function defaultNightwatchDatabase(root = process.cwd()) {
  return join(root, ".nightwatch", "nightwatch.sqlite");
}

export function inspectMigrationFamilies(repositoryRoot: string): MigrationFamilyInspection[] {
  const families: Array<{ family: "sqlite" | "mysql"; relative: string; pattern: RegExp }> = [
    { family: "sqlite", relative: join("prisma", "migrations"), pattern: /^(\d{14})_/u },
    { family: "mysql", relative: join("prisma", "mysql-migrations"), pattern: /^(\d+)_/u },
  ];
  return families.map(({ family, relative, pattern }) => {
    const path = resolve(repositoryRoot, relative);
    const grouped = new Map<number, string[]>();
    if (existsSync(path))
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const match = entry.name.match(pattern);
        if (!match) continue;
        const id = Number(match[1]);
        if (!Number.isSafeInteger(id)) continue;
        grouped.set(id, [...(grouped.get(id) ?? []), entry.name]);
      }
    const collisions = [...grouped.entries()]
      .filter(([, directories]) => directories.length > 1)
      .map(([id, directories]) => ({ id, directories: directories.sort() }))
      .sort((left, right) => left.id - right.id);
    return {
      family,
      path,
      ids: [...grouped.keys()].sort((left, right) => left - right),
      ambiguous: collisions.length > 0,
      collisions,
    };
  });
}

export class NightwatchLedger {
  private readonly db: DatabaseSync;
  private readonly repositoryRoot: string | null;
  private transactionDepth = 0;

  constructor(
    readonly databasePath = defaultNightwatchDatabase(),
    options: { repositoryRoot?: string } = {},
  ) {
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
    this.repositoryRoot = options.repositoryRoot ? resolve(options.repositoryRoot) : null;
    try {
      this.db = new DatabaseSync(databasePath);
      this.db.exec("PRAGMA foreign_keys = ON");
      this.migrate();
      this.validatePersistedState();
    } catch (error) {
      throw error instanceof NightwatchInvariantError
        ? error
        : new NightwatchInvariantError(
            "NIGHTWATCH_LEDGER_UNAVAILABLE",
            error instanceof Error ? error.message : undefined,
          );
    }
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nightwatch_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS objectives (
        objective_id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        increment TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS candidates (
        candidate_id TEXT PRIMARY KEY,
        objective_id TEXT NOT NULL REFERENCES objectives(objective_id),
        project TEXT NOT NULL,
        increment TEXT NOT NULL,
        branch TEXT NOT NULL,
        product_head_sha TEXT NOT NULL,
        local_base_sha TEXT NOT NULL,
        created_at TEXT NOT NULL,
        state TEXT NOT NULL,
        active INTEGER NOT NULL CHECK(active IN (0, 1)),
        predecessor_id TEXT REFERENCES candidates(candidate_id),
        terminal_reason TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS candidates_one_active_per_objective
        ON candidates(objective_id) WHERE active = 1;
      CREATE TABLE IF NOT EXISTS integration_queue (
        candidate_id TEXT PRIMARY KEY REFERENCES candidates(candidate_id),
        ready_at TEXT NOT NULL,
        priority INTEGER NOT NULL,
        dependencies_json TEXT NOT NULL,
        migration_reservations_json TEXT NOT NULL,
        ownership_classes_json TEXT NOT NULL,
        blockers_json TEXT NOT NULL,
        focused_evidence_json TEXT NOT NULL,
        downstream_unblock_value INTEGER NOT NULL,
        risk INTEGER NOT NULL,
        estimated_size INTEGER NOT NULL,
        queue_state TEXT NOT NULL,
        reconciliation_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS migration_reservations (
        reservation_id TEXT PRIMARY KEY,
        family TEXT NOT NULL,
        start_id INTEGER NOT NULL,
        end_id INTEGER NOT NULL,
        project TEXT NOT NULL,
        objective_id TEXT NOT NULL,
        candidate_id TEXT,
        allocated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        state TEXT NOT NULL,
        CHECK(start_id <= end_id)
      );
      CREATE INDEX IF NOT EXISTS migration_reservations_active_range
        ON migration_reservations(family, state, start_id, end_id);
      CREATE TABLE IF NOT EXISTS leases (
        lease_id TEXT PRIMARY KEY,
        lease_type TEXT NOT NULL,
        scope TEXT NOT NULL,
        owner TEXT NOT NULL,
        candidate_id TEXT,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        state TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS leases_one_active_scope
        ON leases(lease_type, scope) WHERE state = 'ACTIVE';
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_entity_idx ON events(entity_type, entity_id, occurred_at);
      CREATE TABLE IF NOT EXISTS integration_cascades (
        cascade_id TEXT PRIMARY KEY,
        root_fingerprint TEXT NOT NULL UNIQUE,
        root_identity TEXT NOT NULL,
        started_at TEXT NOT NULL,
        maintenance_pr_count INTEGER NOT NULL DEFAULT 0,
        authority_attempts INTEGER NOT NULL DEFAULT 0,
        mainline_rebuilds INTEGER NOT NULL DEFAULT 0,
        blocked_candidates_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'ACTIVE'
      );
      CREATE TABLE IF NOT EXISTS acceptance_transactions (
        transaction_id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL REFERENCES candidates(candidate_id),
        cascade_id TEXT NOT NULL REFERENCES integration_cascades(cascade_id),
        candidate_sha TEXT NOT NULL,
        candidate_tree_sha TEXT NOT NULL,
        base_sha TEXT NOT NULL,
        base_tree_sha TEXT NOT NULL,
        candidate_ref TEXT NOT NULL,
        state TEXT NOT NULL,
        authority_run_id TEXT,
        binding_run_id TEXT,
        authority_result TEXT,
        binding_result TEXT,
        lease_id TEXT,
        last_semantic_invalidation TEXT,
        preserved_evidence_count INTEGER NOT NULL DEFAULT 0,
        rerun_evidence_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(candidate_id, candidate_sha, base_sha)
      );
      CREATE INDEX IF NOT EXISTS acceptance_transactions_candidate_idx ON acceptance_transactions(candidate_id, updated_at);
      CREATE TABLE IF NOT EXISTS acceptance_runs (
        run_id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES acceptance_transactions(transaction_id),
        stage TEXT NOT NULL,
        dispatch_key TEXT NOT NULL UNIQUE,
        external_run_id TEXT,
        status TEXT NOT NULL,
        dispatched_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS acceptance_runs_transaction_idx ON acceptance_runs(transaction_id, stage);
      CREATE TABLE IF NOT EXISTS controller_health (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        instance_id TEXT,
        state TEXT NOT NULL,
        heartbeat_at TEXT,
        last_successful_reconciliation_at TEXT,
        detail TEXT
      );
      CREATE TABLE IF NOT EXISTS integration_cost_ledger (
        cascade_id TEXT PRIMARY KEY REFERENCES integration_cascades(cascade_id),
        transaction_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        product_value_ms INTEGER NOT NULL DEFAULT 0,
        control_plane_active_ms INTEGER NOT NULL DEFAULT 0,
        control_plane_wait_ms INTEGER NOT NULL DEFAULT 0,
        externally_blocked_ms INTEGER NOT NULL DEFAULT 0,
        descendant_maintenance_ms INTEGER NOT NULL DEFAULT 0,
        authority_ms INTEGER NOT NULL DEFAULT 0,
        browser_matrix_ms INTEGER NOT NULL DEFAULT 0,
        retry_cooldown_ms INTEGER NOT NULL DEFAULT 0,
        no_progress_cycles INTEGER NOT NULL DEFAULT 0,
        remaining_closure_steps_json TEXT NOT NULL,
        warning_at_ms INTEGER NOT NULL,
        hard_review_at_ms INTEGER NOT NULL,
        breaker_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS maintenance_findings (
        cascade_id TEXT NOT NULL REFERENCES integration_cascades(cascade_id),
        fingerprint TEXT NOT NULL,
        generation INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(cascade_id, fingerprint)
      );
    `);
    this.db.prepare("INSERT OR IGNORE INTO nightwatch_migrations(version, applied_at) VALUES (1, ?)").run(iso());
    this.db.prepare("INSERT OR IGNORE INTO nightwatch_migrations(version, applied_at) VALUES (2, ?)").run(iso());
    this.db.prepare("INSERT OR IGNORE INTO nightwatch_migrations(version, applied_at) VALUES (3, ?)").run(iso());
    this.db.prepare("INSERT OR IGNORE INTO nightwatch_migrations(version, applied_at) VALUES (4, ?)").run(iso());
    this.db.prepare("INSERT OR IGNORE INTO controller_health(singleton, state) VALUES (1, 'DOWN')").run();
  }

  private validatePersistedState() {
    const candidates = this.db.prepare("SELECT candidate_id, state, active FROM candidates").all() as Array<{
      candidate_id: string;
      state: string;
      active: number;
    }>;
    for (const candidate of candidates) {
      if (!stateSet.has(candidate.state))
        throw new NightwatchInvariantError("MALFORMED_PERSISTED_STATE", candidate.candidate_id);
      if (Boolean(candidate.active) !== activeStates.has(candidate.state as CandidateState))
        throw new NightwatchInvariantError("MALFORMED_PERSISTED_STATE", candidate.candidate_id);
    }
    const queues = this.db
      .prepare(
        "SELECT candidate_id, dependencies_json, blockers_json, migration_reservations_json, ownership_classes_json, focused_evidence_json FROM integration_queue",
      )
      .all() as Array<Record<string, string>>;
    for (const queue of queues)
      for (const field of [
        "dependencies_json",
        "blockers_json",
        "migration_reservations_json",
        "ownership_classes_json",
        "focused_evidence_json",
      ]) {
        const value = parse<unknown>(queue[field]!, `integration_queue.${queue.candidate_id}.${field}`);
        if (!Array.isArray(value)) throw new NightwatchInvariantError("MALFORMED_PERSISTED_STATE", queue.candidate_id);
      }
  }

  private inTransaction<T>(operation: () => T): T {
    if (this.transactionDepth > 0) return operation();
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth += 1;
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  private event(entityType: string, entityId: string, eventType: string, payload: unknown, at = iso()) {
    this.db
      .prepare(
        "INSERT INTO events(event_id, occurred_at, entity_type, entity_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), at, entityType, entityId, eventType, json(payload));
  }

  private candidateRow(id: string): CandidateRow {
    const row = this.db.prepare("SELECT * FROM candidates WHERE candidate_id = ?").get(id) as CandidateRow | undefined;
    if (!row) throw new NightwatchInvariantError("CANDIDATE_NOT_FOUND", id);
    return row;
  }

  private candidate(row: CandidateRow): Candidate {
    if (!stateSet.has(row.state)) throw new NightwatchInvariantError("MALFORMED_PERSISTED_STATE", row.candidate_id);
    return {
      id: row.candidate_id,
      objectiveId: row.objective_id,
      project: row.project,
      increment: row.increment,
      branch: row.branch,
      productHeadSha: row.product_head_sha,
      localBaseSha: row.local_base_sha,
      createdAt: row.created_at,
      predecessorId: row.predecessor_id ?? undefined,
      state: row.state as CandidateState,
      active: Boolean(row.active),
      terminalReason: row.terminal_reason,
    };
  }

  private queueRow(id: string): QueueRow {
    const row = this.db.prepare("SELECT * FROM integration_queue WHERE candidate_id = ?").get(id) as
      | QueueRow
      | undefined;
    if (!row) throw new NightwatchInvariantError("QUEUE_ENTRY_NOT_FOUND", id);
    return row;
  }

  private queue(row: QueueRow): QueueEntry {
    return {
      candidateId: row.candidate_id,
      readyAt: row.ready_at,
      priority: row.priority,
      dependencies: parse<string[]>(row.dependencies_json, `${row.candidate_id}.dependencies`),
      migrationReservationIds: parse<string[]>(row.migration_reservations_json, `${row.candidate_id}.reservations`),
      sharedOwnershipClasses: parse<string[]>(row.ownership_classes_json, `${row.candidate_id}.ownership`),
      blockers: parse<string[]>(row.blockers_json, `${row.candidate_id}.blockers`),
      focusedEvidence: parse<string[]>(row.focused_evidence_json, `${row.candidate_id}.evidence`),
      downstreamUnblockValue: row.downstream_unblock_value,
      risk: row.risk,
      estimatedSize: row.estimated_size,
      queueState: row.queue_state,
      reconciliationCount: row.reconciliation_count,
    };
  }

  createCandidate(input: CandidateInput): Candidate {
    assertSafe(input);
    const candidate = {
      ...input,
      id: requireText(input.id, "candidate.id"),
      objectiveId: requireText(input.objectiveId, "candidate.objectiveId"),
      project: requireText(input.project, "candidate.project"),
      increment: requireText(input.increment, "candidate.increment"),
      branch: requireText(input.branch, "candidate.branch"),
      productHeadSha: requireText(input.productHeadSha, "candidate.productHeadSha"),
      localBaseSha: requireText(input.localBaseSha, "candidate.localBaseSha"),
      createdAt: input.createdAt ?? iso(),
    };
    return this.inTransaction(() => {
      this.db
        .prepare("INSERT OR IGNORE INTO objectives(objective_id, project, increment, created_at) VALUES (?, ?, ?, ?)")
        .run(candidate.objectiveId, candidate.project, candidate.increment, candidate.createdAt);
      try {
        this.db
          .prepare(
            "INSERT INTO candidates(candidate_id, objective_id, project, increment, branch, product_head_sha, local_base_sha, created_at, state, active, predecessor_id, terminal_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IMPLEMENTING', 1, ?, NULL)",
          )
          .run(
            candidate.id,
            candidate.objectiveId,
            candidate.project,
            candidate.increment,
            candidate.branch,
            candidate.productHeadSha,
            candidate.localBaseSha,
            candidate.createdAt,
            candidate.predecessorId ?? null,
          );
      } catch (error) {
        if (
          error instanceof Error &&
          /candidates_one_active_per_objective|UNIQUE constraint failed: candidates\.objective_id/iu.test(error.message)
        )
          throw new NightwatchInvariantError("OBJECTIVE_ALREADY_HAS_ACTIVE_CANDIDATE", candidate.objectiveId);
        throw error;
      }
      this.event(
        "candidate",
        candidate.id,
        "CANDIDATE_CREATED",
        { objectiveId: candidate.objectiveId, state: "IMPLEMENTING" },
        candidate.createdAt,
      );
      return this.getCandidate(candidate.id);
    });
  }

  getCandidate(id: string): Candidate {
    return this.candidate(this.candidateRow(id));
  }

  candidates(): Candidate[] {
    return (this.db.prepare("SELECT * FROM candidates ORDER BY created_at, candidate_id").all() as CandidateRow[]).map(
      (row) => this.candidate(row),
    );
  }

  transitionsFor(state: CandidateState) {
    return transitions[state];
  }

  transitionCandidate(id: string, next: CandidateState, options: { reason?: string; at?: string } = {}): Candidate {
    if (!stateSet.has(next)) throw new NightwatchInvariantError("UNKNOWN_CANDIDATE_STATE", next);
    return this.inTransaction(() => {
      const current = this.candidate(this.candidateRow(id));
      if (!transitions[current.state].includes(next))
        throw new NightwatchInvariantError("ILLEGAL_CANDIDATE_TRANSITION", `${current.state}->${next}`);
      const terminalReason = terminalStates.has(next)
        ? requireText(
            options.reason ?? (next === "POST_MERGE_VERIFIED" ? "POST_MERGE_VERIFIED" : ""),
            "terminal reason",
          )
        : null;
      const active = activeStates.has(next) ? 1 : 0;
      this.db
        .prepare("UPDATE candidates SET state = ?, active = ?, terminal_reason = ? WHERE candidate_id = ?")
        .run(next, active, terminalReason, id);
      if (next === "POST_MERGE_VERIFIED")
        this.db.prepare("UPDATE integration_queue SET queue_state = 'INTEGRATED' WHERE candidate_id = ?").run(id);
      if (["BLOCKED_BY_BOSUN", "PARKED_OWNER_REQUIRED", "PARKED_LOOP_GUARD"].includes(next))
        this.db.prepare("UPDATE integration_queue SET queue_state = 'BLOCKED' WHERE candidate_id = ?").run(id);
      if (next === "QUEUED")
        this.db.prepare("UPDATE integration_queue SET queue_state = 'WAITING' WHERE candidate_id = ?").run(id);
      this.event(
        "candidate",
        id,
        "CANDIDATE_TRANSITIONED",
        { from: current.state, to: next, reason: options.reason ?? null },
        options.at,
      );
      return this.getCandidate(id);
    });
  }

  createSuccessor(priorId: string, input: Omit<CandidateInput, "predecessorId">, terminalReason: string): Candidate {
    requireText(terminalReason, "successor terminal reason");
    return this.inTransaction(() => {
      const prior = this.getCandidate(priorId);
      if (!prior.active) throw new NightwatchInvariantError("SUCCESSOR_REQUIRES_ACTIVE_PREDECESSOR", priorId);
      if (input.objectiveId !== prior.objectiveId)
        throw new NightwatchInvariantError("SUCCESSOR_OBJECTIVE_MISMATCH", priorId);
      this.transitionCandidate(priorId, "SUPERSEDED", { reason: terminalReason });
      const successor = this.createCandidate({ ...input, predecessorId: priorId });
      this.event("candidate", successor.id, "SUCCESSOR_CREATED", { predecessorId: priorId, terminalReason });
      return successor;
    });
  }

  queueCandidate(id: string, input: QueueInput = {}): QueueEntry {
    assertSafe(input);
    return this.inTransaction(() => {
      const candidate = this.getCandidate(id);
      if (candidate.state !== "QUEUE_READY") throw new NightwatchInvariantError("QUEUE_REQUIRES_QUEUE_READY", id);
      const entry: QueueEntry = {
        candidateId: id,
        priority: boundedNumber(input.priority, 0, "queue.priority"),
        readyAt: input.readyAt ?? iso(),
        dependencies: [...new Set(input.dependencies ?? [])].sort(),
        migrationReservationIds: [...new Set(input.migrationReservationIds ?? [])].sort(),
        sharedOwnershipClasses: [...new Set(input.sharedOwnershipClasses ?? [])].sort(),
        blockers: [...new Set(input.blockers ?? [])].sort(),
        focusedEvidence: [...new Set(input.focusedEvidence ?? [])].sort(),
        downstreamUnblockValue: boundedNumber(input.downstreamUnblockValue, 0, "queue.downstreamUnblockValue"),
        risk: boundedNumber(input.risk, 0, "queue.risk"),
        estimatedSize: boundedNumber(input.estimatedSize, 0, "queue.estimatedSize"),
        queueState: "WAITING",
        reconciliationCount: 0,
      };
      this.db
        .prepare(
          "INSERT INTO integration_queue(candidate_id, ready_at, priority, dependencies_json, migration_reservations_json, ownership_classes_json, blockers_json, focused_evidence_json, downstream_unblock_value, risk, estimated_size, queue_state, reconciliation_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        )
        .run(
          id,
          entry.readyAt,
          entry.priority,
          json(entry.dependencies),
          json(entry.migrationReservationIds),
          json(entry.sharedOwnershipClasses),
          json(entry.blockers),
          json(entry.focusedEvidence),
          entry.downstreamUnblockValue,
          entry.risk,
          entry.estimatedSize,
          entry.queueState,
        );
      this.transitionCandidate(id, "QUEUED");
      this.event("queue", id, "CANDIDATE_QUEUED", { priority: entry.priority, dependencies: entry.dependencies });
      this.selectQueueFront();
      return this.getQueueEntry(id);
    });
  }

  getQueueEntry(id: string): QueueEntry {
    return this.queue(this.queueRow(id));
  }

  queueEntries(): QueueEntry[] {
    return (this.db.prepare("SELECT * FROM integration_queue ORDER BY ready_at, candidate_id").all() as QueueRow[]).map(
      (row) => this.queue(row),
    );
  }

  private dependencyReady(dependencies: string[]) {
    return dependencies.every((id) => this.getCandidate(id).state === "POST_MERGE_VERIFIED");
  }

  rankEligibleQueue(now = Date.now()): QueueEntry[] {
    const entries = this.queueEntries().filter((entry) => {
      const candidate = this.getCandidate(entry.candidateId);
      return candidate.state === "QUEUED" && entry.blockers.length === 0 && this.dependencyReady(entry.dependencies);
    });
    const effectivePriority = (entry: QueueEntry) => {
      const ageHours = Math.max(0, Math.floor((now - Date.parse(entry.readyAt)) / 3_600_000));
      return entry.priority * 24 + Math.min(ageHours, 24_000);
    };
    const migrationFirst = (entry: QueueEntry) => {
      const reservations = entry.migrationReservationIds
        .map((id) => this.reservations().find((reservation) => reservation.id === id)?.startId)
        .filter((id): id is number => id !== undefined);
      return reservations.length ? Math.min(...reservations) : Number.MAX_SAFE_INTEGER;
    };
    return entries.sort((left, right) => {
      const byPriority = effectivePriority(right) - effectivePriority(left);
      if (byPriority) return byPriority;
      const byMigration = migrationFirst(left) - migrationFirst(right);
      if (byMigration) return byMigration;
      const byUnblock = right.downstreamUnblockValue - left.downstreamUnblockValue;
      if (byUnblock) return byUnblock;
      const byRisk = left.risk - right.risk;
      if (byRisk) return byRisk;
      const bySize = left.estimatedSize - right.estimatedSize;
      if (bySize) return bySize;
      const byAge = Date.parse(left.readyAt) - Date.parse(right.readyAt);
      return byAge || left.candidateId.localeCompare(right.candidateId);
    });
  }

  currentQueueFront(): Candidate | null {
    const row = this.db
      .prepare(
        "SELECT * FROM candidates WHERE state IN ('QUEUE_FRONT', 'RECONCILING', 'QUALIFYING', 'ACCEPTANCE_PENDING') ORDER BY created_at, candidate_id LIMIT 1",
      )
      .get() as CandidateRow | undefined;
    return row ? this.candidate(row) : null;
  }

  selectQueueFront(now = Date.now()): Candidate | null {
    const current = this.currentQueueFront();
    if (current) return current;
    const next = this.rankEligibleQueue(now)[0];
    if (!next) return null;
    this.transitionCandidate(next.candidateId, "QUEUE_FRONT", { at: iso(now) });
    this.db.prepare("UPDATE integration_queue SET queue_state = 'FRONT' WHERE candidate_id = ?").run(next.candidateId);
    this.event("queue", next.candidateId, "QUEUE_FRONT_SELECTED", { at: iso(now) }, iso(now));
    return this.getCandidate(next.candidateId);
  }

  blockQueueFront(
    id: string,
    blocker: string,
    state: "BLOCKED_BY_BOSUN" | "PARKED_OWNER_REQUIRED" | "PARKED_LOOP_GUARD" = "BLOCKED_BY_BOSUN",
  ) {
    requireText(blocker, "blocker");
    return this.inTransaction(() => {
      const front = this.currentQueueFront();
      if (!front || front.id !== id) throw new NightwatchInvariantError("QUEUE_FRONT_REQUIRED", id);
      const entry = this.getQueueEntry(id);
      const blockers = [...new Set([...entry.blockers, blocker])].sort();
      this.db
        .prepare("UPDATE integration_queue SET blockers_json = ?, queue_state = 'BLOCKED' WHERE candidate_id = ?")
        .run(json(blockers), id);
      this.transitionCandidate(id, state, { reason: blocker });
      this.event("queue", id, "QUEUE_FRONT_BLOCKED", { blocker, state });
      return this.selectQueueFront();
    });
  }

  resumeCandidate(id: string) {
    return this.inTransaction(() => {
      const candidate = this.getCandidate(id);
      if (!["BLOCKED_BY_BOSUN", "PARKED_OWNER_REQUIRED", "PARKED_LOOP_GUARD"].includes(candidate.state))
        throw new NightwatchInvariantError("RESUME_REQUIRES_PARKED_CANDIDATE", id);
      this.db
        .prepare("UPDATE integration_queue SET blockers_json = '[]', queue_state = 'WAITING' WHERE candidate_id = ?")
        .run(id);
      const resumed = this.transitionCandidate(id, "QUEUED", { reason: "RESUMED_BY_OWNER" });
      this.selectQueueFront();
      return resumed;
    });
  }

  recordMainAdvance(mainSha: string, at = iso()) {
    this.event("repository", "main", "MAIN_ADVANCED", { mainSha: requireText(mainSha, "mainSha") }, at);
  }

  acquireLease(input: {
    type: LeaseType;
    scope: string;
    owner: string;
    candidateId?: string;
    ttlMs: number;
    now?: number;
  }): Lease {
    assertSafe(input);
    if (!leaseTypes.has(input.type)) throw new NightwatchInvariantError("UNKNOWN_LEASE_TYPE", input.type);
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) throw new NightwatchInvariantError("INVALID_LEASE_TTL");
    const now = input.now ?? Date.now();
    const lease: Lease = {
      id: randomUUID(),
      type: input.type,
      scope: requireText(input.scope, "lease.scope"),
      owner: requireText(input.owner, "lease.owner"),
      candidateId: input.candidateId ?? null,
      issuedAt: iso(now),
      expiresAt: iso(now + input.ttlMs),
      state: "ACTIVE",
    };
    return this.inTransaction(() => {
      this.expireLeases(now);
      try {
        this.db
          .prepare(
            "INSERT INTO leases(lease_id, lease_type, scope, owner, candidate_id, issued_at, expires_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')",
          )
          .run(lease.id, lease.type, lease.scope, lease.owner, lease.candidateId, lease.issuedAt, lease.expiresAt);
      } catch (error) {
        if (error instanceof Error && /leases_one_active_scope|UNIQUE constraint failed/iu.test(error.message))
          throw new NightwatchInvariantError("LEASE_COLLISION", `${lease.type}:${lease.scope}`);
        throw error;
      }
      this.event(
        "lease",
        lease.id,
        "LEASE_ACQUIRED",
        { type: lease.type, scope: lease.scope, owner: lease.owner },
        lease.issuedAt,
      );
      return lease;
    });
  }

  private expireLeases(now = Date.now()) {
    const expired = this.db
      .prepare("SELECT * FROM leases WHERE state = 'ACTIVE' AND expires_at <= ?")
      .all(iso(now)) as LeaseRow[];
    for (const lease of expired) {
      this.db.prepare("UPDATE leases SET state = 'EXPIRED' WHERE lease_id = ?").run(lease.lease_id);
      this.event("lease", lease.lease_id, "LEASE_EXPIRED", { type: lease.lease_type, scope: lease.scope }, iso(now));
    }
    return expired.length;
  }

  releaseLease(id: string, owner: string, at = iso()): Lease {
    return this.inTransaction(() => {
      const row = this.db.prepare("SELECT * FROM leases WHERE lease_id = ?").get(id) as LeaseRow | undefined;
      if (!row) throw new NightwatchInvariantError("LEASE_NOT_FOUND", id);
      if (row.owner !== owner) throw new NightwatchInvariantError("LEASE_OWNER_MISMATCH", id);
      if (row.state !== "ACTIVE") throw new NightwatchInvariantError("LEASE_NOT_ACTIVE", id);
      this.db.prepare("UPDATE leases SET state = 'RELEASED' WHERE lease_id = ?").run(id);
      this.event("lease", id, "LEASE_RELEASED", { type: row.lease_type, scope: row.scope, owner }, at);
      return this.lease({ ...row, state: "RELEASED" });
    });
  }

  private lease(row: LeaseRow): Lease {
    return {
      id: row.lease_id,
      type: row.lease_type,
      scope: row.scope,
      owner: row.owner,
      candidateId: row.candidate_id,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      state: row.state,
    };
  }

  leases(state?: LeaseState): Lease[] {
    const rows = (
      state
        ? this.db.prepare("SELECT * FROM leases WHERE state = ? ORDER BY issued_at, lease_id").all(state)
        : this.db.prepare("SELECT * FROM leases ORDER BY issued_at, lease_id").all()
    ) as LeaseRow[];
    return rows.map((row) => this.lease(row));
  }

  acquireIntegrationAcceptance(candidateId: string, owner: string, ttlMs: number, now?: number) {
    const front = this.currentQueueFront();
    if (!front || front.id !== candidateId || front.state !== "QUEUE_FRONT")
      throw new NightwatchInvariantError("QUEUE_FRONT_REQUIRED", candidateId);
    return this.acquireLease({
      type: "INTEGRATION_ACCEPTANCE",
      scope: "integration-queue",
      owner,
      candidateId,
      ttlMs,
      now,
    });
  }

  beginReconciliation(candidateId: string, leaseId: string) {
    return this.inTransaction(() => {
      const front = this.currentQueueFront();
      if (!front || front.id !== candidateId || front.state !== "QUEUE_FRONT")
        throw new NightwatchInvariantError("QUEUE_FRONT_REQUIRED", candidateId);
      const lease = this.leases("ACTIVE").find((entry) => entry.id === leaseId);
      if (!lease || lease.type !== "INTEGRATION_ACCEPTANCE" || lease.candidateId !== candidateId)
        throw new NightwatchInvariantError("INTEGRATION_ACCEPTANCE_LEASE_REQUIRED", candidateId);
      this.transitionCandidate(candidateId, "RECONCILING");
      this.db
        .prepare("UPDATE integration_queue SET reconciliation_count = reconciliation_count + 1 WHERE candidate_id = ?")
        .run(candidateId);
      this.event("queue", candidateId, "RECONCILIATION_BEGUN", { leaseId });
      return this.getCandidate(candidateId);
    });
  }

  reserveMigrationRange(input: {
    family: string;
    project: string;
    objectiveId: string;
    candidateId?: string;
    count: number;
    startId?: number;
    ttlMs: number;
    now?: number;
  }): MigrationReservation {
    assertSafe(input);
    const family = requireText(input.family, "reservation.family");
    if (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 100)
      throw new NightwatchInvariantError("INVALID_RESERVATION_COUNT");
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0)
      throw new NightwatchInvariantError("INVALID_RESERVATION_TTL");
    const now = input.now ?? Date.now();
    return this.inTransaction(() => {
      this.expireReservations(now);
      const inspection = this.repositoryRoot
        ? inspectMigrationFamilies(this.repositoryRoot).find((entry) => entry.family === family)
        : undefined;
      if (inspection?.ambiguous) throw new NightwatchInvariantError("MIGRATION_FAMILY_AMBIGUOUS", family);
      const existing = this.reservations("ACTIVE").filter((entry) => entry.family === family);
      const repositoryMaximum = inspection?.ids.length ? Math.max(...inspection.ids) : 0;
      const ledgerMaximum = existing.length ? Math.max(...existing.map((entry) => entry.endId)) : 0;
      const timestampFloor =
        family === "sqlite"
          ? Number(
              iso(now)
                .replace(/[-:.TZ]/gu, "")
                .slice(0, 14),
            )
          : 0;
      const startId = input.startId ?? Math.max(repositoryMaximum, ledgerMaximum, timestampFloor) + 1;
      if (!Number.isSafeInteger(startId) || startId < 1)
        throw new NightwatchInvariantError("INVALID_RESERVATION_START");
      const endId = startId + input.count - 1;
      const collision = existing.find((entry) => !(endId < entry.startId || startId > entry.endId));
      if (collision) throw new NightwatchInvariantError("MIGRATION_RESERVATION_COLLISION", collision.id);
      const reservation: MigrationReservation = {
        id: randomUUID(),
        family,
        startId,
        endId,
        project: requireText(input.project, "reservation.project"),
        objectiveId: requireText(input.objectiveId, "reservation.objectiveId"),
        candidateId: input.candidateId ?? null,
        allocatedAt: iso(now),
        expiresAt: iso(now + input.ttlMs),
        state: "ACTIVE",
      };
      this.db
        .prepare(
          "INSERT INTO migration_reservations(reservation_id, family, start_id, end_id, project, objective_id, candidate_id, allocated_at, expires_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')",
        )
        .run(
          reservation.id,
          reservation.family,
          reservation.startId,
          reservation.endId,
          reservation.project,
          reservation.objectiveId,
          reservation.candidateId,
          reservation.allocatedAt,
          reservation.expiresAt,
        );
      this.event("migration-reservation", reservation.id, "MIGRATION_RANGE_RESERVED", {
        family,
        startId,
        endId,
        objectiveId: reservation.objectiveId,
      });
      return reservation;
    });
  }

  private reservation(row: ReservationRow): MigrationReservation {
    return {
      id: row.reservation_id,
      family: row.family,
      startId: row.start_id,
      endId: row.end_id,
      project: row.project,
      objectiveId: row.objective_id,
      candidateId: row.candidate_id,
      allocatedAt: row.allocated_at,
      expiresAt: row.expires_at,
      state: row.state,
    };
  }

  reservations(state?: ReservationState): MigrationReservation[] {
    const rows = (
      state
        ? this.db
            .prepare("SELECT * FROM migration_reservations WHERE state = ? ORDER BY allocated_at, reservation_id")
            .all(state)
        : this.db.prepare("SELECT * FROM migration_reservations ORDER BY allocated_at, reservation_id").all()
    ) as ReservationRow[];
    return rows.map((row) => this.reservation(row));
  }

  private expireReservations(now = Date.now()) {
    const expired = this.db
      .prepare("SELECT * FROM migration_reservations WHERE state = 'ACTIVE' AND expires_at <= ?")
      .all(iso(now)) as ReservationRow[];
    for (const reservation of expired) {
      this.db
        .prepare("UPDATE migration_reservations SET state = 'EXPIRED' WHERE reservation_id = ?")
        .run(reservation.reservation_id);
      this.event("migration-reservation", reservation.reservation_id, "MIGRATION_RESERVATION_EXPIRED", {
        family: reservation.family,
        startId: reservation.start_id,
        endId: reservation.end_id,
      });
    }
    return expired.length;
  }

  releaseReservation(id: string, owner: string, at = iso()): MigrationReservation {
    requireText(owner, "reservation release owner");
    return this.inTransaction(() => {
      const row = this.db.prepare("SELECT * FROM migration_reservations WHERE reservation_id = ?").get(id) as
        | ReservationRow
        | undefined;
      if (!row) throw new NightwatchInvariantError("MIGRATION_RESERVATION_NOT_FOUND", id);
      if (row.state !== "ACTIVE") throw new NightwatchInvariantError("MIGRATION_RESERVATION_NOT_ACTIVE", id);
      this.db.prepare("UPDATE migration_reservations SET state = 'RELEASED' WHERE reservation_id = ?").run(id);
      this.event("migration-reservation", id, "MIGRATION_RESERVATION_RELEASED", { owner }, at);
      return this.reservation({ ...row, state: "RELEASED" });
    });
  }

  reconcileMigrationReservations(repositoryRoot = this.repositoryRoot ?? process.cwd(), now = Date.now()) {
    return this.inTransaction(() => {
      this.expireReservations(now);
      const inspections = inspectMigrationFamilies(repositoryRoot);
      const byFamily = new Map(inspections.map((inspection) => [inspection.family, inspection]));
      for (const reservation of this.reservations("ACTIVE")) {
        const inspection = byFamily.get(reservation.family as "sqlite" | "mysql");
        if (!inspection || inspection.ambiguous) continue;
        const allUsed = Array.from(
          { length: reservation.endId - reservation.startId + 1 },
          (_, index) => reservation.startId + index,
        ).every((id) => inspection.ids.includes(id));
        if (allUsed) {
          this.db
            .prepare("UPDATE migration_reservations SET state = 'CONSUMED' WHERE reservation_id = ?")
            .run(reservation.id);
          this.event("migration-reservation", reservation.id, "MIGRATION_RESERVATION_CONSUMED", {
            family: reservation.family,
          });
        }
      }
      return inspections;
    });
  }

  private acceptanceTransaction(row: Record<string, unknown>): AcceptanceTransaction {
    return {
      id: String(row.transaction_id),
      candidateId: String(row.candidate_id),
      cascadeId: String(row.cascade_id),
      candidateSha: String(row.candidate_sha),
      candidateTreeSha: String(row.candidate_tree_sha),
      baseSha: String(row.base_sha),
      baseTreeSha: String(row.base_tree_sha),
      candidateRef: String(row.candidate_ref),
      state: String(row.state) as AcceptanceTransactionState,
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
    };
  }

  private transactionRow(id: string) {
    const row = this.db.prepare("SELECT * FROM acceptance_transactions WHERE transaction_id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new NightwatchInvariantError("ACCEPTANCE_TRANSACTION_NOT_FOUND", id);
    return row;
  }

  private cascade(row: Record<string, unknown>): IntegrationCascade {
    return {
      id: String(row.cascade_id),
      rootFingerprint: String(row.root_fingerprint),
      rootIdentity: String(row.root_identity),
      startedAt: String(row.started_at),
      maintenancePrCount: Number(row.maintenance_pr_count),
      authorityAttempts: Number(row.authority_attempts),
      mainlineRebuilds: Number(row.mainline_rebuilds),
      blockedCandidates: parse<string[]>(String(row.blocked_candidates_json), "cascade.blockedCandidates"),
      status: String(row.status) as IntegrationCascade["status"],
    };
  }

  private cost(row: Record<string, unknown>): IntegrationCostLedger {
    return {
      cascadeId: String(row.cascade_id),
      transactionId: String(row.transaction_id),
      startedAt: String(row.started_at),
      productValueMs: Number(row.product_value_ms),
      controlPlaneActiveMs: Number(row.control_plane_active_ms),
      controlPlaneWaitMs: Number(row.control_plane_wait_ms),
      externallyBlockedMs: Number(row.externally_blocked_ms),
      descendantMaintenanceMs: Number(row.descendant_maintenance_ms),
      authorityMs: Number(row.authority_ms),
      browserMatrixMs: Number(row.browser_matrix_ms),
      retryAndCooldownMs: Number(row.retry_cooldown_ms),
      noProgressCycles: Number(row.no_progress_cycles),
      remainingClosureSteps: parse<string[]>(
        String(row.remaining_closure_steps_json),
        "integrationCost.remainingClosureSteps",
      ),
      warningAtMs: Number(row.warning_at_ms),
      hardReviewAtMs: Number(row.hard_review_at_ms),
      breakerAtMs: Number(row.breaker_at_ms),
    };
  }

  private costRow(cascadeId: string) {
    const row = this.db.prepare("SELECT * FROM integration_cost_ledger WHERE cascade_id = ?").get(cascadeId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new NightwatchInvariantError("INTEGRATION_COST_LEDGER_NOT_FOUND", cascadeId);
    return row;
  }

  private cascadeRow(id: string) {
    const row = this.db.prepare("SELECT * FROM integration_cascades WHERE cascade_id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new NightwatchInvariantError("INTEGRATION_CASCADE_NOT_FOUND", id);
    return row;
  }

  private validateIdentity(identity: ExactCandidateIdentity) {
    assertSafe(identity);
    return {
      candidateSha: requireText(identity.candidateSha, "candidateSha"),
      candidateTreeSha: requireText(identity.candidateTreeSha, "candidateTreeSha"),
      baseSha: requireText(identity.baseSha, "baseSha"),
      baseTreeSha: requireText(identity.baseTreeSha, "baseTreeSha"),
      candidateRef: requireText(identity.candidateRef, "candidateRef"),
    };
  }

  private setTransactionState(id: string, state: AcceptanceTransactionState, at = iso()) {
    this.db
      .prepare("UPDATE acceptance_transactions SET state = ?, updated_at = ? WHERE transaction_id = ?")
      .run(state, at, id);
    this.event("acceptance-transaction", id, "ACCEPTANCE_STATE_CHANGED", { state }, at);
    return this.getAcceptanceTransaction(id);
  }

  getAcceptanceTransaction(id: string) {
    return this.acceptanceTransaction(this.transactionRow(id));
  }

  acceptanceTransactions(candidateId?: string) {
    const rows = (
      candidateId
        ? this.db
            .prepare("SELECT * FROM acceptance_transactions WHERE candidate_id = ? ORDER BY created_at")
            .all(candidateId)
        : this.db.prepare("SELECT * FROM acceptance_transactions ORDER BY created_at").all()
    ) as Record<string, unknown>[];
    return rows.map((row) => this.acceptanceTransaction(row));
  }

  acceptanceRuns(transactionId?: string): AcceptanceRun[] {
    const rows = (
      transactionId
        ? this.db
            .prepare("SELECT * FROM acceptance_runs WHERE transaction_id = ? ORDER BY dispatched_at, run_id")
            .all(transactionId)
        : this.db.prepare("SELECT * FROM acceptance_runs ORDER BY dispatched_at, run_id").all()
    ) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.run_id),
      transactionId: String(row.transaction_id),
      stage: String(row.stage) as AcceptanceRunStage,
      dispatchKey: String(row.dispatch_key),
      externalRunId: row.external_run_id ? String(row.external_run_id) : null,
      status: String(row.status) as AcceptanceRunStatus,
      dispatchedAt: String(row.dispatched_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
    }));
  }

  integrationCascades() {
    return (
      this.db.prepare("SELECT * FROM integration_cascades ORDER BY started_at, cascade_id").all() as Record<
        string,
        unknown
      >[]
    ).map((row) => this.cascade(row));
  }

  beginAtomicAcceptance(input: {
    candidateId: string;
    identity: ExactCandidateIdentity;
    rootFingerprint: string;
    rootIdentity?: string;
    at?: string;
  }): AcceptanceTransaction {
    assertSafe(input);
    const identity = this.validateIdentity(input.identity);
    const at = input.at ?? iso();
    return this.inTransaction(() => {
      const candidate = this.getCandidate(input.candidateId);
      if (!candidate.active || !["QUEUE_FRONT", "RECONCILING"].includes(candidate.state))
        throw new NightwatchInvariantError("QUEUE_FRONT_REQUIRED", input.candidateId);
      const duplicate = this.db
        .prepare("SELECT * FROM acceptance_transactions WHERE candidate_id = ? AND candidate_sha = ? AND base_sha = ?")
        .get(input.candidateId, identity.candidateSha, identity.baseSha) as Record<string, unknown> | undefined;
      if (duplicate) return this.acceptanceTransaction(duplicate);
      const rootFingerprint = requireText(input.rootFingerprint, "rootFingerprint");
      let cascade = this.db
        .prepare("SELECT * FROM integration_cascades WHERE root_fingerprint = ?")
        .get(rootFingerprint) as Record<string, unknown> | undefined;
      if (!cascade) {
        const cascadeId = randomUUID();
        this.db
          .prepare(
            "INSERT INTO integration_cascades(cascade_id, root_fingerprint, root_identity, started_at, blocked_candidates_json, status) VALUES (?, ?, ?, ?, '[]', 'ACTIVE')",
          )
          .run(cascadeId, rootFingerprint, requireText(input.rootIdentity ?? rootFingerprint, "rootIdentity"), at);
        cascade = this.cascadeRow(cascadeId);
      }
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO acceptance_transactions(transaction_id, candidate_id, cascade_id, candidate_sha, candidate_tree_sha, base_sha, base_tree_sha, candidate_ref, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECONCILING', ?, ?)",
        )
        .run(
          id,
          input.candidateId,
          String(cascade.cascade_id),
          identity.candidateSha,
          identity.candidateTreeSha,
          identity.baseSha,
          identity.baseTreeSha,
          identity.candidateRef,
          at,
          at,
        );
      this.db
        .prepare(
          "INSERT OR IGNORE INTO integration_cost_ledger(cascade_id, transaction_id, started_at, remaining_closure_steps_json, warning_at_ms, hard_review_at_ms, breaker_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          String(cascade.cascade_id),
          id,
          at,
          json([
            "reconcile exact candidate",
            "authority qualification",
            "protected binding",
            "protected merge",
            "exact-main proof",
          ]),
          30 * 60_000,
          60 * 60_000,
          90 * 60_000,
        );
      if (candidate.state === "QUEUE_FRONT") this.transitionCandidate(input.candidateId, "RECONCILING", { at });
      this.event(
        "acceptance-transaction",
        id,
        "ATOMIC_ACCEPTANCE_BEGUN",
        { candidateId: input.candidateId, ...identity },
        at,
      );
      return this.getAcceptanceTransaction(id);
    });
  }

  /** Cheap queue-front checks only; this is intentionally not a Sounding Line substitute. */
  preflightAcceptance(
    transactionId: string,
    input: {
      deterministicRegistryHealthy: boolean;
      ownershipResolved: boolean;
      knownMaintenanceBlocker?: string;
      identityStable: boolean;
      leaseAvailable: boolean;
      at?: string;
    },
  ) {
    assertSafe(input);
    const at = input.at ?? iso();
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "RECONCILING")
        throw new NightwatchInvariantError("RECONCILIATION_REQUIRED", transactionId);
      const failed = !input.deterministicRegistryHealthy
        ? "DETERMINISTIC_REGISTRY_UNHEALTHY"
        : !input.ownershipResolved
          ? "OWNERSHIP_UNRESOLVED"
          : input.knownMaintenanceBlocker
            ? `SHARED_MAINTENANCE_BLOCKED:${input.knownMaintenanceBlocker}`
            : !input.identityStable
              ? "EXACT_IDENTITY_UNSTABLE"
              : !input.leaseAvailable
                ? "INTEGRATION_ACCEPTANCE_LEASE_UNAVAILABLE"
                : null;
      this.event("acceptance-transaction", transactionId, "QUEUE_FRONT_PREFLIGHT", { result: failed ?? "PASS" }, at);
      if (!failed) return { result: "PASS" as const, transaction };
      this.db
        .prepare(
          "UPDATE acceptance_transactions SET last_semantic_invalidation = ?, updated_at = ? WHERE transaction_id = ?",
        )
        .run(failed, at, transactionId);
      this.setTransactionState(transactionId, "SHARED_BLOCKED", at);
      return { result: "BLOCKED" as const, reason: failed, transaction: this.getAcceptanceTransaction(transactionId) };
    });
  }

  completeReconciliation(
    transactionId: string,
    options: { preservedEvidenceCount?: number; rerunEvidenceCount?: number; at?: string } = {},
  ) {
    const at = options.at ?? iso();
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "RECONCILING")
        throw new NightwatchInvariantError("RECONCILIATION_REQUIRED", transactionId);
      this.db
        .prepare(
          "UPDATE acceptance_transactions SET preserved_evidence_count = ?, rerun_evidence_count = ?, updated_at = ? WHERE transaction_id = ?",
        )
        .run(
          boundedNumber(options.preservedEvidenceCount, transaction.preservedEvidenceCount, "preservedEvidenceCount"),
          boundedNumber(options.rerunEvidenceCount, transaction.rerunEvidenceCount, "rerunEvidenceCount"),
          at,
          transactionId,
        );
      const candidate = this.getCandidate(transaction.candidateId);
      if (candidate.state === "RECONCILING") this.transitionCandidate(transaction.candidateId, "QUALIFYING", { at });
      return this.setTransactionState(transactionId, "REQUALIFYING", at);
    });
  }

  freezeAcceptanceCandidate(transactionId: string, owner: string, ttlMs: number, at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "REQUALIFYING")
        throw new NightwatchInvariantError("REQUALIFICATION_REQUIRED", transactionId);
      const lease = this.acquireLease({
        type: "INTEGRATION_ACCEPTANCE",
        scope: "integration-queue",
        owner,
        candidateId: transaction.candidateId,
        ttlMs,
        now: Date.parse(at),
      });
      this.db
        .prepare("UPDATE acceptance_transactions SET lease_id = ?, updated_at = ? WHERE transaction_id = ?")
        .run(lease.id, at, transactionId);
      const candidate = this.getCandidate(transaction.candidateId);
      if (candidate.state === "QUALIFYING")
        this.transitionCandidate(transaction.candidateId, "ACCEPTANCE_PENDING", { at });
      return this.setTransactionState(transactionId, "CANDIDATE_FROZEN", at);
    });
  }

  awaitAuthority(transactionId: string, at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "CANDIDATE_FROZEN")
        throw new NightwatchInvariantError("CANDIDATE_FROZEN_REQUIRED", transactionId);
      return this.setTransactionState(transactionId, "AWAITING_AUTHORITY", at);
    });
  }

  dispatchAuthority(transactionId: string, eventKey: string, externalRunId?: string, at = iso()): AcceptanceRun {
    return this.dispatchAcceptanceRun(transactionId, "AUTHORITY", eventKey, externalRunId, at);
  }

  dispatchBinding(transactionId: string, eventKey: string, externalRunId?: string, at = iso()): AcceptanceRun {
    return this.dispatchAcceptanceRun(transactionId, "BINDING", eventKey, externalRunId, at);
  }

  recordAcceptanceRunExternalId(
    transactionId: string,
    runId: string,
    externalRunId: string,
    at = iso(),
  ): AcceptanceRun {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const run = this.acceptanceRuns(transactionId).find((entry) => entry.id === runId);
      if (!run || run.transactionId !== transaction.id)
        throw new NightwatchInvariantError("ACCEPTANCE_RUN_NOT_FOUND", runId);
      const external = requireText(externalRunId, "externalRunId");
      if (run.externalRunId && run.externalRunId !== external)
        throw new NightwatchInvariantError("ACCEPTANCE_EXTERNAL_RUN_MISMATCH", runId);
      if (!run.externalRunId) {
        this.db.prepare("UPDATE acceptance_runs SET external_run_id = ? WHERE run_id = ?").run(external, runId);
        this.event(
          "acceptance-run",
          runId,
          "EXTERNAL_RUN_BOUND",
          { transactionId, stage: run.stage, externalRunId: external },
          at,
        );
      }
      return this.acceptanceRuns(transactionId).find((entry) => entry.id === runId)!;
    });
  }

  private dispatchAcceptanceRun(
    transactionId: string,
    stage: AcceptanceRunStage,
    eventKey: string,
    externalRunId: string | undefined,
    at: string,
  ) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const key = requireText(eventKey, "eventKey");
      const sameIdentity = this.db
        .prepare("SELECT * FROM acceptance_runs WHERE transaction_id = ? AND stage = ?")
        .get(transactionId, stage) as Record<string, unknown> | undefined;
      if (sameIdentity)
        return this.acceptanceRuns(transactionId).find((run) => run.id === String(sameIdentity.run_id))!;
      const expected = stage === "AUTHORITY" ? "AWAITING_AUTHORITY" : "BINDING_PENDING";
      if (transaction.state !== expected)
        throw new NightwatchInvariantError(`${stage}_DISPATCH_NOT_READY`, transactionId);
      const identityKey = `${transaction.candidateSha}:${transaction.baseSha}:${stage}`;
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO acceptance_runs(run_id, transaction_id, stage, dispatch_key, external_run_id, status, dispatched_at) VALUES (?, ?, ?, ?, ?, 'RUNNING', ?)",
        )
        .run(id, transactionId, stage, `${identityKey}:${key}`, externalRunId ?? null, at);
      this.db
        .prepare(
          "UPDATE acceptance_transactions SET " +
            (stage === "AUTHORITY" ? "authority_run_id" : "binding_run_id") +
            " = ?, updated_at = ? WHERE transaction_id = ?",
        )
        .run(id, at, transactionId);
      if (stage === "AUTHORITY") {
        this.db
          .prepare("UPDATE integration_cascades SET authority_attempts = authority_attempts + 1 WHERE cascade_id = ?")
          .run(transaction.cascadeId);
        this.setTransactionState(transactionId, "AUTHORITY_RUNNING", at);
      } else this.setTransactionState(transactionId, "BINDING_RUNNING", at);
      this.event("acceptance-run", id, "RUN_DISPATCHED", { transactionId, stage, eventKey: key }, at);
      return this.acceptanceRuns(transactionId).find((run) => run.id === id)!;
    });
  }

  recordAuthorityResult(transactionId: string, runId: string, result: "RELEASE_GO" | "REJECTED", at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "AUTHORITY_RUNNING" || transaction.authorityRunId !== runId)
        throw new NightwatchInvariantError("AUTHORITY_RUN_MISMATCH", transactionId);
      this.db
        .prepare("UPDATE acceptance_runs SET status = ?, completed_at = ? WHERE run_id = ?")
        .run(result, at, runId);
      const run = this.acceptanceRuns(transactionId).find((entry) => entry.id === runId)!;
      this.recordCostDuration(
        transaction.cascadeId,
        "authority",
        Math.max(0, Date.parse(at) - Date.parse(run.dispatchedAt)),
      );
      this.db
        .prepare("UPDATE acceptance_transactions SET authority_result = ?, updated_at = ? WHERE transaction_id = ?")
        .run(result, at, transactionId);
      this.setTransactionState(
        transactionId,
        result === "RELEASE_GO" ? "AUTHORITY_ACCEPTED" : "AUTHORITY_REJECTED",
        at,
      );
      if (result === "RELEASE_GO") return this.setTransactionState(transactionId, "BINDING_PENDING", at);
      return this.getAcceptanceTransaction(transactionId);
    });
  }

  recordBindingResult(transactionId: string, runId: string, result: "BINDING_PASS" | "BINDING_REJECTED", at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "BINDING_RUNNING" || transaction.bindingRunId !== runId)
        throw new NightwatchInvariantError("BINDING_RUN_MISMATCH", transactionId);
      this.db
        .prepare("UPDATE acceptance_runs SET status = ?, completed_at = ? WHERE run_id = ?")
        .run(result, at, runId);
      const run = this.acceptanceRuns(transactionId).find((entry) => entry.id === runId)!;
      this.recordCostDuration(
        transaction.cascadeId,
        "controlPlaneWait",
        Math.max(0, Date.parse(at) - Date.parse(run.dispatchedAt)),
      );
      this.db
        .prepare("UPDATE acceptance_transactions SET binding_result = ?, updated_at = ? WHERE transaction_id = ?")
        .run(result, at, transactionId);
      this.setTransactionState(transactionId, result, at);
      return result === "BINDING_PASS"
        ? this.setTransactionState(transactionId, "MERGING", at)
        : this.getAcceptanceTransaction(transactionId);
    });
  }

  recordIntegrated(transactionId: string, at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "MERGING") throw new NightwatchInvariantError("MERGING_REQUIRED", transactionId);
      const candidate = this.getCandidate(transaction.candidateId);
      if (candidate.state === "ACCEPTANCE_PENDING")
        this.transitionCandidate(transaction.candidateId, "INTEGRATED", { at });
      return this.setTransactionState(transactionId, "INTEGRATED", at);
    });
  }

  verifyPostMerge(transactionId: string, landed: { mergeSha: string; treeSha: string }, at = iso()) {
    return this.inTransaction(() => {
      assertSafe(landed);
      const transaction = this.getAcceptanceTransaction(transactionId);
      if (transaction.state !== "INTEGRATED") throw new NightwatchInvariantError("INTEGRATED_REQUIRED", transactionId);
      requireText(landed.mergeSha, "mergeSha");
      requireText(landed.treeSha, "treeSha");
      if (landed.treeSha !== transaction.candidateTreeSha)
        throw new NightwatchInvariantError("POST_MERGE_TREE_MISMATCH", transactionId);
      const candidate = this.getCandidate(transaction.candidateId);
      if (candidate.state === "INTEGRATED")
        this.transitionCandidate(transaction.candidateId, "POST_MERGE_VERIFIED", { at });
      const lease = transaction.leaseId
        ? this.leases("ACTIVE").find((entry) => entry.id === transaction.leaseId)
        : undefined;
      if (lease) this.releaseLease(lease.id, lease.owner, at);
      this.event("acceptance-transaction", transactionId, "POST_MERGE_IDENTITY_VERIFIED", landed, at);
      return this.setTransactionState(transactionId, "POST_MERGE_VERIFIED", at);
    });
  }

  recordTransactionMainAdvance(transactionId: string, semanticInvalidation: string, at = iso()) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const race = ["AUTHORITY_ACCEPTED", "BINDING_PENDING", "BINDING_RUNNING", "BINDING_PASS", "MERGING"].includes(
        transaction.state,
      );
      this.db
        .prepare("UPDATE integration_cascades SET mainline_rebuilds = mainline_rebuilds + 1 WHERE cascade_id = ?")
        .run(transaction.cascadeId);
      this.db
        .prepare(
          "UPDATE acceptance_transactions SET last_semantic_invalidation = ?, updated_at = ? WHERE transaction_id = ?",
        )
        .run(requireText(semanticInvalidation, "semanticInvalidation"), at, transactionId);
      const candidate = this.getCandidate(transaction.candidateId);
      if (race) {
        if (candidate.state === "ACCEPTANCE_PENDING")
          this.transitionCandidate(transaction.candidateId, "RECONCILING", { at });
        return this.setTransactionState(transactionId, "MERGE_RACE", at);
      }
      if (candidate.state === "ACCEPTANCE_PENDING")
        this.transitionCandidate(transaction.candidateId, "RECONCILING", { at });
      return this.setTransactionState(transactionId, "RECONCILING", at);
    });
  }

  recordMaintenanceDescendant(transactionId: string, input: { candidateId?: string; generation: number; at?: string }) {
    assertSafe(input);
    if (!Number.isSafeInteger(input.generation) || input.generation < 0)
      throw new NightwatchInvariantError("INVALID_CASCADE_GENERATION");
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const budget = this.transactionBudget(transactionId, input.at ? Date.parse(input.at) : Date.now());
      if (budget.status === "PARKED_BREAKER")
        throw new NightwatchInvariantError("INTEGRATION_CASCADE_BREAKER", transactionId);
      if (budget.status === "CONTROL_PLANE_REVIEW")
        throw new NightwatchInvariantError("INTEGRATION_HARD_REVIEW", transactionId);
      if (input.generation > 2) throw new NightwatchInvariantError("CASCADE_GENERATION_OWNER_REVIEW", transactionId);
      const cascade = this.cascade(this.cascadeRow(transaction.cascadeId));
      const blocked = [
        ...new Set([...cascade.blockedCandidates, ...(input.candidateId ? [input.candidateId] : [])]),
      ].sort();
      this.db
        .prepare(
          "UPDATE integration_cascades SET maintenance_pr_count = maintenance_pr_count + 1, blocked_candidates_json = ? WHERE cascade_id = ?",
        )
        .run(json(blocked), cascade.id);
      this.event(
        "integration-cascade",
        cascade.id,
        "MAINTENANCE_DESCENDANT_RECORDED",
        { generation: input.generation, candidateId: input.candidateId ?? null },
        input.at,
      );
      return this.integrationBudget(cascade.id, input.at ? Date.parse(input.at) : Date.now());
    });
  }

  recordMaintenanceFinding(
    transactionId: string,
    input: { fingerprint: string; generation: number; candidateId?: string; durationMs?: number; at?: string },
  ) {
    assertSafe(input);
    const fingerprint = requireText(input.fingerprint, "maintenanceFindingFingerprint");
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const existing = this.db
        .prepare("SELECT fingerprint FROM maintenance_findings WHERE cascade_id = ? AND fingerprint = ?")
        .get(transaction.cascadeId, fingerprint);
      if (existing)
        return {
          duplicate: true,
          budget: this.transactionBudget(transactionId, input.at ? Date.parse(input.at) : Date.now()),
        };
      const budget = this.recordMaintenanceDescendant(transactionId, {
        candidateId: input.candidateId,
        generation: input.generation,
        at: input.at,
      });
      this.db
        .prepare(
          "INSERT INTO maintenance_findings(cascade_id, fingerprint, generation, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(transaction.cascadeId, fingerprint, input.generation, input.at ?? iso());
      this.recordCostDuration(
        transaction.cascadeId,
        "descendantMaintenance",
        boundedNumber(input.durationMs, 0, "maintenanceDurationMs"),
      );
      return { duplicate: false, budget };
    });
  }

  recordCostDuration(
    cascadeId: string,
    category:
      | "productValue"
      | "controlPlaneActive"
      | "controlPlaneWait"
      | "externallyBlocked"
      | "descendantMaintenance"
      | "authority"
      | "browserMatrix"
      | "retryAndCooldown",
    durationMs: number,
  ) {
    const field = {
      productValue: "product_value_ms",
      controlPlaneActive: "control_plane_active_ms",
      controlPlaneWait: "control_plane_wait_ms",
      externallyBlocked: "externally_blocked_ms",
      descendantMaintenance: "descendant_maintenance_ms",
      authority: "authority_ms",
      browserMatrix: "browser_matrix_ms",
      retryAndCooldown: "retry_cooldown_ms",
    }[category];
    const duration = boundedNumber(durationMs, 0, "integrationCostDurationMs");
    this.db
      .prepare(`UPDATE integration_cost_ledger SET ${field} = ${field} + ? WHERE cascade_id = ?`)
      .run(duration, cascadeId);
  }

  setRemainingClosureSteps(transactionId: string, steps: string[]) {
    return this.inTransaction(() => {
      const transaction = this.getAcceptanceTransaction(transactionId);
      const normalized = [...new Set(steps.map((step) => requireText(step, "remainingClosureStep")))];
      this.db
        .prepare("UPDATE integration_cost_ledger SET remaining_closure_steps_json = ? WHERE cascade_id = ?")
        .run(json(normalized), transaction.cascadeId);
      this.event("integration-cost", transaction.cascadeId, "REMAINING_CLOSURE_STEPS_UPDATED", {
        transactionId,
        remainingClosureSteps: normalized,
      });
      return normalized;
    });
  }

  integrationBudget(cascadeId: string, now = Date.now()): IntegrationBudgetStatus {
    return this.inTransaction(() => {
      const cascade = this.cascade(this.cascadeRow(cascadeId));
      const cost = this.cost(this.costRow(cascadeId));
      const elapsedMs = Math.max(0, now - Date.parse(cost.startedAt));
      const status: IntegrationCascade["status"] =
        elapsedMs >= cost.breakerAtMs
          ? "PARKED_BREAKER"
          : elapsedMs >= cost.hardReviewAtMs
            ? "CONTROL_PLANE_REVIEW"
            : elapsedMs >= cost.warningAtMs
              ? "WARNING"
              : "ACTIVE";
      if (status !== cascade.status)
        this.db.prepare("UPDATE integration_cascades SET status = ? WHERE cascade_id = ?").run(status, cascadeId);
      if (status === "PARKED_BREAKER") {
        this.db
          .prepare(
            "UPDATE acceptance_transactions SET state = 'PARKED_INTEGRATION_BREAKER', updated_at = ? WHERE cascade_id = ? AND state NOT IN ('INTEGRATED', 'POST_MERGE_VERIFIED')",
          )
          .run(iso(now), cascadeId);
        const transactions = this.acceptanceTransactions().filter(
          (entry) => entry.cascadeId === cascadeId && !["INTEGRATED", "POST_MERGE_VERIFIED"].includes(entry.state),
        );
        for (const transaction of transactions) {
          const candidate = this.getCandidate(transaction.candidateId);
          if (candidate.state === "ACCEPTANCE_PENDING")
            this.transitionCandidate(candidate.id, "PARKED_LOOP_GUARD", {
              reason: "INTEGRATION_CASCADE_BREAKER",
              at: iso(now),
            });
          const lease = transaction.leaseId
            ? this.leases("ACTIVE").find((entry) => entry.id === transaction.leaseId)
            : undefined;
          if (lease) this.releaseLease(lease.id, lease.owner, iso(now));
        }
        this.event(
          "integration-cascade",
          cascadeId,
          "INTEGRATION_CASCADE_BREAKER",
          { elapsedMs, remainingClosureSteps: cost.remainingClosureSteps },
          iso(now),
        );
      }
      const refreshed = this.cascade(this.cascadeRow(cascadeId));
      return {
        cascadeId,
        transactionId: cost.transactionId,
        elapsedMs,
        maintenanceAmplificationRatio: refreshed.maintenancePrCount / Math.max(1, refreshed.authorityAttempts),
        status,
        productValueMs: cost.productValueMs,
        controlPlaneActiveMs: cost.controlPlaneActiveMs,
        controlPlaneWaitMs: cost.controlPlaneWaitMs,
        externallyBlockedMs: cost.externallyBlockedMs,
        descendantMaintenanceMs: cost.descendantMaintenanceMs,
        authorityMs: cost.authorityMs,
        browserMatrixMs: cost.browserMatrixMs,
        retryAndCooldownMs: cost.retryAndCooldownMs,
        noProgressCycles: cost.noProgressCycles,
        remainingClosureSteps: cost.remainingClosureSteps,
        warningAtMs: cost.warningAtMs,
        hardReviewAtMs: cost.hardReviewAtMs,
        breakerAtMs: cost.breakerAtMs,
      };
    });
  }

  transactionBudget(transactionId: string, now = Date.now()) {
    return this.integrationBudget(this.getAcceptanceTransaction(transactionId).cascadeId, now);
  }

  recover(options: { now?: number; repositoryRoot?: string } = {}) {
    const now = options.now ?? Date.now();
    return this.inTransaction(() => {
      const expiredLeases = this.expireLeases(now);
      const expiredReservations = this.expireReservations(now);
      const migrationCollisions =
        options.repositoryRoot || this.repositoryRoot
          ? this.reconcileMigrationReservations(options.repositoryRoot ?? this.repositoryRoot!, now)
          : [];
      this.validatePersistedState();
      this.event(
        "ledger",
        "nightwatch",
        "RESTART_RECOVERY_COMPLETED",
        { expiredLeases, expiredReservations },
        iso(now),
      );
      return { expiredLeases, expiredReservations, migrationCollisions };
    });
  }

  controllerHealth(now = Date.now(), staleAfterMs = 90_000): NightwatchControllerHealth {
    const row = this.db.prepare("SELECT * FROM controller_health WHERE singleton = 1").get() as
      | Record<string, unknown>
      | undefined;
    if (!row)
      return {
        instanceId: null,
        state: "DOWN",
        heartbeatAt: null,
        lastSuccessfulReconciliationAt: null,
        detail: "Controller health is unavailable.",
      };
    const heartbeatAt = row.heartbeat_at ? String(row.heartbeat_at) : null;
    const heartbeatAge = heartbeatAt ? Math.max(0, now - Date.parse(heartbeatAt)) : Number.POSITIVE_INFINITY;
    const recorded = String(row.state) as NightwatchControllerState;
    const state: NightwatchControllerState =
      !heartbeatAt || recorded === "DOWN" ? "DOWN" : heartbeatAge > staleAfterMs ? "DEGRADED" : recorded;
    return {
      instanceId: row.instance_id ? String(row.instance_id) : null,
      state,
      heartbeatAt,
      lastSuccessfulReconciliationAt: row.last_successful_reconciliation_at
        ? String(row.last_successful_reconciliation_at)
        : null,
      detail: row.detail ? String(row.detail) : null,
    };
  }

  claimController(instanceId: string, ttlMs: number, at = iso()) {
    const owner = requireText(instanceId, "controllerInstanceId");
    return this.inTransaction(() => {
      const lease = this.acquireLease({ type: "CONTROLLER", scope: "nightwatchd", owner, ttlMs, now: Date.parse(at) });
      this.db
        .prepare(
          "UPDATE controller_health SET instance_id = ?, state = 'LIVE', heartbeat_at = ?, detail = NULL WHERE singleton = 1",
        )
        .run(owner, at);
      this.event("controller", owner, "CONTROLLER_CLAIMED", { leaseId: lease.id }, at);
      return lease;
    });
  }

  heartbeatController(input: {
    instanceId: string;
    ttlMs: number;
    reconciled?: boolean;
    detail?: string;
    at?: string;
  }) {
    assertSafe(input);
    const at = input.at ?? iso();
    const instanceId = requireText(input.instanceId, "controllerInstanceId");
    return this.inTransaction(() => {
      const lease = this.leases("ACTIVE").find((entry) => entry.type === "CONTROLLER" && entry.scope === "nightwatchd");
      if (!lease || lease.owner !== instanceId)
        throw new NightwatchInvariantError("CONTROLLER_OWNERSHIP_REQUIRED", instanceId);
      if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) throw new NightwatchInvariantError("INVALID_LEASE_TTL");
      this.db
        .prepare("UPDATE leases SET expires_at = ? WHERE lease_id = ?")
        .run(iso(Date.parse(at) + input.ttlMs), lease.id);
      this.db
        .prepare(
          "UPDATE controller_health SET instance_id = ?, state = 'LIVE', heartbeat_at = ?, last_successful_reconciliation_at = CASE WHEN ? THEN ? ELSE last_successful_reconciliation_at END, detail = ? WHERE singleton = 1",
        )
        .run(instanceId, at, input.reconciled ? 1 : 0, at, input.detail ?? null);
      this.event("controller", instanceId, "CONTROLLER_HEARTBEAT", { reconciled: Boolean(input.reconciled) }, at);
      return this.controllerHealth(Date.parse(at));
    });
  }

  degradeController(instanceId: string, detail: string, at = iso()) {
    const owner = requireText(instanceId, "controllerInstanceId");
    return this.inTransaction(() => {
      const lease = this.leases("ACTIVE").find((entry) => entry.type === "CONTROLLER" && entry.scope === "nightwatchd");
      if (!lease || lease.owner !== owner) throw new NightwatchInvariantError("CONTROLLER_OWNERSHIP_REQUIRED", owner);
      this.db
        .prepare(
          "UPDATE controller_health SET instance_id = ?, state = 'DEGRADED', heartbeat_at = ?, detail = ? WHERE singleton = 1",
        )
        .run(owner, at, requireText(detail, "controllerDetail"));
      this.event("controller", owner, "CONTROLLER_DEGRADED", { detail }, at);
      return this.controllerHealth(Date.parse(at));
    });
  }

  releaseController(instanceId: string, detail = "Clean controller shutdown.", at = iso()) {
    const owner = requireText(instanceId, "controllerInstanceId");
    return this.inTransaction(() => {
      const lease = this.leases("ACTIVE").find((entry) => entry.type === "CONTROLLER" && entry.scope === "nightwatchd");
      if (lease && lease.owner !== owner) throw new NightwatchInvariantError("CONTROLLER_OWNERSHIP_REQUIRED", owner);
      if (lease) this.releaseLease(lease.id, owner, at);
      this.db
        .prepare(
          "UPDATE controller_health SET instance_id = ?, state = 'DOWN', heartbeat_at = ?, detail = ? WHERE singleton = 1",
        )
        .run(owner, at, requireText(detail, "controllerDetail"));
      this.event("controller", owner, "CONTROLLER_STOPPED", { detail }, at);
      return this.controllerHealth(Date.parse(at));
    });
  }

  events(entityId?: string) {
    const rows = (
      entityId
        ? this.db.prepare("SELECT * FROM events WHERE entity_id = ? ORDER BY occurred_at, event_id").all(entityId)
        : this.db.prepare("SELECT * FROM events ORDER BY occurred_at, event_id").all()
    ) as Array<{
      event_id: string;
      occurred_at: string;
      entity_type: string;
      entity_id: string;
      event_type: string;
      payload_json: string;
    }>;
    return rows.map((row) => ({
      id: row.event_id,
      occurredAt: row.occurred_at,
      entityType: row.entity_type,
      entityId: row.entity_id,
      type: row.event_type,
      payload: parse<Record<string, unknown>>(row.payload_json, `event.${row.event_id}`),
    }));
  }

  projection(now = Date.now()): NightwatchProjection {
    const queues = this.queueEntries();
    const candidates = this.candidates().map((candidate) => {
      const queue = queues.find((entry) => entry.candidateId === candidate.id);
      const ageFrom = queue?.readyAt ?? candidate.createdAt;
      return { ...candidate, ageMs: Math.max(0, now - Date.parse(ageFrom)), blockers: queue?.blockers ?? [] };
    });
    const queueFront = candidates.find((candidate) => candidate.id === this.currentQueueFront()?.id) ?? null;
    const acceptanceOwnership = this.leases("ACTIVE").find((lease) => lease.type === "INTEGRATION_ACCEPTANCE") ?? null;
    const migrationCollisions = this.repositoryRoot ? inspectMigrationFamilies(this.repositoryRoot) : [];
    return {
      schemaVersion: 1,
      observedAt: iso(now),
      state: "AVAILABLE",
      candidates,
      queue: queues,
      queueFront,
      migrationReservations: this.reservations(),
      migrationCollisions,
      leases: this.leases(),
      integrationLifecycleState: queueFront?.state ?? "IDLE",
      acceptanceOwnership,
      controller: this.controllerHealth(now),
    };
  }
}
