import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  retainDiagnosticLocalMedia,
  retainTrustedLocalMedia,
} from "../../scripts/sounding-line/experience-local-media.mjs";
import {
  createBoundedArtifactIntake,
  createLocalMediaArtifactIntake,
} from "../../scripts/sounding-line/experience-artifact-intake.mjs";
import { EXPERIENCE_STORAGE_RESERVE } from "../../scripts/sounding-line/experience-capacity.mjs";
import { capacityArtifactZipFixture } from "./fixtures/capacity-artifact-zip.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
async function fixture(
  t,
  {
    method = 8,
    edit = () => {},
    change = () => {},
    diagnosticOnly = false,
    planEdit = () => {},
    tamperArchive = () => {},
    planMember = "artifacts/sounding-line/product-experience-submission/plan.json",
    planPayload,
  } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "local-media-owned-"));
  t.after(async () => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("local-media-owned-"));
    await rm(root, { recursive: true, force: true });
  });
  const git = (args) => execFileSync("git", args, { cwd: root, stdio: "pipe", timeout: 5000 });
  git(["init", "-q"]);
  git(["remote", "add", "origin", "https://github.com/fixture/repository.git"]);
  const out = path.join(root, "media-output");
  await mkdir(out);
  const plan = {
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    contractDigest: "d".repeat(64),
    attestationPolicy: { required: true, trustedReviewActors: ["fixture-actor"] },
  };
  const bodies = new Map([
    [
      "Development_Docs/Testing/Product_Experience/evidence/one/screen.png",
      Buffer.from("synthetic encoded PNG bytes; no decode claim"),
    ],
    [
      "Development_Docs/Testing/Product_Experience/evidence/one/recording.webm",
      Buffer.from("synthetic encoded WebM bytes; no decode claim"),
    ],
    [
      "Development_Docs/Testing/Product_Experience/evidence/two/screen.png",
      Buffer.from("another synthetic screenshot"),
    ],
    [
      "Development_Docs/Testing/Product_Experience/evidence/two/trace.zip",
      Buffer.from("synthetic trace bytes; no trace viewing claim"),
    ],
  ]);
  const artifacts = [...bodies].map(([file, bytes], i) => ({
    id: `media-${i}`,
    path: file,
    bytes: bytes.length,
    sha256: sha(bytes),
    type: file.endsWith(".png") ? "screenshot" : file.endsWith(".webm") ? "recording" : "trace",
    contractId: "fixture-contract",
    state: i < 2 ? "one" : "two",
    device: "desktop",
    role: "creator",
    motionMode: "standard",
  }));
  const manifest = { ...plan, artifacts, journeys: [] };
  delete manifest.attestationPolicy;
  edit({ manifest, bodies });
  const archivedPlan = structuredClone(plan);
  planEdit(archivedPlan);
  const archive = capacityArtifactZipFixture(
    [
      ...(diagnosticOnly
        ? [
            [planMember, planPayload ?? Buffer.from(JSON.stringify(archivedPlan))],
            [
              "artifacts/sounding-line/product-experience-capture-publication/journal-failure.json",
              Buffer.from(
                JSON.stringify({
                  status: "FAILED",
                  baseSha: plan.baseSha,
                  candidateSha: plan.candidateSha,
                  error: "synthetic Inspector wait",
                }),
              ),
            ],
            [
              "staging/unindexed-original.png",
              Buffer.from("synthetic partial media absent from completed capture manifest"),
            ],
          ]
        : [["capture.json", Buffer.from(JSON.stringify(manifest))]]),
      ...bodies,
      ["auxiliary/raw.original", Buffer.from("retain auxiliary bytes in complete archive")],
    ],
    { method, zip64: true, descriptor: true },
  );
  tamperArchive(archive);
  const run = {
    id: 39961561143,
    run_attempt: 1,
    workflow_id: 5,
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: plan.baseSha,
    head_repository: { full_name: "fixture/repository" },
    actor: { login: "fixture-actor" },
    triggering_actor: { login: "fixture-actor" },
    status: "completed",
    conclusion: diagnosticOnly ? "failure" : "success",
  };
  const artifact = {
    id: 101,
    name: `product-experience-capture-${plan.sourceDigest.slice(0, 16)}`,
    workflow_run: { id: run.id },
    digest: `sha256:${sha(archive)}`,
    size_in_bytes: archive.length,
    expired: false,
    expires_at: "2099-01-01T00:00:00Z",
  };
  const workflow = { id: 5, path: ".github/workflows/sounding-line-ordinary.yml" };
  let requests = 0,
    binary = 0;
  const request = async (endpoint, isBinary) => {
    requests++;
    change({ requests, artifact, run, workflow });
    if (isBinary) {
      binary++;
      let at = 0;
      return new Response(
        new ReadableStream({
          pull(c) {
            if (at === archive.length) c.close();
            else {
              const end = Math.min(at + 97, archive.length);
              c.enqueue(archive.subarray(at, end));
              at = end;
            }
          },
        }),
        { headers: { "content-length": String(archive.length) } },
      );
    }
    if (endpoint.includes("artifacts/")) return artifact;
    if (endpoint.includes("runs/")) return run;
    return workflow;
  };
  const rows = () =>
    ["C:/", "D:/"].map((volume) => ({
      volume,
      freeBytes: EXPERIENCE_STORAGE_RESERVE + 80 * 1073741824,
      reserveBytes: EXPERIENCE_STORAGE_RESERVE,
      writes: volume === "D:/",
    }));
  const guards = [];
  const options = {
    root,
    outputParent: out,
    plan,
    artifactId: 101,
    policy: plan.attestationPolicy,
    expectedRunId: run.id,
    expectedRunAttempt: 1,
    expectedArtifactBytes: archive.length,
    expectedArtifactDigest: artifact.digest,
    request,
    measure: async () => rows(),
    allocationUnit: async () => 4096,
    reserveGuard: async (_p, estimate) => {
      guards.push(estimate);
      return { allowed: true, floorBytesEach: EXPERIENCE_STORAGE_RESERVE, ...estimate };
    },
  };
  return {
    root,
    out,
    plan,
    bodies,
    archive,
    artifact,
    run,
    options,
    guards,
    rows,
    counts: () => ({ requests, binary }),
  };
}
test("fixed local deadline is separate from the unchanged protected verifier deadline", () => {
  assert.equal(createBoundedArtifactIntake({ root: os.tmpdir() }).limits.timeoutMs, 120000);
  assert.equal(createLocalMediaArtifactIntake({ root: os.tmpdir() }).limits.timeoutMs, 900000);
  assert.throws(
    () => createBoundedArtifactIntake({ root: os.tmpdir(), limits: { timeoutMs: 900000 } }),
    /LIMIT_INVALID/u,
  );
  assert.throws(
    () => createLocalMediaArtifactIntake({ root: os.tmpdir(), limits: { timeoutMs: 900001 } }),
    /LIMIT_INVALID/u,
  );
});
test("CLI cannot use a self-hashed foreign source plan to start a media writer", async (t) => {
  const f = await fixture(t),
    file = path.join(f.root, "expected-plan.json"),
    bytes = Buffer.from(JSON.stringify(f.plan));
  await writeFile(file, bytes);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          fileURLToPath(new URL("../../scripts/sounding-line/experience-local-media.mjs", import.meta.url)),
          "--workspace",
          f.root,
          "--output-parent",
          f.out,
          "--plan",
          file,
          "--plan-sha256",
          sha(bytes),
          "--artifact",
          "101",
          "--run",
          "39961561143",
          "--attempt",
          "1",
          "--reserve-guard",
          "unused",
        ],
        { cwd: f.root, encoding: "utf8", timeout: 15000, maxBuffer: 65536, stdio: "pipe" },
      ),
    (error) => error.status === 1 && error.stdout === "" && /FAILED_BEFORE_MEDIA_ADMISSION/u.test(error.stderr),
  );
  assert.deepEqual(await readdir(f.out), []);
});
test("stored and deflated local intake retain the entire archive and every original selected path with verified bytes, never a review", async (t) => {
  for (const method of [0, 8]) {
    const f = await fixture(t, { method }),
      result = await retainTrustedLocalMedia(f.options);
    assert.equal(f.counts().binary, 1);
    assert.equal(f.counts().requests, 10);
    assert.deepEqual(await readFile(path.join(result.session, "capture.original.zip")), f.archive);
    for (const [file, bytes] of f.bodies)
      assert.deepEqual(await readFile(path.join(result.session, "members", file)), bytes);
    assert.equal(result.index.files.length, f.bodies.size);
    assert.equal(result.index.actualIdentifiedContexts, 2);
    assert(result.index.files.every((row) => row.reviewStatus === "NOT_REVIEWED"));
    assert(result.index.contexts.some((row) => row.temporalSource === "TRACE_ONLY_DECODE_REQUIRED"));
    assert(result.index.contexts.some((row) => row.temporalSource === "RECORDING_AVAILABLE_NOT_INSPECTED"));
    assert.equal(result.index.renderer.additionalDBytes, null);
    const receipt = JSON.parse(await readFile(result.receipt.path, "utf8"));
    assert.equal(receipt.status, "COMPLETE_VERIFIED_EXTRACTION_NOT_REVIEWED");
    assert.equal(receipt.qualification, false);
    for (const pin of Object.values(receipt.preparedMetadata)) {
      const bytes = await readFile(pin.path);
      assert.equal(bytes.length, pin.bytes);
      assert.equal(sha(bytes), pin.sha256);
    }
    assert.equal(receipt.retainedSetVerification.files, f.bodies.size + 5);
    assert.equal(receipt.retainedSetVerification.externalFilesystemWritersExcluded, false);
    assert.deepEqual(receipt.provenance, {
      freshProviderMetadata: "RECHECKED_AFTER_COPY",
      afterIntakeCleanup: "SNAPSHOT_PROVENANCE_EXPIRY_AND_CANCELLATION_VALIDATED",
    });
    assert(receipt.allocation.concurrentPeakModel >= 2 * f.archive.length + receipt.allocation.selectedAllocatedBytes);
    assert(f.guards.length >= 4);
    assert(f.guards.every((row) => row.c === 0 && Number.isSafeInteger(row.d)));
    assert(
      !(await readdir(result.session)).some(
        (n) => n === ".experience-artifact-intake.lock" || n.startsWith("artifact-intake-"),
      ),
    );
  }
});
test("a selected member hash failure preserves full retained archive and partials with an immutable failure, never COMPLETE", async (t) => {
  const f = await fixture(t, {
    edit: ({ manifest }) => {
      manifest.artifacts[1].sha256 = "0".repeat(64);
    },
  });
  let failure;
  await assert.rejects(retainTrustedLocalMedia(f.options), (error) => {
    failure = error;
    assert.equal(error.localMediaFailure.status, "FAILED_OR_INCOMPLETE_NOT_REVIEWED");
    return true;
  });
  assert.deepEqual(await readFile(path.join(failure.localMediaFailure.session, "capture.original.zip")), f.archive);
  const names = await readdir(failure.localMediaFailure.session);
  assert(names.includes("extraction-failure.original.json"));
  assert(!names.includes("extraction-complete.original.json"));
  assert.equal(f.counts().binary, 1);
});
test("missing required member or case alias fails the entire set without selecting a convenient subset", async (t) => {
  for (const alias of [false, true]) {
    const f = await fixture(t, {
      edit: ({ manifest, bodies }) => {
        const original = manifest.artifacts[0];
        const duplicate = {
          ...original,
          id: "other",
          path: alias ? original.path.toUpperCase() : "missing/screen.png",
        };
        manifest.artifacts.push(duplicate);
        if (alias) bodies.set(duplicate.path, bodies.get(original.path));
      },
    });
    await assert.rejects(retainTrustedLocalMedia(f.options), (error) => {
      assert.match(error.message, /MEMBER_MISSING_OR_AMBIGUOUS|PATH_ALIAS/u);
      return true;
    });
  }
});
test("local C or D reserve failure is checked before archive transport", async (t) => {
  for (const low of [0, 1]) {
    const f = await fixture(t);
    f.options.measure = async () =>
      f.rows().map((row, i) => (i === low ? { ...row, freeBytes: EXPERIENCE_STORAGE_RESERVE } : row));
    await assert.rejects(retainTrustedLocalMedia(f.options), /RESERVE_REACHED/u);
    assert.equal(f.counts().requests, 0);
    assert.deepEqual(await readdir(f.out), []);
  }
});
test("extraction admission counts the retained archive and refuses further writes if free space declines", async (t) => {
  const f = await fixture(t);
  let fullArchive = false;
  const originalGuard = f.options.reserveGuard;
  f.options.reserveGuard = async (p, estimate) => {
    if (f.guards.length >= 3) fullArchive = true;
    return originalGuard(p, estimate);
  };
  f.options.measure = async () =>
    f.rows().map((row) => (fullArchive && row.writes ? { ...row, freeBytes: EXPERIENCE_STORAGE_RESERVE } : row));
  await assert.rejects(retainTrustedLocalMedia(f.options), (error) => {
    assert.match(error.message, /RESERVE_REACHED/u);
    assert.equal(error.localMediaFailure.qualification, false);
    return true;
  });
  assert.equal(f.counts().binary, 1);
});
test("post-copy provider mutation cannot mark retained selected files complete or retry transport", async (t) => {
  const f = await fixture(t, {
    change: ({ requests, run }) => {
      if (requests === 9) run.run_attempt = 2;
    },
  });
  let failure;
  await assert.rejects(retainTrustedLocalMedia(f.options), (error) => {
    failure = error;
    assert.match(error.message, /PROVENANCE_CHANGED/u);
    return true;
  });
  const names = await readdir(failure.localMediaFailure.session);
  assert(!names.includes("extraction-complete.original.json"));
  assert(names.includes("inspection-index.prepared.json"));
  assert.equal(f.counts().binary, 1);
});
test("wrong expected capture run fails before any retained archive/member copy", async (t) => {
  const f = await fixture(t);
  f.options.expectedRunId++;
  let failure;
  await assert.rejects(retainTrustedLocalMedia(f.options), (error) => {
    failure = error;
    assert.match(error.message, /RUN_MISMATCH/u);
    return true;
  });
  const names = await readdir(failure.localMediaFailure.session);
  assert(!names.includes("capture.original.zip"));
});
test("late archive, media, prepared JSON or directory additions fail final retained-set validation", async (t) => {
  for (const target of [
    "capture.original.zip",
    "members/Development_Docs/Testing/Product_Experience/evidence/one/screen.png",
    "allocation.original.json",
    "capture-manifest.observed.json",
    "inspection-index.prepared.json",
    "unexpected.original",
  ]) {
    let f, session;
    f = await fixture(t, {
      change: ({ requests }) => {
        if (requests !== 8) return;
        session = path.join(
          f.out,
          readdirSync(f.out).find((name) => name.startsWith("media-intake-")),
        );
        writeFileSync(path.join(session, ...target.split("/")), "late synthetic mutation", { flag: "w" });
      },
    });
    await assert.rejects(retainTrustedLocalMedia(f.options), /OUTPUT_CHANGED|RETAINED_DIRECTORY_CLOSURE_CHANGED/u);
    assert(!(await readdir(session)).includes("extraction-complete.original.json"));
    assert.equal(f.counts().requests, 10);
    assert.equal(f.counts().binary, 1);
  }
});
test("cancellation at the final pending-receipt boundary preserves selected bytes but cannot publish COMPLETE", async (t) => {
  const f = await fixture(t),
    controller = new AbortController();
  let session;
  f.options.signal = controller.signal;
  f.options.onPendingReceipt = (record) => {
    session = record.session;
    controller.abort(new Error("CANCEL_AT_FINAL_PENDING_WRITE"));
  };
  await assert.rejects(retainTrustedLocalMedia(f.options), /CANCEL_AT_FINAL_PENDING_WRITE/u);
  const names = await readdir(session);
  assert(names.includes("extraction-complete.pending.json"));
  assert(!names.includes("extraction-complete.original.json"));
  assert.deepEqual(await readFile(path.join(session, "capture.original.zip")), f.archive);
  for (const [file, bytes] of f.bodies) assert.deepEqual(await readFile(path.join(session, "members", file)), bytes);
  assert.equal(
    JSON.parse(await readFile(path.join(session, "extraction-complete.pending.json"), "utf8")).status,
    "PENDING_FINAL_CANCELLATION_AND_IDENTITY_CHECK_NOT_COMPLETE",
  );
});
test("fresh publication reserve check denies COMPLETE if either drive declines after the pending receipt", async (t) => {
  for (const low of [0, 1]) {
    const f = await fixture(t);
    let finalizing = false,
      session;
    f.options.onPendingReceipt = (record) => {
      finalizing = true;
      session = record.session;
    };
    f.options.measure = async () =>
      f.rows().map((row, i) => (finalizing && i === low ? { ...row, freeBytes: EXPERIENCE_STORAGE_RESERVE } : row));
    await assert.rejects(retainTrustedLocalMedia(f.options), /RESERVE_REACHED/u);
    const names = await readdir(session);
    assert(names.includes("extraction-complete.pending.json"));
    assert(!names.includes("extraction-complete.original.json"));
    assert.deepEqual(await readFile(path.join(session, "capture.original.zip")), f.archive);
  }
});
test("diagnostic-only stored and deflated intake retains every original member including partial media and failure journals without success attestation", async (t) => {
  for (const method of [0, 8]) {
    const f = await fixture(t, { diagnosticOnly: true, method });
    const result = await retainDiagnosticLocalMedia(f.options);
    assert.equal(f.counts().binary, 1);
    assert.equal(f.counts().requests, 10);
    assert.deepEqual(await readFile(path.join(result.session, "capture.original.zip")), f.archive);
    assert.equal(result.index.files.length, f.bodies.size + 4);
    assert.equal(result.index.actualIdentifiedContexts, null);
    assert.deepEqual(result.index.contexts, []);
    for (const row of result.index.files) {
      const b = await readFile(row.localPath);
      assert.equal(sha(b), row.sha256);
      assert.equal(b.length, row.bytes);
      assert.equal(row.reviewStatus, "NOT_REVIEWED");
    }
    assert(result.index.files.some((r) => r.path.endsWith("journal-failure.json")));
    assert(result.index.files.some((r) => r.path === "staging/unindexed-original.png"));
    const receipt = JSON.parse(await readFile(result.receipt.path, "utf8"));
    assert.equal(receipt.status, "COMPLETE_DIAGNOSTIC_EXTRACTION_NOT_REVIEWED_NOT_ACCEPTANCE");
    assert.equal(receipt.diagnosticOnly, true);
    assert.equal(receipt.sourceRun.conclusion, "failure");
    assert.equal(receipt.productAccepted, false);
    assert.equal(receipt.qualification, false);
    const observed = JSON.parse(await readFile(receipt.preparedMetadata.manifest.path, "utf8"));
    assert.equal(observed.trustedArtifact, undefined);
    await assert.rejects(retainTrustedLocalMedia(f.options), /ATTESTATION_PROVENANCE_INVALID/u);
  }
});
test("diagnostic plan selector accepts each known upload root with stored and deflated members", async (t) => {
  for (const planMember of [
    "plan.json",
    "product-experience-submission/plan.json",
    "candidate/artifacts/sounding-line/product-experience-submission/plan.json",
  ]) {
    for (const method of [0, 8]) {
      const f = await fixture(t, { diagnosticOnly: true, planMember, method });
      const result = await retainDiagnosticLocalMedia(f.options);
      assert(result.index.files.some((row) => row.path === planMember));
      assert.equal(f.counts().requests, 10);
      assert.equal(f.counts().binary, 1);
    }
  }
});
test("diagnostic plan selector rejects duplicate permitted paths, empty, oversized or invalid plan JSON", async (t) => {
  for (const variant of ["duplicate", "empty", "oversize", "invalid"]) {
    const f = await fixture(t, {
      diagnosticOnly: true,
      planPayload:
        variant === "empty"
          ? Buffer.alloc(0)
          : variant === "oversize"
            ? Buffer.alloc(8 * 1048576 + 1, 0x20)
            : variant === "invalid"
              ? Buffer.from("invalid-json")
              : undefined,
      edit: ({ bodies }) => {
        if (variant === "duplicate") bodies.set("product-experience-submission/plan.json", Buffer.from("{}"));
      },
    });
    let failure;
    await assert.rejects(retainDiagnosticLocalMedia(f.options), (error) => {
      failure = error;
      return /PLAN_MEMBER_MISSING_AMBIGUOUS_OR_LIMIT|PLAN_JSON_INVALID/u.test(error.message);
    });
    assert(!(await readdir(failure.localMediaFailure.session)).includes("extraction-complete.original.json"));
    assert.equal(f.counts().binary, 1);
  }
});
test("diagnostic-only expected provider identity, source plan and failed conclusion are mandatory before adoption", async (t) => {
  for (const field of ["digest", "size", "run", "attempt", "base", "actor", "name", "success", "expired", "plan"]) {
    const f = await fixture(t, {
      diagnosticOnly: true,
      planEdit: (p) => {
        if (field === "plan") p.candidateSha = "e".repeat(40);
      },
      change: ({ requests, artifact, run }) => {
        if (requests !== 1) return;
        if (field === "digest") artifact.digest = "sha256:" + "0".repeat(64);
        if (field === "size") artifact.size_in_bytes++;
        if (field === "run") artifact.workflow_run.id++;
        if (field === "attempt") run.run_attempt++;
        if (field === "base") run.head_sha = "f".repeat(40);
        if (field === "actor") run.actor.login = "foreign";
        if (field === "name") artifact.name = "foreign-artifact";
        if (field === "success") run.conclusion = "success";
        if (field === "expired") artifact.expires_at = "2000-01-01T00:00:00Z";
      },
    });
    let failure;
    await assert.rejects(retainDiagnosticLocalMedia(f.options), (error) => {
      failure = error;
      return /PROVIDER_BINDING_INVALID|ARCHIVE_PLAN_MISMATCH/u.test(error.message);
    });
    assert(!(await readdir(failure.localMediaFailure.session)).includes("extraction-complete.original.json"));
    assert.equal(f.counts().binary, field === "plan" ? 1 : 0);
  }
});
test("diagnostic member SHA is derived from the authenticated archive but CRC, late provider change and closure still fail closed", async (t) => {
  for (const mode of ["crc", "late", "alias"]) {
    const f = await fixture(t, {
      diagnosticOnly: true,
      method: 0,
      edit: ({ bodies }) => {
        if (mode === "alias") bodies.set("STAGING/UNINDEXED-ORIGINAL.PNG", Buffer.from("case alias"));
      },
      tamperArchive: (archive) => {
        if (mode === "crc") {
          const at = archive.indexOf(Buffer.from("synthetic encoded PNG bytes"));
          assert(at > 0);
          archive[at] ^= 1;
        }
      },
      change: ({ requests, run }) => {
        if (mode === "late" && requests === 9) run.run_attempt = 2;
      },
    });
    await assert.rejects(
      retainDiagnosticLocalMedia(f.options),
      /MEMBER_DIGEST_OR_SIZE_MISMATCH|PROVIDER_BINDING_INVALID|PATH_ALIAS/u,
    );
    assert.equal(f.counts().binary, 1);
  }
});
test("archive reader capabilities expire and admitted background work is drained before file cleanup", async (t) => {
  const f = await fixture(t),
    intake = createBoundedArtifactIntake({ root: f.out, measure: f.options.measure });
  const binding = {
    repository: "fixture/repository",
    baseSha: f.plan.baseSha,
    candidateSha: f.plan.candidateSha,
    sourceDigest: f.plan.sourceDigest,
    contractDigest: f.plan.contractDigest,
    planDigest: "e".repeat(64),
    runId: "39961561143",
    runAttempt: "1",
  };
  let release,
    entered,
    escaped,
    completed = false,
    settled = false;
  const gate = new Promise((resolve) => {
      release = resolve;
    }),
    started = new Promise((resolve) => {
      entered = resolve;
    });
  const pending = intake
    .withArtifact(
      {
        binding,
        expectedBytes: f.archive.length,
        expectedDigest: `sha256:${sha(f.archive)}`,
        request: () => new Response(f.archive),
      },
      async (archive) => {
        escaped = archive;
        archive.copyArchive(async () => {
          entered();
          await gate;
          completed = true;
        });
        return "callback-returned";
      },
    )
    .then((value) => {
      settled = true;
      return value;
    });
  await started;
  assert.equal(settled, false);
  release();
  assert.equal(await pending, "callback-returned");
  assert.equal(completed, true);
  await assert.rejects(escaped.catalog(), /CAPABILITY_EXPIRED/u);
  assert.deepEqual(await readdir(f.out), []);
});
test("ignored reader failure and overlapping operations cannot be converted into success", async (t) => {
  const f = await fixture(t),
    binding = {
      repository: "fixture/repository",
      baseSha: f.plan.baseSha,
      candidateSha: f.plan.candidateSha,
      sourceDigest: f.plan.sourceDigest,
      contractDigest: f.plan.contractDigest,
      planDigest: "e".repeat(64),
      runId: "39961561143",
      runAttempt: "1",
    };
  for (const overlap of [false, true]) {
    const intake = createBoundedArtifactIntake({ root: f.out, measure: f.options.measure });
    await assert.rejects(
      intake.withArtifact(
        {
          binding,
          expectedBytes: f.archive.length,
          expectedDigest: `sha256:${sha(f.archive)}`,
          request: () => new Response(f.archive),
        },
        async (archive) => {
          if (overlap) {
            await Promise.all([archive.catalog(), archive.readJson("capture.json")]);
          } else {
            archive.copyArchive(async () => {
              throw Error("IGNORED_COPY_ERROR");
            });
            return "not-success";
          }
        },
      ),
    );
    assert.deepEqual(await readdir(f.out), []);
  }
});
