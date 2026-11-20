import { constants, lstat, mkdir, open, opendir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPACT_EVIDENCE_TRANSPORT, compactCompletedEvidenceV2 } from "./completed-evidence-v2.mjs";

const MiB = 1024 * 1024;
const fail = (code) => {
  throw new Error(`SOUNDING_LINE_COMPLETED_EVIDENCE_COMPACTION_${code}`);
};

async function readCheckpoint(filename, maximum) {
  const info = await lstat(filename);
  if (!info.isFile() || info.size < 1 || info.size > maximum) fail("SOURCE_BOUND");
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const sameFile = (stat) =>
      stat.isFile() && ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every((key) => stat[key] === info[key]);
    if (!sameFile(await handle.stat())) fail("SOURCE_CHANGED");
    const bytes = Buffer.alloc(info.size + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await handle.read(bytes, size, bytes.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size !== info.size || !sameFile(await handle.stat()) || !sameFile(await lstat(filename)))
      fail("SOURCE_CHANGED");
    return bytes.subarray(0, size);
  } finally {
    await handle.close();
  }
}

export async function publishCompactCompletedEvidence(root) {
  const parent = path.join(await realpath(root), "artifacts", "sounding-line");
  const source = path.join(parent, "completed-evidence");
  const output = path.join(parent, "completed-evidence-v2");
  try {
    if ((await realpath(source)) !== source) fail("SOURCE_INVALID");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const checkpoints = new Map();
  let bytes = 0,
    entries = 0;
  for await (const entry of await opendir(source)) {
    if (++entries > 256) fail("SOURCE_BOUND");
    if (!/^checkpoint-[0-9]{4}\.json$/u.test(entry.name)) continue;
    if (checkpoints.size === 128) fail("SOURCE_BOUND");
    const content = await readCheckpoint(path.join(source, entry.name), Math.min(8 * MiB, 64 * MiB - bytes));
    checkpoints.set(entry.name, content);
    bytes += content.length;
  }
  if (!checkpoints.size) return null;
  const { members, measurements } = compactCompletedEvidenceV2(checkpoints);
  // Bound the ZIP even for incompressible data. The allowance covers member
  // headers, the central directory and the default uploader's deflate overhead.
  const archiveBudget = COMPACT_EVIDENCE_TRANSPORT.archiveBytes - 512 * 1024;
  if (
    members.size > COMPACT_EVIDENCE_TRANSPORT.members ||
    [...members.values()].some((member) => member.length > COMPACT_EVIDENCE_TRANSPORT.memberBytes) ||
    measurements.uniqueReceiptBytes + measurements.indexBytes > archiveBudget
  )
    fail("TRANSPORT_BOUND");
  await mkdir(output, { mode: 0o700 });
  // The codec emits the manifest last. The workflow selects this directory
  // only after this process finishes and announces successful publication.
  for (const [name, content] of members) {
    await writeFile(path.join(output, name), content, { flag: "wx", mode: 0o600 });
  }
  return measurements;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const result = await publishCompactCompletedEvidence(root);
  if (result) {
    await writeFile(process.env.GITHUB_OUTPUT, "format=compact-v2\n", { flag: "a" });
    console.log(JSON.stringify(result));
  }
}
