import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectedCheckout } from "../../scripts/sounding-line/experience-selected-checkout.mjs";
const profilePath = "scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
const git = (root, args, input) =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
const objectId = (root, revision, file) => git(root, ["rev-parse", `${revision}:${file}`]).trim();
for (const scenario of ["cold-valid", "altered-transport", "historical-reader-preserved", "absent-certificate-blob"])
  test(`inert real certificate ancestry: ${scenario}`, async (t) => {
    const owner = mkdtempSync(path.join(tmpdir(), "documentation-certificate-"));
    t.after(() => rmSync(owner, { recursive: true, force: true }));
    const seed = path.join(owner, "seed");
    mkdirSync(seed);
    git(seed, ["init", "-qb", "main"]);
    git(seed, ["config", "user.name", "Inert certificate fixture"]);
    git(seed, ["config", "user.email", "fixture@example.invalid"]);
    git(seed, ["config", "uploadpack.allowFilter", "true"]);
    git(seed, ["config", "uploadpack.allowAnySHA1InWant", "true"]);
    const put = (file, bytes) => {
      mkdirSync(path.dirname(path.join(seed, file)), { recursive: true });
      writeFileSync(path.join(seed, file), bytes);
    };
    put("src/stable.ts", "export const stable=1;\n");
    put("Development_Docs/archive.png", Buffer.alloc(65536, 17));
    put("testing/contracts.json", '{"contracts":[]}\n');
    put("testing/product-experience-exceptions.json", '{"exceptions":[]}\n');
    git(seed, ["add", "."]);
    git(seed, ["commit", "-qm", "inert reader anchor"]);
    const anchor = git(seed, ["rev-parse", "HEAD"]).trim();
    let bootstrap = readFileSync(
      new URL("../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs", import.meta.url),
      "utf8",
    );
    bootstrap = bootstrap
      .replace(
        /^export const DOCUMENTATION_CHECKOUT_ANCHOR = "[a-f0-9]{40}";$/mu,
        `export const DOCUMENTATION_CHECKOUT_ANCHOR = "${anchor}";`,
      )
      .replace(
        /^export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "(?:PENDING|[a-f0-9]{40})";$/mu,
        'export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";',
      )
      .replace(
        /^export const DOCUMENTATION_CHECKOUT_MODE = "(?:SHADOW|ACTIVE)";$/mu,
        'export const DOCUMENTATION_CHECKOUT_MODE = "SHADOW";',
      );
    put(profilePath, bootstrap);
    put(".github/workflows/sounding-line-ordinary.yml", "# reviewed inert transport\n");
    put("src/only-in-certificate.ts", "export const historicalReader='retained only when explicitly requested';\n");
    git(seed, ["add", "."]);
    git(seed, ["commit", "-qm", "inert immutable reviewed bootstrap"]);
    const certificate = git(seed, ["rev-parse", "HEAD"]).trim(),
      certificateBlob = objectId(seed, certificate, profilePath),
      historicalBlob = objectId(seed, certificate, "src/only-in-certificate.ts");
    const installed = bootstrap.replace(
      /^export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";$/mu,
      `export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "${certificate}";`,
    );
    put(profilePath, installed);
    git(seed, ["rm", "src/only-in-certificate.ts"]);
    if (scenario === "altered-transport")
      put(".github/workflows/sounding-line-ordinary.yml", "# arbitrary later transport bytes\n");
    git(seed, ["add", "."]);
    git(seed, ["commit", "-qm", "inert protected base with fixed certificate literal"]);
    const baseSha = git(seed, ["rev-parse", "HEAD"]).trim();
    put("Development_Docs/new.md", "# inert candidate\n");
    git(seed, ["add", "."]);
    git(seed, ["commit", "-qm", "inert documented candidate"]);
    const candidateSha = git(seed, ["rev-parse", "HEAD"]).trim();
    const authority = path.join(owner, "protected-profile.mjs");
    writeFileSync(authority, installed);
    const module = await import(pathToFileURL(authority).href);
    if (scenario === "absent-certificate-blob") {
      const loose = path.join(seed, ".git/objects", certificateBlob.slice(0, 2), certificateBlob.slice(2));
      assert(existsSync(loose));
      unlinkSync(loose);
    }
    const root = path.join(owner, "candidate");
    let missingBefore = false;
    const options = {
      root,
      remote: pathToFileURL(seed).href,
      baseSha,
      candidateSha,
      roots: [],
      readerRevisions: scenario === "historical-reader-preserved" ? [certificate] : [],
      readerObjects: [],
      budgetMs: 120000,
      stallBudgetMs: 60000,
      progress: false,
      signal: t.signal,
      preservation: async () => ({ preservationPins: 0, historicalManifestPinsRetained: [] }),
      selectReadSet: async (context) => {
        missingBefore = (await context.command(["rev-list", "--objects", "--missing=print", candidateSha]))
          .split(/\r?\n/u)
          .includes(`?${certificateBlob}`);
        assert(missingBefore, "certificate must be absent after real blob:none transport");
        const result = await module.documentationCheckoutReadSet({ ...context, baseSha, candidateSha, prNumber: 819 });
        return { ...result, applied: result.proposal.profile === "DOCUMENTATION_ONLY_SOURCE_BOUND_V1" };
      },
    };
    if (scenario === "absent-certificate-blob") {
      await assert.rejects(selectedCheckout(options), /GIT_FAILED/u);
      const failure = JSON.parse(readFileSync(path.join(owner, "candidate.checkout.json")));
      assert.equal(failure.status, "FAIL");
      assert(failure.commands.some((command) => command.args.includes(certificateBlob)));
      assert(failure.commands.every((command) => command.cleanup.status === "PASS"));
      assert.equal(existsSync(path.join(root, "Development_Docs/archive.png")), false);
      return;
    }
    const receipt = await selectedCheckout(options);
    assert.equal(receipt.status, "PASS");
    assert(missingBefore);
    assert.equal(receipt.lateGitTransport, "DISABLED");
    assert.equal(git(root, ["cat-file", "-t", certificateBlob]).trim(), "blob");
    assert.equal(readFileSync(path.join(root, "Development_Docs/new.md"), "utf8"), "# inert candidate\n");
    const closure = JSON.parse(readFileSync(path.join(root, ".git/selected-required-objects.json")));
    assert(closure.objects.some((object) => object.sha === certificateBlob && object.type === "blob"));
    if (scenario === "altered-transport") {
      assert.equal(receipt.readSet.applied, false);
      assert.equal(receipt.readSet.reason, "REVIEWED_TRANSPORT_SOURCE_CHANGED");
      assert(existsSync(path.join(root, "Development_Docs/archive.png")));
    } else {
      assert.equal(receipt.readSet.applied, true);
      assert.equal(existsSync(path.join(root, "Development_Docs/archive.png")), false);
    }
    if (scenario === "historical-reader-preserved")
      assert.equal(git(root, ["cat-file", "-t", historicalBlob]).trim(), "blob");
    else assert.throws(() => git(root, ["cat-file", "-t", historicalBlob]));
  });
