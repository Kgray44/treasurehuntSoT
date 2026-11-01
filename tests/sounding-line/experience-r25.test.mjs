import "./fixtures/historical-reader-blobs.mjs";
import assert from "node:assert/strict";
import nodeTest from "node:test";
import { historicalAdmissionBinding } from "./fixtures/historical-admission-binding.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURRENT_R25 as r,
  validateR25Record,
  validateR25Registry,
  r25OriginalRecord,
  r25HistoricalPlan,
  validateR25ReviewedIdentity,
  r25Adoption,
  validateR25SpentOrdinary,
} from "../../scripts/sounding-line/experience-current-r25.mjs";
import { CURRENT_R24 } from "../../scripts/sounding-line/experience-current-r24.mjs";
import { currentAdmissionBinding } from "../../scripts/sounding-line/experience-current-admission.mjs";
import {
  selectTrustedExceptions,
  reserveExceptionStage,
  historicalExceptionContext,
  trustedExceptions,
  validateCampaignHistoryInventory,
} from "../../scripts/sounding-line/experience-exception.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
function test(name, body) {
  return nodeTest(name, (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse(r.ownerApproval.approvedAtUtc) });
    return body(t);
  });
}
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const registry = JSON.parse(git("show", `${r.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`));
const old = registry.exceptions.at(-1),
  oldException = historicalAdmissionBinding(old);
const evidence = JSON.parse(
  git("show", `${r.frozenReferenceSha}:Development_Docs/Testing/Product_Experience/candidate-review.json`),
);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
nodeTest("historical predecessor fixture restores the exact ambient Date after success and denial", () => {
  const ambientDate = Object.getOwnPropertyDescriptor(globalThis, "Date");
  assert.doesNotThrow(() => historicalAdmissionBinding(old));
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "Date"), ambientDate);
  const invalid = structuredClone(old);
  invalid.id = "invalid-historical-fixture";
  assert.throws(() => historicalAdmissionBinding(invalid), /PRODUCT_EXPERIENCE_/u);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "Date"), ambientDate);
});
export function record() {
  const value = structuredClone(old),
    a = value.currentSourceAdmission;
  Object.assign(value, {
    version: 25,
    id: r.id,
    ownerApproval: r.ownerApproval,
    custody: { namespace: `sounding-line-exceptions/${r.id}` },
    predecessor: r.failedOrdinary,
    frozenReferenceSha: r.frozenReferenceSha,
  });
  Object.assign(a, {
    protectedBaseAncestorSha: r.protectedBaseAncestorSha,
    sourceDigest: "f".repeat(64),
    historicalRuns: [...a.historicalRuns, r.addedRun],
    protectedOverlay: [
      {
        path: "scripts/sounding-line/experience-current-r25.mjs",
        oldMode: null,
        oldBlob: null,
        newMode: "100644",
        newBlob: "a".repeat(40),
        candidateMode: "100644",
        candidateBlob: "a".repeat(40),
      },
    ],
    historyLedger: { path: r.proofDirectory + "/historical-ledger.json", sha256: "a".repeat(64) },
    disposition: { path: r.proofDirectory + "/causal-disposition.md", sha256: "b".repeat(64) },
    observation: { ...a.observation, id: r.observationId },
    retainedAdmission: {
      kind: "EXACT_SPENT_R24_ADMISSION_1",
      id: CURRENT_R24.id,
      recordDigest: r.previousRecordDigest,
      baseSha: r.protectedBaseAncestorSha,
      candidateSha: r.frozenReferenceSha,
      sourceDigest: r.failedOrdinary.sourceDigest,
      exception: structuredClone(oldException),
    },
    precommandRecovery: r.precommandRecovery,
  });
  return value;
}
function plan(value = record()) {
  return {
    applicable: true,
    baseSha: r.protectedBaseAncestorSha,
    candidateSha: r.frozenReferenceSha,
    sourceDigest: value.currentSourceAdmission.sourceDigest,
    contractDigest: value.contractDigest,
    contractIds: value.contractIds,
    contextCount: 38,
    paired: { browserContexts: 6 },
    exception: currentAdmissionBinding(value),
  };
}
test("R25 preserves the entire spent R24 admission and gives only one new finite ordinary sequence", () => {
  const value = record(),
    full = { ...registry, exceptions: [...registry.exceptions, value] };
  validateR25Record(value);
  assert.equal(validateR25Registry(full).id, r.id);
  assert.deepEqual(
    selectTrustedExceptions(full.exceptions).map((value) => value.id),
    [r.id],
  );
  assert.equal(hash(r25OriginalRecord(value)), r.previousRecordDigest);
  assert.deepEqual(value.currentSourceAdmission.caps, { capture: 0, review: 0, ordinary: 1, technical: 1, replay: 1 });
  assert.equal(value.currentSourceAdmission.historicalRuns.length, 29);
  assert.equal(value.currentSourceAdmission.historicalRuns.at(-1).conclusion, "cancelled");
  assert.equal(value.predecessor.completedWholeObligations, 6);
  assert.equal(value.predecessor.partialBrowser.wholeObligationPassed, false);
});
test("R25 rejects resets, historical substitutions, changed budgets and unreviewed overlays", () => {
  for (const mutate of [
    (value) => value.immutableHistory.pop(),
    (value) => value.contractIds.pop(),
    (value) => value.requiredTechnicalBrowserTests.pop(),
    (value) => (value.expiresAt = "2027-01-01T00:00:00Z"),
    (value) => (value.currentSourceAdmission.caps.capture = 1),
    (value) => (value.currentSourceAdmission.caps.review = 1),
    (value) => (value.currentSourceAdmission.caps.ordinary = 2),
    (value) => value.currentSourceAdmission.historicalRuns.pop(),
    (value) => (value.currentSourceAdmission.retainedAdmission.exception.recordDigest = "0".repeat(64)),
    (value) => (value.currentSourceAdmission.retainedEvidence.sourceDigest = "0".repeat(64)),
    (value) => (value.currentSourceAdmission.sourceDigest = r.failedOrdinary.sourceDigest),
    (value) => (value.currentSourceAdmission.precommandRecovery = { ...r.precommandRecovery, jobLimitMinutes: 91 }),
    (value) => (value.currentSourceAdmission.admitPartialBrowser = true),
    (value) => value.currentSourceAdmission.publicationFiles.push("new-evidence.json"),
    (value) => (value.currentSourceAdmission.protectedOverlay[0].path = "src/product.ts"),
    (value) => (value.predecessor = { ...r.failedOrdinary, conclusion: "success" }),
    (value) => (value.predecessor = { ...r.failedOrdinary, qualifyCommit: "a".repeat(40) }),
    (value) => {
      const { campaignEpoch, ...withoutEpoch } = value.predecessor;
      assert.equal(campaignEpoch, "2026-10-15T13:54Z");
      value.predecessor = withoutEpoch;
    },
    (value) => (value.ownerApproval = { ...r.ownerApproval, humanMessageId: "foreign" }),
  ]) {
    const value = record();
    mutate(value);
    assert.throws(() => validateR25Record(value), /PRODUCT_EXPERIENCE_EXCEPTION_/u);
  }
});

test("R25 retains the original campaign epoch required by the full history entry point", () => {
  const value = record();
  assert.equal(value.predecessor.campaignEpoch, old.predecessor.campaignEpoch);
  assert.equal(new Date(value.predecessor.campaignEpoch).toISOString(), "2026-10-15T13:54:00.000Z");
});

test("R25 extends only the authorized Crossdeck final-check ceiling to 90 minutes", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  const jobs = workflow.split(/\n  (?=[a-z][a-z-]*:\n)/u);
  const final = jobs.find((job) => job.startsWith("final-check:\n"));
  assert(final);
  const timeout = final.match(/\n    timeout-minutes: ([^\n]+)/u)?.[1];
  const pr776Allowance = "(github.event.pull_request.number == 776 || inputs.pr_number == '776') && 120 || ";
  assert(timeout?.includes(pr776Allowance));
  assert.equal(
    timeout.replace(pr776Allowance, ""),
    "${{ (github.event.pull_request.number == 721 || inputs.pr_number == '721') && 90 || 45 }}",
  );
  assert.equal(jobs.filter((job) => job.includes("&& 90 || 45")).length, 1);
  assert.equal(record().currentSourceAdmission.precommandRecovery.jobLimitMinutes, 90);
  assert.equal(record().currentSourceAdmission.precommandRecovery.otherPullRequestsJobLimitMinutes, 45);
  // This historical admission freezes its original candidate engines, not unrelated later repairs.
  for (const file of [
    "scripts/sounding-line/ordinary.mjs",
    "scripts/sounding-line/authenticated-completed-evidence.mjs",
    "scripts/sounding-line/verification-diagnostics.mjs",
  ])
    assert.equal(git("show", `${r.frozenReferenceSha}:${file}`), git("show", `${r.protectedBaseAncestorSha}:${file}`));
});

test("installed R25 reader denies missing, retired, invalid and expired rows without falling back", (t) => {
  const owned = mkdtempSync(path.join(tmpdir(), "sl-r25-no-fallback-"));
  t.after(() => rmSync(owned, { recursive: true, force: true }));
  const command = (...args) =>
    execFileSync("git", args, { cwd: owned, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  command("init", "--quiet");
  command("config", "user.name", "Inert R25 source fixture");
  command("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(owned, "testing"));
  mkdirSync(path.join(owned, "scripts/sounding-line"), { recursive: true });
  writeFileSync(path.join(owned, "scripts/sounding-line/experience-current-r25.mjs"), "// inert sentinel\n");
  const write = (value) => {
    writeFileSync(path.join(owned, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    command("add", ".");
    command("commit", "--quiet", "-m", "inert R25 registry fixture");
    return command("rev-parse", "HEAD");
  };
  const full = { ...registry, exceptions: [...registry.exceptions, record()] };
  assert.equal(trustedExceptions(owned, write(full))[0].id, r.id);
  for (const mutate of [
    (value) => value.exceptions.pop(),
    (value) => {
      value.exceptions[24].status = "RETIRED";
    },
    (value) => {
      value.exceptions[24].id = "WRONG-R25";
    },
    (value) => {
      value.exceptions[24].currentSourceAdmission.caps.capture = 1;
    },
    (value) => {
      value.exceptions[24].expiresAt = "2026-10-20T00:00:00Z";
    },
  ]) {
    const value = structuredClone(full);
    mutate(value);
    assert.throws(() => trustedExceptions(owned, write(value)), /PRODUCT_EXPERIENCE_EXCEPTION_/u);
  }
  const final = write(full);
  t.mock.timers.setTime(Date.parse(full.exceptions[24].expiresAt) + 1);
  assert.throws(() => trustedExceptions(owned, final), /PRODUCT_EXPERIENCE_CURRENT_ADMISSION_RECORD_INVALID/u);
});

test("R25 history inventory denies unlisted same-second and wrong-PR campaign runs", async () => {
  const value = record();
  const current = { runId: 39999999990, workflowId: r.addedRun.workflowId, createdAt: "2026-10-21T12:00:00Z" };
  const native = {
    id: current.runId,
    workflow_id: current.workflowId,
    path: ".github/workflows/sounding-line-ordinary.yml",
    head_repository: { full_name: value.repository },
    actor: { login: value.ownerApproval.actor },
    triggering_actor: { login: value.ownerApproval.actor },
    run_attempt: 1,
    event: "pull_request_target",
    head_sha: r.frozenReferenceSha,
    head_branch: "inert-candidate",
    created_at: current.createdAt,
    display_title: `Sounding Line finite 1 ordinary 721 ${r.frozenReferenceSha} active`,
    status: "completed",
    conclusion: "success",
  };
  let recognized = 0;
  const options = {
    record: value,
    mode: "ordinary",
    run: current,
    preflight: false,
    predecessors: [],
    request: () => {
      throw Error("UNEXPECTED_API");
    },
    recognized: async (candidate) => {
      assert.equal(candidate, r.frozenReferenceSha);
      recognized++;
      return true;
    },
  };
  assert.equal(
    (await validateCampaignHistoryInventory({ ...options, all: new Map([[native.id, native]]) })).status,
    "PASS",
  );
  for (const id of [current.runId - 1, current.runId + 1])
    for (const pr of [721, 999])
      for (const mode of ["ordinary", "capture", "review", "verify"])
        for (const conclusion of ["success", "failure", "cancelled"]) {
          const extra = {
            ...native,
            id,
            conclusion,
            display_title: `Sounding Line finite 1 ${mode} ${pr} ${r.frozenReferenceSha} active`,
          };
          await assert.rejects(
            validateCampaignHistoryInventory({
              ...options,
              all: new Map([
                [native.id, native],
                [id, extra],
              ]),
            }),
            /R25_UNLISTED_CAMPAIGN_RUN/u,
          );
        }
  assert.equal(recognized, 24);
});
test("R25 historical review keeps original R23 identities and adds an explicit current admission chain", () => {
  const current = plan(),
    historical = r25HistoricalPlan(current);
  validateR25ReviewedIdentity(current, evidence);
  assert.equal(historical.sourceDigest, CURRENT_R24.retained.sourceDigest);
  assert.deepEqual(historical.exception, evidence.exception);
  const adopted = r25Adoption(current).reviewedEvidenceAdoption;
  assert.equal(adopted.currentRecordDigest, current.exception.recordDigest);
  assert.equal(adopted.maintenancePredecessor.recordDigest, r.previousRecordDigest);
  assert.equal(adopted.maintenancePredecessor.ordinaryRunId, 39580199268);
  assert.equal(adopted.sourceDigest, CURRENT_R24.retained.sourceDigest);
  const changed = structuredClone(evidence);
  changed.sourceDigest = current.sourceDigest;
  assert.throws(() => validateR25ReviewedIdentity(current, changed), /ORIGINAL_EVIDENCE_CHANGED/u);
  const context = historicalExceptionContext({
    root,
    plan: current,
    request: () => {
      throw Error("UNEXPECTED_API");
    },
  });
  for (const slot of ["qualify", "qualified", "review13"])
    assert.throws(() => context.store.read(slot), /HISTORICAL_SLOT_FORBIDDEN/u);
  assert.throws(() => context.store.create(), /HISTORICAL_WRITE_FORBIDDEN/u);
});
test("R25 capture, review, verify and consumed ordinary reservation cannot create custody", async () => {
  const value = record(),
    current = plan(value);
  let creates = 0;
  const store = {
    read: async (slot) => (slot === "qualify" ? { consumed: true } : null),
    create: async () => {
      creates++;
    },
  };
  for (const mode of ["capture", "review", "verify", "source-stage"])
    await assert.rejects(reserveExceptionStage({ root, record: value, plan: current, mode, store }), /ORDINARY_ONLY/u);
  await assert.rejects(
    reserveExceptionStage({ root, record: value, plan: current, mode: "ordinary", store }),
    /QUALIFICATION_ALREADY_CONSUMED/u,
  );
  assert.equal(creates, 0);
});
function spentFixture() {
  const native = r.addedRun;
  const run = {
    id: native.id,
    run_attempt: native.runAttempt,
    workflow_id: native.workflowId,
    event: native.event,
    head_sha: native.headSha,
    head_branch: native.headBranch,
    actor: { login: native.actor },
    triggering_actor: { login: native.triggeringActor },
    repository: { full_name: native.repository },
    head_repository: { full_name: native.repository },
    status: native.status,
    conclusion: native.conclusion,
    created_at: native.createdAt,
    display_title: native.displayTitle,
    check_suite_id: native.checkSuiteId,
  };
  const qualifier = {
    ...JSON.parse(git("show", `${r.failedOrdinary.qualifyCommit}:.sounding-line-exception-reservation.json`)),
    commitSha: r.failedOrdinary.qualifyCommit,
  };
  const pin = r.failedOrdinary.artifact,
    artifact = {
      id: pin.id,
      name: pin.name,
      expired: false,
      size_in_bytes: pin.bytes,
      digest: `sha256:${pin.sha256}`,
      workflow_run: { id: run.id },
    };
  const state = {
    run,
    qualifier,
    extraSlot: null,
    jobs: { total_count: 4, jobs: structuredClone(r.failedOrdinary.jobs) },
    artifacts: { total_count: 1, artifacts: [artifact] },
    artifact,
  };
  state.store = {
    read: async (slot) => (slot === "qualify" ? state.qualifier : slot === state.extraSlot ? {} : null),
    create: () => {
      throw Error("UNEXPECTED_CREATE");
    },
  };
  state.request = async (endpoint) => {
    if (endpoint === `actions/runs/${run.id}`) return state.run;
    if (endpoint.endsWith("/attempts/1/jobs?per_page=100")) return state.jobs;
    if (endpoint.endsWith("/artifacts?per_page=100")) return state.artifacts;
    if (endpoint === `actions/artifacts/${pin.id}`) return state.artifact;
    throw Error("UNEXPECTED_ENDPOINT");
  };
  return state;
}
test("R25 requires the exact cancelled run, qualifier payload and retained checkpoint artifact", async () => {
  const state = spentFixture();
  assert.equal((await validateR25SpentOrdinary({ record: record(), ...state })).id, r.addedRun.id);
  for (const mutate of [
    (state) => (state.run.conclusion = "success"),
    (state) => (state.qualifier.commitSha = "a".repeat(40)),
    (state) => (state.qualifier.binding.exception.recordDigest = "b".repeat(64)),
    (state) => (state.extraSlot = "qualified"),
    (state) => (state.extraSlot = "capture"),
    (state) => (state.jobs.jobs[0].conclusion = "failure"),
    (state) => (state.artifacts.total_count = 0),
    (state) => (state.artifact.digest = "sha256:" + "c".repeat(64)),
  ]) {
    const fixture = spentFixture();
    mutate(fixture);
    await assert.rejects(
      validateR25SpentOrdinary({ record: record(), ...fixture }),
      /PRODUCT_EXPERIENCE_EXCEPTION_R25_/u,
    );
  }
});
