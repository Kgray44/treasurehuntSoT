import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { NightwatchInvariantError, NightwatchLedger, type IntegrationBudgetStatus } from "./runtime";

export type BosunCascadeState =
  | "ACTIVE"
  | "CONVERGED"
  | "PARKED_OWNER"
  | "PARKED_BUDGET"
  | "PARKED_PARENT_BREAKER"
  | "BLOCKED_EXTERNAL"
  | "ESCALATION_REQUIRED";

export type BosunRepairClass = "AUTO_0" | "AUTO_1" | "AUTO_2" | "OWNER" | "EXTERNAL";

export type BosunObjectiveState =
  | "OBJECTIVE_READY"
  | "OWNER_REQUIRED"
  | "EXTERNAL_BLOCKED"
  | "ESCALATION_REQUIRED"
  | "REPAIRING"
  | "QUALIFYING"
  | "BINDING"
  | "MERGED"
  | "POST_MERGE_PROOF"
  | "CONVERGED";

export type BosunRepairActionId = AutoZeroActionId | "owner-policy-identity-rebaseline";

export interface BosunFinding {
  owner: string;
  category: string;
  resource: string;
  contract: string;
  runtimeClass: string;
  repairClass: BosunRepairClass;
  requiredAuthorization?: string;
  externalDependency?: string;
}

export interface BaselineCertificationReceiptFailure {
  checkId: string;
  fingerprint: string;
  repairability: string;
  detail: string;
  dependencies: string[];
}

/** The complete receipt is retained verbatim; only its semantic findings are projected into Bosun. */
export interface BaselineCertificationReceipt {
  kind: "BASELINE_CERTIFICATION";
  certificationId: string;
  status: string;
  protectedMain: { sha: string; treeSha: string };
  checks: unknown[];
  failures: BaselineCertificationReceiptFailure[];
  deterministicClosureDependencies: unknown;
  autoZeroRepairable: string[];
  nonAutoZeroBlockers: BaselineCertificationReceiptFailure[];
  [key: string]: unknown;
}

export interface BosunObjective {
  id: string;
  cascadeId: string;
  findingFingerprint: string;
  repairClass: BosunRepairClass;
  state: BosunObjectiveState;
  requiredAuthorization: string | null;
  externalDependency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BosunCascade {
  id: string;
  rootFingerprint: string;
  parentTransactionId: string;
  rootOwner: string;
  generation: number;
  activeObjectiveId: string | null;
  activeRepairPr: number | null;
  objective: BosunObjective | null;
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

export interface BosunLiveRepair {
  cascadeId: string;
  parentTransactionId: string;
  transactionId: string;
  candidateId: string;
  repairPr: number;
  actionId: BosunRepairActionId;
  candidateSha: string;
  baseSha: string;
  focusedEvidenceRef: string;
  outputDigest: string;
  completedAt: string | null;
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
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
};
const execFileAsync = promisify(execFile);

const baselineFinding = (failure: BaselineCertificationReceiptFailure): BosunFinding => {
  const checkId = failure.checkId.trim();
  const owner = checkId.startsWith("deepwater-") ? "deepwater" : "sounding-line";
  const repairClass: BosunRepairClass = failure.repairability === "AUTO_0"
    ? "AUTO_0"
    : failure.repairability === "OWNER"
      ? "OWNER"
      : failure.repairability === "EXTERNAL"
        ? "EXTERNAL"
        : "AUTO_2";
  const exactDeepwaterAuthorization = checkId === "deepwater-policy-identity"
    ? "OWNER-AUTHORIZED:DEEPWATER_POLICY_IDENTITY_REBASELINE"
    : undefined;
  return {
    owner,
    category: checkId,
    resource: checkId === "deepwater-policy-identity"
      ? "Development_Docs/Programs/Deepwater/deepwater-phase5-config.json"
      : `Baseline Certification:${checkId}`,
    contract: `baseline-certification:${checkId}:${failure.fingerprint}`,
    runtimeClass: "nightwatch-baseline-certification",
    repairClass,
    requiredAuthorization: repairClass === "OWNER"
      ? exactDeepwaterAuthorization ?? `OWNER-REQUIRED:BASELINE_CERTIFICATION:${checkId}:${failure.fingerprint}`
      : undefined,
    externalDependency: repairClass === "EXTERNAL"
      ? `EXTERNAL-DEPENDENCY:BASELINE_CERTIFICATION:${checkId}:${failure.fingerprint}`
      : undefined,
  };
};

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
      CREATE TABLE IF NOT EXISTS bosun_objectives (
        objective_id TEXT PRIMARY KEY,
        cascade_id TEXT NOT NULL UNIQUE REFERENCES bosun_cascades(cascade_id),
        finding_fingerprint TEXT NOT NULL,
        repair_class TEXT NOT NULL,
        state TEXT NOT NULL,
        required_authorization TEXT,
        external_dependency TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bosun_wakeups (
        cascade_id TEXT NOT NULL REFERENCES bosun_cascades(cascade_id),
        candidate_id TEXT NOT NULL,
        landed_main_sha TEXT NOT NULL,
        woken_at TEXT NOT NULL,
        PRIMARY KEY(cascade_id, candidate_id)
      );
      CREATE TABLE IF NOT EXISTS bosun_post_merge_proofs (
        cascade_id TEXT PRIMARY KEY REFERENCES bosun_cascades(cascade_id),
        proof_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bosun_live_repairs (
        cascade_id TEXT PRIMARY KEY REFERENCES bosun_cascades(cascade_id),
        parent_transaction_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL UNIQUE,
        candidate_id TEXT NOT NULL UNIQUE,
        repair_pr INTEGER NOT NULL,
        action_id TEXT NOT NULL,
        candidate_sha TEXT NOT NULL,
        base_sha TEXT NOT NULL,
        focused_evidence_ref TEXT NOT NULL,
        output_digest TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS bosun_baseline_receipts (
        certification_id TEXT PRIMARY KEY,
        protected_main_sha TEXT NOT NULL,
        protected_main_tree_sha TEXT NOT NULL,
        receipt_digest TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        parent_transaction_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        ingested_at TEXT NOT NULL,
        UNIQUE(protected_main_sha, protected_main_tree_sha)
      );
      CREATE TABLE IF NOT EXISTS bosun_baseline_findings (
        certification_id TEXT NOT NULL REFERENCES bosun_baseline_receipts(certification_id),
        finding_fingerprint TEXT NOT NULL,
        cascade_id TEXT NOT NULL REFERENCES bosun_cascades(cascade_id),
        objective_id TEXT NOT NULL REFERENCES bosun_objectives(objective_id),
        PRIMARY KEY(certification_id, finding_fingerprint)
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
    const objective = this.objectiveForCascadeId(String(row.cascade_id));
    return {
      id: String(row.cascade_id), rootFingerprint: String(row.root_fingerprint), parentTransactionId: String(row.parent_transaction_id),
      rootOwner: String(row.root_owner), generation: Number(row.generation), activeObjectiveId: row.active_objective_id ? String(row.active_objective_id) : null,
      activeRepairPr: row.active_repair_pr === null ? null : Number(row.active_repair_pr), blockedCandidates: parse<string[]>(String(row.blocked_candidates_json)),
      objective,
      closureSteps: parse<string[]>(String(row.closure_steps_json)), repairPrCount: Number(row.repair_pr_count), authorityAttempts: Number(row.authority_attempts),
      mainlineRebuilds: Number(row.mainline_rebuilds), controlPlaneMs: Number(row.control_plane_ms), controlPlaneWaitMs: Number(row.control_plane_wait_ms),
      duplicateRepairsSuppressed: Number(row.duplicate_repairs_suppressed), dependentWakeupCount: Number(row.dependent_wakeup_count),
      status: String(row.status) as BosunCascadeState, startedAt: String(row.started_at), updatedAt: String(row.updated_at),
    };
  }

  private parentBudget(transactionId: string, now: number) {
    return this.nightwatch.transactionBudget(transactionId, now);
  }

  private objective(row: Record<string, unknown>): BosunObjective {
    return {
      id: String(row.objective_id),
      cascadeId: String(row.cascade_id),
      findingFingerprint: String(row.finding_fingerprint),
      repairClass: String(row.repair_class) as BosunRepairClass,
      state: String(row.state) as BosunObjectiveState,
      requiredAuthorization: row.required_authorization ? String(row.required_authorization) : null,
      externalDependency: row.external_dependency ? String(row.external_dependency) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private objectiveForCascadeId(cascadeId: string): BosunObjective | null {
    const row = this.db.prepare("SELECT * FROM bosun_objectives WHERE cascade_id = ?").get(cascadeId) as Record<string, unknown> | undefined;
    return row ? this.objective(row) : null;
  }

  objectiveForCascade(cascadeId: string) {
    return this.objectiveForCascadeId(cascadeId);
  }

  private repairClassFromFingerprint(fingerprint: string): BosunRepairClass {
    const repair = fingerprint.split("|").find((entry) => entry.startsWith("repair="))?.slice("repair=".length).toUpperCase();
    if (["AUTO_0", "AUTO_1", "AUTO_2", "OWNER", "EXTERNAL"].includes(repair ?? "")) return repair as BosunRepairClass;
    return "AUTO_2";
  }

  private objectiveDisposition(repairClass: BosunRepairClass): { state: BosunObjectiveState; cascadeState: BosunCascadeState } {
    if (repairClass === "AUTO_0") return { state: "OBJECTIVE_READY", cascadeState: "ACTIVE" };
    if (repairClass === "OWNER") return { state: "OWNER_REQUIRED", cascadeState: "PARKED_OWNER" };
    if (repairClass === "EXTERNAL") return { state: "EXTERNAL_BLOCKED", cascadeState: "BLOCKED_EXTERNAL" };
    return { state: "ESCALATION_REQUIRED", cascadeState: "ESCALATION_REQUIRED" };
  }

  /**
   * Durable objective materialization closes the former ACTIVE + NO_OBJECTIVE
   * gap. It is idempotent across duplicate findings and controller restarts.
   */
  materializeObjective(cascadeId: string, finding?: BosunFinding, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    const existing = this.objectiveForCascadeId(cascadeId);
    if (existing) return { objective: existing, created: false };
    if (cascade.activeObjectiveId)
      throw new NightwatchInvariantError("BOSUN_LEGACY_OBJECTIVE_UNMIGRATABLE", cascadeId);
    const fingerprint = finding ? normalizeBosunFingerprint(finding) : cascade.rootFingerprint;
    if (fingerprint !== cascade.rootFingerprint)
      throw new NightwatchInvariantError("BOSUN_OBJECTIVE_FINGERPRINT_MISMATCH", cascadeId);
    const repairClass = finding?.repairClass ?? this.repairClassFromFingerprint(fingerprint);
    const disposition = this.objectiveDisposition(repairClass);
    const objectiveId = randomUUID();
    const requiredAuthorization = repairClass === "OWNER"
      ? finding?.requiredAuthorization ?? `OWNER_APPROVAL_REQUIRED:${fingerprint}`
      : null;
    const externalDependency = repairClass === "EXTERNAL"
      ? finding?.externalDependency ?? `EXTERNAL_DEPENDENCY_REQUIRED:${fingerprint}`
      : null;
    this.db.prepare(`INSERT INTO bosun_objectives(objective_id, cascade_id, finding_fingerprint, repair_class, state, required_authorization, external_dependency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(objectiveId, cascadeId, fingerprint, repairClass, disposition.state, requiredAuthorization, externalDependency, at, at);
    this.db.prepare("UPDATE bosun_cascades SET active_objective_id = ?, status = ?, updated_at = ? WHERE cascade_id = ?")
      .run(objectiveId, disposition.cascadeState, at, cascadeId);
    return { objective: this.objectiveForCascadeId(cascadeId)!, created: true };
  }

  /** Reconciles pre-objective persisted cascades on controller startup. */
  reconcileActionableObjectives(at = iso()) {
    const active = this.db.prepare("SELECT cascade_id FROM bosun_cascades WHERE status = 'ACTIVE' AND active_objective_id IS NULL ORDER BY started_at, cascade_id")
      .all() as Array<{ cascade_id: string }>;
    return active.map((entry) => this.materializeObjective(entry.cascade_id, undefined, at));
  }

  authorizeOwnerObjective(cascadeId: string, authorization: string, at = iso()) {
    const objective = this.objectiveForCascadeId(cascadeId);
    if (!objective) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_FOUND", cascadeId);
    if (objective.repairClass !== "OWNER" || objective.state !== "OWNER_REQUIRED")
      throw new NightwatchInvariantError("BOSUN_OWNER_AUTHORIZATION_NOT_REQUIRED", cascadeId);
    if (!objective.requiredAuthorization || authorization !== objective.requiredAuthorization)
      throw new NightwatchInvariantError("BOSUN_OWNER_AUTHORIZATION_MISMATCH", cascadeId);
    this.db.prepare("UPDATE bosun_objectives SET state = 'OBJECTIVE_READY', updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    this.db.prepare("UPDATE bosun_cascades SET status = 'ACTIVE', updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    return this.objectiveForCascadeId(cascadeId)!;
  }

  private setObjectiveState(cascadeId: string, state: BosunObjectiveState, at = iso()) {
    const objective = this.objectiveForCascadeId(cascadeId);
    if (!objective) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_FOUND", cascadeId);
    this.db.prepare("UPDATE bosun_objectives SET state = ?, updated_at = ? WHERE cascade_id = ?").run(state, at, cascadeId);
    return this.objectiveForCascadeId(cascadeId)!;
  }

  private parseBaselineReceipt(receipt: unknown): BaselineCertificationReceipt {
    if (!receipt || typeof receipt !== "object") throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_INVALID");
    const value = receipt as Record<string, unknown>;
    const protectedMain = value.protectedMain as Record<string, unknown> | undefined;
    if (
      value.kind !== "BASELINE_CERTIFICATION" ||
      typeof value.certificationId !== "string" || !value.certificationId.trim() ||
      typeof value.status !== "string" || !value.status.trim() ||
      !protectedMain || typeof protectedMain.sha !== "string" || typeof protectedMain.treeSha !== "string" ||
      !Array.isArray(value.checks) || !Array.isArray(value.failures) ||
      !("deterministicClosureDependencies" in value) ||
      !Array.isArray(value.autoZeroRepairable) || !Array.isArray(value.nonAutoZeroBlockers)
    )
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_INCOMPLETE");
    const failures = value.failures.map((entry) => {
      if (!entry || typeof entry !== "object") throw new NightwatchInvariantError("BOSUN_BASELINE_FAILURE_INVALID");
      const failure = entry as Record<string, unknown>;
      if (
        typeof failure.checkId !== "string" || !failure.checkId.trim() ||
        typeof failure.fingerprint !== "string" || !failure.fingerprint.trim() ||
        typeof failure.repairability !== "string" || !failure.repairability.trim() ||
        typeof failure.detail !== "string" ||
        !Array.isArray(failure.dependencies) || !failure.dependencies.every((dependency) => typeof dependency === "string")
      )
        throw new NightwatchInvariantError("BOSUN_BASELINE_FAILURE_INVALID");
      return {
        checkId: failure.checkId,
        fingerprint: failure.fingerprint,
        repairability: failure.repairability,
        detail: failure.detail,
        dependencies: [...failure.dependencies],
      };
    });
    const fingerprintSet = new Set(failures.map((failure) => failure.fingerprint));
    if (fingerprintSet.size !== failures.length)
      throw new NightwatchInvariantError("BOSUN_BASELINE_FAILURE_FINGERPRINT_DUPLICATE");
    const declaredNonAuto = value.nonAutoZeroBlockers as unknown[];
    if (declaredNonAuto.length !== failures.filter((failure) => failure.repairability !== "AUTO_0").length)
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_INCOMPLETE");
    const checkIds = new Set(
      (value.checks as unknown[])
        .filter((check): check is Record<string, unknown> => Boolean(check) && typeof check === "object")
        .map((check) => check.id)
        .filter((id): id is string => typeof id === "string"),
    );
    if (failures.some((failure) => !checkIds.has(failure.checkId)))
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_INCOMPLETE");
    return {
      ...value,
      kind: "BASELINE_CERTIFICATION",
      certificationId: value.certificationId,
      status: value.status,
      protectedMain: { sha: protectedMain.sha, treeSha: protectedMain.treeSha },
      checks: value.checks,
      failures,
      deterministicClosureDependencies: value.deterministicClosureDependencies,
      autoZeroRepairable: value.autoZeroRepairable as string[],
      nonAutoZeroBlockers: declaredNonAuto as BaselineCertificationReceiptFailure[],
    };
  }

  /**
   * Ingests one exact protected-main certification receipt. A receipt is
   * durable evidence, while its normalized findings are the only source of
   * Bosun cascades and executable objectives.
   */
  ingestBaselineReceipt(input: {
    receipt: unknown;
    protectedMain: { sha: string; treeSha: string };
    at?: string;
  }) {
    const receipt = this.parseBaselineReceipt(input.receipt);
    if (
      receipt.protectedMain.sha !== input.protectedMain.sha ||
      receipt.protectedMain.treeSha !== input.protectedMain.treeSha
    )
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_PROTECTED_MAIN_MISMATCH");
    const at = input.at ?? iso();
    const receiptDigest = createHash("sha256").update(canonicalJson(receipt)).digest("hex");
    const existingReceipt = this.db
      .prepare("SELECT * FROM bosun_baseline_receipts WHERE certification_id = ?")
      .get(receipt.certificationId) as Record<string, unknown> | undefined;
    const receiptForMain = this.db
      .prepare("SELECT * FROM bosun_baseline_receipts WHERE protected_main_sha = ? AND protected_main_tree_sha = ?")
      .get(input.protectedMain.sha, input.protectedMain.treeSha) as Record<string, unknown> | undefined;
    if (existingReceipt && (
      String(existingReceipt.protected_main_sha) !== input.protectedMain.sha ||
      String(existingReceipt.protected_main_tree_sha) !== input.protectedMain.treeSha ||
      String(existingReceipt.receipt_digest) !== receiptDigest
    ))
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_IDENTITY_CONFLICT", receipt.certificationId);
    if (receiptForMain && String(receiptForMain.certification_id) !== receipt.certificationId)
      throw new NightwatchInvariantError("BOSUN_BASELINE_RECEIPT_MAIN_CONFLICT", receipt.certificationId);

    const anchor = this.nightwatch.ensureBaselineReceiptAnchor({
      certificationId: receipt.certificationId,
      protectedMain: input.protectedMain,
      at,
    });
    if (!existingReceipt)
      this.db.prepare(`INSERT INTO bosun_baseline_receipts(certification_id, protected_main_sha, protected_main_tree_sha, receipt_digest, receipt_json, parent_transaction_id, candidate_id, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          receipt.certificationId,
          input.protectedMain.sha,
          input.protectedMain.treeSha,
          receiptDigest,
          canonicalJson(receipt),
          anchor.transaction.id,
          anchor.candidate.id,
          at,
        );

    const findings = receipt.failures.map((failure) => {
      const finding = baselineFinding(failure);
      const findingFingerprint = normalizeBosunFingerprint(finding);
      const existingCascade = this.db
        .prepare("SELECT * FROM bosun_cascades WHERE root_fingerprint = ?")
        .get(findingFingerprint) as Record<string, unknown> | undefined;
      const parentTransactionId = existingCascade
        ? String(existingCascade.parent_transaction_id)
        : anchor.transaction.id;
      const reported = this.reportFinding({
        finding,
        parentTransactionId,
        blockedCandidateId: anchor.candidate.id,
        closureSteps: ["reconcile exact protected-main Baseline Certification receipt"],
        at,
      });
      const objective = reported.objective ?? this.materializeObjective(reported.cascade.id, finding, at).objective;
      const existingFinding = this.db
        .prepare("SELECT * FROM bosun_baseline_findings WHERE certification_id = ? AND finding_fingerprint = ?")
        .get(receipt.certificationId, findingFingerprint) as Record<string, unknown> | undefined;
      if (existingFinding && (
        String(existingFinding.cascade_id) !== reported.cascade.id ||
        String(existingFinding.objective_id) !== objective.id
      ))
        throw new NightwatchInvariantError("BOSUN_BASELINE_FINDING_IDENTITY_CONFLICT", findingFingerprint);
      if (!existingFinding)
        this.db.prepare(`INSERT INTO bosun_baseline_findings(certification_id, finding_fingerprint, cascade_id, objective_id)
          VALUES (?, ?, ?, ?)`)
          .run(receipt.certificationId, findingFingerprint, reported.cascade.id, objective.id);
      return {
        baselineFingerprint: failure.fingerprint,
        findingFingerprint,
        cascadeId: reported.cascade.id,
        objectiveId: objective.id,
        state: objective.state,
        requiredAuthorization: objective.requiredAuthorization,
      };
    });
    return {
      certificationId: receipt.certificationId,
      protectedMain: input.protectedMain,
      receiptDigest,
      parentTransactionId: anchor.transaction.id,
      candidateId: anchor.candidate.id,
      duplicate: Boolean(existingReceipt),
      findings,
    };
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
    const reportedCascade = this.cascade(this.row(String(row.cascade_id)));
    const materialized = reportedCascade.status === "ACTIVE"
      ? this.materializeObjective(reportedCascade.id, input.finding, at)
      : { objective: this.objectiveForCascadeId(reportedCascade.id), created: false };
    return { cascade: this.cascade(this.row(reportedCascade.id)), objective: materialized.objective, duplicate: !materialized.created, budget };
  }

  createOrReuseRepair(cascadeId: string, objectiveId: string, repairPr: number | null, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    const budget = this.parentBudget(cascade.parentTransactionId, Date.parse(at));
    if (cascade.status === "PARKED_PARENT_BREAKER" || budget.status === "PARKED_BREAKER") {
      this.parkParentBreaker(cascadeId, at);
      throw new NightwatchInvariantError("PARKED_PARENT_BREAKER", cascadeId);
    }
    if (cascade.generation > 2) throw new NightwatchInvariantError("PARKED_OWNER", cascadeId);
    const objective = this.objectiveForCascadeId(cascadeId);
    if (!objective) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_FOUND", cascadeId);
    if (objective.id !== objectiveId) throw new NightwatchInvariantError("BOSUN_OBJECTIVE_IDENTITY_MISMATCH", cascadeId);
    if (cascade.activeRepairPr !== null) {
      this.db.prepare("UPDATE bosun_cascades SET duplicate_repairs_suppressed = duplicate_repairs_suppressed + 1, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
      return { cascade: this.cascade(this.row(cascadeId)), created: false };
    }
    if (objective.state !== "OBJECTIVE_READY") throw new NightwatchInvariantError("BOSUN_OBJECTIVE_NOT_READY", `${cascadeId}:${objective.state}`);
    this.db.prepare(`UPDATE bosun_cascades SET active_repair_pr = ?, repair_pr_count = repair_pr_count + CASE WHEN ? IS NULL THEN 0 ELSE 1 END, updated_at = ? WHERE cascade_id = ?`)
      .run(repairPr, repairPr, at, cascadeId);
    this.setObjectiveState(cascadeId, "REPAIRING", at);
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
    this.setObjectiveState(cascadeId, "QUALIFYING", at);
    return this.cascade(this.row(cascadeId));
  }

  recordBindingAttempt(cascadeId: string, at = iso()) {
    this.setObjectiveState(cascadeId, "BINDING", at);
    return this.cascade(this.row(cascadeId));
  }

  recordMerged(cascadeId: string, at = iso()) {
    this.setObjectiveState(cascadeId, "MERGED", at);
    return this.cascade(this.row(cascadeId));
  }

  parkParentBreaker(cascadeId: string, at = iso()) {
    this.db.prepare("UPDATE bosun_cascades SET status = 'PARKED_PARENT_BREAKER', updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  recordPostMergeProof(cascadeId: string, proof: { landedMainSha: string; evidenceRef: string; rootBlockerRemoved: boolean }, at = iso()) {
    if (!proof.landedMainSha || !proof.evidenceRef || !proof.rootBlockerRemoved)
      throw new NightwatchInvariantError("BOSUN_POST_MERGE_PROOF_INVALID", cascadeId);
    this.db.prepare("INSERT OR REPLACE INTO bosun_post_merge_proofs(cascade_id, proof_json, recorded_at) VALUES (?, ?, ?)")
      .run(cascadeId, json(proof), at);
  }

  registerLiveRepair(input: Omit<BosunLiveRepair, "completedAt">) {
    const cascade = this.cascade(this.row(input.cascadeId));
    if (cascade.parentTransactionId !== input.parentTransactionId)
      throw new NightwatchInvariantError("BOSUN_PARENT_TRANSACTION_MISMATCH", input.cascadeId);
    const existing = this.db.prepare("SELECT * FROM bosun_live_repairs WHERE cascade_id = ?").get(input.cascadeId) as Record<string, unknown> | undefined;
    if (existing) {
      const repair = this.liveRepair(existing);
      if (repair.candidateSha !== input.candidateSha || repair.baseSha !== input.baseSha || repair.repairPr !== input.repairPr)
        throw new NightwatchInvariantError("BOSUN_LIVE_REPAIR_IDENTITY_MISMATCH", input.cascadeId);
      return repair;
    }
    this.db.prepare(`INSERT INTO bosun_live_repairs(cascade_id, parent_transaction_id, transaction_id, candidate_id, repair_pr, action_id, candidate_sha, base_sha, focused_evidence_ref, output_digest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      input.cascadeId, input.parentTransactionId, input.transactionId, input.candidateId, input.repairPr,
      input.actionId, input.candidateSha, input.baseSha, input.focusedEvidenceRef, input.outputDigest,
    );
    return { ...input, completedAt: null };
  }

  liveRepairForTransaction(transactionId: string): BosunLiveRepair | null {
    const row = this.db.prepare("SELECT * FROM bosun_live_repairs WHERE transaction_id = ?").get(transactionId) as Record<string, unknown> | undefined;
    return row ? this.liveRepair(row) : null;
  }

  completeLiveRepair(transactionId: string, proof: { landedMainSha: string; evidenceRef: string; rootBlockerRemoved: boolean }, at = iso()) {
    const repair = this.liveRepairForTransaction(transactionId);
    if (!repair) return null;
    if (repair.completedAt) return repair;
    this.setObjectiveState(repair.cascadeId, "POST_MERGE_PROOF", at);
    this.recordPostMergeProof(repair.cascadeId, proof, at);
    this.setClosureSteps(repair.cascadeId, [], at);
    this.converge(repair.cascadeId, proof.landedMainSha, at);
    this.db.prepare("UPDATE bosun_live_repairs SET completed_at = ? WHERE transaction_id = ?").run(at, transactionId);
    return this.liveRepairForTransaction(transactionId);
  }

  converge(cascadeId: string, landedMainSha: string, at = iso()) {
    const cascade = this.cascade(this.row(cascadeId));
    if (!landedMainSha || cascade.closureSteps.length) throw new NightwatchInvariantError("BOSUN_CLOSURE_INCOMPLETE", cascadeId);
    const proof = this.db.prepare("SELECT proof_json FROM bosun_post_merge_proofs WHERE cascade_id = ?").get(cascadeId) as
      | { proof_json: string }
      | undefined;
    if (!proof || parse<{ landedMainSha: string; rootBlockerRemoved: boolean }>(proof.proof_json).landedMainSha !== landedMainSha)
      throw new NightwatchInvariantError("BOSUN_POST_MERGE_PROOF_REQUIRED", cascadeId);
    const objective = this.objectiveForCascadeId(cascadeId);
    if (objective) this.setObjectiveState(cascadeId, "CONVERGED", at);
    this.db.prepare("UPDATE bosun_cascades SET status = 'CONVERGED', active_objective_id = NULL, active_repair_pr = NULL, updated_at = ? WHERE cascade_id = ?").run(at, cascadeId);
    for (const candidateId of cascade.blockedCandidates) {
      this.db.prepare("INSERT OR IGNORE INTO bosun_wakeups(cascade_id, candidate_id, landed_main_sha, woken_at) VALUES (?, ?, ?, ?)")
        .run(cascadeId, candidateId, landedMainSha, at);
      try {
        const candidate = this.nightwatch.getCandidate(candidateId);
        if (candidate.state === "BLOCKED_BY_BOSUN") this.nightwatch.resumeCandidate(candidateId);
      } catch (error) {
        if (!(error instanceof NightwatchInvariantError) || error.code !== "CANDIDATE_NOT_FOUND") throw error;
      }
    }
    this.nightwatch.selectQueueFront();
    this.db.prepare("UPDATE bosun_cascades SET dependent_wakeup_count = (SELECT count(*) FROM bosun_wakeups WHERE cascade_id = ?), updated_at = ? WHERE cascade_id = ?")
      .run(cascadeId, at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  setClosureSteps(cascadeId: string, closureSteps: string[], at = iso()) {
    this.db.prepare("UPDATE bosun_cascades SET closure_steps_json = ?, updated_at = ? WHERE cascade_id = ?").run(json(unique(closureSteps)), at, cascadeId);
    return this.cascade(this.row(cascadeId));
  }

  private liveRepair(row: Record<string, unknown>): BosunLiveRepair {
    return {
      cascadeId: String(row.cascade_id), parentTransactionId: String(row.parent_transaction_id), transactionId: String(row.transaction_id),
      candidateId: String(row.candidate_id), repairPr: Number(row.repair_pr), actionId: String(row.action_id) as BosunRepairActionId,
      candidateSha: String(row.candidate_sha), baseSha: String(row.base_sha), focusedEvidenceRef: String(row.focused_evidence_ref),
      outputDigest: String(row.output_digest), completedAt: row.completed_at ? String(row.completed_at) : null,
    };
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
  id: "active-test-registry" | "document-index" | "feature-catalog" | "p34-retirement-ledger" | "deepwater-policy" | "policy-source-digest" | "generated-state";
  allowedPaths: string[];
  run: () => Promise<{ changedPaths: string[]; outputIdentity: unknown }>;
}

export type AutoZeroActionId = AutoZeroAction["id"];

export type BaselineCertificationFailure = {
  checkId: string;
  fingerprint: string;
  repairability: "AUTO_0" | "OWNER" | "EXTERNAL";
  dependencies: string[];
};

export type BaselineAutoZeroClosurePlan = {
  status: "READY" | "OWNER_REQUIRED" | "EXTERNAL_BLOCKED";
  actionIds: AutoZeroActionId[];
  expectedPaths: string[];
  failureFingerprints: string[];
  nonAutoZeroBlockers: BaselineCertificationFailure[];
  fixedPointRequired: true;
};

const baselineActions: Record<string, { actionId: AutoZeroActionId; expectedPaths: string[] }> = {
  "p34-retirement-ledger": {
    actionId: "p34-retirement-ledger",
    expectedPaths: [
      "testing/generated/p34-retirement-ledger.json",
      "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Semantic_Retirement_Ledger.csv",
      "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    ],
  },
  "active-test-registry": { actionId: "active-test-registry", expectedPaths: ["testing/generated/active-test-registry.json"] },
  "document-index": { actionId: "document-index", expectedPaths: ["Development_Docs/document-index.json", "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"] },
  "feature-catalog": { actionId: "feature-catalog", expectedPaths: ["Development_Docs/Features/FEATURE_CATALOG.md"] },
  "deepwater-policy": {
    actionId: "deepwater-policy",
    expectedPaths: [
      "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
      "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_5_Governance_Report.md",
    ],
  },
};

/** Creates one finite AUTO_0 candidate plan from the complete certification failure set. */
export const planBaselineAutoZeroClosure = (failures: BaselineCertificationFailure[]): BaselineAutoZeroClosurePlan => {
  const nonAutoZeroBlockers = failures.filter((failure) => failure.repairability !== "AUTO_0");
  if (nonAutoZeroBlockers.some((failure) => failure.repairability === "EXTERNAL"))
    return { status: "EXTERNAL_BLOCKED", actionIds: [], expectedPaths: [], failureFingerprints: [], nonAutoZeroBlockers, fixedPointRequired: true };
  if (nonAutoZeroBlockers.length)
    return { status: "OWNER_REQUIRED", actionIds: [], expectedPaths: [], failureFingerprints: [], nonAutoZeroBlockers, fixedPointRequired: true };
  const actions = failures.map((failure) => ({ failure, action: baselineActions[failure.checkId] })).sort((left, right) => left.failure.checkId.localeCompare(right.failure.checkId));
  if (actions.some(({ action }) => !action)) throw new NightwatchInvariantError("BOSUN_BASELINE_AUTO_0_ACTION_UNMAPPED", actions.find(({ action }) => !action)!.failure.checkId);
  return {
    status: "READY",
    actionIds: actions.map(({ action }) => action!.actionId),
    expectedPaths: unique(actions.flatMap(({ action }) => action!.expectedPaths)),
    failureFingerprints: actions.map(({ failure }) => failure.fingerprint),
    nonAutoZeroBlockers,
    fixedPointRequired: true,
  };
};

/**
 * Canonical, pre-governed generator actions. These actions only prepare a
 * deterministic candidate diff; they deliberately do not commit, open a PR,
 * dispatch authority, bind, or merge.
 */
export const createRepositoryAutoZeroActions = (
  repositoryRoot: string,
  options: { nodeExecutable?: string; featureCatalogCommand?: readonly string[] } = {},
): Record<"activeTestRegistry" | "documentIndex" | "featureCatalog" | "p34RetirementLedger" | "deepwaterPolicy", AutoZeroAction> => {
  const root = resolve(repositoryRoot);
  const node = options.nodeExecutable ?? process.execPath;
  const run = async (command: readonly string[], allowedPaths: string[]) => {
    const before = new Set(
      (await execFileAsync("git", ["diff", "--name-only", "--"], { cwd: root, windowsHide: true })).stdout
        .split(/\r?\n/u)
        .filter(Boolean),
    );
    await execFileAsync(command[0]!, command.slice(1), { cwd: root, windowsHide: true });
    const after = (
      await execFileAsync("git", ["diff", "--name-only", "--"], { cwd: root, windowsHide: true })
    ).stdout.split(/\r?\n/u).filter(Boolean).sort();
    const changedPaths = unique([...after.filter((path) => allowedPaths.includes(path)), ...after.filter((path) => !before.has(path))]);
    const outputIdentity = await Promise.all(
      allowedPaths.map(async (path) => ({ path, sha256: digest((await readFile(resolve(root, path))).toString("base64")) })),
    );
    return { changedPaths, outputIdentity: { command, outputIdentity } };
  };
  return {
    activeTestRegistry: {
      id: "active-test-registry",
      allowedPaths: ["testing/generated/active-test-registry.json"],
      run: () => run([node, "scripts/sounding-line/test-registry.mjs"], ["testing/generated/active-test-registry.json"]),
    },
    documentIndex: {
      id: "document-index",
      allowedPaths: baselineActions["document-index"].expectedPaths,
      run: () => run([node, "scripts/generate-document-index.mjs"], baselineActions["document-index"].expectedPaths),
    },
    featureCatalog: {
      id: "feature-catalog",
      allowedPaths: ["Development_Docs/Features/FEATURE_CATALOG.md"],
      run: () => {
        if (!options.featureCatalogCommand?.length)
          return Promise.reject(new NightwatchInvariantError("BOSUN_AUTO_0_ACTION_UNCONFIGURED", "feature-catalog"));
        return run(options.featureCatalogCommand, ["Development_Docs/Features/FEATURE_CATALOG.md"]);
      },
    },
    p34RetirementLedger: {
      id: "p34-retirement-ledger",
      allowedPaths: baselineActions["p34-retirement-ledger"].expectedPaths,
      run: () => run([node, "scripts/sounding-line/reconcile-p34-ledger.mjs"], baselineActions["p34-retirement-ledger"].expectedPaths),
    },
    deepwaterPolicy: {
      id: "deepwater-policy",
      allowedPaths: baselineActions["deepwater-policy"].expectedPaths,
      run: () => run([node, "scripts/deepwater/cli.mjs", "audit"], baselineActions["deepwater-policy"].expectedPaths),
    },
  };
};

/** Runs every mechanical action twice and rejects non-determinism or scope escape before any authority handoff. */
export class BosunAutoZeroExecutor {
  async execute(action: AutoZeroAction, expectedPaths: string[]) {
    const first = await action.run();
    const second = await action.run();
    const expected = unique(expectedPaths);
    const changed = unique(first.changedPaths);
    if (digest(first.outputIdentity) !== digest(second.outputIdentity) || json(changed) !== json(unique(second.changedPaths)))
      throw new NightwatchInvariantError("BOSUN_AUTO_0_NONDETERMINISTIC", action.id);
    // A generator may own several declared outputs while a particular drift affects
    // only one of them. Require every observed mutation to stay within the exact
    // receipt-bound set; do not manufacture a drift in the unchanged sibling output.
    if (changed.length === 0 || changed.some((path) => !expected.includes(path) || !action.allowedPaths.includes(path)))
      throw new NightwatchInvariantError("BOSUN_AUTO_0_SCOPE_ESCAPE", action.id);
    return { actionId: action.id, changedPaths: changed, outputDigest: digest(first.outputIdentity), deterministic: true as const };
  }

  /** Applies one ordered compound plan and proves a fixed point by repeating the full plan. */
  async executeCompound(actions: AutoZeroAction[], expectedByAction: Record<string, string[]>) {
    const executeOnce = async () => {
      const results = [];
      for (const action of actions) results.push(await this.execute(action, expectedByAction[action.id] ?? []));
      return results;
    };
    const first = await executeOnce();
    const second = await executeOnce();
    if (digest(first) !== digest(second)) throw new NightwatchInvariantError("BOSUN_BASELINE_FIXED_POINT_NOT_REACHED", "compound-auto-0");
    return { actions: first, fixedPoint: true as const };
  }
}
