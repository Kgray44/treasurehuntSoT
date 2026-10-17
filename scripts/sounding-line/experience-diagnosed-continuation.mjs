// Shared mechanics for two exact, protected diagnosed-continuation adapters.
import { sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { R8_FORMAT, validateR8RawOriginals } from "./experience-r8-format.mjs";
import { validateR9HistoricalCustody, validateR9FinalDecision, validateR9FailureOriginals } from "./experience-r9.mjs";
import { validateR10FailureOriginals } from "./experience-r10.mjs";
import { CROSSDECK_R11, validateR11FailureOriginals } from "./experience-r11.mjs";

export function createDiagnosedContinuation(profile) {
  if (
    !Object.isFrozen(profile) ||
    !["R12", "R13"].includes(profile.version) ||
    profile.constant.id !== `PE-X-CROSSDECK-FINAL-VERIFY-20261015-${profile.version}` ||
    profile.recordCount !== (profile.version === "R12" ? 12 : 13) ||
    profile.bridgeCount !== (profile.version === "R12" ? 5 : 6)
  )
    throw new Error("PRODUCT_EXPERIENCE_EXCEPTION_DIAGNOSED_ADAPTER_INVALID");
  const {
    constant: CROSSDECK_R12,
    regenerated: R12_REGENERATED,
    merged: R12_MERGED,
    correction: R12_TEST_CORRECTION,
    correctionEvidence: R12_CORRECTION_EVIDENCE,
    focused: R12_FOCUSED,
    overlayPaths: R12_OVERLAY_PATHS,
  } = profile;
  const registryPath = "testing/product-experience-exceptions.json";
  const hash = (value) =>
    createHash("sha256")
      .update(JSON.stringify(value ?? null))
      .digest("hex");
  const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
  const fail = (code) => {
    throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_${profile.version}_${code}`);
  };
  const git = (root, args, binary = false) =>
    sourceDiagnosticGit("DIAGNOSED_CONTINUATION", args, {
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

  function validateR12Record(record) {
    if (
      !["ACTIVE", "RETIRED"].includes(record?.status) ||
      hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R12.recordDigest
    )
      fail("RECORD_CHANGED");
  }
  function assertR12Mode(plan, mode) {
    if (plan.exception?.id === CROSSDECK_R12.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
  }
  function validateR12Bridge(record) {
    if (
      hash(Object.keys(record ?? {}).sort()) !==
        hash(["version", "id", "status", "exceptionId", "recordDigest", "overlay"].sort()) ||
      record.version !== 1 ||
      record.id !== CROSSDECK_R12.bridgeId ||
      record.status !== "ACTIVE" ||
      record.exceptionId !== CROSSDECK_R12.id ||
      record.recordDigest !== CROSSDECK_R12.recordDigest ||
      hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R12_OVERLAY_PATHS) ||
      new Set(record.overlay?.map((entry) => entry.path)).size !== R12_OVERLAY_PATHS.length ||
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
  function validateR12Registry(registry) {
    const records = registry.exceptions?.filter((record) => record.id === CROSSDECK_R12.id);
    if (
      records?.length !== 1 ||
      registry.exceptions.length !== profile.recordCount ||
      registry.reconciliations?.length !== profile.bridgeCount
    )
      fail("REGISTRY_CHANGED");
    validateR12Record(records[0]);
    const old = {
      ...registry,
      exceptions: registry.exceptions.filter((record) => record.id !== CROSSDECK_R12.id),
      reconciliations: registry.reconciliations.slice(0, profile.bridgeCount - 1),
    };
    if (hash(old) !== CROSSDECK_R12.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
    profile.validatePriorRegistry(old);
    validateR12Bridge(registry.reconciliations[profile.bridgeCount - 1]);
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
  function pendingR12Reconciliation({ root, baseSha, plan, record }) {
    if (record.id !== CROSSDECK_R12.id) return null;
    const registry = json(root, baseSha, registryPath);
    validateR12Registry(registry);
    if (hash(registry.exceptions.at(-1)) !== hash(record)) fail("RECORD_CHANGED");
    const bridge = registry.reconciliations[profile.bridgeCount - 1];
    const historicalException = historicalBinding(
      registry.exceptions.find((value) => value.id === R8_FORMAT_EXCEPTION_ID),
    );
    if (hash(historicalException) !== CROSSDECK_R12.historicalExceptionDigest) fail("HISTORICAL_EXCEPTION_CHANGED");
    return {
      version: 1,
      id: CROSSDECK_R12.bridgeId,
      recordDigest: hash(bridge),
      originalBaseSha: R8_FORMAT.baseSha,
      originalSourceDigest: R8_FORMAT.sourceDigest,
      originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
      currentBaseSha: baseSha,
      currentSourceDigest: plan.sourceDigest,
      overlay: bridge.overlay,
      candidateTestCorrection: record.candidateTestCorrection,
      historicalException,
    };
  }
  const R8_FORMAT_EXCEPTION_ID = "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8";
  function r12HistoricalEvidencePlan(plan) {
    if (plan.exception?.id !== CROSSDECK_R12.id) return plan;
    const binding = plan.exception.nonExecutingReconciliation;
    if (
      !binding ||
      plan.exception.recordDigest !== CROSSDECK_R12.recordDigest ||
      binding.version !== 1 ||
      binding.id !== CROSSDECK_R12.bridgeId ||
      binding.currentBaseSha !== plan.baseSha ||
      binding.currentSourceDigest !== plan.sourceDigest ||
      binding.originalBaseSha !== R8_FORMAT.baseSha ||
      binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
      binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
      hash(binding.candidateTestCorrection) !== hash(R12_TEST_CORRECTION) ||
      hash(binding.historicalException) !== CROSSDECK_R12.historicalExceptionDigest ||
      plan.contractDigest !== R8_FORMAT.contractDigest
    )
      fail("BINDING_CHANGED");
    const bridge = {
      version: 1,
      id: CROSSDECK_R12.bridgeId,
      status: "ACTIVE",
      exceptionId: CROSSDECK_R12.id,
      recordDigest: CROSSDECK_R12.recordDigest,
      overlay: binding.overlay,
    };
    validateR12Bridge(bridge);
    if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
    return {
      ...plan,
      baseSha: R8_FORMAT.baseSha,
      sourceDigest: R8_FORMAT.sourceDigest,
      candidateSha: R8_FORMAT.publicationCandidateSha,
      exception: binding.historicalException,
    };
  }
  function validateR12Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
    validateR12Bridge(bridge);
    const correction = R12_TEST_CORRECTION;
    if (
      originalSource.get(correction.path) !== `${correction.mode} blob ${correction.oldBlob}` ||
      candidate.get(correction.path) !== `${correction.mode} blob ${correction.newBlob}` ||
      originalBase.get(correction.path) !== acceptedBase.get(correction.path) ||
      bridge.overlay.some((entry) => entry.path === correction.path)
    )
      fail("TEST_CORRECTION_CHANGED");
    const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
    const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
    for (const [file, entry] of allowed)
      if (
        originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
        acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
        ([...R12_REGENERATED, ...R12_MERGED].includes(file)
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
        file !== correction.path &&
        !allowed.has(file) &&
        originalSource.get(file) !== candidate.get(file)
      )
        fail("REVIEWED_SOURCE_CHANGED");
    if (candidate.get(registryPath) !== acceptedBase.get(registryPath)) fail("REGISTRY_CHANGED");
  }
  function validateMergedMetadata({ root, baseSha, candidateSha }) {
    for (const file of R12_MERGED) {
      const directory = mkdtempSync(path.join(tmpdir(), "r12-readme-"));
      try {
        const files = ["current", "base", "other"].map((name) => path.join(directory, name));
        for (const [index, revision] of [
          baseSha,
          profile.metadataMergeBaseSha ?? R12_FOCUSED.original.baseSha,
          CROSSDECK_R12.frozenReferenceSha,
        ].entries())
          writeFileSync(files[index], git(root, ["show", `${revision}:${file}`], true));
        const merged = sourceDiagnosticGit(
          "DIAGNOSED_CONTINUATION",
          ["merge-file", "--stdout", ...files],
          {
            cwd: root,
            maxBuffer: 64 * 1024 * 1024,
            timeout: 5000,
            stdio: ["ignore", "pipe", "ignore"],
          },
          {
            file,
            revisions: [
              baseSha,
              profile.metadataMergeBaseSha ?? R12_FOCUSED.original.baseSha,
              CROSSDECK_R12.frozenReferenceSha,
            ],
          },
        );
        const blob = createHash("sha1").update(`blob ${merged.length}\0`).update(merged).digest("hex");
        if (git(root, ["rev-parse", `${candidateSha}:${file}`]).trim() !== blob) fail("MERGED_METADATA_CHANGED");
      } finally {
        if (!directory.startsWith(path.resolve(tmpdir()) + path.sep)) fail("TEMP_PATH_INVALID");
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }
  function validateR12FailureOriginals({ root, candidateSha, record }) {
    const index = json(root, candidateSha, record.predecessor.failureIndexPath);
    if (
      bytesHash(git(root, ["show", `${candidateSha}:${record.predecessor.failureIndexPath}`], true)) !==
        record.predecessor.failureIndexSha256 ||
      index.files?.length !== profile.failureFileCount
    )
      fail("FAILURE_INDEX_CHANGED");
    const entries = inventory(root, candidateSha);
    for (const entry of index.files) {
      const file = path.join(root, entry.path);
      if (
        entry.mode !== "100644" ||
        entries.get(entry.path) !== `100644 blob ${entry.blob}` ||
        !lstatSync(file).isFile() ||
        lstatSync(file).isSymbolicLink()
      )
        fail("FAILURE_ORIGINAL_CHANGED");
      for (const bytes of [git(root, ["show", `${candidateSha}:${entry.path}`], true), readFileSync(file)])
        if (bytes.length !== entry.bytes || bytesHash(bytes) !== entry.sha256) fail("FAILURE_ORIGINAL_CHANGED");
    }
  }
  function bindR12Reconciliation({ root, baseSha, candidateSha, plan, record }) {
    if (record.id !== CROSSDECK_R12.id) return null;
    const binding = pendingR12Reconciliation({ root, baseSha, plan, record });
    const registry = json(root, baseSha, registryPath);
    const bridge = registry.reconciliations[profile.bridgeCount - 1];
    if (profile.requiredBaseAncestor) git(root, ["merge-base", "--is-ancestor", profile.requiredBaseAncestor, baseSha]);
    for (const [ancestor, descendant] of [
      [CROSSDECK_R12.requiredDiagnosticRepairCandidateSha, baseSha],
      [R12_FOCUSED.original.baseSha, baseSha],
      [CROSSDECK_R12.frozenReferenceSha, candidateSha],
      [CROSSDECK_R12.requiredTechnicalCorrectionCandidateSha, candidateSha],
      [record.predecessor.candidateSha, candidateSha],
      [R8_FORMAT.publicationCandidateSha, candidateSha],
    ])
      git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
    if (
      hash(record.reviewedTechnicalCorrection) !== hash(R12_CORRECTION_EVIDENCE) ||
      git(root, ["rev-parse", `${R12_CORRECTION_EVIDENCE.candidateSha}^{tree}`]).trim() !==
        R12_CORRECTION_EVIDENCE.candidateTree
    )
      fail("CORRECTION_REVIEW_CHANGED");
    for (const [file, expected] of [
      [R12_CORRECTION_EVIDENCE.patchPath, R12_CORRECTION_EVIDENCE.patchSha256],
      [R12_CORRECTION_EVIDENCE.reviewPath, R12_CORRECTION_EVIDENCE.reviewSha256],
    ]) {
      const absolute = path.join(root, file);
      if (
        !lstatSync(absolute).isFile() ||
        lstatSync(absolute).isSymbolicLink() ||
        bytesHash(readFileSync(absolute)) !== expected ||
        bytesHash(git(root, ["show", `${candidateSha}:${file}`], true)) !== expected
      )
        fail("CORRECTION_REVIEW_CHANGED");
    }
    const changes = git(root, ["diff", "--name-only", "--no-renames", CROSSDECK_R12.frozenReferenceSha, candidateSha])
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean);
    if (
      changes.some(
        (file) =>
          file !== registryPath &&
          file !== R12_TEST_CORRECTION.path &&
          !R12_OVERLAY_PATHS.includes(file) &&
          !pairedPublicationPathAllowed(file),
      )
    )
      fail("PUBLICATION_SCOPE_CHANGED");
    validateR12Overlay({
      bridge,
      originalBase: inventory(root, R8_FORMAT.baseSha),
      acceptedBase: inventory(root, baseSha),
      originalSource: inventory(root, profile.reviewedProductSourceReferenceSha ?? CROSSDECK_R12.frozenReferenceSha),
      candidate: inventory(root, candidateSha),
    });
    validateMergedMetadata({ root, baseSha, candidateSha });
    const original = sourceSnapshot(root, R8_FORMAT.publicationCandidateSha),
      actual = sourceSnapshot(root, candidateSha);
    const normalized = new Map(actual.entries.map((entry) => [entry.path, entry]));
    const originals = new Map(original.entries.map((entry) => [entry.path, entry]));
    const contents = new Map(actual.contents);
    for (const entry of [...bridge.overlay, R12_TEST_CORRECTION]) {
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
    // Both protected adapters pin literal formatter inputs; caller/environment
    // values cannot widen the exact original-byte preservation scope.
    const acceptedFormatIgnoreBlob =
      profile.version === "R13"
        ? "7299ff76331d5d1273543df449a3700f36a53ace"
        : "d21c485a0c9996cafbd53dde2ab76d0abaa779b4";
    if (git(root, ["rev-parse", `${baseSha}:.prettierignore`]).trim() !== acceptedFormatIgnoreBlob)
      fail("FORMAT_INPUT_CHANGED");
    validateR8RawOriginals({ root, baseSha, candidateSha });
    validateR9FailureOriginals({
      root,
      candidateSha,
      record: registry.exceptions.find((value) => value.id === "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R9"),
    });
    validateR10FailureOriginals({
      root,
      candidateSha,
      record: registry.exceptions.find((value) => value.id === "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R10"),
    });
    validateR11FailureOriginals({
      root,
      candidateSha,
      record: registry.exceptions.find((value) => value.id === CROSSDECK_R11.id),
    });
    profile.validatePriorFailureOriginals?.({ root, candidateSha, registry });
    validateR12FailureOriginals({ root, candidateSha, record });
    return binding;
  }

  // This separate source admission cannot reserve ordinary authority. In particular,
  // the historical original is never accepted by the corrected consumer binder.
  async function admitR12FocusedTechnical({ root, baseSha, candidateSha, stage, environment = process.env, request }) {
    if (!["original", "corrected"].includes(stage) || environment.GITHUB_ACTIONS === "true")
      fail("FOCUSED_SCOPE_CHANGED");
    const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    if (
      git(installed, ["rev-parse", "HEAD"]).trim() !== baseSha ||
      git(root, ["rev-parse", "origin/main"]).trim() !== baseSha ||
      git(root, ["rev-parse", "HEAD"]).trim() !== candidateSha ||
      git(root, ["status", "--porcelain"]).trim()
    )
      fail("FOCUSED_EXACT_CLEAN_SOURCE_REQUIRED");
    git(installed, ["diff", "--exit-code", baseSha, "--", "scripts/sounding-line", registryPath, "package.json"]);
    if (git(installed, ["status", "--porcelain", "--", "scripts/sounding-line", registryPath, "package.json"]).trim())
      fail("FOCUSED_PROTECTED_HELPER_CHANGED");
    if (
      profile.version === "R12" &&
      git(installed, ["ls-tree", baseSha, "--", "scripts/sounding-line/experience-r13.mjs"]).trim()
    )
      fail("FOCUSED_SUPERSEDED");
    const registry = json(installed, baseSha, registryPath);
    const record = validateR12Registry(registry);
    if (profile.requiredBaseAncestor)
      git(installed, ["merge-base", "--is-ancestor", profile.requiredBaseAncestor, baseSha]);
    if (record.status !== "ACTIVE" || Date.now() >= Date.parse(record.expiresAt)) fail("FOCUSED_RECORD_INACTIVE");
    const { recordBinding, githubRequest, exceptionStore, inspectCampaignBeforeLocalProof } = await import(
      "./experience-exception.mjs"
    );
    let plan;
    if (stage === "original") {
      const original = R12_FOCUSED.original;
      if (
        candidateSha !== original.candidateSha ||
        git(root, ["rev-parse", `${candidateSha}^{tree}`]).trim() !== original.candidateTree ||
        productSourceDigest(sourceSnapshot(root, candidateSha)) !== original.sourceDigest
      )
        fail("FOCUSED_ORIGINAL_SOURCE_CHANGED");
      plan = {
        baseSha,
        candidateSha,
        sourceDigest: original.sourceDigest,
        contractDigest: record.contractDigest,
        exception: recordBinding(record),
      };
    } else {
      const { planProductExperience } = await import("./product-experience.mjs");
      plan = planProductExperience({
        root,
        baseSha,
        candidateSha,
        changedPaths: git(root, ["diff", "--name-only", "--no-renames", baseSha, candidateSha]).split(/\r?\n/u),
        prNumber: 721,
      });
      if (plan.exception?.id !== CROSSDECK_R12.id) fail("FOCUSED_CORRECTED_SOURCE_CHANGED");
    }
    const api = request ?? githubRequest(record.repository);
    const history = await inspectCampaignBeforeLocalProof({ root, record, plan, request: api });
    const main = await api("git/ref/heads/main"),
      pr = await api("pulls/721");
    if (
      main?.object?.sha !== baseSha ||
      pr?.state !== "open" ||
      pr.draft !== true ||
      pr.base.ref !== "main" ||
      pr.head.repo.full_name !== record.repository ||
      (stage === "corrected" && pr.head.sha !== candidateSha)
    )
      fail("FOCUSED_LIVE_SOURCE_CHANGED");
    git(root, ["merge-base", "--is-ancestor", CROSSDECK_R12.frozenReferenceSha, pr.head.sha]);
    const store = exceptionStore({ record, request: api });
    for (const slot of ["prepare", "capture", "review-submit", "review7", "qualify", "qualified"])
      if (await store.read(slot)) fail("FOCUSED_STAGE_ALREADY_CONSUMED");
    return {
      record,
      plan,
      manifest: {
        classification: `READ_ONLY_${profile.version}_FOCUSED_TECHNICAL_ADMISSION_NO_EXECUTION`,
        status: "PASS",
        stage,
        baseSha,
        candidateSha,
        candidateTree: git(root, ["rev-parse", `${candidateSha}^{tree}`]).trim(),
        sourceDigest: plan.sourceDigest,
        contractDigest: plan.contractDigest,
        recordDigest: CROSSDECK_R12.recordDigest,
        spec: R12_FOCUSED.spec,
        title: R12_FOCUSED.title,
        history,
        custodyWrites: 0,
        executions: 0,
      },
    };
  }

  async function validateR12PublishedTechnicalProof({ root, candidateSha, plan, record }) {
    if (record.id !== CROSSDECK_R12.id) return;
    validateR12Record(record);
    const runner = await import(profile.runnerModule);
    const validateR12FocusedReceipt = runner[profile.receiptValidator];
    const receipts = [];
    for (const stage of ["original", "corrected"]) {
      let receipt;
      try {
        receipt = json(root, candidateSha, `${R12_FOCUSED.directory}/${stage}/receipt.json`);
      } catch {
        fail("FOCUSED_PUBLICATION_MISSING");
      }
      await validateR12FocusedReceipt({ root, revision: candidateSha, record, plan, stage, receipt });
      if (
        receipt.exceptionId !== CROSSDECK_R12.id ||
        receipt.stage !== stage ||
        receipt.recordDigest !== CROSSDECK_R12.recordDigest ||
        receipt.contractDigest !== plan.contractDigest ||
        receipt.spec !== R12_FOCUSED.spec ||
        receipt.title !== R12_FOCUSED.title ||
        receipt.invocations !== 1 ||
        receipt.retries !== 0 ||
        receipt.repeatEachIndex !== 0 ||
        receipt.additionalRepeats !== 0 ||
        receipt.baseSha !== plan.baseSha ||
        receipt.productCaptures !== 0 ||
        receipt.productReviews !== 0 ||
        receipt.providerCalls !== 0 ||
        !["PASS", "FAIL"].includes(receipt.status)
      )
        fail("FOCUSED_PUBLICATION_CHANGED");
      if (stage === "original") {
        if (
          receipt.candidateSha !== R12_FOCUSED.original.candidateSha ||
          receipt.candidateTree !== R12_FOCUSED.original.candidateTree ||
          receipt.sourceDigest !== R12_FOCUSED.original.sourceDigest ||
          receipt.caseExecutions !== 1
        )
          fail("FOCUSED_ORIGINAL_PROOF_CHANGED");
      } else {
        if (
          receipt.status !== "PASS" ||
          receipt.outcome !== "CORRECTION_PASS" ||
          receipt.caseExecutions !== 1 ||
          receipt.baseSha !== plan.baseSha ||
          receipt.sourceDigest !== plan.sourceDigest ||
          productSourceDigest(sourceSnapshot(root, receipt.candidateSha)) !== plan.sourceDigest
        )
          fail("FOCUSED_CORRECTED_PROOF_CHANGED");
        git(root, ["merge-base", "--is-ancestor", receipt.candidateSha, candidateSha]);
        if (git(root, ["rev-parse", `${receipt.candidateSha}^{tree}`]).trim() !== receipt.candidateTree)
          fail("FOCUSED_CORRECTED_PROOF_CHANGED");
      }
      receipts.push(receipt);
    }
    return { status: "PASS", classification: "SUPPORTING_TECHNICAL_PROOF_NOT_QUALIFICATION", receipts };
  }

  // Reuse canonical historical custody and finalizer consistency checks after the
  // exact R12 binding validates; neither helper executes consumer commands.
  async function validateR12HistoricalCustody({ plan, ...options }) {
    if (plan) r12HistoricalEvidencePlan(plan);
    return validateR9HistoricalCustody(options);
  }
  function validateR12FinalDecision(options) {
    r12HistoricalEvidencePlan(options.plan);
    if (
      options.decision.productExperienceReplay?.status !== "PASS" ||
      options.decision.productExperienceReplay?.sourceDigest !== options.plan.sourceDigest
    )
      fail("CURRENT_REPLAY_REQUIRED");
    return validateR9FinalDecision(options);
  }

  return Object.freeze({
    validateR12Record,
    assertR12Mode,
    validateR12Bridge,
    validateR12Registry,
    pendingR12Reconciliation,
    r12HistoricalEvidencePlan,
    validateR12Overlay,
    validateR12FailureOriginals,
    bindR12Reconciliation,
    admitR12FocusedTechnical,
    validateR12PublishedTechnicalProof,
    validateR12HistoricalCustody,
    validateR12FinalDecision,
  });
}
