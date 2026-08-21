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
  | "INTEGRATION_ACCEPTANCE";
export type ReservationState = "ACTIVE" | "RELEASED" | "EXPIRED" | "CONSUMED";
export type LeaseState = "ACTIVE" | "RELEASED" | "EXPIRED";

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
    `);
    this.db.prepare("INSERT OR IGNORE INTO nightwatch_migrations(version, applied_at) VALUES (1, ?)").run(iso());
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
    };
  }
}
