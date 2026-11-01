import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { artifactRegistryFixture } from "./fixtures/artifact-registry-v2.mjs";

// The reader must be installed in the Git root whose exact bytes the provider attests.
const files = [
  "scripts/sounding-line/native-original-context-auth.mjs",
  "scripts/sounding-line/provider-run-log-archive.mjs",
  "scripts/sounding-line/native-evidence-context.mjs",
  ".github/workflows/sounding-line-ordinary.yml",
  "scripts/sounding-line/artifact-registry-archive.mjs",
  "scripts/sounding-line/artifact-registry-provenance.mjs",
];
const root = fs.mkdtempSync(path.join(os.tmpdir(), "original-context-auth-"));
for (const item of fs.readdirSync(new URL("../../scripts/sounding-line/", import.meta.url), { withFileTypes: true })) {
  const file = `scripts/sounding-line/${item.name}`;
  if (item.isFile() && !files.includes(file)) files.push(file);
}
assert(files.length <= 256);
const { publicKey: fixturePublicObject, privateKey: fixturePrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const fixturePublicKey = fixturePublicObject.export({ type: "spki", format: "pem" });
const fixtureEncryption = {
  publicKey: fixturePublicKey,
  keyId: createHash("sha256").update(fixturePublicKey).digest("hex"),
};
const git = (...args) =>
  execFileSync("git", ["-c", "gc.auto=0", "-c", "core.autocrlf=false", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
git("init", "-q");
git("config", "user.name", "Synthetic evidence test");
git("config", "user.email", "fixture@example.invalid");
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(new URL(`../../${file}`, import.meta.url), path.join(root, file));
}
// Instrument only the independently committed synthetic installed source.
// Production has no caller-supplied transport or test globals.
const fixtureReader = path.join(root, files[0]);
const productionReader = fs.readFileSync(fixtureReader, "utf8");
const transportBody =
  /function providerRequest\(endpoint, \{ maximumBytes, timeoutMs \}\) \{[\s\S]*?\n\}\nexport async function/u;
assert(transportBody.test(productionReader));
fs.writeFileSync(
  fixtureReader,
  productionReader.replace(
    transportBody,
    "function providerRequest(endpoint, options) { return globalThis.__syntheticOriginalContextProvider(endpoint, options); }\nexport async function",
  ),
);
fs.writeFileSync(path.join(root, "scripts/sounding-line/synthetic-controller.mjs"), "export const synthetic = true;\n");
// Change only the separately committed fixture's public-key pin. No production
// owner key is read or provisioned, and no private key is written to disk.
const keyModule = path.join(root, "scripts/sounding-line/private-browser-failure.mjs");
const keySource = fs.readFileSync(keyModule, "utf8");
const keyDeclaration = "export const BROWSER_FAILURE_ENCRYPTION_KEY = Object.freeze({ publicKey, keyId });";
assert(keySource.includes(keyDeclaration));
fs.writeFileSync(
  keyModule,
  keySource.replace(
    keyDeclaration,
    `export const BROWSER_FAILURE_ENCRYPTION_KEY = Object.freeze(${JSON.stringify(fixtureEncryption)});`,
  ),
);
git("add", ".");
git("commit", "-qm", "Synthetic installed producer");
const base = git("rev-parse", "HEAD");
fs.writeFileSync(path.join(root, "unrelated.txt"), "Additive current source\n");
git("add", ".");
git("commit", "-qm", "Synthetic accepted current source");
const current = git("rev-parse", "HEAD"),
  candidate = "d".repeat(40);
const api = await import(pathToFileURL(path.join(root, files[0])).href);
const repository = { id: 1303074266, full_name: "Kgray44/treasurehuntSoT", owner: { id: 64373011 } };
const owner = { id: 64373011, login: "Kgray44" };
const start = "2026-11-01T16:00:00Z",
  end = "2026-11-01T16:01:00Z";
const step = (name, number) => ({
  name,
  number,
  status: "completed",
  conclusion: "success",
  started_at: start,
  completed_at: end,
});
const zip = (member, body) =>
  execFileSync(
    "python",
    [
      "-c",
      "import io,sys,json,zipfile; d=json.load(sys.stdin); b=io.BytesIO(); z=zipfile.ZipFile(b,'w',compression=zipfile.ZIP_DEFLATED); z.writestr(d['member'],d['body']); z.close(); sys.stdout.buffer.write(b.getvalue())",
    ],
    { input: JSON.stringify({ member, body }), windowsHide: true, maxBuffer: 1024 * 1024 },
  );
const sources = {};
for (const revision of [base, current]) {
  const treeSha = git("rev-parse", `${revision}^{tree}`);
  sources[`git/commits/${revision}`] = { sha: revision, tree: { sha: treeSha } };
  const tree = git("ls-tree", "-r", revision)
    .split("\n")
    .map((line) => {
      const [, mode, type, sha, file] = /^(\d+) (\w+) ([a-f0-9]+)\t(.*)$/u.exec(line);
      const bytes = fs.readFileSync(path.join(root, file));
      assert.equal(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), sha);
      sources[`git/blobs/${sha}`] = {
        sha,
        size: bytes.length,
        encoding: "base64",
        content:
          bytes
            .toString("base64")
            .match(/.{1,60}/gu)
            .join("\n") + "\n",
      };
      return { path: file, mode, type, sha };
    });
  sources[`git/trees/${treeSha}?recursive=1`] = { sha: treeSha, truncated: false, tree };
}
function fixture(jobKey = "experience-preparation", event = "workflow_dispatch") {
  const final = jobKey === "final-check";
  const context = {
    schemaVersion: 2,
    kind: "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW",
    authentication: "OBSERVED_EVENT_DATA_NOT_AUTHENTICATED_BY_SERIALIZATION",
    repository: repository.full_name,
    repositoryId: repository.id,
    actorId: owner.id,
    runId: 4444,
    attempt: 1,
    jobKey,
    event,
    mode: final ? "ordinary" : "capture",
    prNumber: 900,
    baseSha: base,
    candidateSha: candidate,
    workflowRef: "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main",
    workflowSha: base,
    qualification: false,
    reuseAuthorized: false,
  };
  const run = {
    id: 4444,
    run_attempt: 1,
    status: "completed",
    conclusion: "failure",
    event,
    path: ".github/workflows/sounding-line-ordinary.yml",
    repository,
    head_repository: repository,
    actor: owner,
    triggering_actor: owner,
    referenced_workflows: [],
    workflow_id: 51,
    head_sha: event === "pull_request_target" ? candidate : base,
    head_branch: "main",
    pull_requests: [],
  };
  const names = final
    ? [
        "Set up job",
        "Bind the event to exact source identities",
        "Run actions/checkout@v4",
        "Observe immutable original evidence context",
      ]
    : ["Set up job", "Checkout exact protected authority", "Observe immutable original evidence context"];
  const job = {
    id: 55,
    run_id: 4444,
    run_attempt: 1,
    head_sha: run.head_sha,
    status: "completed",
    conclusion: "failure",
    name: final
      ? "Sounding Line / Focused verification"
      : "Sounding Line / Experience preparation (no mainline decision)",
    started_at: start,
    completed_at: end,
    steps: [
      ...names.map((name, i) => step(name, i + 1)),
      {
        ...step("Checkout exact ordinary ancestry and installed reader closure", names.length + 1),
        conclusion: "failure",
      },
    ],
  };
  const values = structuredClone({
    ...sources,
    "git/ref/heads/main": { object: { sha: current } },
    "actions/runs/4444/attempts/1": run,
    "actions/runs/4444/attempts/1/jobs?per_page=100": { total_count: 1, jobs: [job] },
    "actions/workflows/sounding-line-ordinary.yml": { id: 51, path: run.path, state: "active" },
    [`compare/${base}...${current}?per_page=1`]: {
      base_commit: { sha: base },
      merge_base_commit: { sha: base },
      status: "ahead",
      behind_by: 0,
    },
  });
  const member = final
    ? "Sounding Line _ Focused verification/4_Observe immutable original evidence context.txt"
    : "Sounding Line _ Experience preparation (no mainline decision)/3_Observe immutable original evidence context.txt";
  const f = { context, values, member, prefix: "2026-11-01T16:00:02.1234567Z ", duplicate: false, calls: [] };
  const request = async (endpoint) => {
    f.calls.push(endpoint);
    if (f.override) {
      const result = await f.override(endpoint);
      if (result !== undefined) return result;
    }
    if (endpoint.endsWith("/logs")) {
      const line = `${f.prefix}SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 ${JSON.stringify(f.context)}\n`;
      return zip(f.member, line + (f.duplicate ? line : ""));
    }
    assert(Object.hasOwn(values, endpoint), `Unexpected provider request: ${endpoint}`);
    return Buffer.from(JSON.stringify(values[endpoint]));
  };
  f.input = {
    root,
    acceptedBaseSha: current,
    runId: 4444,
    attempt: 1,
    prNumber: 900,
    jobKey,
    expectedOriginalSource: { baseSha: base, candidateSha: candidate },
  };
  globalThis.__syntheticOriginalContextProvider = request;
  return f;
}
const runKey = "actions/runs/4444/attempts/1",
  jobsKey = "actions/runs/4444/attempts/1/jobs?per_page=100";
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
test("callers cannot supply an authentication transport", async () => {
  const f = fixture();
  await assert.rejects(
    api.authenticateNativeOriginalContext({ ...f.input, request: () => Buffer.from("{}") }),
    /TRANSPORT_OVERRIDE/u,
  );
  assert.equal(f.calls.length, 0);
});
test("original provider log survives later checkout failure and moving PR associations; proof is opaque", async () => {
  for (const [job, event] of [
    ["experience-preparation", "workflow_dispatch"],
    ["final-check", "pull_request_target"],
    ["final-check", "workflow_dispatch"],
  ]) {
    const f = fixture(job, event);
    f.values[runKey].pull_requests = [{ head: { sha: "e".repeat(40) } }];
    const proof = await api.authenticateNativeOriginalContext(f.input);
    const observation = api.inspectNativeOriginalContext(proof, f.input);
    assert.equal(observation.context.candidateSha, candidate);
    assert.equal(observation.context.baseSha, base);
    assert.equal(observation.qualification, false);
    assert.equal(observation.reuseAuthorized, false);
    assert.equal(api.inspectNativeOriginalContext({ ...proof }, f.input), null);
    assert.equal(api.inspectNativeOriginalContext(proof, { ...f.input, attempt: 2 }), null);
    observation.context.baseSha = "e".repeat(40);
    assert.equal(api.inspectNativeOriginalContext(proof, f.input).context.baseSha, base);
    const originals = api.retainedNativeOriginalContextEvidence(proof, f.input);
    assert.equal(originals.responses.length, f.calls.length);
    assert.equal(originals.qualification, false);
    const first = Buffer.from(originals.responses[0].bytes);
    originals.responses[0].bytes.fill(0);
    assert(api.retainedNativeOriginalContextEvidence(proof, f.input).responses[0].bytes.equals(first));
    assert.equal(api.retainedNativeOriginalContextEvidence({ ...proof }, f.input), null);
    assert(f.calls.length < 20);
  }
});
for (const [name, change] of [
  [
    "held owner work",
    (f) => {
      f.input.prNumber = 805;
    },
  ],
  [
    "repository",
    (f) => {
      f.values[runKey].repository.id++;
    },
  ],
  [
    "owner",
    (f) => {
      f.values[runKey].actor.id++;
    },
  ],
  [
    "trigger owner",
    (f) => {
      f.values[runKey].triggering_actor.login = "someone";
    },
  ],
  [
    "workflow",
    (f) => {
      f.values["actions/workflows/sounding-line-ordinary.yml"].state = "disabled_manually";
    },
  ],
  [
    "incomplete jobs",
    (f) => {
      f.values[jobsKey].total_count++;
    },
  ],
  [
    "ambiguous jobs",
    (f) => {
      f.values[jobsKey].jobs.push(structuredClone(f.values[jobsKey].jobs[0]));
      f.values[jobsKey].total_count++;
    },
  ],
  [
    "failed authority",
    (f) => {
      f.values[jobsKey].jobs[0].steps[1].conclusion = "failure";
    },
  ],
  [
    "duplicate ordinal",
    (f) => {
      f.values[jobsKey].jobs[0].steps[1].number = 1;
    },
  ],
  [
    "context after checkout",
    (f) => {
      f.values[jobsKey].jobs[0].steps.at(-1).number = 0;
    },
  ],
  [
    "candidate",
    (f) => {
      f.context.candidateSha = "e".repeat(40);
    },
  ],
  [
    "base",
    (f) => {
      f.context.baseSha = current;
    },
  ],
  [
    "mode",
    (f) => {
      f.context.mode = "ordinary";
    },
  ],
  [
    "attempt",
    (f) => {
      f.context.attempt++;
    },
  ],
  [
    "PR",
    (f) => {
      f.context.prNumber++;
    },
  ],
  [
    "qualification",
    (f) => {
      f.context.qualification = true;
    },
  ],
  [
    "unknown context field",
    (f) => {
      f.context.extra = true;
    },
  ],
  [
    "duplicate marker",
    (f) => {
      f.duplicate = true;
    },
  ],
  [
    "timestamp",
    (f) => {
      f.prefix = "2026-11-01T17:00:02.1234567Z ";
    },
  ],
  [
    "wrong archive member",
    (f) => {
      f.member = "other.txt";
    },
  ],
  [
    "truncated tree",
    (f) => {
      const k = Object.keys(f.values).find((k) => k.startsWith("git/trees/"));
      f.values[k].truncated = true;
    },
  ],
  [
    "producer symlink",
    (f) => {
      const t = f.values[`git/trees/${sources[`git/commits/${base}`].tree.sha}?recursive=1`];
      t.tree.find((e) => e.path === files[2]).mode = "120000";
    },
  ],
  [
    "reader blob corruption",
    (f) => {
      const t = f.values[`git/trees/${sources[`git/commits/${current}`].tree.sha}?recursive=1`];
      f.values[`git/blobs/${t.tree.find((e) => e.path === files[0]).sha}`].content =
        Buffer.from("corrupt").toString("base64");
    },
  ],
  [
    "nonancestor",
    (f) => {
      f.values[`compare/${base}...${current}?per_page=1`].behind_by = 1;
    },
  ],
  [
    "main moves",
    (f) => {
      f.override = (endpoint) =>
        endpoint === "git/ref/heads/main" && f.calls.filter((x) => x === endpoint).length === 2
          ? Buffer.from(JSON.stringify({ object: { sha: base } }))
          : undefined;
    },
  ],
])
  test(`rejects ${name}`, async () => {
    const f = fixture();
    change(f);
    await assert.rejects(
      api.authenticateNativeOriginalContext(f.input),
      /SOUNDING_LINE_(?:NATIVE_ORIGINAL|PROVIDER_RUN_LOG_ARCHIVE)/u,
    );
  });
test("bounded asynchronous provider wait and frozen input binding", async () => {
  const stalled = fixture();
  stalled.input.budgetMs = 20;
  globalThis.__syntheticOriginalContextProvider = () => new Promise(() => {});
  await assert.rejects(api.authenticateNativeOriginalContext(stalled.input), /DEADLINE/u);
  const f = fixture();
  f.override = () => {
    f.input.expectedOriginalSource.candidateSha = "e".repeat(40);
  };
  const proof = await api.authenticateNativeOriginalContext(f.input);
  assert.equal(api.inspectNativeOriginalContext(proof, f.input), null);
  assert(
    api.inspectNativeOriginalContext(proof, {
      ...f.input,
      expectedOriginalSource: { baseSha: base, candidateSha: candidate },
    }),
  );
});
test("a failed provider join retains exact original responses without an authenticated proof", async () => {
  const f = fixture();
  f.context.candidateSha = "e".repeat(40);
  let denied;
  try {
    await api.authenticateNativeOriginalContext(f.input);
  } catch (error) {
    denied = error;
  }
  assert(denied);
  assert.equal(api.inspectNativeOriginalContext(denied, f.input), null);
  const retained = api.retainedNativeOriginalContextEvidence(denied, f.input);
  assert.equal(retained.classification, "FAILED_ORIGINAL_PROVIDER_OBSERVATION_RETENTION");
  assert.equal(retained.responses.length, f.calls.length);
  assert(retained.responses.at(-1).endpoint.endsWith("/logs"));
  assert.equal(api.retainedNativeOriginalContextEvidence({ ...denied }, f.input), null);
});
test("dirty installed reader is refused before provider access", async () => {
  const file = path.join(root, files[0]),
    original = fs.readFileSync(file),
    f = fixture();
  try {
    fs.appendFileSync(file, "\n// drift\n");
    await assert.rejects(api.authenticateNativeOriginalContext(f.input), /UNAVAILABLE/u);
    assert.equal(f.calls.length, 0);
  } finally {
    fs.writeFileSync(file, original);
  }
});

function registryFixture() {
  const f = fixture();
  const job = f.values[jobsKey].jobs[0];
  job.steps.at(-1).conclusion = "success";
  job.steps.push(
    step("Prepare through protected-base authority", 5),
    step("Seal completed-context registry after parent cleanup", 6),
    step("Retain encrypted v2 context registry", 7),
  );
  f.registryArchive = zip("registry-v2.encrypted", "Inert synthetic encrypted registry envelope");
  f.artifact = {
    id: 88,
    name: "sounding-line-context-registry-v2-4444-1",
    expired: false,
    size_in_bytes: f.registryArchive.length,
    digest: `sha256:${createHash("sha256").update(f.registryArchive).digest("hex")}`,
    workflow_run: {
      id: 4444,
      repository_id: repository.id,
      head_repository_id: repository.id,
      head_sha: base,
      head_branch: "main",
    },
  };
  f.override = (endpoint) =>
    endpoint === "actions/artifacts/88"
      ? Buffer.from(JSON.stringify(f.artifact))
      : endpoint === "actions/artifacts/88/zip"
        ? f.registryArchive
        : undefined;
  f.registryInput = { input: f.input, artifactId: 88, sourceBindingsDigest: "f".repeat(64) };
  return f;
}
test("registry transport requires the opaque original event, installed source closure and exact provider archive", async () => {
  const f = registryFixture();
  const originalProof = await api.authenticateNativeOriginalContext(f.input);
  const proof = await api.authenticateNativeRegistryArchive({ ...f.registryInput, originalProof });
  const value = api.inspectNativeRegistryArchive(proof, f.input);
  assert.equal(proof.kind, "PROVIDER_BOUND_REGISTRY_ARCHIVE_NOT_VALIDATED_CONTENT");
  assert.equal(value.envelope.toString(), "Inert synthetic encrypted registry envelope");
  assert.equal(value.binding.candidateSha, candidate);
  assert.equal(value.reuseAuthorized, false);
  assert.equal(api.inspectNativeOriginalContext(proof, f.input), null);
  assert.equal(api.inspectNativeRegistryArchive({ ...proof }, f.input), null);
  assert.equal(api.inspectNativeRegistryArchive(proof, { ...f.input, runId: 5555 }), null);
  value.envelope.fill(0);
  assert.equal(
    api.inspectNativeRegistryArchive(proof, f.input).envelope.toString(),
    "Inert synthetic encrypted registry envelope",
  );
  assert.equal(api.retainedNativeOriginalContextEvidence(proof, f.input).responses.length, 4);
});

test("provider transport and owner decryption preserve original IDs and review ordinals without granting reuse", async () => {
  const f = registryFixture();
  const { sealArtifactRegistryRetention } = await import(
    pathToFileURL(path.join(root, "scripts/sounding-line/artifact-registry-retention.mjs")).href
  );
  const { sealArtifactManifest, validateArtifactManifest } = await import(
    pathToFileURL(path.join(root, "scripts/sounding-line/artifact-evidence-registry.mjs")).href
  );
  const original = artifactRegistryFixture({ baseSha: base, candidateSha: candidate, runId: 4444 });
  original.reviewReceipts.push({
    id: "original-independent-review",
    contractId: "contract",
    originalOrdinal: 3,
    originalCandidateSha: candidate,
    originalPacketDigest: "e".repeat(64),
    artifactIds: original.artifacts.map((a) => a.id),
    priorFindingIds: ["original-failed-finding"],
  });
  const manifest = sealArtifactManifest(original),
    spentReviewOrdinals = { contract: 3 };
  validateArtifactManifest(manifest, { spentReviewOrdinals });
  const binding = {
    repository: repository.full_name,
    prNumber: 900,
    runId: 4444,
    attempt: 1,
    baseSha: base,
    candidateSha: candidate,
    jobKey: "experience-preparation",
    sourceBindingsDigest: "f".repeat(64),
  };
  const encrypted = sealArtifactRegistryRetention({ manifest, binding, validation: { spentReviewOrdinals } });
  f.registryArchive = zip("registry-v2.encrypted", encrypted.toString("utf8"));
  f.artifact.size_in_bytes = f.registryArchive.length;
  f.artifact.digest = `sha256:${createHash("sha256").update(f.registryArchive).digest("hex")}`;
  const originalProof = await api.authenticateNativeOriginalContext(f.input);
  const registryProof = await api.authenticateNativeRegistryArchive({ ...f.registryInput, originalProof });
  const args = {
    registryProof,
    input: f.input,
    privateKey: fixturePrivateKey,
    expectedCoverage: manifest.requiredCoverage,
    spentReviewOrdinals,
  };
  const proof = await api.openNativeRegistryRetention(args);
  assert.deepEqual(api.inspectNativeRegistryRetention(proof, f.input).manifest, manifest);
  assert.equal(proof.qualification, false);
  assert.equal(proof.reuseAuthorized, false);
  assert.equal(api.inspectNativeRegistryRetention({ ...proof }, f.input), null);
  assert.equal(api.inspectNativeRegistryArchive(proof, f.input), null);
  const copy = api.inspectNativeRegistryRetention(proof, f.input);
  copy.manifest.artifacts[0].id = "changed";
  assert.equal(api.inspectNativeRegistryRetention(proof, f.input).manifest.artifacts[0].id, manifest.artifacts[0].id);
  await assert.rejects(
    api.openNativeRegistryRetention({ ...args, registryProof: { ...registryProof } }),
    /PROOF_REQUIRED/u,
  );
  await assert.rejects(
    api.openNativeRegistryRetention({
      ...args,
      privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey,
    }),
    /DECRYPTION_FAILED/u,
  );
  await assert.rejects(api.openNativeRegistryRetention({ ...args, expectedCoverage: [] }), /EXPECTED_COVERAGE/u);
  await assert.rejects(
    api.openNativeRegistryRetention({ ...args, expectedCoverage: manifest.requiredCoverage.slice(1) }),
    /EXPECTED_COVERAGE_MISMATCH/u,
  );
  await assert.rejects(
    api.openNativeRegistryRetention({ ...args, spentReviewOrdinals: { contract: 4 } }),
    /UNAUTHORIZED_REVIEW_ORDINAL/u,
  );
});
for (const [name, change] of [
  [
    "copied original proof",
    (f, args) => {
      args.originalProof = { ...args.originalProof };
    },
  ],
  [
    "missing seal",
    (f) => {
      f.values[jobsKey].jobs[0].steps.splice(5, 1);
    },
  ],
  [
    "failed upload",
    (f) => {
      f.values[jobsKey].jobs[0].steps.at(-1).conclusion = "failure";
    },
  ],
  [
    "artifact owner run",
    (f) => {
      f.artifact.workflow_run.id++;
    },
  ],
  [
    "artifact digest",
    (f) => {
      f.artifact.digest = `sha256:${"0".repeat(64)}`;
    },
  ],
  [
    "artifact size",
    (f) => {
      f.artifact.size_in_bytes++;
    },
  ],
  [
    "expired artifact",
    (f) => {
      f.artifact.expired = true;
    },
  ],
  [
    "artifact alias",
    (f) => {
      f.artifact.name = "other";
    },
  ],
  [
    "unrelated controller source drift",
    (f) => {
      const tree = f.values[`git/trees/${sources[`git/commits/${base}`].tree.sha}?recursive=1`];
      tree.tree.find((e) => e.path.endsWith("synthetic-controller.mjs")).sha = "e".repeat(40);
    },
  ],
])
  test(`registry transport rejects ${name}`, async () => {
    const f = registryFixture();
    // Metadata mutations precede original authentication so private observations
    // are immutable snapshots, never aliases of the mock response objects.
    const args = { ...f.registryInput };
    if (name !== "copied original proof") change(f, args);
    args.originalProof = await api.authenticateNativeOriginalContext(f.input);
    if (name === "copied original proof") change(f, args);
    let denied;
    try {
      await api.authenticateNativeRegistryArchive(args);
    } catch (error) {
      denied = error;
    }
    assert(denied, name);
    assert.equal(api.inspectNativeRegistryArchive(denied, f.input), null);
    if (!["copied original proof", "unrelated controller source drift"].includes(name)) {
      const retained = api.retainedNativeOriginalContextEvidence(denied, f.input);
      assert(retained.responses.length >= 2);
      assert.equal(retained.qualification, false);
    }
  });
