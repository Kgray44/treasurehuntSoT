import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CURRENT_R24,
  validateR24Record,
  validateR24Registry,
  r24HistoricalPlan,
  r24OriginalRecord,
  validateR24ReviewedIdentity,
  validateR24Custody,
  r24Adoption,
} from "../../scripts/sounding-line/experience-current-r24.mjs";
import {
  currentAdmissionBinding,
  validateCurrentAdmissionEvidence,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import {
  validateCampaignHistoryInventory,
  historicalExceptionContext,
  reserveExceptionStage,
  selectTrustedExceptions,
} from "../../scripts/sounding-line/experience-exception.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url)),
  r = CURRENT_R24;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const registry = JSON.parse(git("show", `${r.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`)),
  old = registry.exceptions.at(-1);
const evidence = JSON.parse(
  git("show", `${r.frozenReferenceSha}:Development_Docs/Testing/Product_Experience/candidate-review.json`),
);
const hash = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function record() {
  const record = structuredClone(old),
    a = record.currentSourceAdmission;
  Object.assign(record, {
    version: 24,
    id: r.id,
    ownerApproval: r.ownerApproval,
    custody: { namespace: `sounding-line-exceptions/${r.id}` },
    predecessor: r.failedOrdinary,
    frozenReferenceSha: r.frozenReferenceSha,
  });
  Object.assign(a, {
    protectedBaseAncestorSha: r.protectedBaseAncestorSha,
    sourceDigest: "f".repeat(64),
    cumulativeHistory: r.cumulativeHistory,
    caps: { capture: 0, review: 0, ordinary: 1, technical: 1, replay: 1 },
    historicalRuns: [...a.historicalRuns, ...r.addedRuns],
    retainedEvidence: { ...r.retained, historicalException: evidence.exception },
    checkoutRecovery: r.checkoutRecovery,
    observation: { ...a.observation, id: r.observationId },
    historyLedger: { path: r.proofDirectory + "/historical-ledger.json", sha256: "a".repeat(64) },
    disposition: { path: r.proofDirectory + "/causal-disposition.md", sha256: "b".repeat(64) },
    protectedOverlay: [
      {
        path: "scripts/sounding-line/experience-current-r24.mjs",
        oldMode: null,
        oldBlob: null,
        newMode: "100644",
        newBlob: "a".repeat(40),
        candidateMode: "100644",
        candidateBlob: "a".repeat(40),
      },
    ],
  });
  return record;
}
function plan() {
  const v = record();
  return {
    applicable: true,
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: v.currentSourceAdmission.sourceDigest,
    contractDigest: v.contractDigest,
    contractIds: v.contractIds,
    contextCount: 38,
    paired: { browserContexts: 6 },
    exception: currentAdmissionBinding(v),
  };
}
test("R24 preserves the entire prior registry and installs only one ordinary entitlement", () => {
  const v = record(),
    full = { ...registry, exceptions: [...registry.exceptions, v] };
  validateR24Record(v);
  assert.equal(validateR24Registry(full).id, r.id);
  assert.deepEqual(
    selectTrustedExceptions(full.exceptions).map((x) => x.id),
    [r.id],
  );
  assert.deepEqual(v.currentSourceAdmission.caps, { capture: 0, review: 0, ordinary: 1, technical: 1, replay: 1 });
  assert.equal(hash(r24OriginalRecord(v)), r.previousRecordDigest);
  assert.equal(v.currentSourceAdmission.historicalRuns.length, 28);
  assert.equal(v.currentSourceAdmission.historicalRuns.at(-1).conclusion, "cancelled");
});
test("R24 rejects changed historical policy, original identities, counters, authority and finite caps", () => {
  for (const mutate of [
    (v) => v.immutableHistory.pop(),
    (v) => v.contractIds.pop(),
    (v) => v.requiredTechnicalBrowserTests.pop(),
    (v) => (v.expiresAt = "2027-01-01T00:00:00Z"),
    (v) => (v.ownerApproval = { ...v.ownerApproval, humanMessageId: "different" }),
    (v) => (v.currentSourceAdmission.caps.capture = 1),
    (v) => (v.currentSourceAdmission.caps.review = 1),
    (v) => (v.currentSourceAdmission.cumulativeHistory = { ...r.cumulativeHistory, completedIndependentReviews: 11 }),
    (v) => v.currentSourceAdmission.historicalRuns.pop(),
    (v) => (v.predecessor = { ...r.failedOrdinary, conclusion: "success" }),
    (v) =>
      (v.currentSourceAdmission.retainedEvidence = {
        ...v.currentSourceAdmission.retainedEvidence,
        sourceDigest: "0".repeat(64),
      }),
    (v) => (v.currentSourceAdmission.sourceDigest = r.retained.sourceDigest),
    (v) => (v.currentSourceAdmission.protectedOverlay[0].path = "src/app/page.tsx"),
  ]) {
    const v = record();
    mutate(v);
    assert.throws(() => validateR24Record(v), /PRODUCT_EXPERIENCE_R24/u);
  }
  const full = { ...registry, exceptions: [...registry.exceptions, record()] };
  full.exceptions[0] = { ...full.exceptions[0], status: "ACTIVE_CHANGED" };
  assert.throws(() => validateR24Registry(full), /PREFIX_CHANGED/u);
});
test("retained reviewed evidence keeps original R23 identity; automated replay requires R24", () => {
  const current = plan(),
    historical = r24HistoricalPlan(current);
  validateR24ReviewedIdentity(current, evidence);
  assert.equal(historical.sourceDigest, r.retained.sourceDigest);
  assert.equal(historical.baseSha, r.retained.baseSha);
  assert.equal(historical.exception.id, old.id);
  validateCurrentAdmissionEvidence(current, evidence, false);
  assert.throws(() => validateCurrentAdmissionEvidence(current, evidence, true), /EVIDENCE_BINDING_MISSING/u);
  assert.throws(
    () => validateR24ReviewedIdentity(current, { ...evidence, sourceDigest: current.sourceDigest }),
    /ORIGINAL_EVIDENCE_CHANGED/u,
  );
  assert.throws(
    () => validateR24ReviewedIdentity(current, { ...evidence, reviewArtifactId: 12324561776 }),
    /ORIGINAL_EVIDENCE_CHANGED/u,
  );
  const adoption = r24Adoption(current).reviewedEvidenceAdoption;
  assert.equal(adoption.currentSourceDigest, current.sourceDigest);
  assert.equal(adoption.sourceDigest, r.retained.sourceDigest);
  assert.equal(adoption.currentRecordDigest, current.exception.recordDigest);
});
test("historical R23 view permits exactly four reads, forbids writes and never falls back to qualification", async () => {
  const calls = [],
    current = { ...plan(), baseSha: r.protectedBaseAncestorSha };
  const context = historicalExceptionContext({
    root,
    plan: current,
    request: async (url, method = "GET") => {
      calls.push({ url, method });
      throw Error("NO_NETWORK_IN_NEGATIVE_TEST");
    },
  });
  for (const slot of ["qualify", "qualified", "review7", "capture2"])
    assert.throws(() => context.store.read(slot), /HISTORICAL_SLOT_FORBIDDEN/u);
  assert.throws(() => context.store.create("prepare", {}), /HISTORICAL_WRITE_FORBIDDEN/u);
  assert.equal(calls.length, 0);
  const values = Object.fromEntries(
    r.custody.map((pin) => [
      pin.slot,
      { ...JSON.parse(git("show", `${pin.commit}:.sounding-line-exception-reservation.json`)), commitSha: pin.commit },
    ]),
  );
  assert.deepEqual(
    Object.keys(await validateR24Custody({ record: old, store: { read: async (slot) => values[slot] } })),
    ["prepare", "capture", "review-submit", "review12"],
  );
  values.review12 = { ...values.review12, status: "FORGED" };
  await assert.rejects(
    validateR24Custody({ record: old, store: { read: async (slot) => values[slot] } }),
    /CUSTODY_PAYLOAD_CHANGED/u,
  );
});
test("capture, review and verify fail before any reservation or provider call", async () => {
  for (const mode of ["capture", "review", "verify"]) {
    let touched = false;
    await assert.rejects(
      reserveExceptionStage({
        record: record(),
        plan: plan(),
        mode,
        store: {
          read() {
            touched = true;
          },
          create() {
            touched = true;
          },
        },
        request() {
          touched = true;
        },
      }),
      /ORDINARY_ONLY/u,
    );
    assert.equal(touched, false);
  }
});
test("all four consumer checkout paths use the bounded protected helper and no wildcard candidate checkout", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  for (const name of ["campaign-custody", "experience-preparation", "final-check", "mainline-decision"]) {
    const job = workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z][a-z-]*:\n/u)[0];
    assert.match(
      job,
      /name: Checkout selected complete consumer history\n        if: \$\{\{ [^\n]*github.event.pull_request.number == 721 \|\| inputs.pr_number == '721'[^\n]*\}\}\n        timeout-minutes: 21/u,
    );
    assert.match(job, /node authority\/scripts\/sounding-line\/experience-selected-checkout.mjs/u);
    for (const block of job
      .split(/\n      - /u)
      .slice(1)
      .filter((x) => x.includes("uses: actions/checkout@v4"))) {
      assert.match(block, /timeout-minutes: 10/u);
      if (block.includes("path: candidate"))
        assert.match(block, /if: \$\{\{ [^\n]*!\(github.event.pull_request.number == 721/u);
    }
  }
});

test("R24 inventory denies every extra active campaign run before a permission write", async () => {
  const current = plan(),
    v = record(),
    run = { runId: 99000000000, createdAt: "2026-10-21T08:00:00Z", workflowId: 341545080 };
  const item = (id, mode = "ordinary", pr = 721, createdAt = run.createdAt) => ({
    id,
    workflow_id: run.workflowId,
    path: ".github/workflows/sounding-line-ordinary.yml",
    head_repository: { full_name: v.repository },
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    run_attempt: 1,
    event: "pull_request_target",
    head_sha: current.candidateSha,
    head_branch: "fixture",
    created_at: createdAt,
    status: "completed",
    conclusion: "success",
    display_title: `Sounding Line finite 1 ${mode} ${pr} ${current.candidateSha} active`,
  });
  for (const extra of [
    item(run.runId - 1, "capture", 721, "2026-10-21T07:59:59Z"),
    item(run.runId - 2, "review", 721, "2026-10-21T07:59:59Z"),
    item(run.runId + 1),
    item(run.runId + 2, "verify"),
    item(run.runId + 3, "ordinary", 999),
  ]) {
    let writes = 0,
      recognized = 0;
    const all = new Map([
      [run.runId, item(run.runId)],
      [extra.id, extra],
    ]);
    await assert.rejects(
      validateCampaignHistoryInventory({
        record: v,
        mode: "ordinary",
        run,
        preflight: false,
        predecessors: [],
        all,
        recognized: async () => {
          recognized++;
          return true;
        },
        request: async (_, method = "GET") => {
          if (method !== "GET") writes++;
          throw Error("UNEXPECTED_PROVIDER_REQUEST");
        },
      }),
      /R24_UNLISTED_CAMPAIGN_RUN/u,
    );
    assert.equal(writes, 0);
    if (extra.display_title.includes(" 999 ")) assert.equal(recognized, 1);
  }
  const draft = {
    ...item(run.runId + 4),
    conclusion: "skipped",
    display_title: `Sounding Line finite 1 ordinary 721 ${current.candidateSha} draft`,
  };
  assert.equal(
    (
      await validateCampaignHistoryInventory({
        record: v,
        mode: "ordinary",
        run,
        preflight: false,
        predecessors: [],
        all: new Map([
          [run.runId, item(run.runId)],
          [draft.id, draft],
        ]),
        recognized: async () => true,
        request: async () => ({
          total_count: 3,
          jobs: Array.from({ length: 3 }, () => ({ status: "completed", conclusion: "skipped" })),
        }),
      })
    ).status,
    "PASS",
  );
});
test("write jobs reject an arbitrary dispatch base before selecting trusted authority", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  for (const name of ["campaign-custody", "mainline-decision"]) {
    const job = workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z][a-z-]*:\n/u)[0];
    assert.match(job, /ref: \$\{\{ github.sha \}\}\n          path: authority\n          fetch-depth: 1/u);
    assert.match(job, /run: test "\$REQUESTED_BASE" = "\$TRUSTED_WORKFLOW_SHA"/u);
    assert(job.indexOf("Require the trusted workflow base") < job.indexOf("uses: actions/checkout@v4"));
    if (process.platform !== "win32") {
      const guard = 'test "$REQUESTED_BASE" = "$TRUSTED_WORKFLOW_SHA"';
      assert.throws(() =>
        execFileSync("sh", ["-c", guard], {
          env: { PATH: process.env.PATH, REQUESTED_BASE: "a".repeat(40), TRUSTED_WORKFLOW_SHA: "b".repeat(40) },
          stdio: "pipe",
        }),
      );
      execFileSync("sh", ["-c", guard], {
        env: { PATH: process.env.PATH, REQUESTED_BASE: "b".repeat(40), TRUSTED_WORKFLOW_SHA: "b".repeat(40) },
        stdio: "pipe",
      });
    }
  }
});
test("canonical hosted policy entry includes both R24 and real checkout regressions", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url))),
    entry = readFileSync(new URL("./experience-current-admission.test.mjs", import.meta.url), "utf8");
  assert(pkg.scripts["test:sounding-line"].includes("tests/sounding-line/experience-current-admission.test.mjs"));
  assert.match(entry, /import \{ record as r24RecordFixture \} from "\.\/experience-r24.test.mjs"/u);
  assert.match(entry, /import "\.\/experience-selected-checkout.test.mjs"/u);
});
