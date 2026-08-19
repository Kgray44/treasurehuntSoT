import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const cli = "scripts/sounding-line/cli.mjs";
const run = async (...args) => JSON.parse((await execFileAsync(node, [cli, ...args], { cwd: process.cwd() })).stdout);

test("restored Sounding Line runtime layers do not perturb local plan source identity", async () => {
  const runtimeProbe = path.join(
    process.cwd(),
    "sounding-line-sqlite-baseline",
    ".plan-digest-transient-probe",
  );
  const first = await run("plan", "unknown-area/new-file.ts");
  let second;
  try {
    await mkdir(path.dirname(runtimeProbe), { recursive: true });
    await writeFile(runtimeProbe, "transient runtime layer output\n", "utf8");
    second = await run("plan", "unknown-area/new-file.ts");
  } finally {
    await rm(runtimeProbe, { force: true });
  }
  assert.equal(first.digest, second.digest);
});
