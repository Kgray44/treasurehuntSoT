import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PR776_CONTROLLER as P,
  PR776_FIXTURE_SCOPE_PREDECESSOR as Z,
  PR776_AUTH_REUSE_PREDECESSOR as A,
  PR776_FIXTURE_SCOPE_PATHS,
  PR776_FIXTURE_SCOPE_REPAIR_PATHS,
  PR776_CURRENT_REPAIR_PATHS,
  PR776_AUTH_SESSION_BASE,
  PR776_CONTROLLER_PATHS,
  PR776_TRANSPORT_PREDECESSOR as T,
  PR776_TRANSPORT_REPAIR_PATHS,
  PR776_OBSERVABILITY_PREDECESSOR as O,
  PR776_OBSERVABILITY_ADDED_PATHS,
  PR776_OBSERVABILITY_REPAIR_PATHS,
  PR776_INTAKE_PREDECESSOR as N,
  PR776_INTAKE_ADDED_PATHS,
  PR776_INTAKE_REPAIR_PATHS,
  PR776_PATH_CHECK_PREDECESSOR as K,
  PR776_PATH_CHECK_ADDED_PATHS,
  PR776_PATH_CHECK_REPAIR_PATHS,
  PR776_SQLITE_PREDECESSOR as S,
  PR776_SQLITE_ADDED_PATHS,
  PR776_SQLITE_REPAIR_PATHS,
  PR776_READER_PREDECESSOR as J,
  PR776_READER_REPAIR_PATHS,
  PR776_FINAL_BUDGET_PREDECESSOR as V,
  PR776_GENERIC_BUDGET_PREDECESSOR as W,
  PR776_GENERIC_BUDGET_ADDED_PATHS,
  PR776_GENERIC_BUDGET_REPAIR_PATHS,
  PR776_FINAL_BUDGET_REPAIR_PATHS,
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
const priorControllerPaths = PR776_CONTROLLER_PATHS.filter((file) => !PR776_GENERIC_BUDGET_ADDED_PATHS.includes(file));
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
    parents: [PR776_AUTH_SESSION_BASE, POLICY_HEAD],
    fixtureScopeParents: [...Z.baseParents],
    fixtureScopeTree: Z.baseTree,
    fixtureScopeHeadTree: Z.baseTree,
    fixtureScopeCarrierParents: [...Z.candidateParents],
    fixtureScopeCarrierTree: Z.candidateTree,
    fixtureScopeCarrierAncestry: true,
    fixtureScopeCanonicalTree: new Map([[C, `100644 blob ${Z.canonicalBlob}`]]),
    fixtureScopeControllerChanges: [...PR776_CONTROLLER_PATHS],
    fixtureScopeChanges: [...PR776_FIXTURE_SCOPE_REPAIR_PATHS],
    currentRepairChanges: [...PR776_CURRENT_REPAIR_PATHS],
    authReuseParents: [...A.baseParents],
    authReuseTree: A.baseTree,
    authReuseHeadTree: A.baseTree,
    authReuseCarrierParents: [...A.candidateParents],
    authReuseCarrierTree: A.candidateTree,
    authReuseCarrierAncestry: true,
    authReuseCanonicalTree: new Map([[C, `100644 blob ${A.canonicalBlob}`]]),
    authReuseChanges: [...PR776_CURRENT_REPAIR_PATHS],
    authSessionChanges: [...PR776_FIXTURE_SCOPE_REPAIR_PATHS],
    predecessorParents: [...T.baseParents],
    predecessorTree: T.baseTree,
    predecessorHeadTree: T.baseTree,
    carrierParents: [...T.candidateParents],
    carrierTree: T.candidateTree,
    carrierAncestry: true,
    observedParents: [...O.baseParents],
    observedTree: O.baseTree,
    observedHeadTree: O.baseTree,
    observedCarrierParents: [...O.candidateParents],
    observedCarrierTree: O.candidateTree,
    observedCarrierAncestry: true,
    intakeParents: [...N.baseParents],
    intakeTree: N.baseTree,
    intakeHeadTree: N.baseTree,
    intakeCarrierParents: [...N.candidateParents],
    intakeCarrierTree: N.candidateTree,
    intakeCarrierAncestry: true,
    pathCheckParents: [...K.baseParents],
    pathCheckTree: K.baseTree,
    pathCheckHeadTree: K.baseTree,
    pathCheckCarrierParents: [...K.candidateParents],
    pathCheckCarrierTree: K.candidateTree,
    pathCheckCarrierAncestry: true,
    sqliteParents: [...S.baseParents],
    sqliteTree: S.baseTree,
    sqliteHeadTree: S.baseTree,
    sqliteCarrierParents: [...S.candidateParents],
    sqliteCarrierTree: S.candidateTree,
    sqliteCarrierAncestry: true,
    readerParents: [...J.baseParents],
    readerTree: J.baseTree,
    readerHeadTree: J.baseTree,
    readerCarrierParents: [...J.candidateParents],
    readerCarrierTree: J.candidateTree,
    readerCarrierAncestry: true,
    genericBudgetParents: [...W.baseParents],
    genericBudgetTree: W.baseTree,
    genericBudgetHeadTree: W.baseTree,
    genericBudgetCarrierParents: [...W.candidateParents],
    genericBudgetCarrierTree: W.candidateTree,
    genericBudgetCarrierAncestry: true,
    genericBudgetCanonicalTree: new Map([[C, `100644 blob ${W.canonicalBlob}`]]),
    budgetParents: [...V.baseParents],
    budgetTree: V.baseTree,
    budgetHeadTree: V.baseTree,
    budgetCarrierParents: [...V.candidateParents],
    budgetCarrierTree: V.candidateTree,
    budgetCarrierAncestry: true,
    budgetCanonicalTree: new Map([[C, `100644 blob ${V.canonicalBlob}`]]),
    readerCanonicalTree: new Map([[C, `100644 blob ${J.canonicalBlob}`]]),
    sqliteCanonicalTree: new Map([[C, `100644 blob ${S.canonicalBlob}`]]),
    pathCheckCanonicalTree: new Map([[C, `100644 blob ${K.canonicalBlob}`]]),
    intakeCanonicalTree: new Map([[C, `100644 blob ${N.canonicalBlob}`]]),
    frozenCanonicalTree: new Map([[C, `100644 blob ${O.canonicalBlob}`]]),
    historicalCanonicalBlobReads: 0,
    transportChanges: [...PR776_TRANSPORT_REPAIR_PATHS],
    frozenControllerChanges: priorControllerPaths.filter(
      (file) =>
        !PR776_OBSERVABILITY_ADDED_PATHS.includes(file) &&
        !PR776_INTAKE_ADDED_PATHS.includes(file) &&
        !PR776_PATH_CHECK_ADDED_PATHS.includes(file) &&
        !PR776_SQLITE_ADDED_PATHS.includes(file),
    ),
    observedControllerChanges: priorControllerPaths.filter(
      (file) =>
        !PR776_INTAKE_ADDED_PATHS.includes(file) &&
        !PR776_PATH_CHECK_ADDED_PATHS.includes(file) &&
        !PR776_SQLITE_ADDED_PATHS.includes(file),
    ),
    intakeControllerChanges: priorControllerPaths.filter(
      (file) => !PR776_PATH_CHECK_ADDED_PATHS.includes(file) && !PR776_SQLITE_ADDED_PATHS.includes(file),
    ),
    pathCheckChanges: [...PR776_PATH_CHECK_REPAIR_PATHS],
    sqliteControllerChanges: priorControllerPaths.filter((file) => !PR776_SQLITE_ADDED_PATHS.includes(file)),
    sqliteChanges: [...PR776_SQLITE_REPAIR_PATHS],
    readerControllerChanges: [...priorControllerPaths],
    readerChanges: [...PR776_READER_REPAIR_PATHS],
    budgetControllerChanges: [...priorControllerPaths],
    budgetChanges: [...PR776_FINAL_BUDGET_REPAIR_PATHS],
    genericBudgetControllerChanges: [...priorControllerPaths],
    genericBudgetChanges: [...PR776_GENERIC_BUDGET_REPAIR_PATHS],
    intakeChanges: [...PR776_INTAKE_REPAIR_PATHS],
    repairChanges: [...PR776_OBSERVABILITY_REPAIR_PATHS],
    baseChanges: [...PR776_CONTROLLER_PATHS],
    candidateChanges: [...PR776_CONTROLLER_PATHS, ...PR776_FIXTURE_SCOPE_PATHS],
    oldTree: new Map(inventory.map((row) => [row.path, `100644 blob ${row.blob}`])),
    baseTree: new Map(Object.entries(template.requiredRepairBlobs).map(([file, oid]) => [file, `100644 blob ${oid}`])),
    canonical: structuredClone(original),
    ancestry: true,
    recordPresent: true,
  };
  f.candidateTree = new Map([
    ...f.oldTree,
    ...f.baseTree,
    ...Object.entries(template.candidateFixtureBlobs).map(([file, oid]) => [file, `100644 blob ${oid}`]),
  ]);
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
    if (args[0] === "show" && args[1] === "-s" && [A.base, A.candidate].includes(args[3]))
      return Buffer.from((args[3] === A.base ? f.authReuseParents : f.authReuseCarrierParents).join(" "));
    if (args[0] === "rev-parse" && [A.base, A.baseParents[1], A.candidate].some((sha) => args[1] === sha + "^{tree}"))
      return Buffer.from(
        args[1] === A.base + "^{tree}"
          ? f.authReuseTree
          : args[1] === A.candidate + "^{tree}"
            ? f.authReuseCarrierTree
            : f.authReuseHeadTree,
      );
    if (args[0] === "diff" && args[3] === Z.base && args[4] === A.base)
      return Buffer.from(f.fixtureScopeChanges.join("\n"));
    if (args[0] === "diff" && args[3] === A.base && args[4] === PR776_AUTH_SESSION_BASE)
      return Buffer.from(f.authSessionChanges.join("\n"));
    if (args[0] === "diff" && args[3] === A.base && args[4] === BASE) return Buffer.from(f.authReuseChanges.join("\n"));
    if (args[0] === "merge-base" && args[2] === A.candidate)
      assert.equal(f.authReuseCarrierAncestry, true, "F17_ANCESTRY_REJECTED");
    if (args[0] === "ls-tree" && args[1] === "-rz" && args[2] === A.candidate)
      return Buffer.from([...f.authReuseCanonicalTree].map(([file, meta]) => `${meta}\t${file}\0`).join(""));
    if (args[0] === "show" && args[1] === "-s" && [Z.base, Z.candidate].includes(args[3]))
      return Buffer.from((args[3] === Z.base ? f.fixtureScopeParents : f.fixtureScopeCarrierParents).join(" "));
    if (args[0] === "rev-parse" && [Z.base, Z.baseParents[1], Z.candidate].some((sha) => args[1] === sha + "^{tree}"))
      return Buffer.from(
        args[1] === Z.base + "^{tree}"
          ? f.fixtureScopeTree
          : args[1] === Z.candidate + "^{tree}"
            ? f.fixtureScopeCarrierTree
            : f.fixtureScopeHeadTree,
      );
    if (args[0] === "diff") {
      if (args[3] === P.oldBase && args[4] === Z.base) return Buffer.from(f.fixtureScopeControllerChanges.join("\n"));
      if (args[3] === W.base && args[4] === Z.base) return Buffer.from(f.genericBudgetChanges.join("\n"));
      if (args[3] === Z.base && args[4] === BASE) return Buffer.from(f.currentRepairChanges.join("\n"));
    }
    if (args[0] === "merge-base" && args[2] === Z.candidate)
      assert.equal(f.fixtureScopeCarrierAncestry, true, "F16_ANCESTRY_REJECTED");
    if (args[0] === "ls-tree" && args[1] === "-rz" && args[2] === Z.candidate)
      return Buffer.from([...f.fixtureScopeCanonicalTree].map(([file, meta]) => `${meta}\t${file}\0`).join(""));

    if (args[0] === "show" && args[1] === "-s")
      return Buffer.from(
        (args[3] === T.base
          ? f.predecessorParents
          : args[3] === T.candidate
            ? f.carrierParents
            : args[3] === O.base
              ? f.observedParents
              : args[3] === O.candidate
                ? f.observedCarrierParents
                : args[3] === N.base
                  ? f.intakeParents
                  : args[3] === N.candidate
                    ? f.intakeCarrierParents
                    : args[3] === K.base
                      ? f.pathCheckParents
                      : args[3] === K.candidate
                        ? f.pathCheckCarrierParents
                        : args[3] === S.base
                          ? f.sqliteParents
                          : args[3] === S.candidate
                            ? f.sqliteCarrierParents
                            : args[3] === J.base
                              ? f.readerParents
                              : args[3] === J.candidate
                                ? f.readerCarrierParents
                                : args[3] === W.base
                                  ? f.genericBudgetParents
                                  : args[3] === W.candidate
                                    ? f.genericBudgetCarrierParents
                                    : args[3] === V.base
                                      ? f.budgetParents
                                      : args[3] === V.candidate
                                        ? f.budgetCarrierParents
                                        : f.parents
        ).join(" "),
      );
    if (args[0] === "rev-parse")
      return Buffer.from(
        args[1] === T.base + "^{tree}"
          ? f.predecessorTree
          : args[1] === T.baseParents[1] + "^{tree}"
            ? f.predecessorHeadTree
            : args[1] === T.candidate + "^{tree}"
              ? f.carrierTree
              : args[1] === O.base + "^{tree}"
                ? f.observedTree
                : args[1] === O.baseParents[1] + "^{tree}"
                  ? f.observedHeadTree
                  : args[1] === O.candidate + "^{tree}"
                    ? f.observedCarrierTree
                    : args[1] === N.base + "^{tree}"
                      ? f.intakeTree
                      : args[1] === N.baseParents[1] + "^{tree}"
                        ? f.intakeHeadTree
                        : args[1] === N.candidate + "^{tree}"
                          ? f.intakeCarrierTree
                          : args[1] === K.base + "^{tree}"
                            ? f.pathCheckTree
                            : args[1] === K.baseParents[1] + "^{tree}"
                              ? f.pathCheckHeadTree
                              : args[1] === K.candidate + "^{tree}"
                                ? f.pathCheckCarrierTree
                                : args[1] === S.base + "^{tree}"
                                  ? f.sqliteTree
                                  : args[1] === S.baseParents[1] + "^{tree}"
                                    ? f.sqliteHeadTree
                                    : args[1] === S.candidate + "^{tree}"
                                      ? f.sqliteCarrierTree
                                      : args[1] === J.base + "^{tree}"
                                        ? f.readerTree
                                        : args[1] === J.baseParents[1] + "^{tree}"
                                          ? f.readerHeadTree
                                          : args[1] === J.candidate + "^{tree}"
                                            ? f.readerCarrierTree
                                            : args[1] === W.base + "^{tree}"
                                              ? f.genericBudgetTree
                                              : args[1] === W.baseParents[1] + "^{tree}"
                                                ? f.genericBudgetHeadTree
                                                : args[1] === W.candidate + "^{tree}"
                                                  ? f.genericBudgetCarrierTree
                                                  : args[1] === V.base + "^{tree}"
                                                    ? f.budgetTree
                                                    : args[1] === V.baseParents[1] + "^{tree}"
                                                      ? f.budgetHeadTree
                                                      : args[1] === V.candidate + "^{tree}"
                                                        ? f.budgetCarrierTree
                                                        : TREE,
      );
    if (args[0] === "merge-base") {
      assert.equal(f.ancestry, true, "ANCESTRY_REJECTED");
      if (args[2] === T.candidate) assert.equal(f.carrierAncestry, true, "CFB_ANCESTRY_REJECTED");
      if (args[2] === O.candidate) assert.equal(f.observedCarrierAncestry, true, "5669_ANCESTRY_REJECTED");
      if (args[2] === N.candidate) assert.equal(f.intakeCarrierAncestry, true, "F_ANCESTRY_REJECTED");
      if (args[2] === K.candidate) assert.equal(f.pathCheckCarrierAncestry, true, "F10_ANCESTRY_REJECTED");
      if (args[2] === S.candidate) assert.equal(f.sqliteCarrierAncestry, true, "F12_ANCESTRY_REJECTED");
      if (args[2] === J.candidate) assert.equal(f.readerCarrierAncestry, true, "F13_ANCESTRY_REJECTED");
      if (args[2] === W.candidate) assert.equal(f.genericBudgetCarrierAncestry, true, "F15_ANCESTRY_REJECTED");
      if (args[2] === V.candidate) assert.equal(f.budgetCarrierAncestry, true, "F14_ANCESTRY_REJECTED");
      return Buffer.alloc(0);
    }
    if (args[0] === "diff")
      return Buffer.from(
        (args[3] === P.oldBase
          ? args[4] === O.base
            ? f.frozenControllerChanges
            : args[4] === N.base
              ? f.observedControllerChanges
              : args[4] === K.base
                ? f.intakeControllerChanges
                : args[4] === S.base
                  ? f.sqliteControllerChanges
                  : args[4] === J.base
                    ? f.readerControllerChanges
                    : args[4] === W.base
                      ? f.genericBudgetControllerChanges
                      : args[4] === V.base
                        ? f.budgetControllerChanges
                        : f.baseChanges
          : args[3] === T.base && args[4] === O.base
            ? f.transportChanges
            : args[3] === O.base && args[4] === N.base
              ? f.repairChanges
              : args[3] === N.base && args[4] === K.base
                ? f.intakeChanges
                : args[3] === K.base && args[4] === S.base
                  ? f.pathCheckChanges
                  : args[3] === S.base && args[4] === J.base
                    ? f.sqliteChanges
                    : args[3] === J.base && args[4] === V.base
                      ? f.readerChanges
                      : args[3] === V.base && args[4] === W.base
                        ? f.budgetChanges
                        : args[3] === W.base && args[4] === BASE
                          ? f.genericBudgetChanges
                          : f.candidateChanges
        ).join("\n"),
      );
    if (args[0] === "ls-tree" && args[1] === "-z")
      return f.recordPresent ? Buffer.from("record exists") : Buffer.alloc(0);
    if (args[0] === "ls-tree") {
      const map =
        args[2] === W.candidate
          ? f.genericBudgetCanonicalTree
          : args[2] === V.candidate
            ? f.budgetCanonicalTree
            : args[2] === J.candidate
              ? f.readerCanonicalTree
              : args[2] === S.candidate
                ? f.sqliteCanonicalTree
                : args[2] === K.candidate
                  ? f.pathCheckCanonicalTree
                  : args[2] === N.candidate
                    ? f.intakeCanonicalTree
                    : args[2] === O.candidate
                      ? f.frozenCanonicalTree
                      : args[2] === P.ancestor
                        ? f.oldTree
                        : args[2] === BASE
                          ? f.baseTree
                          : f.candidateTree;
      return Buffer.from([...map].map(([file, meta]) => `${meta}\t${file}\0`).join(""));
    }
    if (args[0] === "show") {
      const i = args[1].indexOf(":"),
        revision = args[1].slice(0, i),
        file = args[1].slice(i + 1);
      if (file === PR776_RECORD_PATH) return json(f.record);
      if (file === C) {
        if (
          revision === O.candidate ||
          revision === N.candidate ||
          revision === K.candidate ||
          revision === S.candidate ||
          revision === J.candidate ||
          revision === V.candidate ||
          revision === W.candidate ||
          revision === Z.candidate ||
          revision === A.candidate
        ) {
          f.historicalCanonicalBlobReads += 1;
          throw Error("FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ");
        }
        return json(f.canonical);
      }
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
test("finite eleventh controller merge retains the exact spent32-row review with zero new passes", () => {
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
    "ninth controller merge",
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
  test(name + " remains rejected by the finite eighth controller bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });

test("frozen M6 and ID-only5669 retain exact source, canonical and spent review identities", () => {
  const f = fixture();
  assert.equal(O.base, "e60d7db3b95c48c32306dd7682d4a132f3e54b3d");
  assert.deepEqual(O.baseParents, [T.base, "8762a4fe31e78d00d3b09d8f4c411c81203cf379"]);
  assert.equal(O.baseTree, "e8870c4279956e63cf95608de077f1a368ac7e2b");
  assert.equal(O.candidate, "5669b2484ba44f38d0a96ce3895f98bb61fb9d1d");
  assert.deepEqual(O.candidateParents, ["094331fc2defc8dabf4c0b4ba21ef0df7625b0e3"]);
  assert.equal(O.candidateTree, "cdfe106d91d6a7b8e12ad17f6b3b89f3f523a528");
  assert.equal(O.sourceDigest, "4f3baf77bb7a1d1b425da372f645527248b2f757adad9844c82c0e02d2465bda");
  assert.equal(O.canonicalSha256, "46e3f544db3f8472986b00d229f2662e901b7f6faf72ec38414c26847b4b80b0");
  assert.equal(O.reviewArtifactId, 12593074243);
  assert.equal(O.canonicalBlob, "14ad1d87c0b03064470896ff9a9d2b4ba90d4d2f");
  assert.equal(PR776_CONTROLLER_PATHS.length, 32);
  assert.equal(Object.keys(f.record.requiredRepairBlobs).length, 29);
  assert.equal(PR776_OBSERVABILITY_REPAIR_PATHS.length, 9);
  assert.deepEqual(f.record.originalIdentity, P);
  assert.deepEqual(f.record.transportPredecessor, T);
  assert.deepEqual(f.record.observabilityPredecessor, O);
  assert.equal(f.validate(), true);
});
for (const [name, mutate] of [
  [
    "M6 itself rather than one next normal merge",
    (f) => {
      f.plan.baseSha = O.base;
      f.parents = [...O.baseParents];
    },
  ],
  [
    "changed M6 parents",
    (f) => {
      f.observedParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M6 tree",
    (f) => {
      f.observedTree = TREE;
    },
  ],
  [
    "changed M6 qualified-head tree",
    (f) => {
      f.observedHeadTree = TREE;
    },
  ],
  [
    "changed5669 parent",
    (f) => {
      f.observedCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed5669 tree",
    (f) => {
      f.observedCarrierTree = TREE;
    },
  ],
  [
    "lost5669 ancestry",
    (f) => {
      f.observedCarrierAncestry = false;
    },
  ],
  [
    "changed frozen5669 canonical leaf",
    (f) => {
      f.frozenCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed frozen5669 canonical mode",
    (f) => {
      f.frozenCanonicalTree.set(C, `100755 blob ${O.canonicalBlob}`);
    },
  ],
  [
    "changed M6 transport delta",
    (f) => {
      f.transportChanges.pop();
    },
  ],
  [
    "changed M6 cumulative21 paths",
    (f) => {
      f.frozenControllerChanges.push("src/unrelated.ts");
    },
  ],
  [
    "changed observability predecessor record",
    (f) => {
      f.record.observabilityPredecessor.reviewArtifactId = 1;
    },
  ],
  [
    "unrelated next repair change",
    (f) => {
      f.repairChanges.push("src/unrelated.ts");
    },
  ],
  [
    "missing next repair change",
    (f) => {
      f.repairChanges.pop();
    },
  ],
])
  test(name + " fails the exact M6 observability bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("the spent5669 machine artifact cannot authenticate a successor controller tuple", () => {
  const current = fixture().bind();
  const oldMachineReview = provenance(current, "review");
  oldMachineReview.run.head_sha = O.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

test("frozen5669 canonical proof reads only historical tree metadata and never its blob", () => {
  const f = fixture();
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", O.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});

test("historical M6 guard excludes all five future-only observability and fixture paths", () => {
  assert.deepEqual(
    [...PR776_OBSERVABILITY_ADDED_PATHS].sort(),
    [
      "scripts/sounding-line/ordinary.mjs",
      "scripts/sounding-line/verification-diagnostics.mjs",
      "tests/sounding-line/browser-diagnostics.test.mjs",
      "tests/sounding-line/experience-r25.test.mjs",
      "tests/sounding-line/experience-r26.test.mjs",
    ].sort(),
  );
  for (const file of ["tests/sounding-line/experience-r25.test.mjs", "tests/sounding-line/experience-r26.test.mjs"]) {
    const f = fixture();
    assert(!f.frozenControllerChanges.includes(file));
    assert.equal(f.frozenControllerChanges.length, 21);
    assert.equal(f.validate(), true);
    f.frozenControllerChanges.push(file);
    assert.throws(f.validate, /FROZEN_TRANSPORT_PREDECESSOR_CHANGED/u);
  }
});

test("frozen M7 and F retain exact source and ID-only canonical identities without historical blob reads", () => {
  const f = fixture();
  assert.equal(N.base, "dfc5887b42058acc396ab291a2cd5dca430b0d80");
  assert.deepEqual(N.baseParents, [O.base, "1098dd6ce7d66f56fd2170e149ffdf7315a4a227"]);
  assert.equal(N.baseTree, "a6aaaf5678795dafac30bb355ee7fae2642ee03b");
  assert.equal(N.candidate, "5acc5b41aed5a59339cc17d82e118e5e38626048");
  assert.deepEqual(N.candidateParents, ["14503876329bb0bfc82b77174c6cf86dab39d997"]);
  assert.equal(N.candidateTree, "59df5d8f49333919b6a58413be8d9ff9534244e8");
  assert.equal(N.sourceDigest, "46d5fddc6c6f9eab0b08267e619c4ad8d95314ac35c6fc3b812686ed19eb8483");
  assert.equal(N.canonicalSha256, "284d8266c66f27f2ac7202c97dbf1519d2c472ad71ce54edfb75d696479ac11e");
  assert.equal(N.reviewArtifactId, 12596534629);
  assert.equal(N.canonicalBlob, "2d07e6d486f36eaa6d3552e0db0da881b25806d7");
  assert.deepEqual(f.record.intakePredecessor, N);
  assert.equal(PR776_INTAKE_REPAIR_PATHS.length, 7);
  assert.equal(f.observedControllerChanges.length, 26);
  assert.equal(f.frozenControllerChanges.length, 21);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", N.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M7 itself rather than one next normal merge",
    (f) => {
      f.plan.baseSha = N.base;
      f.parents = [...N.baseParents];
    },
  ],
  [
    "changed M7 parent",
    (f) => {
      f.intakeParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M7 tree",
    (f) => {
      f.intakeTree = TREE;
    },
  ],
  [
    "changed M7 qualified-head tree",
    (f) => {
      f.intakeHeadTree = TREE;
    },
  ],
  [
    "changed F parent",
    (f) => {
      f.intakeCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F tree",
    (f) => {
      f.intakeCarrierTree = TREE;
    },
  ],
  [
    "lost F ancestry",
    (f) => {
      f.intakeCarrierAncestry = false;
    },
  ],
  [
    "changed F canonical leaf",
    (f) => {
      f.intakeCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F canonical mode",
    (f) => {
      f.intakeCanonicalTree.set(C, "100755 blob " + N.canonicalBlob);
    },
  ],
  [
    "changed M7 cumulative26",
    (f) => {
      f.observedControllerChanges.push("src/unrelated.ts");
    },
  ],
  [
    "missing current intake repair",
    (f) => {
      f.intakeChanges.pop();
    },
  ],
  [
    "unrelated current intake repair",
    (f) => {
      f.intakeChanges.push("src/unrelated.ts");
    },
  ],
  [
    "changed intake predecessor record",
    (f) => {
      f.record.intakePredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M7 intake bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("historical M6 and M7 guards exclude only the two future intake paths", () => {
  assert.deepEqual(
    [...PR776_INTAKE_ADDED_PATHS].sort(),
    [
      "scripts/sounding-line/authenticated-completed-evidence.mjs",
      "tests/sounding-line/authenticated-completed-evidence.test.mjs",
    ].sort(),
  );
  for (const file of PR776_INTAKE_ADDED_PATHS) {
    const f = fixture();
    assert(!f.frozenControllerChanges.includes(file));
    assert(!f.observedControllerChanges.includes(file));
    assert.equal(f.validate(), true);
    f.observedControllerChanges.push(file);
    assert.throws(f.validate, /FROZEN_OBSERVABILITY_PREDECESSOR_CHANGED/u);
  }
});
test("the spent F machine artifact cannot authenticate the successor intake tuple", () => {
  const oldMachineReview = provenance(fixture().bind(), "review");
  oldMachineReview.run.head_sha = N.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

test("frozen M8 and F10 retain exact source, canonical and spent review without historical blob reads", () => {
  const f = fixture();
  assert.equal(K.base, "c99ba71580b7950f64e9b7cb3a4a5ea4005c165c");
  assert.deepEqual(K.baseParents, [N.base, "3b1a6d727a957d2e535a8757a8173e237772f368"]);
  assert.equal(K.baseTree, "515768341a62aceffdd3f8a2528745e4c6922b8f");
  assert.equal(K.candidate, "f91e7b8dfd2e62d7e511be49e7980e6d6e674b60");
  assert.deepEqual(K.candidateParents, ["1ea929a86d5a6af852a2bad16afbaf0daa39b4ab"]);
  assert.equal(K.candidateTree, "2b6391e7dd8c0080be128b6049bdb9b39919186f");
  assert.equal(K.sourceDigest, "3d7e6a64a56a560f3a9b1bd8f376da0bde01381d4d984bb32129615152b5c3a1");
  assert.equal(K.canonicalSha256, "76d5923178e17dd509521945d5498c89c299d28e879773b698a8fdeeb4e01e1f");
  assert.equal(K.reviewArtifactId, 12601724319);
  assert.equal(K.canonicalBlob, "8c93b89036d697145f183b815749cc49b8ef060f");
  assert.deepEqual(f.record.pathCheckPredecessor, K);
  assert.equal(PR776_PATH_CHECK_REPAIR_PATHS.length, 5);
  assert.equal(f.intakeControllerChanges.length, 28);
  assert.equal(f.observedControllerChanges.length, 26);
  assert.equal(f.frozenControllerChanges.length, 21);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", K.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M8 itself rather than the one next normal merge",
    (f) => {
      f.plan.baseSha = K.base;
      f.parents = [...K.baseParents];
    },
  ],
  [
    "changed M8 parents",
    (f) => {
      f.pathCheckParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M8 tree",
    (f) => {
      f.pathCheckTree = TREE;
    },
  ],
  [
    "changed M8 qualified-head tree",
    (f) => {
      f.pathCheckHeadTree = TREE;
    },
  ],
  [
    "changed F10 parent",
    (f) => {
      f.pathCheckCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F10 tree",
    (f) => {
      f.pathCheckCarrierTree = TREE;
    },
  ],
  [
    "lost F10 ancestry",
    (f) => {
      f.pathCheckCarrierAncestry = false;
    },
  ],
  [
    "changed F10 canonical leaf",
    (f) => {
      f.pathCheckCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F10 canonical mode",
    (f) => {
      f.pathCheckCanonicalTree.set(C, "100755 blob " + K.canonicalBlob);
    },
  ],
  [
    "changed M8 cumulative28",
    (f) => {
      f.intakeControllerChanges.push("src/unrelated.ts");
    },
  ],
  [
    "missing current path check repair",
    (f) => {
      f.pathCheckChanges.pop();
    },
  ],
  [
    "unrelated current path check repair",
    (f) => {
      f.pathCheckChanges.push("src/unrelated.ts");
    },
  ],
  [
    "changed path check predecessor record",
    (f) => {
      f.record.pathCheckPredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M8 path check bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("all historical path guards exclude only the future ordinary test whitelist addition", () => {
  assert.deepEqual([...PR776_PATH_CHECK_ADDED_PATHS], ["tests/sounding-line/ordinary.test.mjs"]);
  const f = fixture(),
    file = PR776_PATH_CHECK_ADDED_PATHS[0];
  assert(!f.frozenControllerChanges.includes(file));
  assert(!f.observedControllerChanges.includes(file));
  assert(!f.intakeControllerChanges.includes(file));
  assert.equal(f.validate(), true);
  f.intakeControllerChanges.push(file);
  assert.throws(f.validate, /FROZEN_INTAKE_PREDECESSOR_CHANGED/u);
});
test("the spent F10 machine artifact cannot authenticate the successor path check tuple", () => {
  const oldMachineReview = provenance(fixture().bind(), "review");
  oldMachineReview.run.head_sha = K.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

test("frozen M9 and F12 retain exact source, canonical and spent review without historical blob reads", () => {
  const f = fixture();
  assert.equal(S.base, "696ecec0fd89293074b271ab33d9256709158700");
  assert.deepEqual(S.baseParents, [K.base, "148d9e4064706ad52c52ee3c9b218fe6af87f122"]);
  assert.equal(S.baseTree, "5a1c6a629969753d736ca9d23bbf900b53bdd85f");
  assert.equal(S.candidate, "e321c2465b9b0c166cbdbc6e9a88f57c89c7ff1a");
  assert.deepEqual(S.candidateParents, ["44c62f08bc801f480dfa6765701aeb4106155649"]);
  assert.equal(S.candidateTree, "75352e35df8f1c3b516ac33a0d729a62a3ea5097");
  assert.equal(S.sourceDigest, "c96093f63889b4c0a33c6d7580d895e8f00b6c1de7a15d6dc6036dacc5b504ad");
  assert.equal(S.canonicalSha256, "1015945c5520605fe3271a03f2e4e03b557ba30795b540d82a8d1372f7310d9b");
  assert.equal(S.canonicalBlob, "b705d68d183335dbf5f8e7d2292eb900a14e3e10");
  assert.equal(S.reviewArtifactId, 12606664876);
  assert.deepEqual(f.record.sqliteBootstrapPredecessor, S);
  assert.equal(PR776_CONTROLLER_PATHS.length, 32);
  assert.equal(Object.keys(f.record.requiredRepairBlobs).length, 29);
  assert.equal(PR776_SQLITE_REPAIR_PATHS.length, 5);
  assert.equal(f.sqliteControllerChanges.length, 29);
  assert.equal(f.intakeControllerChanges.length, 28);
  assert.equal(f.observedControllerChanges.length, 26);
  assert.equal(f.frozenControllerChanges.length, 21);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", S.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M9 itself rather than one next normal merge",
    (f) => {
      f.plan.baseSha = S.base;
      f.parents = [...S.baseParents];
    },
  ],
  [
    "changed M9 parents",
    (f) => {
      f.sqliteParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M9 tree",
    (f) => {
      f.sqliteTree = TREE;
    },
  ],
  [
    "changed M9 qualified head tree",
    (f) => {
      f.sqliteHeadTree = TREE;
    },
  ],
  [
    "changed F12 parent",
    (f) => {
      f.sqliteCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F12 tree",
    (f) => {
      f.sqliteCarrierTree = TREE;
    },
  ],
  [
    "lost F12 ancestry",
    (f) => {
      f.sqliteCarrierAncestry = false;
    },
  ],
  [
    "changed F12 canonical leaf",
    (f) => {
      f.sqliteCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F12 canonical mode",
    (f) => {
      f.sqliteCanonicalTree.set(C, "100755 blob " + S.canonicalBlob);
    },
  ],
  [
    "changed M9 cumulative29",
    (f) => {
      f.sqliteControllerChanges.push("src/unrelated.ts");
    },
  ],
  [
    "missing SQLite repair path",
    (f) => {
      f.sqliteChanges = f.sqliteChanges.filter((file) => file !== "scripts/sounding-line/sqlite-bootstrap.mjs");
    },
  ],
  [
    "unrelated SQLite repair path",
    (f) => {
      f.sqliteChanges.push("scripts/sounding-line/unrelated-bootstrap.mjs");
    },
  ],
  [
    "missing required SQLite blob",
    (f) => {
      delete f.record.requiredRepairBlobs["scripts/sounding-line/sqlite-bootstrap.mjs"];
    },
  ],
  [
    "wrong SQLite base blob",
    (f) => {
      f.baseTree.set("scripts/sounding-line/sqlite-bootstrap.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "wrong SQLite candidate blob",
    (f) => {
      f.candidateTree.set("scripts/sounding-line/sqlite-bootstrap.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed SQLite predecessor record",
    (f) => {
      f.record.sqliteBootstrapPredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M9 SQLite bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("every historical path guard excludes only the future SQLite bootstrap addition", () => {
  assert.deepEqual([...PR776_SQLITE_ADDED_PATHS], ["scripts/sounding-line/sqlite-bootstrap.mjs"]);
  const f = fixture(),
    file = PR776_SQLITE_ADDED_PATHS[0];
  for (const paths of [
    f.frozenControllerChanges,
    f.observedControllerChanges,
    f.intakeControllerChanges,
    f.sqliteControllerChanges,
  ])
    assert(!paths.includes(file));
  assert.equal(f.validate(), true);
  f.sqliteControllerChanges.push(file);
  assert.throws(f.validate, /FROZEN_PATH_CHECK_PREDECESSOR_CHANGED/u);
});
test("the spent F12 machine artifact cannot authenticate the successor SQLite tuple", () => {
  const oldMachineReview = provenance(fixture().bind(), "review");
  oldMachineReview.run.head_sha = S.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

test("frozen M10 and F13 retain exact source, canonical and spent review without historical blob reads", () => {
  const f = fixture();
  assert.equal(J.base, "85815909abb922c13cdf2a729f21a30e5b58ee9b");
  assert.deepEqual(J.baseParents, [S.base, "fcbbe534f7dd4c914f3c01a10d77d9c64c497d8d"]);
  assert.equal(J.baseTree, "3917c7d7ec26a27bd3f65e2611f4df94519ff577");
  assert.equal(J.candidate, "1bf8dbda68161d743f305db9de6d44c6b925eb93");
  assert.deepEqual(J.candidateParents, ["d2bbae32523fb464587ad46c55a234df82dba1d6"]);
  assert.equal(J.candidateTree, "6d3a4c2f6651eddd5befbf6499d3b26f4b1412c8");
  assert.equal(J.sourceDigest, "790e837d9522c14f0cc88929267a35e9fd440e1580733b8fdb90294444827fa2");
  assert.equal(J.canonicalSha256, "a9c6f938d52e46e7980f50035751b5249b70458e9f11d3442a4979eada7a34eb");
  assert.equal(J.canonicalBlob, "3d09aa5ce1340742d9486ec0a7df925ad4ae888e");
  assert.equal(J.reviewArtifactId, 12611315114);
  assert.deepEqual(f.record.checkoutReaderPredecessor, J);
  assert.equal(PR776_CONTROLLER_PATHS.length, 32);
  assert.equal(Object.keys(f.record.requiredRepairBlobs).length, 29);
  assert.equal(PR776_READER_REPAIR_PATHS.length, 5);
  assert.equal(f.readerControllerChanges.length, 30);
  assert.equal(f.sqliteControllerChanges.length, 29);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", J.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M10 itself rather than one next normal merge",
    (f) => {
      f.plan.baseSha = J.base;
      f.parents = [...J.baseParents];
    },
  ],
  [
    "changed M10 parents",
    (f) => {
      f.readerParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M10 tree",
    (f) => {
      f.readerTree = TREE;
    },
  ],
  [
    "changed M10 qualified head tree",
    (f) => {
      f.readerHeadTree = TREE;
    },
  ],
  [
    "changed F13 parent",
    (f) => {
      f.readerCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F13 tree",
    (f) => {
      f.readerCarrierTree = TREE;
    },
  ],
  [
    "lost F13 ancestry",
    (f) => {
      f.readerCarrierAncestry = false;
    },
  ],
  [
    "changed F13 canonical leaf",
    (f) => {
      f.readerCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F13 canonical mode",
    (f) => {
      f.readerCanonicalTree.set(C, "100755 blob " + J.canonicalBlob);
    },
  ],
  [
    "changed M10 cumulative30",
    (f) => {
      f.readerControllerChanges.pop();
    },
  ],
  [
    "missing checkout profile repair",
    (f) => {
      f.readerChanges = f.readerChanges.filter(
        (file) => file !== "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
      );
    },
  ],
  [
    "missing checkout profile test repair",
    (f) => {
      f.readerChanges = f.readerChanges.filter(
        (file) => file !== "tests/sounding-line/experience-pr776-checkout.test.mjs",
      );
    },
  ],
  [
    "unrelated reader repair path",
    (f) => {
      f.readerChanges.push("scripts/sounding-line/unrelated-reader.mjs");
    },
  ],
  [
    "wrong profile base blob",
    (f) => {
      f.baseTree.set("scripts/sounding-line/experience-pr776-checkout-profile.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "wrong profile candidate blob",
    (f) => {
      f.candidateTree.set(
        "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
        "100644 blob " + "a".repeat(40),
      );
    },
  ],
  [
    "missing required profile test blob",
    (f) => {
      delete f.record.requiredRepairBlobs["tests/sounding-line/experience-pr776-checkout.test.mjs"];
    },
  ],
  [
    "changed reader predecessor record",
    (f) => {
      f.record.checkoutReaderPredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M10 reader bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("reader repair reuses only existing whitelist members without expanding candidate scope", () => {
  const frozenReaderPaths = PR776_CONTROLLER_PATHS.filter((file) => !PR776_GENERIC_BUDGET_ADDED_PATHS.includes(file));
  assert.equal(new Set(frozenReaderPaths).size, 30);
  for (const file of PR776_READER_REPAIR_PATHS) assert(frozenReaderPaths.includes(file));
  const f = fixture();
  assert.deepEqual(
    f.readerControllerChanges,
    f.baseChanges.filter((file) => !PR776_GENERIC_BUDGET_ADDED_PATHS.includes(file)),
  );
  assert.deepEqual(f.readerControllerChanges, frozenReaderPaths);
  assert.equal(f.validate(), true);
  f.candidateChanges.push("tests/sounding-line/unregistered-reader.test.mjs");
  assert.throws(f.validate, /UNRELATED_CANDIDATE_CHANGE/u);
});
test("the spent F13 machine artifact cannot authenticate the successor reader tuple", () => {
  const oldMachineReview = provenance(fixture().bind(), "review");
  oldMachineReview.run.head_sha = J.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

test("frozen M11 and F14 retain exact source, canonical and spent review without historical blob reads", () => {
  const f = fixture();
  assert.equal(V.base, "1229d4c549160ed72d159c0b708a11352e2f0599");
  assert.deepEqual(V.baseParents, [J.base, "ab178e3aa844afdfa9f782d446aaebc08a6eaabd"]);
  assert.equal(V.baseTree, "183d5193ea3d649cb2d1c53be09b3d4fbe5b4d81");
  assert.equal(V.candidate, "1faf8e5586fec56c6c7073768ba7cc5132776b93");
  assert.deepEqual(V.candidateParents, ["aae3f42868829a7637bbf3fedc342964e0f21a08"]);
  assert.equal(V.candidateTree, "d4b0db03d8109aa71e6c5ceeb93862d9ab90e1d3");
  assert.equal(V.sourceDigest, "72471cfc3b11bd8c27894c0169d237465658ad7c90212b8907ffb3b00e7449c1");
  assert.equal(V.canonicalSha256, "c1d3b5dde0983a8e74dd2f0bb70aac8ecf8e51063bcf6563f99cecb77c946479");
  assert.equal(V.canonicalBlob, "e3ec035e84b7512ab7f54bc791a356105e428524");
  assert.equal(V.reviewArtifactId, 12614235180);
  assert.deepEqual(f.record.finalBudgetPredecessor, V);
  assert.equal(PR776_CONTROLLER_PATHS.length, 32);
  assert.equal(Object.keys(f.record.requiredRepairBlobs).length, 29);
  assert.equal(PR776_FINAL_BUDGET_REPAIR_PATHS.length, 7);
  assert.equal(f.budgetControllerChanges.length, 30);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", V.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M11 itself rather than one next normal merge",
    (f) => {
      f.plan.baseSha = V.base;
      f.parents = [...V.baseParents];
    },
  ],
  [
    "changed M11 parents",
    (f) => {
      f.budgetParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M11 tree",
    (f) => {
      f.budgetTree = TREE;
    },
  ],
  [
    "changed M11 qualified head tree",
    (f) => {
      f.budgetHeadTree = TREE;
    },
  ],
  [
    "changed F14 parent",
    (f) => {
      f.budgetCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F14 tree",
    (f) => {
      f.budgetCarrierTree = TREE;
    },
  ],
  [
    "lost F14 ancestry",
    (f) => {
      f.budgetCarrierAncestry = false;
    },
  ],
  [
    "changed F14 canonical leaf",
    (f) => {
      f.budgetCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F14 canonical mode",
    (f) => {
      f.budgetCanonicalTree.set(C, "100755 blob " + V.canonicalBlob);
    },
  ],
  [
    "changed M11 cumulative30",
    (f) => {
      f.budgetControllerChanges.pop();
    },
  ],
  [
    "missing workflow repair",
    (f) => {
      f.budgetChanges = f.budgetChanges.filter((file) => file !== ".github/workflows/sounding-line-ordinary.yml");
    },
  ],
  [
    "missing budget test repair",
    (f) => {
      f.budgetChanges = f.budgetChanges.filter(
        (file) => file !== "tests/sounding-line/experience-pr776-checkout.test.mjs",
      );
    },
  ],
  [
    "unrelated budget repair path",
    (f) => {
      f.budgetChanges.push(".github/workflows/unrelated.yml");
    },
  ],
  [
    "wrong workflow base blob",
    (f) => {
      f.baseTree.set(".github/workflows/sounding-line-ordinary.yml", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "wrong workflow candidate blob",
    (f) => {
      f.candidateTree.set(".github/workflows/sounding-line-ordinary.yml", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "missing required workflow blob",
    (f) => {
      delete f.record.requiredRepairBlobs[".github/workflows/sounding-line-ordinary.yml"];
    },
  ],
  [
    "changed final budget predecessor record",
    (f) => {
      f.record.finalBudgetPredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M11 final budget bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("workflow remains a required control blob even with an unchanged modeled source digest", () => {
  const f = fixture();
  assert.equal(f.validate(), true);
  const oldSource = f.plan.sourceDigest;
  f.candidateTree.set(".github/workflows/sounding-line-ordinary.yml", "100644 blob " + "a".repeat(40));
  assert.equal(f.plan.sourceDigest, oldSource);
  assert.throws(f.validate, /REPAIR_BLOB_CHANGED/u);
});
test("the spent F14 machine artifact cannot authenticate the successor final budget tuple", () => {
  const oldMachineReview = provenance(fixture().bind(), "review");
  oldMachineReview.run.head_sha = V.base;
  assert.throws(() => validateAttestationProvenance(oldMachineReview), /ATTESTATION_PROVENANCE_INVALID/u);
});

for (const file of ["tests/sounding-line/experience-r25.test.mjs", "tests/sounding-line/experience-r26.test.mjs"]) {
  test("missing historical deadline assertion repair " + file + " fails the finite M11 bridge", () => {
    const f = fixture();
    f.budgetChanges = f.budgetChanges.filter((value) => value !== file);
    assert.throws(f.validate, /FINAL_BUDGET_REPAIR_CHANGED_PATHS/u);
  });
  test("changed historical deadline assertion blob " + file + " fails the finite M11 bridge", () => {
    const f = fixture();
    f.candidateTree.set(file, "100644 blob " + "a".repeat(40));
    assert.throws(f.validate, /REPAIR_BLOB_CHANGED/u);
  });
}

test("frozen M12 and F15 keep the exact spent review with one required browser authority leaf", () => {
  const f = fixture();
  assert.deepEqual(W, {
    base: "e42ee150b8aec488eaa4c0521f55b2d9d092e983",
    baseParents: ["1229d4c549160ed72d159c0b708a11352e2f0599", "e062f73eaf96831e0a08fbf18e81764503261f28"],
    baseTree: "39a38f63394a5e5104c1b5b349970153ccae5f66",
    candidate: "097745ac200d6c5f3f8075e86d6ace397693ddbc",
    candidateParents: ["ae5ec15c5b28d66d73865dc441620798f56db79d"],
    candidateTree: "36c4cc68d1d944e8eab6542584e3d2bc90d2329d",
    sourceDigest: "6ea8e8dadbe9dfab7f50140bbf967cdeb34f0715312994c17587d3706720e956",
    canonicalSha256: "b2f1f313d270f8e8ea26e5cfd54b34d2336529fa4e0a60b6b54a898a7f937fb2",
    canonicalBytes: 1451427,
    canonicalBlob: "cf3c9c5968fcd364c4d49b7718c113e81a731165",
    reviewArtifactId: 12617234771,
  });
  assert.deepEqual(f.record.genericBudgetPredecessor, W);
  assert.equal(PR776_CONTROLLER_PATHS.length, 32);
  assert.equal(Object.keys(f.record.requiredRepairBlobs).length, 29);
  assert.equal(PR776_GENERIC_BUDGET_REPAIR_PATHS.length, 6);
  assert.deepEqual(PR776_GENERIC_BUDGET_ADDED_PATHS, [
    "scripts/sounding-line/browser-authority.mjs",
    "tests/e2e/spatial-chronicle-pilot.spec.ts",
  ]);
  assert.equal(f.genericBudgetControllerChanges.length, 30);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
  assert.throws(
    () => f.git("pure-fixture", ["show", W.candidate + ":" + C]),
    /FORBIDDEN_HISTORICAL_CANONICAL_BLOB_READ/u,
  );
});
for (const [name, mutate] of [
  [
    "M12 itself instead of its one next merge",
    (f) => {
      f.plan.baseSha = W.base;
      f.parents = [...W.baseParents];
    },
  ],
  [
    "changed M12 parents",
    (f) => {
      f.genericBudgetParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M12 tree",
    (f) => {
      f.genericBudgetTree = TREE;
    },
  ],
  [
    "changed M12 qualified tree",
    (f) => {
      f.genericBudgetHeadTree = TREE;
    },
  ],
  [
    "changed M12 cumulative paths",
    (f) => {
      f.genericBudgetControllerChanges.pop();
    },
  ],
  [
    "changed F15 parent",
    (f) => {
      f.genericBudgetCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F15 tree",
    (f) => {
      f.genericBudgetCarrierTree = TREE;
    },
  ],
  [
    "lost F15 ancestry",
    (f) => {
      f.genericBudgetCarrierAncestry = false;
    },
  ],
  [
    "changed F15 canonical leaf",
    (f) => {
      f.genericBudgetCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed F15 canonical mode",
    (f) => {
      f.genericBudgetCanonicalTree.set(C, "100755 blob " + W.canonicalBlob);
    },
  ],
  [
    "missing authority repair path",
    (f) => {
      f.genericBudgetChanges = f.genericBudgetChanges.filter(
        (p) => p !== "scripts/sounding-line/browser-authority.mjs",
      );
    },
  ],
  [
    "missing authority regression path",
    (f) => {
      f.genericBudgetChanges = f.genericBudgetChanges.filter((p) => p !== "tests/sounding-line/ordinary.test.mjs");
    },
  ],
  [
    "unrelated generic budget repair path",
    (f) => {
      f.genericBudgetChanges.push("scripts/unrelated.mjs");
    },
  ],
  [
    "wrong authority base blob",
    (f) => {
      f.baseTree.set("scripts/sounding-line/browser-authority.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "wrong authority candidate blob",
    (f) => {
      f.candidateTree.set("scripts/sounding-line/browser-authority.mjs", "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "missing required authority blob",
    (f) => {
      delete f.record.requiredRepairBlobs["scripts/sounding-line/browser-authority.mjs"];
    },
  ],
  [
    "changed generic budget predecessor record",
    (f) => {
      f.record.genericBudgetPredecessor.reviewArtifactId = 1;
    },
  ],
])
  test(name + " fails the finite M12 generic authority budget bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate);
  });
test("spent F15 machine artifact cannot authenticate the generic authority budget successor", () => {
  const old = provenance(fixture().bind(), "review");
  old.run.head_sha = W.base;
  assert.throws(() => validateAttestationProvenance(old), /ATTESTATION_PROVENANCE_INVALID/u);
});

for (const [name, mutate, code] of [
  [
    "missing pilot technical repair path",
    (f) => {
      f.genericBudgetChanges = f.genericBudgetChanges.filter((p) => p !== "tests/e2e/spatial-chronicle-pilot.spec.ts");
    },
    /GENERIC_BUDGET_REPAIR_CHANGED_PATHS/u,
  ],
  [
    "changed pilot technical base blob",
    (f) => {
      f.baseTree.set("tests/e2e/spatial-chronicle-pilot.spec.ts", "100644 blob " + "a".repeat(40));
    },
    /REPAIR_BLOB_CHANGED/u,
  ],
  [
    "changed pilot technical candidate blob",
    (f) => {
      f.candidateTree.set("tests/e2e/spatial-chronicle-pilot.spec.ts", "100644 blob " + "a".repeat(40));
    },
    /REPAIR_BLOB_CHANGED/u,
  ],
  [
    "missing required pilot technical blob",
    (f) => {
      delete f.record.requiredRepairBlobs["tests/e2e/spatial-chronicle-pilot.spec.ts"];
    },
    /REQUIRED_REPAIR_BLOBS/u,
  ],
  [
    "future pilot repair in frozen M12",
    (f) => {
      f.genericBudgetControllerChanges.push("tests/e2e/spatial-chronicle-pilot.spec.ts");
    },
    /FROZEN_FINAL_BUDGET_PREDECESSOR_CHANGED/u,
  ],
])
  test(name + " fails the finite technical-pilot source bridge", () => {
    const f = fixture();
    mutate(f);
    assert.throws(f.validate, code);
  });

test("fixture scope freezes F16 and keeps only three protected source changes and nine exact candidate fixture repairs", () => {
  assert.equal(Z.base, "03fbcb52bdd3f28f7ce7c029355a07fac6e2f3ce");
  assert.equal(Z.candidate, "bb7572b21ad43b0c5b4d47b52b182f4e2fa46b33");
  assert.equal(PR776_FIXTURE_SCOPE_PATHS.length, 10);
  assert.equal(PR776_FIXTURE_SCOPE_REPAIR_PATHS.length, 3);
  assert.equal(PR776_CURRENT_REPAIR_PATHS.length, 6);
  const f = fixture();
  assert.deepEqual(f.record.fixtureScopePredecessor, Z);
  assert.deepEqual(Object.keys(f.record.candidateFixtureBlobs).sort(), [...PR776_FIXTURE_SCOPE_PATHS].sort());
  assert(PR776_FIXTURE_SCOPE_PATHS.includes("tests/e2e/parallax-sc00c-expanded-library.spec.ts"));
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
});
test("current repair binds the longer PR776 verification window without changing historical repairs", () => {
  const f = fixture();
  assert.equal(f.validate(), true);
  f.currentRepairChanges = f.currentRepairChanges.filter(
    (file) => file !== ".github/workflows/sounding-line-ordinary.yml",
  );
  assert.throws(() => f.validate(), /FIXTURE_SCOPE_REPAIR_CHANGED_PATHS/u);
});
test("completed auth-session repair remains exactly bound before the final CI repair", () => {
  const f = fixture();
  assert.equal(f.validate(), true);
  f.authSessionChanges.pop();
  assert.throws(() => f.validate(), /AUTH_SESSION_REPAIR_CHANGED_PATHS/u);
});
test("current SC00C keyboard fixture remains pinned to its exact candidate blob", () => {
  const f = fixture();
  const file = "tests/e2e/parallax-sc00c-expanded-library.spec.ts";
  assert.equal(f.validate(), true);
  f.candidateTree.set(file, "100644 blob " + "a".repeat(40));
  assert.throws(() => f.validate(), /FIXTURE_SCOPE_BLOB_CHANGED/u);
});
for (const [name, mutate] of [
  [
    "changed M13 parent",
    (f) => {
      f.fixtureScopeParents[1] = POLICY_HEAD;
    },
  ],
  [
    "changed M13 tree",
    (f) => {
      f.fixtureScopeTree = TREE;
    },
  ],
  [
    "changed qualified C16 tree",
    (f) => {
      f.fixtureScopeHeadTree = TREE;
    },
  ],
  [
    "missing M13 controller path",
    (f) => {
      f.fixtureScopeControllerChanges.pop();
    },
  ],
  [
    "changed F16 parent",
    (f) => {
      f.fixtureScopeCarrierParents[0] = POLICY_HEAD;
    },
  ],
  [
    "changed F16 tree",
    (f) => {
      f.fixtureScopeCarrierTree = TREE;
    },
  ],
  [
    "lost F16 ancestry",
    (f) => {
      f.fixtureScopeCarrierAncestry = false;
    },
  ],
  [
    "changed F16 canonical",
    (f) => {
      f.fixtureScopeCanonicalTree.set(C, "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "lost protected repair",
    (f) => {
      f.fixtureScopeChanges.pop();
    },
  ],
  [
    "unrelated protected repair",
    (f) => {
      f.fixtureScopeChanges.push("src/unrelated.ts");
    },
  ],
  [
    "changed frozen record",
    (f) => {
      f.record.fixtureScopePredecessor.sourceDigest = "a".repeat(64);
    },
  ],
  [
    "missing fixture pin",
    (f) => {
      delete f.record.candidateFixtureBlobs[PR776_FIXTURE_SCOPE_PATHS[0]];
    },
  ],
  [
    "extra fixture pin",
    (f) => {
      f.record.candidateFixtureBlobs["src/unrelated.ts"] = "a".repeat(40);
    },
  ],
  [
    "changed guard source",
    (f) => {
      f.candidateTree.set(PR776_FIXTURE_SCOPE_PATHS[0], "100644 blob " + "a".repeat(40));
    },
  ],
  [
    "changed guard mode",
    (f) => {
      const p = PR776_FIXTURE_SCOPE_PATHS[0];
      f.candidateTree.set(p, f.candidateTree.get(p).replace("100644", "100755"));
    },
  ],
])
  test("fixture scope rejects " + name, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => f.validate());
  });

test("auth session repair freezes M14 and F17 while adding only the SC02 fixture", () => {
  assert.equal(A.base, "2a5afb348ed35dd55a96a8f38c098be70bada149");
  assert.equal(A.candidate, "c7eb5872a76d3704aa80fdd49fb98ac02f802ab9");
  assert(PR776_FIXTURE_SCOPE_PATHS.includes("tests/e2e/parallax-sc02-experience.spec.ts"));
  const f = fixture();
  assert.deepEqual(f.record.authReusePredecessor, A);
  assert.equal(f.record.additionalIndependentPasses, 0);
  assert.equal(f.validate(), true);
  assert.equal(f.historicalCanonicalBlobReads, 0);
});
for (const [name, mutate] of [
  ["changed M14 parent", (f) => (f.authReuseParents[1] = POLICY_HEAD)],
  ["changed M14 tree", (f) => (f.authReuseTree = TREE)],
  ["changed qualified C17 tree", (f) => (f.authReuseHeadTree = TREE)],
  ["changed F17 parent", (f) => (f.authReuseCarrierParents[0] = POLICY_HEAD)],
  ["changed F17 tree", (f) => (f.authReuseCarrierTree = TREE)],
  ["lost F17 ancestry", (f) => (f.authReuseCarrierAncestry = false)],
  ["changed F17 canonical", (f) => f.authReuseCanonicalTree.set(C, "100644 blob " + "a".repeat(40))],
  ["missing final protected repair", (f) => f.authReuseChanges.pop()],
  ["unrelated final protected repair", (f) => f.authReuseChanges.push("src/unrelated.ts")],
  ["changed M14 record", (f) => (f.record.authReusePredecessor.sourceDigest = "a".repeat(64))],
  [
    "changed SC02 fixture",
    (f) => f.candidateTree.set("tests/e2e/parallax-sc02-experience.spec.ts", "100644 blob " + "a".repeat(40)),
  ],
])
  test("auth session repair rejects " + name, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => f.validate());
  });
