import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
import { baselineToolchainObservations } from "../../scripts/sounding-line/noncampaign-custody-matched-pilot.mjs";
import {
  custodyShadowPreload as adapterPreload,
  readCustodyPilotSource as readProofSource,
  retainCustodyProofFrame,
} from "../../scripts/sounding-line/noncampaign-custody-proof-files.mjs";
import { custodyProofFilesystem } from "../../scripts/sounding-line/noncampaign-custody-negative-probe.mjs";

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
  assert.equal(cases.length + custodyPolicy.readers.length, 151);
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
      : initialFrom;
    assert(text.includes(from));
    const normalized = normalizeCustodyCertificateSource(filename, source);
    assert.deepEqual(normalizeCustodyCertificateSource(filename, Buffer.from(text.replace(from, to))), normalized);
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
