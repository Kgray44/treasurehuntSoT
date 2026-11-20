import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  captureCapacityPlan,
  assessHostedCaptureCapacity,
  observeHostedCapacity,
  EXPERIENCE_STORAGE_RESERVE,
} from "../../scripts/sounding-line/experience-capacity.mjs";
import { createBoundedArtifactIntake } from "../../scripts/sounding-line/experience-artifact-intake.mjs";
import { loadTrustedExperienceArtifact } from "../../scripts/sounding-line/experience-attestation.mjs";
import { capacityArtifactZipFixture } from "./fixtures/capacity-artifact-zip.mjs";

const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const binding = () => ({
  repository: "fixture/repository",
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  contractDigest: "d".repeat(64),
  planDigest: "e".repeat(64),
  runId: "123",
  runAttempt: "1",
});
const measurements = async () =>
  ["C:/", "D:/"].map((volume) => ({
    volume,
    freeBytes: EXPERIENCE_STORAGE_RESERVE + 20 * 1073741824,
    reserveBytes: EXPERIENCE_STORAGE_RESERVE,
    writes: volume === "D:/",
  }));
async function fixtureRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "capacity-owned-"));
  t.after(async () => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(root).startsWith("capacity-owned-"));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
function bytesFixture(options = {}) {
  const b = binding(),
    manifest = {
      baseSha: b.baseSha,
      sourceDigest: b.sourceDigest,
      contractDigest: b.contractDigest,
      artifacts: [{ id: "required-trace", type: "trace", path: "trace.zip" }],
      journeys: [],
    };
  return {
    b,
    manifest,
    bytes: capacityArtifactZipFixture(
      [
        ["capture.json", Buffer.from(JSON.stringify(manifest))],
        ["trace.zip", Buffer.from("original required trace")],
        ["screen.png", Buffer.from("original required screenshot")],
        ["recording.webm", Buffer.from("original required recording")],
      ],
      options,
    ),
  };
}
function response(bytes, { declared = bytes.length, cancel = () => {}, chunkSize = 128 } = {}) {
  let offset = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (offset === bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.subarray(offset, (offset += Math.min(chunkSize, bytes.length - offset))));
      },
      cancel,
    }),
    { headers: declared === null ? {} : { "content-length": String(declared) } },
  );
}
async function intake(t, options = {}) {
  const root = await fixtureRoot(t),
    f = bytesFixture(options.zip);
  return {
    ...f,
    root,
    instance: createBoundedArtifactIntake({ root, measure: measurements, ...options }),
    request: {
      binding: f.b,
      expectedBytes: f.bytes.length,
      expectedDigest: sha(f.bytes),
      request: async () => response(f.bytes),
    },
  };
}
test("hosted estimates are nonbinding, immutable and separate from local reserves and private-prototype authority", () => {
  const b = binding(),
    plan = captureCapacityPlan(b);
  b.runId = "999";
  assert.equal(plan.binding.runId, "123");
  assert.equal(plan.hosted.additionalBytes, 57 * 1073741824 + 64 * 1048576);
  assert.equal(plan.local.additionalBytes, 9 * 1073741824 + 96 * 1048576);
  assert.equal(plan.local.inputBufferBytes, 24 * 1048576);
  assert.match(
    plan.local.inputBufferAccounting,
    /EXCLUDES_PARSED_OBJECTS_STRINGS_GARBAGE_TRANSPORT_INTERNALS_AND_RSS/u,
  );
  assert(!plan.hosted.resources.some((row) => row.name.includes("encrypted-current")));
  assert.throws(() => {
    plan.hosted.resources[0].bytes = 1;
  }, TypeError);
  const low = assessHostedCaptureCapacity({ binding: binding(), freeBytes: 14 * 1073741824 });
  assert.equal(low.status, "ESTIMATE_EXCEEDS_OR_EQUALS_OBSERVED_FREE");
  const exact = assessHostedCaptureCapacity({ binding: binding(), freeBytes: plan.hosted.additionalBytes });
  assert.equal(exact.status, low.status);
  const enough = assessHostedCaptureCapacity({
    binding: binding(),
    freeBytes: plan.hosted.additionalBytes + 1,
    enforced: false,
  });
  assert.equal(enough.status, "ESTIMATE_FITS_OBSERVED_FREE");
  for (const result of [low, exact, enough]) {
    assert.equal(result.admission, false);
    assert.equal(result.qualification, false);
    assert.equal(result.writerBounded, false);
    assert.equal(result.hostedReserveBytes, 0);
  }
  for (const freeBytes of [-1, NaN, Infinity, "100", Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => assessHostedCaptureCapacity({ binding: binding(), freeBytes }), /FREE_BYTES_INVALID/u);
});

test("hosted monitor snapshots preliminary source identity without inventing a canonical plan or turning estimate into authority", async () => {
  const input = binding(),
    source = {
      authorityModuleSha256: "1".repeat(64),
      authorityWorkflowSha256: "2".repeat(64),
      candidateLockSha256: "3".repeat(64),
    };
  const expected = 57 * 1073741824 + 64 * 1048576;
  const observed = await observeHostedCapacity({
    root: "unused",
    binding: input,
    source,
    stage: "preinstall",
    measure: async () => {
      input.runId = "999";
      source.candidateLockSha256 = "4".repeat(64);
      return expected + 1;
    },
  });
  assert.equal(observed.plan.binding.runId, "123");
  assert.equal(observed.plan.source.candidateLockSha256, "3".repeat(64));
  assert.equal(observed.plan.binding.sourceDigest, undefined);
  assert.equal(observed.plan.binding.planDigest, undefined);
  assert.equal(observed.status, "ESTIMATE_FITS_OBSERVED_FREE");
  assert.equal(observed.admission, false);
  assert.equal(observed.plan.hosted.additionalBytes, expected);
  for (const stage of ["preinstall", "postinstall"]) {
    const low = await observeHostedCapacity({
      root: "unused",
      binding: binding(),
      source,
      stage,
      measure: async () => 0,
    });
    assert.equal(low.status, "ESTIMATE_EXCEEDS_OR_EQUALS_OBSERVED_FREE");
    assert.equal(low.admission, false);
  }
  await assert.rejects(
    observeHostedCapacity({ binding: binding(), source, stage: "other", measure: async () => 0 }),
    /STAGE_INVALID/u,
  );
  await assert.rejects(
    observeHostedCapacity({
      binding: { ...binding(), runId: "0" },
      source,
      stage: "preinstall",
      measure: async () => 0,
    }),
    /BINDING_INVALID/u,
  );
  await assert.rejects(
    observeHostedCapacity({
      binding: binding(),
      source,
      stage: "preinstall",
      measure: async () => {
        throw Error("measurement failed");
      },
    }),
    /measurement failed/u,
  );
});

test("preinstall and postinstall monitor CLI reads exact checked-out identities, reports actual bytes and writes no files", async (t) => {
  const root = await fixtureRoot(t);
  await mkdir(path.join(root, "scripts/sounding-line"), { recursive: true });
  await mkdir(path.join(root, ".github/workflows"), { recursive: true });
  const modulePath = path.join(root, "scripts/sounding-line/experience-capacity.mjs");
  await writeFile(
    modulePath,
    await readFile(fileURLToPath(new URL("../../scripts/sounding-line/experience-capacity.mjs", import.meta.url))),
  );
  await writeFile(
    path.join(root, ".github/workflows/sounding-line-ordinary.yml"),
    await readFile(fileURLToPath(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url))),
  );
  await writeFile(path.join(root, "package-lock.json"), "{}\n");
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 5000, maxBuffer: 65536 });
  git(["init", "-q"]);
  git(["add", "."]);
  git([
    "-c",
    "user.name=Capacity Fixture",
    "-c",
    "user.email=capacity@example.test",
    "commit",
    "-qm",
    "synthetic capacity source",
  ]);
  const head = git(["rev-parse", "HEAD"]).trim();
  const env = {
    ...process.env,
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: head,
    GITHUB_REPOSITORY: "fixture/repository",
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
  };
  for (const stage of ["preinstall", "postinstall"]) {
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [modulePath, "--workspace", root, "--base", head, "--candidate", head, "--stage", stage],
        { cwd: root, env, encoding: "utf8", timeout: 15000, maxBuffer: 32768 },
      ),
    );
    assert(Number.isSafeInteger(result.freeBytes) && result.freeBytes >= 0);
    assert.equal(result.plan.binding.baseSha, head);
    assert.equal(result.plan.stage, stage);
    assert.equal(result.plan.sourceKind, "BOUNDED_IMMUTABLE_COMMITTED_GIT_BLOBS_NOT_LIVE_FILE_SNAPSHOTS");
    assert.equal(result.admission, false);
    assert.equal(result.plan.source.candidateLockSha256, createHash("sha256").update("{}\n").digest("hex"));
    assert.equal(git(["status", "--porcelain"]), "");
  }
  await writeFile(path.join(root, "package-lock.json"), '{"changed":true}\n');
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [modulePath, "--workspace", root, "--base", head, "--candidate", head, "--stage", "preinstall"],
        { cwd: root, env, encoding: "utf8", timeout: 15000, stdio: "pipe" },
      ),
    (error) => error.status === 1 && /OBSERVATION_UNAVAILABLE/u.test(error.stderr) && error.stdout === "",
  );
});

test("capacity monitor steps are capture-only observations around installation, preserving producer outcome and installed authority", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url),
    "utf8",
  );
  const blocks = workflow.split(/(?=^      - )/mu);
  const pre = blocks.find((b) => b.includes("name: Observe capacity before capture dependency installation"));
  const post = blocks.find((b) => b.includes("name: Observe capacity after capture dependency installation"));
  const install = blocks.find((b) => b.includes("name: Install isolated browser dependencies"));
  const prepare = blocks.find((b) => b.includes("name: Prepare through protected-base authority"));
  assert(pre && post && install && prepare);
  assert(
    workflow.indexOf(pre) < workflow.indexOf(install) &&
      workflow.indexOf(install) < workflow.indexOf(post) &&
      workflow.indexOf(post) < workflow.indexOf(prepare),
  );
  assert.match(pre, /if: inputs.experience_mode == 'capture'/u);
  assert.match(post, /if: always\(\) && inputs.experience_mode == 'capture'/u);
  for (const block of [pre, post]) {
    assert.match(block, /continue-on-error: true/u);
    assert.match(block, /timeout-minutes: 1/u);
    assert.match(block, /node authority\/scripts\/sounding-line\/experience-capacity.mjs/u);
    assert(!block.includes("GH_TOKEN"));
    assert(!block.includes("upload-artifact"));
  }
  assert.match(
    install,
    /npm ci --ignore-scripts\s+npx --no-install prisma generate --schema prisma\/schema.sqlite.prisma\s+npx --no-install playwright install --with-deps chromium/u,
  );
  assert.match(prepare, /experience-prepare-supervised.mjs/u);
  assert.match(prepare, /needs.campaign-custody.outputs.phase/u);
  assert.match(
    workflow,
    /experience-preparation:\s+needs: campaign-custody[\s\S]*?runs-on: ubuntu-latest\s+timeout-minutes: 40/u,
  );
  const custody = workflow.slice(
    workflow.indexOf("  campaign-custody:"),
    workflow.indexOf("  experience-preparation:"),
  );
  assert(custody.includes("experience-exception.mjs --operation reserve"));
  assert(!custody.includes("experience-capacity.mjs"));
  const helper = await readFile(new URL("../../scripts/sounding-line/experience-prepare.mjs", import.meta.url), "utf8");
  assert(!helper.includes("requireHostedCaptureCapacity"));
  assert(!helper.includes("HOST_FILESYSTEM_BOUNDARY_NOT_INSTALLED"));
});
test("file-backed stored/deflated ZIP and ZIP64 preserve all archive bytes and return the exact bounded manifest", async (t) => {
  for (const zip64 of [false, true])
    for (const method of [0, 8]) {
      const f = await intake(t, { zip: { zip64, method, descriptor: true } });
      const value = await f.instance.withArtifact(f.request, async (archive) => {
        const entries = await readdir(f.root),
          dir = entries.find((name) => name.startsWith("artifact-intake-"));
        assert.deepEqual(await readFile(path.join(f.root, dir, "archive.zip")), f.bytes);
        assert.equal(archive.binding.runId, "123");
        return archive.readJson("capture.json");
      });
      assert.deepEqual(value, f.manifest);
      assert.deepEqual(await readdir(f.root), []);
    }
});
test("declared cap is checked before transport and streaming overrun fails before the extra byte is written", async (t) => {
  const f = await intake(t, { limits: { archiveBytes: 64 } });
  let calls = 0;
  await assert.rejects(
    f.instance.withArtifact(
      {
        ...f.request,
        request: () => {
          calls++;
          return response(f.bytes);
        },
      },
      () => assert.fail("must not accept"),
    ),
    /DECLARATION_INVALID/u,
  );
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(f.root), []);
  const g = await intake(t);
  let accepted = false;
  const over = Buffer.concat([g.bytes, Buffer.from([1])]);
  await assert.rejects(
    g.instance.withArtifact({ ...g.request, request: async () => response(over, { declared: null }) }, () => {
      accepted = true;
    }),
    /ACTUAL_SIZE_LIMIT/u,
  );
  assert.equal(accepted, false);
  assert.deepEqual(await readdir(g.root), []);
});
test("wrong length, digest, current bytes and manifest expansion fail closed while immutable old receipts survive", async (t) => {
  for (const kind of ["declared", "short", "digest", "crc", "expansion"]) {
    const f = await intake(t, {
      zip: kind === "crc" ? { crcDelta: 1 } : {},
      ...(kind === "expansion" ? { limits: { manifestBytes: 8 } } : {}),
    });
    await writeFile(path.join(f.root, "failed.original.json"), "old immutable failure");
    const request = { ...f.request };
    if (kind === "declared") request.request = async () => response(f.bytes, { declared: 1 });
    if (kind === "short")
      request.request = async () => response(f.bytes.subarray(0, f.bytes.length - 1), { declared: null });
    if (kind === "digest") request.expectedDigest = `sha256:${"0".repeat(64)}`;
    await assert.rejects(
      f.instance.withArtifact(request, (a) => a.readJson("capture.json")),
      /DECLARED_SIZE_MISMATCH|ACTUAL_DIGEST_OR_SIZE_MISMATCH|MANIFEST_CRC_INVALID|MANIFEST_LIMIT/u,
    );
    assert.deepEqual(await readdir(f.root), ["failed.original.json"]);
    assert.equal(await readFile(path.join(f.root, "failed.original.json"), "utf8"), "old immutable failure");
  }
});
test("each drive reserve is independent and declining free space blocks a write with owned cleanup", async (t) => {
  for (const exhausted of ["C:/", "D:/"]) {
    const f = await intake(t, {
      measure: async () =>
        (await measurements()).map((r) => ({ ...r, freeBytes: r.volume === exhausted ? r.reserveBytes : r.freeBytes })),
    });
    let called = false;
    await assert.rejects(
      f.instance.withArtifact(
        {
          ...f.request,
          request: async () => {
            called = true;
            return response(f.bytes);
          },
        },
        () => {},
      ),
      /RESERVE_REACHED/u,
    );
    assert.equal(called, false);
    assert.deepEqual(await readdir(f.root), []);
  }
  let samples = 0;
  const f = await intake(t, {
    measure: async () => {
      const rows = await measurements();
      if (++samples > 1) rows[1].freeBytes = rows[1].reserveBytes;
      return rows;
    },
  });
  await assert.rejects(
    f.instance.withArtifact(f.request, () => {}),
    /RESERVE_REACHED/u,
  );
  assert.deepEqual(await readdir(f.root), []);
});
test("source/run binding is snapshotted before asynchronous admission and cannot be relabeled", async (t) => {
  const b = binding();
  let seen;
  const f = await intake(t, {
    measure: async () => {
      b.runId = "999";
      b.sourceDigest = "9".repeat(64);
      return measurements();
    },
  });
  await f.instance.withArtifact({ ...f.request, binding: b }, async (archive) => {
    seen = archive.binding;
    assert.throws(() => {
      archive.binding.runId = "888";
    }, TypeError);
    await archive.readJson("capture.json");
  });
  assert.equal(seen.runId, "123");
  assert.equal(seen.sourceDigest, "c".repeat(64));
  assert.deepEqual(await readdir(f.root), []);
});
test("an exclusive cross-instance lock prevents a second archive allocation until first cleanup completes", async (t) => {
  const f = await intake(t);
  let entered, release;
  const started = new Promise((r) => {
      entered = r;
    }),
    hold = new Promise((r) => {
      release = r;
    });
  const first = f.instance.withArtifact(
    {
      ...f.request,
      request: async () => {
        entered();
        await hold;
        return response(f.bytes);
      },
    },
    (a) => a.readJson("capture.json"),
  );
  await started;
  const second = createBoundedArtifactIntake({ root: f.root, measure: measurements });
  let requested = false;
  await assert.rejects(
    second.withArtifact(
      {
        ...f.request,
        request: async () => {
          requested = true;
          return response(f.bytes);
        },
      },
      () => {},
    ),
    /EEXIST/u,
  );
  assert.equal(requested, false);
  release();
  await first;
  assert.deepEqual(await readdir(f.root), []);
});
test("late request disposal is awaited and cancellation/finalizer uncertainty prevents success or another allocation", async (t) => {
  for (const broken of [false, true]) {
    const f = await intake(t, { limits: { cleanupMs: 20 } }),
      controller = new AbortController();
    let cancels = 0,
      calls = 0;
    const pending = f.instance.withArtifact(
      {
        ...f.request,
        signal: controller.signal,
        request: () => {
          calls++;
          queueMicrotask(() => controller.abort());
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  body: {
                    locked: false,
                    cancel: async () => {
                      cancels++;
                      if (broken) throw Error("FIXTURE_DISPOSE_FAILED");
                    },
                  },
                }),
              5,
            ),
          );
        },
      },
      () => assert.fail("cancelled result"),
    );
    await assert.rejects(pending, (error) => {
      assert.equal(broken ? error.cause.name : error.name, "AbortError");
      return true;
    });
    assert.equal(cancels, 1);
    assert.equal(calls, 1);
    if (broken) {
      assert.deepEqual(await readdir(f.root), [".experience-artifact-intake.lock"]);
      await assert.rejects(
        f.instance.withArtifact(f.request, () => {}),
        /CONCURRENT_OR_UNRESOLVED/u,
      );
    } else assert.deepEqual(await readdir(f.root), []);
  }
});
test("action plus cleanup failure preserves both errors and unknown files; a retained lock blocks reuse", async (t) => {
  const f = await intake(t);
  let foreign;
  await assert.rejects(
    f.instance.withArtifact(f.request, async () => {
      const dir = (await readdir(f.root)).find((n) => n.startsWith("artifact-intake-"));
      foreign = path.join(f.root, dir, "foreign.original");
      await writeFile(foreign, "preserve");
      throw Error("ORIGINAL_ACTION_FAILURE");
    }),
    (error) => {
      assert.equal(error.cause.message, "ORIGINAL_ACTION_FAILURE");
      assert(error.errors.some((e) => e.code === "ENOTEMPTY"));
      return true;
    },
  );
  assert.equal(await readFile(foreign, "utf8"), "preserve");
  await assert.rejects(
    f.instance.withArtifact(f.request, () => {}),
    /CONCURRENT_OR_UNRESOLVED/u,
  );
});
test("archive replacement and late action cancellation cannot produce an accepted manifest", async (t) => {
  const f = await intake(t);
  await assert.rejects(
    f.instance.withArtifact(f.request, async (a) => {
      const dir = (await readdir(f.root)).find((n) => n.startsWith("artifact-intake-")),
        file = path.join(f.root, dir, "archive.zip");
      await writeFile(file, Buffer.alloc(f.bytes.length));
      return a.readJson("capture.json");
    }),
    /FILE_CHANGED/u,
  );
  assert.deepEqual(await readdir(f.root), []);
  const g = await intake(t),
    c = new AbortController();
  await assert.rejects(
    g.instance.withArtifact({ ...g.request, signal: c.signal }, async (a) => {
      await a.readJson("capture.json");
      c.abort();
      return "must not return";
    }),
    { name: "AbortError" },
  );
  assert.deepEqual(await readdir(g.root), []);
});
async function loaderFixture(t, mutate = () => {}, editManifest = () => {}) {
  const root = await fixtureRoot(t);
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://github.com/fixture/repository.git"]);
  const f = bytesFixture(),
    calls = [];
  editManifest(f.manifest);
  f.bytes = capacityArtifactZipFixture([
    ["capture.json", Buffer.from(JSON.stringify(f.manifest))],
    ["trace.zip", Buffer.from("original required trace")],
  ]);
  const plan = {
    applicable: true,
    baseSha: f.b.baseSha,
    candidateSha: f.b.candidateSha,
    sourceDigest: f.b.sourceDigest,
    contractDigest: f.b.contractDigest,
    attestationPolicy: { required: true, trustedReviewActors: ["fixture-owner"] },
  };
  const artifact = {
    id: 456,
    name: "product-experience-capture-" + f.b.sourceDigest.slice(0, 16),
    expired: false,
    expires_at: "2099-01-01T00:00:00Z",
    workflow_run: { id: 123 },
    digest: sha(f.bytes),
    size_in_bytes: f.bytes.length,
  };
  const run = {
    id: 123,
    run_attempt: 1,
    workflow_id: 77,
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: plan.baseSha,
    head_repository: { full_name: "fixture/repository" },
    actor: { login: "fixture-owner" },
    triggering_actor: { login: "fixture-owner" },
    conclusion: "success",
  };
  const workflow = { id: 77, path: ".github/workflows/sounding-line-ordinary.yml" };
  const request = async (endpoint, binary) => {
    calls.push(endpoint);
    mutate({ plan, artifact, run, workflow, calls, endpoint });
    return binary
      ? f.bytes
      : structuredClone(endpoint.includes("/artifacts/") ? artifact : endpoint.includes("/runs/") ? run : workflow);
  };
  return {
    root,
    plan,
    artifact,
    run,
    workflow,
    calls,
    request,
    load: () =>
      loadTrustedExperienceArtifact({
        root,
        plan,
        artifactId: 456,
        kind: "capture",
        policy: plan.attestationPolicy,
        request,
      }),
  };
}
test("accepted loader uses file-backed intake and original provenance/source checks with Buffer fixture compatibility", async (t) => {
  const f = await loaderFixture(t);
  const result = await f.load();
  assert.equal(result.trustedArtifact.id, 456);
  assert.equal(result.artifacts[0].type, "trace");
  assert.equal(f.calls.length, 7);
  assert.deepEqual(await readdir(f.root), [".git"]);
});
test("accepted loader rejects changed run/attempt/actor/expiry/size after transfer without retry", async (t) => {
  for (const key of ["id", "run_attempt", "actor", "expiry", "size"]) {
    const f = await loaderFixture(t, ({ run, artifact, calls }) => {
      if (calls.length < 5) return;
      if (key === "actor") run.actor.login = "foreign";
      else if (key === "expiry") artifact.expires_at = "2000-01-01T00:00:00Z";
      else if (key === "size") artifact.size_in_bytes++;
      else run[key]++;
    });
    await assert.rejects(f.load(), /ATTESTATION_PROVENANCE_INVALID|ATTESTATION_PROVENANCE_CHANGED/u);
    assert.equal(f.calls.length, 7);
    assert.deepEqual(await readdir(f.root), [".git"]);
  }
});
test("accepted loader snapshots caller source and policy before its first metadata await", async (t) => {
  const f = await loaderFixture(t, ({ plan, calls }) => {
    if (calls.length === 1) {
      plan.candidateSha = "9".repeat(40);
      plan.sourceDigest = "8".repeat(64);
      plan.attestationPolicy.trustedReviewActors = [];
    }
  });
  const result = await f.load();
  assert.equal(result.sourceDigest, "c".repeat(64));
  assert.deepEqual(await readdir(f.root), [".git"]);
});

test("original inner source and exception checks still reject a validly downloaded wrong-source manifest", async (t) => {
  for (const key of ["baseSha", "sourceDigest", "contractDigest", "exception"]) {
    const f = await loaderFixture(
      t,
      () => {},
      (manifest) => {
        manifest[key] = key === "exception" ? { id: "foreign" } : "9".repeat(key === "baseSha" ? 40 : 64);
      },
    );
    if (key === "exception") f.plan.exception = { id: "admitted" };
    await assert.rejects(f.load(), /ATTESTATION_SOURCE_MISMATCH/u);
    assert.equal(f.calls.length, 4);
    assert.deepEqual(await readdir(f.root), [".git"]);
  }
});

test("duplicate/aliased/traversal members and central expansion declarations are rejected without extraction", async (t) => {
  for (const kind of ["duplicate", "alias", "traversal", "expansion"]) {
    const f = await intake(t),
      members = [
        ["capture.json", Buffer.from(JSON.stringify(f.manifest))],
        ["trace.zip", Buffer.from("required")],
      ];
    if (kind === "duplicate") members.push(members[0]);
    if (kind === "alias")
      members.push(["artifacts/sounding-line/product-experience-submission/capture.json", members[0][1]]);
    if (kind === "traversal") members.push(["../foreign.json", Buffer.from("{}")]);
    const bytes = capacityArtifactZipFixture(members, { zip64: kind === "expansion" });
    if (kind === "expansion") {
      const central = bytes.indexOf(Buffer.from([80, 75, 1, 2]));
      const nameBytes = bytes.readUInt16LE(central + 28);
      bytes.writeBigUInt64LE(10n * 1073741824n, central + 46 + nameBytes + 4);
    }
    await assert.rejects(
      f.instance.withArtifact(
        { ...f.request, expectedBytes: bytes.length, expectedDigest: sha(bytes), request: async () => response(bytes) },
        (a) => a.readJson("capture.json"),
      ),
      /ZIP_MEMBER_INVALID|MANIFEST_AMBIGUOUS|ZIP_EXPANSION_LIMIT/u,
    );
    assert.deepEqual(await readdir(f.root), []);
  }
});
