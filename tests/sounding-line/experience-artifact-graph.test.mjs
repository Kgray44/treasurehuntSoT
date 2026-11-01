import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { buildExperienceArtifactGraph } from "../../scripts/sounding-line/experience-artifact-graph.mjs";
import {
  planArtifactInvalidation,
  compileArtifactDependencyClosures,
} from "../../scripts/sounding-line/artifact-dependency-graph.mjs";

const files = {
  "package-lock.json": "{}",
  "package.json": "{}",
  "src/a.ts": 'import "./shared.css"; export const endpoint="/api/a";',
  "src/b.ts": 'import "./shared.css"; export const value=1;',
  "src/shared.css": '@font-face { src: url("./font.woff2"); }',
  "src/font.woff2": "inert font bytes",
  "src/app/api/a/route.ts": "export const value=1;",
  "tests/a.spec.ts": "export const expected=1;",
  "tests/b.spec.ts": "export const expected=2;",
  "testing/fixture.json": "{}",
  "docs/readme.md": "initial documentation",
};
const runtime = Object.fromEntries(
  ["toolchainDigest", "browserDigest", "environmentDigest", "fixtureDigest"].map((key) => [key, digest(key)]),
);
Object.assign(runtime, { mutableStateClass: "TASK_OWNED_ISOLATED_PER_CONTEXT", externalRuntimeClosed: true });
const contracts = ["a", "b"].map((id) => ({
  id,
  experience: {
    sourcePaths: [`src/${id}.ts`],
    browserTests: [`tests/${id}.spec.ts`],
    devices: ["DESKTOP"],
    motion: true,
    states: [{ id: "ready", selector: "main" }],
    journeys: [{ id: "flow", roles: ["ANONYMOUS"], steps: [{ action: "goto", state: "ready" }] }],
  },
}));
const snapshot = (contents) => ({
  entries: Object.entries(contents).map(([path, value]) => ({
    path,
    mode: "100644",
    blob: createHash("sha1")
      .update(`blob ${Buffer.byteLength(value)}\0`)
      .update(value)
      .digest("hex"),
  })),
  contents: new Map(Object.entries(contents)),
});
const build = (contents = files, selected = contracts, observed = runtime) =>
  buildExperienceArtifactGraph({
    snapshot: snapshot(contents),
    contracts: selected,
    viewports: { DESKTOP: { width: 1200, height: 800 } },
    runtime: observed,
    policyDigest: digest("policy"),
    fixturePaths: ["testing/fixture.json"],
  });

// Expected impact is authored independently of the graph traversal/parser.
for (const [label, file, expected] of [
  ["docs", "docs/readme.md", []],
  ["isolated", "src/a.ts", ["a"]],
  ["shared CSS", "src/shared.css", ["a", "b"]],
  ["font", "src/font.woff2", ["a", "b"]],
  ["API", "src/app/api/a/route.ts", ["a"]],
  ["fixture", "testing/fixture.json", ["a", "b"]],
  ["lock", "package-lock.json", ["a", "b"]],
  ["package configuration", "package.json", ["a", "b"]],
  ["browser test", "tests/a.spec.ts", ["a"]],
])
  test(`source graph oracle: ${label}`, () => {
    const before = build(),
      after = build({ ...files, [file]: files[file] + "\nchanged" });
    const result = planArtifactInvalidation({ base: before.graph, candidate: after.graph, contexts: after.contexts });
    assert.deepEqual(
      [...new Set(result.freshContextIds.map((id) => after.contexts.find((x) => x.id === id).contractId))].sort(),
      expected,
    );
    assert.equal(after.qualification, false);
  });

test("state definitions, repeated captures and motion coverage retain distinct identities", () => {
  const before = build(),
    changed = structuredClone(contracts);
  changed[0].experience.states[0].selector = "article";
  const after = build(files, changed),
    result = planArtifactInvalidation({ base: before.graph, candidate: after.graph, contexts: after.contexts });
  assert.equal(after.contexts.length, 4);
  assert.equal(after.requiredCoverage.length, 24);
  assert.equal(after.artifactDefinitions.length, 24);
  assert.deepEqual(
    result.freshContextIds,
    after.contexts.filter((x) => x.contractId === "a").map((x) => x.id),
  );
  assert.notEqual(before.contexts[0].definitionFingerprint, after.contexts[0].definitionFingerprint);
  const repeated = structuredClone(contracts);
  repeated[0].experience.journeys[0].steps.push({ action: "click", state: "ready" });
  assert.equal(
    build(files, repeated).requiredCoverage.filter((x) => x.contractId === "a" && x.type === "screenshot").length,
    4,
  );
});

test("unknown source forms, missing definitions and unattested shared runtimes always stay fresh", () => {
  for (const source of [
    "export const x=import(name);",
    "export const x=process.env.SECRET;",
    "export const x=`/asset/${name}`;",
    "export const x=window.location;",
    'import "\\u002e/shared.css";',
    'import/* lexical separator */"./shared.css";',
    'import// lexical separator\n"./shared.css";',
    'const load=require; export const x=load("./shared.css");',
    'const load=fetch; export const x=load("/api/a");',
    'export const x=globalThis["fetch"]("/api/a");',
    'export const x=new WebSocket("/socket");',
  ]) {
    const value = build({ ...files, "src/a.ts": source });
    assert(value.contexts.filter((x) => x.contractId === "a").every((x) => x.unknown));
  }
  const missing = { ...files };
  delete missing["tests/a.spec.ts"];
  assert(
    build(missing)
      .contexts.filter((x) => x.contractId === "a")
      .every((x) => x.unknown),
  );
  assert(
    build(files, contracts, { ...runtime, mutableStateClass: "UNATTESTED_SHARED_TASK_RUNTIME" }).contexts.every(
      (x) => x.unknown,
    ),
  );
});

test("forged source payloads cannot become graph nodes and private compiled views resist later mutation", () => {
  const forged = snapshot(files);
  forged.contents.set("src/a.ts", "substitution");
  assert.throws(
    () =>
      buildExperienceArtifactGraph({
        snapshot: forged,
        contracts,
        viewports: { DESKTOP: { width: 1, height: 1 } },
        runtime,
        policyDigest: digest("policy"),
      }),
    /SOURCE_BYTES_MISMATCH/u,
  );
  const value = build(),
    compiled = compileArtifactDependencyClosures(value.graph),
    root = [value.contexts[0].id];
  const original = compiled.closure(root);
  value.graph.nodes.length = 0;
  assert.deepEqual(compiled.closure(root), original);
});
