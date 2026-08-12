import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProjectRecord } from "../src/domain.js";
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
] as const;

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
        project.run(entry.id, JSON.stringify(entry), observedAt);
        for (const phaseRecord of entry.phases) {
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
        if (entry.completionReceipt)
          this.db
            .prepare(
              "INSERT INTO completion_records (project_id, receipt_path, final_main_sha, final_decision, completed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET receipt_path=excluded.receipt_path, final_main_sha=excluded.final_main_sha, final_decision=excluded.final_decision, completed_at=excluded.completed_at",
            )
            .run(
              entry.id,
              entry.completionReceipt,
              entry.finalMainSha ?? null,
              entry.finalDecision ?? null,
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
