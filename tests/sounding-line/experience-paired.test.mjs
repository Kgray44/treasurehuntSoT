import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  PAIRED_CASES,
  PAIRED_CONTRACTS,
  pairedBinding,
  planPairedEvidence,
  producePairedEvidence,
  sealPairedRuntime,
  validatePairedEvidence,
  validatePairedPublication,
  validatePairedReport,
  validatePairedWitness,
} from "../../scripts/sounding-line/experience-paired.mjs";
import {
  artifactBytes,
  experienceDigest,
  mergeExperienceContracts,
  validateExperienceArtifacts,
} from "../../scripts/sounding-line/product-experience.mjs";
import { verifyTrustedExperienceAttestation } from "../../scripts/sounding-line/experience-attestation.mjs";
import {
  r6LocalMarkerPath,
  inspectCampaignBeforeLocalProof,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { CROSSDECK_R6, validateR6LocalReceipt } from "../../scripts/sounding-line/experience-r6.mjs";
import { runR6LocalProof } from "../../scripts/sounding-line/experience-r6-local-proof.mjs";
const contracts = () =>
  PAIRED_CONTRACTS.map((id) => ({
    id,
    experience: {
      journeys: [],
      references: [],
      pairedEvidence: { version: 1, caseIds: PAIRED_CASES.map((c) => c.id) },
    },
  }));

const png = await sharp({ create: { width: 390, height: 844, channels: 4, background: "#123456" } })
  .png()
  .toBuffer();
const desktopPng = await sharp({ create: { width: 1440, height: 1000, channels: 4, background: "#123456" } })
  .png()
  .toBuffer();
const webm = Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from("webm"), Buffer.alloc(128)]);
const mediumPng = await sharp({ create: { width: 820, height: 1180, channels: 4, background: "#123456" } })
  .png()
  .toBuffer();
const landscapePng = await sharp({ create: { width: 844, height: 390, channels: 4, background: "#123456" } })
  .png()
  .toBuffer();
function report() {
  return {
    errors: [],
    stats: { expected: 3, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [
      {
        specs: PAIRED_CASES.map((c) => ({
          title: c.title,
          file: c.spec,
          tests: [{ projectName: "chromium", expectedStatus: "passed", results: [{ status: "passed", retry: 0 }] }],
        })),
      },
    ],
  };
}
function witness(c, binding) {
  return {
    version: 1,
    status: "PASS",
    caseId: c.id,
    binding,
    fixture: { voyageId: "synthetic-voyage", editionId: "synthetic-edition", databaseSha256: binding.databaseSha256 },
    contexts: {
      DESKTOP: {
        voyageId: "synthetic-voyage",
        editionId: "synthetic-edition",
        surfaceId: "desktop",
        viewport: { width: 1440, height: 1000 },
        reducedMotion: c.motionMode === "REDUCED",
      },
      MOBILE: {
        voyageId: "synthetic-voyage",
        editionId: "synthetic-edition",
        surfaceId: "mobile",
        viewport: { width: 390, height: 844 },
        reducedMotion: c.motionMode === "REDUCED",
      },
    },
    outcomes: Object.fromEntries(c.outcomes.map((o) => [o, true])),
    cleanup: { tracesStopped: true, contextsClosed: true, videosFlushed: true, fixtureRemoved: true },
    media: Object.fromEntries(
      ["DESKTOP", "MOBILE"].map((d) => [
        d,
        {
          screenshots: [`${d}.png`],
          screenshotViewports: {
            [`${d}.png`]: d === "DESKTOP" ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
          },
          recording: `${d}.webm`,
          trace: `${d}.zip`,
        },
      ]),
    ),
  };
}
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "paired-authority-"));
  // Only this verified, uniquely created task directory is removed.
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init");
  git("config", "user.name", "Synthetic fixture");
  git("config", "user.email", "fixture@example.test");
  mkdirSync(path.join(root, "scripts"));
  writeFileSync(path.join(root, "scripts/runtime.mjs"), "// frozen runtime\n");
  git("add", ".");
  git("commit", "-m", "synthetic source");
  const candidateSha = git("rev-parse", "HEAD");
  const plan = {
    applicable: true,
    baseSha: candidateSha,
    candidateSha,
    sourceDigest: "a".repeat(64),
    contractDigest: "b".repeat(64),
    contracts: contracts(),
    paired: planPairedEvidence(contracts()),
    exception: { recordDigest: "c".repeat(64) },
  };
  mkdirSync(path.join(root, "output"));
  const run = (_exe, args, options) => {
    assert(args.includes("--repeat-each=1"));
    assert(args.includes("--retries=0"));
    assert(args.includes("--workers=1"));
    assert.equal(options.env.GH_TOKEN, undefined);
    assert.equal(options.env.GITHUB_TOKEN, undefined);
    assert.equal(options.env.FOREVER_PLAYWRIGHT_EXTERNAL_SERVER, "1");
    const binding = JSON.parse(options.env.SOUNDING_LINE_PAIRED_BINDING);
    writeFileSync(options.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify(report()));
    for (const c of PAIRED_CASES) {
      const dir = path.join(options.env.CROSSDECK_REFIT_ARTIFACT_ROOT, c.directory);
      mkdirSync(dir);
      const observed = witness(c, binding);
      if (c.id === "crossdeck-pair-normal") {
        for (const [device, file, viewport, bytes] of [
          ["DESKTOP", "14-medium-chronicle.png", { width: 820, height: 1180 }, mediumPng],
          ["MOBILE", "15-phone-landscape.png", { width: 844, height: 390 }, landscapePng],
        ]) {
          observed.media[device].screenshots.push(file);
          observed.media[device].screenshotViewports[file] = viewport;
          writeFileSync(path.join(dir, file), bytes);
        }
      }
      writeFileSync(path.join(dir, "paired-witness.json"), JSON.stringify(observed));
      for (const d of ["DESKTOP", "MOBILE"]) {
        writeFileSync(path.join(dir, `${d}.png`), d === "DESKTOP" ? desktopPng : png);
        writeFileSync(path.join(dir, `${d}.webm`), webm);
        writeFileSync(path.join(dir, `${d}.zip`), Buffer.from([80, 75, 3, 4, 0]));
      }
    }
    return { status: 0 };
  };
  return { root, git, plan, run };
}
async function captured(t) {
  const f = fixture(t);
  const value = await producePairedEvidence({
    ...f,
    baseURL: "http://127.0.0.1:4321",
    outputDirectory: "output",
    environment: { DATABASE_URL: "file:synthetic.db", GH_TOKEN: "never-forward", GITHUB_TOKEN: "never-forward" },
  });
  const diagnosticBinding = {
    version: 1,
    runId: randomUUID(),
    scopeId: randomUUID(),
    baseSha: f.plan.baseSha,
    candidateSha: f.plan.candidateSha,
    planDigest: "d".repeat(64),
  };
  const runtime = {
    diagnosticBinding,
    failureCategory: null,
    lifecycle: { capture: "PASS", cleanup: { status: "PASS", portsReleased: true }, cancelled: false },
  };
  const profile = { diagnosticBinding, status: "PASS", profile: "generic", failureCategory: null };
  await sealPairedRuntime({ root: f.root, evidence: value, outputDirectory: "output", runtime, profile });
  return { ...f, value, runtime, profile, read: (file) => artifactBytes({ root: f.root, file }) };
}
test("paired annotation survives nonweakening merge and selects exactly two contracts/three cases/six contexts", () => {
  assert.equal(planPairedEvidence([]), null);
  const selected = contracts();
  assert.equal(planPairedEvidence(selected).browserContexts, 6);
  assert.deepEqual(
    mergeExperienceContracts(selected, selected)[0].experience.pairedEvidence,
    selected[0].experience.pairedEvidence,
  );
  assert.equal(planPairedEvidence(selected.slice(0, 1)).browserContexts, 6);
  assert.throws(() => planPairedEvidence([{ ...selected[0], id: "unapproved" }]), /CONTRACT_SCOPE_CHANGED/u);
  selected[0].experience.pairedEvidence.caseIds.pop();
  assert.throws(() => planPairedEvidence(selected), /CONTRACT_SCOPE_CHANGED/u);
});
test("exact report rejects skips, retries, expected failures, duplicate/extra cases and missing outcomes", () => {
  validatePairedReport(report());
  for (const change of [
    (r) => r.stats.skipped++,
    (r) => r.suites[0].specs.pop(),
    (r) => r.suites[0].specs.push(r.suites[0].specs[0]),
    (r) => r.suites[0].specs[0].tests[0].results.push({ status: "passed", retry: 1 }),
    (r) => (r.suites[0].specs[0].tests[0].expectedStatus = "failed"),
    (r) => (r.suites[0].specs[0].tests[0].projectName = "firefox"),
  ]) {
    const r = report();
    change(r);
    assert.throws(() => validatePairedReport(r), /PAIRED_/u);
  }
  const binding = { databaseSha256: "d".repeat(64) };
  for (const change of [
    (w) => delete w.outcomes.CONTINUATION_ACTIVATED,
    (w) => (w.cleanup.fixtureRemoved = false),
    (w) => (w.contexts.MOBILE.surfaceId = "desktop"),
    (w) => (w.contexts.MOBILE.voyageId = "other-voyage"),
    (w) => (w.media.MOBILE.screenshots = []),
    (w) => (w.media.MOBILE = structuredClone(w.media.DESKTOP)),
    (w) => (w.contexts.MOBILE.reducedMotion = true),
    (w) => (w.contexts.MOBILE.viewport.width = 1440),
  ]) {
    const w = witness(PAIRED_CASES[0], binding);
    change(w);
    assert.throws(() => validatePairedWitness(w, PAIRED_CASES[0], binding), /PAIRED_/u);
  }
});
test("producer attaches both real contexts to both review packets and validates canonical media/terminal receipts", async (t) => {
  const f = await captured(t);
  assert.equal(f.value.artifacts.length, 40);
  validateExperienceArtifacts({ root: f.root, plan: f.plan, evidence: f.value });
  assert.throws(
    () => validateExperienceArtifacts({ root: f.root, plan: { ...f.plan, paired: null }, evidence: f.value }),
    /SCREENSHOT_INVALID/u,
  );
  validatePairedEvidence({ root: f.root, plan: f.plan, evidence: f.value, read: f.read });
  await assert.rejects(
    () =>
      producePairedEvidence({
        ...f,
        baseURL: "http://127.0.0.1:4321",
        outputDirectory: "output",
        environment: { DATABASE_URL: "file:synthetic.db" },
      }),
    /EEXIST/u,
  );
  const artifact = f.value.artifacts[0];
  writeFileSync(path.join(f.root, artifact.path), Buffer.from("tampered media"));
  assert.throws(
    () => validateExperienceArtifacts({ root: f.root, plan: f.plan, evidence: f.value }),
    /ARTIFACT_DIGEST_MISMATCH/u,
  );
});
test("paired block fails closed for missing receipts, absent outcome, swapped media, cleanup failure or stale runtime", async (t) => {
  const f = await captured(t);
  for (const change of [
    (v) => delete v.pairedEvidence.runtime,
    (v) => delete v.pairedEvidence.cases[0].outcomes.CONTINUATION_ACTIVATED,
    (v) => (v.artifacts[0].path = v.artifacts[6].path),
    (v) => (v.pairedEvidence.binding.baseSha = "f".repeat(40)),
    (v) => (v.pairedEvidence.cases[0].media.MOBILE.trace = "../outside.zip"),
    (v) => (v.pairedEvidence.report.sha256 = "0".repeat(64)),
  ]) {
    const v = structuredClone(f.value);
    change(v);
    assert.throws(() => validatePairedEvidence({ root: f.root, plan: f.plan, evidence: v, read: f.read }), /PAIRED_/u);
  }
  f.runtime.lifecycle.cleanup.status = "FAIL";
  await sealPairedRuntime({
    root: f.root,
    evidence: f.value,
    outputDirectory: "output",
    runtime: f.runtime,
    profile: f.profile,
  });
  assert.throws(
    () => validatePairedEvidence({ root: f.root, plan: f.plan, evidence: f.value, read: f.read }),
    /TERMINAL_CLEANUP_REQUIRED/u,
  );
  f.runtime.lifecycle.cleanup.status = "PASS";
  f.profile.diagnosticBinding = { ...f.profile.diagnosticBinding, scopeId: randomUUID() };
  await sealPairedRuntime({
    root: f.root,
    evidence: f.value,
    outputDirectory: "output",
    runtime: f.runtime,
    profile: f.profile,
  });
  assert.throws(
    () => validatePairedEvidence({ root: f.root, plan: f.plan, evidence: f.value, read: f.read }),
    /RUNTIME_BINDING_MISSING/u,
  );
});
test("evidence publication preserves executed tuple and rejects changed tests, scripts, config or automation", (t) => {
  const f = fixture(t);
  const binding = pairedBinding({ root: f.root, plan: f.plan, databaseUrl: "file:synthetic.db" });
  mkdirSync(path.join(f.root, "Development_Docs"));
  writeFileSync(path.join(f.root, "Development_Docs/proof.md"), "{}\n");
  f.git("add", ".");
  f.git("commit", "-m", "publish evidence");
  const published = { ...f.plan, candidateSha: f.git("rev-parse", "HEAD") };
  validatePairedPublication({ root: f.root, plan: published, binding });
  assert.equal(binding.candidateSha, f.plan.candidateSha);
  for (const file of ["scripts/runtime.mjs", "tests/paired.spec.ts", "playwright.config.ts", ".agents/execution.md"]) {
    mkdirSync(path.dirname(path.join(f.root, file)), { recursive: true });
    writeFileSync(path.join(f.root, file), "// changed input\n");
    f.git("add", ".");
    f.git("commit", "-m", "changed input");
    assert.throws(
      () =>
        validatePairedPublication({
          root: f.root,
          plan: { ...published, candidateSha: f.git("rev-parse", "HEAD") },
          binding,
        }),
      /EXECUTED_SOURCE_CHANGED/u,
    );
  }
});
test("trusted capture and review bind paired claims even when original media identifiers are unchanged", async () => {
  const paired = { version: 1, cases: [{ caseId: "paired", outcomes: { JOIN_AUTHORIZED: true } }] };
  const capture = { artifacts: [], journeys: [], pairedEvidence: paired };
  const review = { captureArtifactId: 10, reviews: [], pairedEvidenceDigest: experienceDigest(paired) };
  const evidence = { ...structuredClone(capture), captureArtifactId: 10, reviewArtifactId: 11, reviews: [] };
  const plan = {
    applicable: true,
    paired: { version: 1 },
    attestationPolicy: { required: true, trustedReviewActors: ["Kgray44"] },
  };
  const verify = () =>
    verifyTrustedExperienceAttestation({
      root: "unused",
      plan,
      evidence,
      loadArtifact: async ({ kind }) => (kind === "capture" ? capture : review),
    });
  assert.equal((await verify()).status, "PASS");
  evidence.pairedEvidence.cases[0].outcomes.JOIN_AUTHORIZED = false;
  await assert.rejects(verify(), /TRUSTED_CAPTURE_OR_REVIEW_MISMATCH/u);
});
test("one local parent is consumed before replay and failure cannot reset it through another candidate or worktree", async (t) => {
  const f = fixture(t);
  f.plan.contextCount = 38;
  f.plan.exception.id = CROSSDECK_R6.id;
  const markerPath = r6LocalMarkerPath(f.root);
  const admit = async () => ({ plan: f.plan, manifest: { candidateTree: f.git("rev-parse", "HEAD^{tree}") } });
  let replays = 0;
  const replay = async () => {
    replays++;
    assert.equal(JSON.parse(readFileSync(markerPath)).status, "STARTED");
    throw Error("controlled replay failure");
  };
  await assert.rejects(
    () => runR6LocalProof({ root: f.root, baseSha: f.plan.baseSha, candidateSha: f.plan.candidateSha, admit, replay }),
    /controlled replay failure/u,
  );
  assert.equal(JSON.parse(readFileSync(markerPath)).status, "FAIL");
  await assert.rejects(
    () => runR6LocalProof({ root: f.root, baseSha: f.plan.baseSha, candidateSha: "f".repeat(40), admit, replay }),
    /EEXIST/u,
  );
  assert.equal(replays, 1);
  const sibling = path.join(f.root, "owned-sibling");
  f.git("worktree", "add", "--detach", sibling, "HEAD");
  assert.equal(r6LocalMarkerPath(sibling), markerPath);
  const receipt = JSON.parse(readFileSync(path.join(f.root, CROSSDECK_R6.localProofPath)));
  assert.equal(receipt.pairedCaseExecutions, null);
  assert.equal(receipt.childReplayInvocations, 1);
  assert.throws(() => validateR6LocalReceipt(receipt, f.plan), /LOCAL_PROOF_MISSING_OR_CHANGED/u);
});
test("read-only preflight history rejects truncated or unaccounted execution history before any write", async () => {
  // Noncampaign fixture exercises the shared bounded inventory boundary without
  // pretending to be an installed R6 grant or creating protected custody.
  const record = {
    id: "synthetic",
    pullRequest: 721,
    repository: "Kgray44/treasurehuntSoT",
    ownerApproval: { actor: "Kgray44", approvedAtUtcMinute: "2026-10-15T13:54Z" },
  };
  for (const data of [
    { total_count: 1001, workflow_runs: [] },
    { total_count: 1, workflow_runs: [] },
    { total_count: 1, workflow_runs: [{ id: 1, display_title: "Sounding Line finite 1 malformed" }] },
  ]) {
    const calls = [];
    const request = async (endpoint, method = "GET") => {
      calls.push({ endpoint, method });
      return data;
    };
    await assert.rejects(
      () =>
        inspectCampaignBeforeLocalProof({
          root: "unused",
          record,
          plan: { candidateSha: "a".repeat(40) },
          request,
          now: new Date("2026-10-16T05:00:00Z"),
        }),
      /HISTORY_/u,
    );
    assert(calls.every((c) => c.method === "GET"));
  }
});
test("history inventories each immutable candidate once while preserving directory markers", async (t) => {
  const f = fixture(t);
  const record = {
    id: "synthetic",
    pullRequest: 721,
    repository: "Kgray44/treasurehuntSoT",
    ownerApproval: { actor: "Kgray44", approvedAtUtcMinute: "2026-10-15T13:54Z" },
    frozenReferenceSha: "e".repeat(40),
    frozenTrees: {},
    immutableHistory: Array.from({ length: 80 }, (_, i) => ({ path: `absent-history/${i}.json` })),
  };
  const runs = Array.from({ length: 5 }, (_, i) => ({
    id: 100 + i,
    display_title: `Sounding Line finite 1 ordinary 999 ${f.plan.candidateSha} active`,
    workflow_id: 341545080,
    path: ".github/workflows/sounding-line-ordinary.yml",
    head_repository: { full_name: record.repository },
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    run_attempt: 1,
    event: "pull_request_target",
    head_branch: "synthetic-unrelated",
    head_sha: f.plan.candidateSha,
    status: "completed",
    conclusion: "success",
    created_at: "2026-10-16T04:00:00Z",
  }));
  const calls = [];
  const request = async (endpoint, method = "GET") => {
    calls.push({ endpoint, method });
    assert(endpoint.startsWith("actions/workflows/"));
    return { total_count: runs.length, workflow_runs: runs };
  };
  const trace = path.join(f.root, "git-observation.trace");
  const inherited = process.env.GIT_TRACE;
  process.env.GIT_TRACE = trace.replaceAll("\\", "/");
  try {
    const result = await inspectCampaignBeforeLocalProof({
      root: f.root,
      record,
      plan: f.plan,
      request,
      now: new Date("2026-10-16T05:00:00Z"),
    });
    assert.equal(result.status, "PASS");
    const observed = readFileSync(trace, "utf8");
    assert.equal((observed.match(/built-in: git ls-tree -rz /gu) ?? []).length, 1);
    assert((observed.match(/built-in: git /gu) ?? []).length <= 4);
    await assert.rejects(
      () =>
        inspectCampaignBeforeLocalProof({
          root: f.root,
          record: { ...record, immutableHistory: [{ path: "scripts" }] },
          plan: f.plan,
          request,
          now: new Date("2026-10-16T05:00:00Z"),
        }),
      /LOCAL_HISTORY_EXECUTION_ALREADY_CONSUMED/u,
    );
    assert(calls.every((c) => c.method === "GET"));
  } finally {
    if (inherited === undefined) delete process.env.GIT_TRACE;
    else process.env.GIT_TRACE = inherited;
  }
});
