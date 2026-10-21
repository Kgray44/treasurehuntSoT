import { fileURLToPath } from "node:url";
// Synthetic control-route tests; no native message, provider write or capture.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mediaFirstFixture } from "./experience-media-first-r21.test.mjs";
import { R22_ID, R23_ID, R22_MEDIA_PROTOCOL } from "../../scripts/sounding-line/experience-media-first-r22-policy.mjs";
import { mediaFirstDigest } from "../../scripts/sounding-line/experience-media-first-shared.mjs";
import {
  SOURCE_GATE_VALIDATOR_PATHS,
  stageMediaFirstSource,
  validatePreSourceAdmissionReceipts,
  validatePreSourceCaptureBinding,
} from "../../scripts/sounding-line/experience-review-source-gate.mjs";

function fixture(t, generation = 22) {
  const f = mediaFirstFixture(),
    root = mkdtempSync(path.join(tmpdir(), "r22-source-gate-"));
  assert(root.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "Synthetic gate");
  git("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  for (const filename of SOURCE_GATE_VALIDATOR_PATHS)
    writeFileSync(
      path.join(root, filename),
      readFileSync(fileURLToPath(new URL("../../" + filename, import.meta.url))),
    );
  git("add", ".");
  git("commit", "-qm", "inert base for source release tests");
  Object.assign(f.plan, { baseSha: git("rev-parse", "HEAD"), candidateSha: "a".repeat(40) });
  assert([22, 23].includes(generation));
  Object.assign(f.plan.exception, {
    id: generation === 23 ? R23_ID : R22_ID,
    version: generation,
    independentReviewOrdinal: 12,
  });
  f.plan.exception.currentSourceAdmission.reviewProtocol = structuredClone(R22_MEDIA_PROTOCOL);
  f.evidence.mediaFirstReview.kind = R22_MEDIA_PROTOCOL.kind;
  f.evidence.mediaFirstReview.criticCreation.createdAtUtc =
    generation === 23 ? "2026-10-20T23:20:00Z" : "2026-10-20T18:25:00Z";
  f.first.criticCreation = structuredClone(f.evidence.mediaFirstReview.criticCreation);
  f.first.mediaInspectionStartedAt = generation === 23 ? "2026-10-20T23:21:00Z" : "2026-10-20T18:26:00Z";
  f.first.observationsFrozenAt = generation === 23 ? "2026-10-20T23:23:00Z" : "2026-10-20T18:28:00Z";
  f.evidence.mediaFirstReview.sourceInspectionStartedAt =
    generation === 23 ? "2026-10-20T23:25:00Z" : "2026-10-20T18:30:00Z";
  f.evidence.mediaFirstReview.canonicalJudgmentsCompletedAt =
    generation === 23 ? "2026-10-20T23:26:00Z" : "2026-10-20T18:31:00Z";
  f.seal();
  const originalPath = path.join(root, "observations.original.json"),
    packetPath = path.join(root, "custodian-source.txt");
  writeFileSync(packetPath, "Synthetic source and contract pointers, custodian only.");
  const prepare = { commitSha: "b".repeat(40), candidateSha: f.plan.candidateSha, run: { runId: 80 } };
  const capture = {
    baseSha: f.plan.baseSha,
    sourceDigest: f.plan.sourceDigest,
    contractDigest: f.plan.contractDigest,
    exception: f.plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    artifacts: f.evidence.artifacts,
    trustedArtifact: { id: f.evidence.captureArtifactId, digest: "sha256:" + "f".repeat(64), runId: 80, runAttempt: 1 },
  };
  let sourceReads = 0,
    run = 0;
  const stage = (extra = {}) => {
    writeFileSync(originalPath, f.evidence.mediaFirstReview.frozenFirstPass.content);
    const outputDirectory = path.join(root, `run-${++run}`);
    return stageMediaFirstSource({
      root,
      plan: f.plan,
      protocol: f.evidence.mediaFirstReview,
      originalPath,
      expectedBytes: f.evidence.mediaFirstReview.frozenFirstPass.bytes,
      expectedSha256: f.evidence.mediaFirstReview.frozenFirstPass.sha256,
      captureArtifactId: f.evidence.captureArtifactId,
      sourcePacketPath: packetPath,
      outputDirectory,
      now: () => new Date(generation === 23 ? "2026-10-20T23:24:00Z" : "2026-10-20T18:29:00Z"),
      loadCapture: async () => ({ capture, prepare }),
      readSourcePacket: (filename) => {
        sourceReads++;
        assert.equal(
          JSON.parse(readFileSync(path.join(outputDirectory, "pre-source-admission.original.json"))).status,
          "PASS",
        );
        assert.equal(
          readFileSync(path.join(outputDirectory, "first-pass.original.json"), "utf8"),
          f.evidence.mediaFirstReview.frozenFirstPass.content,
        );
        return readFileSync(filename);
      },
      ...extra,
    });
  };
  return { ...f, root, originalPath, capture, prepare, stage, sourceReads: () => sourceReads };
}
export { fixture as sourceGateFixture };

test("R22 stages source only after actual frozen bytes pass and a durable original receipt exists", async (t) => {
  const f = fixture(t),
    result = await f.stage();
  assert.equal(f.sourceReads(), 1);
  assert.equal(result.sourcePacketStage.status, "STAGED_NOT_DISCLOSED");
  assert.equal(result.preSourceAdmission.firstPass.sha256, f.evidence.mediaFirstReview.frozenFirstPass.sha256);
  assert.equal(result.preSourceAdmission.capture.indexDigest, mediaFirstDigest(f.capture));
  assert.equal(existsSync(path.join(result.outputDirectory, "source-packet.released.original.txt")), true);
});

test("R22 rejects missing roots, string capture ID and malformed canonical/paired observations before source reads", async (t) => {
  const f = fixture(t),
    original = structuredClone(f.first);
  const mutations = [
    (value) => {
      delete value.kind;
    },
    (value) => {
      value.captureArtifactId = String(value.captureArtifactId);
    },
    (value) => {
      value.criticSelection = { fresh: true };
    },
    (value) => {
      const d = value.contractObservations[0].dimensions.hierarchy;
      d.mediaIds = d.evidenceIds;
      delete d.evidenceIds;
    },
    (value) => {
      value.contractObservations[0].dimensions.keyboard.evidenceIds = [];
    },
    (value) => {
      value.contractObservations[0].dimensions.keyboard.observation = "";
    },
    (value) => {
      const paired = value.pairedObservations[0];
      paired.scenario = paired.caseId;
      delete paired.caseId;
    },
    (value) => {
      const paired = value.pairedObservations[0];
      paired.devices = paired.contexts;
      delete paired.contexts;
    },
  ];
  for (const mutate of mutations) {
    Object.assign(f.first, structuredClone(original));
    mutate(f.first);
    f.seal();
    await assert.rejects(f.stage(), /PRODUCT_EXPERIENCE_R21_MEDIA_FIRST_/u);
    assert.equal(f.sourceReads(), 0);
  }
});

test("R22 fails closed for actual-byte mismatch, stale capture/index or receipt-write failure", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.stage({ expectedSha256: "0".repeat(64) }), /FROZEN_BYTES_CHANGED/u);
  f.capture.sourceDigest = "0".repeat(64);
  await assert.rejects(f.stage(), /AUTHENTICATED_CAPTURE_OR_PREPARATION_MISMATCH/u);
  f.capture.sourceDigest = f.plan.sourceDigest;
  await assert.rejects(
    f.stage({
      persist: (filename) => {
        throw Error("bounded synthetic receipt-write failure:" + filename);
      },
    }),
    /receipt-write failure/u,
  );
  assert.equal(f.sourceReads(), 0);
  const failure = JSON.parse(readFileSync(path.join(f.root, "run-3/failure.original.json")));
  assert.equal(failure.passingAdmissionRetained, false);
});

test("R22 staging failure retains PASS but never asserts source delivery", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    f.stage({
      readSourcePacket: () => {
        throw Error("synthetic packet read failure");
      },
    }),
    /packet read failure/u,
  );
  const failure = JSON.parse(readFileSync(path.join(f.root, "run-1/failure.original.json")));
  assert.equal(failure.passingAdmissionRetained, true);
  assert.equal(failure.status, "FAILED_NOT_DISCLOSED_BY_THIS_ROUTE");
  assert.equal(existsSync(path.join(f.root, "run-1/source-packet-stage.original.json")), false);
});

test("R22 rejects a base validator that differs from the executing source before packet access", async (t) => {
  const f = fixture(t),
    filename = path.join(f.root, SOURCE_GATE_VALIDATOR_PATHS[0]);
  writeFileSync(filename, readFileSync(filename, "utf8") + "\n// Different synthetic validator revision.\n");
  const git = (...args) => execFileSync("git", args, { cwd: f.root, encoding: "utf8" }).trim();
  git("add", ".");
  git("commit", "-qm", "different pinned validator");
  f.plan.baseSha = f.capture.baseSha = git("rev-parse", "HEAD");
  await assert.rejects(f.stage(), /PINNED_RUNTIME_VALIDATOR_CHANGED/u);
  assert.equal(f.sourceReads(), 0);
  assert.equal(existsSync(path.join(f.root, "run-1/pre-source-admission.original.json")), false);
});

test("R22 retains the checked byte snapshot across input replacement and refuses output reuse", async (t) => {
  const f = fixture(t),
    expected = f.evidence.mediaFirstReview.frozenFirstPass.content,
    result = await f.stage({
      loadCapture: async () => {
        writeFileSync(f.originalPath, "Replaced after the actual original was read.");
        return { capture: f.capture, prepare: f.prepare };
      },
    });
  assert.equal(readFileSync(path.join(result.outputDirectory, "first-pass.original.json"), "utf8"), expected);
  const receipt = readFileSync(path.join(result.outputDirectory, "pre-source-admission.original.json"));
  await assert.rejects(f.stage({ outputDirectory: result.outputDirectory }), /EEXIST/u);
  assert.deepEqual(readFileSync(path.join(result.outputDirectory, "pre-source-admission.original.json")), receipt);
  assert.equal(f.sourceReads(), 1);
});

test("R22 final evidence requires the same PASS, staged bytes and actual native disclosure provenance", async (t) => {
  const f = fixture(t),
    result = await f.stage(),
    protocol = f.evidence.mediaFirstReview;
  Object.assign(protocol, result);
  delete protocol.outputDirectory;
  assert.throws(() => validatePreSourceAdmissionReceipts(f.plan, f.evidence), /NATIVE_DISCLOSURE_RECEIPT_REQUIRED/u);
  protocol.sourceDisclosure = {
    kind: "CROSSDECK_NATIVE_SOURCE_DISCLOSURE_1",
    status: "DELIVERED",
    preSourceAdmissionDigest: mediaFirstDigest(protocol.preSourceAdmission),
    sourcePacketStageDigest: mediaFirstDigest(protocol.sourcePacketStage),
    reviewerContext: protocol.reviewerContext,
    verifiedByContext: protocol.builderContext,
    nativeMessageId: "synthetic-native-message-not-a-real-send",
    sourcePacketSha256: protocol.sourcePacketStage.packet.sha256,
    startedAtUtc: protocol.sourceInspectionStartedAt,
    completedAtUtc: "2026-10-20T18:30:01Z",
  };
  const now = new Date("2026-10-20T18:35:00Z");
  validatePreSourceAdmissionReceipts(f.plan, f.evidence, now);
  validatePreSourceCaptureBinding(f.plan, f.evidence, f.capture, f.prepare);
  f.prepare.candidateSha = "0".repeat(40);
  assert.throws(
    () => validatePreSourceCaptureBinding(f.plan, f.evidence, f.capture, f.prepare),
    /CURRENT_PREPARATION_CHANGED/u,
  );
  protocol.preSourceAdmission.firstPass.bytes++;
  assert.throws(() => validatePreSourceAdmissionReceipts(f.plan, f.evidence, now), /PASS_RECEIPT_REQUIRED/u);
});
