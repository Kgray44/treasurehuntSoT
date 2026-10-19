// One counted paired preflight using the existing production-server authority.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statfsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./ordinary.mjs";
import { runTrustedExperienceReplay } from "./experience-browser.mjs";
import {
  exceptionBinding,
  exceptionStore,
  githubRequest,
  r6LocalMarkerPath,
  r7LocalMarkerPath,
  r8LocalMarkerPath,
  trustedExceptions,
  inspectCampaignBeforeLocalProof,
} from "./experience-exception.mjs";
import { CROSSDECK_R8, r8LocalPlan, validateR8Proof } from "./experience-r8.mjs";
import { CROSSDECK_R7 } from "./experience-r7.mjs";
import { PAIRED_CASES } from "./experience-paired.mjs";

const fail = (code) => {
  throw Error(`PRODUCT_EXPERIENCE_EXCEPTION_R8_${code}`);
};
export function validateR8PriorMarkerDigests(digests) {
  if (
    digests.length !== 2 ||
    digests[0] !== CROSSDECK_R7.predecessor.originalMarkerSha256 ||
    digests[1] !== CROSSDECK_R8.predecessor.originalMarkerSha256
  )
    fail("CONSUMED_PRIOR_MARKER_CHANGED");
}
export function validateR8PriorLocalMarker(root) {
  validateR8PriorMarkerDigests(
    [r6LocalMarkerPath(root), r7LocalMarkerPath(root)].map((marker) =>
      createHash("sha256").update(readFileSync(marker)).digest("hex"),
    ),
  );
}
export async function checkR8LocalPlan({ root, baseSha, candidateSha, environment = process.env, request }) {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  if (
    environment.GITHUB_ACTIONS === "true" ||
    git("rev-parse", "HEAD") !== candidateSha ||
    git("rev-parse", "origin/main") !== baseSha ||
    git("status", "--porcelain").length
  )
    fail("LOCAL_EXACT_CLEAN_SOURCE_REQUIRED");
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execFileSync(
    "git",
    [
      "diff",
      "--exit-code",
      baseSha,
      "--",
      "scripts/sounding-line",
      "testing/product-experience-exceptions.json",
      "package.json",
      ".prettierignore",
      ".prettierrc.json",
    ],
    { cwd: installed },
  );
  const ordinary = await buildPlan({ root, baseSha, candidateSha, experienceEvidenceRequired: false, prNumber: 721 });
  const plan = ordinary.productExperience;
  if (
    plan.exception?.id !== CROSSDECK_R8.id ||
    plan.genericContextCount !== 32 ||
    plan.paired?.browserContexts !== 6 ||
    plan.contextCount !== 38
  )
    fail("LOCAL_INSTALLED_APPROVAL_REQUIRED");
  const record = trustedExceptions(root, baseSha).find((r) => r.id === CROSSDECK_R8.id);
  if (JSON.stringify(ordinary.selected.browserTests) !== JSON.stringify(record.requiredTechnicalBrowserTests))
    fail("TECHNICAL_SCOPE_CHANGED");
  const commonGit = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  const locations = {
    root: realpathSync(root),
    commonGit: realpathSync(commonGit),
    dependencies: realpathSync(path.join(root, "node_modules")),
    temp: environment.TEMP,
    tmp: environment.TMP,
    cache: environment.npm_config_cache,
    output: path.join(root, CROSSDECK_R8.localOutputDirectory),
  };
  if (
    process.platform !== "win32" ||
    Object.values(locations).some((v) => typeof v !== "string" || !/^D:[\\/]/iu.test(path.resolve(v))) ||
    existsSync(path.join(commonGit, "objects/info/alternates"))
  )
    fail("INDEPENDENT_D_STORAGE_REQUIRED");
  const free = (drive) => {
    const s = statfsSync(drive);
    return s.bavail * s.bsize;
  };
  const storage = { cFreeBytes: free("C:/"), dFreeBytes: free("D:/"), locations };
  if (storage.cFreeBytes < 30 * 1024 ** 3 || storage.dFreeBytes < 20 * 1024 ** 3) fail("STORAGE_FLOOR");
  if (existsSync(r8LocalMarkerPath(root))) fail("LOCAL_PROOF_ALREADY_CONSUMED");
  validateR8PriorLocalMarker(root);
  const api = request ?? githubRequest(record.repository);
  const history = await inspectCampaignBeforeLocalProof({ root, record, plan, request: api });
  const main = await api("git/ref/heads/main"),
    pr = await api("pulls/721");
  if (
    main?.object?.sha !== baseSha ||
    pr?.state !== "open" ||
    pr.head.sha !== candidateSha ||
    pr.base.ref !== "main" ||
    pr.head.repo.full_name !== record.repository
  )
    fail("LIVE_SOURCE_CHANGED");
  const store = exceptionStore({ record, request: api });
  for (const slot of ["prepare", "capture", "review-submit", "review7", "qualify", "qualified"])
    if (await store.read(slot)) fail("STAGE_ALREADY_CONSUMED");
  return {
    plan,
    record,
    manifest: {
      classification: "READ_ONLY_PAIRED_PREFLIGHT_PLAN_NO_EXECUTION",
      status: "PASS",
      baseSha,
      candidateSha,
      candidateTree: git("rev-parse", `${candidateSha}^{tree}`),
      sourceDigest: plan.sourceDigest,
      contractDigest: plan.contractDigest,
      recordDigest: plan.exception.recordDigest,
      contractIds: plan.contractIds,
      genericContextsPerFullPass: 32,
      pairedCases: PAIRED_CASES,
      pairedContextsPerPass: 6,
      fullPassContexts: 38,
      technicalBrowserTests: record.requiredTechnicalBrowserTests,
      storage,
      history,
      custodyWrites: 0,
      executions: 0,
    },
  };
}
export async function runR8LocalProof({
  root,
  baseSha,
  candidateSha,
  environment = process.env,
  request,
  replay = runTrustedExperienceReplay,
  admit = checkR8LocalPlan,
}) {
  const { plan, manifest } = await admit({ root, baseSha, candidateSha, environment, request });
  const markerPath = r8LocalMarkerPath(root);
  mkdirSync(path.dirname(markerPath), { recursive: true });
  const marker = {
    status: "STARTED",
    startedAt: new Date().toISOString(),
    ownerPid: process.pid,
    lease: randomUUID(),
    candidateSha,
    binding: exceptionBinding(plan),
  };
  writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n", { flag: "wx" });
  const receiptPath = path.join(root, CROSSDECK_R8.localProofPath);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  const receipt = {
    version: 1,
    classification: "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY",
    status: "STARTED",
    exceptionId: CROSSDECK_R8.id,
    baseSha,
    candidateSha,
    candidateTree: manifest.candidateTree,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    recordDigest: plan.exception.recordDigest,
    localProofInvocations: 1,
    childReplayInvocations: 0,
    pairedCaseExecutions: null,
    participatingBrowserContexts: null,
    fullPreparations: 0,
    independentReviews: 0,
    caseIds: PAIRED_CASES.map((c) => c.id),
    ownerAcceptance: "NOT_CLAIMED",
    startedAt: marker.startedAt,
    manifest,
    limitation:
      "Operator common-Git accounting is not authenticated global execution custody. Preserve this fixed-grant marker across candidates/checkouts; no reset, copy or raw-launch bypass.",
  };
  const persist = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  try {
    receipt.childReplayInvocations = 1;
    persist();
    const result = await replay({
      root,
      plan: r8LocalPlan(plan),
      environment: { ...environment, SOUNDING_LINE_R8_LOCAL_LEASE: marker.lease },
      validateReplay: false,
    });
    receipt.evidence = JSON.parse(readFileSync(result.capturePath, "utf8"));
    receipt.pairedCaseExecutions = 3;
    receipt.participatingBrowserContexts = 6;
    receipt.status = "PASS";
    await validateR8Proof({ root, plan, receipt });
    return receipt;
  } catch (error) {
    receipt.status = "FAIL";
    // Do not put possibly private error text or URLs into published receipts.
    receipt.failure = "PAIRED_PREFLIGHT_FAILED_RETAIN_PARTIAL_OUTPUT_AND_CONSUMED_MARKER";
    throw error;
  } finally {
    receipt.completedAt = new Date().toISOString();
    persist();
    writeFileSync(
      markerPath,
      JSON.stringify({ ...marker, status: receipt.status, completedAt: receipt.completedAt }, null, 2) + "\n",
    );
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, root, baseSha, candidateSha] = process.argv.slice(2);
  if (!["check", "run"].includes(mode)) fail("LOCAL_MODE_REQUIRED");
  const args = { root: path.resolve(root ?? process.cwd()), baseSha, candidateSha };
  console.log(
    JSON.stringify(mode === "check" ? (await checkR8LocalPlan(args)).manifest : await runR8LocalProof(args), null, 2),
  );
}
