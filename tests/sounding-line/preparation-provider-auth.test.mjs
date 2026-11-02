import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  PREPARATION_PUBLISHER_READERS,
  PREPARATION_SHADOW_WORKFLOW,
  preparationPublisherContext,
} from "../../scripts/sounding-line/preparation-publisher-shadow.mjs";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { createPreparationCapsuleShadow } from "../../scripts/sounding-line/preparation-capsule-shadow.mjs";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-provider-auth-"));
const modulePath = "scripts/sounding-line/preparation-provider-auth.mjs";
const git = (...args) =>
  execFileSync("git", ["-c", "gc.auto=0", "-c", "core.autocrlf=false", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
for (const file of [
  ...PREPARATION_PUBLISHER_READERS,
  modulePath,
  ...[
    "bounded-media-shadow.mjs",
    "owned-process.mjs",
    "owned-process-windows.ps1",
    "owned-process-linux.py",
    "preparation-archive-shadow.mjs",
    "attestation-archive-shadow.mjs",
  ].map((name) => `scripts/sounding-line/${name}`),
]) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(new URL(`../../${file}`, import.meta.url), target);
}
// Instrument only the separately committed synthetic installed source. The
// production module accepts no request callback or caller transport override.
const filename = path.join(root, modulePath),
  production = fs.readFileSync(filename, "utf8");
const transport =
  /function providerRequest\(endpoint, \{ maximumBytes, timeoutMs \}\) \{[\s\S]*?\n\}\nfunction originalMarker/u;
assert(transport.test(production));
fs.writeFileSync(
  filename,
  production
    .replace(
      "import { spawnOwnedProcess, processExit, stopOwnedProcess }",
      "import { spawnOwnedProcess as realSpawnOwnedProcess, processExit, stopOwnedProcess }",
    )
    .replace(
      transport,
      "function providerRequest(endpoint, options) { return globalThis.__syntheticPreparationProvider(endpoint, options); }\nfunction spawnOwnedProcess(command, args, options) { return globalThis.__syntheticPreparationDownload(realSpawnOwnedProcess, command, args, options); }\nfunction originalMarker",
    ),
);
git("init", "-q");
git("config", "user.name", "Synthetic preparation proof");
git("config", "user.email", "fixture@example.invalid");
git("add", ".");
git("commit", "-qm", "Synthetic installed preparation producer and reader");
const source = git("rev-parse", "HEAD"),
  tree = git("rev-parse", "HEAD^{tree}"),
  runId = 123;
const readerDigest = digest(
  PREPARATION_PUBLISHER_READERS.map((file) => ({
    path: file,
    mode: git("ls-tree", source, "--", file).split(" ")[0],
    sha256: createHash("sha256")
      .update(
        execFileSync("git", ["show", `${source}:${file}`], {
          cwd: root,
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
        }),
      )
      .digest("hex"),
  })),
);
const api = await import(pathToFileURL(filename).href);
const start = "2026-11-02T00:00:00Z",
  end = "2026-11-02T00:01:00Z",
  verifierEnd = "2026-11-02T00:02:00Z";
const archiveBytes = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 256));
const contexts = ["publisher", "independent-verifier"].map((jobKey, i) =>
  preparationPublisherContext({
    repository: "Kgray44/treasurehuntSoT",
    repositoryId: 1303074266,
    actor: "Kgray44",
    actorId: 64373011,
    ref: "refs/heads/main",
    event: "workflow_dispatch",
    workflowRef: `Kgray44/treasurehuntSoT/${PREPARATION_SHADOW_WORKFLOW}@refs/heads/main`,
    workflowSha: source,
    sourceCommit: source,
    sourceTree: tree,
    readerDigest,
    runId,
    attempt: 1,
    jobKey,
    nonce: String(i + 1).repeat(64),
  }),
);
const capsule = {
  sourceCommit: source,
  runId,
  attempt: 1,
  inputFingerprint: "d".repeat(64),
  manifestSha256: "e".repeat(64),
  qualification: false,
  reuseAuthorized: false,
};
const equivalence = {
  kind: "PREPARATION_INDEPENDENT_EQUIVALENCE_SHADOW",
  version: 1,
  originalProducer: contexts[0],
  independentVerifier: contexts[1],
  inputFingerprint: capsule.inputFingerprint,
  originalManifestSha256: capsule.manifestSha256,
  inventoryDigest: "f".repeat(64),
  equivalent: true,
  certificate: "NOT_ISSUED",
  qualification: false,
  reuseAuthorized: false,
};
const names = ["Sounding Line / Preparation producer shadow", "Sounding Line / Preparation independent fresh verifier"];
function fixtures() {
  const stepNames = [
    ["Observe original preparation producer context", "Measure and seal private preparation capsule shadow"],
    ["Observe original independent verifier context", "Independently compare complete fresh and transferred outputs"],
  ];
  const jobs = names.map((name, i) => ({
    id: i + 10,
    name,
    run_id: runId,
    run_attempt: 1,
    head_sha: source,
    status: "completed",
    conclusion: "success",
    runner_id: i + 100,
    labels: ["ubuntu-latest"],
    started_at: i ? end : start,
    completed_at: i ? verifierEnd : end,
    steps: stepNames[i].map((step, j) => ({
      name: step,
      number: j + 1,
      status: "completed",
      conclusion: "success",
      started_at: i ? end : start,
      completed_at: i ? verifierEnd : end,
    })),
  }));
  const artifact = {
    id: 55,
    name: `sounding-line-preparation-capsule-${runId}-1`,
    expired: false,
    workflow_run: { id: runId, head_sha: source, head_branch: "main" },
    size_in_bytes: archiveBytes.length,
    digest: `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`,
    created_at: start,
    expires_at: "2099-01-01T00:00:00Z",
  };
  const marker = (at, name, body) => `${at} ${name} ${JSON.stringify(body)}\n`;
  return {
    "git/ref/heads/main": { ref: "refs/heads/main", object: { type: "commit", sha: source } },
    [`actions/runs/${runId}/attempts/1`]: {
      id: runId,
      run_attempt: 1,
      head_sha: source,
      head_branch: "main",
      event: "workflow_dispatch",
      path: PREPARATION_SHADOW_WORKFLOW,
      status: "completed",
      conclusion: "success",
      workflow_id: 77,
      repository: { id: 1303074266, full_name: "Kgray44/treasurehuntSoT", owner: { id: 64373011 } },
      head_repository: { id: 1303074266, full_name: "Kgray44/treasurehuntSoT" },
      actor: { id: 64373011, login: "Kgray44" },
      triggering_actor: { id: 64373011, login: "Kgray44" },
      referenced_workflows: [],
    },
    "actions/workflows/77": { id: 77, path: PREPARATION_SHADOW_WORKFLOW, state: "active" },
    [`git/commits/${source}`]: { sha: source, tree: { sha: tree } },
    [`actions/runs/${runId}/attempts/1/jobs?per_page=100`]: { total_count: 2, jobs },
    "actions/jobs/10/logs": Buffer.from(
      marker("2026-11-02T00:00:01.0000000Z", "SOUNDING_LINE_PREPARATION_CONTEXT_V1", contexts[0]) +
        marker("2026-11-02T00:00:02.0000000Z", "SOUNDING_LINE_PREPARATION_CAPSULE_V1", capsule),
    ),
    "actions/jobs/11/logs": Buffer.from(
      marker("2026-11-02T00:01:01.0000000Z", "SOUNDING_LINE_PREPARATION_CONTEXT_V1", contexts[1]) +
        marker("2026-11-02T00:01:02.0000000Z", "SOUNDING_LINE_PREPARATION_EQUIVALENCE_V1", equivalence),
    ),
    [`actions/runs/${runId}/artifacts?per_page=100`]: { total_count: 1, artifacts: [{ ...artifact }] },
    "actions/artifacts/55": artifact,
  };
}
let current,
  requests,
  transportFailure,
  mainReads,
  downloadFailure,
  downloadCorrupt,
  advanceDuringDownload,
  activeDownloadBytes;
globalThis.__syntheticPreparationProvider = (endpoint, { maximumBytes, timeoutMs }) => {
  requests.push(endpoint);
  assert(maximumBytes <= 2 * 1024 * 1024);
  assert(timeoutMs > 0 && timeoutMs <= 15000);
  if (transportFailure && endpoint === "actions/jobs/11/logs") throw transportFailure;
  let value = current[endpoint];
  if (
    endpoint === "git/ref/heads/main" &&
    ((++mainReads === 2 && current.advance) || mainReads === current.advanceOnRead)
  )
    value = { ...value, object: { type: "commit", sha: "0".repeat(40) } };
  assert.notEqual(value, undefined, endpoint);
  return Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(JSON.stringify(value));
};
function observe(change = () => {}) {
  current = fixtures();
  current[`actions/runs/${runId}`] = structuredClone(current[`actions/runs/${runId}/attempts/1`]);
  requests = [];
  transportFailure = null;
  mainReads = 0;
  downloadFailure = 0;
  downloadCorrupt = false;
  advanceDuringDownload = false;
  activeDownloadBytes = archiveBytes;
  change(current);
  return api.authenticatePreparationProvider({ root, acceptedBaseSha: source, runId });
}
test.after(() => {
  delete globalThis.__syntheticPreparationProvider;
  delete globalThis.__syntheticPreparationDownload;
  assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(root, { recursive: true });
});
globalThis.__syntheticPreparationDownload = (spawn, command, args, options) => {
  assert.equal(command, "gh");
  assert.deepEqual(args, ["api", "--hostname", "github.com", `repos/Kgray44/treasurehuntSoT/actions/artifacts/55/zip`]);
  if (advanceDuringDownload) current.advanceOnRead = mainReads + 1;
  const payload = Buffer.from(activeDownloadBytes);
  if (downloadCorrupt) payload[0] ^= 1;
  return spawn(
    process.execPath,
    [
      "-e",
      `process.stdout.write(Buffer.from('${payload.toString("base64")}','base64'),()=>{process.exitCode=${downloadFailure}})`,
    ],
    options,
  );
};
test("fixed-provider originals bind both independent jobs, exact installed source and artifact without reuse authority", () => {
  const proof = observe();
  assert.equal(proof.kind, "PROVIDER_BOUND_PREPARATION_SHADOW_NOT_REUSE_AUTHORITY");
  assert.equal(proof.reuseAuthorized, false);
  assert.equal(proof.certificate, "NOT_ISSUED");
  assert(api.inspectPreparationProvider(proof, { root, acceptedBaseSha: source, runId }));
  assert.equal(
    api.inspectPreparationProvider(JSON.parse(JSON.stringify(proof)), { root, acceptedBaseSha: source, runId }),
    null,
  );
  assert.equal(api.inspectPreparationProvider(proof, { root, acceptedBaseSha: "0".repeat(40), runId }), null);
  const evidence = api.retainedPreparationProviderEvidence(proof);
  assert.equal(evidence.originals.length, 10);
  assert.equal(evidence.originals[0].endpoint, "git/ref/heads/main");
  evidence.originals[0].bytes.fill(0);
  assert.notEqual(api.retainedPreparationProviderEvidence(proof).originals[0].bytes[0], 0);
});
test("provider, owner, original attempt, job isolation, source, log and artifact substitutions fail closed", () => {
  const runKey = `actions/runs/${runId}/attempts/1`,
    jobsKey = `actions/runs/${runId}/attempts/1/jobs?per_page=100`;
  const changes = [
    (d) => {
      d[runKey].run_attempt = 2;
    },
    (d) => {
      d[runKey].actor.id = 1;
    },
    (d) => {
      d[runKey].triggering_actor.id = 1;
    },
    (d) => {
      d[runKey].repository.owner.id = 1;
    },
    (d) => {
      d[runKey].event = "pull_request_target";
    },
    (d) => {
      d[runKey].head_sha = "0".repeat(40);
    },
    (d) => {
      d[`git/commits/${source}`].tree.sha = "0".repeat(40);
    },
    (d) => {
      d[jobsKey].total_count = 3;
    },
    (d) => {
      d[jobsKey].jobs[1].runner_id = d[jobsKey].jobs[0].runner_id;
    },
    (d) => {
      d[jobsKey].jobs[1].labels.push("self-hosted");
    },
    (d) => {
      d[jobsKey].jobs[1].steps[0].conclusion = "failure";
    },
    (d) => {
      d["actions/jobs/10/logs"] = Buffer.concat([d["actions/jobs/10/logs"], d["actions/jobs/10/logs"]]);
    },
    (d) => {
      d["actions/jobs/10/logs"] = Buffer.from(
        d["actions/jobs/10/logs"].toString().replaceAll(readerDigest, "0".repeat(64)),
      );
    },
    (d) => {
      d["actions/jobs/11/logs"] = Buffer.from(
        d["actions/jobs/11/logs"].toString().replaceAll("2026-11-02T00:01:", "2026-11-02T00:09:"),
      );
    },
    (d) => {
      d["actions/artifacts/55"].expired = true;
    },
    (d) => {
      d["actions/artifacts/55"].digest = `sha256:${"0".repeat(64)}`;
    },
    (d) => {
      d["actions/artifacts/55"].workflow_run.head_sha = "0".repeat(40);
    },
    (d) => {
      d.advance = true;
    },
  ];
  for (const change of changes) {
    const proof = observe(change);
    assert.equal(proof.kind, "PREPARATION_PROVIDER_DENIED");
    assert.equal(api.inspectPreparationProvider(proof, { root, acceptedBaseSha: source, runId }), null);
    assert(api.retainedPreparationProviderEvidence(proof).originalError);
  }
});
test("failed original transport retains the exact error and all preceding provider bytes without retry", () => {
  const original = Error("native provider read interrupted");
  const proof = observe(() => {
    transportFailure = original;
  });
  const evidence = api.retainedPreparationProviderEvidence(proof);
  assert.equal(evidence.originalError, original);
  assert.equal(evidence.failures[0].originalError, original);
  assert.equal(requests.filter((endpoint) => endpoint === "actions/jobs/11/logs").length, 1);
  assert.equal(evidence.originals.length, 6);
});
test("authenticated ZIP transport uses actual owned binary pipes and denies drift, corruption and failed payload exit", async () => {
  for (const scenario of ["positive", "corrupt", "exit", "advance"]) {
    const proof = observe();
    assert.equal(proof.kind, "PROVIDER_BOUND_PREPARATION_SHADOW_NOT_REUSE_AUTHORITY");
    const directory = path.join(root, `download-${scenario}`);
    fs.mkdirSync(directory);
    downloadCorrupt = scenario === "corrupt";
    downloadFailure = scenario === "exit" ? 9 : 0;
    advanceDuringDownload = scenario === "advance";
    const handle = await api.retainAuthenticatedPreparationArchive({
      proof,
      root,
      acceptedBaseSha: source,
      runId,
      directory,
    });
    const evidence = api.retainedPreparationProviderEvidence(handle);
    assert.equal(evidence.cleanup.status, "PASS");
    if (scenario === "positive") {
      assert.equal(handle.kind, "PROVIDER_BOUND_PREPARATION_ZIP_NOT_VALIDATED_PAYLOAD");
      const value = api.inspectAuthenticatedPreparationArchive(handle, { root, acceptedBaseSha: source, runId });
      assert(value);
      assert.deepEqual(fs.readFileSync(value.filename), archiveBytes);
      assert.equal(value.reuseAuthorized, false);
      assert.equal(value.certificate, "NOT_ISSUED");
      assert.equal(
        api.inspectAuthenticatedPreparationArchive(JSON.parse(JSON.stringify(handle)), {
          root,
          acceptedBaseSha: source,
          runId,
        }),
        null,
      );
      fs.writeFileSync(value.filename, "corrupted after transport");
      assert.equal(api.inspectAuthenticatedPreparationArchive(handle, { root, acceptedBaseSha: source, runId }), null);
    } else {
      assert.equal(handle.kind, "PREPARATION_ARCHIVE_TRANSPORT_DENIED");
      assert(evidence.originalError);
      assert.equal(api.inspectAuthenticatedPreparationArchive(handle, { root, acceptedBaseSha: source, runId }), null);
      assert(evidence.transport.rawPath);
      assert(fs.existsSync(evidence.transport.rawPath));
      if (scenario === "corrupt") assert.equal(evidence.transport.status, "FAIL");
      if (scenario === "exit") assert.equal(evidence.result.code, 9);
      if (scenario === "advance") assert.match(evidence.originalError.message, /MAIN_ADVANCED/u);
    }
  }
});
test("provider provenance joins the complete actual capsule and rejects self-consistent publisher substitutions at use", async () => {
  for (const scenario of ["positive", "nonce", "input"]) {
    const client = path.join(root, `join-client-${scenario}`),
      parent = path.join(root, `join-capsules-${scenario}`),
      downloaded = path.join(root, `join-download-${scenario}`),
      restored = path.join(root, `join-restores-${scenario}`);
    for (const directory of [client, parent, downloaded, restored]) fs.mkdirSync(directory);
    fs.writeFileSync(path.join(client, "index.js"), "module.exports = { immutableFixture: true };\n");
    const original = createPreparationCapsuleShadow({ source: client, directory: parent, layer: "prisma-client" });
    assert.equal(original.status, "PASS");
    const publisher = {
      kind: "PREPARATION_SOURCE_CAPSULE_SHADOW",
      version: 1,
      context: { ...contexts[0] },
      identity: { inputFingerprint: capsule.inputFingerprint },
      capsule: {
        manifestSha256: original.manifestSha256,
        initialSha256: createHash("sha256")
          .update(fs.readFileSync(path.join(original.root, "initial.json")))
          .digest("hex"),
        inventoryDigest: original.inventoryDigest,
        byteLength: original.bytes,
        fileCount: original.files,
      },
      certificate: "NOT_ISSUED",
      qualification: false,
      reuseAuthorized: false,
    };
    if (scenario === "nonce") publisher.context.nonce = "7".repeat(64);
    if (scenario === "input") publisher.identity.inputFingerprint = "8".repeat(64);
    fs.writeFileSync(path.join(original.root, "publisher.json"), JSON.stringify(publisher));
    const filename = path.join(root, `join-original-${scenario}.zip`);
    execFileSync(
      "python",
      [
        "-c",
        "import os,sys,zipfile\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED) as z:\n for folder,dirs,files in os.walk(sys.argv[1]):\n  for name in sorted(files):\n   full=os.path.join(folder,name);z.write(full,os.path.relpath(full,sys.argv[1]).replace(os.sep,'/'))",
        original.root,
        filename,
      ],
      { windowsHide: true, timeout: 10000, maxBuffer: 65536 },
    );
    const zipBytes = fs.readFileSync(filename),
      archiveDigest = `sha256:${createHash("sha256").update(zipBytes).digest("hex")}`;
    const proof = observe((data) => {
      activeDownloadBytes = zipBytes;
      for (const artifact of [
        data["actions/artifacts/55"],
        data[`actions/runs/${runId}/artifacts?per_page=100`].artifacts[0],
      ]) {
        artifact.size_in_bytes = zipBytes.length;
        artifact.digest = archiveDigest;
      }
      data["actions/jobs/10/logs"] = Buffer.from(
        data["actions/jobs/10/logs"]
          .toString()
          .replace(JSON.stringify(capsule), JSON.stringify({ ...capsule, manifestSha256: original.manifestSha256 })),
      );
      data["actions/jobs/11/logs"] = Buffer.from(
        data["actions/jobs/11/logs"]
          .toString()
          .replace(
            JSON.stringify(equivalence),
            JSON.stringify({
              ...equivalence,
              originalManifestSha256: original.manifestSha256,
              inventoryDigest: original.inventoryDigest,
            }),
          ),
      );
    });
    assert.equal(proof.kind, "PROVIDER_BOUND_PREPARATION_SHADOW_NOT_REUSE_AUTHORITY");
    const binding = { root, acceptedBaseSha: source, runId },
      archive = await api.retainAuthenticatedPreparationArchive({ proof, ...binding, directory: downloaded });
    assert.equal(archive.kind, "PROVIDER_BOUND_PREPARATION_ZIP_NOT_VALIDATED_PAYLOAD");
    const handle = api.validateAuthenticatedPreparationCapsule({ archive, binding, directory: restored });
    if (scenario === "positive") {
      assert.equal(handle.kind, "PROVIDER_BOUND_VALIDATED_PRISMA_CAPSULE_SHADOW");
      const value = api.inspectAuthenticatedPreparationCapsule(handle, binding);
      assert(value);
      assert.equal(value.inventoryDigest, original.inventoryDigest);
      assert.equal(value.inputFingerprint, capsule.inputFingerprint);
      assert.equal(value.reuseAuthorized, false);
      assert.deepEqual(
        fs.readFileSync(path.join(value.payload, "index.js")),
        fs.readFileSync(path.join(client, "index.js")),
      );
      assert.equal(api.inspectAuthenticatedPreparationCapsule(JSON.parse(JSON.stringify(handle)), binding), null);
      const clone = api.validateAuthenticatedPreparationCapsule({
        archive: JSON.parse(JSON.stringify(archive)),
        binding,
        directory: restored,
      });
      assert.equal(clone.kind, "AUTHENTICATED_PREPARATION_CAPSULE_DENIED");
      current["git/ref/heads/main"].object.sha = "0".repeat(40);
      const advanced = api.validateAuthenticatedPreparationCapsule({ archive, binding, directory: restored });
      assert.equal(advanced.kind, "AUTHENTICATED_PREPARATION_CAPSULE_DENIED");
      assert.match(api.retainedPreparationProviderEvidence(advanced).originalError.message, /MAIN_ADVANCED/u);
      fs.writeFileSync(path.join(value.payload, "index.js"), "late payload change");
      assert.equal(api.inspectAuthenticatedPreparationCapsule(handle, binding), null);
    } else {
      assert.equal(handle.kind, "AUTHENTICATED_PREPARATION_CAPSULE_DENIED");
      const evidence = api.retainedPreparationProviderEvidence(handle);
      assert.match(evidence.originalError.message, /ORIGINAL_PRODUCER_JOIN/u);
      assert.equal(evidence.restore.status, "PASS"); // bytes alone never authorize the substituted identity
    }
  }
});
