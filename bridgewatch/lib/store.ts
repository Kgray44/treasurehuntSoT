import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import type { MilestoneRecord, PhaseRecord, ProjectRecord } from "../src/domain.js";
import {
  deriveEvents,
  rollupForDay,
  snapshotDigest,
  type BridgewatchEventKind,
  type BridgewatchHistoricalEvent,
  type BridgewatchProgramSnapshot,
  type DailyRollup,
} from "../src/history.js";
import type { SoundingLineProjection } from "../src/sounding-line.js";
import type { Heartbeat } from "../src/telemetry.js";

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

function retainProject(current: ProjectRecord, prior: ProjectRecord | undefined): ProjectRecord {
  if (!prior) return current;
  const priorPhases = new Map(prior.phases.map((phase) => [phase.id, phase]));
  const phases = current.phases.map((phase) => retainPhase(phase, priorPhases.get(phase.id)));
  for (const phase of prior.phases) if (!current.phases.some((entry) => entry.id === phase.id)) phases.push(phase);
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
    this.db.exec("BEGIN");
    try {
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
        const prior = this.db.prepare("SELECT value_json FROM project_history WHERE project_id = ?").get(entry.id) as
          | { value_json: string }
          | undefined;
        const retained = retainProject(entry, prior ? (JSON.parse(prior.value_json) as ProjectRecord) : undefined);
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

  recordHistory(snapshot: BridgewatchProgramSnapshot): {
    events: BridgewatchHistoricalEvent[];
    snapshotStored: boolean;
  } {
    const prior = this.get<BridgewatchProgramSnapshot>("history:current-normalized")?.value ?? null;
    const events = deriveEvents(prior, snapshot);
    const digest = snapshotDigest(snapshot);
    const latest = this.db
      .prepare("SELECT normalized_digest FROM snapshots ORDER BY snapshot_id DESC LIMIT 1")
      .get() as { normalized_digest: string } | undefined;
    const snapshotStored = latest?.normalized_digest !== digest;
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
