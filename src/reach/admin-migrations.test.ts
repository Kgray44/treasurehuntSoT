// @vitest-environment node
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../prisma/migrations/202610180001_reach_admin_policy_telemetry/migration.sql", import.meta.url),
  "utf8",
);
const now = "2026-10-18T00:00:00.000Z";
const later = "2026-10-19T00:00:00.000Z";
let database: DatabaseSync;

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(migration);
});
afterEach(() => database.close());

function insertReport(id: string, key: string, receivedAt = now, expiresAt = later) {
  return database
    .prepare(
      "INSERT INTO ReachTelemetryReport (id,idempotencyKey,fingerprint,reportVersion,report,receivedAt,expiresAt) VALUES (?,?,?,?,?,?,?)",
    )
    .run(id, key, "synthetic-fingerprint", 1, '{"samples":3}', receivedAt, expiresAt);
}
function insertChange(id: string, key: string) {
  return database
    .prepare(
      "INSERT INTO ReachPolicyChange (id,actorAccountId,accountSessionId,idempotencyKey,fingerprint,expectedRevision,resultingRevision,beforeState,afterState,reason,correlationId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      "synthetic-operator",
      "synthetic-assurance",
      key,
      "fingerprint",
      0,
      1,
      "{}",
      "{}",
      "Rehearsal",
      "correlation",
      now,
    );
}

describe("Reach SQLite migration on a real disposable engine", () => {
  it("creates all four tables and their actual lookup/unique indexes", () => {
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Reach%' ORDER BY name")
        .all()
        .map((row) => row.name),
    ).toEqual(["ReachPolicyChange", "ReachPolicyPreview", "ReachRuntimePolicy", "ReachTelemetryReport"]);
    const expectedIndexes = {
      ReachPolicyPreview: { ReachPolicyPreview_expiresAt_idx: 0 },
      ReachPolicyChange: { ReachPolicyChange_createdAt_idx: 0, ReachPolicyChange_idempotencyKey_key: 1 },
      ReachTelemetryReport: {
        ReachTelemetryReport_receivedAt_idx: 0,
        ReachTelemetryReport_expiresAt_idx: 0,
        ReachTelemetryReport_idempotencyKey_key: 1,
      },
    };
    for (const [table, expected] of Object.entries(expectedIndexes)) {
      const actual = Object.fromEntries(
        database
          .prepare(`PRAGMA index_list('${table}')`)
          .all()
          .filter((index) => index.origin === "c")
          .map((index) => [index.name, index.unique]),
      );
      expect(actual).toEqual(expected);
    }
    expect(database.prepare("PRAGMA integrity_check").get()).toMatchObject({ integrity_check: "ok" });
  });

  it("round-trips policy, nullable assurance use and numeric reports with conditional revision updates", () => {
    const policy = JSON.stringify({ normalMaximumHz: 15, telemetryEnabled: true });
    database
      .prepare("INSERT INTO ReachRuntimePolicy (id,revision,policy,updatedAt) VALUES (?,?,?,?)")
      .run("REACH_RUNTIME_V1", 0, policy, now);
    expect(
      database.prepare("SELECT revision,policy FROM ReachRuntimePolicy WHERE id=?").get("REACH_RUNTIME_V1"),
    ).toMatchObject({ revision: 0, policy });
    const update = database.prepare("UPDATE ReachRuntimePolicy SET revision=revision+1 WHERE id=? AND revision=?");
    expect(update.run("REACH_RUNTIME_V1", 0).changes).toBe(1);
    expect(update.run("REACH_RUNTIME_V1", 0).changes).toBe(0);
    database
      .prepare(
        "INSERT INTO ReachPolicyPreview (id,actorAccountId,accountSessionId,fingerprint,expectedRevision,expiresAt,usedAt,createdAt) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run("preview", "synthetic-operator", "synthetic-assurance", "fingerprint", 1, later, null, now);
    expect(database.prepare("SELECT usedAt FROM ReachPolicyPreview WHERE id=?").get("preview")).toMatchObject({
      usedAt: null,
    });
    database.prepare("UPDATE ReachPolicyPreview SET usedAt=? WHERE id=?").run(now, "preview");
    expect(database.prepare("SELECT usedAt FROM ReachPolicyPreview WHERE id=?").get("preview")).toMatchObject({
      usedAt: now,
    });
    insertChange("change", "change-key");
    insertReport("report", "report-key");
    expect(
      database.prepare("SELECT expectedRevision,resultingRevision FROM ReachPolicyChange WHERE id=?").get("change"),
    ).toMatchObject({ expectedRevision: 0, resultingRevision: 1 });
    expect(
      database.prepare("SELECT reportVersion,report FROM ReachTelemetryReport WHERE id=?").get("report"),
    ).toMatchObject({ reportVersion: 1, report: '{"samples":3}' });
  });

  it("rejects duplicate report and policy-change idempotency keys even with different primary keys", () => {
    insertReport("report-a", "same-report-key");
    expect(() => insertReport("report-b", "same-report-key")).toThrow(
      /UNIQUE constraint failed: ReachTelemetryReport\.idempotencyKey/,
    );
    insertChange("change-a", "same-change-key");
    expect(() => insertChange("change-b", "same-change-key")).toThrow(
      /UNIQUE constraint failed: ReachPolicyChange\.idempotencyKey/,
    );
    expect(database.prepare("SELECT COUNT(*) AS count FROM ReachTelemetryReport").get()).toMatchObject({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM ReachPolicyChange").get()).toMatchObject({ count: 1 });
  });

  it("supports received-time paging and expiry deletion without deleting retained reports", () => {
    insertReport("old", "key-old", "2026-10-16T00:00:00.000Z", now);
    insertReport("current-a", "key-a", now, later);
    insertReport("current-b", "key-b", now, later);
    expect(
      database
        .prepare("SELECT id FROM ReachTelemetryReport ORDER BY receivedAt DESC,id DESC LIMIT 2")
        .all()
        .map((row) => row.id),
    ).toEqual(["current-b", "current-a"]);
    expect(database.prepare("DELETE FROM ReachTelemetryReport WHERE expiresAt <= ?").run(now).changes).toBe(1);
    expect(database.prepare("SELECT COUNT(*) AS count FROM ReachTelemetryReport").get()).toMatchObject({ count: 2 });
  });
});
