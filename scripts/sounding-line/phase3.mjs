/* Project Sounding Line Phase 3: durable, local verification intelligence. */
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import * as model from "./preparation/phase3/index.mjs";

export const PHASE3_SCHEMA_VERSION = 2;
export const canonicalize = model.canonicalize;
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalize(value))
    .digest("hex");
export const defaultHistoryRoot = () =>
  path.join(
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "state"),
    "ForeverTreasureCompanion",
    "SoundingLine",
    "history",
  );
export const defaultRuntimeRoot = () =>
  path.join(
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "state"),
    "ForeverTreasureCompanion",
    "SoundingLine",
    "runs",
  );
const secret = /(?:password|secret|token|cookie|authorization|credential|private.?content)/iu;
const safeId = (value, label = "id") => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9._:-]{0,120}$/u.test(value))
    throw new Error(`UNSAFE_${label.toUpperCase()}`);
  return value;
};
const safeStatus = (value) => {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_:-]{0,120}$/u.test(value)) throw new Error("UNSAFE_ENTITY_STATUS");
  return value;
};
const safeIdentity = (value, label) => {
  if (typeof value !== "string" || !value || value.length > 256 || secret.test(value))
    throw new Error(`UNSAFE_${label}`);
  return value;
};
const json = (value) => canonicalize(value ?? {});
const parse = (value) => JSON.parse(value);
const historicalEntities = [
  "historical_plans",
  "historical_plan_nodes",
  "historical_test_case_executions",
  "historical_attempts",
  "historical_resource_waits",
  "historical_resource_allocations",
  "historical_failures",
  "historical_failure_signatures",
  "historical_evidence_artifacts",
  "historical_cleanup_outcomes",
  "historical_environments",
  "historical_performance_samples",
  "historical_policy_snapshots",
  "historical_source_snapshots",
  "historical_evidence_reuse_decisions",
  "historical_invalidation_decisions",
  "historical_rerun_plans",
  "historical_flake_observations",
  "historical_stale_test_records",
  "historical_slow_suite_records",
  "historical_throttle_decisions",
  "historical_recovery_events",
];
const entityName = (value) => {
  if (!historicalEntities.includes(value)) throw new Error("UNKNOWN_HISTORICAL_ENTITY");
  return value;
};
const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "history-migrations");
const historyMigrations = [
  { version: 1, file: "001-initial.sql" },
  { version: 2, file: "002-historical-entities.sql" },
];

export async function openHistory(root = defaultHistoryRoot()) {
  await mkdir(root, { recursive: true });
  const file = path.join(root, "history.sqlite");
  let db;
  try {
    db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
    for (const migration of historyMigrations) {
      const applied = db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(migration.version);
      if (!applied) {
        db.exec(await readFile(path.join(migrationDirectory, migration.file), "utf8"));
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
          migration.version,
          new Date().toISOString(),
        );
      }
    }
    for (const table of historicalEntities)
      db.exec(`CREATE INDEX IF NOT EXISTS ${table}_run_subject ON ${table}(run_id, subject_id, created_at);`);
  } catch {
    try {
      db?.close();
    } catch {
      // Preserve the safe availability error below.
    }
    throw new Error("HISTORICAL_STORE_UNAVAILABLE");
  }
  return { db, root, file, close: () => db.close() };
}

export function validateReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("INVALID_RECEIPT");
  for (const field of ["runId", "sourceWatermark", "policyDigest", "planDigest"])
    if (!receipt[field]) throw new Error(`MISSING_${field.toUpperCase()}`);
  if (Object.keys(receipt).some((key) => secret.test(key)) || secret.test(JSON.stringify(receipt)))
    throw new Error("SENSITIVE_RECEIPT_FIELD");
  if (
    ![
      "MACHINE_RECEIPT",
      "COMMITTED_VALIDATION_RECORD",
      "SYNTHETIC_FIXTURE",
      "HUMAN_ATTESTATION",
      "EXTERNAL_PENDING",
    ].includes(receipt.evidenceClass ?? "MACHINE_RECEIPT")
  )
    throw new Error("INVALID_EVIDENCE_CLASS");
  if (!["CLEAN", "FAILED", "UNKNOWN"].includes(receipt.cleanupStatus ?? "UNKNOWN"))
    throw new Error("INVALID_CLEANUP_STATUS");
  return {
    ...receipt,
    evidenceClass: receipt.evidenceClass ?? "MACHINE_RECEIPT",
    cleanupStatus: receipt.cleanupStatus ?? "UNKNOWN",
  };
}

export async function ingestReceipt(store, rawReceipt, expected = {}) {
  const receipt = validateReceipt(rawReceipt);
  if (expected.sourceWatermark && receipt.sourceWatermark !== expected.sourceWatermark)
    throw new Error("RECEIPT_SOURCE_MISMATCH");
  if (expected.policyDigest && receipt.policyDigest !== expected.policyDigest)
    throw new Error("RECEIPT_POLICY_MISMATCH");
  const payload = json(receipt);
  const payloadDigest = digest(payload);
  const now = new Date().toISOString();
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const found = store.db.prepare("SELECT payload_digest FROM historical_runs WHERE id = ?").get(receipt.runId);
    if (found && found.payload_digest !== payloadDigest) throw new Error("CONFLICTING_DUPLICATE_RECEIPT");
    if (!found)
      store.db
        .prepare("INSERT INTO historical_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          receipt.runId,
          receipt.sourceWatermark,
          receipt.policyDigest,
          receipt.planDigest,
          receipt.evidenceClass,
          receipt.cleanupStatus,
          payloadDigest,
          payload,
          now,
        );
    for (const suite of receipt.suites ?? []) {
      safeId(suite.suiteId, "suite_id");
      if (!model.terminalOutcomes.includes(suite.outcome)) throw new Error("INVALID_SUITE_OUTCOME");
      const id = `${receipt.runId}:${suite.suiteId}`;
      const suitePayload = json(suite);
      store.db
        .prepare("INSERT OR REPLACE INTO suite_executions VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          id,
          receipt.runId,
          suite.suiteId,
          suite.outcome,
          Number.isFinite(suite.durationMs) ? suite.durationMs : null,
          suite.environmentDigest ?? "UNKNOWN",
          suite.fixtureVersion ?? "UNKNOWN",
          suitePayload,
        );
    }
    store.db
      .prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?)")
      .run(randomUUID(), "RECEIPT_INGESTED", json({ runId: receipt.runId, payloadDigest }), now);
    store.db.exec("COMMIT");
    return { idempotent: Boolean(found), runId: receipt.runId, payloadDigest };
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}

export function historyStats(store, suiteId) {
  const rows = store.db
    .prepare("SELECT outcome, duration_ms AS durationMs FROM suite_executions WHERE suite_id = ? ORDER BY id")
    .all(suiteId);
  const samples = rows
    .filter((row) => row.outcome === "PASSED" && Number.isInteger(row.durationMs))
    .map((row) => ({ classification: "VALID_COMPARABLE", executionMilliseconds: row.durationMs }));
  return {
    suiteId,
    outcomes: Object.fromEntries(
      model.terminalOutcomes.map((status) => [status, rows.filter((row) => row.outcome === status).length]),
    ),
    ...model.durationStatistics(samples),
  };
}

export function verifyHistory(store) {
  const integrity = store.db.prepare("PRAGMA integrity_check").get()["integrity_check"];
  const mismatches = store.db
    .prepare("SELECT id, payload_digest AS payloadDigest, payload_json AS payload FROM historical_runs ORDER BY id")
    .all()
    .filter((row) => digest(row.payload) !== row.payloadDigest)
    .map((row) => row.id);
  return { integrity, valid: integrity === "ok" && mismatches.length === 0, mismatches };
}

export function exportHistoryManifest(store) {
  const runs = store.db
    .prepare(
      "SELECT id, source_watermark AS sourceWatermark, policy_digest AS policyDigest, plan_digest AS planDigest, evidence_class AS evidenceClass, cleanup_status AS cleanupStatus, payload_digest AS payloadDigest FROM historical_runs ORDER BY id",
    )
    .all();
  return { schemaVersion: PHASE3_SCHEMA_VERSION, runs, digest: digest(runs) };
}

export function pruneHistory(store, { before, evidenceClasses = ["SYNTHETIC_FIXTURE", "HUMAN_ATTESTATION"] } = {}) {
  if (!before || !Number.isFinite(Date.parse(before))) throw new Error("INVALID_RETENTION_CUTOFF");
  const values = evidenceClasses.map(String);
  if (!values.length) return { pruned: 0 };
  const placeholders = values.map(() => "?").join(",");
  const candidates = store.db
    .prepare(`SELECT id FROM historical_runs WHERE created_at < ? AND evidence_class IN (${placeholders})`)
    .all(before, ...values)
    .map((row) => row.id);
  if (!candidates.length) return { pruned: 0 };
  const candidateSlots = candidates.map(() => "?").join(",");
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of historicalEntities)
      store.db.prepare(`DELETE FROM ${table} WHERE run_id IN (${candidateSlots})`).run(...candidates);
    store.db.prepare(`DELETE FROM suite_executions WHERE run_id IN (${candidateSlots})`).run(...candidates);
    store.db.prepare(`DELETE FROM decisions WHERE run_id IN (${candidateSlots})`).run(...candidates);
    const result = store.db.prepare(`DELETE FROM historical_runs WHERE id IN (${candidateSlots})`).run(...candidates);
    store.db.exec("COMMIT");
    return { pruned: Number(result.changes) };
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}

export function recordHistoricalEntity(
  store,
  entity,
  { runId = null, subjectId, status, startedAt = null, endedAt = null, payload = {} },
) {
  const table = entityName(entity);
  safeId(subjectId, "subject_id");
  safeStatus(status);
  if (runId) safeId(runId, "run_id");
  const payloadJson = json(payload);
  const payloadDigest = digest(payloadJson);
  const id = `${table}:${payloadDigest}`;
  store.db
    .prepare(`INSERT OR IGNORE INTO ${table} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, runId, subjectId, status, startedAt, endedAt, payloadDigest, payloadJson, new Date().toISOString());
  return { id, entity: table, payloadDigest };
}

export function recordFlakeObservation(store, { runId = null, suiteId, attempts, protectedContract = false }) {
  if (!Array.isArray(attempts) || attempts.length < 2) throw new Error("INSUFFICIENT_FLAKE_HISTORY");
  const outcomes = attempts.map((attempt) => attempt.outcome);
  if (outcomes.some((outcome) => !model.terminalOutcomes.includes(outcome))) throw new Error("INVALID_FLAKE_OUTCOME");
  const qualified =
    !protectedContract &&
    outcomes.filter((outcome) => outcome === "FAILED_ROOT").length >= 2 &&
    outcomes.includes("PASSED");
  return recordHistoricalEntity(store, "historical_flake_observations", {
    runId,
    subjectId: suiteId,
    status: qualified ? "QUALIFIED_FLAKE" : "NOT_QUALIFIED",
    payload: { attempts: outcomes, protectedContract },
  });
}

export function recordStaleTest(
  store,
  { runId = null, testId, classification, protectedContract = false, evidence = {} },
) {
  if (protectedContract && classification !== "PROTECTED_CONTRACT_REGRESSION_NOT_STALE")
    throw new Error("PROTECTED_CONTRACT_REGRESSION_NOT_STALE");
  return recordHistoricalEntity(store, "historical_stale_test_records", {
    runId,
    subjectId: testId,
    status: classification,
    payload: { protectedContract, evidence },
  });
}

export function recordSlowSuite(store, { runId = null, suiteId, durationMs, budgetMs, bottleneck }) {
  if (!Number.isFinite(durationMs) || !Number.isFinite(budgetMs) || typeof bottleneck !== "string" || !bottleneck)
    throw new Error("INVALID_SLOW_SUITE_RECORD");
  return recordHistoricalEntity(store, "historical_slow_suite_records", {
    runId,
    subjectId: suiteId,
    status: durationMs > budgetMs ? "OVER_BUDGET" : "WITHIN_BUDGET",
    payload: { durationMs, budgetMs, bottleneck },
  });
}

export function listHistoricalEntities(store, entity, { subjectId = null } = {}) {
  const table = entityName(entity);
  const rows = subjectId
    ? store.db.prepare(`SELECT * FROM ${table} WHERE subject_id = ? ORDER BY created_at, id`).all(subjectId)
    : store.db.prepare(`SELECT * FROM ${table} ORDER BY created_at, id`).all();
  return rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    subjectId: row.subject_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    payloadDigest: row.payload_digest,
    payload: parse(row.payload_json),
    createdAt: row.created_at,
  }));
}

export function freshness(current, evidence) {
  const result = model.classifyFreshness(current, evidence);
  if (result.status === "STALE_UNKNOWN") return { ...result, status: "UNKNOWN_CONSERVATIVE", reusable: false };
  if (result.status !== "FRESH_EXACT") return { ...result, reusable: false };
  const extended = [
    ["contractDigest", "STALE_CONTRACT", "CONTRACT_DIGEST_CHANGED"],
    ["suiteId", "STALE_SUITE", "SUITE_ID_CHANGED"],
    ["providerIdentity", "STALE_PROVIDER", "PROVIDER_IDENTITY_CHANGED"],
    ["databaseIdentity", "STALE_DATABASE", "DATABASE_IDENTITY_CHANGED"],
    ["dependencyDigest", "STALE_DEPENDENCY", "DEPENDENCY_DIGEST_CHANGED"],
  ];
  for (const [field, status, reason] of extended) {
    const currentValue = current[field];
    const evidenceValue = evidence[field];
    if (currentValue === undefined && evidenceValue === undefined) continue;
    if (!currentValue || !evidenceValue)
      return { status: "UNKNOWN_CONSERVATIVE", reason: `MISSING_${field}`, reusable: false };
    if (currentValue !== evidenceValue) return { status, reason, reusable: false };
  }
  return { ...result, reusable: evidence.cleanupStatus === "CLEAN" };
}
export function planImpact(input) {
  const plan = { ...model.planImpact(input) };
  delete plan.banner;
  return {
    ...plan,
    phase: 3,
    selected: plan.selected.map((x) => ({ ...x, expandedBecause: x.selectedBecause })),
    omitted: plan.omitted.map((x) => ({ ...x, provenIndependence: false })),
  };
}

const pathMatches = (candidate, pattern) => {
  const expression = `^${String(pattern)
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "§")
    .replace(/\*/gu, "[^/]*")
    .replace(/§/gu, ".*")}$`;
  return new RegExp(expression, "u").test(candidate);
};

export function contractAwareImpact({ changedPaths, policy, scope = "change", historicalEvidence = [] }) {
  if (!policy || !Array.isArray(policy.suites) || !Array.isArray(changedPaths))
    throw new Error("INVALID_CONTRACT_IMPACT_INPUT");
  const suites = policy.suites;
  const selected = new Map();
  const add = (suiteId, reason) => {
    const suite = suites.find((item) => item.id === suiteId);
    if (!suite) throw new Error(`UNKNOWN_POLICY_SUITE_${suiteId}`);
    if (!selected.has(suiteId)) selected.set(suiteId, new Set());
    selected.get(suiteId).add(reason);
    for (const dependency of suite.dependencies ?? []) add(dependency, `DEPENDENCY_OF_${suiteId}`);
  };
  let uncertain = scope === "release";
  for (const changed of changedPaths) {
    const matched = suites.filter((suite) =>
      (suite.affectedPaths ?? []).some((pattern) => pathMatches(changed, pattern)),
    );
    if (!matched.length) uncertain = true;
    for (const suite of matched) add(suite.id, `AFFECTED_PATH_${changed}`);
    if (/(?:^|\/)(?:prisma\/migrations|schema\..*prisma)(?:\/|$)/iu.test(changed)) {
      for (const suite of suites.filter((suite) =>
        (suite.resources ?? []).some((resource) => /database|sqlite|mysql/iu.test(resource)),
      ))
        add(suite.id, `MIGRATION_EXPANSION_${changed}`);
      uncertain = true;
    }
    if (/^(?:package(?:-lock)?\.json|pnpm-lock\.yaml|next\.config\.|tsconfig\.)/iu.test(changed)) uncertain = true;
  }
  if (uncertain)
    for (const suite of suites)
      add(suite.id, scope === "release" ? "RELEASE_COMPREHENSIVE" : "UNKNOWN_IMPACT_BROADENING");
  const current = policy.identities ?? {};
  const evidenceBySuite = new Map(
    historicalEvidence
      .filter((evidence) => evidence && evidence.cleanupStatus === "CLEAN")
      .map((evidence) => [evidence.suiteId, evidence]),
  );
  const nodes = [...selected]
    .map(([suiteId, reasons]) => {
      const suite = suites.find((item) => item.id === suiteId);
      const evidence = evidenceBySuite.get(suiteId);
      const reusable =
        evidence &&
        evidence.sourceWatermark === current.sourceWatermark &&
        evidence.policyDigest === current.policyDigest &&
        evidence.fixtureVersion === (suite.fixtureVersion ?? evidence.fixtureVersion) &&
        evidence.environmentDigest === (suite.environmentDigest ?? evidence.environmentDigest);
      return {
        suiteId,
        reasons: [...reasons].sort(),
        contracts: [...(suite.contracts ?? [])].sort(),
        resources: [...(suite.resources ?? [])].sort(),
        action: scope === "release" || !reusable ? "EXECUTE" : "REUSE_EXACT_CLEAN_EVIDENCE",
        evidence: reusable ? { runId: evidence.runId, status: "FRESH_EXACT" } : { status: "REQUIRES_EXECUTION" },
      };
    })
    .sort((a, b) => a.suiteId.localeCompare(b.suiteId));
  return {
    phase: 3,
    scope,
    conservativeBroadening: uncertain,
    changedPaths: [...changedPaths].sort(),
    nodes,
    omitted: suites
      .filter((suite) => !selected.has(suite.id))
      .map((suite) => suite.id)
      .sort(),
    digest: digest({ changedPaths: [...changedPaths].sort(), policy, scope, historicalEvidence }),
  };
}
export function rerunPlan(input) {
  return {
    nodes: model.planInvalidation(input),
    digest: digest(input),
    unknownImpactBroadens: Boolean(input.repairImpactUnknown),
  };
}
export const normalizeFailureSignature = model.normalizeFailureSignature;
export const normalizeRootCascade = model.normalizeRootCascade;
export const balanceShards = model.balanceShards;
export const transitionThrottle = model.transitionThrottle;

export async function recordDecision(store, kind, value, runId = null) {
  const payload = json(value);
  const decisionDigest = digest({ kind, value });
  store.db
    .prepare("INSERT OR IGNORE INTO decisions VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), safeId(kind, "decision_kind"), runId, decisionDigest, payload, new Date().toISOString());
  return { kind, decisionDigest };
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${json(data)}\n`, "utf8");
  await rename(tmp, file);
}

const runFile = (root, id) => path.join(root, `${safeId(id, "run_id")}.json`);
const runLogFile = (root, id) => path.join(root, `${safeId(id, "run_id")}.log`);
export async function readRun(id, root = defaultRuntimeRoot()) {
  return parse(await readFile(runFile(root, id), "utf8"));
}
export async function appendRunLog(id, message, root = defaultRuntimeRoot()) {
  if (typeof message !== "string" || message.length > 4_000 || secret.test(message)) throw new Error("UNSAFE_RUN_LOG");
  await appendFile(runLogFile(root, id), `${new Date().toISOString()} ${message}\n`, "utf8");
}
export async function followRunLog(id, { root = defaultRuntimeRoot(), offset = 0 } = {}) {
  const file = runLogFile(root, id);
  try {
    const info = await stat(file);
    const content = await readFile(file, "utf8");
    return { offset: info.size, lines: content.slice(offset).split("\n").filter(Boolean) };
  } catch (error) {
    if (error.code === "ENOENT") return { offset: 0, lines: [] };
    throw error;
  }
}
export async function startRun({
  root = defaultRuntimeRoot(),
  sourceWatermark,
  policyDigest,
  planDigest,
  purpose = "focused",
  nodes = [],
  execution = null,
}) {
  for (const [key, value] of Object.entries({ sourceWatermark, policyDigest, planDigest }))
    if (!value) throw new Error(`MISSING_${key.toUpperCase()}`);
  safeIdentity(sourceWatermark, "SOURCE_WATERMARK");
  safeIdentity(policyDigest, "POLICY_DIGEST");
  safeIdentity(planDigest, "PLAN_DIGEST");
  await mkdir(root, { recursive: true });
  const id = `sl3-run-${randomUUID()}`;
  const record = {
    id,
    state: "RUNNING",
    sourceWatermark,
    policyDigest,
    planDigest,
    purpose,
    nodes,
    execution,
    createdAt: new Date().toISOString(),
    heartbeat: new Date().toISOString(),
    cleanup: "PENDING",
    controller: { pid: process.pid, host: os.hostname() },
  };
  const existing = await findEquivalentRun({ root, sourceWatermark, policyDigest, planDigest, purpose });
  if (existing) return { duplicateSuppressed: true, run: existing };
  await writeAtomic(runFile(root, id), record);
  await appendRunLog(id, "RUN_STARTED", root);
  return { duplicateSuppressed: false, run: record };
}
export async function findEquivalentRun({
  root = defaultRuntimeRoot(),
  sourceWatermark,
  policyDigest,
  planDigest,
  purpose,
}) {
  try {
    const files = (await readdir(root)).filter((name) => name.endsWith(".json"));
    for (const file of files) {
      const run = parse(await readFile(path.join(root, file), "utf8"));
      if (
        run.state === "RUNNING" &&
        run.sourceWatermark === sourceWatermark &&
        run.policyDigest === policyDigest &&
        run.planDigest === planDigest &&
        run.purpose === purpose
      )
        return run;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return null;
}
export async function updateRun(id, patch, root = defaultRuntimeRoot()) {
  safeId(id, "run_id");
  const file = runFile(root, id);
  const current = parse(await readFile(file, "utf8"));
  const next = { ...current, ...patch, heartbeat: new Date().toISOString() };
  await writeAtomic(file, next);
  return next;
}
export async function cancelRun(id, root) {
  const run = await updateRun(
    id,
    { state: "CANCEL_REQUESTED", cleanup: "PENDING", cancellationRequestedAt: new Date().toISOString() },
    root,
  );
  await appendRunLog(id, "CANCELLATION_REQUESTED", root);
  return run;
}
export async function completeRun(id, cleanup = "CLEAN", root) {
  const run = await updateRun(
    id,
    { state: cleanup === "CLEAN" ? "COMPLETED" : "QUARANTINED", cleanup, terminalAt: new Date().toISOString() },
    root,
  );
  await appendRunLog(id, `RUN_TERMINAL_${run.state}`, root);
  return run;
}
export async function resumeRun(id, identities, root) {
  const current = await readRun(id, root ?? defaultRuntimeRoot());
  for (const key of ["sourceWatermark", "policyDigest", "planDigest"])
    if (current[key] !== identities[key]) throw new Error(`UNSAFE_RESUME_${key.toUpperCase()}`);
  if (current.cleanup !== "CLEAN" && current.state !== "RUNNING") throw new Error("UNSAFE_RESUME_CLEANUP");
  if ((current.nodes ?? []).some((node) => node.resumeClass === "NON_RESUMABLE"))
    throw new Error("NON_RESUMABLE_NODE_REQUIRES_NEW_RUN");
  const run = await updateRun(id, { state: "RUNNING", resumedAt: new Date().toISOString() }, root);
  await appendRunLog(id, "RUN_RESUMED", root);
  return run;
}

const controllerModule = path.join(path.dirname(fileURLToPath(import.meta.url)), "phase3-controller.mjs");
const controllerAlive = (controller) => {
  if (!controller?.pid || controller.host !== os.hostname()) return false;
  try {
    process.kill(controller.pid, 0);
    return true;
  } catch {
    return false;
  }
};

export async function launchController(input) {
  const started = await startRun(input);
  if (started.duplicateSuppressed) return { ...started, controllerStarted: false };
  const token = randomUUID();
  const controllerStartedAt = new Date().toISOString();
  await updateRun(
    started.run.id,
    {
      controller: {
        pid: null,
        host: os.hostname(),
        executable: digest(process.execPath),
        startedAt: controllerStartedAt,
        tokenDigest: digest(token),
      },
    },
    input.root,
  );
  const child = spawn(
    process.execPath,
    [controllerModule, "--root", input.root ?? defaultRuntimeRoot(), "--run", started.run.id],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, SOUNDING_LINE_CONTROLLER_TOKEN: token },
    },
  );
  child.unref();
  const run = await updateRun(
    started.run.id,
    {
      state: "RUNNING",
      controller: {
        pid: child.pid,
        host: os.hostname(),
        executable: digest(process.execPath),
        startedAt: controllerStartedAt,
        tokenDigest: digest(token),
      },
    },
    input.root,
  );
  await appendRunLog(run.id, "DETACHED_CONTROLLER_STARTED", input.root);
  return { duplicateSuppressed: false, controllerStarted: true, run };
}

export async function inspectOrphans(root = defaultRuntimeRoot()) {
  const entries = [];
  try {
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".json"))) {
      const run = parse(await readFile(path.join(root, file), "utf8"));
      if (run.state === "RUNNING" && run.controller?.host && run.controller.host !== os.hostname()) {
        const quarantined = await updateRun(
          run.id,
          {
            state: "QUARANTINED",
            cleanup: "UNKNOWN",
            quarantineReason: "AMBIGUOUS_CONTROLLER_HOST",
          },
          root,
        );
        await appendRunLog(run.id, "QUARANTINED_AMBIGUOUS_CONTROLLER_HOST", root);
        entries.push({ id: quarantined.id, state: quarantined.state, recoverable: false });
        continue;
      }
      if (run.state === "RUNNING" && !controllerAlive(run.controller)) {
        const orphan = await updateRun(
          run.id,
          {
            state: "ORPHANED",
            cleanup: "UNKNOWN",
            orphanedAt: new Date().toISOString(),
            orphanReason: "CONTROLLER_IDENTITY_NOT_LIVE",
          },
          root,
        );
        await appendRunLog(run.id, "ORPHAN_DETECTED_CONTROLLER_NOT_LIVE", root);
        entries.push({ id: orphan.id, state: orphan.state, recoverable: true });
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { entries };
}

export async function recoverRun(id, identities, { root = defaultRuntimeRoot(), store } = {}) {
  const current = await readRun(id, root);
  for (const key of ["sourceWatermark", "policyDigest", "planDigest"])
    if (current[key] !== identities[key]) throw new Error(`UNSAFE_RECOVERY_${key.toUpperCase()}`);
  if (store && !verifyHistory(store).valid) throw new Error("UNSAFE_RECOVERY_HISTORY_INVALID");
  if (current.state !== "ORPHANED") throw new Error("RUN_NOT_ORPHANED");
  const run = await updateRun(id, { state: "RECOVERING", recoveryStartedAt: new Date().toISOString() }, root);
  await appendRunLog(id, "RECOVERY_ACCEPTED_SAFE_NO_ALLOCATION", root);
  return run;
}
export function validateCompletionReport(report) {
  model.validateCompletionReport(report);
  const status = String(report.finalStatus ?? "");
  if (/(?:^|_)(?:MAINLINE|RELEASE(?:_AUTHORITATIVE|_VALIDATED)?)(?:$|_)/u.test(status))
    throw new Error("UNSUPPORTED_COMPLETION_AUTHORITY");
  if (report.p34Status === "GREEN" || report.browserMatrix === "GREEN")
    throw new Error("P34_CANNOT_BE_REPRESENTED_AS_GREEN");
  if ((report.externalGates ?? []).some((gate) => gate.status === "VALIDATED" && !gate.evidenceId))
    throw new Error("EXTERNAL_GATE_EVIDENCE_REQUIRED");
  return true;
}
