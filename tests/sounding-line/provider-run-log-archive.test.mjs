import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readOriginalEventStepLog } from "../../scripts/sounding-line/provider-run-log-archive.mjs";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/native-event-binding-41301367275.json", import.meta.url)));
// Independently produced stdlib ZIPs, including seekless descriptor framing.
const zip = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      String.raw`
import io,json,sys,zipfile,base64,warnings
warnings.filterwarnings('ignore',category=UserWarning)
f=json.load(sys.stdin); target=f['nativeMember']; log=bytes.fromhex(f['nativeLogHex'])
class Pipe(io.BytesIO):
 def seek(self,*args): raise io.UnsupportedOperation('pipe')
def pack(method=8,descriptor=False,body=log,sibling='other-step.txt',duplicate=False,missing=False):
 b=Pipe() if descriptor else io.BytesIO()
 with zipfile.ZipFile(b,'w',compression=method) as z:
  if not missing:z.writestr(target,body)
  z.writestr(target if duplicate else sibling,b'other provider step')
 return base64.b64encode(b.getvalue()).decode()
print(json.dumps({'store':pack(0),'deflate':pack(),'descriptor':pack(descriptor=True),'oversize':pack(body=b'x'*16385),'expansion':pack(body=b'x'*65536),'duplicate':pack(duplicate=True),'traversal':pack(sibling='../outside'),'directory':pack(sibling='directory/'),'missing':pack(missing=True)}))
`,
    ],
    { input: JSON.stringify(fixture), encoding: "utf8", maxBuffer: 512 * 1024, windowsHide: true },
  ),
);
const bytes = (name) => Buffer.from(zip[name], "base64");
const invalid = /SOUNDING_LINE_PROVIDER_RUN_LOG_ARCHIVE_INVALID/u;
const end = (archive) => archive.length - 22;
const central = (archive) => archive.readUInt32LE(end(archive) + 16);
const nextCentral = (archive, at) =>
  at + 46 + archive.readUInt16LE(at + 28) + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);

test("independent store, deflate and descriptor archives retain exact original native step bytes", () => {
  for (const type of ["store", "deflate", "descriptor"]) {
    const result = readOriginalEventStepLog(bytes(type));
    assert.equal(createHash("sha256").update(result).digest("hex"), fixture.nativeLogSha256);
    assert(result.equals(Buffer.from(fixture.nativeLogHex, "hex")));
  }
});
test("missing, duplicate, traversing, directory, oversize and zip-bomb members fail closed", () => {
  for (const type of ["missing", "duplicate", "traversal", "directory", "oversize", "expansion"])
    assert.throws(() => readOriginalEventStepLog(bytes(type)), invalid, type);
  const bomb = bytes("expansion"),
    at = central(bomb);
  bomb.writeUInt32LE(512, at + 24);
  bomb.writeUInt32LE(512, 22);
  assert.throws(() => readOriginalEventStepLog(bomb), invalid);
  const total = bytes("deflate"),
    sibling = nextCentral(total, central(total));
  total.writeUInt32LE(64 * 1024 * 1024, sibling + 24);
  assert.throws(() => readOriginalEventStepLog(total), invalid);
  assert.throws(() => readOriginalEventStepLog(Buffer.alloc(8 * 1024 * 1024 + 1)), invalid);
});
test("central/local disagreement, CRC damage, descriptors, extra bytes and aliases cannot change selection", () => {
  for (const change of [
    (b) => b.writeUInt16LE(1, central(b) + 8),
    (b) => b.writeUInt16LE(99, central(b) + 10),
    (b) => b.writeUInt32LE((0xa000 << 16) >>> 0, central(b) + 38),
    (b) => b.writeUInt16LE(1, central(b) + 34),
    (b) => b.writeUInt16LE(513, end(b) + 10),
    (b) => b.writeUInt16LE(1, end(b) + 4),
    (b) => b.writeUInt16LE(2, 6),
    (b) => b.writeUInt32LE(0, central(b) + 16),
    (b) => b.writeUInt16LE(1, 26),
    (b) => b.writeUInt32LE(0, nextCentral(b, central(b)) + 42),
    (b) => (b[b.readUInt16LE(26) + 30] ^= 0xff),
  ]) {
    const archive = bytes("store");
    change(archive);
    assert.throws(() => readOriginalEventStepLog(archive), invalid);
  }
  const descriptor = bytes("descriptor"),
    at = central(descriptor);
  const dataEnd = 30 + descriptor.readUInt16LE(26) + descriptor.readUInt16LE(28) + descriptor.readUInt32LE(at + 20);
  descriptor[dataEnd] ^= 1;
  assert.throws(() => readOriginalEventStepLog(descriptor), invalid);
  assert.throws(
    () => readOriginalEventStepLog(Buffer.concat([bytes("deflate"), Buffer.from("unbound tail")])),
    invalid,
  );
});
test("a fully framed compressed tail is rejected by consumed-byte verification", () => {
  const original = bytes("deflate"),
    oldCentral = central(original),
    compressed = original.readUInt32LE(oldCentral + 20);
  const dataEnd = 30 + original.readUInt16LE(26) + original.readUInt16LE(28) + compressed;
  const tail = Buffer.from("UNCONSUMED"),
    archive = Buffer.concat([original.subarray(0, dataEnd), tail, original.subarray(dataEnd)]);
  const at = oldCentral + tail.length;
  archive.writeUInt32LE(compressed + tail.length, 18);
  archive.writeUInt32LE(compressed + tail.length, at + 20);
  const sibling = nextCentral(archive, at);
  archive.writeUInt32LE(archive.readUInt32LE(sibling + 42) + tail.length, sibling + 42);
  archive.writeUInt32LE(at, end(archive) + 16);
  assert.throws(() => readOriginalEventStepLog(archive), invalid);
});
