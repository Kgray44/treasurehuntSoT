import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const source = fileURLToPath(new URL("../../", import.meta.url));
const engineering = "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025";
const git = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
test("sparse authority has byte-equivalent actual ordinary and finite reader closures with transport disabled", async (t) => {
  const owned = await mkdtemp(path.join(tmpdir(), "ordinary-authority-"));
  t.after(() => rm(owned, { recursive: true, force: true }));
  const seed = path.join(owned, "seed"),
    full = path.join(owned, "full"),
    sparse = path.join(owned, "sparse");
  await mkdir(seed);
  const copied = [];
  await copyFile(path.join(source, ".nvmrc"), path.join(seed, ".nvmrc"));
  copied.push(".nvmrc");
  for (const directory of ["scripts/sounding-line", "testing", engineering]) {
    await mkdir(path.join(seed, directory), { recursive: true });
    for (const entry of await readdir(path.join(source, directory), { withFileTypes: true })) {
      if (!entry.isFile() || (directory === "scripts/sounding-line" && !/\.(?:mjs|ps1|py)$/u.test(entry.name)))
        continue;
      const file = `${directory}/${entry.name}`;
      await copyFile(path.join(source, file), path.join(seed, file));
      copied.push(file);
    }
  }
  await mkdir(path.join(seed, "public"));
  await writeFile(
    path.join(seed, "public/excluded-media.bin"),
    Buffer.from(Array.from({ length: 1048576 }, (_, i) => (i * 73 + 19) % 251)),
  );
  git(seed, "init", "-qb", "main");
  git(seed, "config", "user.name", "Authority fixture");
  git(seed, "config", "user.email", "fixture@example.invalid");
  git(seed, "config", "uploadpack.allowFilter", "true");
  git(seed, "config", "uploadpack.allowAnySHA1InWant", "true");
  git(seed, "add", ".");
  git(seed, "commit", "-qm", "actual authority closure and synthetic media");
  const base = git(seed, "rev-parse", "HEAD"),
    blob = git(seed, "rev-parse", "HEAD:public/excluded-media.bin");
  const remote = pathToFileURL(seed).href;
  let began = performance.now();
  git(owned, "clone", "--depth=1", "--no-tags", remote, full);
  const fullMs = performance.now() - began;
  await mkdir(sparse);
  git(sparse, "init", "-q");
  git(sparse, "remote", "add", "origin", remote);
  began = performance.now();
  git(sparse, "fetch", "--filter=blob:none", "--depth=1", "--no-tags", "origin", base);
  git(sparse, "sparse-checkout", "set", "scripts", "testing", engineering);
  git(sparse, "checkout", "--detach", "FETCH_HEAD");
  const sparseMs = performance.now() - began;
  git(sparse, "config", "remote.origin.promisor", "false");
  git(sparse, "config", "protocol.allow", "never");
  git(sparse, "config", "protocol.file.allow", "never");
  assert(!existsSync(path.join(sparse, "public/excluded-media.bin")));
  assert.throws(() => git(sparse, "cat-file", "-e", blob));
  for (const file of copied)
    assert.deepEqual(await readFile(path.join(sparse, file)), await readFile(path.join(full, file)), file);
  const event = path.join(owned, "event.json");
  await writeFile(event, JSON.stringify({ inputs: { pr_number: "776", base_sha: base, candidate_sha: base } }));
  const entry = `
    import {pathToFileURL} from 'node:url';
    import {pr776CheckoutProfile} from './scripts/sounding-line/experience-pr776-checkout-profile.mjs';
    import {verificationPreflight} from './scripts/sounding-line/verification-preflight.mjs';
    await import('./scripts/sounding-line/ordinary.mjs');
    await import('./scripts/sounding-line/experience-prepare.mjs');
    const profile=pr776CheckoutProfile({authorityRoot:process.cwd(),baseSha:process.env.GITHUB_SHA,candidateSha:process.env.GITHUB_SHA});
    const proof=await verificationPreflight({root:process.cwd(),authorityRoot:process.cwd(),baseSha:process.env.GITHUB_SHA,candidateSha:process.env.GITHUB_SHA});
    console.log(JSON.stringify({roots:profile.roots,readers:profile.readerPaths,controllerDigest:proof.controllerDigest,policyDigest:proof.policyDigest}));`;
  const results = [full, sparse].map((cwd) =>
    JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", entry], {
        cwd,
        encoding: "utf8",
        timeout: 30000,
        env: {
          ...process.env,
          GIT_NO_LAZY_FETCH: "1",
          GITHUB_SHA: base,
          GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
          GITHUB_REF: "refs/heads/main",
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_EVENT_PATH: event,
        },
      }),
    ),
  );
  assert.deepEqual(results[1], results[0]);
  console.log(
    JSON.stringify({
      namespace: "SOUNDING_LINE_AUTHORITY_CHECKOUT_PARITY",
      fixtureOnly: true,
      copiedFiles: copied.length,
      fullMs: Math.round(fullMs),
      sparseMs: Math.round(sparseMs),
      omittedSyntheticMediaBytes: 1048576,
      qualification: false,
    }),
  );
});
