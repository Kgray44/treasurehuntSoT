// Test data only. Import immutable blob payloads without importing history,
// refs, trees, grants or reviews. The selected checkout intentionally excludes
// historical unit tests and controller implementations from runtime readers.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const fixture = JSON.parse(readFileSync(new URL("./historical-reader-blobs.json", import.meta.url)));
const pack = Buffer.from(fixture.packBase64, "base64");
assert.equal(fixture.version, 1);
assert.equal(fixture.rawBytes, 376970);
assert.equal(fixture.origins.length, 32);
assert.equal(
  createHash("sha256")
    .update(
      fixture.origins
        .map((value) => `${value.revision}:${value.path}:${value.sha}`)
        .sort()
        .join("\n") + "\n",
    )
    .digest("hex"),
  "3c434f3fe45d4ab0bbf9f620426f51ea861474ca0ed700ab4edd8487de2ab040",
);
assert.equal(fixture.packSha256, "36be0bca3bddeb464cecc110ef16befe48339c63aa841ec29a1f634fa68660b2");
assert(pack.length < 128 * 1024);
assert.equal(fixture.objects.length, 29);
assert.equal(
  createHash("sha256").update(pack).digest("hex"),
  "36be0bca3bddeb464cecc110ef16befe48339c63aa841ec29a1f634fa68660b2",
);
const git = (args, input) =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
const indexed = git(["index-pack", "--stdin"], pack).trim();
assert.match(indexed, /^pack\s+[a-f0-9]{40}$/u);
const packId = indexed.split(/\s+/u)[1];
const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
const actual = git(["verify-pack", "-v", `${common}/objects/pack/pack-${packId}.idx`])
  .split(/\r?\n/u)
  .filter((row) => /^[a-f0-9]{40} /u.test(row));
assert.equal(actual.length, fixture.objects.length);
assert(actual.every((row) => row.split(" ")[1] === "blob"));
assert.deepEqual(actual.map((row) => row.split(" ")[0]).sort(), fixture.objects);
const sizes = git(["cat-file", "--batch-check"], fixture.objects.join("\n") + "\n")
  .trim()
  .split(/\r?\n/u);
assert.equal(
  sizes.reduce((bytes, row) => bytes + Number(row.split(/\s+/u)[2]), 0),
  fixture.rawBytes,
);
for (const origin of fixture.origins)
  assert.equal(git(["rev-parse", `${origin.revision}:${origin.path}`]).trim(), origin.sha);
