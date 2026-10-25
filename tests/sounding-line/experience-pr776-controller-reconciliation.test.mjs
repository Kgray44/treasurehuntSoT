import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PR776_CONTROLLER as P,
  PR776_CONTROLLER_PATHS,
  PR776_TRANSPORT_PREDECESSOR as T,
  PR776_TRANSPORT_REPAIR_PATHS,
  PR776_RECORD_PATH,
  bindPR776ControllerReconciliation,
  validatePR776ReviewedIdentity,
  pr776HistoricalReviewedPlan,
  validatePR776TrustedCapture,
  pr776ReviewSubmissionBinding,
  validatePR776ReviewSubmission,
} from "../../scripts/sounding-line/experience-pr776-controller-reconciliation.mjs";
import { validateAttestationProvenance } from "../../scripts/sounding-line/experience-attestation.mjs";
import { createReviewSubmission } from "../../scripts/sounding-line/experience-prepare.mjs";

// Pure source-policy fixtures: these hashes do not represent real new commits or an owner decision.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const E = "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025";
const C = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const I = "Development_Docs/document-index.json";
const M = "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
const read = (file) => fs.readFileSync(path.join(root, file));
const original = JSON.parse(read(E + "/accepted-canonical.original.json"));
const historical = JSON.parse(read(E + "/captured-plan.original.json"));
const inventory = JSON.parse(read(E + "/public-files-941.original.json"));
const template = JSON.parse(read(PR776_RECORD_PATH));
const json = (value) => Buffer.from(JSON.stringify(value));
const added = [
  "accepted-canonical.original.json",
  "independent-review.original.json",
  "captured-plan.original.json",
  "public-files-941.original.json",
  "controller-reconciliation.json",
].map((file) => E + "/" + file);
const CURRENT_SOURCE = "8".repeat(64);
const BASE = "b".repeat(40),
  CANDIDATE = "c".repeat(40),
  POLICY_HEAD = "d".repeat(40),
  TREE = "e".repeat(40);
function fixture() {
  const f = {
    plan: {
      ...structuredClone(historical),
      sourceDigest: CURRENT_SOURCE,
      baseSha: BASE,
      candidateSha: CANDIDATE,
      candidateTree: TREE,
    },
    evidence: structuredClone(original),
    record: { ...structuredClone(template), status: "ACTIVE", expectedCurrentSourceDigest: CURRENT_SOURCE },
    parents: [T.base, POLICY_HEAD],
    predecessorParents: [...T.baseParents],
    predecessorTree: T.baseTree,
    predecessorHeadTree: T.baseTree,
    carrierParents: [...T.candidateParents],
    carrierTree: T.candidateTree,
    carrierAncestry: true,
    repairChanges: [...PR776_TRANSPORT_REPAIR_PATHS],
    baseChanges: [...PR776_CONTROLLER_PATHS],
    candidateChanges: [...PR776_CONTROLLER_PATHS],
    oldTree: new Map(inventory.map((row) => [row.path, `100644 blob ${row.blob}`])),
    baseTree: new Map(Object.entries(template.requiredRepairBlobs).map(([file, oid]) => [file, `100644 blob ${oid}`])),
    canonical: structuredClone(original),
    ancestry: true,
    recordPresent: true,
  };
  f.candidateTree = new Map([...f.oldTree, ...f.baseTree]);
  f.oldIndex = {
    version: 1,
    generated_at: "2026-10-25",
    records: [{ path: "Development_Docs/existing.md", record_type: "engineering-record", status: "current" }],
  };
  f.baseIndex = {
    ...f.oldIndex,
    records: [
      ...f.oldIndex.records,
      ...added.map((file) => ({ path: file, record_type: "engineering-record", status: "current" })),
    ],
  };
  f.currentIndex = structuredClone(f.baseIndex);
  f.oldMatrix = 'header\n"Development_Docs/existing.md","historical status preserved"\n';
  f.currentMatrix = f.oldMatrix + added.map((file) => `"${file}","generated migration inventory"`).join("\n") + "\n";
  f.git = (_, args) => {
    if (args[0] === "show" && args[1] === "-s")
      return Buffer.from(
        (args[3] === T.base ? f.predecessorParents : args[3] === T.candidate ? f.carrierParents : f.parents).join(" "),
      );
    if (args[0] === "rev-parse")
      return Buffer.from(
        args[1] === T.base + "^{tree}"
          ? f.predecessorTree
          : args[1] === T.baseParents[1] + "^{tree}"
            ? f.predecessorHeadTree
            : args[1] === T.candidate + "^{tree}"
              ? f.carrierTree
              : TREE,
      );
    if (args[0] === "merge-base") {
      assert.equal(f.ancestry, true, "ANCESTRY_REJECTED");
      if (args[2] === T.candidate) assert.equal(f.carrierAncestry, true, "CFB_ANCESTRY_REJECTED");
      return Buffer.alloc(0);
    }
    if (args[0] === "diff")
      return Buffer.from(
        (args[3] === P.oldBase
          ? f.baseChanges
          : args[3] === T.base && args[4] === BASE
            ? f.repairChanges
            : f.candidateChanges
        ).join("\n"),
      );
    if (args[0] === "ls-tree" && args[1] === "-z")
      return f.recordPresent ? Buffer.from("record exists") : Buffer.alloc(0);
    if (args[0] === "ls-tree") {
      const map = args[2] === P.ancestor ? f.oldTree : args[2] === BASE ? f.baseTree : f.candidateTree;
      return Buffer.from([...map].map(([file, meta]) => `${meta}\t${file}\0`).join(""));
    }
    if (args[0] === "show") {
      const i = args[1].indexOf(":"),
        revision = args[1].slice(0, i),
        file = args[1].slice(i + 1);
      if (file === PR776_RECORD_PATH) return json(f.record);
      if (file === C) return json(f.canonical);
      if (file === I)
        return json(revision === P.ancestor ? f.oldIndex : revision === BASE ? f.baseIndex : f.currentIndex);
      if (file === M) return Buffer.from(revision === P.ancestor ? f.oldMatrix : f.currentMatrix);
      return read(file);
    }
    throw Error("UNEXPECTED_POLICY_READ:" + args.join(" "));
  };
  f.bind = () =>
    bindPR776ControllerReconciliation({ root: "pure-fixture", plan: f.plan, prNumber: 776, readGit: f.git });
  f.validate = () => validatePR776ReviewedIdentity(f.bind(), f.evidence, { root: "pure-fixture", readGit: f.git });
  return f;
}
test("finite second controller merge retains the exact spent32-row review with zero new passes", () => {
  const f = fixture(),
    current = f.bind(),
    old = pr776HistoricalReviewedPlan(current);
  assert.equal(f.validate(), true);
  assert.equal(old.baseSha, P.oldBase);
  assert.equal(old.sourceDigest, P.sourceDigest);
  assert.equal(current.sourceDigest, CURRENT_SOURCE);
  assert.equal(current.pr776ControllerReconciliation.originalSourceDigest, P.sourceDigest);
  assert.equal(current.pr776ControllerReconciliation.currentSourceDigest, CURRENT_SOURCE);
  assert.equal(current.baseSha, BASE);
  assert.deepEqual(old.contracts, historical.contracts);
  assert.deepEqual(f.evidence.reviews, original.reviews);
  assert.equal(current.pr776ControllerReconciliation.additionalIndependentPasses, 0);
});
test("only a subsequently authenticated numeric reviewArtifactId may be added", () => {
  const f = fixture();
  f.evidence.reviewArtifactId = 123;
  f.canonical.reviewArtifactId = 123;
  assert.equal(f.validate(), true);
});
for (const [name, mutate] of [
  [
    "changed product source",
    (f) => {
      f.plan.sourceDigest = "a".repeat(64);
    },
  ],
  [
    "changed contract digest",
    (f) => {
      f.plan.contractDigest = "a".repeat(64);
    },
  ],
  [
    "changed required state",
    (f) => {
      f.plan.contracts[0].experience.states.push("FORGED");
    },
  ],
  [
    "changed118 context denominator",
    (f) => {
      f.plan.contextCount = 119;
    },
  ],
  [
    "missing browser obligation",
    (f) => {
      f.plan.browserTests.pop();
    },
  ],
  [
    "later protected base",
    (f) => {
      f.parents[0] = "a".repeat(40);
    },
  ],
  [
    "non-normal merge",
    (f) => {
      f.parents.pop();
    },
  ],
  [
    "unrelated protected source",
    (f) => {
      f.baseChanges.push("src/unrelated.ts");
    },
  ],
  [
    "different required repair blob",
    (f) => {
      f.baseTree.set("scripts/sounding-line/experience-attestation.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "uninstalled proposed authority",
    (f) => {
      f.record.status = "PROPOSED_NOT_INSTALLED";
    },
  ],
  [
    "new independent pass",
    (f) => {
      f.record.additionalIndependentPasses = 1;
    },
  ],
  [
    "unrelated candidate source",
    (f) => {
      f.candidateChanges.push("src/unrelated.ts");
    },
  ],
  [
    "lost703 ancestor",
    (f) => {
      f.ancestry = false;
    },
  ],
  [
    "changed current media",
    (f) => {
      const row = inventory.find((x) => x.path.endsWith(".png"));
      f.candidateTree.set(row.path, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed original941 snapshot",
    (f) => {
      f.oldTree.delete(inventory[0].path);
    },
  ],
  [
    "fifth review",
    (f) => {
      f.evidence.reviews.find((row) => row.iterations === 4).iterations = 5;
    },
  ],
  [
    "changed review row",
    (f) => {
      f.evidence.reviews[0].status = "BLOCKED";
    },
  ],
  [
    "changed journey",
    (f) => {
      f.evidence.journeys[0].status = "FAIL";
    },
  ],
  [
    "changed published canonical",
    (f) => {
      f.canonical.reviews[0].iterations = 5;
    },
  ],
  [
    "forged reviewArtifactId",
    (f) => {
      f.evidence.reviewArtifactId = "123";
    },
  ],
  [
    "negative reviewArtifactId",
    (f) => {
      f.evidence.reviewArtifactId = -1;
    },
  ],
  [
    "changed old index status",
    (f) => {
      f.currentIndex.records[0].status = "archived";
    },
  ],
  [
    "unrelated index addition",
    (f) => {
      f.currentIndex.records.push({ path: "Development_Docs/unrelated.md" });
    },
  ],
  [
    "changed admitted index row",
    (f) => {
      f.currentIndex.records[1].status = "archived";
    },
  ],
  [
    "lost historical matrix row",
    (f) => {
      f.currentMatrix = f.currentMatrix
        .split("\n")
        .filter((line) => !line.includes("historical status"))
        .join("\n");
    },
  ],
  [
    "unrelated matrix addition",
    (f) => {
      f.currentMatrix += '"Development_Docs/unrelated.md"\n';
    },
  ],
])
  test(name + " fails closed", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });

function provenance(plan, kind) {
  return {
    artifact: {
      id: kind === "capture" ? P.captureArtifactId : 123,
      name: `product-experience-${kind}-${plan.sourceDigest.slice(0, 16)}`,
      expired: false,
      digest: kind === "capture" ? P.captureDigest : "sha256:" + "f".repeat(64),
      workflow_run: { id: kind === "capture" ? P.captureRunId : 456 },
    },
    run: {
      id: kind === "capture" ? P.captureRunId : 456,
      event: "workflow_dispatch",
      head_branch: "main",
      head_sha: plan.baseSha,
      head_repository: { full_name: "Kgray44/treasurehuntSoT" },
      actor: { login: "Kgray44" },
      conclusion: "success",
      run_attempt: 1,
    },
    workflow: { path: ".github/workflows/sounding-line-ordinary.yml" },
    plan,
    kind,
    repository: "Kgray44/treasurehuntSoT",
    actors: ["Kgray44"],
  };
}
test("actual provenance validator authenticates old capture and new machine review separately", () => {
  const f = fixture(),
    current = f.bind(),
    old = pr776HistoricalReviewedPlan(current);
  assert.equal(validateAttestationProvenance(provenance(old, "capture")), true);
  assert.equal(validateAttestationProvenance(provenance(current, "review")), true);
  const wrongCapture = provenance(current, "capture");
  wrongCapture.run.head_sha = P.oldBase;
  assert.throws(() => validateAttestationProvenance(wrongCapture), /ATTESTATION_PROVENANCE_INVALID/u);
  const wrongReview = provenance(current, "review");
  wrongReview.run.head_sha = P.oldBase;
  assert.throws(() => validateAttestationProvenance(wrongReview), /ATTESTATION_PROVENANCE_INVALID/u);
  validatePR776TrustedCapture(current, {
    baseSha: P.oldBase,
    sourceDigest: P.sourceDigest,
    contractDigest: P.contractDigest,
    trustedArtifact: { id: P.captureArtifactId, runId: P.captureRunId, runAttempt: 1, digest: P.captureDigest },
  });
  validatePR776ReviewSubmission(current, pr776ReviewSubmissionBinding(current));
});
for (const [name, mutate] of [
  [
    "expired",
    (p) => {
      p.artifact.expired = true;
    },
  ],
  [
    "untrusted actor",
    (p) => {
      p.run.actor.login = "forged";
    },
  ],
  [
    "wrong workflow",
    (p) => {
      p.workflow.path = ".github/workflows/forged.yml";
    },
  ],
  [
    "failed workflow",
    (p) => {
      p.run.conclusion = "failure";
    },
  ],
  [
    "missing digest",
    (p) => {
      delete p.artifact.digest;
    },
  ],
])
  test(name + " remains rejected by actual provenance validator", () => {
    const p = provenance(fixture().bind(), "review");
    mutate(p);
    assert.throws(() => validateAttestationProvenance(p));
  });
for (const field of ["id", "runId", "runAttempt", "digest"])
  test("changed capture " + field + " fails closed", () => {
    const current = fixture().bind(),
      capture = {
        baseSha: P.oldBase,
        sourceDigest: P.sourceDigest,
        contractDigest: P.contractDigest,
        trustedArtifact: { id: P.captureArtifactId, runId: P.captureRunId, runAttempt: 1, digest: P.captureDigest },
      };
    capture.trustedArtifact[field] = field === "digest" ? "sha256:" + "f".repeat(64) : 999;
    assert.throws(() => validatePR776TrustedCapture(current, capture));
  });
test("machine review cannot forge a different current-controller binding", () => {
  const current = fixture().bind(),
    review = pr776ReviewSubmissionBinding(current);
  review.pr776ControllerReconciliation = { ...review.pr776ControllerReconciliation, currentBaseSha: P.oldBase };
  assert.throws(() => validatePR776ReviewSubmission(current, review));
});

test("absent protected record preserves the ordinary legacy path", () => {
  const f = fixture();
  f.recordPresent = false;
  assert.equal(f.bind(), f.plan);
});
test("a metadata-only authentic review-ID successor retains the same stable submission binding", () => {
  const f = fixture(),
    submitted = f.bind(),
    review = pr776ReviewSubmissionBinding(submitted);
  f.plan.candidateSha = "f".repeat(40);
  f.evidence.reviewArtifactId = 123;
  f.canonical.reviewArtifactId = 123;
  const successor = f.bind();
  assert.notEqual(successor.candidateSha, submitted.candidateSha);
  assert.deepEqual(successor.pr776ControllerReconciliation, submitted.pr776ControllerReconciliation);
  validatePR776ReviewSubmission(successor, review);
  assert.equal(f.validate(), true);
  f.evidence.journeys[0].status = "FORGED";
  assert.throws(f.validate);
});
test("published canonical review ID must be positive and match the authenticated evidence ID", () => {
  const f = fixture();
  f.canonical.reviewArtifactId = "forged";
  assert.throws(f.validate);
  f.canonical.reviewArtifactId = 123;
  f.evidence.reviewArtifactId = 124;
  assert.throws(f.validate);
});

test("current review header and historical capture retain their distinct source digests", () => {
  const f = fixture(),
    current = f.bind(),
    old = pr776HistoricalReviewedPlan(current),
    submission = createReviewSubmission({ baseSha: BASE, plan: current, evidence: f.evidence, submittedBy: "Kgray44" });
  assert.equal(submission.sourceDigest, CURRENT_SOURCE);
  assert.equal(submission.baseSha, BASE);
  assert.equal(old.sourceDigest, P.sourceDigest);
  assert.equal(f.evidence.sourceDigest, P.sourceDigest);
  assert.deepEqual(submission.reviews, original.reviews);
  assert.equal(submission.pr776ControllerReconciliation.originalSourceDigest, P.sourceDigest);
  assert.equal(submission.pr776ControllerReconciliation.currentSourceDigest, CURRENT_SOURCE);
});
test("forged or missing protected current digest cannot rebind the spent review", () => {
  const f = fixture();
  f.record.expectedCurrentSourceDigest = "a".repeat(64);
  assert.throws(f.validate, /CURRENT_SOURCE_IDENTITY/u);
  delete f.record.expectedCurrentSourceDigest;
  assert.throws(f.validate, /CURRENT_SOURCE_IDENTITY/u);
  f.record.expectedCurrentSourceDigest = P.sourceDigest;
  f.plan.sourceDigest = P.sourceDigest;
  assert.throws(f.validate, /CURRENT_SOURCE_IDENTITY/u);
});
test("old capture cannot claim the new controller source digest", () => {
  const current = fixture().bind();
  assert.throws(
    () =>
      validatePR776TrustedCapture(current, {
        baseSha: P.oldBase,
        sourceDigest: CURRENT_SOURCE,
        contractDigest: P.contractDigest,
        trustedArtifact: { id: P.captureArtifactId, runId: P.captureRunId, runAttempt: 1, digest: P.captureDigest },
      }),
    /TRUSTED_CAPTURE_CHANGED/u,
  );
});

test("frozen first controller merge and current candidate are exact finite predecessor identities", () => {
  const f = fixture();
  assert.equal(T.base, "cbc3e643cc11c172983fb8f6f43036abda590182");
  assert.deepEqual(T.baseParents, [P.oldBase, "b86fe3abd41daf21e62a7dc876653982fa42bbe4"]);
  assert.equal(T.baseTree, "2ae61a4350de4b530fb2668974f8a7b1e65511aa");
  assert.equal(T.candidate, "cfb1c0ef80f9244b73653c7b41dc063732262e2d");
  assert.deepEqual(T.candidateParents, [P.ancestor, T.base]);
  assert.equal(T.candidateTree, "e36b5d79f5067680d7376a83d9b41104d497796b");
  assert.equal(T.sourceDigest, "36cd7941da620b2fe417dcc99d74f6c13719dde9d6dea500777a75737f677c6f");
  assert.equal(f.validate(), true);
  assert.deepEqual(f.record.originalIdentity, P);
  assert.deepEqual(f.record.transportPredecessor, T);
  assert.deepEqual(f.evidence.reviews, original.reviews);
});
for (const [name, mutate] of [
  [
    "first merge as transport base",
    (f) => {
      f.plan.baseSha = T.base;
      f.parents = [...T.baseParents];
    },
  ],
  [
    "third controller merge",
    (f) => {
      f.parents[0] = BASE;
    },
  ],
  [
    "different first controller parents",
    (f) => {
      f.predecessorParents[1] = POLICY_HEAD;
    },
  ],
  [
    "different first controller tree",
    (f) => {
      f.predecessorTree = TREE;
    },
  ],
  [
    "different first qualified head tree",
    (f) => {
      f.predecessorHeadTree = TREE;
    },
  ],
  [
    "different current candidate parents",
    (f) => {
      f.carrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "different current candidate tree",
    (f) => {
      f.carrierTree = TREE;
    },
  ],
  [
    "lost current CFB ancestry",
    (f) => {
      f.carrierAncestry = false;
    },
  ],
  [
    "unrelated second repair change",
    (f) => {
      f.repairChanges.push("src/unrelated.ts");
    },
  ],
  [
    "missing second repair change",
    (f) => {
      f.repairChanges.pop();
    },
  ],
  [
    "changed predecessor record",
    (f) => {
      f.record.transportPredecessor.base = POLICY_HEAD;
    },
  ],
])
  test(name + " fails the finite second controller bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
