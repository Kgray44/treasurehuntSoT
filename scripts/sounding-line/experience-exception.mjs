// A finite Crossdeck admission exception, not a second qualification authority.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CROSSDECK_R3,
  validateR3Record,
  validateR3Contracts,
  r3LocalPlan,
  validateR3LocalReceipt,
} from "./experience-r3.mjs";
export { CROSSDECK_R3 } from "./experience-r3.mjs";

export const EXCEPTION_REGISTRY = "testing/product-experience-exceptions.json";
// Recognition survives retirement/removal of a grant. It never grants admission.
export const CROSSDECK_CAMPAIGN = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015",
  pullRequest: 721,
  frozenReferenceSha: "c9f7f90824bb6003f1ccbc2e93085a523d70fd3d",
  frozenTrees: { src: "0a455ccc3653b4fc672fa038b849f0392889b007" },
  immutableHistory: [
    { path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/repair-ledger.json" },
    {
      path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/correction-ledger-current.json",
    },
    {
      path: "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/terminal-capture-receipt.json",
    },
  ],
};
// This successor recognizes one exact consumed predecessor, never a class of
// failed runs or a fresh approval-date epoch.
export const CROSSDECK_R2 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2",
  approvalMessageId: "Sentinel_ae98f58b5fc88191b9132a017d43518c",
  approvalSourceThreadId: "01a0f4a3-e2a2-7591-a1c3-167849b860cf",
  approvedAtUtcMinute: "2026-10-15T16:49Z",
  reviewReusePolicy:
    "Read-only reuse of the original successful review seal; no second authenticated review submission",
  approvalQuestion:
    "May I proceed with R2: one new preparation, the remaining third review, and one ordinary qualification run, preserving all failed history and acceptance gates?",
  predecessor: {
    id: CROSSDECK_CAMPAIGN.id,
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015",
    recordDigest: "bf11c0852ca133e6446216d1268c091d2fb4a7c2535523a5921253883ec050b0",
    prepareCommit: "2706b52f12fc167434b03ff8e6fb7d3198db8d62",
    runId: 38760343298,
    runAttempt: 1,
    workflowId: 341545080,
    createdAt: "2026-10-15T15:26:30Z",
    conclusion: "failure",
    baseSha: "9983c900875ffa116e7945318823e93e6e94348b",
    candidateSha: "f000118d1cddeb5f0e6f79c59c9ef076862de93a",
    candidateTree: "c3523d02e5c6a62485cfc521dfae557535577ec5",
    sourceDigest: "9ec365cdf6b880982344d2ea513da82824c6d2c6d0743a17fb89c180afe67ce4",
    contractDigest: "8c8d5ddbc67e23f784e4465067973e2eb9d5f3d8d95bf44c646de4079cdb306d",
    campaignEpoch: "2026-10-15T13:54Z",
    artifacts: [
      {
        id: 11985629215,
        size: 1202922011,
        digest: "sha256:fd37ca0660cb16da4d08f42027b567e02444c051e1b90f485b3e74aef3e84516",
      },
      {
        id: 11986936084,
        size: 34994,
        digest: "sha256:a5389f04dca104282e52e08ab4ffdaa36d47a1244903432d6c42ae08cb148324",
      },
    ],
  },
  attemptHistory: {
    version: 2,
    priorRepairRecaptureAttempts: 11,
    failedVerificationPreparations: 1,
    totalPriorExecutedAttempts: 12,
    nextPreparationAttemptTotal: 13,
    completedIndependentReviews: 2,
    remainingIndependentReviewOrdinal: 3,
  },
};
const workflowPath = ".github/workflows/sounding-line-ordinary.yml";
const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_${code}`);
};
const git = (root, ...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
const json = (root, revision, file) => JSON.parse(git(root, "show", `${revision}:${file}`));
const present = (root, revision, file) => Boolean(git(root, "ls-tree", revision, "--", file));
const identity = (root, revision, file) => git(root, "rev-parse", `${revision}:${file}`);
const runtimePath = (file) =>
  /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
  /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc)$/u.test(file);
function entries(root, revision) {
  return new Map(
    git(root, "ls-tree", "-rz", revision)
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const [metadata, file] = entry.split("\t");
        return [file, metadata];
      }),
  );
}
export function exceptionRecords(root, baseSha) {
  if (!present(root, baseSha, EXCEPTION_REGISTRY)) return [];
  const registry = json(root, baseSha, EXCEPTION_REGISTRY);
  if (registry.version !== 1 || !Array.isArray(registry.exceptions)) fail("REGISTRY_INVALID");
  return registry.exceptions;
}
function r3FamilyRelated(root, candidateSha) {
  try {
    const masked = (revision) =>
      [...entries(root, revision)].filter(
        ([file]) =>
          file.startsWith("src/") && ![...CROSSDECK_R3.productPaths, ...CROSSDECK_R3.testPaths].includes(file),
      );
    return digest(masked(candidateSha)) === digest(masked(CROSSDECK_R3.blockedCandidate));
  } catch {
    return false;
  }
}
export function selectTrustedExceptions(records) {
  const r3 = records.filter((r) => r.id === CROSSDECK_R3.id);
  if (r3.length) {
    if (
      r3.length !== 1 ||
      records.filter((r) => r.id === CROSSDECK_R2.id).length !== 1 ||
      digest(records.find((r) => r.id === CROSSDECK_R2.id)) !== CROSSDECK_R3.predecessorDigest
    )
      fail("R3_PREDECESSOR_REGISTRY_CHANGED");
    validateR3Record(r3[0]);
    // Validate the original/R2 relationship too; neither predecessor is edited.
    selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R3.id));
    return records.filter((r) => r.status === "ACTIVE" && ![CROSSDECK_CAMPAIGN.id, CROSSDECK_R2.id].includes(r.id));
  }
  const successors = records.filter(
    (record) => record.id === CROSSDECK_R2.id || record.predecessor?.id === CROSSDECK_CAMPAIGN.id,
  );
  if (successors.length) {
    const predecessors = records.filter((record) => record.id === CROSSDECK_CAMPAIGN.id);
    if (
      successors.length !== 1 ||
      successors[0].id !== CROSSDECK_R2.id ||
      digest(successors[0].predecessor) !== digest(CROSSDECK_R2.predecessor) ||
      predecessors.length !== 1 ||
      digest(predecessors[0]) !== CROSSDECK_R2.predecessor.recordDigest
    )
      fail("PREDECESSOR_REGISTRY_CHANGED");
    const scopeKeys = [
      "repository",
      "pullRequest",
      "expiresAt",
      "frozenReferenceSha",
      "frozenHistoricalBaseSha",
      "frozenTrees",
      "frozenBlobs",
      "allowedProtectedBasePackageScriptNames",
      "protectedBaseRuntimeOverrides",
      "immutableHistory",
      "contractIds",
      "contractDigest",
      "contexts",
      "priorRepairRecaptureAttempts",
      "independentProductReviewsCompleted",
      "remainingIndependentReviewOrdinal",
      "executionBudget",
      "requiredTechnicalBrowserTests",
      "affectedRoutes",
      "affectedJourneys",
      "custodyPermissionApproval",
      "ownerAcceptance",
    ];
    if (
      scopeKeys.some((key) => digest(successors[0][key]) !== digest(predecessors[0][key])) ||
      successors[0].custody.nonExecutingReviewReuse !== CROSSDECK_R2.reviewReusePolicy ||
      digest({
        ...successors[0].custody,
        namespace: predecessors[0].custody.namespace,
        nonExecutingReviewReuse: predecessors[0].custody.nonExecutingReviewReuse,
      }) !== digest(predecessors[0].custody)
    )
      fail("PREDECESSOR_SCOPE_CHANGED");
    // Retirement/expiry of R2 never reactivates the original consumed grant.
    return records.filter((record) => record.status === "ACTIVE" && record.id !== CROSSDECK_CAMPAIGN.id);
  }
  return records.filter((record) => record.status === "ACTIVE");
}
export const trustedExceptions = (root, baseSha) => selectTrustedExceptions(exceptionRecords(root, baseSha));
export function campaignRelated({ root, baseSha, candidateSha, record, prNumber }) {
  if (Number(prNumber) === record.pullRequest) return true;
  if (r3FamilyRelated(root, candidateSha) && !r3FamilyRelated(root, baseSha)) return true;
  if (
    record.frozenTrees?.src &&
    present(root, candidateSha, "src") &&
    identity(root, candidateSha, "src") === record.frozenTrees.src &&
    (!present(root, baseSha, "src") || identity(root, baseSha, "src") !== record.frozenTrees.src)
  )
    return true;
  const refitIds = ["crossdeck.refit.companion", "crossdeck.refit.published-lens"];
  const contractIds = (revision) =>
    present(root, revision, "testing/contracts.json")
      ? (json(root, revision, "testing/contracts.json").contracts ?? []).map((value) => value.id)
      : [];
  const proposed = contractIds(candidateSha),
    baseline = contractIds(baseSha);
  if (refitIds.some((id) => proposed.includes(id) && !baseline.includes(id))) return true;
  const ancestor = (revision) => {
    try {
      git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, revision);
      return true;
    } catch {
      return false;
    }
  };
  return (
    (ancestor(candidateSha) && !ancestor(baseSha)) ||
    record.immutableHistory.some(({ path: file }) => present(root, candidateSha, file) && !present(root, baseSha, file))
  );
}
export function validateExceptionRecord(record, now = new Date()) {
  if (record?.id === CROSSDECK_R3.id) {
    validateR3Record(record);
    if (now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
    return;
  }
  const successor = record?.id === CROSSDECK_R2.id;
  if (
    record.version !== (successor ? 2 : 1) ||
    record.id !== (successor ? CROSSDECK_R2.id : CROSSDECK_CAMPAIGN.id) ||
    record.pullRequest !== 721 ||
    record.repository !== "Kgray44/treasurehuntSoT" ||
    record.ownerApproval?.actor !== "Kgray44" ||
    record.ownerApproval?.humanMessageId !==
      (successor ? CROSSDECK_R2.approvalMessageId : "Sentinel_1f92fbd43b788191ba842d90f5fb6574") ||
    record.ownerApproval?.proofClass !== "COORDINATOR_VERIFIED_DIRECT_HUMAN_APPROVAL_RELAY" ||
    record.custodyPermissionApproval?.humanMessageId !== "Sentinel_bd12e5e945c48191bc7747030f326f62" ||
    record.priorRepairRecaptureAttempts !== 11 ||
    record.independentProductReviewsCompleted !== 2 ||
    record.remainingIndependentReviewOrdinal !== 3 ||
    record.contexts !== 32 ||
    record.contractIds?.length !== 7 ||
    record.affectedRoutes?.length !== 14 ||
    record.affectedJourneys?.length !== 9 ||
    record.expiresAt !== "2026-10-22T23:59:59Z" ||
    record.custody?.namespace !== `sounding-line-exceptions/${record.id}` ||
    (successor
      ? record.ownerApproval.approvedAtUtcMinute !== CROSSDECK_R2.approvedAtUtcMinute ||
        record.ownerApproval.sourceThreadId !== CROSSDECK_R2.approvalSourceThreadId ||
        record.ownerApproval.coordinatorThreadId !== "01a13dd0-e3e1-7409-ab2a-b078e08ff0e1" ||
        record.ownerApproval.answer !== "YES" ||
        record.ownerApproval.question !== CROSSDECK_R2.approvalQuestion ||
        record.custody.nonExecutingReviewReuse !== CROSSDECK_R2.reviewReusePolicy ||
        digest(record.predecessor) !== digest(CROSSDECK_R2.predecessor) ||
        digest(record.attemptHistory) !== digest(CROSSDECK_R2.attemptHistory)
      : record.predecessor !== undefined) ||
    digest(record.executionBudget) !==
      digest({
        preparationPasses: 1,
        ordinaryInvocations: 1,
        ordinaryExperienceReplayPasses: 1,
        technicalE2EInvocations: 1,
        newIndependentReviews: 1,
        additionalLocalInvocations: 0,
        reruns: 0,
        productRepairs: 0,
      })
  )
    fail("RECORD_INVALID");
  if (!Number.isFinite(Date.parse(record.expiresAt)) || now.getTime() >= Date.parse(record.expiresAt)) fail("EXPIRED");
}
export function bindExperienceException({ root, baseSha, candidateSha, plan, prNumber, now }) {
  if (
    [CROSSDECK_CAMPAIGN, ...exceptionRecords(root, baseSha)].some((record) =>
      campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
    ) &&
    !trustedExceptions(root, baseSha).some((record) =>
      campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
    )
  )
    fail("APPROVAL_MISSING_OR_INACTIVE");
  const records = trustedExceptions(root, baseSha).filter((record) =>
    campaignRelated({ root, baseSha, candidateSha, record, prNumber }),
  );
  if (!records.length) return null;
  if (records.length !== 1) fail("AMBIGUOUS_CAMPAIGN");
  const record = records[0];
  validateExceptionRecord(record, now);
  const r3 = record.id === CROSSDECK_R3.id;
  for (const [file, tree] of Object.entries(record.frozenTrees))
    if (!(r3 && file === "src") && identity(root, candidateSha, file) !== tree) fail("FROZEN_PRODUCT_CHANGED");
  for (const [file, blob] of Object.entries(record.frozenBlobs)) {
    if (file === "package.json") continue;
    if (identity(root, candidateSha, file) !== blob) fail("FROZEN_CONFIGURATION_CHANGED");
  }
  const frozenPackage = json(root, record.frozenReferenceSha, "package.json");
  const candidatePackage = json(root, candidateSha, "package.json");
  const basePackage = json(root, baseSha, "package.json");
  for (const name of record.allowedProtectedBasePackageScriptNames) {
    frozenPackage.scripts[name] = basePackage.scripts[name];
  }
  if (digest(frozenPackage) !== digest(candidatePackage)) fail("FROZEN_PACKAGE_CHANGED");
  const expected = entries(root, baseSha);
  const candidate = entries(root, candidateSha);
  const reference = entries(root, record.frozenReferenceSha);
  for (const [file, metadata] of reference) if (/^(?:src|public|prisma)\//u.test(file)) expected.set(file, metadata);
  for (const { path: file, mode, blob } of record.protectedBaseRuntimeOverrides)
    expected.set(file, `${mode} blob ${blob}`);
  if (r3) {
    validateR3Contracts(
      json(root, record.frozenReferenceSha, "testing/contracts.json"),
      json(root, candidateSha, "testing/contracts.json"),
    );
    for (const file of [...CROSSDECK_R3.productPaths, ...CROSSDECK_R3.testPaths, "testing/contracts.json"]) {
      const metadata = candidate.get(file);
      if (!metadata?.startsWith("100644 blob ")) fail("R3_REPAIR_PATH_TYPE_CHANGED");
      expected.set(file, metadata);
    }
    if (!CROSSDECK_R3.productPaths.some((file) => candidate.get(file) !== reference.get(file)))
      fail("R3_PRODUCT_REPAIR_MISSING");
  }
  for (const file of new Set([...expected.keys(), ...candidate.keys()])) {
    if (!runtimePath(file) || file === "package.json") continue;
    if (candidate.get(file) !== expected.get(file)) fail("RUNTIME_BINDING_CHANGED");
  }
  for (const { path: file, blob } of record.immutableHistory)
    if (!present(root, candidateSha, file) || identity(root, candidateSha, file) !== blob) fail("HISTORY_CHANGED");
  const contexts = (plan.contracts ?? []).reduce(
    (total, contract) =>
      total +
      contract.experience.devices.length *
        contract.experience.journeys.reduce(
          (count, journey) => count + journey.roles.length * (contract.experience.motion ? 2 : 1),
          0,
        ),
    0,
  );
  if (
    !plan.applicable ||
    (!r3 && plan.contractDigest !== record.contractDigest) ||
    contexts !== record.contexts ||
    digest([...plan.contractIds].sort()) !== digest([...record.contractIds].sort())
  )
    fail("PLAN_SCOPE_CHANGED");
  return recordBinding(record);
}
export function recordBinding(record) {
  return {
    id: record.id,
    recordDigest: digest(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    ...([CROSSDECK_R2.id, CROSSDECK_R3.id].includes(record.id)
      ? { version: record.version, predecessor: record.predecessor, attemptHistory: record.attemptHistory }
      : {}),
  };
}
export function validateExceptionEvidence(plan, evidence, automatedOnly = false) {
  if (!plan.exception) {
    if (evidence?.exception) fail("UNTRUSTED_EVIDENCE_CLAIM");
    return;
  }
  if (digest(evidence?.exception) !== digest(plan.exception)) fail("EVIDENCE_BINDING_MISSING");
  if (!automatedOnly && !Array.isArray(evidence.reviews)) fail("ONE_REVIEW3_SCOPE_REQUIRED");
  if (!automatedOnly)
    for (const review of evidence.reviews ?? []) {
      if (
        review.iterations !== 11 ||
        review.independentReviewOrdinal !== (plan.exception.id === CROSSDECK_R3.id ? 4 : 3)
      )
        fail("HISTORY_OR_REVIEW_ORDINAL_CHANGED");
      if (
        (review.findings ?? []).some(
          (finding) =>
            !["MINOR_POLISH", "SUBJECTIVE_DESIGN_OPPORTUNITY", "ACCEPTED_REFERENCE_QUALITY"].includes(
              finding.classification,
            ) && finding.disposition !== "UNCHANGED_BASELINE_DEBT",
        )
      )
        fail("NEW_BLOCKING_FINDING");
    }
  if (
    !automatedOnly &&
    (evidence.reviews.length !== plan.contractIds.length ||
      digest(evidence.reviews.map((review) => review.contractId).sort()) !== digest([...plan.contractIds].sort()) ||
      new Set(evidence.reviews.map((review) => review.reviewerContext)).size !== 1)
  )
    fail("ONE_REVIEW3_SCOPE_REQUIRED");
}
export function exceptionBinding(plan) {
  return {
    exception: plan.exception,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
  };
}
export function validateExceptionExecutionPlan(plan, actual) {
  const bound = (value) =>
    Object.fromEntries(
      [
        "baseSha",
        "candidateSha",
        "sourceDigest",
        "contractDigest",
        "contractIds",
        "contracts",
        "attestationPolicy",
        "evidencePath",
        "debt",
        "exception",
      ].map((key) => [key, value[key]]),
    );
  if (digest(bound(plan)) !== digest(bound(actual)) || (plan.fixtureProfile && plan.fixtureProfile !== "generic"))
    fail("EXECUTION_PLAN_CHANGED");
}
export function sealedReviewIdentity(plan, evidence) {
  return {
    ...exceptionBinding(plan),
    captureArtifactId: evidence.captureArtifactId,
    reviewsDigest: digest(evidence.reviews),
    artifactsDigest: digest(evidence.artifacts),
    journeysDigest: digest(evidence.journeys),
  };
}
export function githubRequest(repository, token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN) {
  if (!token) fail("AUTHENTICATED_CUSTODY_REQUIRED");
  return async (endpoint, method = "GET", body) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (method === "GET" && response.status === 404) return null;
    if (!response.ok)
      fail(
        method === "POST" && [409, 422].includes(response.status)
          ? "SLOT_CONSUMED"
          : `CUSTODY_ACCESS_${response.status}`,
      );
    return response.json();
  };
}
export function exceptionStore({ record, request }) {
  const ref = (slot) => `tags/${record.custody.namespace}/${slot}`;
  const custodyPath = ".sounding-line-exception-reservation.json";
  const normalized = (values) =>
    values
      .map(({ path: file, mode, type, sha }) => ({ path: file, mode, type, sha }))
      .sort((a, b) => a.path.localeCompare(b.path));
  async function read(slot) {
    const tag = await request(`git/ref/${ref(slot)}`);
    if (!tag) return null;
    if (tag.object?.type !== "commit") fail("CUSTODY_INVALID");
    const commit = await request(`git/commits/${tag.object.sha}`);
    const tree = await request(`git/trees/${commit.tree.sha}`);
    const item = tree.tree?.find((entry) => entry.path === custodyPath);
    if (!item || item.type !== "blob" || item.mode !== "100644") fail("CUSTODY_INVALID");
    const blob = await request(`git/blobs/${item.sha}`);
    const value = JSON.parse(Buffer.from(blob.content.replaceAll("\n", ""), "base64").toString());
    if (
      value.exceptionId !== record.id ||
      commit.parents?.length !== 1 ||
      commit.parents[0].sha !== value.binding.baseSha
    )
      fail("CUSTODY_INVALID");
    const base = await request(`git/commits/${value.binding.baseSha}`);
    const original = await request(`git/trees/${base.tree.sha}`);
    if (
      tree.truncated ||
      original.truncated ||
      original.tree.some((entry) => entry.path === custodyPath) ||
      digest(normalized(tree.tree.filter((entry) => entry.path !== custodyPath))) !== digest(normalized(original.tree))
    )
      fail("CUSTODY_BASE_TREE_CHANGED");
    return { ...value, commitSha: tag.object.sha };
  }
  async function create(slot, value) {
    if (await read(slot)) fail("SLOT_CONSUMED");
    const payload = { version: 1, exceptionId: record.id, ...value };
    const blob = await request("git/blobs", "POST", { content: JSON.stringify(payload), encoding: "utf-8" });
    const base = await request(`git/commits/${value.binding.baseSha}`);
    const tree = await request("git/trees", "POST", {
      base_tree: base.tree.sha,
      tree: [{ path: custodyPath, mode: "100644", type: "blob", sha: blob.sha }],
    });
    const commit = await request("git/commits", "POST", {
      message: `Sounding Line ${record.id} ${slot}`,
      tree: tree.sha,
      parents: [value.binding.baseSha],
    });
    // This is the sole permission-producing operation. Never update, delete or retry it.
    await request("git/refs", "POST", { ref: `refs/${ref(slot)}`, sha: commit.sha });
    return { ...payload, commitSha: commit.sha };
  }
  return { read, create };
}
export async function validateLiveContext({
  record,
  plan,
  request,
  environment = process.env,
  requireHead = true,
  now,
}) {
  validateExceptionRecord(record, now);
  if (
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_REPOSITORY !== record.repository ||
    environment.GITHUB_REF !== "refs/heads/main" ||
    environment.GITHUB_SHA !== plan.baseSha ||
    environment.GITHUB_RUN_ATTEMPT !== "1" ||
    environment.GITHUB_ACTOR !== record.ownerApproval.actor ||
    (environment.GITHUB_TRIGGERING_ACTOR && environment.GITHUB_TRIGGERING_ACTOR !== record.ownerApproval.actor) ||
    environment.GITHUB_WORKFLOW_REF !== `${record.repository}/${workflowPath}@refs/heads/main`
  )
    fail("PROTECTED_EXECUTOR_REQUIRED");
  const main = await request("git/ref/heads/main");
  const pr = await request(`pulls/${record.pullRequest}`);
  const run = await request(`actions/runs/${environment.GITHUB_RUN_ID}`);
  const workflow = await request(`actions/workflows/${run?.workflow_id}`);
  const expectedHead = run?.event === "pull_request_target" ? plan.candidateSha : plan.baseSha;
  const expectedBranch = run?.event === "pull_request_target" ? pr?.head.ref : "main";
  if (
    main?.object.sha !== plan.baseSha ||
    pr?.state !== "open" ||
    pr.base.ref !== "main" ||
    pr.head.repo.full_name !== record.repository ||
    (requireHead && pr.head.sha !== plan.candidateSha) ||
    run?.id !== Number(environment.GITHUB_RUN_ID) ||
    run.run_attempt !== 1 ||
    run.head_sha !== expectedHead ||
    run.head_branch !== expectedBranch ||
    run.head_repository?.full_name !== record.repository ||
    !["workflow_dispatch", "pull_request_target"].includes(run.event) ||
    run.status !== "in_progress" ||
    run.actor?.login !== record.ownerApproval.actor ||
    run.triggering_actor?.login !== record.ownerApproval.actor ||
    workflow?.path !== workflowPath
  )
    fail("LIVE_SOURCE_OR_EXECUTOR_CHANGED");
  await validateSuccessorPredecessor({ record, request, now });
  return {
    runId: run.id,
    runAttempt: 1,
    actor: run.actor.login,
    workflowPath,
    event: run.event,
    headSha: run.head_sha,
    headBranch: run.head_branch,
    createdAt: run.created_at,
    workflowId: run.workflow_id,
    displayTitle: run.display_title,
  };
}
function isExactFailedPredecessor(run, p = CROSSDECK_R2.predecessor) {
  return (
    run?.id === p.runId &&
    run.run_attempt === p.runAttempt &&
    run.workflow_id === p.workflowId &&
    run.path === workflowPath &&
    run.head_repository?.full_name === "Kgray44/treasurehuntSoT" &&
    run.actor?.login === "Kgray44" &&
    run.triggering_actor?.login === "Kgray44" &&
    run.event === "workflow_dispatch" &&
    run.head_branch === "main" &&
    run.head_sha === p.baseSha &&
    run.status === "completed" &&
    run.conclusion === p.conclusion &&
    run.created_at === p.createdAt &&
    run.display_title === `Sounding Line finite 1 capture 721 ${p.candidateSha} active`
  );
}
export async function validateSuccessorPredecessor({ record, request, now }) {
  if (![CROSSDECK_R2.id, CROSSDECK_R3.id].includes(record.id)) return null;
  validateExceptionRecord(record, now);
  if (record.id === CROSSDECK_R3.id) {
    const first = await validateHistoricalPreparation(CROSSDECK_R2.predecessor, request);
    const second = await validateHistoricalPreparation(CROSSDECK_R3.predecessor, request);
    const commit = await request(`git/commits/${CROSSDECK_R3.evidenceCommit}`);
    const tree = await request(`git/trees/${commit?.tree?.sha}?recursive=1`);
    const file = tree?.tree?.find((entry) => entry.path === CROSSDECK_R3.reviewPath);
    if (tree?.truncated || file?.type !== "blob" || file?.mode !== "100644") fail("R3_BLOCKED_REVIEW_CHANGED");
    const blob = await request(`git/blobs/${file.sha}`);
    const bytes = Buffer.from(blob?.content?.replaceAll("\n", "") ?? "", "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== CROSSDECK_R3.reviewSha256)
      fail("R3_BLOCKED_REVIEW_CHANGED");
    return [first, second];
  }
  return validateHistoricalPreparation(record.predecessor, request);
}
async function validateHistoricalPreparation(p, request) {
  const store = exceptionStore({ record: { id: p.id, custody: { namespace: p.namespace } }, request });
  const reservation = await store.read("prepare");
  if (
    !reservation ||
    reservation.commitSha !== p.prepareCommit ||
    reservation.candidateSha !== p.candidateSha ||
    reservation.binding?.baseSha !== p.baseSha ||
    reservation.binding?.sourceDigest !== p.sourceDigest ||
    reservation.binding?.contractDigest !== p.contractDigest ||
    reservation.binding?.exception?.id !== p.id ||
    reservation.binding?.exception?.recordDigest !== p.recordDigest ||
    reservation.run?.runId !== p.runId ||
    reservation.run?.runAttempt !== 1 ||
    reservation.run?.actor !== "Kgray44" ||
    reservation.run?.headSha !== p.baseSha ||
    reservation.run?.event !== "workflow_dispatch" ||
    reservation.run?.headBranch !== "main" ||
    reservation.independentReviewsCompleted !== 2 ||
    reservation.reservedIndependentReviewOrdinal !== 3
  )
    fail("PREDECESSOR_RESERVATION_CHANGED");
  if (
    (
      await Promise.all(["capture", "review-submit", "review3", "qualify", "qualified"].map((slot) => store.read(slot)))
    ).some(Boolean)
  )
    fail("PREDECESSOR_CONSUMPTION_CHANGED");
  const originalRun = await request(`actions/runs/${p.runId}`);
  if (!isExactFailedPredecessor(originalRun, p)) fail("PREDECESSOR_RUN_CHANGED");
  const candidate = await request(`git/commits/${p.candidateSha}`);
  if (candidate?.tree?.sha !== p.candidateTree) fail("PREDECESSOR_SOURCE_CHANGED");
  for (const artifact of p.artifacts) {
    const observed = await request(`actions/artifacts/${artifact.id}`);
    if (
      observed?.id !== artifact.id ||
      observed.digest !== artifact.digest ||
      observed.size_in_bytes !== artifact.size ||
      observed.workflow_run?.id !== p.runId ||
      observed.workflow_run?.head_sha !== p.baseSha
    )
      fail("PREDECESSOR_ARTIFACT_CHANGED");
  }
  return originalRun;
}
export async function requireFirstCampaignRun({ root, record, plan, mode, run, request, now }) {
  const expected = `Sounding Line finite 1 ${mode} ${record.pullRequest} ${plan.candidateSha} active`;
  if (run.displayTitle !== expected || !Number.isFinite(Date.parse(run.createdAt))) fail("HISTORY_CURRENT_RUN_UNBOUND");
  const predecessor = await validateSuccessorPredecessor({ record, request, now });
  const predecessors = predecessor ? (Array.isArray(predecessor) ? predecessor : [predecessor]) : [];
  const since = new Date(
    predecessor ? record.predecessor.campaignEpoch : record.ownerApproval.approvedAtUtcMinute,
  ).toISOString();
  if (Date.parse(run.createdAt) < Date.parse(record.ownerApproval.approvedAtUtcMinute)) fail("HISTORY_EPOCH_INVALID");
  const range = encodeURIComponent(`${since}..${run.createdAt}`),
    all = new Map();
  let total;
  for (let page = 1; page <= 10; page++) {
    const data = await request(`actions/workflows/${run.workflowId}/runs?per_page=100&page=${page}&created=${range}`);
    if (
      !data ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count > 1000 ||
      !Array.isArray(data.workflow_runs) ||
      (total !== undefined && total !== data.total_count)
    )
      fail("HISTORY_INCOMPLETE");
    total = data.total_count;
    for (const item of data.workflow_runs) {
      if (all.has(item.id)) fail("HISTORY_AMBIGUOUS");
      all.set(item.id, item);
    }
    if (all.size === total) break;
    if (data.workflow_runs.length !== 100 || page === 10) fail("HISTORY_INCOMPLETE");
  }
  if (all.size !== total || !all.has(run.runId)) fail("HISTORY_INCOMPLETE");
  if (predecessors.some((p) => !all.has(p.id))) fail("PREDECESSOR_HISTORY_MISSING");
  async function recognized(candidate) {
    if (!/^[a-f0-9]{40}$/u.test(candidate)) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
    try {
      git(root, "cat-file", "-e", `${candidate}^{commit}`);
      if (record.immutableHistory.some(({ path: file }) => present(root, candidate, file))) return true;
      if (
        record.frozenTrees?.src &&
        present(root, candidate, "src") &&
        identity(root, candidate, "src") === record.frozenTrees.src
      )
        return true;
      if (present(root, candidate, "testing/contracts.json")) {
        const ids = (json(root, candidate, "testing/contracts.json").contracts ?? []).map((value) => value.id);
        if (ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens")) return true;
      }
      try {
        git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, candidate);
        return true;
      } catch {
        return false;
      }
    } catch {
      const commit = await request(`git/commits/${candidate}`);
      if (!commit) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
      const tree = await request(`git/trees/${commit.tree.sha}?recursive=1`);
      if (!tree || tree.truncated || !Array.isArray(tree.tree)) fail("HISTORY_CANDIDATE_UNVERIFIABLE");
      if (tree.tree.some((entry) => record.immutableHistory.some((value) => value.path === entry.path))) return true;
      if (tree.tree.some((entry) => entry.path === "src" && entry.sha === record.frozenTrees.src)) return true;
      const contracts = tree.tree.find((entry) => entry.path === "testing/contracts.json");
      if (contracts) {
        const blob = await request(`git/blobs/${contracts.sha}`);
        const ids = (
          JSON.parse(Buffer.from(blob.content.replaceAll("\n", ""), "base64").toString()).contracts ?? []
        ).map((value) => value.id);
        if (ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens")) return true;
      }
      return false;
    }
  }
  for (const item of all.values()) {
    if (predecessors.some((p) => item.id === p.id)) {
      const expectedPredecessor =
        item.id === CROSSDECK_R2.predecessor.runId ? CROSSDECK_R2.predecessor : CROSSDECK_R3.predecessor;
      if (!isExactFailedPredecessor(item, expectedPredecessor)) fail("PREDECESSOR_HISTORY_CHANGED");
      continue;
    }
    const title = /^Sounding Line finite 1 (ordinary|capture|review|verify) (\S+) (\S+) (active|draft)$/u.exec(
      item.display_title ?? "",
    );
    if (!(item.display_title ?? "").startsWith("Sounding Line finite 1 ")) continue;
    if (!title) fail("HISTORY_NAME_UNVERIFIABLE");
    if (Number(title[2]) !== record.pullRequest && !(await recognized(title[3]))) continue;
    if (
      item.workflow_id !== run.workflowId ||
      item.path !== workflowPath ||
      item.head_repository?.full_name !== record.repository ||
      item.actor?.login !== record.ownerApproval.actor ||
      item.triggering_actor?.login !== record.ownerApproval.actor ||
      item.run_attempt !== 1 ||
      !["workflow_dispatch", "pull_request_target"].includes(item.event) ||
      (item.event === "workflow_dispatch" && item.head_branch !== "main") ||
      (item.event === "pull_request_target" && item.head_sha !== title[3]) ||
      !Number.isFinite(Date.parse(item.created_at))
    )
      fail("HISTORY_ATTEMPT_INVALID_OR_AMBIGUOUS");
    if (
      title[4] === "draft" &&
      item.event === "pull_request_target" &&
      item.status === "completed" &&
      item.conclusion === "skipped"
    ) {
      const jobs = await request(`actions/runs/${item.id}/jobs?per_page=100`);
      if (
        !jobs ||
        jobs.total_count !== jobs.jobs?.length ||
        jobs.jobs.length < 3 ||
        jobs.jobs.some((job) => job.status !== "completed" || job.conclusion !== "skipped")
      )
        fail("HISTORY_DRAFT_SKIP_UNVERIFIABLE");
      continue;
    }
    const earlier =
      Date.parse(item.created_at) < Date.parse(run.createdAt) ||
      (item.created_at === run.createdAt && item.id < run.runId);
    if (earlier) {
      if (title[1] === mode) fail("EARLIER_ATTEMPT_CONSUMED");
      if (item.status !== "completed" || item.conclusion !== "success") fail("EARLIER_CAMPAIGN_FAILURE");
      if (mode === "capture" || (mode === "review" && title[1] !== "capture")) fail("CAMPAIGN_STAGE_OUT_OF_ORDER");
    }
  }
}
export async function reserveExceptionStage({ root, record, plan, mode, run, store, request, now }) {
  if (await store.read("qualify")) fail("QUALIFICATION_ALREADY_CONSUMED");
  if (mode === "verify") return;
  if (
    [CROSSDECK_R2.id, CROSSDECK_R3.id].includes(record.id) &&
    mode === "review" &&
    (await store.read("review-submit"))
  )
    fail("REVIEW_SUBMISSION_ALREADY_CONSUMED");
  const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
  const reviewSeal = mode === "review" ? await store.read(reviewSlot) : null;
  if (reviewSeal) await requireSuccessfulReservation({ store, slot: reviewSlot, plan, request });
  else await requireFirstCampaignRun({ root, record, plan, mode, run, request, now });
  const binding = exceptionBinding(plan),
    candidateSha = plan.candidateSha;
  if (mode === "capture") {
    if (record.id === CROSSDECK_R3.id) {
      const receipt = json(root, plan.candidateSha, CROSSDECK_R3.localProofPath);
      validateR3LocalReceipt(receipt, {
        ...plan,
        contracts: json(root, plan.candidateSha, "testing/contracts.json").contracts,
      });
      for (const artifact of receipt.artifacts) {
        if (
          !artifact.path.startsWith("Development_Docs/Projects/Project_Crossdeck/evidence/r3-verification-20261015/") ||
          artifact.path.split("/").includes("..")
        )
          fail("R3_LOCAL_PROOF_PATH_INVALID");
        const bytes = execFileSync("git", ["show", `${plan.candidateSha}:${artifact.path}`], {
          cwd: root,
          maxBuffer: 64 * 1024 * 1024,
        });
        if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) fail("R3_LOCAL_PROOF_MEDIA_CHANGED");
      }
    }
    await store.create("prepare", {
      binding,
      run,
      candidateSha,
      status: `PREPARE_AND_REVIEW${record.remainingIndependentReviewOrdinal}_RESERVED_VALIDATION_PENDING`,
      independentReviewsCompleted: record.independentProductReviewsCompleted,
      reservedIndependentReviewOrdinal: record.remainingIndependentReviewOrdinal,
      ...([CROSSDECK_R2.id, CROSSDECK_R3.id].includes(record.id)
        ? { attemptHistory: { ...record.attemptHistory, status: "NEXT_PREPARATION_RESERVED_NOT_EXECUTED" } }
        : {}),
    });
  }
  if (mode === "ordinary")
    await store.create("qualify", {
      binding,
      run,
      candidateSha,
      candidateTree: git(root, "rev-parse", candidateSha + "^{tree}"),
      status: "ONE_ORDINARY_INVOCATION_RESERVED_VALIDATION_PENDING",
    });
  if (mode === "review") {
    await requireSuccessfulReservation({ store, slot: "prepare", plan, request });
    const submitted = await store.read("review-submit");
    if (submitted) await requireSuccessfulReservation({ store, slot: "review-submit", plan, request });
    else
      await store.create("review-submit", {
        binding,
        run,
        candidateSha,
        status: `RESERVED_REVIEW${record.remainingIndependentReviewOrdinal}_AUTHENTICATED_SUBMISSION_VALIDATION_PENDING`,
      });
  }
}
export async function requireSuccessfulReservation({ store, slot, plan, request }) {
  const reservation = await store.read(slot);
  if (!reservation || digest(reservation.binding) !== digest(exceptionBinding(plan)))
    fail("RESERVATION_BINDING_MISSING");
  const run = await request(`actions/runs/${reservation.run.runId}`);
  if (
    !run ||
    run.run_attempt !== 1 ||
    run.conclusion !== "success" ||
    run.head_sha !== reservation.run.headSha ||
    run.head_branch !== reservation.run.headBranch ||
    run.event !== reservation.run.event ||
    run.actor?.login !== reservation.run.actor ||
    run.triggering_actor?.login !== reservation.run.actor
  )
    fail("RESERVED_RUN_NOT_SUCCESSFUL");
  return reservation;
}
export async function verifyExceptionAttestation({ root, plan, evidence, capture, review, request, now }) {
  if (!plan.exception) return null;
  const record = trustedExceptions(root, plan.baseSha).find((value) => value.id === plan.exception.id);
  validateExceptionRecord(record, now);
  const api = request ?? githubRequest(record.repository);
  const store = exceptionStore({ record, request: api });
  const prepare = await requireSuccessfulReservation({ store, slot: "prepare", plan, request: api });
  const captureSeal = await store.read("capture");
  const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
  const sealed = await store.read(reviewSlot);
  if (
    !captureSeal ||
    digest(captureSeal.provenance) !== digest(capture.trustedArtifact) ||
    capture.trustedArtifact.runId !== prepare.run.runId ||
    !sealed ||
    digest(sealed.reviewIdentity) !== digest(sealedReviewIdentity(plan, evidence)) ||
    digest(capture.exception) !== digest(plan.exception) ||
    digest(review.exception) !== digest(plan.exception) ||
    capture.exceptionPreparationReservation !== prepare.commitSha ||
    review.exceptionPreparationReservation !== prepare.commitSha ||
    review.exceptionReviewSeal !== sealed.commitSha
  )
    fail("SEALED_EVIDENCE_MISMATCH");
  await requireSuccessfulReservation({ store, slot: reviewSlot, plan, request: api });
  return { prepareReservation: prepare.commitSha, reviewSeal: sealed.commitSha };
}
function phasePath(root, phase) {
  return path.join(root, "artifacts/sounding-line", `exception-${phase}.json`);
}
export function claimExceptionPhase({
  root,
  phase,
  plan,
  runId,
  lease = randomUUID(),
  preparationReservation,
  executionHistory,
}) {
  mkdirSync(path.dirname(phasePath(root, phase)), { recursive: true });
  const value = {
    binding: exceptionBinding(plan),
    phase,
    runId,
    ownerPid: process.pid,
    lease,
    preparationReservation,
    ...(executionHistory ? { executionHistory } : {}),
  };
  try {
    writeFileSync(phasePath(root, phase), JSON.stringify(value), { flag: "wx" });
  } catch {
    fail("EXECUTION_PHASE_ALREADY_CONSUMED");
  }
  return value;
}
export function requireExceptionPhase({ root, phase, plan, environment = process.env }) {
  if (!existsSync(phasePath(root, phase))) fail("EXECUTION_PHASE_NOT_RESERVED");
  const value = JSON.parse(readFileSync(phasePath(root, phase), "utf8"));
  if (
    digest(value.binding) !== digest(exceptionBinding(plan)) ||
    value.runId !== Number(environment.GITHUB_RUN_ID) ||
    value.lease !== environment.SOUNDING_LINE_EXCEPTION_LEASE
  )
    fail("EXECUTION_PHASE_BINDING_MISMATCH");
  try {
    process.kill(value.ownerPid, 0);
  } catch {
    fail("EXECUTION_PHASE_OWNER_EXITED");
  }
  return value;
}
export function recognizeExceptionExecution({ root, baseSha, candidateSha, environment = process.env }) {
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const installedHead = git(installed, "rev-parse", "HEAD");
  const records = [
    CROSSDECK_CAMPAIGN,
    ...exceptionRecords(installed, installedHead),
    ...exceptionRecords(root, candidateSha),
    ...(baseSha ? exceptionRecords(root, baseSha) : []),
  ];
  let protectedBase;
  try {
    protectedBase = git(root, "rev-parse", "origin/main");
  } catch {
    protectedBase = null;
  }
  return records.some((record) => {
    const r3Family = r3FamilyRelated(root, candidateSha);
    const marker = record.immutableHistory.some(({ path: file }) => present(root, candidateSha, file));
    const ids = present(root, candidateSha, "testing/contracts.json")
      ? (json(root, candidateSha, "testing/contracts.json").contracts ?? []).map((value) => value.id)
      : [];
    const refit = ids.includes("crossdeck.refit.companion") || ids.includes("crossdeck.refit.published-lens");
    const frozen =
      record.frozenTrees?.src &&
      present(root, candidateSha, "src") &&
      identity(root, candidateSha, "src") === record.frozenTrees.src;
    let descends = false;
    try {
      git(root, "merge-base", "--is-ancestor", record.frozenReferenceSha, candidateSha);
      descends = true;
    } catch {}
    const referenceBase = protectedBase ?? record.frozenHistoricalBaseSha;
    return (
      Number(environment.SOUNDING_LINE_PR_NUMBER) === record.pullRequest ||
      ((marker || descends || refit || frozen || r3Family) &&
        (!referenceBase ||
          baseSha !== referenceBase ||
          baseSha === candidateSha ||
          campaignRelated({ root, baseSha: referenceBase, candidateSha, record })))
    );
  });
}
export async function assertExceptionExecution({
  root,
  plan,
  kind,
  environment = process.env,
  claim = false,
  request,
}) {
  // Rebuild from immutable source. A supplied plan or environment can never create permission.
  if (!existsSync(path.join(root, ".git")) && !plan.exception) return null;
  if (
    !recognizeExceptionExecution({
      root,
      baseSha: plan.baseSha,
      candidateSha: git(root, "rev-parse", "HEAD"),
      environment,
    })
  ) {
    if (plan.exception) fail("UNTRUSTED_EXECUTION_CLAIM");
    return null;
  }
  if (!plan.baseSha || !plan.candidateSha) {
    fail("EXECUTION_PLAN_CHANGED");
  }
  const records = trustedExceptions(root, plan.baseSha);
  const related = records.some((record) =>
    campaignRelated({
      root,
      baseSha: plan.baseSha,
      candidateSha: plan.candidateSha,
      record,
      prNumber: environment.SOUNDING_LINE_PR_NUMBER,
    }),
  );
  if (!related) {
    fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  }
  const { planProductExperience } = await import("./product-experience.mjs");
  const candidateSha = git(root, "rev-parse", "HEAD");
  if (candidateSha !== plan.candidateSha) fail("EXECUTION_HEAD_CHANGED");
  const changedPaths = git(root, "diff", "--name-only", "--no-renames", plan.baseSha, candidateSha).split(/\r?\n/u);
  const actual = planProductExperience({
    root,
    baseSha: plan.baseSha,
    candidateSha,
    changedPaths,
    prNumber: environment.SOUNDING_LINE_PR_NUMBER,
  });
  if (!actual.exception) fail("APPROVAL_MISSING_OR_INACTIVE");
  if (environment.SOUNDING_LINE_R3_LOCAL_LEASE) {
    if (kind !== "experience" || environment.GITHUB_ACTIONS === "true" || actual.exception.id !== CROSSDECK_R3.id)
      fail("R3_LOCAL_PROOF_SCOPE_CHANGED");
    const marker = JSON.parse(readFileSync(r3LocalMarkerPath(root), "utf8"));
    if (
      marker.status !== "STARTED" ||
      marker.lease !== environment.SOUNDING_LINE_R3_LOCAL_LEASE ||
      digest(marker.binding) !== digest(exceptionBinding(actual))
    )
      fail("R3_LOCAL_PROOF_CONSUMED_OR_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("R3_LOCAL_PROOF_OWNER_EXITED");
    }
    if (plan.localProof !== CROSSDECK_R3.id || !["NORMAL", "REDUCED"].includes(plan.localProofMotionMode))
      fail("R3_LOCAL_PROOF_SCOPE_CHANGED");
    validateExceptionExecutionPlan(r3LocalPlan(actual, plan.localProofMotionMode), plan);
    if (claim) claimExceptionPhase({ root, phase: `r3-local-launch-${plan.localProofMotionMode}`, plan, runId: 0 });
    return { ...marker, preparationReservation: "LOCAL_PROOF_NOT_PROTECTED_PREPARATION" };
  }
  validateExceptionExecutionPlan(plan, actual);
  const record = trustedExceptions(root, plan.baseSha).find((value) => value.id === actual.exception.id);
  const phase = environment.SOUNDING_LINE_EXCEPTION_PHASE;
  if (
    !["prepare", "qualify"].includes(phase) ||
    (kind !== "experience" && phase !== "qualify") ||
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_RUN_ATTEMPT !== "1" ||
    environment.GITHUB_JOB !== (phase === "prepare" ? "experience-preparation" : "final-check")
  )
    fail("EXECUTION_PHASE_FORBIDDEN");
  const phaseName = kind === "ordinary" ? "ordinary" : kind === "technical" ? "technical" : "experience";
  if (!claim) return requireExceptionPhase({ root, phase: phaseName, plan, environment });
  if (kind === "technical")
    requireExceptionPhase({
      root,
      phase: "ordinary",
      plan,
      environment: {
        ...environment,
        SOUNDING_LINE_EXCEPTION_LEASE: environment.SOUNDING_LINE_EXCEPTION_ORDINARY_LEASE,
      },
    });
  const api = request ?? githubRequest(record.repository);
  await validateLiveContext({ record, plan, request: api, environment });
  const reservation = await exceptionStore({ record, request: api }).read(phase);
  if (
    !reservation ||
    digest(reservation.binding) !== digest(exceptionBinding(plan)) ||
    reservation.run.runId !== Number(environment.GITHUB_RUN_ID) ||
    (phase === "qualify" && reservation.candidateSha !== candidateSha)
  )
    fail("EXECUTION_RESERVATION_MISSING");
  if (kind === "experience" && phase === "qualify" && !existsSync(phasePath(root, "technical-complete")))
    fail("TECHNICAL_VERIFICATION_NOT_COMPLETE");
  const prepare = phase === "prepare" ? reservation : await exceptionStore({ record, request: api }).read("prepare");
  return claimExceptionPhase({
    root,
    phase: phaseName,
    plan,
    runId: Number(environment.GITHUB_RUN_ID),
    preparationReservation: prepare.commitSha,
    ...([CROSSDECK_R2.id, CROSSDECK_R3.id].includes(record.id)
      ? {
          executionHistory: {
            ...record.attemptHistory,
            stage: phase,
            ...(phase === "prepare"
              ? { executedAttemptsIncludingThisPreparation: record.attemptHistory.nextPreparationAttemptTotal }
              : {}),
          },
        }
      : {}),
  });
}
export function r3LocalMarkerPath(root) {
  return path.join(
    git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "sounding-line",
    `${CROSSDECK_R3.id}-local-proof.json`,
  );
}
export async function exceptionSuitePlan({ root, candidateSha, environment = process.env }) {
  if (!existsSync(path.join(root, ".git"))) return null;
  const baseSha = environment.SOUNDING_LINE_BASE_SHA ?? git(root, "merge-base", candidateSha, "origin/main");
  if (!recognizeExceptionExecution({ root, baseSha, candidateSha, environment })) return null;
  const { planProductExperience } = await import("./product-experience.mjs");
  const plan = planProductExperience({
    root,
    baseSha,
    candidateSha,
    changedPaths: git(root, "diff", "--name-only", "--no-renames", baseSha, candidateSha).split(/\r?\n/u),
    prNumber: environment.SOUNDING_LINE_PR_NUMBER,
  });
  if (!plan.exception) fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  return plan;
}
export function markExceptionTechnicalComplete(root, plan) {
  if (plan.exception)
    claimExceptionPhase({ root, phase: "technical-complete", plan, runId: Number(process.env.GITHUB_RUN_ID) });
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace ?? process.cwd());
  if (!["reserve", "seal"].includes(options.operation)) fail("OPERATION_FORBIDDEN");
  const baseSha = options.base,
    candidateSha = options.candidate;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const prNumber = event.pull_request?.number ?? event.inputs?.pr_number;
  const installedBase = process.env.GITHUB_SHA;
  const record = trustedExceptions(root, installedBase).find((value) =>
    campaignRelated({ root, baseSha: installedBase, candidateSha, record: value, prNumber }),
  );
  const output = (value) => {
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, value, { flag: "a" });
  };
  if (!record) {
    output("campaign=false\n");
    return;
  }
  if (baseSha !== installedBase) fail("INSTALLED_PROTECTED_BASE_REQUIRED");
  const { buildPlan } = await import("./ordinary.mjs");
  const { revisionJson, validateExperienceEvidence, productSourceDigest, sourceSnapshot, mergeExperienceContracts } =
    await import("./product-experience.mjs");
  const { loadTrustedExperienceArtifact, verifyTrustedExperienceAttestation } = await import(
    "./experience-attestation.mjs"
  );
  if (Number(prNumber) !== record.pullRequest || String(event.inputs?.experience_diagnostic) === "true")
    fail("TARGET_OR_SELECTED_SCOPE_CHANGED");
  const request = githubRequest(record.repository);
  const mode = event.inputs?.experience_mode ?? "ordinary";
  if (!["ordinary", "capture", "review", "verify"].includes(mode)) fail("MODE_FORBIDDEN");
  // Reserve before validation/downloads/setup can fail or be cancelled. The raw
  // source identity is an observation; it grants no admission until the complete
  // protected plan and all normal evidence gates subsequently validate it.
  const pendingPlan = {
    baseSha,
    candidateSha,
    sourceDigest: productSourceDigest(sourceSnapshot(root, candidateSha)),
    contractDigest:
      record.id === CROSSDECK_R3.id
        ? digest(
            mergeExperienceContracts(
              json(root, baseSha, "testing/contracts.json").contracts.filter((c) => c.experience),
              json(root, candidateSha, "testing/contracts.json").contracts,
            ).filter((c) => record.contractIds.includes(c.id)),
          )
        : record.contractDigest,
    exception: recordBinding(record),
  };
  const run = await validateLiveContext({
    record,
    plan: pendingPlan,
    request,
    requireHead: !["review", "verify"].includes(mode),
  });
  const store = exceptionStore({ record, request });
  const binding = exceptionBinding(pendingPlan);
  if (options.operation !== "seal")
    await reserveExceptionStage({ root, record, plan: pendingPlan, mode, run, store, request });
  const ordinary = await buildPlan({ root, baseSha, candidateSha, experienceEvidenceRequired: false, prNumber });
  const plan = ordinary.productExperience;
  if (
    digest(exceptionBinding(plan)) !== digest(binding) ||
    digest(ordinary.selected.browserTests) !== digest(record.requiredTechnicalBrowserTests)
  )
    fail("TARGET_OR_SELECTED_SCOPE_CHANGED");
  if (options.operation === "seal") {
    const qualification = await store.read("qualify");
    const decision = JSON.parse(readFileSync(options.decision, "utf8"));
    if (
      !qualification ||
      qualification.run.runId !== run.runId ||
      qualification.candidateSha !== candidateSha ||
      decision.decision !== "PASS" ||
      decision.baseSha !== baseSha ||
      decision.candidateSha !== candidateSha ||
      decision.candidateTree !== git(root, "rev-parse", `${candidateSha}^{tree}`) ||
      decision.candidateTree !== qualification.candidateTree ||
      decision.productExperienceDecision?.status !== "PASS" ||
      decision.productExperienceReplay?.status !== "PASS" ||
      decision.productExperienceReplay?.sourceDigest !== plan.sourceDigest ||
      decision.productExperience?.trustedAttestation?.status !== "PASS" ||
      digest(decision.productExperience?.exception) !== digest(plan.exception)
    )
      fail("FINAL_DECISION_MISMATCH");
    await store.create("qualified", {
      binding,
      run,
      candidateSha,
      candidateTree: decision.candidateTree,
      decisionDigest: digest(decision),
      status: "QUALIFIED_JOB_PASS_AWAITING_WHOLE_WORKFLOW_CONCLUSION",
    });
  } else if (mode === "capture") {
    // The reservation is already durable; a failed remainder is never refunded.
  } else {
    const prepare = await requireSuccessfulReservation({ store, slot: "prepare", plan, request });
    const evidenceRoot = path.resolve(options.evidence ?? root);
    const evidence =
      mode === "ordinary"
        ? revisionJson(root, candidateSha, plan.evidencePath)
        : JSON.parse(readFileSync(path.join(evidenceRoot, plan.evidencePath), "utf8"));
    validateExperienceEvidence({
      root: evidenceRoot,
      baselineRoot: root,
      plan,
      evidence,
      revision: mode === "ordinary" ? candidateSha : undefined,
    });
    if (mode === "review") {
      const capture = await loadTrustedExperienceArtifact({
        root,
        plan,
        artifactId: evidence.captureArtifactId,
        kind: "capture",
        policy: plan.attestationPolicy,
      });
      if (
        capture.exceptionPreparationReservation !== prepare.commitSha ||
        digest(capture.exception) !== digest(plan.exception) ||
        capture.trustedArtifact.runId !== prepare.run.runId ||
        digest(capture.artifacts) !== digest(evidence.artifacts) ||
        digest(capture.journeys) !== digest(evidence.journeys)
      )
        fail("CAPTURE_REVIEW_MISMATCH");
      const captureSeal = await store.read("capture");
      if (captureSeal) {
        if (digest(captureSeal.provenance) !== digest(capture.trustedArtifact)) fail("CAPTURE_ALREADY_SEALED");
      } else
        await store.create("capture", {
          binding,
          run: prepare.run,
          provenance: capture.trustedArtifact,
          status: "SUCCESSFUL_ORIGINAL_CAPTURE_SEALED",
        });
      const reviewIdentity = sealedReviewIdentity(plan, evidence);
      const reviewSlot = `review${record.remainingIndependentReviewOrdinal}`;
      const previous = await store.read(reviewSlot);
      if (previous) {
        if (digest(previous.reviewIdentity) !== digest(reviewIdentity)) fail("REVIEW3_ALREADY_SEALED");
        const original = await request(`actions/runs/${previous.run.runId}`);
        if (original?.conclusion !== "success" || original.run_attempt !== 1)
          fail("ORIGINAL_REVIEW_SUBMISSION_NOT_SUCCESSFUL");
      } else
        await store.create(reviewSlot, {
          binding,
          run,
          reviewIdentity,
          prepareReservation: prepare.commitSha,
          status: `EXACT_REVIEW${record.remainingIndependentReviewOrdinal}_SEALED_PENDING_SUCCESSFUL_AUTHENTICATED_SUBMISSION`,
        });
    } else if (["ordinary", "verify"].includes(mode)) {
      await verifyTrustedExperienceAttestation({ root, plan, evidence });
    } else fail("MODE_FORBIDDEN");
  }
  output(`campaign=true\nphase=${mode === "capture" ? "prepare" : "qualify"}\n`);
}
// Avoid a top-level-await cycle: ordinary imports this module and the trusted CLI
// loads ordinary only after deciding whether the finite campaign applies.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
