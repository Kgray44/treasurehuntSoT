import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import {
  ResourceConflictError,
  acquireBundle,
  cleanupRuntime,
  cloneSqlite,
  compatibilityFor,
  createBrowserContext,
  createOwnedService,
  createRuntime,
  createSqliteBaseline,
  executeGraph,
  inspectOrphans,
  setBrowserStorage,
  stopOwnedService,
  validateExecutionGraph,
  verifyServiceIdentity,
  createOwnedHttpService,
  classifyProcessOwnership,
  executeProductAdapter,
  verifyHttpServiceIdentity,
} from "../../scripts/sounding-line/runtime.mjs";
import { resolveAdapter, resolveVitestAdapter } from "../../scripts/sounding-line/adapters.mjs";

async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "sl-phase2-"));
  const run = await createRuntime({ base });
  return { base, run };
}
async function dispose(base) {
  await rm(base, { recursive: true, force: true });
}

test("atomic resource bundles reject conflicts without partial leakage", async () => {
  const { base, run } = await fixture();
  const second = await createRuntime({ base });
  try {
    const first = await acquireBundle(run, [
      { type: "application-port", key: "pilot" },
      { type: "sqlite-clone", key: "pilot" },
    ]);
    await assert.rejects(
      acquireBundle(second, [
        { type: "application-port", key: "pilot" },
        { type: "trace-root", key: "would-leak" },
      ]),
      ResourceConflictError,
    );
    const available = await acquireBundle(second, [{ type: "trace-root", key: "would-leak" }]);
    assert.equal(first.length, 2);
    assert.equal(available.length, 1);
  } finally {
    await cleanupRuntime(run);
    await cleanupRuntime(second);
    await dispose(base);
  }
});

test(
  "two Playwright contexts have isolated cookies and storage on a run-owned server",
  { timeout: 30_000 },
  async () => {
    const { base, run } = await fixture();
    let browser;
    try {
      const service = await createOwnedHttpService(run, "browser");
      assert.equal(await verifyHttpServiceIdentity(service), true);
      browser = await chromium.launch({ headless: true });
      const left = await browser.newContext();
      const right = await browser.newContext();
      const url = `http://127.0.0.1:${service.port}/`;
      const leftPage = await left.newPage();
      const rightPage = await right.newPage();
      await leftPage.goto(url);
      await rightPage.goto(url);
      await leftPage.context().addCookies([{ name: "run", value: "left", url }]);
      await leftPage.evaluate(() => localStorage.setItem("run", "left"));
      assert.equal((await right.cookies(url)).length, 0);
      assert.equal(await rightPage.evaluate(() => localStorage.getItem("run")), null);
      await left.close();
      await right.close();
      await stopOwnedService(run, service);
    } finally {
      await browser?.close();
      await cleanupRuntime(run);
      await dispose(base);
    }
  },
);

test("SQLite baselines clone independently and preserve the baseline checksum", async () => {
  const { base, run } = await fixture();
  try {
    const baseline = await createSqliteBaseline(run);
    const one = await cloneSqlite(run, baseline.file, "same-logical-id");
    const two = await cloneSqlite(run, baseline.file, "same-logical-id");
    const first = new DatabaseSync(one);
    const second = new DatabaseSync(two);
    first.prepare("INSERT INTO sounding_line_fixture VALUES (?, ?)").run("same-logical-id", "one");
    second.prepare("INSERT INTO sounding_line_fixture VALUES (?, ?)").run("same-logical-id", "two");
    assert.equal(
      first.prepare("SELECT value FROM sounding_line_fixture WHERE logical_id = ?").get("same-logical-id").value,
      "one",
    );
    assert.equal(
      second.prepare("SELECT value FROM sounding_line_fixture WHERE logical_id = ?").get("same-logical-id").value,
      "two",
    );
    first.close();
    second.close();
    const baselineDatabase = new DatabaseSync(baseline.file);
    assert.equal(baselineDatabase.prepare("SELECT count(*) AS total FROM sounding_line_fixture").get().total, 0);
    baselineDatabase.close();
  } finally {
    await cleanupRuntime(run);
    await dispose(base);
  }
});

test("browser contexts, services, cleanup, and quarantine preserve ownership boundaries", async () => {
  const { base, run } = await fixture();
  try {
    const left = await createBrowserContext(run, "left");
    const right = await createBrowserContext(run, "right");
    await setBrowserStorage(left, "session", "left-only");
    assert.match(await readFile(left.storageState, "utf8"), /left-only/);
    assert.doesNotMatch(await readFile(right.storageState, "utf8"), /left-only/);
    const service = await createOwnedService(run, "left");
    assert.equal(await verifyServiceIdentity(service), true);
    await stopOwnedService(run, service);
    const orphan = await inspectOrphans(base);
    assert.deepEqual(orphan, []);
  } finally {
    await cleanupRuntime(run);
    await dispose(base);
  }
});

test("expired ownership is classified conservatively and forged ownership quarantines", async () => {
  const { base, run } = await fixture();
  const forged = await createRuntime({ base });
  try {
    await acquireBundle(run, [{ type: "trace-root", key: "safe-stale" }]);
    await acquireBundle(forged, [{ type: "trace-root", key: "forged-stale" }]);
    const broker = path.join(base, "broker-leases.json");
    const state = JSON.parse(await readFile(broker, "utf8"));
    for (const lease of state.leases) lease.expiresAt = "2000-01-01T00:00:00.000Z";
    await writeFile(broker, `${JSON.stringify(state)}\n`);
    const marker = JSON.parse(await readFile(path.join(forged.root, "run-marker.json"), "utf8"));
    marker.controllerToken = "forged-controller-token";
    await writeFile(path.join(forged.root, "run-marker.json"), `${JSON.stringify(marker)}\n`);
    const inspection = await inspectOrphans(base);
    assert.deepEqual(inspection.map((entry) => entry.classification).sort(), ["AMBIGUOUS", "SAFE_STALE"]);
  } finally {
    await cleanupRuntime(run);
    await dispose(base);
  }
});

test("scheduler is deterministic, concurrent for independent nodes, and rejects cycles", async () => {
  const plan = {
    selected: [{ suiteId: "a" }, { suiteId: "b" }, { suiteId: "c" }],
    graph: [
      { suiteId: "a", dependsOn: [] },
      { suiteId: "b", dependsOn: [] },
      { suiteId: "c", dependsOn: ["a", "b"] },
    ],
  };
  const output = await executeGraph(plan, { a: async () => {}, b: async () => {}, c: async () => {} });
  assert.deepEqual(
    output.map((result) => result.suiteId),
    ["a", "b", "c"],
  );
  assert.throws(
    () => validateExecutionGraph({ selected: [{ suiteId: "a" }], graph: [{ suiteId: "a", dependsOn: ["a"] }] }),
    /cycle/i,
  );
  assert.equal(compatibilityFor("release.full").mode, "EMERGENCY_SERIAL");
});

test("governed adapters use fixed argument arrays and retain bounded receipts", async () => {
  const { base, run } = await fixture();
  try {
    assert.throws(() => resolveAdapter("policy", ["; Write-Host owned"]), /does not accept/i);
    assert.throws(() => resolveVitestAdapter(["../outside.test.ts"]), /repository-relative/i);
    const bridgewatch = resolveVitestAdapter(["bridgewatch/test/sounding-line.test.ts"]);
    assert.equal(bridgewatch.workingDirectory, "bridgewatch");
    assert.deepEqual(bridgewatch.command.slice(1, 3), ["../node_modules/vitest/vitest.mjs", "run"]);
    assert.deepEqual(bridgewatch.command.slice(-1), ["test/sounding-line.test.ts"]);
    const result = await executeProductAdapter(run, resolveAdapter("policy"), { cwd: process.cwd() });
    assert.equal(result.status, "PASS");
    assert.match(await readFile(path.join(run.root, "logs", "adapter-policy.log"), "utf8"), /policyDigest/);
  } finally {
    await cleanupRuntime(run);
    await dispose(base);
  }
});

test("PID reuse is quarantined unless every process identity proof matches", () => {
  const owned = {
    pid: 42,
    startedAt: "start-a",
    hostBootId: "boot-a",
    controllerToken: "controller-a",
    commandFingerprint: "command-a",
  };
  assert.equal(classifyProcessOwnership(owned, { ...owned }), "OWNED");
  assert.equal(classifyProcessOwnership(owned, { ...owned, startedAt: "start-b" }), "QUARANTINED");
  assert.equal(classifyProcessOwnership(owned, { ...owned, hostBootId: "boot-b" }), "QUARANTINED");
  assert.equal(classifyProcessOwnership(owned, { ...owned, controllerToken: "controller-b" }), "QUARANTINED");
  assert.equal(classifyProcessOwnership(owned, { ...owned, commandFingerprint: "command-b" }), "QUARANTINED");
});
