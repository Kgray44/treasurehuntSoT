import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { createArtifactDependencyGraph } from "../../scripts/sounding-line/artifact-dependency-graph.mjs";
import { planSelectedSourceShadow } from "../../scripts/sounding-line/selected-source-shadow.mjs";
import {
  proposeNoncampaignCustodyShadow,
  parseCustodyShadowTree,
  observeNoncampaignCustodyShadow,
  inspectNoncampaignCustodyShadow,
} from "../../scripts/sounding-line/noncampaign-custody-shadow.mjs";
import {
  retainCustodyPilotFrame,
  readCustodyPilotSource,
  custodyShadowPreload,
  custodyPilotSourceFiles,
  validateCustodyPilotBaseline,
  validatePreparedCustodyBaseline,
  validateCustodyRunPull,
  CUSTODY_ORDINARY_WORKFLOW_SHA256,
} from "../../scripts/sounding-line/noncampaign-custody-pilot.mjs";
import { checkoutCommandOutput } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
import {
  certifiedNoncampaignCustodyReadSet,
  inspectCertifiedCustodyReadSet,
  normalizeCustodyCertificateSource,
  custodyCertificatePaths,
  custodySwitchAlternate,
  verifyCustodySwitchReader,
} from "../../scripts/sounding-line/noncampaign-custody-read-set.mjs";
import { createHash } from "node:crypto";
import { retainCustodyWorkerProof } from "../../scripts/sounding-line/custody-worker-proof-retention.mjs";
import { baselineToolchainObservations } from "../../scripts/sounding-line/noncampaign-custody-matched-pilot.mjs";
import {
  custodyShadowPreload as adapterPreload,
  readCustodyPilotSource as readProofSource,
  retainCustodyProofFrame,
} from "../../scripts/sounding-line/noncampaign-custody-proof-files.mjs";
import {
  custodyProofFilesystem,
  custodyWorkflowMetadataPin,
} from "../../scripts/sounding-line/noncampaign-custody-negative-probe.mjs";

const sha = (letter) => letter.repeat(40);
const entry = (path, letter, mode = "100644") => ({ path, blob: sha(letter), mode, type: "blob" });
const snapshot = (revision, entries) => ({ revision, entries, sourceTreeDigest: digest(entries) });
function setup() {
  const a = entry("src/a.ts", "a"),
    b = entry("src/b.ts", "b"),
    old = entry("src/deleted.ts", "c");
  const untouched = entry("public/archive.bin", "d"),
    pkg = entry("package.json", "e"),
    lock = entry("package-lock.json", "f");
  const config = entry(".gitattributes", "1"),
    reader = entry("scripts/reader.mjs", "2");
  const added = entry("src/added.ts", "3"),
    modified = entry("src/b.ts", "4", "100755");
  const base = snapshot(sha("5"), [a, b, old, untouched, pkg, lock, config, reader]);
  const candidate = snapshot(sha("6"), [a, modified, added, untouched, pkg, lock, config, reader]);
  const graph = (entries) =>
    createArtifactDependencyGraph([
      ...entries.map((item) => ({
        id: `file:${item.path}`,
        type: "SOURCE",
        digest: digest({ blob: item.blob, mode: item.mode }),
        dependencies: [],
      })),
      { id: "context:one", type: "CONTEXT", digest: digest("context"), dependencies: ["file:src/a.ts"] },
    ]);
  const historicalEntry = entry("evidence/original.png", "7");
  const historical = [snapshot(sha("8"), [historicalEntry])];
  return {
    base,
    candidate,
    baseGraph: graph(base.entries),
    candidateGraph: graph(candidate.entries),
    roots: ["context:one"],
    readerPaths: ["scripts/reader.mjs"],
    historical,
    historicalPins: [{ revision: sha("8"), ...historicalEntry }],
    prNumber: 900,
  };
}

test("proposal retains dependency, changed/deleted/mode, reader, root-policy and original historical identities", () => {
  const input = setup(),
    result = planSelectedSourceShadow(input);
  assert.equal(result.profile, "SELECTED_SOURCE_SHADOW");
  const paths = result.readSet.map((entry) => `${entry.revision}:${entry.path}`);
  for (const file of [
    "src/a.ts",
    "src/b.ts",
    "package.json",
    "package-lock.json",
    ".gitattributes",
    "scripts/reader.mjs",
  ])
    for (const revision of [input.base.revision, input.candidate.revision])
      assert(paths.includes(`${revision}:${file}`));
  assert(paths.includes(`${input.base.revision}:src/deleted.ts`));
  assert(paths.includes(`${input.candidate.revision}:src/added.ts`));
  assert(paths.includes(`${sha("8")}:evidence/original.png`));
  assert(!result.readSet.some((entry) => entry.path === "public/archive.bin"));
  assert.deepEqual(result.changedPaths, ["src/added.ts", "src/b.ts", "src/deleted.ts"]);
  assert.equal(result.productionMaterialization, "FULL_SNAPSHOT");
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.reuseAuthorized, false);
  assert.equal(result.requiresCompleteCommitAndTreeMetadata, true);
  assert.equal(result.lateTransportAllowed, false);
  assert.equal(result.measurements.rawByteSavings, null);
});

test("deleted edges remain visible through independently computed base closure", () => {
  const input = setup();
  input.baseGraph = createArtifactDependencyGraph(
    input.baseGraph.nodes.map((node) =>
      node.id === "context:one" ? { ...node, dependencies: ["file:src/deleted.ts"] } : node,
    ),
  );
  const result = planSelectedSourceShadow(input);
  assert.equal(result.profile, "SELECTED_SOURCE_SHADOW");
  assert(
    result.readSet.some(
      (entry) =>
        entry.revision === input.base.revision &&
        entry.path === "src/deleted.ts" &&
        entry.reasons.includes("DEPENDENCY_CLOSURE"),
    ),
  );
});

test("unknown dependencies, graph tampering and graph/source divergence retain FULL fallback", () => {
  for (const mutate of [
    (input) => {
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) => (node.id === "file:src/a.ts" ? { ...node, unknown: true } : node)),
      );
    },
    (input) => {
      input.candidateGraph.graphDigest = "0".repeat(64);
    },
    (input) => {
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) =>
          node.id === "file:src/a.ts" ? { ...node, digest: "0".repeat(64) } : node,
        ),
      );
    },
  ]) {
    const input = setup();
    mutate(input);
    const result = planSelectedSourceShadow(input);
    assert.equal(result.profile, "FULL_SNAPSHOT");
    assert.equal(result.certificate, "NOT_ISSUED");
    assert.equal(result.reuseAuthorized, false);
  }
});

test("historical pin substitution, duplicate pins and missing reader closure never produce a partial proposal", () => {
  for (const mutate of [
    (input) => {
      input.historicalPins[0].blob = sha("9");
    },
    (input) => {
      input.historicalPins.push({ ...input.historicalPins[0] });
    },
    (input) => {
      input.historical = [];
    },
    (input) => {
      input.readerPaths.push("scripts/missing.mjs");
    },
    (input) => {
      input.candidate.entries[0].blob = sha("9");
    },
  ]) {
    const input = setup();
    mutate(input);
    const result = planSelectedSourceShadow(input);
    assert.equal(result.profile, "FULL_SNAPSHOT");
    assert.equal(Object.hasOwn(result, "readSet"), false);
  }
});

test("unsafe metadata, absent required toolchain and symlinked dependency roots remain full", () => {
  for (const change of ["traversal", "lock", "symlink"]) {
    const input = setup();
    if (change === "traversal") input.candidate.entries.push(entry("../outside", "9"));
    else if (change === "lock")
      input.candidate.entries = input.candidate.entries.filter((entry) => entry.path !== "package-lock.json");
    else {
      input.candidate.entries[0].mode = "120000";
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) =>
          node.id === "file:src/a.ts"
            ? { ...node, digest: digest({ blob: input.candidate.entries[0].blob, mode: "120000" }) }
            : node,
        ),
      );
    }
    input.candidate.sourceTreeDigest = digest(input.candidate.entries);
    assert.equal(planSelectedSourceShadow(input).profile, "FULL_SNAPSHOT");
  }
});

test("held owners and bounded inventory expansion cannot obtain a new selection mechanism", () => {
  for (const prNumber of [721, 776, 805])
    assert.throws(() => planSelectedSourceShadow({ ...setup(), prNumber }), /SHADOW_SCOPE/u);
  const input = setup();
  input.historical = Array(15).fill(input.historical[0]);
  assert.equal(planSelectedSourceShadow(input).profile, "FULL_SNAPSHOT");
});

const custodyPolicy = JSON.parse(
  fs.readFileSync(new URL("../../testing/noncampaign-custody-shadow-readers.json", import.meta.url), "utf8"),
);
function custodySetup() {
  const baseEntries = [
    ...custodyPolicy.readers.map(({ path, mode, blob }) => ({ path, mode, blob, type: "blob" })),
    ...custodyPolicy.metadata.map((row) => ({ ...row, type: "blob" })),
    entry(".gitattributes", "1"),
    entry("src/changed.ts", "2"),
    entry("src/deleted.ts", "3"),
    entry("public/immutable.bin", "4"),
  ];
  const candidateEntries = structuredClone(baseEntries).filter((row) => row.path !== "src/deleted.ts");
  candidateEntries.find((row) => row.path === "src/changed.ts").blob = sha("5");
  candidateEntries.find((row) => row.path === "src/changed.ts").mode = "100755";
  candidateEntries.push(entry("src/added.ts", "6"));
  return {
    baseSha: sha("a"),
    candidateSha: sha("b"),
    baseEntries,
    candidateEntries,
    purpose: "campaign-custody",
    prNumber: 837,
  };
}
const custodyTree = (rows) =>
  Buffer.from(rows.map((row) => `${row.mode} ${row.type} ${row.blob}\t${row.path}\0`).join(""));
test("custody proposal preserves complete path/change identities and cannot issue a source certificate", () => {
  const input = custodySetup(),
    result = proposeNoncampaignCustodyShadow(input);
  assert.equal(result.profile, "NONCAMPAIGN_CUSTODY_METADATA_SHADOW_V1");
  assert.deepEqual(result.changedPaths, ["src/added.ts", "src/changed.ts", "src/deleted.ts"]);
  assert.equal(result.omissions.find((row) => row.path === "public/immutable.bin").blob, sha("4"));
  assert.equal(result.applied, false);
  assert.equal(result.sourceCertificate, "NOT_ISSUED");
  assert.equal(result.readerObservationSource, custodyPolicy.readerObservationSource);
  assert(Object.isFrozen(result) && Object.isFrozen(result.omissions) && Object.isFrozen(result.omissions[0]));
  assert.deepEqual(parseCustodyShadowTree(custodyTree(input.baseEntries)), input.baseEntries);
});
test("custody reader, policy, owner, malformed metadata and finite scope failures retain FULL", () => {
  const cases = [
    ...[721, 776, 805, 820].map((number) => (v) => {
      v.prNumber = number;
    }),
    (v) => {
      v.purpose = "verification";
    },
    (v) => {
      v.baseSha += "\n";
    },
    (v) => {
      v.candidateEntries[0].blob += "\n";
    },
    (v) => {
      v.candidateEntries.push({ ...v.candidateEntries[0] });
    },
    (v) => {
      v.candidateEntries.push(entry("../escape", "7"));
    },
    (v) => {
      v.candidateEntries.push({ path: "submodule", mode: "160000", type: "commit", blob: sha("8") });
    },
    (v) => {
      v.candidateEntries.find((r) => r.path === ".gitattributes").blob = sha("9");
    },
    (v) => {
      v.candidateSha = v.baseSha;
      v.candidateEntries = structuredClone(v.baseEntries);
    },
    (v) => {
      for (let i = 0; i < 65; i++) {
        const row = entry(`extra-${i}/.gitattributes`, "1");
        v.baseEntries.push(row);
        v.candidateEntries.push({ ...row });
      }
    },
    ...custodyPolicy.readers.map((pin) => (v) => {
      v.baseEntries.find((r) => r.path === pin.path).blob = sha("0");
    }),
    ...custodyPolicy.metadata.flatMap((pin) => [
      (v) => {
        v.baseEntries.find((r) => r.path === pin.path).blob = sha("0");
      },
      (v) => {
        v.candidateEntries.find((r) => r.path === pin.path).mode = "120000";
      },
    ]),
  ];
  for (const mutate of cases) {
    const input = custodySetup();
    mutate(input);
    assert.equal(proposeNoncampaignCustodyShadow(input).profile, "FULL_SNAPSHOT");
  }
  for (const pin of custodyPolicy.readers) {
    const input = custodySetup();
    input.candidateEntries.find((row) => row.path === pin.path).blob = sha("0");
    assert.equal(proposeNoncampaignCustodyShadow(input).profile, "FULL_SNAPSHOT");
  }
  assert.equal(cases.length + custodyPolicy.readers.length, 153);
  assert.throws(() => parseCustodyShadowTree(Buffer.from("100644 blob bad\tfile\0")), /TREE_METADATA/u);
  assert.throws(() => parseCustodyShadowTree(Buffer.from([255, 0])), /encoded data/u);
});
function custodyProbeFixture(t, customize = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "custody-shadow-"));
  fs.mkdirSync(path.join(directory, ".git"));
  t.after(() => {
    assert(directory.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true });
  });
  const input = custodySetup(),
    calls = [];
  const hint = {
    status: "PASS",
    campaign: false,
    baseSha: input.baseSha,
    candidateSha: input.candidateSha,
    prNumber: input.prNumber,
    registryBlob: custodyPolicy.metadata[1].blob,
    transport: "DISABLED",
    authority: "READ_ONLY_FULL_ROUTE_HINT",
    qualification: false,
  };
  const options = {
    ...input,
    root: directory,
    git: process.execPath,
    command: async (args) => {
      calls.push(args);
      return args[0] === "ls-tree"
        ? custodyTree(args[2] === input.baseSha ? input.baseEntries : input.candidateEntries)
        : "";
    },
    readOnlyCommand: async () => JSON.stringify(hint),
  };
  customize(options, hint);
  return { options, hint, calls };
}
test("custody shadow materialization observation binds source/root and rejects serialized handles", async (t) => {
  const fixture = custodyProbeFixture(t),
    result = await observeNoncampaignCustodyShadow(fixture.options);
  assert.equal(result.applied, false);
  assert.equal(result.observed, true);
  // selectedCheckout consumes only applied=true. This callback-shaped result
  // therefore retains the complete ordinary checkout even after a good hint.
  assert.deepEqual(result.applied ? result.proposal.omissions : [], []);
  assert.equal(result.shadowOnly, true);
  const binding = {
    root: fixture.options.root,
    baseSha: fixture.options.baseSha,
    candidateSha: fixture.options.candidateSha,
  };
  const observed = inspectNoncampaignCustodyShadow(result.shadowObservation, binding);
  assert(observed && observed.proposal === result.proposal);
  assert.equal(observed.certificate, "NOT_ISSUED");
  assert.equal(inspectNoncampaignCustodyShadow(structuredClone(result.shadowObservation), binding), null);
  assert.equal(inspectNoncampaignCustodyShadow(result.shadowObservation, { ...binding, candidateSha: sha("f") }), null);
  assert.equal(
    inspectNoncampaignCustodyShadow(result.shadowObservation, { ...binding, root: path.dirname(binding.root) }),
    null,
  );
  fixture.hint.campaign = true;
  assert.equal(observed.custodyProbe.campaign, false);
  assert.equal(fixture.calls.filter((args) => args[0] === "fetch").length, 1);
});
test("campaign/uncertain hints retain FULL while cancellation and cleanup failures preserve original errors", async (t) => {
  for (const mutate of [
    (_o, h) => {
      h.campaign = true;
    },
    (_o, h) => {
      h.registryBlob = sha("f");
    },
    (o) => {
      o.readOnlyCommand = async () => "invalid-json";
    },
    (o) => {
      o.command = async () => Buffer.from("bad-tree");
    },
  ]) {
    const fixture = custodyProbeFixture(t, mutate);
    assert.equal((await observeNoncampaignCustodyShadow(fixture.options)).proposal.profile, "FULL_SNAPSHOT");
  }
  for (const marker of [
    "SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED",
    "SOUNDING_LINE_SELECTED_CHECKOUT_CLEANUP_FAILED",
  ]) {
    const original = Error(marker),
      fixture = custodyProbeFixture(t, (o) => {
        o.readOnlyCommand = async () => {
          throw original;
        };
      });
    await assert.rejects(observeNoncampaignCustodyShadow(fixture.options), (error) => error === original);
  }
});

function pilotDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "custody-pilot-"));
  t.after(() => {
    assert(directory.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true });
  });
  return directory;
}
test("pilot original frames are exclusive and source reads reject hard links and descriptor-time mutation", (t) => {
  const directory = pilotDirectory(t),
    filename = path.join(directory, "original.bin"),
    bytes = Buffer.from("original bytes\n");
  const receipt = retainCustodyPilotFrame(filename, bytes);
  assert.equal(receipt.completeReadback, true);
  assert.deepEqual(readCustodyPilotSource(filename), bytes);
  assert.throws(() => retainCustodyPilotFrame(filename, Buffer.from("replacement")), { code: "EEXIST" });
  assert.deepEqual(fs.readFileSync(filename), bytes);
  const link = path.join(directory, "hardlink");
  fs.linkSync(filename, link);
  assert.throws(() => readCustodyPilotSource(filename), /SOURCE_FILE/u);
  fs.unlinkSync(link);
  const read = fs.readSync;
  let changed = false;
  fs.readSync = (...args) => {
    const result = read(...args);
    if (!changed) {
      changed = true;
      fs.appendFileSync(filename, "changed after read");
    }
    return result;
  };
  try {
    assert.throws(() => readCustodyPilotSource(filename), /SOURCE_CHANGED/u);
  } finally {
    fs.readSync = read;
  }
});
test("pilot write and close failures retain both original exceptions and partial bytes", (t) => {
  const directory = pilotDirectory(t),
    filename = path.join(directory, "failed.bin");
  const open = fs.openSync,
    write = fs.writeSync,
    close = fs.closeSync,
    descriptors = new Set();
  const first = Error("original write failure"),
    second = Error("original close failure");
  fs.openSync = (...args) => {
    const fd = open(...args);
    if (args[0] === filename && args[1] & fs.constants.O_WRONLY) descriptors.add(fd);
    return fd;
  };
  fs.writeSync = (...args) => {
    if (descriptors.has(args[0])) throw first;
    return write(...args);
  };
  fs.closeSync = (fd) => {
    const fail = descriptors.delete(fd);
    close(fd);
    if (fail) throw second;
  };
  try {
    assert.throws(
      () => retainCustodyPilotFrame(filename, Buffer.from("never accepted")),
      (error) => error instanceof AggregateError && error.errors[0] === first && error.errors[1] === second,
    );
  } finally {
    fs.openSync = open;
    fs.writeSync = write;
    fs.closeSync = close;
  }
  assert(fs.existsSync(filename));
  assert.equal(fs.statSync(filename).size, 0);
});
test("native reserve preload denies Node network and non-Git processes while preserving permitted Git reads", (t) => {
  const directory = pilotDirectory(t),
    observation = path.join(directory, "network.json"),
    preload = path.join(directory, "deny.cjs");
  fs.writeFileSync(preload, custodyShadowPreload(observation, path.resolve("synthetic-git-path")));
  const empty = path.join(directory, "empty-config");
  fs.writeFileSync(empty, "");
  const code =
    "const cp=require('node:child_process');cp.execFileSync('git',['rev-parse','--is-inside-work-tree']);for(const run of[()=>fetch('https://example.invalid'),()=>require('node:net').connect(9,'127.0.0.1'),()=>require('node:https').get('https://example.invalid'),()=>cp.execFileSync(process.execPath,['-e','process.exit(99)'])]){let denied=false;try{run()}catch{denied=true}if(!denied)throw Error('UNEXPECTED_CAPABILITY')}";
  const result = spawnSync(process.execPath, ["--require", preload, "-e", code], {
    cwd: process.cwd(),
    encoding: null,
    timeout: 15000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      GIT_CONFIG_GLOBAL: empty,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr?.toString());
  const observed = JSON.parse(fs.readFileSync(observation));
  assert.equal(observed.fetchAttempts, 1);
  assert.equal(observed.networkAttempts, 2);
  assert.equal(observed.nonGitProcessAttempts, 1);
  assert(observed.gitCalls > 0);
});
function qualifiedPilotBaseline() {
  const source = sha("a"),
    parents = [sha("b"), sha("c")],
    runId = 12345;
  const run = {
    id: runId,
    run_attempt: 1,
    event: "pull_request_target",
    path: ".github/workflows/sounding-line-ordinary.yml",
    status: "completed",
    conclusion: "success",
    head_sha: parents[1],
    repository: { id: 1303074266, full_name: "Kgray44/treasurehuntSoT", owner: { id: 64373011 } },
    head_repository: { id: 1303074266, full_name: "Kgray44/treasurehuntSoT" },
    actor: { id: 64373011, login: "Kgray44" },
    triggering_actor: { id: 64373011, login: "Kgray44" },
  };
  const names = [
    "Sounding Line / Finite campaign custody",
    "Sounding Line / Focused verification",
    "Sounding Line / Experience preparation (no mainline decision)",
    "Sounding Line / Mainline Decision",
  ];
  const jobs = {
    total_count: 4,
    jobs: names.map((name, i) => ({
      id: i + 10,
      name,
      run_id: runId,
      run_attempt: 1,
      head_sha: parents[1],
      status: "completed",
      conclusion: i === 2 ? "skipped" : "success",
      runner_id: i + 100,
      labels: ["ubuntu-latest"],
    })),
  };
  const checks = {
    total_count: 1,
    check_runs: [
      {
        id: 13,
        name: names[3],
        head_sha: parents[1],
        app: { id: 15368 },
        status: "completed",
        conclusion: "success",
        details_url: `https://github.com/Kgray44/treasurehuntSoT/actions/runs/${runId}/job/13`,
      },
    ],
  };
  const artifacts = {
    total_count: 1,
    artifacts: [
      {
        id: 55,
        name: `sounding-line-checkout-campaign-custody-${runId}-1`,
        expired: false,
        expires_at: "2099-01-01T00:00:00Z",
        size_in_bytes: 4096,
        digest: "sha256:" + "1".repeat(64),
        workflow_run: { id: runId, head_sha: parents[1], repository_id: 1303074266, head_repository_id: 1303074266 },
      },
    ],
  };
  return { source, parents, run, jobs, checks, artifacts };
}
test("pilot baseline binds normal landed parents, exact first-attempt authority and immutable artifact without issuing a certificate", () => {
  const input = qualifiedPilotBaseline(),
    result = validateCustodyPilotBaseline(input);
  assert.equal(result.baseSha, input.parents[0]);
  assert.equal(result.candidateSha, input.parents[1]);
  assert.equal(result.installedSource, input.source);
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.qualification, false);
  const changes = [
    (v) => {
      v.parents.pop();
    },
    (v) => {
      v.run.run_attempt = 2;
    },
    (v) => {
      v.run.event = "workflow_dispatch";
    },
    (v) => {
      v.run.head_repository.id = 1;
    },
    (v) => {
      v.run.actor.id = 1;
    },
    (v) => {
      v.run.triggering_actor.login = "other";
    },
    (v) => {
      v.run.conclusion = "failure";
    },
    (v) => {
      v.jobs.total_count = 5;
    },
    (v) => {
      v.jobs.jobs[0].labels.push("self-hosted");
    },
    (v) => {
      v.jobs.jobs[0].head_sha = sha("f");
    },
    (v) => {
      v.jobs.jobs[0].conclusion = "failure";
    },
    (v) => {
      v.checks.check_runs[0].app.id = 1;
    },
    (v) => {
      v.checks.check_runs[0].details_url += "-other";
    },
    (v) => {
      v.checks.total_count = 2;
    },
    (v) => {
      v.artifacts.artifacts[0].expired = true;
    },
    (v) => {
      v.artifacts.artifacts[0].digest += "\n";
    },
    (v) => {
      v.artifacts.artifacts[0].workflow_run.head_sha = sha("f");
    },
    (v) => {
      v.artifacts.artifacts[0].size_in_bytes = 65537;
    },
  ];
  for (const change of changes) {
    const copy = structuredClone(input);
    change(copy);
    assert.throws(() => validateCustodyPilotBaseline(copy));
  }
});
test("custody pilot selected source includes every pinned reader and no whole source checkout", () => {
  const readers = custodyPilotSourceFiles();
  assert(readers.length <= 128 && new Set(readers).size === readers.length);
  for (const row of custodyPolicy.readers) assert(readers.includes(row.path));
  assert(readers.includes("scripts/sounding-line/experience-pr776-checkout-profile.mjs"));
  assert(readers.includes("scripts/sounding-line/owned-process-linux.py"));
  const workflow = fs.readFileSync(
    new URL("../../.github/workflows/sounding-line-custody-shadow.yml", import.meta.url),
    "utf8",
  );
  assert.deepEqual(
    [...workflow.matchAll(/^            \/(.+)$/gmu)].map((match) => match[1]),
    readers,
  );
  assert.doesNotMatch(workflow, /npm ci|Mainline Decision|:\s*write\b/u);
});

test("binary checkout output preserves malformed UTF8 and legacy text semantics independently", () => {
  const bytes = Buffer.from([255, 0, 10, 32]);
  const binary = checkoutCommandOutput(bytes, "buffer");
  assert.deepEqual(binary, bytes);
  binary[0] = 1;
  assert.equal(bytes[0], 255);
  assert.equal(checkoutCommandOutput(Buffer.from(" \nlegacy\n ")), "legacy");
  assert.equal(checkoutCommandOutput(Buffer.from(" \nlegacy\n "), true), " \nlegacy\n ");
  assert.throws(() => parseCustodyShadowTree(checkoutCommandOutput(bytes, "buffer")));
  assert.throws(() => checkoutCommandOutput("decoded already", "buffer"));
  assert.throws(() => checkoutCommandOutput(bytes, "utf8"));
});

test("custody source normalization permits only the single reviewed literal and installed switch token", () => {
  for (const [filename, initialFrom, to] of [
    ["scripts/sounding-line/noncampaign-custody-read-set.mjs", 'REVISION = "PENDING"', `REVISION = "${sha("a")}"`],
    ["scripts/sounding-line/ordinary-checkout.mjs", 'MODE = "SHADOW"', 'MODE = "ACTIVE"'],
  ]) {
    const source = fs.readFileSync(filename),
      text = source.toString();
    const from = filename.endsWith("noncampaign-custody-read-set.mjs")
      ? /REVISION = "(?:PENDING|[a-f0-9]{40})"/u.exec(text)?.[0]
      : /MODE = "(?:SHADOW|ACTIVE)"/u.exec(text)?.[0];
    const alternate = from === to ? initialFrom : to;
    assert(text.includes(from));
    assert.notEqual(from, alternate);
    const normalized = normalizeCustodyCertificateSource(filename, source);
    assert.deepEqual(
      normalizeCustodyCertificateSource(filename, Buffer.from(text.replace(from, alternate))),
      normalized,
    );
    assert.notDeepEqual(
      normalizeCustodyCertificateSource(filename, Buffer.from(text + "\n// other changed byte\n")),
      normalized,
    );
    assert.throws(() => normalizeCustodyCertificateSource(filename, Buffer.from(text.replace(from, "MISSING"))));
    const declaration = text
      .split("\n")
      .find((line) => line.startsWith("export const NONCAMPAIGN_CUSTODY_") && line.includes(from));
    assert.throws(() => normalizeCustodyCertificateSource(filename, Buffer.from(text + "\n" + declaration + "\n")));
    assert.throws(() => normalizeCustodyCertificateSource(filename, Buffer.from([255])));
  }
  assert(custodyCertificatePaths.includes("scripts/sounding-line/noncampaign-custody-negative-probe.mjs"));
  assert.equal(new Set(custodyCertificatePaths).size, custodyCertificatePaths.length);
  for (const row of custodyPolicy.readers) assert(custodyCertificatePaths.includes(row.path));
});

test("caller booleans, serialized observations and missing reviewed ancestry cannot mint custody capabilities", async () => {
  const context = {
    root: path.resolve("artifacts/never-created-custody"),
    git: process.execPath,
    baseSha: sha("a"),
    candidateSha: sha("b"),
    roots: [sha("a"), sha("b")],
  };
  for (const prNumber of [721, 776, 805, 820, 0, NaN]) {
    const result = await certifiedNoncampaignCustodyReadSet({
      ...context,
      prNumber,
      applied: true,
      sourceCertificate: true,
      binaryCommand: () => {
        throw Error("must not execute");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.proposal.profile, "FULL_SNAPSHOT");
  }
  for (const value of [
    { applied: true },
    { applied: true, proposal: { profile: "NONCAMPAIGN_CUSTODY_METADATA_V1" } },
    structuredClone({ certificate: "MATCHED", observed: true }),
  ])
    assert.equal(inspectCertifiedCustodyReadSet(value, context), null);
  assert.equal((await certifiedNoncampaignCustodyReadSet({ ...context, prNumber: 900001 })).applied, false);
});

test("adapter denial preload is byte-equivalent to the native-observed implementation and proof frames stay exclusive", (t) => {
  const directory = pilotDirectory(t),
    filename = path.join(directory, "original.bin"),
    git = path.resolve(process.execPath);
  assert.equal(
    adapterPreload(path.join(directory, "counters.json"), git),
    custodyShadowPreload(path.join(directory, "counters.json"), git),
  );
  const bytes = Buffer.from("original proof bytes\n");
  assert.equal(retainCustodyProofFrame(filename, bytes).completeReadback, true);
  assert.deepEqual(readProofSource(filename), bytes);
  assert.throws(() => retainCustodyProofFrame(filename, Buffer.from("replacement")), { code: "EEXIST" });
  assert.deepEqual(fs.readFileSync(filename), bytes);
  const alias = path.join(directory, "hardlink");
  fs.linkSync(filename, alias);
  assert.throws(() => readProofSource(filename), /SOURCE_FILE/u);
  fs.unlinkSync(alias);
});

test("negative custody filesystem proof detects phase files and source mutations outside its exact two output paths", (t) => {
  const directory = pilotDirectory(t),
    file = path.join(directory, "source.txt"),
    output = path.join(directory, "output.txt"),
    network = path.join(directory, "network.json");
  fs.writeFileSync(file, "installed source");
  const excluded = new Set([output, network]),
    before = custodyProofFilesystem(directory, excluded);
  fs.writeFileSync(output, "campaign=false\n");
  fs.writeFileSync(network, "{}");
  assert.equal(custodyProofFilesystem(directory, excluded), before);
  fs.mkdirSync(path.join(directory, "phase"));
  assert.notEqual(custodyProofFilesystem(directory, excluded), before);
  fs.rmdirSync(path.join(directory, "phase"));
  fs.appendFileSync(file, "changed");
  assert.notEqual(custodyProofFilesystem(directory, excluded), before);
});

test("prepared comparison binds a ready open PR to its actual protected base and original qualified head", () => {
  const fixture = qualifiedPilotBaseline();
  const input = {
    ...fixture,
    source: fixture.parents[0],
    pull: {
      id: 123456,
      number: 900001,
      state: "open",
      draft: false,
      merged_at: null,
      base: { ref: "main", sha: fixture.parents[0], repo: { id: 1303074266 } },
      head: { ref: "codex/inert-qualified-fixture", sha: fixture.parents[1], repo: { id: 1303074266 } },
    },
  };
  input.run.pull_requests = [
    {
      id: input.pull.id,
      number: input.pull.number,
      base: structuredClone(input.pull.base),
      head: structuredClone(input.pull.head),
    },
  ];
  input.run.head_branch = input.pull.head.ref;
  const result = validatePreparedCustodyBaseline(input);
  assert.equal(result.baseSha, input.pull.base.sha);
  assert.equal(result.candidateSha, input.pull.head.sha);
  assert.equal(result.installedSource, input.source);
  for (const mutate of [
    (v) => {
      v.pull.state = "closed";
    },
    (v) => {
      v.pull.draft = true;
    },
    (v) => {
      v.pull.merged_at = "2026-11-02T00:00:00Z";
    },
    (v) => {
      v.pull.base.sha = sha("e");
    },
    (v) => {
      v.pull.head.sha = sha("e");
    },
    (v) => {
      v.pull.base.ref = "other";
    },
    (v) => {
      v.pull.head.repo.id = 1;
    },
    (v) => {
      v.pull.base.repo.id = 1;
    },
    (v) => {
      v.pull.number = 805;
    },
    (v) => {
      v.run.run_attempt = 2;
    },
    (v) => {
      v.run.head_sha = sha("e");
    },
    (v) => {
      v.artifacts.artifacts[0].digest += "\n";
    },
    (v) => {
      v.run.pull_requests = [];
    },
    (v) => {
      v.run.pull_requests[0].number += 1;
    },
    (v) => {
      v.run.pull_requests[0].id += 1;
    },
    (v) => {
      v.run.pull_requests[0].head.sha = sha("e");
    },
    (v) => {
      v.run.pull_requests[0].base.sha = sha("e");
    },
  ]) {
    const copy = structuredClone(input);
    mutate(copy);
    assert.throws(() => validatePreparedCustodyBaseline(copy));
  }
});

test("candidate switch reader accepts one byte-exact data transition and rejects other code, modes and identities", () => {
  const installedBytes = fs.readFileSync("scripts/sounding-line/ordinary-checkout.mjs"),
    candidateBytes = custodySwitchAlternate(installedBytes);
  const blob = createHash("sha1").update(`blob ${candidateBytes.length}\0`).update(candidateBytes).digest("hex");
  const input = { installedBytes, candidateBytes, mode: "100644", blob, revision: sha("a") };
  assert.deepEqual(verifyCustodySwitchReader(input), {
    revision: sha("a"),
    path: "scripts/sounding-line/ordinary-checkout.mjs",
    blob,
  });
  assert.deepEqual(custodySwitchAlternate(candidateBytes), installedBytes);
  for (const change of [
    { candidateBytes: installedBytes },
    { candidateBytes: Buffer.concat([candidateBytes, Buffer.from("\n")]) },
    { candidateBytes: Buffer.from(candidateBytes.map((byte, index) => (index === 0 ? byte ^ 1 : byte))) },
    { mode: "100755" },
    { mode: "120000" },
    { blob: sha("b") },
    { blob: blob + "\n" },
    { revision: sha("a") + "\n" },
  ])
    assert.throws(() => verifyCustodySwitchReader({ ...input, ...change }));
  assert.throws(() => custodySwitchAlternate(Buffer.from([255])));
  assert.throws(() => custodySwitchAlternate(Buffer.alloc(16385)));
  const declaration = installedBytes
    .toString()
    .split("\n")
    .find((line) => line.startsWith("export const NONCAMPAIGN_CUSTODY_CHECKOUT_MODE"));
  assert.throws(() => custodySwitchAlternate(Buffer.from(installedBytes.toString() + "\n" + declaration + "\n")));
  const controller = new AbortController();
  controller.abort();
  return assert.rejects(certifiedNoncampaignCustodyReadSet({ signal: controller.signal }), /CANCELLED/u);
});

test("baseline toolchain observations retain original bytes and never certify runtime equality", () => {
  const bytes = Buffer.from("\u001b[32mVersion: 20261025.353.1\nnode v24.19.0\ngit version 2.56.0\n\u001b[0m");
  const result = baselineToolchainObservations(bytes);
  assert.deepEqual(result.nodeVersions, ["v24.19.0"]);
  assert.deepEqual(result.gitVersions, ["2.56.0"]);
  assert.deepEqual(result.imageVersions, ["20261025.353.1"]);
  assert.equal(result.originalLogSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(result.equalityOrIsolationCertified, false);
  assert.equal(result.kernel, "NOT_RECORDED_BY_ORIGINAL_JOB");
  assert.throws(() => baselineToolchainObservations(Buffer.from([255])));
});

test("actual GitHub empty PR array retains historical identities and refuses unreviewed workflow drift", () => {
  // The complete original response bytes are immutable fixtures. The historical
  // pre-merge PR response is not asserted to be the PR's present open state.
  const runBytes = fs.readFileSync(new URL("./fixtures/custody-pr838-run-empty.original.bin", import.meta.url));
  const pullBytes = fs.readFileSync(new URL("./fixtures/custody-pr838-premerge-pull.original.bin", import.meta.url));
  assert.equal(
    createHash("sha256").update(runBytes).digest("hex"),
    "d213e561437fdd248dfacdf9abab9b2f936427a8df5a666aa8b0686cee96a1eb",
  );
  assert.equal(
    createHash("sha256").update(pullBytes).digest("hex"),
    "ff419478a408e3d2bf44fb8f716210a5f224b516c424ce11e2aea2d607e159f2",
  );
  const run = JSON.parse(runBytes),
    pull = JSON.parse(pullBytes),
    base = pull.base.sha,
    candidate = pull.head.sha;
  assert.deepEqual(run.pull_requests, []);
  const installedWorkflow = fs.readFileSync(
    new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url),
  );
  if (createHash("sha256").update(installedWorkflow).digest("hex") !== CUSTODY_ORDINARY_WORKFLOW_SHA256) {
    // The retention rollout deliberately leaves the old observer pin frozen.
    // Historical original bytes remain valid history; they cannot authenticate
    // this changed installed workflow before its separately reviewed rebind.
    assert.equal(pull.number, 838);
    assert.equal(base, "613b73b5622e91dbee7b13c69ac7c5904771390e");
    assert.equal(candidate, "7a38251a07c17914e6cad7e6901f0a7330507648");
    assert.throws(() => validateCustodyRunPull(run, pull, base, candidate), /SOURCE_PINNED_PR_RUN_NAME/u);
    return;
  }
  const proof = validateCustodyRunPull(run, pull, base, candidate);
  assert.equal(proof.kind, "SOURCE_PINNED_RUN_NAME_WITH_EMPTY_PROVIDER_ARRAY");
  assert.equal(proof.observedPullRequestRows, 0);
  assert.equal(proof.prId, 5115855899);
  assert.equal(proof.prNumber, 838);
  assert.equal(proof.baseSha, "613b73b5622e91dbee7b13c69ac7c5904771390e");
  assert.equal(proof.candidateSha, "7a38251a07c17914e6cad7e6901f0a7330507648");
  assert.deepEqual(run.pull_requests, []);
  for (const mutate of [
    (v) => {
      v.workflow_id = 1;
    },
    (v) => {
      v.path = ".github/workflows/lookalike.yml";
    },
    (v) => {
      v.event = "workflow_dispatch";
    },
    (v) => {
      v.run_attempt = 2;
    },
    (v) => {
      v.display_title = v.display_title.replace("838", "839");
    },
    (v) => {
      v.display_title += "\n";
    },
    (v) => {
      v.head_branch = "codex/other";
    },
    (v) => {
      v.head_sha = sha("e");
    },
    (v) => {
      v.pull_requests = undefined;
    },
    (v) => {
      v.pull_requests = [{ id: pull.id, number: 839 }];
    },
  ]) {
    const copy = structuredClone(run);
    mutate(copy);
    assert.throws(() => validateCustodyRunPull(copy, pull, base, candidate));
  }
});

test("sparse-bootstrap workflow pins require exact reviewed base and candidate blobs and never exempt runtime files", () => {
  const original = { mode: "100644", type: "blob", blob: sha("a") };
  for (const filename of [
    ".github/workflows/sounding-line-custody-shadow.yml",
    ".github/workflows/sounding-line-ordinary.yml",
  ]) {
    assert.equal(
      custodyWorkflowMetadataPin(filename, original, original, original).kind,
      "NON_IMPORTED_WORKFLOW_METADATA",
    );
    // A changed base remains unreviewed even when its candidate copies it.
    const changed = { ...original, blob: sha("b") };
    assert.throws(() => custodyWorkflowMetadataPin(filename, changed, changed, original), /WORKFLOW_METADATA_DRIFT/u);
    assert.throws(() => custodyWorkflowMetadataPin(filename, original, changed, original), /WORKFLOW_METADATA_DRIFT/u);
    for (const bad of [
      undefined,
      { ...original, mode: "100755" },
      { ...original, mode: "120000" },
      { ...original, type: "tree" },
      { ...original, blob: sha("a") + "\n" },
    ])
      assert.throws(() => custodyWorkflowMetadataPin(filename, bad, bad, bad));
  }
  assert.throws(
    () => custodyWorkflowMetadataPin("scripts/sounding-line/experience-exception.mjs", original, original, original),
    /UNKNOWN_WORKFLOW_METADATA_PIN/u,
  );
});

test("custody retention preserves exact failed and partial originals without issuing authority", (t) => {
  const f = retentionFixture(t),
    source = retentionSource(f);
  const bytes = Buffer.from([255, 0, 13, 10]),
    frame = retentionFrame(bytes);
  fs.writeFileSync(path.join(source, frame.path), bytes);
  const ledger = Buffer.from(
    JSON.stringify({ frames: [frame], commands: [{ frames: { stdout: frame } }], retainedBytes: bytes.length }) + "\n",
  );
  fs.writeFileSync(path.join(source, "original-frame-ledger.failure.json"), ledger);
  fs.writeFileSync(path.join(source, "0002-partial.original.bin"), "partial");
  fs.writeFileSync(
    path.join(source, "supervision.json"),
    '{"failed":true,"failure":{"message":"original cancellation and cleanup failure"}}',
  );
  const r = retainCustodyWorkerProof(f);
  assert.equal(r.preservationComplete, true);
  assert.equal(r.ledgerConsistent, false);
  assert.equal(r.qualification, false);
  assert.equal(r.reuseAuthorized, false);
  for (const n of fs.readdirSync(source))
    assert.deepEqual(fs.readFileSync(path.join(f.destination, "originals", n)), fs.readFileSync(path.join(source, n)));
  assert.equal(JSON.parse(fs.readFileSync(r.manifest)).files.find((x) => x.path === frame.path).originalOrdinal, 1);
  assert.throws(() => retainCustodyWorkerProof(f), /OUTPUT_ALREADY_EXISTS/u);
  fs.unlinkSync(path.join(source, "0002-partial.original.bin"));
  const complete = retainCustodyWorkerProof({ ...f, destination: f.destination + "-complete" });
  assert.equal(complete.ledgerConsistent, true);
  assert.deepEqual(fs.readFileSync(path.join(source, "original-frame-ledger.failure.json")), ledger);
});

test("custody retention records absent prefix and rejects source hardlinks and directory aliases", (t) => {
  const f = retentionFixture(t),
    absent = retainCustodyWorkerProof(f);
  assert.equal(absent.status, "NO_WORKER_PREFIX");
  assert.equal(absent.preservationComplete, true);
  assert.equal(absent.ledgerConsistent, false);
  const source = retentionSource(f),
    foreign = path.join(f.root, "foreign.bin");
  fs.writeFileSync(foreign, "private original");
  fs.linkSync(foreign, path.join(source, "hardlinked.original.bin"));
  const bad = retainCustodyWorkerProof({ ...f, destination: f.destination + "-hardlink" });
  assert.equal(bad.preservationComplete, false);
  assert.match(JSON.stringify(JSON.parse(fs.readFileSync(bad.manifest)).errors), /SOURCE_ALIAS/u);
  assert.deepEqual(fs.readdirSync(path.join(f.destination + "-hardlink", "originals")), []);
  fs.unlinkSync(path.join(source, "hardlinked.original.bin"));
  fs.symlinkSync(f.root, path.join(source, "directory-link"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(retainCustodyWorkerProof({ ...f, destination: f.destination + "-alias" }).preservationComplete, false);
  assert.equal(fs.readFileSync(foreign, "utf8"), "private original");
});

test("custody retention rejects escaped, changed and reordered ledger references while preserving raw bytes", (t) => {
  const f = retentionFixture(t),
    source = retentionSource(f),
    bytes = Buffer.from("a"),
    frame = retentionFrame(bytes);
  fs.writeFileSync(path.join(source, frame.path), bytes);
  let i = 0;
  for (const change of [{ path: "../escape" }, { ordinal: 2 }, { bytes: 2 }, { sha256: "0".repeat(64) }]) {
    fs.writeFileSync(
      path.join(source, "original-frame-ledger.json"),
      JSON.stringify({ frames: [{ ...frame, ...change }] }),
    );
    const r = retainCustodyWorkerProof({ ...f, destination: f.destination + `-${i++}` });
    assert.equal(r.preservationComplete, true);
    assert.equal(r.ledgerConsistent, false);
    assert(JSON.parse(fs.readFileSync(r.manifest)).integrityErrors.length > 0);
    assert.deepEqual(fs.readFileSync(path.join(r.manifest, "../originals", frame.path)), bytes);
  }
  const limited = retainCustodyWorkerProof({ ...f, destination: f.destination + "-bound", limits: { totalBytes: 1 } });
  assert.equal(limited.preservationComplete, false);
  assert.match(JSON.stringify(JSON.parse(fs.readFileSync(limited.manifest)).errors), /TOTAL_BOUND/u);
  assert.throws(
    () =>
      retainCustodyWorkerProof({
        ...f,
        destination: f.destination + "-raised",
        limits: { totalBytes: 129 * 1024 ** 2 },
      }),
    /LIMIT/u,
  );
});

test("custody retention keeps partial destination and original write exception", (t) => {
  const f = retentionFixture(t),
    source = retentionSource(f),
    bytes = Buffer.from("unaltered raw original");
  fs.writeFileSync(path.join(source, "0001-stdout.original.bin"), bytes);
  const original = fs.writeSync;
  let injected = false;
  try {
    fs.writeSync = (...args) => {
      if (!injected) {
        injected = true;
        original(args[0], args[1], args[2], 3, args[4]);
        throw Error("SIMULATED_PARTIAL_WRITE");
      }
      return original(...args);
    };
    const r = retainCustodyWorkerProof(f);
    assert.equal(r.preservationComplete, false);
    assert.match(JSON.stringify(JSON.parse(fs.readFileSync(r.manifest)).errors), /SIMULATED_PARTIAL_WRITE/u);
    assert.equal(fs.readFileSync(path.join(f.destination, "originals/0001-stdout.original.bin")).length, 3);
  } finally {
    fs.writeSync = original;
  }
  assert.deepEqual(fs.readFileSync(path.join(source, "0001-stdout.original.bin")), bytes);
});

test("custody retention preserves close failures and rejects changed readback", (t) => {
  const f = retentionFixture(t),
    source = retentionSource(f),
    bytes = Buffer.from("unaltered raw original");
  fs.writeFileSync(path.join(source, "0001-stdout.original.bin"), bytes);
  const close = fs.closeSync;
  let injected = false;
  try {
    fs.closeSync = (...args) => {
      close(...args);
      if (!injected) {
        injected = true;
        throw Error("SIMULATED_CLOSE_FAILURE");
      }
    };
    const r = retainCustodyWorkerProof(f);
    assert.equal(r.preservationComplete, false);
    assert.match(JSON.stringify(JSON.parse(fs.readFileSync(r.manifest)).errors), /SIMULATED_CLOSE_FAILURE/u);
  } finally {
    fs.closeSync = close;
  }
  const read = fs.readSync;
  let calls = 0;
  try {
    fs.readSync = (...args) => {
      const n = read(...args);
      if (++calls === 2 && n > 0) args[1][args[2]] ^= 1;
      return n;
    };
    const r = retainCustodyWorkerProof({ ...f, destination: f.destination + "-readback" });
    assert.equal(r.preservationComplete, false);
    assert.match(JSON.stringify(JSON.parse(fs.readFileSync(r.manifest)).errors), /FRAME_READBACK_CHANGED/u);
  } finally {
    fs.readSync = read;
  }
  assert.deepEqual(fs.readFileSync(path.join(source, "0001-stdout.original.bin")), bytes);
});

function retentionSource(f) {
  const s = path.join(f.workspace, ".git/noncampaign-custody-proof");
  fs.mkdirSync(s, { recursive: true });
  return s;
}
function retentionFrame(bytes) {
  return {
    ordinal: 1,
    path: "0001-stdout.original.bin",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    completeReadback: true,
  };
}
function retentionFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sl-worker-retention-")),
    workspace = path.join(root, "candidate"),
    destination = path.join(root, "retained");
  fs.mkdirSync(workspace);
  t.after(() => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    workspace,
    destination,
    binding: {
      repository: "Kgray44/treasurehuntSoT",
      baseSha: sha("a"),
      candidateSha: sha("b"),
      prNumber: 842,
      runId: "12345",
      attempt: 1,
    },
  };
}

test("custody retention rejects unbound callers and source/output overlap before writing", (t) => {
  const f = retentionFixture(t);
  assert.throws(
    () => retainCustodyWorkerProof({ ...f, binding: { ...f.binding, repository: "other/repo" } }),
    /BINDING/u,
  );
  assert.equal(fs.existsSync(f.destination), false);
  assert.throws(
    () => retainCustodyWorkerProof({ ...f, destination: path.join(f.workspace, "output") }),
    /OUTPUT_OVERLAP/u,
  );
  assert.equal(fs.existsSync(path.join(f.workspace, "output")), false);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/sounding-line/experience-exception.mjs",
      "--operation",
      "retain-custody-proof",
      "--workspace",
      f.workspace,
    ],
    {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        NODE_OPTIONS: "",
        NODE_PATH: "",
        GITHUB_REPOSITORY: "other/repo",
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TRUSTED_WORKFLOW_CONTEXT/u);
  assert.equal(fs.existsSync(f.destination), false);
});

test("custody retention distinguishes consistent empty ledgers from complete worker originals", (t) => {
  const f = retentionFixture(t),
    source = retentionSource(f),
    raw = Buffer.from("trace"),
    frame = retentionFrame(raw),
    write = (name, value) =>
      fs.writeFileSync(
        path.join(source, name),
        typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value),
      );
  const digest = (value) =>
    createHash("sha256")
      .update(Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value)))
      .digest("hex");
  const proposal = { profile: "NONCAMPAIGN_CUSTODY_METADATA_V1" },
    rows = [{ path: "synthetic installed source", sha256: digest(raw) }],
    counter = { fetchAttempts: 0, networkAttempts: 0, nonGitProcessAttempts: 0 };
  const proof = {
    status: "PASS_INSTALLED_NEGATIVE_CUSTODY",
    root: f.workspace,
    baseSha: f.binding.baseSha,
    candidateSha: f.binding.candidateSha,
    prNumber: f.binding.prNumber,
    profile: proposal.profile,
    proposalSha256: digest(proposal),
    installedSourceDigest: digest(rows),
    certificateRevision: sha("c"),
    reserveOutputSha256: digest(Buffer.from("campaign=false\n")),
    ...counter,
    completeCommitTreeAncestry: true,
    filesystemUnchanged: true,
  };
  const stdout = Buffer.from(JSON.stringify(proof) + "\n");
  write(frame.path, raw);
  write("original-frame-ledger.json", {
    frames: [frame],
    commands: [{ frames: { stdout: frame } }],
    retainedBytes: raw.length,
  });
  write("input.original.json", {
    root: f.workspace,
    baseSha: f.binding.baseSha,
    candidateSha: f.binding.candidateSha,
    prNumber: f.binding.prNumber,
  });
  write("event.original.json", {});
  write("empty-git-config", "");
  write("deny.cjs", "synthetic test only");
  write("installed-source.original.json", { rows, certificateRevision: proof.certificateRevision });
  write("terminal.json", { ...proof, proposal });
  write("reserve-output.original.txt", "campaign=false\n");
  write("reserve-network.original.json", counter);
  write("worker.original.stdout", stdout);
  write("worker.original.stderr", "");
  write("supervision.json", {
    result: { code: 0 },
    failed: false,
    failure: null,
    finalizationFailures: [],
    stdoutComplete: true,
    stderrComplete: true,
    cleanup: { status: "PASS", treeReaped: true, streamsClosed: true },
    observed: { stdout: stdout.length, stderr: 0 },
    stored: { stdout: stdout.length, stderr: 0 },
  });
  const complete = retainCustodyWorkerProof(f);
  assert.equal(complete.workerPrefixComplete, true);
  assert.equal(complete.qualification, false);
  assert.equal(complete.workerProofWitness.proofSha256, digest(stdout));
  fs.unlinkSync(path.join(source, "terminal.json"));
  assert.equal(retainCustodyWorkerProof({ ...f, destination: f.destination + "-missing" }).workerPrefixComplete, false);
  write("terminal.json", { ...proof, proposal });
  fs.unlinkSync(path.join(source, frame.path));
  write("original-frame-ledger.json", { frames: [], commands: [], retainedBytes: 0 });
  const empty = retainCustodyWorkerProof({ ...f, destination: f.destination + "-empty" });
  assert.equal(empty.ledgerConsistent, true);
  assert.equal(empty.workerPrefixComplete, false);
});

test("retention source rebind preserves lineage and rejects stale or changed retention readers", () => {
  assert.equal(
    custodyPolicy.sourceRebind.priorReaderMapSha256,
    "01245355f2ffc1d76a49237e74c52c3bceae67bd8253d38294447a90aaafe86a",
  );
  assert.deepEqual(custodyPolicy.excludedPullRequests, [721, 776, 805, 820]);
  assert.equal(custodyPolicy.maximumMetadataPaths, 64);
  assert.equal(custodyPolicy.sourceRebind.changedReaders.length, 1);
  const prior = custodyPolicy.sourceRebind.changedReaders[0];
  assert.equal(prior.path, "scripts/sounding-line/experience-exception.mjs");
  assert.equal(prior.oldBlob, "876bd7ef84600dcbba29597f479105190d313051");
  const helper = "scripts/sounding-line/custody-worker-proof-retention.mjs",
    pin = custodyPolicy.readers.find((row) => row.path === helper);
  assert(pin && custodyCertificatePaths.includes(helper) && custodyPilotSourceFiles().includes(helper));
  assert.equal(pin.sha256, createHash("sha256").update(fs.readFileSync(helper)).digest("hex"));
  const stale = custodySetup();
  stale.baseEntries.find((row) => row.path === prior.path).blob = prior.oldBlob;
  assert.equal(proposeNoncampaignCustodyShadow(stale).reason, "INSTALLED_READER_CHANGED");
  const changed = custodySetup();
  changed.candidateEntries.find((row) => row.path === helper).blob = sha("f");
  assert.equal(proposeNoncampaignCustodyShadow(changed).reason, "INSTALLED_READER_CHANGED");
});

test("qualified supervisor rebind changes only its accepted pin and preserves prior lineage and ownership", () => {
  const base = "bfe39895d16562c68391a3279a1729ae3235bb3d";
  // The ordinary checkout need not contain this historical commit. Retain its
  // exact original JSON losslessly; base64 avoids host line-ending conversion.
  const encoded = fs
    .readFileSync(new URL("./fixtures/custody-supervisor-pr844-readers.original.base64", import.meta.url), "ascii")
    .trim();
  assert(encoded.length <= 1024 * 1024);
  const originalBytes = Buffer.from(encoded, "base64");
  assert.equal(originalBytes.toString("base64"), encoded);
  assert.equal(
    createHash("sha256").update(originalBytes).digest("hex"),
    "ac8fc58f9f4a901054859910c1c881ef4833a4de5d186a66319cbc5b87c433b2",
  );
  assert.equal(
    createHash("sha1").update(`blob ${originalBytes.length}\0`).update(originalBytes).digest("hex"),
    "19f7044c312a31a3aef8d3aa9046921337dabd9e",
  );
  const original = JSON.parse(originalBytes.toString("utf8"));
  assert.deepEqual(custodyPolicy.sourceRebind, original.sourceRebind);
  assert.deepEqual(custodyPolicy.metadata, original.metadata);
  assert.deepEqual(custodyPolicy.excludedPullRequests, original.excludedPullRequests);
  assert.equal(custodyPolicy.maximumMetadataPaths, original.maximumMetadataPaths);
  assert.equal(custodyPolicy.readers.length, 68);
  assert.equal(custodyCertificatePaths.length, 90);
  const changed = custodyPolicy.readers.filter(
    (pin) => JSON.stringify(pin) !== JSON.stringify(original.readers.find((old) => old.path === pin.path)),
  );
  assert.deepEqual(
    changed.map((pin) => pin.path),
    ["scripts/sounding-line/owned-process.mjs"],
  );
  const continuation = custodyPolicy.sourceRebindContinuations.at(-1);
  assert.equal(continuation.acceptedSource, base);
  assert.equal(continuation.originalAcceptedCandidate, "ddeb583b05cadae4f3c95c85f26c587f161df36c");
  assert.deepEqual(continuation.protectedAcceptance, {
    pr: 844,
    runId: 41512764232,
    attempt: 2,
    requiredCheckId: 125522309586,
    appId: 15368,
  });
  assert.equal(continuation.changedReaders.length, 1);
  assert.equal(continuation.changedReaders[0].newBlob, changed[0].blob);
  assert.equal(
    continuation.changedReaders[0].oldBlob,
    original.readers.find((pin) => pin.path === changed[0].path).blob,
  );
  assert.equal(changed[0].sha256, createHash("sha256").update(fs.readFileSync(changed[0].path)).digest("hex"));
  const stale = custodySetup();
  stale.candidateEntries.find((row) => row.path === changed[0].path).blob = continuation.changedReaders[0].oldBlob;
  assert.equal(proposeNoncampaignCustodyShadow(stale).reason, "INSTALLED_READER_CHANGED");
});
