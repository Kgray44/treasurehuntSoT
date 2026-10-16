// One ordinary-only successor. Historical R8 evidence never grants execution.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { R8_FORMAT, validateR8RawOriginals } from "./experience-r8-format.mjs";

export const CROSSDECK_R9 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R9",
  recordDigest: "98eb3896230f55de1b9c07383c0def7200a2a3d22c95039e79a23ec174746e2b",
  frozenReferenceSha: "9e3669219d66ffb0f333d1f99672dd0aeac44cb4",
  acceptedBufferBaseSha: "b5193c68496eea0a8da46d171cb96cb098c2e82a",
  oldRegistryDigest: "ef16752ef6467e120d11af04e4b170c6cd3d59ca4a4b6c0bce3ce970685e497c",
  historicalExceptionDigest: "4d2f73505425dc68b4a14b9e6b030e46a15cc0cc60b53acd4e74c3b382b86c82",
  bridgeId: "PE-R9-ORDINARY-ONLY-BRIDGE-20261016",
  predecessor: {
    runId: 38929134845,
    qualifyCommit: "d0bb0e170d1ee102d0a596b9df1fc427ba8f782e",
    qualifyPayloadDigest: "0a14803af71f89770579bec538d719b5349b75d78da6d0d99afe1e9e06826317",
  },
});
export const R9_REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R9_MERGED = [".agents/README.md", "Development_Docs/Testing/Product_Experience/README.md"];
export const R9_OVERLAY_PATHS = [
  ".agents/README.md",
  ".agents/crossdeck-r8-historical-format.md",
  ".agents/git-output-buffer-repair.md",
  ".agents/crossdeck-r9-ordinary-only.md",
  ".prettierignore",
  ".github/workflows/sounding-line-ordinary.yml",
  "Development_Docs/Engineering/Crossdeck_R8_Historical_Format_Reconciliation.md",
  "Development_Docs/Engineering/Experience_Changed_Path_Buffer_Repair.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R9_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r9-ordinary-only-20261016/r8-custody-read-only.original.raw.txt",
  ...R9_REGENERATED,
  "Development_Docs/Testing/Product_Experience/README.md",
  "scripts/sounding-line/experience-attestation.mjs",
  "scripts/sounding-line/experience-browser.mjs",
  "scripts/sounding-line/experience-checkout-probe.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/experience-paired.mjs",
  "scripts/sounding-line/experience-prepare.mjs",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "tests/sounding-line/experience-exception.test.mjs",
  "tests/sounding-line/experience-r9.test.mjs",
  "tests/sounding-line/fixtures/r8-format-originals.json",
  "tests/sounding-line/ordinary.test.mjs",
  "tests/sounding-line/product-experience.test.mjs",
].sort();
const registryPath = "testing/product-experience-exceptions.json";
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R9_${code}`);
};
const git = (root, args, binary = false) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const json = (root, revision, file) => JSON.parse(git(root, ["show", `${revision}:${file}`]));
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const [metadata, file] = line.split("\t");
        return [file, metadata];
      }),
  );
const runtime = (file) =>
  /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
  /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc|\.prettierignore|\.gitignore|\.gitattributes)$/u.test(
    file,
  );

export function validateR9Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record?.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R9.recordDigest
  )
    fail("RECORD_CHANGED");
}
export function assertR9Mode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R9.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
}
export function validateR9Bridge(record) {
  if (
    hash(Object.keys(record ?? {}).sort()) !==
      hash(["version", "id", "status", "exceptionId", "recordDigest", "overlay"].sort()) ||
    record.version !== 1 ||
    record.id !== CROSSDECK_R9.bridgeId ||
    record.status !== "ACTIVE" ||
    record.exceptionId !== CROSSDECK_R9.id ||
    record.recordDigest !== CROSSDECK_R9.recordDigest ||
    hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R9_OVERLAY_PATHS) ||
    new Set(record.overlay?.map((entry) => entry.path)).size !== R9_OVERLAY_PATHS.length ||
    record.overlay.some(
      (entry) =>
        entry.newMode !== "100644" ||
        !/^[a-f0-9]{40}$/u.test(entry.newBlob ?? "") ||
        !(
          (entry.oldMode === null && entry.oldBlob === null) ||
          (entry.oldMode === "100644" && /^[a-f0-9]{40}$/u.test(entry.oldBlob ?? ""))
        ),
    )
  )
    fail("BRIDGE_CHANGED");
}
export function validateR9Registry(registry) {
  const records = registry.exceptions?.filter((record) => record.id === CROSSDECK_R9.id);
  if (records?.length !== 1 || registry.exceptions.length !== 9 || registry.reconciliations?.length !== 2)
    fail("REGISTRY_CHANGED");
  validateR9Record(records[0]);
  const old = {
    ...registry,
    exceptions: registry.exceptions.filter((record) => record.id !== CROSSDECK_R9.id),
    reconciliations: registry.reconciliations.slice(0, 1),
  };
  if (hash(old) !== CROSSDECK_R9.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
  validateR9Bridge(registry.reconciliations[1]);
  return records[0];
}
function historicalBinding(record) {
  return {
    id: record.id,
    recordDigest: hash(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    version: record.version,
    predecessor: record.predecessor,
    attemptHistory: record.attemptHistory,
  };
}
export function pendingR9Reconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R9.id) return null;
  const registry = json(root, baseSha, registryPath);
  validateR9Registry(registry);
  if (hash(registry.exceptions.at(-1)) !== hash(record)) fail("RECORD_CHANGED");
  const bridge = registry.reconciliations[1];
  const historicalException = historicalBinding(
    registry.exceptions.find((value) => value.id === R8_FORMAT_EXCEPTION_ID),
  );
  if (hash(historicalException) !== CROSSDECK_R9.historicalExceptionDigest) fail("HISTORICAL_EXCEPTION_CHANGED");
  return {
    version: 1,
    id: CROSSDECK_R9.bridgeId,
    recordDigest: hash(bridge),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    historicalException,
  };
}
const R8_FORMAT_EXCEPTION_ID = "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8";
export function r9HistoricalEvidencePlan(plan) {
  if (plan.exception?.id !== CROSSDECK_R9.id) return plan;
  const binding = plan.exception.nonExecutingReconciliation;
  if (
    !binding ||
    plan.exception.recordDigest !== CROSSDECK_R9.recordDigest ||
    binding.version !== 1 ||
    binding.id !== CROSSDECK_R9.bridgeId ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    binding.originalBaseSha !== R8_FORMAT.baseSha ||
    binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
    binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
    hash(binding.historicalException) !== CROSSDECK_R9.historicalExceptionDigest ||
    plan.contractDigest !== R8_FORMAT.contractDigest
  )
    fail("BINDING_CHANGED");
  const bridge = {
    version: 1,
    id: CROSSDECK_R9.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R9.id,
    recordDigest: CROSSDECK_R9.recordDigest,
    overlay: binding.overlay,
  };
  validateR9Bridge(bridge);
  if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
  return {
    ...plan,
    baseSha: R8_FORMAT.baseSha,
    sourceDigest: R8_FORMAT.sourceDigest,
    candidateSha: R8_FORMAT.publicationCandidateSha,
    exception: binding.historicalException,
  };
}
export function validateR9Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
  validateR9Bridge(bridge);
  const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
  const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  for (const [file, entry] of allowed)
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...R9_REGENERATED, ...R9_MERGED].includes(file)
        ? !/^100644 blob [a-f0-9]{40}$/u.test(candidate.get(file) ?? "")
        : candidate.get(file) !== acceptedBase.get(file))
    )
      fail("OVERLAY_CHANGED");
  for (const file of new Set([...originalBase.keys(), ...acceptedBase.keys()]))
    if (file !== registryPath && !allowed.has(file) && originalBase.get(file) !== acceptedBase.get(file))
      fail("BASE_SCOPE_CHANGED");
  for (const file of new Set([...originalSource.keys(), ...candidate.keys()]))
    if (
      runtime(file) &&
      file !== registryPath &&
      !allowed.has(file) &&
      originalSource.get(file) !== candidate.get(file)
    )
      fail("REVIEWED_SOURCE_CHANGED");
  if (candidate.get(registryPath) !== acceptedBase.get(registryPath)) fail("REGISTRY_CHANGED");
}
function validateMergedMetadata({ root, baseSha, candidateSha }) {
  for (const file of R9_MERGED) {
    const directory = mkdtempSync(path.join(tmpdir(), "r9-readme-"));
    try {
      const files = ["current", "base", "other"].map((name) => path.join(directory, name));
      for (const [index, revision] of [
        baseSha,
        "43340791355526fb31fe2dbf9274eb8632589b30",
        CROSSDECK_R9.frozenReferenceSha,
      ].entries())
        writeFileSync(files[index], git(root, ["show", `${revision}:${file}`], true));
      const merged = execFileSync("git", ["merge-file", "--stdout", ...files], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const blob = createHash("sha1").update(`blob ${merged.length}\0`).update(merged).digest("hex");
      if (git(root, ["rev-parse", `${candidateSha}:${file}`]).trim() !== blob) fail("MERGED_METADATA_CHANGED");
    } finally {
      if (!directory.startsWith(path.resolve(tmpdir()) + path.sep)) fail("TEMP_PATH_INVALID");
      rmSync(directory, { recursive: true, force: true });
    }
  }
}
export function validateR9FailureOriginals({ root, candidateSha, record }) {
  const index = json(root, candidateSha, record.predecessor.failureIndexPath);
  if (
    bytesHash(git(root, ["show", `${candidateSha}:${record.predecessor.failureIndexPath}`], true)) !==
      record.predecessor.failureIndexSha256 ||
    index.entries?.length !== 6
  )
    fail("FAILURE_INDEX_CHANGED");
  const entries = inventory(root, candidateSha);
  for (const entry of index.entries) {
    const file = path.join(root, entry.path);
    if (
      entries.get(entry.path) !== `100644 blob ${entry.gitBlob}` ||
      !lstatSync(file).isFile() ||
      lstatSync(file).isSymbolicLink()
    )
      fail("FAILURE_ORIGINAL_CHANGED");
    for (const bytes of [git(root, ["show", `${candidateSha}:${entry.path}`], true), readFileSync(file)])
      if (bytes.length !== entry.bytes || bytesHash(bytes) !== entry.sha256) fail("FAILURE_ORIGINAL_CHANGED");
  }
}
export function bindR9Reconciliation({ root, baseSha, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R9.id) return null;
  const binding = pendingR9Reconciliation({ root, baseSha, plan, record });
  const bridge = json(root, baseSha, registryPath).reconciliations[1];
  for (const [ancestor, descendant] of [
    [CROSSDECK_R9.acceptedBufferBaseSha, baseSha],
    [CROSSDECK_R9.frozenReferenceSha, candidateSha],
    [record.predecessor.candidateSha, candidateSha],
    [R8_FORMAT.publicationCandidateSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  const changes = git(root, ["diff", "--name-only", "--no-renames", CROSSDECK_R9.frozenReferenceSha, candidateSha])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    changes.some(
      (file) => file !== registryPath && !R9_OVERLAY_PATHS.includes(file) && !pairedPublicationPathAllowed(file),
    )
  )
    fail("PUBLICATION_SCOPE_CHANGED");
  validateR9Overlay({
    bridge,
    originalBase: inventory(root, R8_FORMAT.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, CROSSDECK_R9.frozenReferenceSha),
    candidate: inventory(root, candidateSha),
  });
  validateMergedMetadata({ root, baseSha, candidateSha });
  const original = sourceSnapshot(root, R8_FORMAT.publicationCandidateSha),
    actual = sourceSnapshot(root, candidateSha);
  const normalized = new Map(actual.entries.map((entry) => [entry.path, entry]));
  const originals = new Map(original.entries.map((entry) => [entry.path, entry]));
  const contents = new Map(actual.contents);
  for (const entry of bridge.overlay) {
    if (!runtime(entry.path)) continue;
    if (originals.has(entry.path)) normalized.set(entry.path, originals.get(entry.path));
    else normalized.delete(entry.path);
    if (original.contents.has(entry.path)) contents.set(entry.path, original.contents.get(entry.path));
    else contents.delete(entry.path);
  }
  if (
    productSourceDigest(original) !== R8_FORMAT.sourceDigest ||
    productSourceDigest(actual) !== plan.sourceDigest ||
    productSourceDigest({ entries: [...normalized.values()], contents }) !== R8_FORMAT.sourceDigest
  )
    fail("REVIEWED_SOURCE_CHANGED");
  if (git(root, ["rev-parse", `${baseSha}:.prettierignore`]).trim() !== "d21c485a0c9996cafbd53dde2ab76d0abaa779b4")
    fail("FORMAT_INPUT_CHANGED");
  validateR8RawOriginals({ root, baseSha, candidateSha });
  validateR9FailureOriginals({ root, candidateSha, record });
  return binding;
}
export async function validateR9HistoricalCustody({ plan, store, request }) {
  if (plan) r9HistoricalEvidencePlan(plan);
  const expected = [
    ["prepare", R8_FORMAT.prepareCommit, R8_FORMAT.prepareRun],
    ["capture", R8_FORMAT.captureSeal, R8_FORMAT.prepareRun],
    ["review7", R8_FORMAT.reviewSeal, R8_FORMAT.reviewRun],
    ["review-submit", R8_FORMAT.reviewSubmission, R8_FORMAT.reviewRun],
  ];
  const reservations = [];
  for (const [slot, commit, runId] of expected) {
    const observed = await store.read(slot);
    if (observed?.commitSha !== commit || observed.run?.runId !== runId) fail("HISTORICAL_CUSTODY_CHANGED");
    reservations.push(observed);
  }
  const runs = [];
  for (const reservation of [reservations[0], reservations[2]]) {
    const run = await request(`actions/runs/${reservation.run.runId}`);
    if (
      run?.status !== "completed" ||
      run.conclusion !== "success" ||
      run.run_attempt !== 1 ||
      run.head_sha !== R8_FORMAT.baseSha ||
      run.head_branch !== "main" ||
      run.event !== "workflow_dispatch" ||
      run.actor?.login !== "Kgray44" ||
      run.triggering_actor?.login !== "Kgray44" ||
      run.created_at !== reservation.run.createdAt ||
      run.workflow_id !== reservation.run.workflowId ||
      run.display_title !== reservation.run.displayTitle ||
      run.path !== reservation.run.workflowPath ||
      run.head_repository?.full_name !== "Kgray44/treasurehuntSoT"
    )
      fail("HISTORICAL_RUN_CHANGED");
    runs.push(run);
  }
  for (const [id, digest, runId] of [
    [R8_FORMAT.captureArtifact, R8_FORMAT.captureDigest, R8_FORMAT.prepareRun],
    [R8_FORMAT.reviewArtifact, R8_FORMAT.reviewDigest, R8_FORMAT.reviewRun],
  ]) {
    const artifact = await request(`actions/artifacts/${id}`);
    if (artifact?.id !== id || artifact.expired || artifact.digest !== digest || artifact.workflow_run?.id !== runId)
      fail("HISTORICAL_ARTIFACT_CHANGED");
  }
  return runs;
}
export function r9HistoryRunMatches(observed, expected) {
  return (
    [
      "id",
      "run_attempt",
      "workflow_id",
      "path",
      "head_sha",
      "head_branch",
      "event",
      "status",
      "conclusion",
      "created_at",
      "display_title",
    ].every((key) => observed?.[key] === expected?.[key]) &&
    observed.actor?.login === expected.actor?.login &&
    observed.triggering_actor?.login === expected.triggering_actor?.login &&
    observed.head_repository?.full_name === expected.head_repository?.full_name
  );
}
// Consistency checks on the canonical verifier/finalizer output. Execution proof
// still comes from the trusted final-check and unchanged upstream-success gate.
export function validateR9FinalDecision({ plan, ordinary, record, decision, groups }) {
  r9HistoricalEvidencePlan(plan);
  const same = (left, right) => hash(left) === hash(right);
  const pe = decision.productExperience;
  const attestation = pe?.trustedAttestation;
  if (
    !same(ordinary.selected.browserTests, record.requiredTechnicalBrowserTests) ||
    !same(decision.selected?.browserTests, record.requiredTechnicalBrowserTests) ||
    !same(pe?.exception, plan.exception) ||
    pe?.baseSha !== plan.baseSha ||
    pe?.sourceDigest !== plan.sourceDigest ||
    pe?.contractDigest !== plan.contractDigest ||
    pe?.contextCount !== 38 ||
    decision.productExperienceDecision?.sourceDigest !== plan.sourceDigest ||
    decision.productExperienceDecision?.reviewedBaseSha !== R8_FORMAT.baseSha ||
    decision.productExperienceDecision?.reviewedSourceDigest !== R8_FORMAT.sourceDigest ||
    !same(decision.productExperienceDecision?.nonExecutingReconciliation, plan.exception.nonExecutingReconciliation) ||
    attestation?.status !== "PASS" ||
    !same(attestation.exception, plan.exception) ||
    attestation.currentBaseSha !== plan.baseSha ||
    attestation.currentSourceDigest !== plan.sourceDigest ||
    attestation.reviewedBaseSha !== R8_FORMAT.baseSha ||
    attestation.reviewedSourceDigest !== R8_FORMAT.sourceDigest ||
    attestation.captureArtifactId !== R8_FORMAT.captureArtifact ||
    attestation.reviewArtifactId !== R8_FORMAT.reviewArtifact ||
    attestation.exceptionCustody?.prepareReservation !== R8_FORMAT.prepareCommit ||
    attestation.exceptionCustody?.reviewSeal !== R8_FORMAT.reviewSeal ||
    !same(attestation.nonExecutingReconciliation, plan.exception.nonExecutingReconciliation)
  )
    fail("FINAL_ATTESTATION_CHANGED");
  const reconciliation = decision.evidenceReconciliation;
  const finalization = reconciliation?.finalization;
  const expectedIds = groups.map((group) => group.id).sort();
  const exactIds = (values, field) =>
    Array.isArray(values) &&
    values.length === groups.length &&
    new Set(values.map((value) => value[field])).size === groups.length &&
    same(values.map((value) => value[field]).sort(), expectedIds);
  if (
    groups.length !== 8 ||
    new Set(expectedIds).size !== groups.length ||
    !exactIds(reconciliation?.obligations, "id") ||
    !exactIds(reconciliation?.reconciliation, "obligationId") ||
    !exactIds(finalization?.closure, "obligationId") ||
    finalization.authority !== "SOUNDING_LINE_EVIDENCE_FINALIZER" ||
    finalization.decision !== "PASS" ||
    finalization.requiredObligations !== groups.length ||
    reconciliation.requiredObligations !== groups.length ||
    !Array.isArray(finalization.errors) ||
    finalization.errors.length ||
    !Array.isArray(finalization.remainder) ||
    finalization.remainder.length ||
    finalization.closure.some(
      (entry) => entry.satisfied !== true || typeof entry.receiptId !== "string" || !entry.receiptId,
    )
  )
    fail("FINAL_OBLIGATION_CLOSURE_CHANGED");
  for (const group of groups) {
    const obligation = reconciliation.obligations.find((entry) => entry.id === group.id);
    const observed = reconciliation.reconciliation.find((entry) => entry.obligationId === group.id);
    const closure = finalization.closure.find((entry) => entry.obligationId === group.id);
    if (!same(obligation.commands, group.commandLabels) || observed.receiptId !== closure.receiptId)
      fail("FINAL_OBLIGATION_CLOSURE_CHANGED");
    if (
      group.kind === "browser" ||
      group.commands.some(([, args]) => args[0] === "scripts/sounding-line/run-browser-suite.mjs")
    ) {
      const timings = decision.timing?.commands?.filter((entry) => entry.obligationId === group.id);
      if (
        observed.freshExecuted !== true ||
        ["PRESERVED", "REBOUND"].includes(observed.disposition) ||
        timings?.length !== 1 ||
        timings[0].status !== "PASS"
      )
        fail("FRESH_TECHNICAL_VERIFICATION_REQUIRED");
    }
  }
}
