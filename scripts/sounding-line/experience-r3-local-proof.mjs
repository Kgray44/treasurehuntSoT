// One operator-accounted local phone proof; never authenticated capture custody.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CROSSDECK_R3, r3LocalPlan, validateR3LocalReceipt } from "./experience-r3.mjs";
import { exceptionBinding, r3LocalMarkerPath } from "./experience-exception.mjs";
import { planProductExperience } from "./product-experience.mjs";
import { runTrustedExperienceReplay } from "./experience-browser.mjs";

export async function runR3LocalProof({ root, baseSha, candidateSha, replay = runTrustedExperienceReplay }) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (
    process.env.GITHUB_ACTIONS === "true" ||
    git("rev-parse", "HEAD") !== candidateSha ||
    git("rev-parse", "origin/main") !== baseSha
  )
    throw Error("R3_LOCAL_EXACT_INSTALLED_SOURCE_REQUIRED");
  git("diff", "--exit-code", "HEAD", "--");
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execFileSync("git", ["diff", "--exit-code", baseSha, "--", "scripts/sounding-line"], { cwd: installed });
  const full = planProductExperience({
    root,
    baseSha,
    candidateSha,
    changedPaths: git("diff", "--name-only", "--no-renames", baseSha, candidateSha).split(/\r?\n/u),
    prNumber: 721,
  });
  if (full.exception?.id !== CROSSDECK_R3.id) throw Error("R3_LOCAL_INSTALLED_APPROVAL_REQUIRED");
  const markerPath = r3LocalMarkerPath(root);
  mkdirSync(path.dirname(markerPath), { recursive: true });
  const marker = {
    classification: "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY",
    status: "STARTED",
    startedAt: new Date().toISOString(),
    ownerPid: process.pid,
    lease: randomUUID(),
    binding: exceptionBinding(full),
  };
  // Consume before build, fixture, server or browser startup. Never delete/refund.
  writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n", { flag: "wx" });
  const receiptPath = path.join(root, CROSSDECK_R3.localProofPath);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  const receipt = {
    classification: marker.classification,
    exceptionId: CROSSDECK_R3.id,
    recordDigest: full.exception.recordDigest,
    baseSha,
    candidateSha,
    sourceDigest: full.sourceDigest,
    contractDigest: full.contractDigest,
    boundedRepairEvents: 1,
    localProofInvocations: 1,
    childReplayInvocations: 0,
    fullPreparations: 0,
    independentReviews: 0,
    contexts: ["MOBILE/PLAYER/NORMAL", "MOBILE/PLAYER/REDUCED"],
    declaredCanonicalFixtureIds: CROSSDECK_R3.fixtureIds,
    status: "STARTED",
    artifacts: [],
    journeys: [],
    isolatedFixtures: [],
    ownerAcceptance: "NOT_CLAIMED",
    limitation:
      "Local common-Git marker and source-bound receipt are operator accounting, not authenticated global invocation count. Never delete/copy/reset the marker or invoke raw Playwright to bypass the one-use limit.",
  };
  const persist = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  persist();
  try {
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      receipt.childReplayInvocations++;
      persist();
      const result = await replay({
        root,
        plan: r3LocalPlan(full, motionMode),
        environment: { SOUNDING_LINE_R3_LOCAL_LEASE: marker.lease },
        validateReplay: false,
      });
      const capture = JSON.parse(readFileSync(result.capturePath, "utf8"));
      receipt.journeys.push(...capture.journeys);
      receipt.isolatedFixtures.push(...result.isolatedFixtures.map((fixture) => ({ ...fixture, motionMode })));
      for (const artifact of capture.artifacts) {
        const destination = path.posix.join(
          path.posix.dirname(CROSSDECK_R3.localProofPath),
          "targeted-media",
          path.basename(artifact.path),
        );
        mkdirSync(path.dirname(path.join(root, destination)), { recursive: true });
        const bytes = readFileSync(path.join(root, artifact.path));
        if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
          throw Error("R3_LOCAL_MEDIA_HASH_CHANGED");
        copyFileSync(path.join(root, artifact.path), path.join(root, destination));
        receipt.artifacts.push({ ...artifact, path: destination });
      }
      persist();
    }
    receipt.status = "PASS";
    validateR3LocalReceipt(receipt, full);
    return receipt;
  } catch (error) {
    receipt.status = "FAIL";
    receipt.failure = error.message;
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
  const [root, baseSha, candidateSha] = process.argv.slice(2);
  await runR3LocalProof({ root: path.resolve(root ?? process.cwd()), baseSha, candidateSha });
}
