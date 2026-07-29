import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const cli = "scripts/sounding-line/cli.mjs";
const run = async (...args) => JSON.parse((await execFileAsync(node, [cli, ...args], { cwd: process.cwd() })).stdout);

test("policy validates with referential integrity", async () => {
  const result = await run("validate-policy");
  assert.equal(result.ok, true);
  assert.equal(result.counts.validationDebt, 3);
});

test("inventory is read-only and recognizes current test families", async () => {
  const result = await run("inventory");
  assert.equal(result.readOnly, true);
  assert.ok(result.files.vitest.length > 0);
  assert.ok(result.files.playwright.length > 0);
  assert.ok(result.resources.lockFiles.includes("scripts/test-all.ps1"));
});

test("plans are deterministic and unknown impact broadens", async () => {
  const first = await run("plan", "unknown-area/new-file.ts");
  const second = await run("plan", "unknown-area/new-file.ts");
  assert.equal(first.digest, second.digest);
  assert.equal(first.nonAuthoritative, true);
  assert.equal(first.execution, "forbidden");
  assert.equal(first.uncertaintyBroadened, true);
  assert.equal(first.selected.length, 10);
});

test("release plans remain comprehensive", async () => {
  const result = await run("plan", "--scope=release");
  assert.equal(result.omitted.length, 0);
  assert.equal(result.selected.length, 10);
});
