import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  documentationCheckoutProposal,
  reviewedProfileSourceMatches,
  probeDocumentationCustody,
} from "../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
import { custodyProbeEnvironment } from "../../scripts/sounding-line/ordinary-custody-probe.mjs";
import { selectedCheckout } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
const entry = (path, sha = "a".repeat(40), mode = "100644") => ({ path, sha, mode, type: "blob" });
const base = [
  entry("src/source.ts"),
  entry("Development_Docs/index.md"),
  entry("testing/contracts.json"),
  entry("testing/product-experience-exceptions.json"),
];
const doc = entry("Development_Docs/incident.md", "b".repeat(40));
test("every allowed transport drift requires its exact reviewed mode and blob; evidence authority has no exemption", () => {
  const file = ".github/workflows/sounding-line-ordinary.yml",
    anchor = [...base, entry(file)],
    reviewed = [...base, entry(file, "b".repeat(40))];
  const result = (current, certificate = reviewed) =>
    documentationCheckoutProposal({
      baseEntries: current,
      candidateEntries: [...current, doc],
      anchorEntries: anchor,
      reviewedEntries: certificate,
      prNumber: 819,
    });
  assert.equal(result(reviewed).profile, "DOCUMENTATION_ONLY_SOURCE_BOUND_V1");
  assert.equal(result([...base, entry(file, "c".repeat(40))]).reason, "REVIEWED_TRANSPORT_SOURCE_CHANGED");
  assert.equal(result([...base, entry(file, "b".repeat(40), "100755")]).profile, "FULL_SNAPSHOT");
  assert.equal(result(reviewed, []).profile, "FULL_SNAPSHOT");
  const authority = "scripts/sounding-line/authenticated-completed-evidence.mjs";
  assert.equal(
    documentationCheckoutProposal({
      baseEntries: [...base, entry(authority, "c".repeat(40))],
      candidateEntries: [...base, entry(authority, "c".repeat(40)), doc],
      anchorEntries: [...base, entry(authority)],
      reviewedEntries: [...base, entry(authority, "c".repeat(40))],
      prNumber: 819,
    }).reason,
    "READER_OR_BASE_POLICY_DRIFT",
  );
  for (const file of [
    "testing/contracts.json",
    "testing/product-experience-exceptions.json",
    "Development_Docs/Testing/Product_Experience/candidate-review.json",
  ]) {
    const candidate = base.filter((x) => x.path !== file);
    candidate.push(entry(file, "c".repeat(40)), doc);
    assert.equal(
      documentationCheckoutProposal({
        baseEntries: base,
        candidateEntries: candidate,
        anchorEntries: base,
        prNumber: 819,
        purpose: "campaign-custody",
      }).profile,
      "FULL_SNAPSHOT",
    );
  }
});
test("profile certificate normalization permits only its one bootstrap literal, never mode, whitespace or code", () => {
  const original =
    'export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";\nexport const MODE = "SHADOW";\n';
  const installed = original.replace('"PENDING"', '"' + "a".repeat(40) + '"');
  const check = (source, expected = original) => {
    const bytes = Buffer.from(source),
      blob = createHash("sha1")
        .update(Buffer.from(`blob ${bytes.length}\0`))
        .update(bytes)
        .digest("hex");
    return reviewedProfileSourceMatches(bytes, expected, blob);
  };
  assert(check(installed));
  for (const changed of [
    installed + "\n",
    installed.replace("SHADOW", "ACTIVE"),
    installed.replace("MODE", "OTHER"),
    installed + original.split("\n")[0] + "\n",
  ])
    assert.equal(check(changed), false);
  assert.equal(reviewedProfileSourceMatches(Buffer.from(installed), original, "b".repeat(40)), false);
  const actualModule=readFileSync(new URL("../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs",import.meta.url),"utf8");
  const pinnedModule=actualModule.replace(/^export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";$/mu,'export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "'+"a".repeat(40)+'";');
  assert(check(pinnedModule,actualModule),"the complete module permits only the actual declaration line");
});
test("read-only campaign child has no token, output channel, ambient Git redirection or transport authority", () => {
  const env = custodyProbeEnvironment(
    {
      PATH: "untrusted",
      SystemRoot: process.env.SystemRoot,
      GH_TOKEN: "inert",
      GITHUB_TOKEN: "inert",
      GITHUB_OUTPUT: "inert",
      ACTIONS_RUNTIME_TOKEN: "inert",
      AWS_SECRET_ACCESS_KEY: "inert",
      GIT_DIR: "inert",
      GIT_CONFIG_GLOBAL: "isolated-empty-config",
      TEMP: tmpdir(),
    },
    process.execPath,
  );
  for (const name of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "GITHUB_OUTPUT",
    "ACTIONS_RUNTIME_TOKEN",
    "AWS_SECRET_ACCESS_KEY",
    "GIT_DIR",
  ])
    assert.equal(env[name], undefined);
  assert(!env.PATH.includes("untrusted"));
  assert.equal(env.GIT_NO_LAZY_FETCH, "1");
  assert.equal(env.GIT_CONFIG_VALUE_0, "never");
});
for (const scenario of ["positive", "uncertain", "invalid-json", "payload-failure", "local-timeout", "wrong-source"])
  test(`custody ${scenario} returns FULL before sparse omission`, async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), "custody-fallback-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(path.join(root, ".git"));
    const baseSha = "a".repeat(40),
      candidateSha = "b".repeat(40),
      proposal = {
        profile: "DOCUMENTATION_CUSTODY_METADATA_V1",
        metadataPaths: ["testing/contracts.json", "testing/product-experience-exceptions.json"],
      };
    const readOnlyCommand = async () => {
      if (scenario === "invalid-json") return "invalid";
      if (scenario === "payload-failure") throw Error("SOUNDING_LINE_SELECTED_CHECKOUT_GIT_FAILED");
      if (scenario === "local-timeout") throw Error("SOUNDING_LINE_SELECTED_CHECKOUT_PROBE_DEADLINE");
      return JSON.stringify({
        status: scenario === "uncertain" ? "UNKNOWN" : "PASS",
        campaign: scenario === "positive",
        baseSha,
        candidateSha: scenario === "wrong-source" ? baseSha : candidateSha,
        prNumber: 819,
        registryBlob: "a".repeat(40),
        transport: "DISABLED",
        authority: "READ_ONLY_FULL_ROUTE_HINT",
      });
    };
    const result = await probeDocumentationCustody({
      proposal,
      command: async () => "",
      readOnlyCommand,
      root,
      git: process.execPath,
      baseSha,
      candidateSha,
      prNumber: 819,
      baseEntries: base,
      candidateEntries: base,
    });
    assert.equal(result.proposal.profile, "FULL_SNAPSHOT");
  });
test("failed checkout emits a complete uploadable receipt and all four jobs retain it after failure", async (t) => {
  const owner = mkdtempSync(path.join(tmpdir(), "checkout-failed-receipt-"));
  t.after(() => rmSync(owner, { recursive: true, force: true }));
  await assert.rejects(
    selectedCheckout({
      root: path.join(owner, "candidate"),
      remote: pathToFileURL(path.join(owner, "absent.git")).href,
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      roots: [],
      readerRevisions: [],
      readerObjects: [],
      budgetMs: 20000,
      stallBudgetMs: 15000,
      progress: false,
    }),
    /GIT_FAILED/u,
  );
  const receipt = JSON.parse(readFileSync(path.join(owner, "candidate.checkout.json")));
  assert.equal(receipt.status, "FAIL");
  assert(receipt.commands.every((x) => x.cleanup.status === "PASS"));
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  const steps = workflow
    .split(/\n      - /u)
    .filter((step) => step.startsWith("name: Retain exact checkout receipt after every outcome\n"));
  assert.equal(steps.length, 4);
  for (const step of steps) {
    assert.match(step, /always\(\) && hashFiles\('candidate\.checkout\.json'\) != ''/u);
    assert.match(step, /path: candidate\.checkout\.json/u);
    assert.match(step, /if-no-files-found: error/u);
    assert.doesNotMatch(step, /success\(\)|conclusion ==/u);
  }
});
