import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPrivateCaptureFixtureRealm,
  privateCaptureKeyFingerprint,
} from "../../scripts/sounding-line/experience-private-publication.mjs";
import { createAuthenticatedPrivateCaptureFixtureAdapters } from "../../scripts/sounding-line/experience-private-view.mjs";
import { createPrivateCaptureFixtureProvider } from "../../scripts/sounding-line/experience-private-provider.mjs";
import { experienceDigest } from "../../scripts/sounding-line/product-experience.mjs";
import { experienceFixture } from "./fixtures/private-capture-experience.mjs";
import { privateCaptureZipFixture } from "./fixtures/private-capture-zip.mjs";
import { privateProviderHttpFixture } from "./fixtures/private-capture-http.mjs";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const canonical = "Development_Docs/Testing/Product_Experience/evidence";
async function fixture(t, mutate = () => {}, httpOptions = {}, fixtureOptions = {}) {
  const candidateRoot = await mkdtemp(path.join(os.tmpdir(), "private-adapter-candidate-"));
  const reviewRoot = await mkdtemp(path.join(os.tmpdir(), "private-adapter-review-"));
  const downloadRoot = await mkdtemp(path.join(os.tmpdir(), "private-adapter-download-"));
  t.after(async () => {
    for (const root of [candidateRoot, reviewRoot, downloadRoot]) await rm(root, { recursive: true, force: true });
  });
  const f = experienceFixture();
  f.plan.candidateSha = "b".repeat(40);
  f.plan.attestationPolicy = { required: true, trustedReviewActors: ["fixture-producer", "fixture-reviewer"] };
  f.evidence.captureArtifactId = 456;
  f.evidence.reviewArtifactId = 789;
  for (const artifact of f.evidence.artifacts) artifact.path = `${canonical}/${artifact.path}`;
  const contents = new Map([...f.bytes].map(([name, bytes]) => [`${canonical}/${name}`, bytes]));
  const trace = Buffer.from("PK\u0003\u0004synthetic-private-trace");
  contents.set(`${canonical}/trace.zip`, trace);
  const { createHash } = await import("node:crypto");
  f.evidence.artifacts.push({
    id: "trace",
    path: `${canonical}/trace.zip`,
    sha256: createHash("sha256").update(trace).digest("hex"),
    contractId: f.contract.id,
    type: "trace",
    origin: "ACTUAL_APPLICATION",
  });
  f.evidence.reviews[0].packetDigest = experienceDigest({
    sourceDigest: f.plan.sourceDigest,
    contract: f.contract,
    artifacts: f.evidence.artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
  });
  mutate(f, contents);
  const binding = {
    repository: "fixture/repository",
    controllerSha: f.plan.baseSha,
    baseSha: f.plan.baseSha,
    candidateSha: f.plan.candidateSha,
    candidateTree: "c".repeat(40),
    sourceDigest: f.plan.sourceDigest,
    contractDigest: f.plan.contractDigest,
    planDigest: experienceDigest(f.plan),
    workflowPath: ".github/workflows/sounding-line-ordinary.yml",
    runId: "123",
    runAttempt: fixtureOptions.runAttempt ?? "1",
    sessionId: randomUUID(),
    policyDigest: "1".repeat(64),
    keyFingerprint: privateCaptureKeyFingerprint(keys.publicKey),
  };
  const archives = new Map(),
    http = privateProviderHttpFixture(archives, { ...httpOptions, binding });
  const provider = createPrivateCaptureFixtureProvider({
    request: http.request,
    credential: async () => "SYNTHETIC_PROVIDER_CREDENTIAL",
    downloadRoot,
    actors: ["fixture-producer", "fixture-reviewer"],
    allowedBlobOrigins: ["https://blob.fixture.invalid"],
  });
  const adapters = createAuthenticatedPrivateCaptureFixtureAdapters({
    ...keys,
    provider,
    reviewRoot,
    actors: ["fixture-producer", "fixture-reviewer"],
    reviewerActors: ["fixture-reviewer"],
    verifierActors: ["fixture-verifier"],
    fixtureCheckpoint: fixtureOptions.fixtureCheckpoint,
  });
  async function packet(kind, packetBinding, review) {
    const sourceDirectory = `input-${kind}`;
    await mkdir(path.join(candidateRoot, sourceDirectory));
    const values = new Map(contents);
    const manifest = structuredClone(f.evidence);
    fixtureOptions.mutateManifest?.(kind, manifest);
    values.set(canonical + "/capture.json", Buffer.from(JSON.stringify(manifest)));
    if (review) {
      review = structuredClone(review);
      fixtureOptions.mutateReview?.(review);
      values.set("private/review/review.json", Buffer.from(JSON.stringify(review)));
    }
    const selectedFiles = [];
    let ordinal = 0;
    for (const [logical, bytes] of values) {
      const extension = path.posix.extname(logical),
        sourcePath = `${sourceDirectory}/input-${ordinal++}${extension}`;
      await writeFile(path.join(candidateRoot, sourcePath), bytes);
      selectedFiles.push({
        path: logical,
        sourcePath,
        type:
          extension === ".json"
            ? "json"
            : extension === ".png"
              ? "screenshot"
              : extension === ".zip"
                ? "trace"
                : "recording",
      });
    }
    const realm = createPrivateCaptureFixtureRealm({ publicKey: keys.publicKey });
    const token = await realm.createPublication({
      root: candidateRoot,
      sourceDirectory,
      selectedFiles,
      binding: packetBinding,
    });
    const paths = await realm.verifiedPaths(token, { binding: packetBinding });
    const members = [];
    for (const file of paths) members.push([path.posix.basename(file), await readFile(path.join(candidateRoot, file))]);
    const id = kind === "capture" ? 456 : 789,
      runId = Number(packetBinding.runId);
    archives.set(id, {
      id,
      runId,
      kind,
      actor: kind === "capture" ? "fixture-producer" : "fixture-reviewer",
      bytes: privateCaptureZipFixture(members, { zip64: true, method: 8, descriptor: true }),
    });
  }
  await packet("capture", binding);
  const options = { artifactId: 456, binding, root: candidateRoot, plan: f.plan, evidence: f.evidence };
  return {
    ...f,
    binding,
    options,
    candidateRoot,
    downloadRoot,
    reviewRoot,
    adapters,
    packet,
    assertClean: async () => {
      assert.deepEqual(await readdir(downloadRoot), []);
      assert.deepEqual(await readdir(reviewRoot), []);
    },
  };
}

test("private reviewer and verifier consume authenticated ZIP64 packets and preserve original experience/attestation validators", async (t) => {
  const f = await fixture(t);
  const review = await f.adapters.review({ ...f.options, actor: "fixture-reviewer" });
  await f.assertClean();
  assert.equal(review.submittedBy, "fixture-reviewer");
  assert.equal(review.captureArtifactId, 456);
  const reviewBinding = { ...f.binding, runId: "124", sessionId: randomUUID() };
  await f.packet("review", reviewBinding, review);
  const result = await f.adapters.verify({ ...f.options, actor: "fixture-verifier", reviewBinding });
  assert.equal(result.status, "PASS");
  await f.assertClean();
});
test("unapproved actors, changed source/context and missing independent review never borrow historical plaintext", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.adapters.review({ ...f.options, actor: "foreign" }), /ACTOR_NOT_APPROVED/u);
  const evidence = structuredClone(f.evidence);
  evidence.artifacts[0].device = "FOREIGN_CONTEXT";
  await assert.rejects(f.adapters.review({ ...f.options, evidence, actor: "fixture-reviewer" }), /CAPTURE_MISMATCH/u);
  await assert.rejects(f.adapters.verify({ ...f.options, actor: "fixture-verifier" }), /REVIEW_BINDING_REQUIRED/u);
  await assert.rejects(
    f.adapters.review({ ...f.options, binding: { ...f.binding, runAttempt: "2" }, actor: "fixture-reviewer" }),
    /PROVENANCE_INVALID/u,
  );
  await f.assertClean();
});
test("matching private bytes still face the original semantic journey and paired-witness assertions", async (t) => {
  const badJourney = await fixture(t, (f) => {
    f.evidence.journeys[0].visibleActions = 0;
  });
  await assert.rejects(
    badJourney.adapters.review({ ...badJourney.options, actor: "fixture-reviewer" }),
    /SEMANTIC_JOURNEY_FAILED/u,
  );
  await badJourney.assertClean();
  const badPair = await fixture(t, (f) => {
    f.evidence.pairedEvidence = { invented: true };
  });
  await assert.rejects(
    badPair.adapters.review({ ...badPair.options, actor: "fixture-reviewer" }),
    /UNPLANNED_WITNESS/u,
  );
  await badPair.assertClean();
});
test("a missing current private artifact fails even when a same-named baseline file exists", async (t) => {
  const f = await fixture(t, (f, contents) => contents.delete(f.evidence.artifacts[0].path));
  await mkdir(path.dirname(path.join(f.candidateRoot, f.evidence.artifacts[0].path)), { recursive: true });
  await writeFile(path.join(f.candidateRoot, f.evidence.artifacts[0].path), "historical plaintext must not be used");
  await assert.rejects(f.adapters.review({ ...f.options, actor: "fixture-reviewer" }), /UNSELECTED_ARTIFACT/u);
  await f.assertClean();
});

test("asynchronous caller mutation cannot replace the source or reviewed context after admission", async (t) => {
  let f,
    changed = false;
  f = await fixture(t, () => {}, {
    requestBarrier: () => {
      if (changed) return;
      changed = true;
      f.plan.candidateSha = "9".repeat(40);
      f.evidence.journeys[0].visibleActions = 0;
      f.evidence.reviews = [];
    },
  });
  const review = await f.adapters.review({ ...f.options, actor: "fixture-reviewer" });
  assert.equal(changed, true);
  assert.equal(review.reviews.length, 1);
  await f.assertClean();
});

test("encrypted inner capture source and exception identities must match the admitted plan", async (t) => {
  for (const key of ["baseSha", "sourceDigest", "contractDigest", "exception"]) {
    const f = await fixture(
      t,
      () => {},
      {},
      {
        mutateManifest: (kind, manifest) => {
          if (kind === "capture")
            manifest[key] = key === "exception" ? { id: "foreign" } : "9".repeat(key === "baseSha" ? 40 : 64);
        },
      },
    );
    await assert.rejects(
      f.adapters.review({ ...f.options, actor: "fixture-reviewer" }),
      /INNER_SOURCE_MISMATCH|INNER_EXCEPTION_MISMATCH/u,
    );
    await f.assertClean();
  }
});
test("private capture transport does not broaden the original plan actor policy", async (t) => {
  const f = await fixture(t, (f) => {
    f.plan.attestationPolicy.trustedReviewActors = ["fixture-reviewer"];
  });
  await assert.rejects(f.adapters.review({ ...f.options, actor: "fixture-reviewer" }), /POLICY_ACTOR_NOT_APPROVED/u);
  await f.assertClean();
});
test("review manifests and their copied capture manifests preserve the same source and exception", async (t) => {
  for (const target of ["capture", "review"]) {
    const f = await fixture(
      t,
      () => {},
      {},
      {
        mutateManifest: (kind, manifest) => {
          if (kind === "review" && target === "capture") manifest.sourceDigest = "9".repeat(64);
        },
        mutateReview: (review) => {
          if (target === "review") review.exception = { id: "foreign" };
        },
      },
    );
    const review = await f.adapters.review({ ...f.options, actor: "fixture-reviewer" });
    const reviewBinding = { ...f.binding, runId: "124", sessionId: randomUUID() };
    await f.packet("review", reviewBinding, review);
    await assert.rejects(
      f.adapters.verify({ ...f.options, actor: "fixture-verifier", reviewBinding }),
      /INNER_SOURCE_MISMATCH|INNER_EXCEPTION_MISMATCH/u,
    );
    await f.assertClean();
  }
});
test("late cancellation during action and private view finalization prevents a successful result", async (t) => {
  for (const stage of ["action-complete", "view-close-complete"]) {
    const controller = new AbortController();
    let observed = false;
    const f = await fixture(
      t,
      () => {},
      {},
      {
        fixtureCheckpoint: async (current) => {
          if (current === stage) {
            observed = true;
            await Promise.resolve();
            controller.abort();
          }
        },
      },
    );
    await assert.rejects(f.adapters.review({ ...f.options, actor: "fixture-reviewer", signal: controller.signal }), {
      name: "AbortError",
    });
    assert.equal(observed, true);
    await f.assertClean();
  }
});

test("exception capture retains the original first-attempt restriction even with matching encrypted provenance", async (t) => {
  const f = await fixture(
    t,
    (f) => {
      f.plan.exception = {
        id: "fixture-exception",
        recordDigest: "e".repeat(64),
        priorRepairRecaptureAttempts: 11,
        independentReviewOrdinal: 3,
      };
      f.evidence.exception = structuredClone(f.plan.exception);
    },
    {
      mutate: (value) => {
        if (value.run_attempt) value.run_attempt = 2;
      },
    },
    { runAttempt: "2" },
  );
  await assert.rejects(f.adapters.review({ ...f.options, actor: "fixture-reviewer" }), /EXCEPTION_ATTEMPT_INVALID/u);
  await f.assertClean();
});
