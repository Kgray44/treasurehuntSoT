import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  readArtifactRegistryArchive,
  ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM,
} from "../../scripts/sounding-line/artifact-registry-archive.mjs";

// Independent standard-library ZIP writer, synthetic bytes only. No extraction.
const fixture = (method = "deflate", descriptor = false, names = ["registry-v2.encrypted"], contentSize = null) =>
  execFileSync(
    process.platform === "win32" ? "python" : "python3",
    [
      "-c",
      `import sys,json,io,zipfile
p=json.load(sys.stdin)
class Stream(io.BytesIO):
 def seek(self,*a):
  if p['descriptor']: raise io.UnsupportedOperation()
  return super().seek(*a)
b=Stream()
with zipfile.ZipFile(b,'w',compression=zipfile.ZIP_DEFLATED if p['method']=='deflate' else zipfile.ZIP_STORED) as z:
 for name in p['names']: z.writestr(name,b'x'*p['contentSize'] if p['contentSize'] else b'inert synthetic encrypted-envelope transport fixture')
sys.stdout.buffer.write(b.getvalue())`,
    ],
    {
      input: JSON.stringify({ method, descriptor, names, contentSize }),
      maxBuffer: 65536,
      timeout: 15000,
      windowsHide: true,
    },
  );
const expected = Buffer.from("inert synthetic encrypted-envelope transport fixture");
test("bounded inflate rejects an oversized expansion and hidden compressed trailing data", () => {
  const oversized = fixture("deflate", false, undefined, 8 * 1024 * 1024 + 1);
  const largeCentral = oversized.readUInt32LE(oversized.length - 6);
  oversized.writeUInt32LE(expected.length, largeCentral + 24);
  oversized.writeUInt32LE(expected.length, 22);
  assert.throws(() => readArtifactRegistryArchive(oversized), /ARCHIVE_INVALID/u);
  const original = fixture(),
    central = original.readUInt32LE(original.length - 6);
  const hidden = Buffer.concat([original.subarray(0, central), Buffer.from([0]), original.subarray(central)]);
  hidden.writeUInt32LE(original.readUInt32LE(18) + 1, 18);
  hidden.writeUInt32LE(original.readUInt32LE(central + 20) + 1, central + 1 + 20);
  hidden.writeUInt32LE(central + 1, hidden.length - 6);
  assert.throws(() => readArtifactRegistryArchive(hidden), /ARCHIVE_INVALID/u);
});
for (const method of ["stored", "deflate"])
  for (const descriptor of [false, true])
    test(`independent ZIP fixture preserves exact registry bytes: ${method}, descriptor=${descriptor}`, () => {
      const archive = fixture(method, descriptor),
        actual = readArtifactRegistryArchive(archive);
      assert(actual.equals(expected));
      archive.fill(0);
      assert(actual.equals(expected));
    });

test("unknown, duplicate, traversing, prefixed and extra members are never registry evidence", () => {
  for (const names of [
    ["../registry-v2.encrypted"],
    ["folder/registry-v2.encrypted"],
    ["registry-v2.json"],
    ["registry-v2.encrypted", "extra"],
    ["registry-v2.encrypted", "registry-v2.encrypted"],
  ])
    assert.throws(() => readArtifactRegistryArchive(fixture("deflate", false, names)), /ARCHIVE_INVALID/u);
});

test("truncation, CRC/length disagreement, symlinks, encryption and unsupported encodings fail closed", () => {
  const original = fixture();
  const end = original.length - 22,
    central = original.readUInt32LE(end + 16);
  for (const change of [
    (b) => b.writeUInt32LE(0xdeadbeef, central + 16),
    (b) => b.writeUInt32LE(8 * 1024 * 1024 + 1, central + 24),
    (b) => b.writeUInt32LE(0xa0000000, central + 38),
    (b) => b.writeUInt16LE(1, central + 8),
    (b) => b.writeUInt16LE(12, central + 10),
    (b) => b.writeUInt16LE(1, end + 4),
    (b) => b.writeUInt32LE(1, central + 42),
    (b) => b.writeUInt32LE(1, 18),
    (b) => b.writeUInt16LE(0x800, 6),
  ]) {
    const bytes = Buffer.from(original);
    change(bytes);
    assert.throws(() => readArtifactRegistryArchive(bytes), /ARCHIVE_INVALID/u);
  }
  for (const bytes of [
    original.subarray(0, -1),
    Buffer.concat([original, Buffer.from([0])]),
    Buffer.alloc(ARTIFACT_REGISTRY_ARCHIVE_MAXIMUM + 1),
  ])
    assert.throws(() => readArtifactRegistryArchive(bytes), /ARCHIVE_INVALID/u);
});
