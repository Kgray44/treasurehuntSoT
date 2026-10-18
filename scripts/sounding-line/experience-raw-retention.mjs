// Diagnostic retention only. Original paths and raw hashes stay inside encryption.
import { createHash, createPublicKey, randomUUID } from "node:crypto";
import { appendFile, constants, lstat, mkdir, open, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BROWSER_FAILURE_ENCRYPTION_KEY } from "./private-browser-failure.mjs";
import { sealPosttechnicalEvidence } from "./replay-posttechnical-diagnostic.mjs";
import { inventoryRawCaptureFiles, rawCaptureBinding } from "./experience-raw-output.mjs";

const chunkBytes = 16 * 1024 * 1024;
const completions = new WeakMap();
const format = "VW-POSTTECHNICAL-EVIDENCE-1";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_RAW_RETENTION_${code}`);
};
function producer() {
  const runId = process.env.GITHUB_RUN_ID ?? null,
    runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? null;
  if (
    (runId !== null || runAttempt !== null) &&
    ![runId, runAttempt].every((value) => /^[1-9][0-9]*$/u.test(value ?? ""))
  )
    fail("PRODUCER_INVALID");
  return { runId, runAttempt };
}
function directories(root, rawDirectory, encryptedDirectory) {
  const raw = /^artifacts\/sounding-line\/product-experience-capture-staging\/(capture-[A-Za-z0-9_-]+)\/raw$/u.exec(
    rawDirectory ?? "",
  );
  if (!raw || encryptedDirectory !== rawDirectory.slice(0, -3) + "encrypted") fail("DIRECTORY_INVALID");
  return { raw: path.join(root, rawDirectory), encrypted: path.join(root, encryptedDirectory), invocation: raw[1] };
}
async function owned(root, file) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("PATH_INVALID");
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (current !== file && !stat.isDirectory())) fail("PATH_INVALID");
  }
  return file;
}
function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function decode(value, length) {
  if (typeof value !== "string" || /[^A-Za-z0-9+/=]/u.test(value)) fail("ENVELOPE_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || (length !== undefined && bytes.length !== length)) fail("ENVELOPE_INVALID");
  return bytes;
}
function parseEnvelope(bytes) {
  try {
    return JSON.parse(bytes);
  } catch {
    fail("ENVELOPE_INVALID");
  }
}
// Structural readback accompanies trusted encryption, not authentication of an
// arbitrary disk-written GCM payload. Only this process can mint an upload handle.
function validateEnvelope(bytes, expectedAAD, encryption, { members, header: expectedHeader } = {}) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 512 * 1024 * 1024) fail("ENVELOPE_INVALID");
  const envelope = parseEnvelope(bytes);
  if (
    !exactKeys(envelope, ["format", "aad", "ciphertext", "tag"]) ||
    envelope.format !== format ||
    !Buffer.from(JSON.stringify(envelope)).equals(bytes)
  )
    fail("ENVELOPE_INVALID");
  const headerBytes = decode(envelope.aad);
  if (headerBytes.length > 8192) fail("ENVELOPE_INVALID");
  const header = parseEnvelope(headerBytes);
  const aadKeys = Object.keys(expectedAAD);
  if (
    !exactKeys(header, [...aadKeys, "format", "algorithms", "plaintextBytes", "nonce", "wrappedKey"]) ||
    !Buffer.from(JSON.stringify(header)).equals(headerBytes) ||
    header.format !== format ||
    JSON.stringify(header.algorithms) !== JSON.stringify({ content: "AES-256-GCM", keyWrap: "RSA-OAEP-SHA256" }) ||
    aadKeys.some((key) => JSON.stringify(header[key]) !== JSON.stringify(expectedAAD[key])) ||
    !Number.isSafeInteger(header.plaintextBytes) ||
    header.plaintextBytes < 1 ||
    (expectedHeader !== undefined && envelope.aad !== expectedHeader)
  )
    fail("ENVELOPE_INVALID");
  decode(header.nonce, 12);
  const key = createPublicKey(encryption.publicKey);
  if (key.asymmetricKeyType !== "rsa") fail("ENVELOPE_INVALID");
  decode(header.wrappedKey, key.asymmetricKeyDetails.modulusLength / 8);
  decode(envelope.tag, 16);
  if (decode(envelope.ciphertext).length !== header.plaintextBytes) fail("ENVELOPE_INVALID");
  if (members) {
    const expectedBytes = Buffer.byteLength(
      JSON.stringify({
        version: 1,
        inventory: [],
        files: members.map(({ name, bytes: content }) => ({
          name,
          bytes: content.length,
          sha256: hash(content),
          content: content.toString("base64"),
        })),
      }),
    );
    if (header.plaintextBytes !== expectedBytes) fail("ENVELOPE_INVALID");
  }
  return envelope.aad;
}
async function verifyGeneratedSet(snapshot) {
  const { root, directory, rawDirectory, rawFiles, encryptedFiles, headers, aad, encryption, receiptPin } = snapshot;
  const names = encryptedFiles.map((file) => file.name);
  if (
    names.at(-1) !== "index.encrypted" ||
    names.slice(0, -1).some((name, index) => name !== `part-${String(index + 1).padStart(6, "0")}.encrypted`)
  )
    fail("COMPLETION_INVALID");
  if (json((await readdir(await owned(root, directory))).sort()) !== json(["retention.json", ...names].sort()))
    fail("COMPLETION_CHANGED");
  for (const file of [...encryptedFiles, receiptPin]) {
    const target = await owned(root, path.join(directory, file.name));
    const stat = await lstat(target);
    if (
      !stat.isFile() ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > 512 * 1024 * 1024 ||
      stat.size !== file.bytes
    )
      fail("COMPLETION_INVALID");
    const bytes = await readFile(target);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) fail("COMPLETION_CHANGED");
    if (file.name !== "retention.json")
      validateEnvelope(bytes, { ...aad, part: file.name }, encryption, { header: headers[file.name] });
  }
  if (json(rawFiles) !== json(await inventoryRawCaptureFiles({ root, rawDirectory }))) fail("SOURCE_CHANGED");
}
export async function verifiedRawCapturePaths(completion) {
  const snapshot = completions.get(completion);
  if (!snapshot) fail("TRUSTED_COMPLETION_REQUIRED");
  await verifyGeneratedSet(snapshot);
  return [...snapshot.encryptedFiles, snapshot.receiptPin].map((file) =>
    path.relative(snapshot.root, path.join(snapshot.directory, file.name)).split(path.sep).join("/"),
  );
}
export async function retainRawCaptureOutput({
  root,
  rawDirectory,
  encryptedDirectory,
  binding,
  outcome,
  encryption = BROWSER_FAILURE_ENCRYPTION_KEY,
  seal = sealPosttechnicalEvidence,
}) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  // Reuse the source-binding validator without accepting an ambient credential/key.
  rawCaptureBinding({
    ...binding,
    exception: binding.recordDigest === null ? undefined : { recordDigest: binding.recordDigest },
  });
  if (!["PASS", "FAIL"].includes(outcome) || hash(encryption.publicKey) !== encryption.keyId) fail("BINDING_INVALID");
  const dirs = directories(root, rawDirectory, encryptedDirectory);
  await owned(root, dirs.raw);
  await owned(root, path.dirname(dirs.encrypted));
  await mkdir(dirs.encrypted, { mode: 0o700 }); // No reuse/overwrite of a partial retention attempt.
  const encryptedFiles = [];
  const headers = {};
  const aad = {
    version: 1,
    classification: "CAPTURE_RAW_DIAGNOSTICS_NOT_ACCEPTANCE",
    qualification: false,
    binding,
    producer: producer(),
    invocation: dirs.invocation,
    keyId: encryption.keyId,
  };
  const persist = async (name, members) => {
    const expectedAAD = { ...aad, part: name };
    const bytes = seal({ files: members, aad: expectedAAD, publicKey: encryption.publicKey });
    headers[name] = validateEnvelope(bytes, expectedAAD, encryption, { members });
    await writeFile(path.join(dirs.encrypted, name), bytes, { flag: "wx", mode: 0o600 });
    encryptedFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  };
  try {
    const files = await inventoryRawCaptureFiles({ root, rawDirectory });
    const index = [];
    for (const file of files) {
      const input = await open(
        await owned(root, path.join(root, file.path)),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const before = await input.stat();
        const fullHash = createHash("sha256");
        const chunks = [];
        let offset = 0;
        do {
          const bytes = Buffer.alloc(Math.min(chunkBytes, file.bytes - offset));
          let consumed = 0;
          while (consumed < bytes.length) {
            const read = await input.read(bytes, consumed, bytes.length - consumed, offset + consumed);
            if (!read.bytesRead) fail("SOURCE_CHANGED");
            consumed += read.bytesRead;
          }
          fullHash.update(bytes);
          const name = `part-${String(encryptedFiles.length + 1).padStart(6, "0")}.encrypted`;
          if (encryptedFiles.length >= 999999) fail("SEGMENT_LIMIT");
          const chunk = { name, offset, bytes: bytes.length, sha256: hash(bytes) };
          await persist(name, [
            { name: "metadata.json", bytes: Buffer.from(json({ version: 1, file, chunk, binding })) },
            { name: "chunk.bin", bytes },
          ]);
          chunks.push(chunk);
          offset += bytes.length;
        } while (offset < file.bytes);
        const after = await input.stat(),
          named = await lstat(await owned(root, path.join(root, file.path)));
        if (
          !before.isFile() ||
          before.size !== file.bytes ||
          fullHash.digest("hex") !== file.sha256 ||
          ["dev", "ino", "size", "mtimeMs", "ctimeMs"].some(
            (key) => before[key] !== after[key] || before[key] !== named[key],
          )
        )
          fail("SOURCE_CHANGED");
        index.push({ ...file, chunks });
      } finally {
        await input.close();
      }
    }
    if (json(files) !== json(await inventoryRawCaptureFiles({ root, rawDirectory }))) fail("SOURCE_CHANGED");
    await persist("index.encrypted", [
      {
        name: "index.json",
        bytes: Buffer.from(
          json({
            version: 1,
            qualification: false,
            acceptance: false,
            binding,
            outcome,
            outcomeScope: "CAPTURE_PRODUCER",
            files: index,
          }),
        ),
      },
    ]);
    const receipt = {
      version: 1,
      qualification: false,
      acceptance: false,
      binding,
      producer: producer(),
      invocation: dirs.invocation,
      retention: "COMPLETE",
      encryptedFiles,
    };
    const receiptBytes = Buffer.from(json(receipt));
    await writeFile(path.join(dirs.encrypted, "retention.json"), receiptBytes, { flag: "wx", mode: 0o600 });
    const snapshot = {
      root,
      directory: dirs.encrypted,
      rawDirectory,
      rawFiles: files,
      encryptedFiles: structuredClone(encryptedFiles),
      headers: { ...headers },
      aad: structuredClone(aad),
      encryption: { ...encryption },
      receiptPin: { name: "retention.json", bytes: receiptBytes.length, sha256: hash(receiptBytes) },
    };
    await verifyGeneratedSet(snapshot);
    completions.set(receipt, snapshot);
    return receipt;
  } catch (error) {
    try {
      await writeFile(
        path.join(dirs.encrypted, "retention-failure.json"),
        json({
          version: 1,
          qualification: false,
          acceptance: false,
          binding,
          producer: producer(),
          invocation: dirs.invocation,
          retention: "INCOMPLETE",
          encryptedFiles,
        }),
        { flag: "wx", mode: 0o600 },
      );
    } catch (retentionError) {
      throw new AggregateError([error, retentionError], "PRODUCT_EXPERIENCE_RAW_RETENTION_FAILED", { cause: error });
    }
    throw error;
  }
}
// Trusted workflow recovery for cancellation before the caller could retain raw.
// Disk-only completion cannot prove trusted encryption. Preserve and refuse all
// existing sets; an interrupted invocation may finalize only unstarted retention.
export async function retainInterruptedRawCapture({ root, encryptedDirectory, plan, encryption, seal }) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  const rawDirectory = encryptedDirectory?.replace(/\/encrypted$/u, "/raw");
  const dirs = directories(root, rawDirectory, encryptedDirectory);
  const binding = rawCaptureBinding(plan);
  try {
    await owned(root, dirs.encrypted);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return retainRawCaptureOutput({
      root,
      rawDirectory,
      encryptedDirectory,
      binding,
      outcome: "FAIL",
      encryption,
      seal,
    });
  }
  fail("EXISTING_RETENTION_UNTRUSTED");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace);
  const plan = JSON.parse(await readFile(await owned(root, path.resolve(options.plan)), "utf8"));
  const encryptedDirectory = path.relative(root, path.resolve(options.encrypted)).split(path.sep).join("/");
  const completion = await retainInterruptedRawCapture({ root, encryptedDirectory, plan });
  const paths = await verifiedRawCapturePaths(completion);
  if (process.env.GITHUB_OUTPUT) {
    const delimiter = `capture_${randomUUID()}`;
    const prefix = path.relative(process.cwd(), root).split(path.sep).join("/");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `capture_raw_verified_paths<<${delimiter}`,
        ...paths.map((file) => `${prefix ? prefix + "/" : ""}${file}`),
        delimiter,
        "capture_raw_retention_status=COMPLETE",
        "",
      ].join("\n"),
    );
  }
  process.stdout.write("CAPTURE_RAW_RETENTION_COMPLETE_NOT_ACCEPTANCE\n");
}
