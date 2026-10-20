// Custodian-only release: never provide the ungated input packet to the critic.
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R22_ID, R22_MEDIA_PROTOCOL } from "./experience-media-first-r22-policy.mjs";
import { validatePinnedMediaFirstPlan } from "./experience-media-first-r21.mjs";
import {
  mediaFirstDigest,
  mediaFirstSha256,
  validateMediaFirstObservationBytes,
} from "./experience-media-first-shared.mjs";

const need = (condition, code) => {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_PRE_SOURCE_${code}`);
};
const same = (left, right) => mediaFirstDigest(left) === mediaFirstDigest(right);
const time = (value) => (typeof value === "string" ? Date.parse(value) : NaN);
const sha = (value, length = 64) => new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value ?? "");
const selection = { id: R22_ID, version: 22, ordinal: 12, policy: R22_MEDIA_PROTOCOL };
export const SOURCE_GATE_VALIDATOR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-media-first-shared.mjs",
  "scripts/sounding-line/experience-review-dimensions.mjs",
  "scripts/sounding-line/experience-media-first-r21.mjs",
  "scripts/sounding-line/experience-media-first-r22-policy.mjs",
  "scripts/sounding-line/experience-current-r20.mjs",
  "scripts/sounding-line/experience-paired.mjs",
  "scripts/sounding-line/experience-review-source-gate.mjs",
]);
const validatorPaths = SOURCE_GATE_VALIDATOR_PATHS;
const durableWrite = (filename, bytes) => {
  const descriptor = openSync(filename, "wx", 0o600);
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
function gateBinding(plan, captureCandidateSha) {
  return {
    baseSha: plan.baseSha,
    captureCandidateSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    recordDigest: plan.exception.recordDigest,
  };
}
export async function loadProtectedPreSourceCapture({ root, plan, captureArtifactId }) {
  const { loadTrustedExperienceArtifact } = await import("./experience-attestation.mjs");
  const { trustedExceptions, exceptionStore, githubRequest, requireSuccessfulReservation } = await import(
    "./experience-exception.mjs"
  );
  const record = trustedExceptions(root, plan.baseSha).find((entry) => entry.id === R22_ID);
  need(record, "INSTALLED_RECORD_REQUIRED");
  const request = githubRequest(record.repository),
    store = exceptionStore({ record, request });
  const prepare = await requireSuccessfulReservation({ store, slot: "prepare", plan, request });
  const capture = await loadTrustedExperienceArtifact({
    root,
    plan,
    artifactId: captureArtifactId,
    kind: "capture",
    policy: plan.attestationPolicy,
  });
  return { capture, prepare };
}
export async function stageMediaFirstSource({
  root,
  plan,
  protocol,
  originalPath,
  expectedBytes,
  expectedSha256,
  captureArtifactId,
  sourcePacketPath,
  outputDirectory,
  now = () => new Date(),
  loadCapture = loadProtectedPreSourceCapture,
  readSourcePacket = readFileSync,
  persist = durableWrite,
}) {
  validatePinnedMediaFirstPlan(plan, selection);
  const output = path.resolve(outputDirectory);
  mkdirSync(output, { mode: 0o700 }); // An existing run is never overwritten or resumed.
  let preSourceAdmission,
    admissionPersisted = false;
  try {
    const originalBytes = readFileSync(originalPath);
    const { capture, prepare } = await loadCapture({ root, plan, captureArtifactId });
    need(
      capture.baseSha === plan.baseSha &&
        capture.sourceDigest === plan.sourceDigest &&
        capture.contractDigest === plan.contractDigest &&
        same(capture.exception, plan.exception) &&
        capture.trustedArtifact?.id === captureArtifactId &&
        capture.trustedArtifact.runAttempt === 1 &&
        /^sha256:[a-f0-9]{64}$/u.test(capture.trustedArtifact.digest ?? "") &&
        capture.exceptionPreparationReservation === prepare.commitSha &&
        capture.trustedArtifact.runId === prepare.run.runId &&
        prepare.candidateSha === plan.candidateSha,
      "AUTHENTICATED_CAPTURE_OR_PREPARATION_MISMATCH",
    );
    const checkedAt = now();
    validateMediaFirstObservationBytes({
      plan,
      protocol,
      policy: R22_MEDIA_PROTOCOL,
      originalBytes,
      expectedBytes,
      expectedSha256,
      captureArtifactId,
      artifacts: capture.artifacts,
      now: checkedAt,
    });
    const validator = validatorPaths.map((filename) => ({
      path: filename,
      blob: execFileSync("git", ["rev-parse", `${plan.baseSha}:${filename}`], { cwd: root, encoding: "utf8" }).trim(),
    }));
    need(
      validator.every((entry) => sha(entry.blob, 40)),
      "PINNED_VALIDATOR_REQUIRED",
    );
    const loadedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    need(
      validator.every(
        (entry) =>
          entry.blob ===
          execFileSync("git", ["hash-object", "--path", entry.path, path.join(loadedRoot, entry.path)], {
            cwd: root,
            encoding: "utf8",
          }).trim(),
      ),
      "PINNED_RUNTIME_VALIDATOR_CHANGED",
    );
    preSourceAdmission = {
      kind: "CROSSDECK_PRE_SOURCE_ADMISSION_1",
      status: "PASS",
      checkedAtUtc: checkedAt.toISOString(),
      binding: gateBinding(plan, prepare.candidateSha),
      reviewerContext: protocol.reviewerContext,
      reviewerTaskPath: protocol.reviewerTaskPath,
      criticCreation: protocol.criticCreation,
      firstPass: { bytes: originalBytes.length, sha256: mediaFirstSha256(originalBytes) },
      capture: {
        ...capture.trustedArtifact,
        prepareReservation: prepare.commitSha,
        indexDigest: mediaFirstDigest(capture),
      },
      validator,
    };
    // Only these exact validated bytes are retained. No reread/JSON rewrite occurs.
    persist(path.join(output, "first-pass.original.json"), originalBytes);
    persist(path.join(output, "pre-source-admission.original.json"), jsonBytes(preSourceAdmission));
    admissionPersisted = true;
    const started = now();
    need(started.getTime() >= checkedAt.getTime(), "CLOCK_MOVED_BACKWARDS");
    const packet = readSourcePacket(sourcePacketPath);
    need(Buffer.isBuffer(packet) && packet.length > 0, "SOURCE_PACKET_REQUIRED");
    persist(path.join(output, "source-packet.released.original.txt"), packet);
    const completed = now();
    need(completed.getTime() >= started.getTime(), "CLOCK_MOVED_BACKWARDS");
    const stage = {
      kind: "CROSSDECK_SOURCE_PACKET_STAGE_1",
      status: "STAGED_NOT_DISCLOSED",
      preSourceAdmissionDigest: mediaFirstDigest(preSourceAdmission),
      binding: preSourceAdmission.binding,
      reviewerContext: protocol.reviewerContext,
      startedAtUtc: started.toISOString(),
      completedAtUtc: completed.toISOString(),
      packet: { bytes: packet.length, sha256: mediaFirstSha256(packet) },
    };
    persist(path.join(output, "source-packet-stage.original.json"), jsonBytes(stage));
    return { preSourceAdmission, sourcePacketStage: stage, outputDirectory: output };
  } catch (error) {
    // A staging or delivery problem never becomes an assertion that source was disclosed.
    try {
      durableWrite(
        path.join(output, "failure.original.json"),
        jsonBytes({
          kind: "CROSSDECK_PRE_SOURCE_FAILURE_1",
          status: "FAILED_NOT_DISCLOSED_BY_THIS_ROUTE",
          error: error.message,
          passingAdmissionRetained: admissionPersisted,
          observedAtUtc: now().toISOString(),
        }),
      );
    } catch (retentionError) {
      throw new AggregateError([error, retentionError], "PRODUCT_EXPERIENCE_PRE_SOURCE_FAILURE_RETENTION_FAILED", {
        cause: error,
      });
    }
    throw error;
  }
}

export function validatePreSourceAdmissionReceipts(plan, evidence, now = new Date()) {
  const protocol = evidence.mediaFirstReview,
    admission = protocol?.preSourceAdmission,
    stage = protocol?.sourcePacketStage,
    disclosure = protocol?.sourceDisclosure;
  need(
    admission?.kind === "CROSSDECK_PRE_SOURCE_ADMISSION_1" &&
      admission.status === "PASS" &&
      same(admission.binding, gateBinding(plan, admission.binding?.captureCandidateSha)) &&
      sha(admission.binding?.captureCandidateSha, 40) &&
      admission.reviewerContext === protocol.reviewerContext &&
      admission.reviewerTaskPath === protocol.reviewerTaskPath &&
      same(admission.criticCreation, protocol.criticCreation) &&
      admission.firstPass?.bytes === protocol.frozenFirstPass?.bytes &&
      admission.firstPass?.sha256 === protocol.frozenFirstPass?.sha256 &&
      admission.capture?.id === evidence.captureArtifactId &&
      admission.capture.runAttempt === 1 &&
      /^sha256:[a-f0-9]{64}$/u.test(admission.capture.digest ?? "") &&
      sha(admission.capture.indexDigest) &&
      sha(admission.capture.prepareReservation, 40) &&
      Number.isSafeInteger(admission.capture.runId) &&
      Array.isArray(admission.validator) &&
      same(
        admission.validator.map((entry) => entry.path),
        validatorPaths,
      ) &&
      admission.validator.every((entry) => sha(entry.blob, 40)),
    "PASS_RECEIPT_REQUIRED",
  );
  need(
    stage?.kind === "CROSSDECK_SOURCE_PACKET_STAGE_1" &&
      stage.status === "STAGED_NOT_DISCLOSED" &&
      stage.preSourceAdmissionDigest === mediaFirstDigest(admission) &&
      same(stage.binding, admission.binding) &&
      stage.reviewerContext === protocol.reviewerContext &&
      Number.isSafeInteger(stage.packet?.bytes) &&
      stage.packet.bytes > 0 &&
      sha(stage.packet.sha256),
    "STAGED_PACKET_RECEIPT_REQUIRED",
  );
  need(
    disclosure?.kind === "CROSSDECK_NATIVE_SOURCE_DISCLOSURE_1" &&
      disclosure.status === "DELIVERED" &&
      disclosure.preSourceAdmissionDigest === mediaFirstDigest(admission) &&
      disclosure.sourcePacketStageDigest === mediaFirstDigest(stage) &&
      disclosure.reviewerContext === protocol.reviewerContext &&
      disclosure.verifiedByContext === protocol.builderContext &&
      typeof disclosure.nativeMessageId === "string" &&
      disclosure.nativeMessageId.length >= 8 &&
      disclosure.sourcePacketSha256 === stage.packet.sha256 &&
      disclosure.startedAtUtc === protocol.sourceInspectionStartedAt,
    "NATIVE_DISCLOSURE_RECEIPT_REQUIRED",
  );
  const first = JSON.parse(protocol.frozenFirstPass.content);
  const times = [
    first.observationsFrozenAt,
    admission.checkedAtUtc,
    stage.startedAtUtc,
    stage.completedAtUtc,
    disclosure.startedAtUtc,
    disclosure.completedAtUtc,
    protocol.canonicalJudgmentsCompletedAt,
  ].map(time);
  need(
    times.every(Number.isFinite) &&
      times.every((value, index) => index === 0 || times[index - 1] <= value) &&
      times.at(-1) <= now.getTime(),
    "PRE_SOURCE_RECEIPT_CHRONOLOGY_CHANGED",
  );
  return { admission, stage, disclosure };
}
export function validatePreSourceCaptureBinding(plan, evidence, capture, prepare, root) {
  if (plan.exception?.id !== R22_ID) return;
  const { admission } = validatePreSourceAdmissionReceipts(plan, evidence);
  need(
    admission.capture.indexDigest === mediaFirstDigest(capture) &&
      same(
        {
          id: admission.capture.id,
          digest: admission.capture.digest,
          runId: admission.capture.runId,
          runAttempt: admission.capture.runAttempt,
        },
        capture.trustedArtifact,
      ),
    "CURRENT_CAPTURE_INDEX_CHANGED",
  );
  if (prepare)
    need(
      admission.binding.captureCandidateSha === prepare.candidateSha &&
        admission.capture.prepareReservation === prepare.commitSha,
      "CURRENT_PREPARATION_CHANGED",
    );
  if (root)
    need(
      admission.validator.every(
        (entry) =>
          entry.blob ===
          execFileSync("git", ["rev-parse", `${plan.baseSha}:${entry.path}`], { cwd: root, encoding: "utf8" }).trim(),
      ),
      "PINNED_VALIDATOR_CHANGED",
    );
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, argv) => {
      if (index % 2 === 0) pairs.push([value.replace(/^--/u, ""), argv[index + 1]]);
      return pairs;
    }, []),
  );
  const { buildPlan } = await import("./ordinary.mjs");
  const root = path.resolve(options.workspace),
    plan = (
      await buildPlan({
        root,
        baseSha: options.base,
        candidateSha: options.candidate,
        prNumber: 721,
        mode: "ordinary",
        experienceEvidenceRequired: false,
      })
    ).productExperience;
  const result = await stageMediaFirstSource({
    root,
    plan,
    protocol: JSON.parse(readFileSync(options.identity, "utf8")),
    originalPath: options.observations,
    expectedBytes: Number(options.bytes),
    expectedSha256: options.sha256,
    captureArtifactId: Number(options.capture),
    sourcePacketPath: options.packet,
    outputDirectory: options.output,
  });
  process.stdout.write(
    JSON.stringify({
      status: "PASS_STAGED_NOT_DISCLOSED",
      outputDirectory: result.outputDirectory,
      preSourceAdmissionDigest: mediaFirstDigest(result.preSourceAdmission),
      stageDigest: mediaFirstDigest(result.sourcePacketStage),
    }) + "\n",
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
