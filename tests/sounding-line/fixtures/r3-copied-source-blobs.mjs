// Fixed test data only. This pack supplies the copied-source attack's complete
// historical blob closure, never historical trees, commits, refs or authority.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const repository = fileURLToPath(new URL("../../..", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = Object.freeze({
  revision: "bb69eed0cc930018bb4fe9e9f662a60ffa94dc11",
  sourceTree: "0a455ccc3653b4fc672fa038b849f0392889b007",
  entriesSha256: "47e4a71c5daa170d6df2c9b5c97417a081bd49f0728bcfd3ff809cfae3b7390b",
  packSha256: "52c5cac748301601ef3921140045cfd3cb1abf17b5bd0024f45e8d9e4e37a915",
  rawBytes: 11559099,
  packBytes: 3156669,
  count: 1750,
});
const entriesBytes = (entries) => Buffer.from(entries.map((e) => `${e.mode} ${e.type} ${e.oid}\t${e.path}\0`).join(""));

export function readR3CopiedSourceFixture() {
  const file = new URL("./r3-copied-source-blobs.json", import.meta.url);
  assert(fs.statSync(file).size <= 6 * 1024 * 1024);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function verifyR3CopiedSourceFixture(fixture, sourceEntries) {
  assert.equal(fixture.version, 1);
  for (const field of ["revision", "sourceTree", "entriesSha256", "packSha256", "rawBytes", "packBytes"])
    assert.equal(fixture[field], expected[field], field);
  assert.equal(fixture.entries.length, expected.count);
  assert.equal(fixture.objects.length, expected.count);
  for (const entry of fixture.entries) {
    assert.deepEqual(Object.keys(entry).sort(), ["mode", "oid", "path", "type"]);
    assert.equal(entry.type, "blob");
    assert.match(entry.mode, /^100(?:644|755)$/u);
    assert.match(entry.oid, /^[a-f0-9]{40}$/u);
    assert(entry.path.startsWith("src/") && !/[\t\r\n\0\\]/u.test(entry.path));
  }
  assert.equal(hash(entriesBytes(fixture.entries)), expected.entriesSha256);
  assert.deepEqual([...new Set(fixture.entries.map((entry) => entry.oid))].sort(), fixture.objects);
  if (sourceEntries) assert.equal(hash(entriesBytes(sourceEntries)), expected.entriesSha256);
  assert.equal(typeof fixture.packBase64, "string");
  assert(fixture.packBase64.length <= 6 * 1024 * 1024);
  const pack = Buffer.from(fixture.packBase64, "base64");
  assert.equal(pack.toString("base64"), fixture.packBase64);
  assert.equal(pack.length, expected.packBytes);
  assert.equal(hash(pack), expected.packSha256);
  assert.equal(pack.subarray(0, 4).toString(), "PACK");
  assert.equal(pack.readUInt32BE(4), 2);
  assert.equal(pack.readUInt32BE(8), expected.count);
  return pack;
}

export function importR3CopiedSourceBlobs(root, sourceEntries) {
  assert.equal(path.dirname(path.resolve(root)), path.join(repository, "artifacts"));
  assert(path.basename(root).startsWith("r3-copied-"));
  assert.equal(fs.realpathSync(root), path.resolve(root));
  assert.equal(fs.existsSync(path.join(root, ".git/objects/info/alternates")), false);
  const fixture = readR3CopiedSourceFixture();
  const pack = verifyR3CopiedSourceFixture(fixture, sourceEntries);
  const git = (args, input) =>
    execFileSync("git", ["-c", "protocol.allow=never", ...args], {
      cwd: root,
      input,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 15000,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["pipe", "pipe", "pipe"],
    });
  const indexed = git(["index-pack", "--stdin"], pack).trim();
  assert.match(indexed, /^pack\s+[a-f0-9]{40}$/u);
  const packId = indexed.split(/\s+/u)[1];
  const rows = git(["verify-pack", "-v", path.join(root, ".git/objects/pack", `pack-${packId}.idx`)])
    .split(/\r?\n/u)
    .filter((row) => /^[a-f0-9]{40} /u.test(row));
  assert.equal(rows.length, expected.count);
  assert(rows.every((row) => row.split(" ")[1] === "blob"));
  assert.deepEqual(rows.map((row) => row.split(" ")[0]).sort(), fixture.objects);
  const metadata = git(["cat-file", "--batch-check"], fixture.objects.join("\n") + "\n")
    .trim()
    .split(/\r?\n/u);
  assert(metadata.every((row) => row.split(" ")[1] === "blob"));
  assert.equal(
    metadata.reduce((bytes, row) => bytes + Number(row.split(" ")[2]), 0),
    expected.rawBytes,
  );
  assert.equal(fs.existsSync(path.join(root, ".git/objects/info/alternates")), false);
}
