import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { observeNativeEvidenceContext } from "../../scripts/sounding-line/native-evidence-context.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main";
const base = "a".repeat(40),
  candidate = "b".repeat(40);
const owner = { id: 64373011, login: "Kgray44" };
const repo = { id: 1303074266, full_name: "Kgray44/treasurehuntSoT", owner };
function fixture(dispatch = false) {
  return {
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: repo.full_name,
      GITHUB_REPOSITORY_ID: String(repo.id),
      GITHUB_REF: "refs/heads/main",
      GITHUB_WORKFLOW_REF: workflow,
      GITHUB_SHA: base,
      GITHUB_WORKFLOW_SHA: base,
      GITHUB_ACTOR: owner.login,
      GITHUB_TRIGGERING_ACTOR: owner.login,
      GITHUB_ACTOR_ID: String(owner.id),
      GITHUB_RUN_ID: "101",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_JOB: dispatch ? "experience-preparation" : "final-check",
      GITHUB_EVENT_NAME: dispatch ? "workflow_dispatch" : "pull_request_target",
    },
    event: JSON.parse(
      JSON.stringify({
        repository: repo,
        sender: owner,
        ref: "refs/heads/main",
        inputs: {
          base_sha: base,
          candidate_sha: candidate,
          pr_number: "819",
          experience_mode: "capture",
          experience_diagnostic: "false",
        },
        pull_request: {
          number: 819,
          draft: false,
          base: { ref: "main", sha: base, repo },
          head: { sha: candidate, repo },
        },
        privateUnselectedValue: "DO_NOT_EMIT_PRIVATE_EVENT_DATA",
      }),
    ),
  };
}
const invalid = /SOUNDING_LINE_NATIVE_CONTEXT_/u;

test("installed-main shadow diagnostics are explicitly marked and cannot be ordinary candidate observations", () => {
  const input = fixture(true);
  input.event.inputs.experience_diagnostic = true;
  input.event.inputs.incremental_evidence_shadow = true;
  input.event.inputs.candidate_sha = base;
  const context = observeNativeEvidenceContext(input);
  assert.equal(context.mode, "capture-diagnostic");
  assert.equal(context.candidateSha, context.baseSha);
  assert.equal(context.qualification, false);
  assert.equal(context.reuseAuthorized, false);
  for (const change of [
    (value) => {
      value.event.inputs.candidate_sha = candidate;
    },
    (value) => {
      value.event.inputs.incremental_evidence_shadow = false;
    },
    (value) => {
      value.environment.GITHUB_JOB = "final-check";
      value.event.inputs.experience_mode = "ordinary";
    },
  ]) {
    const altered = structuredClone(input);
    change(altered);
    assert.throws(() => observeNativeEvidenceContext(altered), invalid);
  }
});
test("original native event context is data-only and exposes only source and owner identifiers", () => {
  for (const dispatch of [false, true]) {
    const input = fixture(dispatch),
      observed = observeNativeEvidenceContext(input);
    assert.equal(observed.baseSha, base);
    assert.equal(observed.candidateSha, candidate);
    assert.equal(observed.prNumber, 819);
    assert.equal(observed.mode, dispatch ? "capture" : "ordinary");
    assert.equal(observed.qualification, false);
    assert.equal(observed.reuseAuthorized, false);
    assert.equal(observed.authentication, "OBSERVED_EVENT_DATA_NOT_AUTHENTICATED_BY_SERIALIZATION");
    assert.equal(authenticatedCompletedReceipt(observed, {}), null);
    assert(!JSON.stringify(observed).includes("DO_NOT_EMIT_PRIVATE_EVENT_DATA"));
    assert(Object.isFrozen(observed));
  }
  const input = fixture(true);
  input.environment.GITHUB_JOB = "final-check";
  input.event.inputs.experience_mode = "ordinary";
  assert.equal(observeNativeEvidenceContext(input).mode, "ordinary");
});
test("spoofed workflow, actor, fork, source, scope and input injection never become an observation", () => {
  for (const change of [
    (x) => (x.environment.GITHUB_ACTIONS = "false"),
    (x) => (x.environment.GITHUB_REPOSITORY_ID = "1"),
    (x) => (x.environment.GITHUB_REF = "refs/heads/other"),
    (x) => (x.environment.GITHUB_WORKFLOW_REF = workflow.replace("main", "other")),
    (x) => (x.environment.GITHUB_WORKFLOW_SHA = candidate),
    (x) => (x.environment.GITHUB_ACTOR = "other"),
    (x) => (x.environment.GITHUB_TRIGGERING_ACTOR = "other"),
    (x) => (x.environment.GITHUB_ACTOR_ID = "1"),
    (x) => (x.environment.GITHUB_JOB = "mainline-decision"),
    (x) => (x.environment.GITHUB_RUN_ID = "0101"),
    (x) => (x.environment.GITHUB_RUN_ATTEMPT = "0"),
    (x) => (x.environment.GITHUB_EVENT_NAME = "push"),
    (x) => x.event.sender.id++,
    (x) => x.event.repository.id++,
    (x) => (x.event.repository.owner.login = "other"),
    (x) => (x.event.pull_request.draft = true),
    (x) => (x.event.pull_request.number = 776),
    (x) => (x.event.pull_request.number = 721),
    (x) => (x.event.pull_request.number = 805),
    (x) => (x.event.pull_request.number = "819"),
    (x) => (x.event.pull_request.base.sha = candidate),
    (x) => (x.event.pull_request.head.sha = "invalid"),
    (x) => x.event.pull_request.head.repo.id++,
  ]) {
    const input = fixture();
    change(input);
    assert.throws(() => observeNativeEvidenceContext(input), invalid);
  }
  for (const change of [
    (x) => (x.event.ref = "other"),
    (x) => (x.event.inputs.experience_diagnostic = true),
    (x) => (x.event.inputs.experience_mode = "review"),
    (x) => (x.event.inputs.pr_number = '819"; echo INJECTED'),
    (x) => (x.event.inputs.pr_number = "0819"),
    (x) => (x.event.inputs.pr_number = "776"),
    (x) => (x.event.inputs.pr_number = "805"),
    (x) => (x.event.inputs.base_sha = candidate),
  ]) {
    const input = fixture(true);
    change(input);
    assert.throws(() => observeNativeEvidenceContext(input), invalid);
  }
});
test("new shadow steps precede candidate checkout and cannot change protected Mainline Decision authority", () => {
  const source = fs.readFileSync(path.join(root, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  assert.equal(
    createHash("sha256")
      .update(source.slice(source.indexOf("  mainline-decision:")))
      .digest("hex"),
    "0cbbb62e9d8c2952cc92d7e2b0a9eecb64ff235573f7e61608c29ed888df4faa",
  );
  assert.equal((source.match(/name: Observe immutable original evidence context/gu) ?? []).length, 2);
  for (const [begin, finish] of [
    ["  experience-preparation:", "  final-check:"],
    ["  final-check:", "  mainline-decision:"],
  ]) {
    const job = source.slice(source.indexOf(begin), source.indexOf(finish));
    const observed = job.indexOf("      - name: Observe immutable original evidence context");
    assert(
      job.indexOf("path: authority") < observed && observed < job.indexOf("name: Checkout exact ordinary ancestry"),
    );
    const step = job.slice(observed, job.indexOf("      - ", observed + 8));
    assert.doesNotMatch(step, /continue-on-error/u);
    assert.match(step, /timeout-minutes: 1/u);
    assert.match(step, /working-directory: authority/u);
    assert.match(step, /run: node scripts\/sounding-line\/native-evidence-context\.mjs/u);
    assert(step.includes("721") && step.includes("776") && step.includes("805"));
    assert(!/env:|outputs:|GH_TOKEN|GITHUB_OUTPUT/u.test(step));
  }
  const custody = source.slice(source.indexOf("  campaign-custody:"), source.indexOf("  experience-preparation:"));
  assert(!custody.includes("Observe immutable original evidence context"));
});
test("CLI preserves failures as unavailable shadow data and never prints private event bytes", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-context-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const eventPath = path.join(directory, "event.json"),
    input = fixture();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  input.environment.GITHUB_SHA = head;
  input.environment.GITHUB_WORKFLOW_SHA = head;
  input.event.pull_request.base.sha = head;
  fs.writeFileSync(eventPath, JSON.stringify(input.event));
  const run = (env = {}) =>
    spawnSync(process.execPath, [path.join(root, "scripts/sounding-line/native-evidence-context.mjs")], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true,
      env: { ...process.env, ...input.environment, GITHUB_EVENT_PATH: eventPath, ...env },
    });
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const context = JSON.parse(result.stdout.replace(/^SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 /u, ""));
  assert.equal(context.kind, "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW");
  assert.equal(context.baseSha, head);
  assert(!result.stdout.includes("DO_NOT_EMIT_PRIVATE_EVENT_DATA"));
  const output = path.join(directory, "should-not-be-created");
  const redirected = run({ GIT_DIR: path.join(directory, "PRIVATE_GIT_DIR_DO_NOT_EMIT"), GITHUB_OUTPUT: output });
  assert.equal(redirected.status, 0);
  assert.equal(redirected.stderr, "");
  assert.equal(
    JSON.parse(redirected.stdout.replace(/^SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 /u, "")).kind,
    "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW",
  );
  assert(!fs.existsSync(output));
  fs.writeFileSync(eventPath, "PRIVATE_BAD_JSON_DO_NOT_EMIT");
  for (const attempt of [run(), run({ GITHUB_EVENT_PATH: path.join(directory, "PRIVATE_PATH_DO_NOT_EMIT") })]) {
    assert.equal(attempt.status, 0);
    assert.equal(attempt.stderr, "");
    assert(!attempt.stdout.includes("DO_NOT_EMIT"));
    const observed = JSON.parse(attempt.stdout.replace(/^SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 /u, ""));
    assert.equal(observed.kind, "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_UNAVAILABLE");
    assert.equal(observed.qualification, false);
    assert.equal(observed.reuseAuthorized, false);
  }
  fs.writeFileSync(eventPath, Buffer.alloc(2 * 1024 * 1024 + 1, 97));
  const bounded = run();
  assert.equal(bounded.status, 0);
  assert.equal(bounded.stderr, "");
  assert.equal(
    JSON.parse(bounded.stdout.replace(/^SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 /u, "")).code,
    "SOUNDING_LINE_NATIVE_CONTEXT_EVENT_FILE",
  );
});
