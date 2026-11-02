import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { createArtifactDependencyGraph } from "../../scripts/sounding-line/artifact-dependency-graph.mjs";
import { planSelectedSourceShadow } from "../../scripts/sounding-line/selected-source-shadow.mjs";
import {
  proposeNoncampaignCustodyShadow,
  parseCustodyShadowTree,
  observeNoncampaignCustodyShadow,
  inspectNoncampaignCustodyShadow,
} from "../../scripts/sounding-line/noncampaign-custody-shadow.mjs";

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
  assert.equal(cases.length, 84);
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
  assert.equal(result.applied, true);
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
