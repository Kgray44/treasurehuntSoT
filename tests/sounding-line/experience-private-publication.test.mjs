import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { appendFileSync, renameSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PRIVATE_CAPTURE_POLICY,
  PRIVATE_CAPTURE_PURPOSE,
  createPrivateCaptureFixtureRealm,
  createPrivateCapturePublication,
  openVerifiedPrivateCaptureView,
  privateCaptureKeyFingerprint,
  requirePrivateCapturePolicy,
  verifiedPrivateCaptureUploadPaths,
} from "../../scripts/sounding-line/experience-private-publication.mjs";
import { captureAndPublishPrivateExperience } from "../../scripts/sounding-line/experience-capture-publication.mjs";

const generated = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const sha = (value) => createHash("sha256").update(value).digest("hex");
const canonical = "Development_Docs/Testing/Product_Experience/evidence";
const canary = "COOKIE_HEADER_LOGIN_BODY_STORAGESTATE_SECRET_CANARY";
const makeBinding = () => ({
  repository: "fixture/repository",
  controllerSha: "a".repeat(40),
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  candidateTree: "c".repeat(40),
  sourceDigest: "d".repeat(64),
  contractDigest: "e".repeat(64),
  planDigest: "f".repeat(64),
  workflowPath: ".github/workflows/sounding-line-ordinary.yml",
  runId: "123",
  runAttempt: "1",
  sessionId: randomUUID(),
  policyDigest: "1".repeat(64),
  keyFingerprint: privateCaptureKeyFingerprint(generated.publicKey),
});
async function fixture(t, limits, hooks = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "private-capture-fixture-"));
  const reviewRoot = await mkdtemp(path.join(os.tmpdir(), "private-capture-review-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(reviewRoot, { recursive: true, force: true });
  });
  const sourceDirectory = "owned-current-run";
  await mkdir(path.join(root, sourceDirectory));
  const binding = makeBinding(),
    selectedFiles = [],
    contents = new Map([
      [
        `${canonical}/capture.json`,
        Buffer.from(
          JSON.stringify({
            artifacts: [],
            cookies: canary,
            headers: canary,
            login: canary,
            body: canary,
            storageState: canary,
            url: `https://fixture.invalid/${canary}`,
          }),
        ),
      ],
      [`${canonical}/trace.zip`, Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from(canary)])],
      [`${canonical}/screen.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from(canary)])],
      [`${canonical}/video.webm`, Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from(canary)])],
    ]);
  for (const [logical, bytes] of contents) {
    const name = path.posix.basename(logical),
      sourcePath = `${sourceDirectory}/${name}`;
    await writeFile(path.join(root, sourcePath), bytes);
    selectedFiles.push({
      path: logical,
      sourcePath,
      type: name.endsWith(".json")
        ? "json"
        : name.endsWith(".png")
          ? "screenshot"
          : name.endsWith(".zip")
            ? "trace"
            : "recording",
    });
  }
  let paths,
    transform = (packet) => packet;
  const loadArtifact = async () => {
    const entries = new Map();
    for (const file of paths) entries.set(path.posix.basename(file), await readFile(path.join(root, file)));
    // A generated fixture transport, not a GitHub ZIP or real provider receipt.
    const transport = Buffer.from(
      JSON.stringify([...entries].map(([name, bytes]) => [name, bytes.toString("base64")])),
    );
    return transform({
      entries,
      archiveBytes: transport.length,
      archiveDigest: `sha256:${sha(transport)}`,
      artifact: {
        id: 456,
        name: `product-experience-capture-${binding.sourceDigest.slice(0, 16)}`,
        expired: false,
        expires_at: "2099-01-01T00:00:00Z",
        workflow_run: { id: 123 },
        size_in_bytes: transport.length,
        digest: `sha256:${sha(transport)}`,
      },
      run: {
        id: 123,
        run_attempt: 1,
        head_sha: binding.controllerSha,
        head_branch: "main",
        head_repository: { full_name: binding.repository },
        event: "workflow_dispatch",
        conclusion: "success",
        actor: { login: "fixture-owner" },
        triggering_actor: { login: "fixture-owner" },
      },
      workflow: { path: binding.workflowPath },
    });
  };
  const realm = createPrivateCaptureFixtureRealm({ publicKey: generated.publicKey, limits, loadArtifact, ...hooks });
  const access = realm.approveFixtureAccess({
    privateKey: generated.privateKey,
    actors: ["fixture-owner"],
    reviewRoot,
  });
  const publish = async (options = {}) =>
    realm.createPublication({ root, sourceDirectory, selectedFiles, binding, ...options });
  const complete = async () => {
    const token = await publish();
    paths = await realm.verifiedPaths(token, { binding });
    return token;
  };
  const openView = (options = {}) =>
    realm.openView({ artifactId: 456, expectedBinding: binding, approvedAccess: access, ...options });
  return {
    root,
    reviewRoot,
    sourceDirectory,
    selectedFiles,
    contents,
    realm,
    access,
    binding,
    publish,
    complete,
    openView,
    setPaths(value) {
      paths = value;
    },
    getPaths: () => paths,
    transform(callback) {
      transform = callback;
    },
  };
}

test("production policy and private entry points stay disabled before any producer work", async () => {
  assert.equal(PRIVATE_CAPTURE_POLICY.enabled, false);
  assert.equal(PRIVATE_CAPTURE_POLICY.publicKey, null);
  assert.throws(
    () => requirePrivateCapturePolicy({ enabled: true, publicKey: generated.publicKey }),
    /POLICY_NOT_INSTALLED/u,
  );
  let invoked = false;
  for (const action of [
    createPrivateCapturePublication,
    verifiedPrivateCaptureUploadPaths,
    openVerifiedPrivateCaptureView,
    captureAndPublishPrivateExperience,
  ]) {
    await assert.rejects(
      action({
        replay: () => {
          invoked = true;
        },
      }),
      /POLICY_NOT_INSTALLED/u,
    );
  }
  assert.equal(invoked, false);
});

test("generated-key packet restores exact JSON, trace, PNG and WebM bytes privately and exposes no plaintext canary", async (t) => {
  const f = await fixture(t);
  const token = await f.complete();
  assert.equal(Object.keys(token).length, 0);
  for (const file of f.getPaths()) {
    const bytes = await readFile(path.join(f.root, file));
    assert.equal(bytes.includes(Buffer.from(canary)), false);
    assert.equal(bytes.includes(Buffer.from("storageState")), false);
  }
  const view = await f.openView();
  assert.equal(view.evidence.cookies, canary);
  for (const [file, original] of f.contents) assert.deepEqual(view.readArtifact({ file }), original);
  assert.throws(() => view.readArtifact({ file: `${canonical}/historical.zip` }), /UNSELECTED_ARTIFACT/u);
  await view.close();
  assert.deepEqual(await readdir(f.reviewRoot), []);
  assert.throws(() => view.readArtifact({ file: `${canonical}/trace.zip` }), /VIEW_CLOSED/u);
});

test("fixture, cloned, forged, cross-realm and consumed handles never mint production paths", async (t) => {
  const f = await fixture(t),
    token = await f.publish();
  for (const forged of [{}, structuredClone(token), JSON.parse(JSON.stringify(token))])
    await assert.rejects(f.realm.verifiedPaths(forged, { binding: f.binding }), /LIVE_PUBLICATION_REQUIRED/u);
  const foreign = createPrivateCaptureFixtureRealm({ publicKey: generated.publicKey });
  await assert.rejects(foreign.verifiedPaths(token, { binding: f.binding }), /LIVE_PUBLICATION_REQUIRED/u);
  await assert.rejects(verifiedPrivateCaptureUploadPaths(token), /POLICY_NOT_INSTALLED/u);
  await f.realm.verifiedPaths(token, { binding: f.binding });
  await assert.rejects(f.realm.verifiedPaths(token, { binding: f.binding }), /LIVE_PUBLICATION_REQUIRED/u);
});

test("publication handles reject changed current sources and different run bindings", async (t) => {
  const f = await fixture(t),
    token = await f.publish();
  await assert.rejects(
    f.realm.verifiedPaths(token, { binding: { ...f.binding, runAttempt: "2" } }),
    /BINDING_MISMATCH/u,
  );
  await writeFile(path.join(f.root, f.selectedFiles[1].sourcePath), "changed");
  await assert.rejects(f.realm.verifiedPaths(token, { binding: f.binding }), /SOURCE_CHANGED/u);
});

test("concurrent selectors consume one publication exactly once without refunds", async (t) => {
  const f = await fixture(t),
    token = await f.publish();
  const results = await Promise.allSettled([
    f.realm.verifiedPaths(token, { binding: f.binding }),
    f.realm.verifiedPaths(token, { binding: f.binding }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.match(rejected.reason.message, /LIVE_PUBLICATION_REQUIRED/u);
});

test("source mutation restored between pinning and completion cannot mint a packet", async (t) => {
  let original;
  const f = await fixture(t, undefined, {
    sourceBarrier: async ({ stage, path: file }) => {
      if (!file.endsWith("trace.zip")) return;
      if (stage === "opened") {
        original = await readFile(file);
        await writeFile(file, Buffer.alloc(original.length, 9));
      }
      if (stage === "chunk-read") await writeFile(file, original);
    },
  });
  await assert.rejects(f.publish(), /SOURCE_CHANGED/u);
  const parent = path.join(f.root, "artifacts/sounding-line/private-capture-publication");
  for (const directory of await readdir(parent))
    assert.equal((await readdir(path.join(parent, directory))).includes("retention.json"), false);
});

test("bounded private reads reject growth, truncation and path replacement at the same-handle read barrier", async (t) => {
  for (const mutation of ["grow", "truncate", "replace"]) {
    let armed = false,
      restore = () => {};
    const f = await fixture(t, undefined, {
      readBarrier: ({ path: target, expectedBytes }) => {
        if (!armed) return;
        armed = false;
        if (mutation === "grow") appendFileSync(target, Buffer.alloc(1048576));
        if (mutation === "truncate") truncateSync(target, 0);
        if (mutation === "replace") {
          renameSync(target, target + ".old");
          writeFileSync(target, Buffer.alloc(expectedBytes));
          restore = () => {
            rmSync(target);
            renameSync(target + ".old", target);
          };
        }
      },
    });
    await f.complete();
    const view = await f.openView();
    armed = true;
    assert.throws(() => view.readArtifact({ file: `${canonical}/trace.zip` }), /VIEW_CHANGED/u);
    restore();
    await view.close();
    assert.deepEqual(await readdir(f.reviewRoot), []);
  }
});

test("private view root inside the candidate is refused", async (t) => {
  const f = await fixture(t);
  await f.complete();
  const access = f.realm.approveFixtureAccess({
    privateKey: generated.privateKey,
    actors: ["fixture-owner"],
    reviewRoot: f.root,
  });
  await assert.rejects(f.openView({ approvedAccess: access }), /PRIVATE_ROOT_INSIDE_CANDIDATE/u);
});

test("hard links, directory links and excessive empty traversal are refused", async (t) => {
  const hard = await fixture(t);
  await link(path.join(hard.root, hard.selectedFiles[1].sourcePath), path.join(hard.root, "foreign-hard-link.zip"));
  await assert.rejects(hard.publish(), /FILE_LIMIT/u);
  const junction = await fixture(t);
  await symlink(
    junction.reviewRoot,
    path.join(junction.root, junction.sourceDirectory, "foreign"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(junction.publish(), /PATH_NOT_OWNED/u);
  const deep = await fixture(t);
  await mkdir(path.join(deep.root, deep.sourceDirectory, ...Array(34).fill("nested")), { recursive: true });
  await assert.rejects(deep.publish(), /DIRECTORY_LIMIT/u);
});

test("wrong generated recipient keys and cross-purpose or reordered parts cannot open a private view", async (t) => {
  const f = await fixture(t);
  await f.complete();
  const other = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  assert.throws(
    () =>
      f.realm.approveFixtureAccess({
        privateKey: other.privateKey,
        actors: ["fixture-owner"],
        reviewRoot: f.reviewRoot,
      }),
    /ACCESS_INVALID/u,
  );
  const rebindCipherReceipt = (packet) => {
    const receipt = JSON.parse(packet.entries.get("retention.json"));
    const names = Array.from(
      { length: receipt.partCount },
      (_, i) => `part-${String(i + 1).padStart(6, "0")}.encrypted`,
    ).concat("index.encrypted");
    const rows = names.map((name) => ({
      name,
      bytes: packet.entries.get(name).length,
      sha256: sha(packet.entries.get(name)),
    }));
    receipt.cipherSetDigest = sha(Buffer.from(JSON.stringify(rows)));
    receipt.encryptedBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
    packet.entries.set("retention.json", Buffer.from(JSON.stringify(receipt)));
    return packet;
  };
  f.transform((packet) => {
    const original = packet.entries.get("part-000001.encrypted"),
      size = original.readUInt32BE(0);
    const header = JSON.parse(original.subarray(4, 4 + size));
    header.purpose = "OTHER_PURPOSE";
    const encoded = Buffer.from(JSON.stringify(header)),
      prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(encoded.length);
    packet.entries.set("part-000001.encrypted", Buffer.concat([prefix, encoded, original.subarray(4 + size)]));
    return rebindCipherReceipt(packet);
  });
  await assert.rejects(f.openView(), /ENVELOPE_INVALID/u);
  f.transform((packet) => {
    const first = packet.entries.get("part-000001.encrypted");
    packet.entries.set("part-000001.encrypted", packet.entries.get("part-000002.encrypted"));
    packet.entries.set("part-000002.encrypted", first);
    return rebindCipherReceipt(packet);
  });
  await assert.rejects(f.openView(), /ENVELOPE_INVALID/u);
  assert.deepEqual(await readdir(f.reviewRoot), []);
});

test("encryption and output failures cannot return a completion token or overwrite an old output", async (t) => {
  const small = await fixture(t, { partBytes: 1 });
  await assert.rejects(small.publish(), /PART_LIMIT/u);
  const blocked = await fixture(t);
  await writeFile(path.join(blocked.root, "artifacts"), "preserve this original");
  await assert.rejects(blocked.publish(), /PATH_NOT_OWNED/u);
  assert.equal(await readFile(path.join(blocked.root, "artifacts"), "utf8"), "preserve this original");
});

test("selection is exact, unique and confined to this invocation; historical and traversal inputs fail", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.publish({ selectedFiles: [...f.selectedFiles, f.selectedFiles[0]] }), /SELECTION_INVALID/u);
  for (const value of ["../old.zip", "other/old.zip", "owned-current-run/../old.zip", "C:/old.zip"])
    await assert.rejects(
      f.publish({ selectedFiles: [{ ...f.selectedFiles[1], sourcePath: value }] }),
      /PATH_INVALID|SELECTION_INVALID/u,
    );
  await writeFile(path.join(f.root, f.sourceDirectory, "historical.json"), "{}");
  await assert.rejects(f.publish(), /SOURCE_CLOSURE_CHANGED/u);
});

test("publication rejects replaced ciphertext, missing parts, and added output files before path selection", async (t) => {
  for (const mutation of ["replace", "missing", "added"]) {
    const f = await fixture(t),
      token = await f.publish();
    const parent = path.join(f.root, "artifacts/sounding-line/private-capture-publication");
    const directory = path.join(parent, (await readdir(parent))[0]);
    if (mutation === "replace") await writeFile(path.join(directory, "part-000001.encrypted"), "tamper");
    if (mutation === "missing") await rm(path.join(directory, "part-000001.encrypted"));
    if (mutation === "added") await writeFile(path.join(directory, "extra.json"), canary);
    await assert.rejects(f.realm.verifiedPaths(token, { binding: f.binding }), /PACKET_CHANGED/u);
  }
});

test("reader requires its own approved key capability and exact provider/source/run/attempt provenance", async (t) => {
  const f = await fixture(t);
  await f.complete();
  await assert.rejects(f.openView({ approvedAccess: structuredClone(f.access) }), /APPROVED_PRIVATE_ACCESS_REQUIRED/u);
  for (const field of ["candidateSha", "candidateTree", "sourceDigest", "contractDigest", "planDigest", "policyDigest"])
    await assert.rejects(
      f.openView({ expectedBinding: { ...f.binding, [field]: "9".repeat(f.binding[field].length) } }),
      field === "sourceDigest" ? /PROVENANCE_INVALID/u : /RECEIPT_INVALID/u,
    );
  for (const mutate of [
    (p) => {
      p.run.run_attempt = 2;
    },
    (p) => {
      p.run.head_sha = "9".repeat(40);
    },
    (p) => {
      p.run.actor.login = "unapproved";
    },
    (p) => {
      p.workflow.path = "other.yml";
    },
    (p) => {
      p.artifact.digest = `sha256:${"0".repeat(64)}`;
    },
    (p) => {
      p.artifact.expires_at = "2000-01-01T00:00:00Z";
    },
    (p) => {
      p.archiveBytes = Number.MAX_SAFE_INTEGER;
    },
  ]) {
    f.transform((packet) => {
      mutate(packet);
      return packet;
    });
    await assert.rejects(f.openView(), /PROVENANCE_INVALID/u);
  }
});

test("private reader rejects ciphertext substitution and public receipt field injection", async (t) => {
  const f = await fixture(t);
  await f.complete();
  f.transform((packet) => {
    packet.entries.set("part-000001.encrypted", Buffer.from("tampered"));
    return packet;
  });
  await assert.rejects(f.openView(), /CIPHER_DIGEST_MISMATCH/u);
  f.transform((packet) => {
    const receipt = JSON.parse(packet.entries.get("retention.json"));
    receipt.privateField = canary;
    packet.entries.set("retention.json", Buffer.from(JSON.stringify(receipt)));
    return packet;
  });
  await assert.rejects(f.openView(), /RECEIPT_INVALID/u);
  assert.deepEqual(await readdir(f.reviewRoot), []);
});

test("limits fail closed and may only narrow; exact file cap passes while cap plus one fails", async (t) => {
  assert.throws(
    () => createPrivateCaptureFixtureRealm({ publicKey: generated.publicKey, limits: { files: 4097 } }),
    /LIMIT_INVALID/u,
  );
  const f = await fixture(t, { traceBytes: 64, chunkBytes: 16 });
  await writeFile(path.join(f.root, f.selectedFiles[1].sourcePath), Buffer.alloc(64));
  await f.complete();
  const view = await f.openView();
  assert.equal(view.readArtifact({ file: f.selectedFiles[1].path }).length, 64);
  await view.close();
  await writeFile(path.join(f.root, f.selectedFiles[1].sourcePath), Buffer.alloc(65));
  await assert.rejects(f.publish(), /FILE_LIMIT/u);
  const limited = await fixture(t, { plaintextBytes: 1 });
  await assert.rejects(limited.publish(), /AGGREGATE_LIMIT/u);
});

test("cancellation cannot mint completion or leave decrypted files", async (t) => {
  const f = await fixture(t),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(f.publish({ signal: controller.signal }), { name: "AbortError" });
  await f.complete();
  await assert.rejects(f.openView({ signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(await readdir(f.reviewRoot), []);
});

test("cancellation during final source verification stops publication and interrupted selection is never refunded", async (t) => {
  const publishing = new AbortController();
  let reachedSourceVerification = false;
  const first = await fixture(t, undefined, {
    verificationBarrier: ({ stage }) => {
      if (stage === "source") {
        reachedSourceVerification = true;
        publishing.abort();
      }
    },
  });
  await assert.rejects(first.publish({ signal: publishing.signal }), { name: "AbortError" });
  assert.equal(reachedSourceVerification, true);
  let armed = false,
    packetPins = 0;
  const selecting = new AbortController();
  const second = await fixture(t, undefined, {
    verificationBarrier: ({ stage }) => {
      if (armed && stage === "packet" && ++packetPins === 2) selecting.abort();
    },
  });
  const token = await second.publish();
  armed = true;
  await assert.rejects(second.realm.verifiedPaths(token, { binding: second.binding, signal: selecting.signal }), {
    name: "AbortError",
  });
  assert.equal(packetPins, 2);
  await assert.rejects(second.realm.verifiedPaths(token, { binding: second.binding }), /LIVE_PUBLICATION_REQUIRED/u);
  let completeArmed = false;
  const completing = new AbortController();
  const third = await fixture(t, undefined, {
    verificationBarrier: ({ stage }) => {
      if (completeArmed && stage === "complete") completing.abort();
    },
  });
  const completeToken = await third.publish();
  completeArmed = true;
  await assert.rejects(
    third.realm.verifiedPaths(completeToken, { binding: third.binding, signal: completing.signal }),
    { name: "AbortError" },
  );
  await assert.rejects(
    third.realm.verifiedPaths(completeToken, { binding: third.binding }),
    /LIVE_PUBLICATION_REQUIRED/u,
  );
});

test("the capture workflow blocks before reservation and has no plaintext capture/lifecycle/review uploader", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url),
    "utf8",
  );
  assert(
    workflow.indexOf("experience-private-publication.mjs --check-policy") < workflow.indexOf("--operation reserve"),
  );
  for (const forbidden of [
    "candidate/Development_Docs/Testing/Product_Experience/evidence/",
    "path: candidate/artifacts/sounding-line/product-experience-submission/review.json",
    "path: candidate/artifacts/sounding-line/product-experience-submission/activation.json",
    "name: product-experience-lifecycle-",
  ])
    assert.equal(workflow.includes(forbidden), false);
  assert(workflow.includes("${{ steps.experience.outputs.capture_private_verified_paths }}"));
  assert.equal(PRIVATE_CAPTURE_PURPOSE, "VW-CURRENT-RUN-PRIVATE-CAPTURE-1");
});
