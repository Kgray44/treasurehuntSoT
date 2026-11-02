import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createPreparationCapsuleShadow } from "../../scripts/sounding-line/preparation-capsule-shadow.mjs";
import {
  preparationPublisherContext,
  PREPARATION_SHADOW_WORKFLOW,
} from "../../scripts/sounding-line/preparation-publisher-shadow.mjs";
import {
  readAttestationArchiveShadow,
  readPreparationArchiveMemberShadow,
} from "../../scripts/sounding-line/attestation-archive-shadow.mjs";
import {
  restorePreparationArchiveShadow,
  inspectPreparationArchiveRestoreShadow,
} from "../../scripts/sounding-line/preparation-archive-shadow.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fixture(t, size = 1024, attack = "") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-archive-shadow-"));
  t.after(() => {
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  });
  const source = path.join(root, "source"),
    parent = path.join(root, "capsules"),
    directory = path.join(root, "restores");
  for (const name of [source, parent, directory]) fs.mkdirSync(name);
  fs.writeFileSync(path.join(source, "index.js"), Buffer.alloc(size, 120));
  const capsule = createPreparationCapsuleShadow({ source, directory: parent, layer: "prisma-client" });
  assert.equal(capsule.status, "PASS");
  const context = preparationPublisherContext({
    repository: "Kgray44/treasurehuntSoT",
    repositoryId: 1303074266,
    actor: "Kgray44",
    actorId: 64373011,
    ref: "refs/heads/main",
    event: "workflow_dispatch",
    workflowRef: `Kgray44/treasurehuntSoT/${PREPARATION_SHADOW_WORKFLOW}@refs/heads/main`,
    workflowSha: "a".repeat(40),
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    runId: 1,
    attempt: 1,
    jobKey: "publisher",
    readerDigest: "c".repeat(64),
    nonce: "d".repeat(64),
  });
  const publisher = {
    kind: "PREPARATION_SOURCE_CAPSULE_SHADOW",
    version: 1,
    context,
    identity: { inputFingerprint: "e".repeat(64) },
    capsule: {
      manifestSha256: capsule.manifestSha256,
      initialSha256: hash(fs.readFileSync(path.join(capsule.root, "initial.json"))),
      inventoryDigest: capsule.inventoryDigest,
      byteLength: capsule.bytes,
      fileCount: capsule.files,
    },
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  };
  fs.writeFileSync(path.join(capsule.root, "publisher.json"), JSON.stringify(publisher));
  const filename = path.join(root, "capsule.zip");
  // Independent standard-library ZIP producer; no parser code or authority
  // fixtures are imported into its implementation.
  execFileSync(
    "python",
    [
      "-c",
      `import os,sys,zipfile,stat
src,dst,attack=sys.argv[1:]
with zipfile.ZipFile(dst,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for folder,dirs,files in os.walk(src):
  dirs.sort()
  for name in sorted(files):
   full=os.path.join(folder,name); rel=os.path.relpath(full,src).replace(os.sep,'/')
   if attack=='corrupt' and rel=='payload/index.js': z.writestr(rel,b'corrupted payload')
   else: z.write(full,rel)
 if attack=='extra': z.writestr('payload/unlisted.js',b'extra')
 if attack=='directory-data': z.writestr('payload/',b'unaccounted directory data')
 if attack=='empty-directory': z.writestr(zipfile.ZipInfo('payload/'),b'')
 if attack=='traversal': z.writestr('../outside.txt',b'outside')
 if attack=='symlink':
  entry=zipfile.ZipInfo('payload/alias.js');entry.create_system=3;entry.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(entry,b'index.js')
`,
      capsule.root,
      filename,
      attack,
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 65536 },
  );
  const zipBytes = fs.readFileSync(filename);
  const input = {
    filename,
    expectedBytes: zipBytes.length,
    expectedSha256: hash(zipBytes),
    manifestSha256: capsule.manifestSha256,
    inventoryDigest: capsule.inventoryDigest,
    directory,
  };
  return { root, source, capsule, filename, input };
}
test("complete capsule ZIP restores exact bytes and original metadata without granting execution or reuse", (t) => {
  const f = fixture(t, 9 * 1024 ** 2),
    result = restorePreparationArchiveShadow(f.input);
  assert.equal(result.status, "PASS");
  const value = inspectPreparationArchiveRestoreShadow(result);
  assert(value);
  assert.equal(value.fileCount, 1);
  assert.equal(value.byteLength, 9 * 1024 ** 2);
  assert.equal(value.inventoryDigest, f.capsule.inventoryDigest);
  assert.equal(value.publisherContext.sourceCommit, "a".repeat(40));
  assert.equal(value.reuseAuthorized, false);
  assert.equal(value.certificate, "NOT_ISSUED");
  assert.deepEqual(
    fs.readFileSync(path.join(value.payload, "index.js")),
    fs.readFileSync(path.join(f.source, "index.js")),
  );
  for (const name of ["manifest.json", "initial.json", "publisher.json"])
    assert.deepEqual(fs.readFileSync(path.join(result.root, name)), fs.readFileSync(path.join(f.capsule.root, name)));
  assert.equal(inspectPreparationArchiveRestoreShadow(JSON.parse(JSON.stringify(result))), null);
  assert.throws(() => readAttestationArchiveShadow({ ...f.input, memberNames: ["payload/index.js"] }), /MEMBER_BOUND/u);
  assert.equal(
    readPreparationArchiveMemberShadow({ ...f.input, memberNames: ["payload/index.js"] }).bytes.length,
    9 * 1024 ** 2,
  );
  fs.writeFileSync(path.join(value.payload, "index.js"), "late corruption");
  assert.equal(inspectPreparationArchiveRestoreShadow(result), null);
});
test("extra, corrupt, traversing and non-file ZIP members leave failed custody and never materialize outside the private prefix", (t) => {
  for (const attack of ["extra", "corrupt", "traversal", "symlink", "directory-data"]) {
    const f = fixture(t, 1024, attack),
      result = restorePreparationArchiveShadow(f.input);
    assert.equal(result.status, "FAIL", attack);
    assert(result.originalError, attack);
    assert.equal(inspectPreparationArchiveRestoreShadow(result), null);
    assert(fs.existsSync(path.join(result.root, "restore.initial.json")));
    assert(fs.existsSync(path.join(result.root, "restore.failure.json")));
    assert(!fs.existsSync(path.join(f.root, "outside.txt")));
  }
});
test("an optional explicit empty payload directory has zero bytes and does not hide membership", (t) => {
  const f = fixture(t, 1024, "empty-directory"),
    result = restorePreparationArchiveShadow(f.input);
  assert.equal(result.status, "PASS");
  assert(inspectPreparationArchiveRestoreShadow(result));
});
test("original manifest identity, complete ZIP hash and exact retained metadata cannot be substituted", (t) => {
  for (const field of ["manifestSha256", "inventoryDigest", "expectedSha256"]) {
    const f = fixture(t),
      result = restorePreparationArchiveShadow({ ...f.input, [field]: "0".repeat(64) });
    assert.equal(result.status, "FAIL");
    assert(result.originalError);
  }
  const f = fixture(t),
    result = restorePreparationArchiveShadow(f.input);
  assert.equal(result.status, "PASS");
  fs.writeFileSync(path.join(result.root, "publisher.json"), "{}");
  assert.equal(inspectPreparationArchiveRestoreShadow(result), null);
});
test("copy and close failures retain both original exceptions and failed prefixes without executing error getters", (t) => {
  const f = fixture(t),
    primary = Error("original copy failure"),
    secondary = Error("original close failure");
  let getterCalls = 0;
  Object.defineProperty(primary, "message", {
    get() {
      getterCalls++;
      throw Error("must not execute error getter");
    },
  });
  const originalOpen = fs.openSync,
    originalWrite = fs.writeSync,
    originalClose = fs.closeSync,
    held = new Set();
  fs.openSync = (...args) => {
    const fd = originalOpen(...args);
    if (
      typeof args[0] === "string" &&
      args[0].includes("preparation-restore-") &&
      args[0].endsWith("index.js") &&
      typeof args[1] === "number" &&
      args[1] & fs.constants.O_WRONLY
    )
      held.add(fd);
    return fd;
  };
  fs.writeSync = (...args) => {
    if (held.has(args[0])) throw primary;
    return originalWrite(...args);
  };
  fs.closeSync = (fd) => {
    const fail = held.delete(fd);
    originalClose(fd);
    if (fail) throw secondary;
  };
  let result;
  try {
    result = restorePreparationArchiveShadow(f.input);
  } finally {
    fs.openSync = originalOpen;
    fs.writeSync = originalWrite;
    fs.closeSync = originalClose;
  }
  assert.equal(result.status, "FAIL");
  assert(result.originalError instanceof AggregateError);
  assert.equal(result.originalError.errors[0], primary);
  assert.equal(result.originalError.errors[1], secondary);
  assert.equal(getterCalls, 0);
  assert(fs.existsSync(path.join(result.root, "restore.failure.json")));
});
