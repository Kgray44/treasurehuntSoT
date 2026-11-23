import assert from "node:assert/strict";
import test from "node:test";
import { browserAuthorityExecutionTimeoutMs } from "../scripts/sounding-line/browser-authority.mjs";
import { browserProfileBatches } from "../scripts/sounding-line-v3/checks.mjs";
import { classifyFormatting } from "../scripts/sounding-line-v3/format.mjs";
import { reusableSource } from "../scripts/sounding-line-v3/reuse.mjs";
import { disposition, prerequisites } from "../scripts/sounding-line-v3/integrate.mjs";
import { metadata, passive, registry, select } from "../scripts/sounding-line-v3/plan.mjs";

const change = (file, mode = "100644", status = "M") => ({ file, mode, status });
const read =
  (content = "") =>
  () =>
    Buffer.from(content);
const data = registry();
const plan = (files, content = "", request = {}) =>
  select(
    files.map((file) => change(file)),
    read(content),
    request,
    data,
  );
const names = (result) => result.jobs.map(({ id }) => id);

test("ordinary Lanternwake runs both extended lifecycle groups under separate deadlines", () => {
  const accessibility = "tests/e2e/phase3-accessibility-viewports.spec.ts";
  const extended = "tests/e2e/phase3-lifecycle-extended.spec.ts";
  const performance = "tests/e2e/phase3-performance.spec.ts";
  const audioSuite = "Project Lanternwake Phase 3 audio lifecycle";
  const files = [accessibility, extended, performance];
  const extendedBatches = [
    [extended, "--grep-invert", audioSuite],
    [extended, "--grep", audioSuite],
  ];
  assert.deepEqual(browserProfileBatches("lanternwake-phase3", files, false), [
    [performance],
    [accessibility],
    ...extendedBatches,
  ]);
  assert.deepEqual(browserProfileBatches("lanternwake-phase3", [extended], false), extendedBatches);
  assert.deepEqual(browserProfileBatches("lanternwake-phase3", files, true), [
    [performance],
    [accessibility, extended],
  ]);
  assert.deepEqual(browserProfileBatches("lanternwake-phase3", [performance], true), [[performance]]);
  assert.deepEqual(browserProfileBatches("generic", files, false), [files]);
});

test("Markdown and evidence images use the same dependency-free fast path", () => {
  for (const file of ["README.md", "docs/README.md", "Experience_Images/proof.png"]) {
    const result = plan([file]);
    assert.equal(result.category, "documentation");
    assert.deepEqual(names(result), ["diff", "docs"]);
  }
  assert.equal(passive(change("docs/diagram.svg", "120000"), read("<svg/>")), false);
  assert.equal(
    passive(change("docs/old.md", "000000", "D"), () => assert.fail()),
    true,
  );
});

test("Executable docs and active application assets cannot claim the docs fast path", () => {
  for (const [file, content] of [
    ["docs/article.mdx", "import Widget from './widget'"],
    ["docs/diagram.svg", '<svg onload="alert(1)"/>'],
    ["docs/embed.md", '<iframe src="https://example.com"></iframe>'],
    ["public/map.png", ""],
  ]) {
    const result = plan([file], content, { mode: "documentation" });
    assert.equal(result.category, "product");
    assert.ok(
      names(result).some((job) => ["all-vitest", "build"].includes(job)),
      file,
    );
  }
});

test("Formatting and workflow changes take distinct maintenance routes", () => {
  const formatting = plan([".prettierrc.json"]);
  assert.equal(formatting.category, "maintenance");
  assert.deepEqual(names(formatting), ["diff", "format"]);
  const workflow = plan([".github/workflows/sounding-line-v3.yml"]);
  assert.equal(workflow.category, "maintenance");
  assert.deepEqual(names(workflow), ["diff", "format", "workflow"]);
});

test("Wayfarer and Landfall select registered coverage for their changed code", () => {
  const wayfarer = plan(["src/wayfarer/profile.ts"]);
  const landfall = plan(["src/landfall/location.ts"]);
  assert.ok(names(wayfarer).includes("unit.wayfarer"));
  assert.ok(names(landfall).includes("unit.landfall"));
  assert.ok(!names(wayfarer).includes("unit.landfall"));
  assert.ok(!names(wayfarer).includes("unit.homeport"));
  assert.ok(!names(landfall).includes("unit.wayfarer"));
  assert.ok(!names(wayfarer).includes("all-vitest"));
  assert.ok(!names(landfall).includes("all-vitest"));
});

test("Shared, schema, and security changes get conservative coverage", () => {
  const shared = names(plan(["src/lib/browser-uuid.ts"]));
  assert.ok(shared.includes("all-vitest"));
  assert.ok(shared.includes("browser"));
  const schema = names(plan(["prisma/schema.sqlite.prisma"]));
  assert.ok(schema.includes("schema"));
  assert.ok(schema.includes("types"));
  const security = names(plan(["src/app/api/auth/session/route.ts"]));
  assert.ok(security.includes("unit.auth") || security.includes("all-vitest"));
  assert.ok(security.some((job) => job.includes("browser")));
});

test("Bridgewatch changes and full verification use the Bridgewatch package test command", () => {
  for (const selection of [
    plan(["bridgewatch/public/style.css"]),
    plan(["bridgewatch/test/mission-control-ui.test.ts"]),
    plan([], "", { full: true }),
  ]) {
    assert.equal(selection.jobs.find(({ id }) => id === "unit.bridgewatch")?.kind, "bridgewatch-vitest");
    assert.ok(!names(selection).includes("changed-tests"));
  }
});

test("Homeport Node tests require their application checkout and dependency setup", () => {
  const declared = plan(["README.md"], "", { suites: ["unit.homeport"] });
  assert.equal(declared.jobs.find(({ id }) => id === "unit.homeport-node")?.kind, "node-homeport");
  const focused = plan(["tests/homeport/phase6-surfaces.test.mjs"]);
  assert.equal(focused.jobs.find(({ id }) => id === "changed-node-tests")?.kind, "node-homeport");
});

test("only task-owned full browser profiles receive the larger V3 execution budget", () => {
  const profile = { SOUNDING_LINE_SUITE_PROFILE: "lanternwake-phase3", SOUNDING_LINE_TASK_OWNED_HTTP: "1" };
  assert.equal(browserAuthorityExecutionTimeoutMs(profile), 15 * 60_000);
  assert.equal(browserAuthorityExecutionTimeoutMs({ SOUNDING_LINE_V3_FULL_BROWSER: "1" }), 15 * 60_000);
  assert.equal(browserAuthorityExecutionTimeoutMs({ ...profile, SOUNDING_LINE_V3_FULL_BROWSER: "1" }), 60 * 60_000);
});

test("full browser verification selects four distinct generic shards", () => {
  const full = plan([], "", { full: true });
  assert.deepEqual(
    full.jobs.filter(({ shard }) => shard).map(({ id, kind, shard }) => [id, kind, shard]),
    [1, 2, 3, 4].map((index) => ["browser-generic-" + index, "browser-full", index + "/4"]),
  );
  const focused = plan(["tests/e2e/acceptance.spec.ts"]);
  assert.ok(focused.jobs.some(({ id, kind }) => id === "browser" && kind === "browser"));
  assert.ok(focused.jobs.every(({ shard }) => shard === undefined));
});

test("Owner labels add coverage and unknown requests fail closed", () => {
  const request = metadata(["sl:mode:maintenance", "sl:project:Wayfarer", "sl:suite:unit.landfall"]);
  const result = names(plan(["README.md"], "", request));
  assert.ok(result.includes("unit.wayfarer"));
  assert.ok(result.includes("unit.landfall"));
  assert.throws(() => plan(["README.md"], "", { projects: ["NoSuchProject"] }), /No registered/);
  assert.throws(() => metadata(["sl:mode:full", "sl:mode:documentation"]), /one sl:mode/);
  const full = names(plan([], "", metadata(["sl:full"])));
  for (const expected of [
    "all-vitest",
    "browser",
    "browser-lanternwake",
    "browser-profiles",
    "format",
    "build",
    "schema",
    "privacy",
    "compatibility",
  ])
    assert.ok(full.includes(expected));
});

test("Integration holds dependencies and conflicts while independent PRs are eligible", () => {
  const candidate = {
    state: "open",
    number: 17,
    base: { ref: "main", repo: { full_name: "o/r" } },
    head: { repo: { full_name: "o/r" } },
    mergeable: true,
    mergeable_state: "clean",
  };
  const held = { ...candidate, body: "Depends on: #12, #15" };
  const dependency = (number) => ({ base: { ref: "main" }, merged: number === 12 });
  assert.deepEqual(prerequisites(held.body), [12, 15]);
  assert.match(disposition(held, dependency), /waiting for #15/);
  assert.equal(
    disposition(held, () => ({ base: { ref: "main" }, merged: true })),
    "ready",
  );
  assert.equal(disposition({ ...candidate, mergeable: false }, dependency), "merge conflict");
  assert.equal(disposition({ ...candidate, mergeable_state: "behind" }, dependency), "behind");
  assert.equal(disposition(candidate, dependency), "ready");
});

test("A changed project test executes directly without widening to its whole project", () => {
  const fixture = data.files.find((file) => file.startsWith("src/wayfarer/") && file.endsWith(".test.ts"));
  assert.ok(fixture);
  const result = plan([fixture]);
  assert.equal(result.category, "maintenance");
  assert.deepEqual(names(result), ["diff", "format", "changed-tests"]);
  assert.deepEqual(result.jobs.at(-1).files, [fixture]);
});

test("full formatting reports only exact unchanged debt under the same formatter policy", () => {
  const baseline = { prettier: "3.6.2", config: { ".prettierrc.json": "config" }, files: { "docs/old.md": "old" } };
  const files = new Map([
    [".prettierrc.json", "config"],
    ["docs/old.md", "old"],
    ["src/new.ts", "fresh"],
  ]);
  const findings = ["docs/old.md", "src/new.ts"];
  const classify = (changed = [], version = "3.6.2") =>
    classifyFormatting(findings, new Set(changed), files, baseline, version);
  assert.deepEqual(classify(), { debt: ["docs/old.md"], violations: ["src/new.ts"] });
  assert.deepEqual(classify(["docs/old.md"]).violations, findings);
  assert.deepEqual(classify([], "4.0.0").violations, findings);
  files.set(".prettierrc.json", "updated");
  assert.deepEqual(classify().violations, findings);
  files.set(".prettierrc.json", "config");
  files.set("docs/old.md", "different bytes");
  assert.deepEqual(classify().violations, findings);
});

test("stylesheets, fixtures and dependency changes remain reuse inputs", () => {
  for (const file of [
    "src/landfall/chart.css",
    "src/components/wayfarer/profile.css",
    "package-lock.json",
    "prisma/schema.sqlite.prisma",
    "tests/fixtures/profile.json",
    "testing/generated/active-test-registry.json",
  ])
    assert.ok(reusableSource(file), file);
  assert.equal(reusableSource("README.md"), false);
});

test("formatting applies to changed code even under a documentation label", () => {
  const result = plan(["src/wayfarer/profile.ts"], "", { mode: "documentation" });
  assert.equal(result.category, "product");
  assert.ok(names(result).includes("format"));
  assert.ok(names(result).includes("unit.wayfarer"));
});

test("registry changes and unmapped application paths explain their conservative coverage", () => {
  const registryChange = plan(["testing/impact-map.json"], "{}", { mode: "documentation" });
  assert.equal(registryChange.category, "maintenance");
  assert.ok(names(registryChange).includes("workflow"));
  assert.ok(names(registryChange).includes("all-vitest"));
  assert.ok(registryChange.notes.some((reason) => /Verification registry/.test(reason)));

  const unknown = plan(["future-module-in-stabilization.ts"]);
  assert.equal(unknown.category, "product");
  assert.ok(names(unknown).includes("all-vitest"));
  assert.ok(names(unknown).includes("types"));
  assert.ok(unknown.notes.some((reason) => /Unmapped path/.test(reason)));
});
