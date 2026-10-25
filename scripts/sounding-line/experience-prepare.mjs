import { historicalReviewedPlan } from "./experience-reviewed-adoption.mjs";
import {
  isPR776ControllerReconciliation,
  validatePR776TrustedCapture,
  pr776ReviewSubmissionBinding,
} from "./experience-pr776-controller-reconciliation.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  experienceDigest,
  planProductExperience,
  revisionJson,
  validateExperienceEvidence,
} from "./product-experience.mjs";
import { experienceChangedPaths } from "./experience-browser.mjs";
import { captureAndPublishExperience, createCaptureSubmission } from "./experience-capture-publication.mjs";
import { loadTrustedExperienceArtifact, verifyTrustedExperienceAttestation } from "./experience-attestation.mjs";
import { buildPlan } from "./ordinary.mjs";
import { exceptionStore, trustedExceptions, sealedReviewIdentity } from "./experience-exception.mjs";
import { mediaFirstReviewProvenanceBinding } from "./experience-media-first-binding.mjs";
import { emitPreparationPhase } from "./preparation-phases.mjs";

export function createReviewSubmission({ baseSha, plan, evidence, exceptionFields = {}, submittedBy }) {
  return {
    baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    ...exceptionFields,
    ...pr776ReviewSubmissionBinding(plan),
    captureArtifactId: evidence.captureArtifactId,
    reviews: evidence.reviews,
    ...(plan.paired ? { pairedEvidenceDigest: experienceDigest(evidence.pairedEvidence) } : {}),
    ...mediaFirstReviewProvenanceBinding(plan, evidence),
    submittedBy,
    ownerAcceptance: "NOT_CLAIMED",
  };
}

export async function writeCaptureOutputs(paths, environment = process.env, workspacePrefix = "candidate") {
  if (!environment.GITHUB_OUTPUT) return;
  const safe = (file) =>
    typeof file === "string" &&
    !/[\\\u0000-\u001f\u007f]/u.test(file) &&
    !path.posix.isAbsolute(file) &&
    file.split("/").every((part) => part && part !== "." && part !== "..");
  assert(workspacePrefix === "" || safe(workspacePrefix), "PRODUCT_EXPERIENCE_CAPTURE_OUTPUT_PREFIX_INVALID");
  const lines = [];
  for (const [name, value] of Object.entries(paths)) {
    if (name === "capture_raw_retention_status") {
      assert(["PENDING", "COMPLETE", "INCOMPLETE"].includes(value));
      lines.push(`${name}=${value}`);
      continue;
    }
    assert(
      /^capture_(?:(?:plan|manifest|activation|stage|raw_encrypted|journal|journal_failure|journal_pending)_path|(?:runtime|profile|raw_verified)_paths)$/u.test(
        name,
      ),
    );
    const values = Array.isArray(value) ? value : [value];
    assert(values.length > 0 && values.every((file) => safe(file) && file.startsWith("artifacts/sounding-line/")));
    if (name === "capture_raw_verified_paths") {
      assert(Array.isArray(value) && new Set(values).size === values.length);
      const roots = values.map(
        (file) =>
          /^(artifacts\/sounding-line\/product-experience-capture-staging\/capture-[A-Za-z0-9_-]+\/encrypted)\/(?:part-[0-9]{6}\.encrypted|index\.encrypted|retention\.json)$/u.exec(
            file,
          )?.[1],
      );
      assert(roots.every(Boolean) && new Set(roots).size === 1);
      assert(values.includes(`${roots[0]}/index.encrypted`) && values.includes(`${roots[0]}/retention.json`));
    }
    const prefixed = values.map((file) => `${workspacePrefix ? workspacePrefix + "/" : ""}${file}`);
    if (Array.isArray(value)) {
      const delimiter = `capture_${randomUUID()}`;
      lines.push(`${name}<<${delimiter}`, ...prefixed, delimiter);
    } else lines.push(`${name}=${prefixed[0]}`);
  }
  await appendFile(environment.GITHUB_OUTPUT, lines.join("\n") + "\n");
}

export function activationPlan({ root, baseSha, candidateSha }) {
  // Diagnostic exercises the installed authority; it cannot qualify a PR.
  const plan = planProductExperience({
    root,
    baseSha,
    candidateSha,
    changedPaths: ["src/app/sign-in/page.tsx"],
  });
  assert.equal(plan.applicable, true);
  assert.throws(() => validateExperienceEvidence({ root, plan, evidence: null }), /EVIDENCE_MISSING/u);
  assert.equal(
    planProductExperience({
      root,
      baseSha,
      candidateSha,
      changedPaths: ["src/services/experience-internal-diagnostic.ts"],
    }).applicable,
    false,
  );
  return plan;
}
async function main() {
  emitPreparationPhase("ADMISSION");
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace);
  const baseSha = options.base;
  const candidateSha = options.candidate;
  if (!/^[a-f0-9]{40}$/u.test(baseSha ?? "") || !/^[a-f0-9]{40}$/u.test(candidateSha ?? ""))
    throw new Error("PRODUCT_EXPERIENCE_EXACT_SOURCE_REQUIRED");
  if (
    process.env.GITHUB_ACTIONS === "true" &&
    (process.env.GITHUB_SHA !== baseSha || process.env.GITHUB_REF !== "refs/heads/main")
  )
    throw new Error("PRODUCT_EXPERIENCE_PREPARATION_REQUIRES_PROTECTED_BASE_WORKFLOW");
  execFileSync("git", ["merge-base", "--is-ancestor", baseSha, candidateSha], { cwd: root });
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), candidateSha);
  const changedPaths = experienceChangedPaths(root, baseSha, candidateSha);
  const diagnostic = options.diagnostic === "true";
  emitPreparationPhase("PLANNING");
  if (!diagnostic) await buildPlan({ root, baseSha, candidateSha, experienceEvidenceRequired: false });
  else assert.equal(baseSha, candidateSha);
  const plan = diagnostic
    ? activationPlan({ root, baseSha, candidateSha })
    : planProductExperience({ root, baseSha, candidateSha, changedPaths });
  if (!plan.applicable) throw new Error("PRODUCT_EXPERIENCE_CAPTURE_NOT_APPLICABLE");
  const policy = plan.attestationPolicy;
  if (!policy?.required || !policy.trustedReviewActors.includes(process.env.GITHUB_ACTOR))
    throw new Error("PRODUCT_EXPERIENCE_AUTHENTICATED_SUBMISSION_REQUIRED");
  emitPreparationPhase("STAGING", {
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    planDigest: experienceDigest(plan),
  });
  const onPaths = (paths) =>
    writeCaptureOutputs(paths, process.env, path.relative(process.cwd(), root).split(path.sep).join("/"));
  let receiptRoot;
  if (options.mode === "capture") ({ receiptRoot } = await createCaptureSubmission({ root, plan, onPaths }));
  else {
    receiptRoot = path.join(root, "artifacts/sounding-line/product-experience-submission");
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(path.join(receiptRoot, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  }
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `source_digest=${plan.sourceDigest.slice(0, 16)}\n`);
  if (options.mode === "capture") {
    const replay = await captureAndPublishExperience({
      root,
      plan,
      record: plan.exception
        ? trustedExceptions(root, baseSha).find((record) => record.id === plan.exception.id)
        : null,
      environment: process.env,
      onPaths,
    });
    const capture = JSON.parse(await readFile(replay.capturePath, "utf8"));
    await writeFile(path.join(receiptRoot, "capture.json"), JSON.stringify(capture, null, 2) + "\n", { flag: "wx" });
    await writeFile(
      path.join(receiptRoot, "activation.json"),
      JSON.stringify(
        {
          sourceSha: candidateSha,
          diagnostic,
          missingEvidenceRejected: true,
          backendOnlyExempt: true,
          realBrowserReplay: replay.status,
          ownerAcceptance: "NOT_CLAIMED",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    emitPreparationPhase("COMPLETE");
    return;
  }
  const evidenceRoot = path.resolve(options.evidence ?? root);
  const evidencePath = revisionJson(root, baseSha, "testing/contracts.json").experiencePolicy.evidencePath;
  const evidence = JSON.parse(await readFile(path.join(evidenceRoot, evidencePath), "utf8"));
  validateExperienceEvidence({ root: evidenceRoot, baselineRoot: root, plan, evidence });
  if (options.mode === "review") {
    const capture = await loadTrustedExperienceArtifact({
      root,
      plan: isPR776ControllerReconciliation(plan) ? historicalReviewedPlan(plan) : plan,
      artifactId: evidence.captureArtifactId,
      kind: "capture",
      policy,
    });
    validatePR776TrustedCapture(plan, capture);
    const identity = (artifacts) =>
      artifacts.map(({ id, sha256, type, contractId, state, device, role, motionMode }) => ({
        id,
        sha256,
        type,
        contractId,
        state,
        device,
        role,
        motionMode,
      }));
    assert.equal(experienceDigest(identity(capture.artifacts)), experienceDigest(identity(evidence.artifacts)));
    assert.equal(experienceDigest(capture.journeys), experienceDigest(evidence.journeys));
    assert.equal(experienceDigest(capture.pairedEvidence ?? null), experienceDigest(evidence.pairedEvidence ?? null));
    let exceptionFields = {};
    if (plan.exception) {
      const record = trustedExceptions(root, baseSha).find((value) => value.id === plan.exception.id);
      const { githubRequest } = await import("./experience-exception.mjs");
      const store = exceptionStore({ record, request: githubRequest(record.repository) });
      const prepare = await store.read("prepare");
      const seal = await store.read(`review${record.remainingIndependentReviewOrdinal}`);
      assert.equal(experienceDigest(seal?.reviewIdentity), experienceDigest(sealedReviewIdentity(plan, evidence)));
      exceptionFields = {
        exception: plan.exception,
        exceptionPreparationReservation: prepare.commitSha,
        exceptionReviewSeal: seal.commitSha,
      };
    }
    await writeFile(
      path.join(receiptRoot, "review.json"),
      JSON.stringify(
        createReviewSubmission({ baseSha, plan, evidence, exceptionFields, submittedBy: process.env.GITHUB_ACTOR }),
        null,
        2,
      ) + "\n",
    );
  } else if (options.mode === "verify") {
    const decision = await verifyTrustedExperienceAttestation({ root, plan, evidence });
    await writeFile(
      path.join(receiptRoot, "activation.json"),
      JSON.stringify(
        { sourceSha: candidateSha, diagnostic, missingEvidenceRejected: true, backendOnlyExempt: true, decision },
        null,
        2,
      ) + "\n",
    );
  } else throw new Error("PRODUCT_EXPERIENCE_PREPARATION_MODE_INVALID");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
