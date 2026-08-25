import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { readNightwatchProjection } from "../src/nightwatch-projection.js";

const priorEnv = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
  Object.assign(process.env, priorEnv);
});

const setupLedger = () => {
  const root = mkdtempSync(join(tmpdir(), "bridgewatch-nightwatch-"));
  const file = join(root, "nightwatch.sqlite");
  const database = new DatabaseSync(file);
  database.exec(`
    CREATE TABLE candidates (candidate_id TEXT, objective_id TEXT, project TEXT, increment TEXT, branch TEXT, product_head_sha TEXT, local_base_sha TEXT, created_at TEXT, state TEXT, active INTEGER, predecessor_id TEXT, terminal_reason TEXT);
    CREATE TABLE integration_queue (candidate_id TEXT, ready_at TEXT, priority INTEGER, dependencies_json TEXT, migration_reservations_json TEXT, ownership_classes_json TEXT, blockers_json TEXT, focused_evidence_json TEXT, downstream_unblock_value INTEGER, risk INTEGER, estimated_size INTEGER, queue_state TEXT, reconciliation_count INTEGER);
    CREATE TABLE migration_reservations (reservation_id TEXT, family TEXT, start_id INTEGER, end_id INTEGER, project TEXT, objective_id TEXT, candidate_id TEXT, allocated_at TEXT, expires_at TEXT, state TEXT);
    CREATE TABLE leases (lease_id TEXT, lease_type TEXT, scope TEXT, owner TEXT, candidate_id TEXT, issued_at TEXT, expires_at TEXT, state TEXT);
    CREATE TABLE integration_cascades (cascade_id TEXT, root_fingerprint TEXT, root_identity TEXT, started_at TEXT, maintenance_pr_count INTEGER, authority_attempts INTEGER, mainline_rebuilds INTEGER, blocked_candidates_json TEXT, status TEXT);
    CREATE TABLE acceptance_transactions (transaction_id TEXT, candidate_id TEXT, cascade_id TEXT, candidate_sha TEXT, candidate_tree_sha TEXT, base_sha TEXT, base_tree_sha TEXT, candidate_ref TEXT, state TEXT, authority_run_id TEXT, binding_run_id TEXT, authority_result TEXT, binding_result TEXT, lease_id TEXT, last_semantic_invalidation TEXT, preserved_evidence_count INTEGER, rerun_evidence_count INTEGER, created_at TEXT, updated_at TEXT);
  `);
  database
    .prepare("INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "candidate-alpha",
      "objective-alpha",
      "project-alpha",
      "increment-a",
      "codex/project-alpha",
      "product-head",
      "base-head",
      "2026-08-20T00:00:00.000Z",
      "QUEUE_FRONT",
      1,
      null,
      null,
    );
  database
    .prepare("INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "candidate-beta",
      "objective-beta",
      "project-beta",
      "increment-a",
      "codex/project-beta",
      "product-head-beta",
      "base-head-beta",
      "2026-08-20T00:00:00.000Z",
      "QUEUED",
      1,
      null,
      null,
    );
  database
    .prepare("INSERT INTO integration_queue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "candidate-alpha",
      "2026-08-20T00:00:00.000Z",
      0,
      "[]",
      "[]",
      "[]",
      "[]",
      '["tests/nightwatch"]',
      0,
      0,
      0,
      "FRONT",
      0,
    );
  database
    .prepare("INSERT INTO integration_queue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "candidate-beta",
      "2026-08-20T00:05:00.000Z",
      0,
      "[]",
      "[]",
      "[]",
      '["MW-00418"]',
      "[]",
      0,
      0,
      0,
      "BLOCKED",
      0,
    );
  database
    .prepare("INSERT INTO migration_reservations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "reservation-alpha",
      "test-family",
      10,
      11,
      "project-alpha",
      "objective-alpha",
      "candidate-alpha",
      "2026-08-20T00:00:00.000Z",
      "2026-08-20T02:00:00.000Z",
      "ACTIVE",
    );
  database
    .prepare("INSERT INTO leases VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "lease-alpha",
      "INTEGRATION_ACCEPTANCE",
      "integration-queue",
      "integrator",
      "candidate-alpha",
      "2026-08-20T00:00:00.000Z",
      "2026-08-20T02:00:00.000Z",
      "ACTIVE",
    );
  database
    .prepare("INSERT INTO integration_cascades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "cascade-alpha",
      "semantic-root-alpha",
      "root-alpha",
      "2026-08-20T00:00:00.000Z",
      1,
      1,
      0,
      '["candidate-beta"]',
      "WARNING",
    );
  database
    .prepare("INSERT INTO acceptance_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "transaction-alpha",
      "candidate-alpha",
      "cascade-alpha",
      "candidate-head",
      "candidate-tree",
      "base-head",
      "base-tree",
      "refs/heads/codex/alpha",
      "AWAITING_AUTHORITY",
      null,
      null,
      null,
      null,
      "lease-alpha",
      null,
      2,
      0,
      "2026-08-20T00:00:00.000Z",
      "2026-08-20T00:00:00.000Z",
    );
  database.close();
  return { root, file, lease: { id: "lease-alpha" } };
};

describe("Nightwatch Bridgewatch projection", () => {
  it("reads the ledger without mutation and projects candidate, queue, reservations, and acceptance ownership", () => {
    const fixture = setupLedger();
    const projection = readNightwatchProjection(fixture.file, fixture.root, Date.parse("2026-08-20T01:00:00.000Z"));
    expect(projection.state).toBe("AVAILABLE");
    expect(projection.candidates).toContainEqual(
      expect.objectContaining({ id: "candidate-alpha", state: "QUEUE_FRONT", blockers: [] }),
    );
    expect(projection.queue).toContainEqual(
      expect.objectContaining({ candidateId: "candidate-beta", blockers: ["MW-00418"] }),
    );
    expect(projection.migrationReservations).toContainEqual(expect.objectContaining({ startId: 10, endId: 11 }));
    expect(projection.acceptanceOwnership).toBe(fixture.lease.id);
    expect(projection.controller).toMatchObject({
      state: "DOWN",
      detail: "Nightwatch controller health has not been commissioned.",
    });
    expect(projection.transactions).toContainEqual(
      expect.objectContaining({
        id: "transaction-alpha",
        state: "AWAITING_AUTHORITY",
        candidateTreeSha: "candidate-tree",
      }),
    );
    expect(projection.cascades).toContainEqual(
      expect.objectContaining({ id: "cascade-alpha", status: "WARNING", maintenancePrCount: 1 }),
    );
    expect(JSON.stringify(projection)).not.toMatch(/token|password|credential/i);
  });

  it("is exposed only through the read-only Nightwatch API", async () => {
    const fixture = setupLedger();
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(fixture.root, "bridgewatch.sqlite");
    process.env.BRIDGEWATCH_NIGHTWATCH_DB_PATH = fixture.file;
    process.env.BRIDGEWATCH_NIGHTWATCH_REPOSITORY_ROOT = fixture.root;
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      const response = await app.inject({ method: "GET", url: "/api/nightwatch" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ state: "AVAILABLE", queueFront: "candidate-alpha" });
      expect((await app.inject({ method: "POST", url: "/api/nightwatch" })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("reports a missing ledger truthfully without creating one", () => {
    const root = mkdtempSync(join(tmpdir(), "bridgewatch-nightwatch-missing-"));
    const projection = readNightwatchProjection(join(root, "missing.sqlite"), root);
    expect(projection).toMatchObject({ state: "UNAVAILABLE", candidates: [], queue: [] });
  });
});
