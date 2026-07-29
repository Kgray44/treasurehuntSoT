/*
 * Project Sounding Line Phase 2 runtime.
 *
 * This module is deliberately dependency-free and only executes internal,
 * allowlisted fixtures.  Product commands remain under the legacy harness
 * until an adapter has separately been accepted.
 */
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, realpath, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const MARKER = "project-sounding-line-phase-2";
const LEASE_FILE = "broker-leases.json";
const capacities = Object.freeze({ "node-slot": 4, "vitest-worker-pool": 4 });

export class SoundingLineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export class ResourceConflictError extends SoundingLineError {
  constructor(key) {
    super("RESOURCE_CONFLICT", `resource is already exclusively leased: ${key}`);
  }
}

export const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalize(value))
    .digest("hex");
const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isWithin = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};
const safeName = (value, label = "identifier") => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9._-]{0,80}$/u.test(value))
    throw new SoundingLineError("UNSAFE_IDENTIFIER", `${label} is unsafe`);
  return value;
};
export const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};
const writeJson = async (file, value) => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  // rename is intentionally avoided: a Windows virus scanner can hold the old
  // broker file.  The lock makes this replacement visible atomically enough to
  // all runtime writers and the checksum detects any incomplete observer read.
  await copyFile(temporary, file);
  await rm(temporary, { force: true });
};

export function defaultRuntimeBase() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "ForeverTreasureCompanion", "SoundingLine", "runs");
}

async function assertSafeBase(base, repositoryRoot) {
  const absolute = path.resolve(base);
  await mkdir(absolute, { recursive: true });
  const resolved = await realpath(absolute);
  if (repositoryRoot && isWithin(resolved, await realpath(repositoryRoot)))
    throw new SoundingLineError("UNSAFE_RUNTIME_ROOT", "runtime base cannot be inside the repository");
  if (path.parse(resolved).root === resolved)
    throw new SoundingLineError("UNSAFE_RUNTIME_ROOT", "runtime base cannot be a filesystem root");
  return resolved;
}

async function markerFor(root) {
  return readJson(path.join(root, "run-marker.json"), null);
}
export async function assertRun(run) {
  const marker = await markerFor(run.root);
  if (!marker || marker.kind !== MARKER || marker.runId !== run.id || marker.controllerToken !== run.controllerToken)
    throw new SoundingLineError("UNVERIFIED_RUN", "runtime marker does not prove this run owns the requested path");
  return marker;
}

export async function createRuntime({ base = defaultRuntimeBase(), repositoryRoot, plan, identity = {} } = {}) {
  if (plan) validateSealedPlan(plan, identity);
  const safeBase = await assertSafeBase(base, repositoryRoot);
  const id = `sl-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const root = path.join(safeBase, id);
  await mkdir(root, { recursive: false });
  for (const child of ["receipts", "db", "storage", "browser", "logs", "traces", "quarantine"])
    await mkdir(path.join(root, child));
  const run = {
    id,
    root,
    base: safeBase,
    controllerToken: randomUUID(),
    createdAt: now(),
    host: os.hostname(),
    state: "CREATED",
  };
  const marker = {
    kind: MARKER,
    version: 1,
    runId: id,
    controllerToken: run.controllerToken,
    createdAt: run.createdAt,
    host: run.host,
  };
  await writeJson(path.join(root, "run-marker.json"), marker);
  await writeReceipt(run, "created", { planDigest: plan?.digest ?? null, policyDigest: plan?.policyDigest ?? null });
  return run;
}

export function validateSealedPlan(plan, identity = {}) {
  if (!plan || typeof plan !== "object") throw new SoundingLineError("INVALID_PLAN", "plan must be an object");
  if (plan.nonAuthoritative !== true || plan.execution !== "forbidden")
    throw new SoundingLineError("INVALID_PLAN_IDENTITY", "only Phase 1 sealed nonauthoritative plans are accepted");
  if (!/^[a-f0-9]{64}$/u.test(plan.policyDigest ?? "") || !/^[a-f0-9]{64}$/u.test(plan.sourceDigest ?? ""))
    throw new SoundingLineError("INVALID_PLAN_DIGEST", "plan lacks policy or source digest");
  const unsigned = { ...plan };
  delete unsigned.digest;
  if (plan.digest && digest(unsigned) !== plan.digest)
    throw new SoundingLineError("INVALID_PLAN_DIGEST", "plan digest does not match its contents");
  if (identity.policyDigest && identity.policyDigest !== plan.policyDigest)
    throw new SoundingLineError("POLICY_IDENTITY_MISMATCH", "plan policy does not match the runtime policy");
  if (identity.sourceDigest && identity.sourceDigest !== plan.sourceDigest)
    throw new SoundingLineError("SOURCE_IDENTITY_MISMATCH", "plan source does not match the runtime source");
  validateExecutionGraph(plan);
  return true;
}

export function validateExecutionGraph(plan) {
  const selected = new Set((plan.selected ?? []).map((entry) => entry.suiteId));
  const graph = plan.graph ?? [];
  if (!selected.size || graph.length !== selected.size)
    throw new SoundingLineError("INVALID_GRAPH", "selected suites and graph nodes must match");
  const rows = new Map(graph.map((node) => [node.suiteId, node]));
  if (rows.size !== graph.length || [...selected].some((id) => !rows.has(id)))
    throw new SoundingLineError("INVALID_GRAPH", "graph node identities are invalid");
  for (const node of graph)
    for (const dependency of node.dependsOn ?? [])
      if (!rows.has(dependency))
        throw new SoundingLineError("MISSING_DEPENDENCY", `${node.suiteId} depends on unknown ${dependency}`);
  const visiting = new Set();
  const complete = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new SoundingLineError("GRAPH_CYCLE", `cycle includes ${id}`);
    if (complete.has(id)) return;
    visiting.add(id);
    for (const next of rows.get(id).dependsOn ?? []) visit(next);
    visiting.delete(id);
    complete.add(id);
  };
  [...rows.keys()].sort().forEach(visit);
  return [...rows.keys()].sort();
}

async function lock(base, action) {
  const lockPath = path.join(base, ".broker.lock");
  let handle;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await sleep(10 + attempt);
    }
  }
  if (!handle) throw new SoundingLineError("BROKER_BUSY", "broker lock did not become available");
  try {
    return await action();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}
const leaseKey = (request) => `${safeName(request.type, "resource type")}:${safeName(request.key, "resource key")}`;
const validMode = (mode) => mode === "exclusive" || mode === "shared-readonly";

export async function acquireBundle(run, requests) {
  await assertRun(run);
  if (!Array.isArray(requests) || !requests.length)
    throw new SoundingLineError("INVALID_BUNDLE", "bundle must contain at least one resource");
  const normalized = requests.map((request) => ({
    type: request.type,
    key: request.key,
    mode: request.mode ?? "exclusive",
    weight: request.weight ?? 1,
  }));
  if (normalized.some((request) => !validMode(request.mode) || !Number.isInteger(request.weight) || request.weight < 1))
    throw new SoundingLineError("INVALID_BUNDLE", "resource mode or weight is invalid");
  const keys = normalized.map(leaseKey);
  if (new Set(keys).size !== keys.length) throw new SoundingLineError("INVALID_BUNDLE", "bundle repeats a resource");
  return lock(run.base, async () => {
    const file = path.join(run.base, LEASE_FILE);
    const state = await readJson(file, { version: 1, leases: [] });
    const active = state.leases.filter((lease) => lease.state === "ACTIVE" && lease.expiresAt > now());
    for (const request of normalized) {
      const key = leaseKey(request);
      const matching = active.filter((lease) => lease.resourceKey === key);
      if (matching.some((lease) => lease.mode === "exclusive" || request.mode === "exclusive"))
        throw new ResourceConflictError(key);
      const capacity = capacities[request.type];
      if (capacity && matching.reduce((total, lease) => total + lease.weight, 0) + request.weight > capacity)
        throw new SoundingLineError("RESOURCE_CAPACITY", `capacity exhausted: ${key}`);
    }
    const acquiredAt = now();
    const leases = normalized.map((request) => ({
      id: randomUUID(),
      runId: run.id,
      controllerToken: run.controllerToken,
      resourceKey: leaseKey(request),
      ...request,
      revision: 1,
      state: "ACTIVE",
      acquiredAt,
      heartbeatAt: acquiredAt,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    state.leases = [...state.leases.filter((lease) => !active.includes(lease)), ...active, ...leases];
    await writeJson(file, state);
    await writeReceipt(run, "bundle-acquired", { leaseIds: leases.map((lease) => lease.id), resources: keys });
    return leases;
  });
}

export async function renewLease(run, leaseId, revision) {
  await assertRun(run);
  return lock(run.base, async () => {
    const file = path.join(run.base, LEASE_FILE);
    const state = await readJson(file, { version: 1, leases: [] });
    const lease = state.leases.find((candidate) => candidate.id === leaseId);
    if (!lease || lease.runId !== run.id || lease.controllerToken !== run.controllerToken)
      throw new SoundingLineError("LEASE_OWNERSHIP", "lease is not owned by this run");
    if (lease.revision !== revision) throw new SoundingLineError("LEASE_REVISION_CONFLICT", "lease revision is stale");
    lease.revision += 1;
    lease.heartbeatAt = now();
    lease.expiresAt = new Date(Date.now() + 60_000).toISOString();
    await writeJson(file, state);
    return lease;
  });
}

export async function releaseRunLeases(run, reason = "cleanup") {
  await assertRun(run);
  return lock(run.base, async () => {
    const file = path.join(run.base, LEASE_FILE);
    const state = await readJson(file, { version: 1, leases: [] });
    const released = state.leases.filter(
      (lease) => lease.runId === run.id && lease.controllerToken === run.controllerToken && lease.state === "ACTIVE",
    );
    for (const lease of released) {
      lease.state = "RELEASED";
      lease.releasedAt = now();
      lease.releaseReason = reason;
      lease.revision += 1;
    }
    await writeJson(file, state);
    return released;
  });
}

export async function inspectOrphans(base = defaultRuntimeBase()) {
  const safeBase = await assertSafeBase(base);
  const state = await readJson(path.join(safeBase, LEASE_FILE), { version: 1, leases: [] });
  const result = [];
  for (const lease of state.leases.filter((item) => item.state === "ACTIVE" && item.expiresAt <= now())) {
    const root = path.join(safeBase, lease.runId);
    const marker = await markerFor(root);
    const classification = marker?.controllerToken === lease.controllerToken ? "SAFE_STALE" : "AMBIGUOUS";
    result.push({ leaseId: lease.id, runId: lease.runId, classification });
    if (classification === "AMBIGUOUS") {
      lease.state = "QUARANTINED";
      lease.quarantinedAt = now();
    }
  }
  await writeJson(path.join(safeBase, LEASE_FILE), state);
  return result;
}

export async function writeReceipt(run, kind, detail) {
  await assertRun(run).catch((error) => {
    if (kind !== "created") throw error;
  });
  const receipt = { version: 1, kind: safeName(kind, "receipt kind"), runId: run.id, at: now(), detail };
  receipt.integrity = digest(receipt);
  await writeJson(path.join(run.root, "receipts", `${Date.now()}-${receipt.kind}.json`), receipt);
  return receipt;
}

export async function createSqliteBaseline(run, name = "baseline") {
  await assertRun(run);
  safeName(name, "baseline name");
  const file = path.join(run.root, "db", `${name}.sqlite`);
  const database = new DatabaseSync(file);
  try {
    database.exec(
      "PRAGMA journal_mode=DELETE; CREATE TABLE sounding_line_fixture (logical_id TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
  } finally {
    database.close();
  }
  const checksum = digest(await readFile(file));
  await writeJson(`${file}.baseline.json`, { kind: "immutable-sqlite-baseline", checksum, createdAt: now() });
  return { file, checksum };
}

export async function cloneSqlite(run, baseline, logicalId) {
  await assertRun(run);
  safeName(logicalId, "logical database id");
  const absolute = path.resolve(baseline);
  if (!isWithin(absolute, path.join(run.root, "db")))
    throw new SoundingLineError("CANONICAL_DATABASE_REFUSAL", "only a run-owned baseline may be cloned");
  const baselineReceipt = await readJson(`${absolute}.baseline.json`, null);
  if (!baselineReceipt || baselineReceipt.checksum !== digest(await readFile(absolute)))
    throw new SoundingLineError("BASELINE_INTEGRITY", "baseline checksum does not match its marker");
  const clone = path.join(run.root, "db", `clone-${logicalId}-${randomUUID().slice(0, 8)}.sqlite`);
  await copyFile(absolute, clone);
  await writeJson(`${clone}.identity.json`, {
    logicalId,
    baselineChecksum: baselineReceipt.checksum,
    cloneChecksum: digest(await readFile(clone)),
  });
  return clone;
}

export async function createBrowserContext(run, shard) {
  await assertRun(run);
  safeName(shard, "browser shard");
  const root = path.join(run.root, "browser", `${shard}-${randomUUID().slice(0, 8)}`);
  await mkdir(root);
  const context = {
    root,
    shard,
    storageState: path.join(root, "storage-state.json"),
    trace: path.join(run.root, "traces", `${shard}-${randomUUID().slice(0, 8)}.trace.json`),
  };
  await writeJson(context.storageState, { cookies: [], localStorage: {}, runId: run.id, shard });
  return context;
}
export async function setBrowserStorage(context, key, value) {
  safeName(key, "storage key");
  const state = await readJson(context.storageState, null);
  if (!state) throw new SoundingLineError("BROWSER_CONTEXT", "context storage marker is missing");
  state.localStorage[key] = value;
  await writeJson(context.storageState, state);
}

export async function createOwnedService(run, serviceId = "fixture") {
  await assertRun(run);
  safeName(serviceId, "service id");
  const token = randomUUID();
  const server = net.createServer((socket) =>
    socket.end(JSON.stringify({ soundingLine: token, runId: run.id, serviceId })),
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  const address = server.address();
  const service = { server, port: address.port, token, serviceId, runId: run.id };
  await writeJson(path.join(run.root, "logs", `service-${serviceId}.json`), {
    port: service.port,
    token,
    serviceId,
    runId: run.id,
    startedAt: now(),
  });
  return service;
}
export async function createOwnedHttpService(run, serviceId = "browser-fixture") {
  await assertRun(run);
  safeName(serviceId, "service id");
  const token = randomUUID();
  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader("x-sounding-line-token", token);
    response.end(
      `<!doctype html><meta name="sounding-line-token" content="${token}"><script>document.title='${run.id}'</script>`,
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  const address = server.address();
  const service = { server, port: address.port, token, serviceId, runId: run.id, protocol: "http" };
  await writeJson(path.join(run.root, "logs", `service-${serviceId}.json`), {
    port: service.port,
    token,
    serviceId,
    runId: run.id,
    protocol: "http",
    startedAt: now(),
  });
  return service;
}
export async function verifyHttpServiceIdentity(service) {
  const response = await fetch(`http://127.0.0.1:${service.port}/`);
  return response.headers.get("x-sounding-line-token") === service.token;
}
export async function verifyServiceIdentity(service) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: service.port });
    let body = "";
    socket.on("data", (chunk) => {
      body += chunk;
    });
    socket.on("error", reject);
    socket.on("end", () => {
      try {
        const observed = JSON.parse(body);
        resolve(observed.soundingLine === service.token && observed.runId === service.runId);
      } catch {
        resolve(false);
      }
    });
  });
}
export async function stopOwnedService(run, service) {
  await assertRun(run);
  if (service.runId !== run.id || !service.server || !service.token)
    throw new SoundingLineError("PROCESS_OWNERSHIP", "service ownership is not proven");
  await new Promise((resolve, reject) => service.server.close((error) => (error ? reject(error) : resolve())));
}

export async function cleanupRuntime(run, reason = "success", services = []) {
  await assertRun(run);
  for (const service of services) await stopOwnedService(run, service);
  const released = await releaseRunLeases(run, reason);
  run.state = "TERMINAL";
  await writeReceipt(run, "cleanup", {
    reason,
    releasedLeaseIds: released.map((lease) => lease.id),
    noOwnedServices: true,
  });
  return { released: released.length, state: run.state };
}

export async function executeGraph(plan, handlers, { cancelled = () => false } = {}) {
  validateExecutionGraph(plan);
  const graph = new Map(plan.graph.map((node) => [node.suiteId, node]));
  const pending = new Set(graph.keys());
  const results = [];
  while (pending.size) {
    if (cancelled()) throw new SoundingLineError("CANCELLED", "run was cancelled before a new node started");
    const ready = [...pending]
      .filter((id) =>
        (graph.get(id).dependsOn ?? []).every((dependency) =>
          results.some((result) => result.suiteId === dependency && result.status === "PASS"),
        ),
      )
      .sort();
    if (!ready.length) throw new SoundingLineError("BLOCKED_DEPENDENCY", "no runnable graph node remains");
    const batch = await Promise.all(
      ready.map(async (suiteId) => {
        const handler = handlers[suiteId];
        if (typeof handler !== "function")
          throw new SoundingLineError("UNALLOWLISTED_EXECUTOR", `no internal handler for ${suiteId}`);
        const startedAt = now();
        await handler();
        return { suiteId, status: "PASS", startedAt, finishedAt: now() };
      }),
    );
    for (const result of batch) {
      pending.delete(result.suiteId);
      results.push(result);
    }
  }
  return results;
}

export function compatibilityFor(suite) {
  safeName(suite, "suite id");
  return {
    suiteId: suite,
    legacyAuthority: "scripts/test-all.ps1",
    mode: "EMERGENCY_SERIAL",
    phase2Authority: "nonauthoritative-pilot",
    globalLockNarrowing: "PENDING_HARBORLIGHT_INTEGRATION",
  };
}
