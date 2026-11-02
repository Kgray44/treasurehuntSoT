import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  observePreparationConsumerContext,
  retainPreparationConsumerFrame,
  PREPARATION_CONSUMER_READERS,
  PREPARATION_CONSUMER_WORKFLOW,
} from "../../scripts/sounding-line/preparation-consumer-shadow.mjs";
const repository = fileURLToPath(new URL("../..", import.meta.url));
const environment = () => ({
  GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
  GITHUB_REPOSITORY_ID: "1303074266",
  GITHUB_ACTOR: "Kgray44",
  GITHUB_ACTOR_ID: "64373011",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_JOB: "consumer-shadow",
  GITHUB_SHA: "a".repeat(40),
  INPUT_BASE_SHA: "a".repeat(40),
  GITHUB_WORKFLOW_SHA: "a".repeat(40),
  GITHUB_WORKFLOW_REF: `Kgray44/treasurehuntSoT/${PREPARATION_CONSUMER_WORKFLOW}@refs/heads/main`,
  GITHUB_RUN_ID: "100",
  INPUT_PRODUCER_RUN_ID: "99",
});
test("consumer original frames are exclusive and descriptor/readback verified without granting provider authority", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-frame-"));
  t.after(() => {
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  });
  const filename = path.join(root, "original.bin"),
    bytes = Buffer.from([0, 255, 1, 128]);
  const frame = retainPreparationConsumerFrame(filename, bytes);
  assert.equal(frame.bytes, bytes.length);
  assert.equal(frame.completeReadback, true);
  assert.deepEqual(fs.readFileSync(filename), bytes);
  assert.throws(() => retainPreparationConsumerFrame(filename, bytes), /EEXIST/u);
  const write = fs.writeSync,
    close = fs.closeSync,
    primary = Error("original writer failure"),
    secondary = Error("original close failure");
  fs.writeSync = () => {
    throw primary;
  };
  fs.closeSync = (fd) => {
    close(fd);
    throw secondary;
  };
  try {
    assert.throws(
      () => retainPreparationConsumerFrame(path.join(root, "failed.bin"), bytes),
      (error) => error instanceof AggregateError && error.errors[0] === primary && error.errors[1] === secondary,
    );
  } finally {
    fs.writeSync = write;
    fs.closeSync = close;
  }
  assert(fs.existsSync(path.join(root, "failed.bin")));
});
test("native consumer declared context is owner/main/exact-source/first-attempt only and supplies no authority", () => {
  const value = observePreparationConsumerContext(environment());
  assert.equal(value.producerRunId, 99);
  assert.equal(value.reuseAuthorized, false);
  assert.equal(value.certificate, "NOT_ISSUED");
  assert(Object.isFrozen(value));
  for (const change of [
    { GITHUB_REPOSITORY_ID: "1" },
    { GITHUB_ACTOR: "different-owner" },
    { GITHUB_ACTOR_ID: "1" },
    { GITHUB_REF: "refs/heads/candidate" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_WORKFLOW_SHA: "b".repeat(40) },
    { GITHUB_WORKFLOW_REF: "other-workflow" },
    { INPUT_BASE_SHA: "b".repeat(40) },
    { INPUT_PRODUCER_RUN_ID: "100" },
    { INPUT_PRODUCER_RUN_ID: "01" },
    { GITHUB_RUN_ID: "bad" },
    { GITHUB_JOB: "final-check" },
  ])
    assert.throws(() => observePreparationConsumerContext({ ...environment(), ...change }));
});
test("native consumer imports only its exact selected source closure and invokes no fresh or cached client", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-consumer-closure-"));
  t.after(() => {
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  });
  assert.equal(new Set(PREPARATION_CONSUMER_READERS).size, PREPARATION_CONSUMER_READERS.length);
  for (const file of PREPARATION_CONSUMER_READERS) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repository, file), target);
  }
  const count = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const m=await import('./scripts/sounding-line/preparation-consumer-shadow.mjs');console.log(m.PREPARATION_CONSUMER_READERS.length)",
    ],
    { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 65536 },
  );
  assert.equal(Number(count.trim()), PREPARATION_CONSUMER_READERS.length);
  const workflow = fs.readFileSync(path.join(repository, PREPARATION_CONSUMER_WORKFLOW), "utf8");
  const match = /sparse-checkout: \|\r?\n((?: {12}\/[^\r\n]+\r?\n)+)/u.exec(workflow);
  assert(match);
  assert.deepEqual(
    match[1]
      .trim()
      .split(/\r?\n/u)
      .map((row) => row.trim().slice(1))
      .sort(),
    [...PREPARATION_CONSUMER_READERS].sort(),
  );
  assert(!/npm ci|prisma generate|continue-on-error|permissions:\s*write/u.test(workflow));
  assert.match(workflow, /contents: read\n  actions: read/u);
  assert.match(workflow, /timeout-minutes: 5/u);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/u);
  assert.match(workflow, /if: always\(\)/u);
});
