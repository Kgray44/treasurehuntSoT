import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { selectedCheckout } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
import {
  documentationCheckoutProposal,
  probeDocumentationCustody,
} from "../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
const git = (root, args, input, encoding = "utf8") =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
const entries = (value) =>
  value
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const tab = row.indexOf("\t"),
        [mode, type, sha] = row.slice(0, tab).split(" ");
      return { path: row.slice(tab + 1), mode, type, sha };
    });
test("inert full versus selected transport retains exact tree/ancestry/reader pins and excludes only proven payloads with transport locked", async (t) => {
  const owner = mkdtempSync(path.join(tmpdir(), "ordinary-doc-transport-"));
  t.after(() => rmSync(owner, { recursive: true, force: true }));
  const seed = path.join(owner, "seed");
  mkdirSync(seed);
  git(seed, ["init", "-qb", "main"]);
  git(seed, ["config", "user.name", "Inert selected-read-set fixture"]);
  git(seed, ["config", "user.email", "fixture@example.invalid"]);
  git(seed, ["config", "uploadpack.allowFilter", "true"]);
  git(seed, ["config", "uploadpack.allowAnySHA1InWant", "true"]);
  const put = (file, bytes) => {
    mkdirSync(path.dirname(path.join(seed, file)), { recursive: true });
    writeFileSync(path.join(seed, file), bytes);
  };
  put("unread-history.bin", Buffer.alloc(32768, 47));
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert ancestor"]);
  const ancestor = git(seed, ["rev-parse", "HEAD"]).trim();
  git(seed, ["rm", "unread-history.bin"]);
  put("src/example.ts", "export const value=1;\n");
  put("testing/contracts.json", '{"contracts":[]}\n');
  put(
    "testing/product-experience-exceptions.json",
    readFileSync(new URL("../../testing/product-experience-exceptions.json", import.meta.url)),
  );
  put(
    "scripts/sounding-line/experience-current-r26.mjs",
    "// Inert presence marker; executed authority remains outside this fixture.\n",
  );
  put(".gitattributes", "* -text\n");
  put("public/required-runtime.png", Buffer.alloc(8192, 11));
  put("tests/required-fixture.zip", Buffer.alloc(4096, 19));
  put("Development_Docs/.next-keep/preserve.png", Buffer.from("generated-directory-shape"));
  const media = [
    "Development_Docs/old [set]/frame #! Δ.png",
    "Development_Docs/old [set]/trace.zip",
    "Development_Docs/old [set]/recording.webm",
  ];
  media.forEach((file, index) => put(file, Buffer.alloc(32768 + index * 16384, 91 + index)));
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert base"]);
  const base = git(seed, ["rev-parse", "HEAD"]).trim(),
    pin = git(seed, ["rev-parse", `${base}:${media[0]}`]).trim();
  put("Development_Docs/incident.md", "# Inert documented candidate\n");
  git(seed, ["add", "."]);
  git(seed, ["commit", "-qm", "inert candidate"]);
  const candidate = git(seed, ["rev-parse", "HEAD"]).trim();
  const options = {
    remote: pathToFileURL(seed).href,
    baseSha: base,
    candidateSha: candidate,
    roots: [ancestor],
    readerRevisions: [],
    readerObjects: [{ sha: pin, type: "blob" }],
    budgetMs: 120000,
    stallBudgetMs: 60000,
    progress: false,
    preservation: async () => ({ preservationPins: 0, historicalManifestPinsRetained: [] }),
  };
  const fullRoot = path.join(owner, "full"),
    selectedRoot = path.join(owner, "selected");
  const full = await selectedCheckout({ ...options, root: fullRoot });
  let proposed;
  const selected = await selectedCheckout({
    ...options,
    root: selectedRoot,
    selectReadSet: async ({ command }) => {
      const baseline = entries(await command(["ls-tree", "-rz", base])),
        current = entries(await command(["ls-tree", "-rz", candidate]));
      proposed = documentationCheckoutProposal({
        baseEntries: baseline,
        candidateEntries: current,
        anchorEntries: baseline,
        prNumber: 819,
      });
      assert.equal(proposed.profile, "DOCUMENTATION_ONLY_SOURCE_BOUND_V1");
      return { applied: true, proposal: proposed };
    },
  });
  assert.equal(full.status, "PASS");
  assert.equal(selected.status, "PASS");
  assert.equal(selected.readSet.applied, true);
  assert.equal(git(fullRoot, ["ls-tree", "-rz", candidate]), git(selectedRoot, ["ls-tree", "-rz", candidate]));
  assert.equal(git(selectedRoot, ["rev-parse", "--is-shallow-repository"]).trim(), "false");
  git(selectedRoot, ["merge-base", "--is-ancestor", ancestor, candidate]);
  const omitted = new Set(proposed.omissions.map((x) => x.path));
  assert.deepEqual([...omitted].sort(), media.sort());
  for (const entry of entries(git(fullRoot, ["ls-tree", "-rz", candidate]))) {
    const a = path.join(fullRoot, entry.path),
      b = path.join(selectedRoot, entry.path);
    assert(existsSync(a));
    if (omitted.has(entry.path)) assert.equal(existsSync(b), false, entry.path);
    else assert(readFileSync(a).equals(readFileSync(b)), entry.path);
  }
  assert.equal(git(selectedRoot, ["cat-file", "-t", pin]).trim(), "blob");
  assert.throws(() => git(selectedRoot, ["show", `${candidate}:Development_Docs/old [set]/trace.zip`]));
  assert.equal(selected.lateGitTransport, "DISABLED");
  assert(selected.verified.requiredBlobBytes < full.verified.requiredBlobBytes);
  assert.equal(git(selectedRoot, ["status", "--porcelain", "--untracked-files=no"]).trim(), "");
  const custodyRoot = path.join(owner, "custody");
  const custody = await selectedCheckout({
    ...options,
    root: custodyRoot,
    selectReadSet: async ({ command, readOnlyCommand, root, git: executable }) => {
      const baseline = entries(await command(["ls-tree", "-rz", base])),
        current = entries(await command(["ls-tree", "-rz", candidate]));
      const proposal = documentationCheckoutProposal({
        baseEntries: baseline,
        candidateEntries: current,
        anchorEntries: baseline,
        prNumber: 819,
        purpose: "campaign-custody",
      });
      assert.equal(proposal.profile, "DOCUMENTATION_CUSTODY_METADATA_V1");
      const checked = await probeDocumentationCustody({
        proposal,
        command,
        readOnlyCommand,
        root,
        git: executable,
        baseSha: base,
        candidateSha: candidate,
        prNumber: 819,
        baseEntries: baseline,
        candidateEntries: current,
      });
      assert.equal(checked.proposal.profile, "DOCUMENTATION_CUSTODY_METADATA_V1");
      return { applied: true, ...checked };
    },
  });
  assert.equal(custody.status, "PASS");
  assert.equal(custody.lateGitTransport, "DISABLED");
  assert.equal(git(custodyRoot, ["ls-tree", "-rz", candidate]), git(fullRoot, ["ls-tree", "-rz", candidate]));
  git(custodyRoot, ["merge-base", "--is-ancestor", ancestor, candidate]);
  for (const file of ["testing/contracts.json", "testing/product-experience-exceptions.json", ".gitattributes"])
    assert(readFileSync(path.join(fullRoot, file)).equals(readFileSync(path.join(custodyRoot, file))));
  assert.equal(existsSync(path.join(custodyRoot, "src/example.ts")), false);
  assert.throws(() => git(custodyRoot, ["cat-file", "-t", pin]));
  assert(custody.verified.requiredBlobBytes < selected.verified.requiredBlobBytes);
  const eventFile = path.join(owner, "event.json");
  writeFileSync(eventFile, JSON.stringify({ inputs: { pr_number: "819", base_sha: base, candidate_sha: candidate } }));
  const reserve = (workspace, label, eventPath = eventFile, subject = candidate) => {
    const output = path.join(owner, `${label}.output`);
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("../../scripts/sounding-line/experience-exception.mjs", import.meta.url)),
        "--operation",
        "reserve",
        "--workspace",
        workspace,
        "--base",
        base,
        "--candidate",
        subject,
      ],
      {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          GH_TOKEN: "",
          GITHUB_TOKEN: "",
          GITHUB_SHA: base,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_OUTPUT: output,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return readFileSync(output, "utf8");
  };
  assert.equal(reserve(fullRoot, "full"), "campaign=false\n");
  assert.equal(reserve(custodyRoot, "custody"), "campaign=false\n");
  const positiveRoot = path.join(owner, "positive-full");
  const positive = await selectedCheckout({
    ...options,
    root: positiveRoot,
    selectReadSet: async ({ command, readOnlyCommand, root, git: executable }) => {
      const baseline = entries(await command(["ls-tree", "-rz", base])),
        current = entries(await command(["ls-tree", "-rz", candidate]));
      const proposal = documentationCheckoutProposal({
        baseEntries: baseline,
        candidateEntries: current,
        anchorEntries: baseline,
        prNumber: 819,
        purpose: "campaign-custody",
      });
      const checked = await probeDocumentationCustody({
        proposal,
        command,
        readOnlyCommand,
        root,
        git: executable,
        baseSha: base,
        candidateSha: candidate,
        prNumber: 721,
        baseEntries: baseline,
        candidateEntries: current,
      });
      assert.equal(checked.custodyProbe.campaign, true);
      assert.equal(checked.proposal.profile, "FULL_SNAPSHOT");
      return { applied: false, ...checked };
    },
  });
  assert.equal(positive.readSet.reason, "CAMPAIGN_REQUIRES_FULL_RESERVATION_READERS");
  assert.equal(positive.verified.requiredBlobBytes, full.verified.requiredBlobBytes);
  for (const file of media)
    assert(readFileSync(path.join(positiveRoot, file)).equals(readFileSync(path.join(fullRoot, file))));
  const positiveEvent = path.join(owner, "positive-event.json");
  writeFileSync(
    positiveEvent,
    JSON.stringify({ inputs: { pr_number: "721", base_sha: base, candidate_sha: candidate } }),
  );
  const denied = (workspace, label, eventPath, subject = candidate) => {
    try {
      reserve(workspace, label, eventPath, subject);
      assert.fail("Original reservation must retain its denial");
    } catch (error) {
      const code = error.stderr?.toString().match(/PRODUCT_EXPERIENCE_(?:EXCEPTION|CURRENT_ADMISSION)_[A-Z_]+/u)?.[0];
      assert(code, error.message);
      return code;
    }
  };
  assert.equal(
    denied(fullRoot, "full-positive", positiveEvent),
    denied(positiveRoot, "fallback-positive", positiveEvent),
  );
  put("testing/contracts.json", '{"contracts":[{"id":"crossdeck.refit.companion"}]}\n');
  git(seed, ["add", "testing/contracts.json"]);
  git(seed, ["commit", "-qm", "inert copied campaign signal"]);
  const copied = git(seed, ["rev-parse", "HEAD"]).trim(),
    copiedRoot = path.join(owner, "copied-full");
  const { campaignComparison, CROSSDECK_CAMPAIGN } = await import(
    "../../scripts/sounding-line/experience-exception.mjs"
  );
  assert.equal(
    campaignComparison({ root: seed, baseSha: base, candidateSha: copied, prNumber: 819 })(CROSSDECK_CAMPAIGN),
    true,
    "copied contracts are a real positive campaign signal on the wrong PR",
  );
  const copiedReceipt = await selectedCheckout({
    ...options,
    root: copiedRoot,
    candidateSha: copied,
    selectReadSet: async ({ command }) => {
      const baseline = entries(await command(["ls-tree", "-rz", base])),
        current = entries(await command(["ls-tree", "-rz", copied]));
      const proposal = documentationCheckoutProposal({
        baseEntries: baseline,
        candidateEntries: current,
        anchorEntries: baseline,
        prNumber: 819,
        purpose: "campaign-custody",
      });
      assert.equal(proposal.profile, "FULL_SNAPSHOT");
      return { applied: false, proposal };
    },
  });
  assert.equal(copiedReceipt.readSet.applied, false);
  for (const file of media) assert(existsSync(path.join(copiedRoot, file)));
  const copiedEvent = path.join(owner, "copied-event.json");
  writeFileSync(copiedEvent, JSON.stringify({ inputs: { pr_number: "819", base_sha: base, candidate_sha: copied } }));
  assert.equal(
    denied(seed, "seed-copied", copiedEvent, copied),
    denied(copiedRoot, "fallback-copied", copiedEvent, copied),
  );
});
