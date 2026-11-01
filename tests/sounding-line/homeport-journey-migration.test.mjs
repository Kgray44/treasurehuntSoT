import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  bindSC00AHomeportMigration,
  experienceDigest,
  mergeExperienceContracts,
} from "../../scripts/sounding-line/product-experience.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const current = JSON.parse(readFileSync(path.join(repo, "testing/contracts.json"), "utf8"));
const record = current.experiencePolicy.journeyMigration;
const approved = JSON.parse(readFileSync(path.join(repo, record.immutableProofs[1].path), "utf8"));
const originalExec = execFileSync;

test("finite Homeport migration binds reviewed source and accepts only the protected merge and evidence tail", (t) => {
  const workflow = readFileSync(path.join(repo, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  const routing = workflow.slice(
    workflow.indexOf("      - name: Route through trusted protected-main classification"),
    workflow.indexOf(
      "      - run: npm ci --ignore-scripts",
      workflow.indexOf("      - name: Route through trusted protected-main classification"),
    ),
  );
  assert.match(
    routing,
    /GH_TOKEN: \$\{\{ github.token \}\}/u,
    "live source authentication needs the read-only provider token during routing",
  );
  const root = mkdtempSync(path.join(tmpdir(), "homeport-migration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (args, input) =>
    originalExec("git", args, {
      cwd: root,
      input,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  run(["init", "-q"]);
  run(["config", "user.name", "Finite migration fixture"]);
  run(["config", "user.email", "fixture@example.invalid"]);
  // Inert object witnesses avoid fetching the unrelated product branch in CI.
  // They are used only in this isolated synthetic repository, never by authority.
  const fixtureBytes = readFileSync(path.join(repo, "tests/sounding-line/fixtures/homeport-reviewed-source.json"));
  assert(fixtureBytes.length < 2 * 1024 * 1024);
  const sourceFixture = JSON.parse(fixtureBytes);
  const unpack = (fixture, expected) => {
    assert.equal(fixture.sha256, expected);
    const bytes = Buffer.from(fixture.packBase64, "base64");
    assert.equal(bytes.length, fixture.bytes);
    assert(bytes.length < 2 * 1024 * 1024);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
    run(["index-pack", "--stdin"], bytes);
  };
  unpack(sourceFixture.baseSnapshotObjects, "38b305ed6d15851209779f3ba9d945eab7f973bde3891effe5b51b9c46c01a63");
  writeFileSync(path.join(root, ".git/shallow"), `${record.acceptedSource}\n`);
  assert.throws(() => run(["cat-file", "-e", record.reviewedAncestor]));
  unpack(sourceFixture, "a8c33a5b45238ee75ba57cf5d5b31a256d42f069b12201cbe2dd1213de80f908");
  const put = (file, bytes, mode = "100644") =>
    run(["update-index", "--add", "--cacheinfo", `${mode},${run(["hash-object", "-w", "--stdin"], bytes)},${file}`]);
  const commit = (parents) =>
    run([
      "commit-tree",
      // The fixture retains exact tree identities without unrelated media blobs.
      run(["write-tree", "--missing-ok"]),
      ...parents.flatMap((parent) => ["-p", parent]),
      "-m",
      "synthetic source-bound migration fixture",
    ]);
  const baseRegistry = structuredClone(current);
  const unrelated = structuredClone(
    baseRegistry.contracts.find((contract) => contract.experience && contract.id !== record.contractId),
  );
  unrelated.id = "accepted.unrelated.fixture";
  baseRegistry.contracts.push(unrelated);
  run(["read-tree", record.acceptedSource]);
  put("testing/contracts.json", JSON.stringify(baseRegistry));
  for (const proof of record.immutableProofs) put(proof.path, readFileSync(path.join(repo, proof.path)));
  // Accepted authority may advance while the reviewed product projection stays frozen.
  put("scripts/sounding-line/accepted-authority-fixture.mjs", "export const accepted = true;\n");
  const baseSha = commit([record.acceptedSource]);
  const proposedRegistry = {
    ...approved,
    experiencePolicy: current.experiencePolicy,
    contracts: [...approved.contracts, unrelated],
  };
  for (const entry of record.approvedChanges)
    if (entry.path !== "testing/contracts.json")
      run(["update-index", "--add", "--cacheinfo", `${entry.mode},${entry.blob},${entry.path}`]);
  put("testing/contracts.json", JSON.stringify(proposedRegistry));
  const candidateSha = commit([baseSha, record.reviewedAncestor]);
  let live = {
    number: 820,
    state: "open",
    merged: false,
    draft: true,
    base: { ref: "main", sha: baseSha, repo: { full_name: record.repository } },
    head: { sha: candidateSha, repo: { full_name: record.repository } },
  };
  let providerCalls = 0;
  t.mock.method(childProcess, "execFileSync", (binary, args, options) => {
    if (binary !== "gh") return originalExec(binary, args, options);
    assert.deepEqual(args, ["api", "repos/Kgray44/treasurehuntSoT/pulls/820"]);
    assert.equal(options.timeout, 15000);
    providerCalls++;
    return JSON.stringify(live);
  });
  syncBuiltinESMExports();
  const saved = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = "false";
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-01T01:00:00Z") });
  const bind = (head = candidateSha, overrides = {}) => {
    live.head.sha = head;
    return bindSC00AHomeportMigration({
      root,
      baseSha,
      candidateSha: head,
      prNumber: 820,
      trustedRegistry: baseRegistry,
      candidateRegistry: JSON.parse(run(["show", `${head}:testing/contracts.json`])),
      ...overrides,
    });
  };
  const replacement = bind();
  assert.equal(experienceDigest(replacement), record.newContractDigest);
  assert.equal(replacement.experience.journeys.find((journey) => journey.id === record.journeyId).steps.length, 23);
  assert.equal(bind(candidateSha, { candidateRegistry: baseRegistry }), null, "unchanged main keeps its Title journey");
  assert.equal(
    current.contracts.find((contract) => contract.id === record.contractId).experience.journeys[0].steps.length,
    20,
  );
  const trusted = baseRegistry.contracts.filter((contract) => contract.experience);
  const merged = mergeExperienceContracts(
    trusted.map((contract) => (contract.id === replacement.id ? replacement : contract)),
    proposedRegistry.contracts,
  );
  const unchangedMerge = mergeExperienceContracts(trusted, baseRegistry.contracts);
  for (const contract of trusted.filter((contract) => contract.id !== record.contractId))
    assert.equal(
      experienceDigest(merged.find((value) => value.id === contract.id)),
      experienceDigest(unchangedMerge.find((value) => value.id === contract.id)),
    );
  assert.throws(() => bind(candidateSha, { prNumber: 821 }), /MIGRATION_PR_MISMATCH/u);
  const candidateOnly = structuredClone(baseRegistry);
  delete candidateOnly.experiencePolicy.journeyMigration;
  assert.equal(bind(candidateSha, { trustedRegistry: candidateOnly }), null);
  assert.throws(
    () =>
      mergeExperienceContracts(
        candidateOnly.contracts.filter((contract) => contract.experience),
        proposedRegistry.contracts,
      ),
    /TRUSTED_OBLIGATION_CHANGED/u,
  );
  const tampered = structuredClone(baseRegistry);
  tampered.experiencePolicy.journeyMigration.expiresAt = "2099-01-01";
  assert.throws(() => bind(candidateSha, { trustedRegistry: tampered }), /MIGRATION_RECORD_INVALID/u);
  const wrongOld = structuredClone(baseRegistry);
  wrongOld.contracts.find((contract) => contract.id === record.contractId).name += "changed";
  assert.throws(() => bind(candidateSha, { trustedRegistry: wrongOld }), /MIGRATION_CONTRACT_MISMATCH/u);
  for (const mutate of [
    (pull) => {
      pull.state = "closed";
    },
    (pull) => {
      pull.merged = true;
    },
    (pull) => {
      pull.base.sha = "0".repeat(40);
    },
    (pull) => {
      pull.head.repo.full_name = "other/repository";
    },
  ]) {
    const savedLive = structuredClone(live);
    mutate(live);
    assert.throws(() => bind(), /MIGRATION_LIVE_SOURCE_MISMATCH/u);
    live = savedLive;
  }
  t.mock.timers.setTime(Date.parse(record.expiresAt));
  assert.throws(() => bind(), /MIGRATION_EXPIRED/u);
  t.mock.timers.setTime(Date.parse("2026-11-01T01:00:00Z"));
  const eventPath = path.join(root, "trusted-event.json");
  const context = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "pull_request_target",
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: record.repository,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: baseSha,
    GITHUB_WORKFLOW_REF: `${record.repository}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`,
  };
  const priorContext = Object.fromEntries(Object.keys(context).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(priorContext)) {
      if (key === "GITHUB_ACTIONS") continue;
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, context);
  writeFileSync(eventPath, JSON.stringify({ pull_request: live }));
  assert.equal(experienceDigest(bind()), record.newContractDigest);
  for (const [key, value] of [
    ["GITHUB_REPOSITORY", "other/repository"],
    ["GITHUB_REF", "refs/heads/candidate"],
    ["GITHUB_SHA", "0".repeat(40)],
    ["GITHUB_EVENT_NAME", "push"],
    ["GITHUB_WORKFLOW_REF", `${record.repository}/.github/workflows/untrusted.yml@refs/heads/main`],
  ]) {
    process.env[key] = value;
    assert.throws(() => bind(), /MIGRATION_EVENT_MISMATCH/u);
    process.env[key] = context[key];
  }
  process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
  writeFileSync(
    eventPath,
    JSON.stringify({ inputs: { pr_number: "820", base_sha: baseSha, candidate_sha: candidateSha } }),
  );
  assert.equal(experienceDigest(bind()), record.newContractDigest);
  writeFileSync(
    eventPath,
    JSON.stringify({ inputs: { pr_number: "821", base_sha: baseSha, candidate_sha: candidateSha } }),
  );
  assert.throws(() => bind(), /MIGRATION_EVENT_MISMATCH/u);
  for (const [key, value] of Object.entries(priorContext)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const altered = (file, bytes, mode = "100644", parents = [candidateSha]) => {
    run(["read-tree", candidateSha]);
    put(file, bytes, mode);
    return commit(parents);
  };
  for (const file of [
    "tests/e2e/chronicle-creation.spec.ts",
    "tests/e2e/fixtures/landfall-closure.ts",
    "playwright.config.ts",
  ])
    assert.throws(() => bind(altered(file, "weakened browser/fixture")), /MIGRATION_BROWSER_FIXTURE_MISMATCH/u);
  assert.throws(
    () => bind(altered("src/components/studio/NewTaleForm.tsx", "unreviewed product")),
    /MIGRATION_APPROVED_SOURCE_CHANGED/u,
  );
  assert.throws(() => bind(altered("src/unlisted-migration.ts", "unreviewed source")), /MIGRATION_UNAPPROVED_TAIL/u);
  assert.throws(
    () => bind(altered(record.immutableProofs[2].path, "rewritten history")),
    /MIGRATION_HISTORY_MISMATCH/u,
  );
  const changedRegistry = structuredClone(proposedRegistry);
  changedRegistry.contracts.find((contract) => contract.id !== record.contractId).name += "unreviewed";
  assert.throws(
    () => bind(altered("testing/contracts.json", JSON.stringify(changedRegistry))),
    /MIGRATION_REGISTRATION_MISMATCH/u,
  );
  const changedHomeport = structuredClone(proposedRegistry);
  changedHomeport.contracts.find((contract) => contract.id === record.contractId).experience.roles.push("UNREVIEWED");
  assert.throws(
    () => bind(altered("testing/contracts.json", JSON.stringify(changedHomeport))),
    /MIGRATION_CONTRACT_MISMATCH/u,
  );
  run(["read-tree", candidateSha]);
  const noReviewedAncestry = commit([baseSha]);
  assert.throws(() => bind(noReviewedAncestry));
  const publication = `${record.publicationRoot}d83e81c946/review.json`;
  const tail = altered(publication, '{"qualification":false}\n');
  assert.equal(experienceDigest(bind(tail)), record.newContractDigest);
  assert.equal(
    experienceDigest(bind(altered(record.reviewPath, '{"qualification":false}\n'))),
    record.newContractDigest,
  );
  assert.throws(() => bind(altered(publication, "../target", "120000")), /MIGRATION_UNAPPROVED_TAIL/u);
  assert.throws(() => bind(altered("Development_Docs/unbounded-publication.json", "{}")), /MIGRATION_UNAPPROVED_TAIL/u);
  assert(providerCalls > 10);
});
