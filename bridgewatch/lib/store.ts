import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { backup, DatabaseSync, type StatementSync } from "node:sqlite";
import type { MilestoneRecord, PhaseRecord, ProjectRecord } from "../src/domain.js";
import {
  deriveEvents,
  rollupForDay,
  snapshotDigest,
  type BridgewatchEventKind,
  type BridgewatchHistoricalEvent,
  type BridgewatchProgramSnapshot,
  type BranchHealth,
  type DailyRollup,
  type GithubPullRequestHistory,
} from "../src/history.js";
import type { SoundingLineProjection } from "../src/sounding-line.js";
import type { Heartbeat } from "../src/telemetry.js";
import type {
  DiscoveredPhase,
  DiscoveredProject,
  DiscoveredVersion,
  DiscoveryEvidence,
  DiscoveryResult,
} from "../src/discovery.js";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS bridgewatch_cache (
        cache_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        etag TEXT,
        observed_at TEXT NOT NULL,
        error_text TEXT
      );`,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS project_history (
        project_id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phase_history (
        phase_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        value_json TEXT NOT NULL,
        accepted_at TEXT,
        integrated_main_sha TEXT
      );
      CREATE TABLE IF NOT EXISTS milestone_history (
        milestone_id TEXT PRIMARY KEY,
        phase_id TEXT NOT NULL,
        value_json TEXT NOT NULL,
        accepted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS completion_records (
        project_id TEXT PRIMARY KEY,
        receipt_path TEXT NOT NULL,
        final_main_sha TEXT,
        final_decision TEXT,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS workers (
        worker_id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        heartbeat_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE TABLE IF NOT EXISTS test_runs (
        run_id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        observed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS test_nodes (
        node_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        value_json TEXT NOT NULL,
        completed_at TEXT
      );`,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        dedupe_key TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        project_id TEXT,
        phase_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        previous_json TEXT,
        current_json TEXT,
        summary TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_observed_at_idx ON events(observed_at DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS events_project_observed_idx ON events(project_id, observed_at DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS events_phase_observed_idx ON events(phase_id, observed_at DESC, event_id DESC);
      CREATE INDEX IF NOT EXISTS events_kind_observed_idx ON events(kind, observed_at DESC, event_id DESC);
      CREATE TABLE IF NOT EXISTS snapshots (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        captured_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        normalized_digest TEXT NOT NULL,
        program_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS snapshots_captured_at_idx ON snapshots(captured_at DESC);
      CREATE INDEX IF NOT EXISTS snapshots_digest_idx ON snapshots(normalized_digest);
      CREATE TABLE IF NOT EXISTS daily_rollups (
        day TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'program',
        value_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(day, scope)
      );
      CREATE INDEX IF NOT EXISTS daily_rollups_day_idx ON daily_rollups(day DESC);
      `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS discovered_projects (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        confidence TEXT NOT NULL,
        phase_count INTEGER,
        observed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS discovered_versions (
        project_id TEXT NOT NULL,
        identity TEXT NOT NULL,
        lifecycle TEXT NOT NULL,
        confidence TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(project_id, identity)
      );
      CREATE INDEX IF NOT EXISTS discovered_versions_project_idx ON discovered_versions(project_id, identity);
      CREATE TABLE IF NOT EXISTS discovered_phases (
        project_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        name TEXT NOT NULL,
        confidence TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(project_id, ordinal)
      );
      CREATE INDEX IF NOT EXISTS discovered_phases_project_idx ON discovered_phases(project_id, ordinal);
      CREATE TABLE IF NOT EXISTS discovery_evidence (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        reference TEXT NOT NULL,
        confidence TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(entity_type, entity_id, source_kind, reference)
      );
      CREATE INDEX IF NOT EXISTS discovery_evidence_entity_idx ON discovery_evidence(entity_type, entity_id);
      CREATE TABLE IF NOT EXISTS observed_pull_requests (
        pull_request_number INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        state TEXT NOT NULL,
        head_ref TEXT,
        head_sha TEXT,
        updated_at TEXT,
        observed_at TEXT NOT NULL,
        value_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS observed_pull_requests_updated_idx ON observed_pull_requests(updated_at DESC);
      CREATE TABLE IF NOT EXISTS observed_branches (
        branch_name TEXT PRIMARY KEY,
        head_sha TEXT,
        default_sha TEXT,
        pull_request_number INTEGER,
        observed_at TEXT NOT NULL,
        value_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS observed_branches_pull_request_idx ON observed_branches(pull_request_number);
      CREATE TABLE IF NOT EXISTS unclassified_activity (
        source_kind TEXT NOT NULL,
        reference TEXT NOT NULL,
        confidence TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(source_kind, reference)
      );
      CREATE TABLE IF NOT EXISTS source_observations (
        source_name TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        configured INTEGER NOT NULL,
        reachable INTEGER,
        last_attempt_at TEXT,
        last_success_at TEXT,
        next_retry_at TEXT,
        detail TEXT,
        cache_age_ms INTEGER,
        rate_limit_remaining INTEGER,
        authentication_state TEXT NOT NULL DEFAULT 'UNKNOWN',
        observed_at TEXT NOT NULL
      );
      `,
  },
] as const;

const prunableTables = new Set(["events", "snapshots", "daily_rollups", "workers", "test_nodes"]);

function retainedNames(current: string, prior: string, existing: readonly string[] | undefined): string[] | undefined {
  const names = [...new Set([...(existing ?? []), ...(current === prior ? [] : [prior])])].sort();
  return names.length ? names : undefined;
}

function retainMilestone(current: MilestoneRecord, prior: MilestoneRecord | undefined): MilestoneRecord {
  if (!prior) return current;
  const accepted = prior.state === "ACCEPTED";
  return {
    ...current,
    weight: prior.weight,
    state: accepted ? "ACCEPTED" : current.state,
    acceptedAt: current.acceptedAt ?? prior.acceptedAt,
    evidence: [...new Set([...prior.evidence, ...current.evidence])],
  };
}

function retainPhase(current: PhaseRecord, prior: PhaseRecord | undefined): PhaseRecord {
  if (!prior) return current;
  const priorMilestones = new Map(prior.milestones.map((milestone) => [milestone.id, milestone]));
  const milestones = current.milestones.map((milestone) =>
    retainMilestone(milestone, priorMilestones.get(milestone.id)),
  );
  for (const milestone of prior.milestones)
    if (!current.milestones.some((entry) => entry.id === milestone.id)) milestones.push(milestone);
  return {
    ...current,
    milestones,
    historicalNames: retainedNames(current.name, prior.name, current.historicalNames ?? prior.historicalNames),
    startedAt: current.startedAt ?? prior.startedAt,
    acceptedAt: current.acceptedAt ?? prior.acceptedAt,
    mergedAt: current.mergedAt ?? prior.mergedAt,
    completedAt: current.completedAt ?? prior.completedAt,
    branch: current.branch ?? prior.branch,
    pullRequest: current.pullRequest ?? prior.pullRequest,
    acceptedHeadSha: current.acceptedHeadSha ?? prior.acceptedHeadSha,
    integratedMainSha: current.integratedMainSha ?? prior.integratedMainSha,
    finalDecision: current.finalDecision ?? prior.finalDecision,
    completionReceipt: current.completionReceipt ?? prior.completionReceipt,
  };
}

function isDurableAcceptedPhase(phase: PhaseRecord): boolean {
  return Boolean(
    phase.state === "COMPLETE" ||
      phase.state === "MERGED" ||
      phase.acceptedAt ||
      phase.mergedAt ||
      phase.completedAt ||
      phase.integratedMainSha ||
      phase.completionReceipt ||
      phase.finalDecision,
  );
}

function retainProject(current: ProjectRecord, prior: ProjectRecord | undefined): ProjectRecord {
  if (!prior) return current;
  const priorPhases = new Map(prior.phases.map((phase) => [phase.id, phase]));
  const phases = current.phases.map((phase) => retainPhase(phase, priorPhases.get(phase.id)));
  for (const phase of prior.phases)
    if (!current.phases.some((entry) => entry.id === phase.id) && isDurableAcceptedPhase(phase)) phases.push(phase);
  return {
    ...current,
    phases: phases.sort((left, right) => left.ordinal - right.ordinal),
    historicalNames: retainedNames(current.name, prior.name, current.historicalNames ?? prior.historicalNames),
    completionReceipt: current.completionReceipt ?? prior.completionReceipt,
    finalMainSha: current.finalMainSha ?? prior.finalMainSha,
    finalDecision: current.finalDecision ?? prior.finalDecision,
  };
}

export function assertHistoryPruneTarget(table: string): void {
  if (!prunableTables.has(table)) throw new Error(`Bridgewatch durable-history guard rejected prune target: ${table}`);
}

export interface HistoryQuery {
  since: string;
  until?: string;
  projectId?: string;
  phaseId?: string;
  kind?: BridgewatchEventKind;
  limit: number;
  cursor?: string;
}

export interface RetentionInspection {
  eventsEligible: number;
  snapshotsEligible: number;
  workersEligible: number;
  testNodesEligible: number;
  dailyRollupsEligible: number;
  missingDailyRollups: number;
  durableRowsEligible: 0;
  phaseRowsEligible: 0;
  completionRowsEligible: 0;
}

export interface RetentionResult extends RetentionInspection {
  dryRun: boolean;
  rollupsCreated: number;
  deleted: Record<string, number>;
  integrity: string;
  compacted: boolean;
}

export type SourceHealthState = "HEALTHY" | "STALE" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED" | "NOT_APPLICABLE";

export interface SourceObservation {
  name: string;
  state: SourceHealthState;
  configured: boolean;
  reachable: boolean | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextRetryAt: string | null;
  detail: string | null;
  cacheAgeMs: number | null;
  rateLimitRemaining?: number | null;
  authenticationState: "TOKEN_CONFIGURED" | "ANONYMOUS" | "NOT_APPLICABLE" | "UNKNOWN";
}

export class BridgewatchStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS bridgewatch_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    this.applyMigrations();
  }

  private applyMigrations(): void {
    for (const migration of migrations) {
      const exists = this.db
        .prepare("SELECT version FROM bridgewatch_migrations WHERE version = ?")
        .get(migration.version);
      if (exists) continue;
      this.db.exec("BEGIN");
      try {
        this.db.exec(migration.sql);
        this.db
          .prepare("INSERT INTO bridgewatch_migrations (version, applied_at) VALUES (?, ?)")
          .run(migration.version, new Date().toISOString());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  get<T>(key: string): { value: T; etag: string | null; observedAt: string; error: string | null } | null {
    const row = this.db
      .prepare("SELECT value_json, etag, observed_at, error_text FROM bridgewatch_cache WHERE cache_key = ?")
      .get(key) as
      | { value_json: string; etag: string | null; observed_at: string; error_text: string | null }
      | undefined;
    return row
      ? { value: JSON.parse(row.value_json) as T, etag: row.etag, observedAt: row.observed_at, error: row.error_text }
      : null;
  }

  put(key: string, value: unknown, etag: string | null, observedAt = new Date().toISOString()): void {
    const json = JSON.stringify(value);
    if (json.length > 1_000_000) throw new Error("Cache payload exceeds the Bridgewatch limit");
    this.db
      .prepare(
        "INSERT INTO bridgewatch_cache (cache_key, value_json, etag, observed_at, error_text) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(cache_key) DO UPDATE SET value_json=excluded.value_json, etag=excluded.etag, observed_at=excluded.observed_at, error_text=NULL",
      )
      .run(key, json, etag, observedAt);
  }

  replaceProjectRegistry(projects: readonly ProjectRecord[], observedAt = new Date().toISOString()): void {
    // Keep accepted fields for project identities that are still in the current
    // reconciliation, but do not leave a project visible merely because an older
    // discovery pass invented it.
    const priorProjects = new Map(
      this.db
        .prepare("SELECT project_id, value_json FROM project_history")
        .all()
        .map((row) => {
          const value = row as { project_id: string; value_json: string };
          return [value.project_id, JSON.parse(value.value_json) as ProjectRecord] as const;
        }),
    );
    this.db.exec("BEGIN");
    try {
      this.db.exec(
        "DELETE FROM milestone_history; DELETE FROM phase_history; DELETE FROM completion_records; DELETE FROM project_history;",
      );
      const project = this.db.prepare(
        "INSERT INTO project_history (project_id, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
      );
      const phase = this.db.prepare(
        "INSERT INTO phase_history (phase_id, project_id, ordinal, value_json, accepted_at, integrated_main_sha) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(phase_id) DO UPDATE SET project_id=excluded.project_id, ordinal=excluded.ordinal, value_json=excluded.value_json, accepted_at=excluded.accepted_at, integrated_main_sha=excluded.integrated_main_sha",
      );
      const milestone = this.db.prepare(
        "INSERT INTO milestone_history (milestone_id, phase_id, value_json, accepted_at) VALUES (?, ?, ?, ?) ON CONFLICT(milestone_id) DO UPDATE SET phase_id=excluded.phase_id, value_json=excluded.value_json, accepted_at=excluded.accepted_at",
      );
      for (const entry of projects) {
        const retained = retainProject(entry, priorProjects.get(entry.id));
        project.run(retained.id, JSON.stringify(retained), observedAt);
        for (const phaseRecord of retained.phases) {
          phase.run(
            phaseRecord.id,
            entry.id,
            phaseRecord.ordinal,
            JSON.stringify(phaseRecord),
            phaseRecord.acceptedAt ?? null,
            phaseRecord.integratedMainSha ?? null,
          );
          for (const milestoneRecord of phaseRecord.milestones)
            milestone.run(
              milestoneRecord.id,
              phaseRecord.id,
              JSON.stringify(milestoneRecord),
              milestoneRecord.acceptedAt ?? null,
            );
        }
        if (retained.completionReceipt)
          this.db
            .prepare(
              "INSERT INTO completion_records (project_id, receipt_path, final_main_sha, final_decision, completed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET receipt_path=excluded.receipt_path, final_main_sha=excluded.final_main_sha, final_decision=excluded.final_decision, completed_at=excluded.completed_at",
            )
            .run(
              retained.id,
              retained.completionReceipt,
              retained.finalMainSha ?? null,
              retained.finalDecision ?? null,
              observedAt,
            );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  projects(): ProjectRecord[] {
    return this.db
      .prepare("SELECT value_json FROM project_history ORDER BY project_id")
      .all()
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as ProjectRecord);
  }

  replaceDiscovery(discovery: DiscoveryResult, observedAt = new Date().toISOString()): void {
    this.db.exec("BEGIN");
    try {
      // These tables are the current repository-discovery projection. Historical
      // transitions are retained separately in normalized events; stale current
      // discoveries must not remain visible after a successful reconciliation.
      this.db.exec(
        "DELETE FROM discovery_evidence; DELETE FROM discovered_versions; DELETE FROM discovered_phases; DELETE FROM discovered_projects; DELETE FROM unclassified_activity;",
      );
      const project = this.db.prepare(
        "INSERT INTO discovered_projects (project_id, name, confidence, phase_count, observed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET name=excluded.name, confidence=excluded.confidence, phase_count=excluded.phase_count, observed_at=excluded.observed_at",
      );
      const version = this.db.prepare(
        "INSERT INTO discovered_versions (project_id, identity, lifecycle, confidence, observed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id, identity) DO UPDATE SET lifecycle=excluded.lifecycle, confidence=excluded.confidence, observed_at=excluded.observed_at",
      );
      const phase = this.db.prepare(
        "INSERT INTO discovered_phases (project_id, ordinal, name, confidence, observed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id, ordinal) DO UPDATE SET name=excluded.name, confidence=excluded.confidence, observed_at=excluded.observed_at",
      );
      const evidence = this.db.prepare(
        "INSERT INTO discovery_evidence (entity_type, entity_id, source_kind, reference, confidence, observed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id, source_kind, reference) DO UPDATE SET confidence=excluded.confidence, observed_at=excluded.observed_at",
      );
      for (const entry of discovery.projects) {
        project.run(entry.id, entry.name, entry.confidence, entry.phaseCount, observedAt);
        this.writeDiscoveryEvidence(evidence, "project", entry.id, entry.evidence, observedAt);
        for (const item of entry.versions) {
          version.run(entry.id, item.identity, item.lifecycle, item.confidence, observedAt);
          this.writeDiscoveryEvidence(evidence, "version", `${entry.id}:${item.identity}`, item.evidence, observedAt);
        }
        for (const item of entry.phases) {
          phase.run(entry.id, item.ordinal, item.name, item.confidence, observedAt);
          this.writeDiscoveryEvidence(evidence, "phase", `${entry.id}:${item.ordinal}`, item.evidence, observedAt);
        }
      }
      const unclassified = this.db.prepare(
        "INSERT INTO unclassified_activity (source_kind, reference, confidence, observed_at) VALUES (?, ?, ?, ?) ON CONFLICT(source_kind, reference) DO UPDATE SET confidence=excluded.confidence, observed_at=excluded.observed_at",
      );
      for (const item of discovery.unclassified)
        unclassified.run(item.kind, item.reference, item.confidence, observedAt);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  discoveredProjects(): DiscoveredProject[] {
    const projects = this.db
      .prepare("SELECT project_id, name, confidence, phase_count FROM discovered_projects ORDER BY name")
      .all() as Array<{
      project_id: string;
      name: string;
      confidence: DiscoveredProject["confidence"];
      phase_count: number | null;
    }>;
    const versions = this.db
      .prepare(
        "SELECT project_id, identity, lifecycle, confidence FROM discovered_versions ORDER BY project_id, identity",
      )
      .all() as Array<{
      project_id: string;
      identity: string;
      lifecycle: DiscoveredVersion["lifecycle"];
      confidence: DiscoveredVersion["confidence"];
    }>;
    const phases = this.db
      .prepare("SELECT project_id, ordinal, name, confidence FROM discovered_phases ORDER BY project_id, ordinal")
      .all() as Array<{ project_id: string; ordinal: number; name: string; confidence: DiscoveredPhase["confidence"] }>;
    return projects.map((entry) => ({
      id: entry.project_id,
      name: entry.name,
      confidence: entry.confidence,
      phaseCount: entry.phase_count,
      evidence: this.discoveryEvidence("project", entry.project_id),
      versions: versions
        .filter((version) => version.project_id === entry.project_id)
        .map((version) => ({
          identity: version.identity,
          lifecycle: version.lifecycle,
          confidence: version.confidence,
          evidence: this.discoveryEvidence("version", `${entry.project_id}:${version.identity}`),
        })),
      phases: phases
        .filter((phase) => phase.project_id === entry.project_id)
        .map((phase) => ({
          ordinal: phase.ordinal,
          name: phase.name,
          confidence: phase.confidence,
          evidence: this.discoveryEvidence("phase", `${entry.project_id}:${phase.ordinal}`),
        })),
    }));
  }

  discoveryEvidence(entityType: string, entityId: string): DiscoveryEvidence[] {
    return this.db
      .prepare(
        "SELECT source_kind, reference, confidence FROM discovery_evidence WHERE entity_type = ? AND entity_id = ? ORDER BY source_kind, reference",
      )
      .all(entityType, entityId)
      .map((row) => {
        const evidence = row as {
          source_kind: DiscoveryEvidence["kind"];
          reference: string;
          confidence: DiscoveryEvidence["confidence"];
        };
        return { kind: evidence.source_kind, reference: evidence.reference, confidence: evidence.confidence };
      });
  }

  upsertSourceObservation(observation: SourceObservation): void {
    if (!/^[a-z0-9-]{1,80}$/iu.test(observation.name)) throw new Error("Invalid Bridgewatch source name");
    if (observation.detail && observation.detail.length > 1_000)
      throw new Error("Bridgewatch source detail exceeds limit");
    this.db
      .prepare(
        "INSERT INTO source_observations (source_name, state, configured, reachable, last_attempt_at, last_success_at, next_retry_at, detail, cache_age_ms, rate_limit_remaining, authentication_state, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_name) DO UPDATE SET state=excluded.state, configured=excluded.configured, reachable=excluded.reachable, last_attempt_at=excluded.last_attempt_at, last_success_at=excluded.last_success_at, next_retry_at=excluded.next_retry_at, detail=excluded.detail, cache_age_ms=excluded.cache_age_ms, rate_limit_remaining=excluded.rate_limit_remaining, authentication_state=excluded.authentication_state, observed_at=excluded.observed_at",
      )
      .run(
        observation.name,
        observation.state,
        Number(observation.configured),
        observation.reachable === null ? null : Number(observation.reachable),
        observation.lastAttemptAt,
        observation.lastSuccessAt,
        observation.nextRetryAt,
        observation.detail,
        observation.cacheAgeMs,
        observation.rateLimitRemaining ?? null,
        observation.authenticationState,
        new Date().toISOString(),
      );
  }

  sourceObservations(): SourceObservation[] {
    return this.db
      .prepare(
        "SELECT source_name, state, configured, reachable, last_attempt_at, last_success_at, next_retry_at, detail, cache_age_ms, rate_limit_remaining, authentication_state FROM source_observations ORDER BY source_name",
      )
      .all()
      .map((row) => {
        const source = row as {
          source_name: string;
          state: SourceHealthState;
          configured: number;
          reachable: number | null;
          last_attempt_at: string | null;
          last_success_at: string | null;
          next_retry_at: string | null;
          detail: string | null;
          cache_age_ms: number | null;
          rate_limit_remaining: number | null;
          authentication_state: SourceObservation["authenticationState"];
        };
        return {
          name: source.source_name,
          state: source.state,
          configured: Boolean(source.configured),
          reachable: source.reachable === null ? null : Boolean(source.reachable),
          lastAttemptAt: source.last_attempt_at,
          lastSuccessAt: source.last_success_at,
          nextRetryAt: source.next_retry_at,
          detail: source.detail,
          cacheAgeMs: source.cache_age_ms,
          rateLimitRemaining: source.rate_limit_remaining,
          authenticationState: source.authentication_state,
        };
      });
  }

  replaceGithubObservations(
    value: { pullRequests: readonly GithubPullRequestHistory[]; branches: readonly BranchHealth[] },
    observedAt: string,
  ): void {
    this.db.exec("BEGIN");
    try {
      const pull = this.db.prepare(
        "INSERT INTO observed_pull_requests (pull_request_number, title, state, head_ref, head_sha, updated_at, observed_at, value_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(pull_request_number) DO UPDATE SET title=excluded.title, state=excluded.state, head_ref=excluded.head_ref, head_sha=excluded.head_sha, updated_at=excluded.updated_at, observed_at=excluded.observed_at, value_json=excluded.value_json",
      );
      for (const item of value.pullRequests)
        pull.run(
          item.number,
          item.title,
          item.state,
          item.headRef,
          item.headSha,
          item.updatedAt,
          observedAt,
          JSON.stringify(item),
        );
      const branch = this.db.prepare(
        "INSERT INTO observed_branches (branch_name, head_sha, default_sha, pull_request_number, observed_at, value_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(branch_name) DO UPDATE SET head_sha=excluded.head_sha, default_sha=excluded.default_sha, pull_request_number=excluded.pull_request_number, observed_at=excluded.observed_at, value_json=excluded.value_json",
      );
      for (const item of value.branches)
        branch.run(item.name, item.headSha, item.defaultSha, item.pullRequestNumber, observedAt, JSON.stringify(item));
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  observedPullRequests(limit = 100): GithubPullRequestHistory[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid Bridgewatch pull-request limit");
    return this.db
      .prepare(
        "SELECT value_json FROM observed_pull_requests ORDER BY updated_at DESC, pull_request_number DESC LIMIT ?",
      )
      .all(limit)
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as GithubPullRequestHistory);
  }

  observedBranches(limit = 100): BranchHealth[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid Bridgewatch branch limit");
    return this.db
      .prepare("SELECT value_json FROM observed_branches ORDER BY observed_at DESC, branch_name ASC LIMIT ?")
      .all(limit)
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as BranchHealth);
  }

  replaceTestProjection(projection: SoundingLineProjection): void {
    this.db.exec("BEGIN");
    try {
      const run = this.db.prepare(
        "INSERT INTO test_runs (run_id, value_json, observed_at) VALUES (?, ?, ?) ON CONFLICT(run_id) DO UPDATE SET value_json=excluded.value_json, observed_at=excluded.observed_at",
      );
      const node = this.db.prepare(
        "INSERT INTO test_nodes (node_id, run_id, value_json, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(node_id) DO UPDATE SET run_id=excluded.run_id, value_json=excluded.value_json, completed_at=excluded.completed_at",
      );
      for (const plan of projection.plans) {
        run.run(plan.id, JSON.stringify(plan), projection.observedAt);
        for (const testNode of plan.nodes)
          node.run(`${plan.id}:${testNode.id}`, plan.id, JSON.stringify(testNode), testNode.completedAt);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  recentTestRuns(
    limit = 20,
  ): Array<{ id: string; observedAt: string; value: SoundingLineProjection["plans"][number] }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("Invalid Bridgewatch test-run history limit");
    return this.db
      .prepare("SELECT run_id, value_json, observed_at FROM test_runs ORDER BY observed_at DESC LIMIT ?")
      .all(limit)
      .map((row) => {
        const result = row as { run_id: string; value_json: string; observed_at: string };
        return {
          id: result.run_id,
          observedAt: result.observed_at,
          value: JSON.parse(result.value_json) as SoundingLineProjection["plans"][number],
        };
      });
  }

  recordHistory(
    snapshot: BridgewatchProgramSnapshot,
    {
      storeSnapshot = true,
      prior: suppliedPrior,
    }: { storeSnapshot?: boolean; prior?: BridgewatchProgramSnapshot | null } = {},
  ): {
    events: BridgewatchHistoricalEvent[];
    snapshotStored: boolean;
  } {
    const prior =
      suppliedPrior === undefined
        ? (this.get<BridgewatchProgramSnapshot>("history:current-normalized")?.value ?? null)
        : suppliedPrior;
    const events = deriveEvents(prior, snapshot);
    let digest: string | null = null;
    let snapshotStored = false;
    if (storeSnapshot) {
      digest = snapshotDigest(snapshot);
      const latest = this.db
        .prepare("SELECT normalized_digest FROM snapshots ORDER BY snapshot_id DESC LIMIT 1")
        .get() as { normalized_digest: string } | undefined;
      snapshotStored = latest?.normalized_digest !== digest;
    }
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(
        "INSERT INTO events (event_id, dedupe_key, kind, source, project_id, phase_id, entity_type, entity_id, occurred_at, observed_at, previous_json, current_json, summary, evidence_refs_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dedupe_key) DO NOTHING",
      );
      for (const event of events)
        insert.run(
          event.id,
          event.dedupeKey,
          event.kind,
          event.source,
          event.projectId ?? null,
          event.phaseId ?? null,
          event.entityType,
          event.entityId,
          event.occurredAt,
          event.observedAt,
          event.previous ? JSON.stringify(event.previous) : null,
          event.current ? JSON.stringify(event.current) : null,
          event.summary,
          JSON.stringify(event.evidenceRefs),
        );
      if (snapshotStored) {
        const json = JSON.stringify(snapshot);
        if (json.length > 1_000_000) throw new Error("Bridgewatch normalized snapshot exceeds the safe size limit");
        this.db
          .prepare(
            "INSERT INTO snapshots (captured_at, schema_version, normalized_digest, program_json) VALUES (?, ?, ?, ?)",
          )
          .run(snapshot.capturedAt, snapshot.schemaVersion, digest, json);
      }
      this.put("history:current-normalized", snapshot, null, snapshot.capturedAt);
      this.db.exec("COMMIT");
      return { events, snapshotStored };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  history(query: HistoryQuery): { events: BridgewatchHistoricalEvent[]; nextCursor: string | null } {
    const where = ["observed_at >= ?"];
    const values: Array<string | number> = [query.since];
    if (query.until) {
      where.push("observed_at <= ?");
      values.push(query.until);
    }
    if (query.projectId) {
      where.push("project_id = ?");
      values.push(query.projectId);
    }
    if (query.phaseId) {
      where.push("phase_id = ?");
      values.push(query.phaseId);
    }
    if (query.kind) {
      where.push("kind = ?");
      values.push(query.kind);
    }
    if (query.cursor) {
      const parsed = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as [string, string];
      if (!Array.isArray(parsed) || typeof parsed[0] !== "string" || typeof parsed[1] !== "string")
        throw new Error("Invalid Bridgewatch history cursor");
      where.push("(observed_at < ? OR (observed_at = ? AND event_id < ?))");
      values.push(parsed[0], parsed[0], parsed[1]);
    }
    const rows = this.db
      .prepare(
        `SELECT event_id, dedupe_key, kind, source, project_id, phase_id, entity_type, entity_id, occurred_at, observed_at, previous_json, current_json, summary, evidence_refs_json FROM events WHERE ${where.join(" AND ")} ORDER BY observed_at DESC, event_id DESC LIMIT ?`,
      )
      .all(...values, query.limit + 1) as Array<Record<string, string | null>>;
    const page = rows.slice(0, query.limit).map((row) => this.eventFromRow(row));
    const tail = page.at(-1);
    return {
      events: page,
      nextCursor:
        rows.length > query.limit && tail
          ? Buffer.from(JSON.stringify([tail.observedAt, tail.id])).toString("base64url")
          : null,
    };
  }

  projectHistory(projectId: string, limit = 100): BridgewatchHistoricalEvent[] {
    return this.history({ since: "1970-01-01T00:00:00.000Z", projectId, limit }).events;
  }

  dailyRollups(limit = 90): DailyRollup[] {
    return this.db
      .prepare("SELECT value_json FROM daily_rollups WHERE scope = 'program' ORDER BY day DESC LIMIT ?")
      .all(limit)
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as DailyRollup);
  }

  dailyRollupsBetween(from: string, to: string): DailyRollup[] {
    const fromDay = from.slice(0, 10);
    const toDay = to.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/u.test(toDay) || fromDay > toDay)
      throw new Error("Invalid Bridgewatch rollup window");
    return this.db
      .prepare(
        "SELECT value_json FROM daily_rollups WHERE scope = 'program' AND day >= ? AND day <= ? ORDER BY day ASC",
      )
      .all(fromDay, toDay)
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as DailyRollup);
  }

  snapshotCount(): number {
    return Number((this.db.prepare("SELECT COUNT(*) AS count FROM snapshots").get() as { count: number }).count);
  }

  rootFailureRecurrences(since: string, minimum = 3): Array<{ rootFailureId: string; count: number }> {
    if (!Number.isInteger(minimum) || minimum < 2)
      throw new Error("Invalid Bridgewatch root-failure recurrence minimum");
    return this.db
      .prepare(
        "SELECT entity_id, COUNT(*) AS count FROM events WHERE kind = 'SOUNDING_LINE_ROOT_FAILURE' AND observed_at >= ? GROUP BY entity_id HAVING COUNT(*) >= ? ORDER BY count DESC, entity_id",
      )
      .all(since, minimum)
      .map((row) => {
        const result = row as { entity_id: string; count: number };
        return { rootFailureId: result.entity_id, count: Number(result.count) };
      });
  }

  retentionInspection(eventRetentionDays: number, rollupRetentionDays: number, now = new Date()): RetentionInspection {
    const eventCutoff = new Date(now.getTime() - eventRetentionDays * 86_400_000).toISOString();
    const rollupCutoff = new Date(now.getTime() - rollupRetentionDays * 86_400_000).toISOString().slice(0, 10);
    const count = (sql: string, value: string) => Number((this.db.prepare(sql).get(value) as { count: number }).count);
    const expiredDays = this.eventDaysBefore(eventCutoff);
    const existing = new Set(
      this.db
        .prepare("SELECT day FROM daily_rollups WHERE scope = 'program'")
        .all()
        .map((row) => (row as { day: string }).day),
    );
    return {
      // A final Sounding Line decision is accepted evidence, not disposable
      // operational telemetry. Its event remains available even after the
      // detailed-history window has elapsed.
      eventsEligible: count(
        "SELECT COUNT(*) AS count FROM events WHERE occurred_at < ? AND kind <> 'SOUNDING_LINE_DECISION'",
        eventCutoff,
      ),
      snapshotsEligible: count("SELECT COUNT(*) AS count FROM snapshots WHERE captured_at < ?", eventCutoff),
      workersEligible: count("SELECT COUNT(*) AS count FROM workers WHERE heartbeat_at < ?", eventCutoff),
      testNodesEligible: count(
        "SELECT COUNT(*) AS count FROM test_nodes WHERE completed_at IS NOT NULL AND completed_at < ?",
        eventCutoff,
      ),
      dailyRollupsEligible: count("SELECT COUNT(*) AS count FROM daily_rollups WHERE day < ?", rollupCutoff),
      missingDailyRollups: expiredDays.filter((day) => !existing.has(day)).length,
      durableRowsEligible: 0,
      phaseRowsEligible: 0,
      completionRowsEligible: 0,
    };
  }

  pruneHistory({
    eventRetentionDays,
    rollupRetentionDays,
    dryRun = true,
    compact = false,
    now = new Date(),
  }: {
    eventRetentionDays: number;
    rollupRetentionDays: number;
    dryRun?: boolean;
    compact?: boolean;
    now?: Date;
  }): RetentionResult {
    const inspection = this.retentionInspection(eventRetentionDays, rollupRetentionDays, now);
    if (dryRun)
      return {
        ...inspection,
        dryRun: true,
        rollupsCreated: 0,
        deleted: {},
        integrity: this.integrityCheck(),
        compacted: false,
      };
    const eventCutoff = new Date(now.getTime() - eventRetentionDays * 86_400_000).toISOString();
    const rollupCutoff = new Date(now.getTime() - rollupRetentionDays * 86_400_000).toISOString().slice(0, 10);
    const rollupsCreated = this.materializeRollupsBefore(eventCutoff, now.toISOString());
    const deleted: Record<string, number> = {};
    this.db.exec("BEGIN");
    try {
      this.assertPrunableTable("events");
      deleted.events = Number(
        this.db
          .prepare("DELETE FROM events WHERE occurred_at < ? AND kind <> 'SOUNDING_LINE_DECISION'")
          .run(eventCutoff).changes,
      );
      deleted.snapshots = this.deleteBefore("snapshots", "captured_at", eventCutoff);
      deleted.workers = this.deleteBefore("workers", "heartbeat_at", eventCutoff);
      this.assertPrunableTable("test_nodes");
      deleted.test_nodes = Number(
        this.db.prepare("DELETE FROM test_nodes WHERE completed_at IS NOT NULL AND completed_at < ?").run(eventCutoff)
          .changes,
      );
      deleted.daily_rollups = this.deleteBefore("daily_rollups", "day", rollupCutoff);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    const integrity = this.integrityCheck();
    if (integrity !== "ok") throw new Error(`Bridgewatch history integrity check failed: ${integrity}`);
    const hasMaterialPrune = Object.values(deleted).some((value) => value >= 1_000);
    if (compact && hasMaterialPrune) this.db.exec("VACUUM");
    return { ...inspection, dryRun: false, rollupsCreated, deleted, integrity, compacted: compact && hasMaterialPrune };
  }

  async backupTo(target: string): Promise<void> {
    mkdirSync(dirname(target), { recursive: true });
    await backup(this.db, target);
  }

  integrityCheck(): string {
    return String((this.db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check);
  }

  private eventFromRow(row: Record<string, string | null>): BridgewatchHistoricalEvent {
    return {
      id: row.event_id!,
      dedupeKey: row.dedupe_key!,
      kind: row.kind as BridgewatchEventKind,
      source: row.source as BridgewatchHistoricalEvent["source"],
      projectId: row.project_id ?? undefined,
      phaseId: row.phase_id ?? undefined,
      entityType: row.entity_type!,
      entityId: row.entity_id!,
      occurredAt: row.occurred_at!,
      observedAt: row.observed_at!,
      previous: row.previous_json ? JSON.parse(row.previous_json) : undefined,
      current: row.current_json ? JSON.parse(row.current_json) : undefined,
      summary: row.summary!,
      evidenceRefs: JSON.parse(row.evidence_refs_json ?? "[]") as string[],
    };
  }

  private writeDiscoveryEvidence(
    statement: StatementSync,
    entityType: string,
    entityId: string,
    evidence: readonly DiscoveryEvidence[],
    observedAt: string,
  ): void {
    for (const item of evidence)
      statement.run(entityType, entityId, item.kind, item.reference, item.confidence, observedAt);
  }

  private eventDaysBefore(cutoff: string): string[] {
    return this.db
      .prepare(
        "SELECT DISTINCT substr(occurred_at, 1, 10) AS day FROM events WHERE occurred_at < ? AND kind <> 'SOUNDING_LINE_DECISION' ORDER BY day",
      )
      .all(cutoff)
      .map((row) => (row as { day: string }).day);
  }

  private materializeRollupsBefore(cutoff: string, createdAt: string): number {
    let created = 0;
    const hasRollup = this.db.prepare("SELECT 1 FROM daily_rollups WHERE day = ? AND scope = 'program'");
    const eventsForDay = this.db.prepare(
      "SELECT event_id, dedupe_key, kind, source, project_id, phase_id, entity_type, entity_id, occurred_at, observed_at, previous_json, current_json, summary, evidence_refs_json FROM events WHERE substr(occurred_at, 1, 10) = ? ORDER BY observed_at, event_id",
    );
    const insert = this.db.prepare(
      "INSERT INTO daily_rollups (day, scope, value_json, created_at) VALUES (?, 'program', ?, ?) ON CONFLICT(day, scope) DO NOTHING",
    );
    for (const day of this.eventDaysBefore(cutoff)) {
      if (hasRollup.get(day)) continue;
      const events = (eventsForDay.all(day) as Array<Record<string, string | null>>).map((row) =>
        this.eventFromRow(row),
      );
      const result = insert.run(day, JSON.stringify(rollupForDay(day, events)), createdAt);
      created += Number(result.changes);
    }
    return created;
  }

  private assertPrunableTable(table: string): void {
    assertHistoryPruneTarget(table);
  }

  private deleteBefore(table: string, column: string, cutoff: string): number {
    this.assertPrunableTable(table);
    if (!/^[a-z_]+$/u.test(column)) throw new Error("Invalid Bridgewatch retention column");
    return Number(this.db.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).run(cutoff).changes);
  }

  migrationVersions(): number[] {
    return this.db
      .prepare("SELECT version FROM bridgewatch_migrations ORDER BY version")
      .all()
      .map((row) => (row as { version: number }).version);
  }

  upsertWorker(worker: Heartbeat, finished = false): void {
    this.db
      .prepare(
        "INSERT INTO workers (worker_id, value_json, heartbeat_at, finished_at) VALUES (?, ?, ?, ?) ON CONFLICT(worker_id) DO UPDATE SET value_json=excluded.value_json, heartbeat_at=excluded.heartbeat_at, finished_at=excluded.finished_at",
      )
      .run(worker.workerId, JSON.stringify(worker), worker.heartbeatAt, finished ? worker.heartbeatAt : null);
  }

  workers(): Heartbeat[] {
    return this.db
      .prepare("SELECT value_json FROM workers ORDER BY heartbeat_at DESC")
      .all()
      .map((row) => JSON.parse((row as { value_json: string }).value_json) as Heartbeat);
  }

  close(): void {
    this.db.close();
  }
}
