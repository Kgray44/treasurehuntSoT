/* Project Sounding Line Phase 3: durable, local verification intelligence. */
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as model from "./preparation/phase3/index.mjs";

export const PHASE3_SCHEMA_VERSION = 1;
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
const json = (value) => canonicalize(value ?? {});
const parse = (value) => JSON.parse(value);

export async function openHistory(root = defaultHistoryRoot()) {
  await mkdir(root, { recursive: true });
  const file = path.join(root, "history.sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS historical_runs (id TEXT PRIMARY KEY, source_watermark TEXT NOT NULL, policy_digest TEXT NOT NULL, plan_digest TEXT NOT NULL, evidence_class TEXT NOT NULL, cleanup_status TEXT NOT NULL, payload_digest TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS suite_executions (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES historical_runs(id), suite_id TEXT NOT NULL, outcome TEXT NOT NULL, duration_ms INTEGER, environment_digest TEXT NOT NULL, fixture_version TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, run_id TEXT REFERENCES historical_runs(id), decision_digest TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
    PHASE3_SCHEMA_VERSION,
    new Date().toISOString(),
  );
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

export async function ingestReceipt(store, rawReceipt) {
  const receipt = validateReceipt(rawReceipt);
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
  const result = store.db
    .prepare(`DELETE FROM historical_runs WHERE created_at < ? AND evidence_class IN (${placeholders})`)
    .run(before, ...values);
  return { pruned: Number(result.changes) };
}

export function freshness(current, evidence) {
  const result = model.classifyFreshness(current, evidence);
  if (result.status === "STALE_UNKNOWN") return { ...result, status: "UNKNOWN_CONSERVATIVE", reusable: false };
  return { ...result, reusable: result.status === "FRESH_EXACT" && evidence.cleanupStatus === "CLEAN" };
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
}) {
  for (const [key, value] of Object.entries({ sourceWatermark, policyDigest, planDigest }))
    if (!value) throw new Error(`MISSING_${key.toUpperCase()}`);
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
    { state: "CANCELLED", cleanup: "PENDING", cancellationRequestedAt: new Date().toISOString() },
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
  const run = await updateRun(id, { state: "RUNNING", resumedAt: new Date().toISOString() }, root);
  await appendRunLog(id, "RUN_RESUMED", root);
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
