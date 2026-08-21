import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { NightwatchInvariantError, NightwatchLedger, type IntegrationBudgetStatus } from "./runtime";

export type BosunCascadeState =
  | "ACTIVE"
  | "CONVERGED"
  | "PARKED_OWNER"
  | "PARKED_BUDGET"
  | "PARKED_PARENT_BREAKER"
  | "BLOCKED_EXTERNAL";

export interface BosunFinding {
  owner: string;
  category: string;
  resource: string;
  contract: string;
  runtimeClass: string;
  repairClass: "AUTO_0" | "AUTO_1" | "AUTO_2" | "OWNER";
}

export interface BosunCascade {
  id: string;
  rootFingerprint: string;
  parentTransactionId: string;
  rootOwner: string;
  generation: number;
  activeObjectiveId: string | null;
  activeRepairPr: number | null;
  blockedCandidates: string[];
  closureSteps: string[];
  repairPrCount: number;
  authorityAttempts: number;
  mainlineRebuilds: number;
  controlPlaneMs: number;
  controlPlaneWaitMs: number;
  duplicateRepairsSuppressed: number;
  dependentWakeupCount: number;
  status: BosunCascadeState;
  startedAt: string;
  updatedAt: string;
}

export interface BosunProjection {
  station: "BOSUN";
  state: "LIVE" | "DEGRADED" | "DOWN";
  controllerId: string | null;
  heartbeatAt: string | null;
  heartbeatAgeMs: number | null;
  activeCascadeCount: number;
  cascades: Array<BosunCascade & { parentBudget: IntegrationBudgetStatus }>;
}

export const normalizeBosunFingerprint = (finding: BosunFinding) =>
  [
    `owner=${finding.owner}`,
    `category=${finding.category}`,
    `resource=${finding.resource}`,
    `contract=${finding.contract}`,
    `runtime=${finding.runtimeClass}`,
    `repair=${finding.repairClass}`,
  ]
    .map((entry) => entry.trim().toLowerCase().replace(/\s+/gu, "-"))
    .join("|");

const iso = (now = Date.now()) => new Date(now).toISOString();
const json = (value: unknown) => JSON.stringify(value);
const parse = <T>(value: string) => JSON.parse(value) as T;
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
const digest = (value: unknown) => createHash("sha256").update(json(value)).digest("hex");

/**
 * Durable Bosun state intentionally shares Nightwatch's SQLite database, while
 * retaining a separate schema boundary so Bosun cannot become a competing queue.
 */
export class BosunLedger {
  private readonly db: DatabaseSync;

  constructor(
    databasePath: string,
    private readonly nightwatch: NightwatchLedger,
  ) {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bosun_cascades (
        cascade_id TEXT PRIMARY KEY,
        root_fingerprint TEXT NOT NULL UNIQUE,
        parent_transaction_id TEXT NOT NULL,
        root_owner TEXT NOT NULL,
        generation INTEGER NOT NULL DEFAULT 0,
        active_objective_id TEXT,
        active_repair_pr INTEGER,
        blocked_candidates_json TEXT NOT NULL DEFAULT '[]',
        closure_steps_json TEXT NOT NULL DEFAULT '[]',
        repair_pr_count INTEGER NOT NULL DEFAULT 0,
        authority_attempts INTEGER NOT NULL DEFAULT 0,
        mainline_rebuilds INTEGER NOT NULL DEFAULT 0,
        control_plane_ms INTEGER NOT NULL DEFAULT 0,
        control_plane_wait_ms INTEGER NOT NULL DEFAULT 0,
        duplicate_repairs_suppressed INTEGER NOT NULL DEFAULT 0,
        dependent_wakeup_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bosun_wakeups (
        cascade_id TEXT NOT NULL REFERENCES bosun_cascades(cascade_id),
        candidate_id TEXT NOT NULL,
        landed_main_sha TEXT NOT NULL,
        woken_at TEXT NOT NULL,
        PRIMARY KEY(cascade_id, candidate_id)
      );
      CREATE TABLE IF NOT EXISTS bosun_controller_health (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        controller_id TEXT,
        state TEXT NOT NULL,
        heartbeat_at TEXT,
        detail TEXT
      );
      INSERT OR IGNORE INTO bosun_controller_health(singleton, state) VALUES (1, 'DOWN');
    `);
  }

  close() {
    this.db.close();
  }

  private row(id: string) {
    const row = this.db.prepare("SELECT * FROM bosun_cascades WHERE cascade_id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) throw new NightwatchInvariantError("BOSUN_CASCADE_NOT_FOUND", id);
    return row;
  }

  private cascade(row: Record<string, unknown>): BosunCascade {
    return {
      id: String(row.cascade_id), rootFingerprint: String(row.root_fingerprint), parentTransactionId: String(row.parent_transaction_id),
      rootOwner: String(row.root_owner), generation: Number(row.generation), activeObjectiveId: row.active_objective_id ? String(row.active_objective_id) : null,
      activeRepairPr: row.active_repair_pr === null ? null : Number(row.active_repair_pr), blockedCandidates: parse<string[]>(String(row.blocked_candidates_json)),
      closureSteps: parse<string[]>(String(row.closure_steps_json)), repairPrCount: Number(row.repair_pr_count), authorityAttempts: Number(row.authority_attempts),
      mainlineRebuilds: Number(row.mainline_rebuilds), controlPlaneMs: Number(row.control_plane_ms), controlPlaneWaitMs: Number(row.control_plane_wait_ms),
      duplicateRepairsSuppressed: Number(row.duplicate_repairs_suppressed), dependentWakeupCount: Number(row.dependent_wakeup_count),
      status: String(row.status) as BosunCascadeState, startedAt: String(row.started_at), updatedAt: String(row.updated_at),
    };
  }

  private parentBudget(transactionId: string, now: number) {
    return this.nightwatch.transactionBudget(transactionId, now);
  }

  reportFinding(input: { finding: BosunFinding; parentTransactionId: string; blockedCandidateId: string; closureSteps: string[]; at?: string }) {
    const at = input.at ?? iso();
    const now = Date.parse(at);
    const fingerprint = normalizeBosunFingerprint(input.finding);
    const budget = this.parentBudget(input.parentTransactionId, now);
    let row = this.db.prepare("SELECT * FROM bosun_cascades WHERE root_fingerprint = ?").get(fingerprint) as Record<string, unknown> | undefined;
    if (!row) {
      const status: BosunCascadeState = budget.status === "PARKED_BREAKER" ? "PARKED_PARENT_BREAKER" : "ACTIVE";
      const id = randomUUID();
      this.db.prepare(`INSERT INTO bosun_cascades(cascade_id, root_fingerprint, parent_transaction_id, root_owner, blocked_candidates_json, closure_steps_json, status, started_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, fingerprint, input.parentTransactionId, input.finding.owner, json([input.blockedCandidateId]), json(unique(input.closureSteps)), status, at, at);
      row = this.row(id);
    } else {
      const existing = this.cascade(row);
      if (existing.parentTransactionId !== input.parentTransactionId)
        throw new NightwatchInvariantError("BOSUN_PARENT_TRANSACTION_MISMATCH", existing.id);
      const blocked = unique([...existing.blockedCandidates, input.blockedCandidateId]);
      this.db.prepare("UPDATE bosun_cascades SET blocked_candidates_json = ?, updated_at = ? WHERE cascade_id = ?")
        .run(json(blocked), at, existing.id);
      row = this.row(existing.id);
    }
    return { cascade: this.cascade(row), duplicate: Boolean(row.active_objective_id), budget };
  }

  createOrReuseRepair(cascadeId: string, objectiveId: string, repairPr: number | null, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    const budget = this.parentBudget(cascade.parentTransactionId, Date.parse(at));
    if (cascade.status === "PARKED_PARENT_BREAKER" || budget.status === "PARKED_BREAKER") {
      this.parkParentBreaker(cascadeId, at);
      throw new NightwatchInvariantError("PARKED_PARENT_BREAKER", cascadeId);
    }
    if (cascade.generation > 2) throw new NightwatchInvariantError("PARKED_OWNER", cascadeId);
    if (cascade.activeObjectiveId) {
      this.db.prepare("UPDATE bosun_cascades SET duplicate_repairs_suppressed = duplicate_repairs_suppressed + 1, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
      return { cascade: this.cascade(this.row(cascadeId)), created: false };
    }
    this.db.prepare(`UPDATE bosun_cascades SET active_objective_id = ?, active_repair_pr = ?, repair_pr_count = repair_pr_count + CASE WHEN ? IS NULL THEN 0 ELSE 1 END, updated_at = ? WHERE cascade_id = ?`)
      .run(objectiveId, repairPr, repairPr, at, cascadeId);
    return { cascade: this.cascade(this.row(cascadeId)), created: true };
  }

  recordMainlineRebuild(cascadeId: string, at = iso()) {
    this.db.prepare("UPDATE bosun_cascades SET mainline_rebuilds = mainline_rebuilds + 1, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  recordAuthorityAttempt(cascadeId: string, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    const budget = this.parentBudget(cascade.parentTransactionId, Date.parse(at));
    if (budget.status !== "ACTIVE" && budget.status !== "WARNING") throw new NightwatchInvariantError("BOSUN_PARENT_BUDGET_DISALLOWS_AUTHORITY", cascadeId);
    this.db.prepare("UPDATE bosun_cascades SET authority_attempts = authority_attempts + 1, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  parkParentBreaker(cascadeId: string, at = iso()) {
    this.db.prepare("UPDATE bosun_cascades SET status = 'PARKED_PARENT_BREAKER', updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  converge(cascadeId: string, landedMainSha: string, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    if (!landedMainSha || cascade.closureSteps.length) throw new NightwatchInvariantError("BOSUN_CLOSURE_INCOMPLETE", cascadeId);
    this.db.prepare("UPDATE bosun_cascades SET status = 'CONVERGED', active_objective_id = NULL, active_repair_pr = NULL, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    for (const candidateId of cascade.blockedCandidates)
      this.db.prepare("INSERT OR IGNORE INTO bosun_wakeups(cascade_id, candidate_id, landed_main_sha, woken_at) VALUES (?, ?, ?, ?)")
        .run(cascadeId, candidateId, landedMainSha, at);
    this.db.prepare("UPDATE bosun_cascades SET dependent_wakeup_count = (SELECT count(*) FROM bosun_wakeups WHERE cascade_id = ?), updated_at = ? WHERE cascade_id = ?")
      .run(cascadeId, at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  setClosureSteps(cascadeId: string, closureSteps: string[], at = iso()) {
    this.db.prepare("UPDATE bosun_cascades SET closure_steps_json = ?, updated_at = ? WHERE cascade_id = ?").run(json(unique(closureSteps)), at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  heartbeat(controllerId: string, detail: string | null = null, at = iso()) {
    this.db.prepare("UPDATE bosun_controller_health SET controller_id = ?, state = 'LIVE', heartbeat_at = ?, detail = ? WHERE singleton = 1").run(controllerId, at, detail);
  }

  stop(controllerId: string, detail = "Clean controller shutdown.", at = iso()) {
    this.db.prepare("UPDATE bosun_controller_health SET controller_id = ?, state = 'DOWN', heartbeat_at = ?, detail = ? WHERE singleton = 1").run(controllerId, at, detail);
  }

  projection(now = Date.now(), staleAfterMs = 90_000): BosunProjection {
    const health = this.db.prepare("SELECT * FROM bosun_controller_health WHERE singleton = 1").get() as Record<string, unknown>;
    const heartbeatAt = health.heartbeat_at ? String(health.heartbeat_at) : null;
    const age = heartbeatAt ? Math.max(0, now - Date.parse(heartbeatAt)) : null;
    const state = !heartbeatAt || health.state === "DOWN" ? "DOWN" : age! > staleAfterMs ? "DEGRADED" : "LIVE";
    const cascades = (this.db.prepare("SELECT * FROM bosun_cascades ORDER BY started_at, cascade_id").all() as Record<string, unknown>[])
      .map((row) => this.cascade(row));
    return { station: "BOSUN", state, controllerId: health.controller_id ? String(health.controller_id) : null, heartbeatAt, heartbeatAgeMs: age,
      activeCascadeCount: cascades.filter((cascade) => cascade.status === "ACTIVE").length,
      cascades: cascades.map((cascade) => ({ ...cascade, parentBudget: this.parentBudget(cascade.parentTransactionId, now) })) };
  }
}

export interface AutoZeroAction {
  id: "active-test-registry" | "document-index" | "feature-catalog" | "policy-source-digest" | "generated-state";
  allowedPaths: string[];
  run: () => Promise<{ changedPaths: string[]; outputIdentity: unknown }>;
}

/** Runs every mechanical action twice and rejects non-determinism or scope escape before any authority handoff. */
export class BosunAutoZeroExecutor {
  async execute(action: AutoZeroAction, expectedPaths: string[]) {
    const first = await action.run();
    const second = await action.run();
    const expected = unique(expectedPaths);
    const changed = unique(first.changedPaths);
    if (digest(first.outputIdentity) !== digest(second.outputIdentity) || json(changed) !== json(unique(second.changedPaths)))
      throw new NightwatchInvariantError("BOSUN_AUTO_0_NONDETERMINISTIC", action.id);
    if (json(changed) !== json(expected) || changed.some((path) => !action.allowedPaths.includes(path)))
      throw new NightwatchInvariantError("BOSUN_AUTO_0_SCOPE_ESCAPE", action.id);
    return { actionId: action.id, changedPaths: changed, outputDigest: digest(first.outputIdentity), deterministic: true as const };
  }
}
