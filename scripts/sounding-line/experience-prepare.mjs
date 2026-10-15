import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  experienceDigest,
  planProductExperience,
  revisionJson,
  validateExperienceEvidence,
} from "./product-experience.mjs";
import { runTrustedExperienceReplay } from "./experience-browser.mjs";
import { loadTrustedExperienceArtifact, verifyTrustedExperienceAttestation } from "./experience-attestation.mjs";
import { buildPlan } from "./ordinary.mjs";
import { exceptionStore, trustedExceptions, sealedReviewIdentity } from "./experience-exception.mjs";

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
  const changedPaths = execFileSync("git", ["diff", "--name-only", "--no-renames", baseSha, candidateSha], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/u);
  const diagnostic = options.diagnostic === "true";
  if (!diagnostic) await buildPlan({ root, baseSha, candidateSha, experienceEvidenceRequired: false });
  else assert.equal(baseSha, candidateSha);
  const plan = diagnostic
    ? activationPlan({ root, baseSha, candidateSha })
    : planProductExperience({ root, baseSha, candidateSha, changedPaths });
  if (!plan.applicable) throw new Error("PRODUCT_EXPERIENCE_CAPTURE_NOT_APPLICABLE");
  const policy = plan.attestationPolicy;
  if (!policy?.required || !policy.trustedReviewActors.includes(process.env.GITHUB_ACTOR))
    throw new Error("PRODUCT_EXPERIENCE_AUTHENTICATED_SUBMISSION_REQUIRED");
  const receiptRoot = path.join(root, "artifacts/sounding-line/product-experience-submission");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(path.join(receiptRoot, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `source_digest=${plan.sourceDigest.slice(0, 16)}\n`);
  if (options.mode === "capture") {
    const replay = await runTrustedExperienceReplay({
      root,
      plan: { ...plan, outputDirectory: "Development_Docs/Testing/Product_Experience/evidence" },
      environment: process.env,
      validateReplay: false,
    });
    const capture = JSON.parse(await readFile(replay.capturePath, "utf8"));
    await writeFile(path.join(receiptRoot, "capture.json"), JSON.stringify(capture, null, 2) + "\n");
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
    );
    return;
  }
  const evidenceRoot = path.resolve(options.evidence ?? root);
  const evidencePath = revisionJson(root, baseSha, "testing/contracts.json").experiencePolicy.evidencePath;
  const evidence = JSON.parse(await readFile(path.join(evidenceRoot, evidencePath), "utf8"));
  validateExperienceEvidence({ root: evidenceRoot, baselineRoot: root, plan, evidence });
  if (options.mode === "review") {
    const capture = await loadTrustedExperienceArtifact({
      root,
      plan,
      artifactId: evidence.captureArtifactId,
      kind: "capture",
      policy,
    });
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
        {
          baseSha,
          sourceDigest: plan.sourceDigest,
          contractDigest: plan.contractDigest,
          ...exceptionFields,
          captureArtifactId: evidence.captureArtifactId,
          reviews: evidence.reviews,
          submittedBy: process.env.GITHUB_ACTOR,
          ownerAcceptance: "NOT_CLAIMED",
        },
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
