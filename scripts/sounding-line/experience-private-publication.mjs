// Current-run transport only. Encryption does not confer acceptance or producer authenticity.
import {
  constants as C,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { constants as F, lstat, mkdir, open, opendir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRIVATE_CAPTURE_PURPOSE = "VW-CURRENT-RUN-PRIVATE-CAPTURE-1";
export const PRIVATE_CAPTURE_LIMITS = Object.freeze({
  traceBytes: 268435456,
  recordingBytes: 536870912,
  screenshotBytes: 16777216,
  jsonBytes: 8388608,
  indexBytes: 8388608,
  plaintextBytes: 4294967296,
  files: 4096,
  chunkBytes: 8388608,
  partBytes: 16777216,
  encryptedBytes: 9663676416,
  archiveBytes: 9697230848,
  receiptBytes: 65536,
});
// Installation needs an owner-approved recipient AND a trusted private access route.
// No environment/JSON/test override can enable the production publication realm.
export const PRIVATE_CAPTURE_POLICY = Object.freeze({
  version: 1,
  enabled: false,
  recipientFingerprint: null,
  publicKey: null,
  reviewerAccess: null,
  verifierAccess: null,
  status: "AWAITING_OWNER_RECIPIENT_AND_PRIVATE_ACCESS",
});
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_PRIVATE_CAPTURE_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => Buffer.from(JSON.stringify(value));
const hex = (value, length = 64) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const same = (a, b) => json(a).equals(json(b));
const bindingKeys = [
  "repository",
  "controllerSha",
  "baseSha",
  "candidateSha",
  "candidateTree",
  "sourceDigest",
  "contractDigest",
  "planDigest",
  "workflowPath",
  "runId",
  "runAttempt",
  "sessionId",
  "policyDigest",
  "keyFingerprint",
];
export function privateCaptureKeyFingerprint(publicKey) {
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails.modulusLength < 3072) fail("RECIPIENT_INVALID");
  return hash(key.export({ type: "spki", format: "der" }));
}
function bindingValue(value) {
  if (
    !exact(value, bindingKeys) ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository ?? "") ||
    !["controllerSha", "baseSha", "candidateSha", "candidateTree"].every((key) => hex(value[key], 40)) ||
    !["sourceDigest", "contractDigest", "planDigest", "policyDigest", "keyFingerprint"].every((key) =>
      hex(value[key]),
    ) ||
    value.controllerSha !== value.baseSha ||
    value.workflowPath !== ".github/workflows/sounding-line-ordinary.yml" ||
    ![value.runId, value.runAttempt].every((v) => /^[1-9][0-9]{0,19}$/u.test(v ?? "")) ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value.sessionId ?? "")
  )
    fail("BINDING_INVALID");
  return Object.fromEntries(bindingKeys.map((key) => [key, value[key]]));
}
function limitsValue(overrides = {}) {
  if (Object.keys(overrides).some((key) => !Object.hasOwn(PRIVATE_CAPTURE_LIMITS, key))) fail("LIMIT_INVALID");
  const limits = { ...PRIVATE_CAPTURE_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > PRIVATE_CAPTURE_LIMITS[key]) fail("LIMIT_INVALID");
  }
  return Object.freeze(limits);
}
function safePath(value) {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    !/^[A-Za-z0-9_./-]+$/u.test(value) ||
    path.posix.isAbsolute(value) ||
    value
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(p) ||
          p.endsWith("."),
      )
  )
    fail("PATH_INVALID");
  return value;
}
async function owned(root, relative, { parents = false } = {}) {
  safePath(relative);
  let current = root;
  const parts = relative.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      if (error.code !== "ENOENT" || !parents || i === parts.length - 1) throw error;
      await mkdir(current, { mode: 0o700 });
      stat = await lstat(current);
    }
    if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() && !stat.isDirectory()))
      fail("PATH_NOT_OWNED");
  }
  return current;
}
async function rootValue(root) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory()) fail("ROOT_INVALID");
  return root;
}
function identity(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, stat.nlink];
}
async function pin(root, relative, limit, signal) {
  signal?.throwIfAborted();
  const file = await owned(root, relative),
    input = await open(file, F.O_RDONLY | F.O_NOFOLLOW);
  try {
    const before = await input.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > limit) fail("FILE_LIMIT");
    const digest = createHash("sha256");
    let offset = 0;
    const buffer = Buffer.alloc(Math.min(1048576, Math.max(1, before.size)));
    while (offset < before.size) {
      signal?.throwIfAborted();
      const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, before.size - offset), offset);
      if (!bytesRead) fail("SOURCE_CHANGED");
      digest.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    if (
      !same(identity(before), identity(await input.stat())) ||
      !same(identity(before), identity(await lstat(await owned(root, relative))))
    )
      fail("SOURCE_CHANGED");
    signal?.throwIfAborted();
    return { bytes: before.size, sha256: digest.digest("hex"), identity: identity(before) };
  } finally {
    await input.close();
  }
}
const suffixes = { trace: ".zip", recording: ".webm", screenshot: ".png", json: ".json" };
function fileLimit(file, limits) {
  if (
    !exact(file, ["path", "sourcePath", "type"]) ||
    !Object.hasOwn(suffixes, file.type) ||
    !safePath(file.path).endsWith(suffixes[file.type]) ||
    !safePath(file.sourcePath).endsWith(suffixes[file.type])
  )
    fail("FILE_INVALID");
  return limits[`${file.type}Bytes`];
}
async function boundedNames(root, directory, limit, signal) {
  const result = [];
  for await (const entry of await opendir(await owned(root, directory))) {
    signal?.throwIfAborted();
    if (result.length >= limit) fail("DIRECTORY_LIMIT");
    result.push(entry.name);
  }
  return result.sort();
}
async function closure(root, directory, limit, signal) {
  const result = [];
  let visited = 0;
  async function visit(relative, depth = 0) {
    signal?.throwIfAborted();
    if (depth > 32 || ++visited > limit * 8 + 64) fail("DIRECTORY_LIMIT");
    for await (const entry of await opendir(await owned(root, relative))) {
      signal?.throwIfAborted();
      if (++visited > limit * 8 + 64) fail("DIRECTORY_LIMIT");
      const child = `${relative}/${entry.name}`;
      await owned(root, child);
      if (entry.isDirectory()) await visit(child, depth + 1);
      else if (entry.isFile()) result.push(child);
      else fail("PATH_NOT_OWNED");
      if (result.length > limit) fail("FILE_LIMIT");
    }
  }
  await visit(directory);
  return result.sort();
}
function envelopeAAD(binding, packetId, name, realm) {
  return {
    version: 1,
    purpose: PRIVATE_CAPTURE_PURPOSE,
    realm,
    bindingDigest: hash(json(binding)),
    packetId,
    part: name,
  };
}
function seal(bytes, aad, publicKey, limits) {
  const key = randomBytes(32),
    nonce = randomBytes(12);
  try {
    const wrappedKey = publicEncrypt(
      {
        key: publicKey,
        oaepHash: "sha256",
        oaepLabel: Buffer.from(PRIVATE_CAPTURE_PURPOSE),
        padding: C.RSA_PKCS1_OAEP_PADDING,
      },
      key,
    );
    const header = json({
      ...aad,
      algorithms: "AES-256-GCM/RSA-OAEP-SHA256",
      plaintextBytes: bytes.length,
      nonce: nonce.toString("base64"),
      wrappedKey: wrappedKey.toString("base64"),
    });
    if (header.length > 8192) fail("HEADER_LIMIT");
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(header);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(header.length);
    const result = Buffer.concat([length, header, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
    if (result.length > limits.partBytes) fail("PART_LIMIT");
    return result;
  } finally {
    key.fill(0);
  }
}
function base64(value, size) {
  if (typeof value !== "string") fail("ENVELOPE_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || (size !== undefined && bytes.length !== size)) fail("ENVELOPE_INVALID");
  return bytes;
}
function unseal(bytes, aad, privateKey, limits) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.length > limits.partBytes) fail("PART_LIMIT");
  const length = bytes.readUInt32BE(0);
  if (length < 1 || length > 8192 || length + 20 > bytes.length) fail("ENVELOPE_INVALID");
  const headerBytes = bytes.subarray(4, 4 + length);
  let header;
  try {
    header = JSON.parse(headerBytes);
  } catch {
    fail("ENVELOPE_INVALID");
  }
  if (
    !exact(header, [...Object.keys(aad), "algorithms", "plaintextBytes", "nonce", "wrappedKey"]) ||
    !json(header).equals(headerBytes) ||
    Object.keys(aad).some((key) => header[key] !== aad[key]) ||
    header.algorithms !== "AES-256-GCM/RSA-OAEP-SHA256" ||
    !Number.isSafeInteger(header.plaintextBytes) ||
    header.plaintextBytes < 0 ||
    header.plaintextBytes !== bytes.length - length - 20
  )
    fail("ENVELOPE_INVALID");
  let key;
  try {
    key = privateDecrypt(
      {
        key: privateKey,
        oaepHash: "sha256",
        oaepLabel: Buffer.from(PRIVATE_CAPTURE_PURPOSE),
        padding: C.RSA_PKCS1_OAEP_PADDING,
      },
      base64(header.wrappedKey),
    );
    if (key.length !== 32) fail("ENVELOPE_INVALID");
    const decipher = createDecipheriv("aes-256-gcm", key, base64(header.nonce, 12));
    decipher.setAAD(headerBytes);
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(4 + length, -16)), decipher.final()]);
  } catch {
    fail("DECRYPTION_FAILED");
  } finally {
    key?.fill(0);
  }
}
function packetNames(partCount) {
  if (!Number.isSafeInteger(partCount) || partCount < 1 || partCount > 4608) fail("PART_COUNT_INVALID");
  return [
    ...Array.from({ length: partCount }, (_, i) => `part-${String(i + 1).padStart(6, "0")}.encrypted`),
    "index.encrypted",
    "retention.json",
  ];
}
export function requirePrivateCapturePolicy() {
  // Deliberate source-controlled stop. Real key/access installation is outside this draft.
  fail("POLICY_NOT_INSTALLED");
}
export async function createPrivateCapturePublication() {
  requirePrivateCapturePolicy();
}
export async function verifiedPrivateCaptureUploadPaths() {
  requirePrivateCapturePolicy();
}
export async function openVerifiedPrivateCaptureView() {
  requirePrivateCapturePolicy();
}

// A separate fixture realm exercises the protocol with generated keys. Its opaque
// tokens can never enter the production upload selector above, even by cloning.
export function createPrivateCaptureFixtureRealm({
  publicKey,
  limits: overrides,
  loadArtifact,
  readBarrier = () => {},
  sourceBarrier = () => {},
  verificationBarrier = () => {},
}) {
  const limits = limitsValue(overrides),
    realm = "FIXTURE_ONLY",
    fingerprint = privateCaptureKeyFingerprint(publicKey);
  const completions = new WeakMap(),
    accesses = new WeakMap(),
    candidateRoots = new Set();
  async function verify(snapshot, signal) {
    const { root, directory, pins, files, sourceDirectory, binding, packetId } = snapshot;
    if (!same(await boundedNames(root, directory, 4610, signal), Object.keys(pins).sort())) fail("PACKET_CHANGED");
    for (const [name, expected] of Object.entries(pins)) {
      await verificationBarrier({ stage: "packet", name });
      if (
        !same(
          await pin(
            root,
            `${directory}/${name}`,
            name === "retention.json" ? limits.receiptBytes : limits.partBytes,
            signal,
          ),
          expected,
        )
      )
        fail("PACKET_CHANGED");
    }
    if (!same(await closure(root, sourceDirectory, limits.files, signal), files.map((file) => file.sourcePath).sort()))
      fail("SOURCE_CLOSURE_CHANGED");
    for (const file of files) {
      await verificationBarrier({ stage: "source", name: file.sourcePath });
      if (!same(await pin(root, file.sourcePath, fileLimit(file.selected, limits), signal), file.pin))
        fail("SOURCE_CHANGED");
    }
    if (binding.keyFingerprint !== fingerprint || !packetId) fail("BINDING_INVALID");
    await verificationBarrier({ stage: "complete" });
  }
  async function createPublication({ root, sourceDirectory, selectedFiles, binding, signal }) {
    binding = bindingValue(binding);
    if (binding.keyFingerprint !== fingerprint) fail("RECIPIENT_MISMATCH");
    root = await rootValue(root);
    candidateRoots.add(root);
    safePath(sourceDirectory);
    if (!Array.isArray(selectedFiles) || !selectedFiles.length || selectedFiles.length > limits.files)
      fail("FILE_LIMIT");
    const files = [];
    let total = 0;
    for (const selected of selectedFiles) {
      const limit = fileLimit(selected, limits);
      if (
        !selected.sourcePath.startsWith(`${sourceDirectory}/`) ||
        files.some((file) => file.path === selected.path || file.sourcePath === selected.sourcePath)
      )
        fail("SELECTION_INVALID");
      const pinned = await pin(root, selected.sourcePath, limit, signal);
      total += pinned.bytes;
      if (total > limits.plaintextBytes) fail("AGGREGATE_LIMIT");
      files.push({ ...selected, selected: { ...selected }, pin: pinned });
    }
    if (!same(await closure(root, sourceDirectory, limits.files, signal), files.map((file) => file.sourcePath).sort()))
      fail("SOURCE_CLOSURE_CHANGED");
    const packetId = randomUUID(),
      parent = "artifacts/sounding-line/private-capture-publication",
      directory = `${parent}/${packetId}`;
    await owned(root, `${parent}/.claim`, { parents: true }).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await mkdir(path.join(root, directory), { mode: 0o700 }); // Exclusive; interrupted sets are never reused.
    const pins = {},
      cipherRows = [],
      index = [];
    let encryptedBytes = 0,
      partCount = 0;
    const persist = async (name, bytes) => {
      signal?.throwIfAborted();
      const encrypted = seal(bytes, envelopeAAD(binding, packetId, name, realm), publicKey, limits);
      if (encryptedBytes + encrypted.length > limits.encryptedBytes) fail("ENCRYPTED_LIMIT");
      await writeFile(path.join(root, directory, name), encrypted, { flag: "wx", mode: 0o600 });
      encryptedBytes += encrypted.length;
      pins[name] = await pin(root, `${directory}/${name}`, limits.partBytes, signal);
      cipherRows.push({ name, bytes: encrypted.length, sha256: pins[name].sha256 });
    };
    for (const file of files) {
      signal?.throwIfAborted();
      const input = await open(await owned(root, file.sourcePath), F.O_RDONLY | F.O_NOFOLLOW);
      const chunks = [],
        digest = createHash("sha256");
      let offset = 0;
      try {
        if (!same(identity(await input.stat()), file.pin.identity)) fail("SOURCE_CHANGED");
        await sourceBarrier({ stage: "opened", path: path.join(root, file.sourcePath) });
        do {
          const bytes = Buffer.alloc(Math.min(limits.chunkBytes, file.pin.bytes - offset));
          let consumed = 0;
          while (consumed < bytes.length) {
            const read = await input.read(bytes, consumed, bytes.length - consumed, offset + consumed);
            if (!read.bytesRead) fail("SOURCE_CHANGED");
            consumed += read.bytesRead;
          }
          await sourceBarrier({ stage: "chunk-read", path: path.join(root, file.sourcePath) });
          const name = `part-${String(++partCount).padStart(6, "0")}.encrypted`;
          if (partCount > 4608) fail("PART_COUNT_INVALID");
          digest.update(bytes);
          await persist(name, bytes);
          chunks.push({ name, offset, bytes: bytes.length, sha256: hash(bytes) });
          offset += bytes.length;
        } while (offset < file.pin.bytes);
        if (
          digest.digest("hex") !== file.pin.sha256 ||
          !same(identity(await input.stat()), file.pin.identity) ||
          !same(identity(await lstat(await owned(root, file.sourcePath))), file.pin.identity)
        )
          fail("SOURCE_CHANGED");
      } finally {
        await input.close();
      }
      index.push({ path: file.path, type: file.type, bytes: file.pin.bytes, sha256: file.pin.sha256, chunks });
    }
    const indexBytes = json({ version: 1, purpose: PRIVATE_CAPTURE_PURPOSE, binding, packetId, files: index });
    if (indexBytes.length > limits.indexBytes) fail("INDEX_LIMIT");
    await persist("index.encrypted", indexBytes);
    const receipt = {
      version: 1,
      purpose: PRIVATE_CAPTURE_PURPOSE,
      realm,
      binding,
      packetId,
      status: "COMPLETE",
      qualification: false,
      acceptance: false,
      partCount,
      encryptedBytes,
      cipherSetDigest: hash(json(cipherRows)),
    };
    const receiptBytes = json(receipt);
    if (receiptBytes.length > limits.receiptBytes) fail("RECEIPT_LIMIT");
    await writeFile(path.join(root, directory, "retention.json"), receiptBytes, { flag: "wx", mode: 0o600 });
    pins["retention.json"] = await pin(root, `${directory}/retention.json`, limits.receiptBytes, signal);
    const snapshot = { root, directory, pins, files, sourceDirectory, binding, packetId, consumed: false };
    await verify(snapshot, signal);
    signal?.throwIfAborted();
    const token = Object.freeze({});
    completions.set(token, snapshot);
    return token;
  }
  async function verifiedPaths(token, { binding, signal } = {}) {
    const snapshot = completions.get(token);
    if (!snapshot || snapshot.consumed) fail("LIVE_PUBLICATION_REQUIRED");
    if (!same(bindingValue(binding), snapshot.binding)) fail("BINDING_MISMATCH");
    snapshot.consumed = true; // Reserve synchronously; failure never refunds this one-use selector.
    await verify(snapshot, signal);
    signal?.throwIfAborted();
    return packetNames(Object.keys(snapshot.pins).length - 2).map((name) => `${snapshot.directory}/${name}`);
  }
  function approveFixtureAccess({ privateKey, actors, reviewRoot }) {
    if (
      privateCaptureKeyFingerprint(privateKey) !== fingerprint ||
      !Array.isArray(actors) ||
      !actors.length ||
      actors.some((actor) => !/^[A-Za-z0-9-]+$/u.test(actor)) ||
      typeof loadArtifact !== "function"
    )
      fail("ACCESS_INVALID");
    const token = Object.freeze({});
    accesses.set(token, { privateKey, actors: [...actors], reviewRoot });
    return token;
  }
  async function openView({ artifactId, expectedBinding, approvedAccess, signal, kind = "capture" }) {
    const access = accesses.get(approvedAccess);
    if (!access) fail("APPROVED_PRIVATE_ACCESS_REQUIRED");
    const binding = bindingValue(expectedBinding);
    if (binding.keyFingerprint !== fingerprint || !Number.isSafeInteger(artifactId) || artifactId < 1)
      fail("BINDING_INVALID");
    signal?.throwIfAborted();
    // Fixture-only transport callback. A production provider adapter is deliberately
    // unavailable until its archive/download limits and access route are reviewed.
    const packet = await loadArtifact({ artifactId, expectedBinding: structuredClone(binding), limits, signal, kind });
    validatePrivateCaptureProvenance({ ...packet, artifactId, binding, actors: access.actors, limits, kind });
    const entries = packet.entries;
    const receiptBytes = entries.get("retention.json");
    if (!Buffer.isBuffer(receiptBytes) || receiptBytes.length > limits.receiptBytes) fail("RECEIPT_INVALID");
    let receipt;
    try {
      receipt = JSON.parse(receiptBytes);
    } catch {
      fail("RECEIPT_INVALID");
    }
    const receiptKeys = [
      "version",
      "purpose",
      "realm",
      "binding",
      "packetId",
      "status",
      "qualification",
      "acceptance",
      "partCount",
      "encryptedBytes",
      "cipherSetDigest",
    ];
    if (
      !exact(receipt, receiptKeys) ||
      receipt.version !== 1 ||
      receipt.purpose !== PRIVATE_CAPTURE_PURPOSE ||
      receipt.realm !== realm ||
      !same(bindingValue(receipt.binding), binding) ||
      receipt.status !== "COMPLETE" ||
      receipt.qualification !== false ||
      receipt.acceptance !== false ||
      !hex(receipt.cipherSetDigest) ||
      !/^[a-f0-9-]{36}$/u.test(receipt.packetId ?? "")
    )
      fail("RECEIPT_INVALID");
    const names = packetNames(receipt.partCount);
    if (!same([...entries.keys()].sort(), [...names].sort())) fail("PACKET_CLOSURE_CHANGED");
    let total = 0;
    const rows = [];
    for (const name of names.slice(0, -1)) {
      const bytes = entries.get(name);
      if (!Buffer.isBuffer(bytes) || bytes.length > limits.partBytes) fail("PART_LIMIT");
      total += bytes.length;
      if (total > limits.encryptedBytes) fail("ENCRYPTED_LIMIT");
      rows.push({ name, bytes: bytes.length, sha256: hash(bytes) });
    }
    if (receipt.encryptedBytes !== total || hash(json(rows)) !== receipt.cipherSetDigest)
      fail("CIPHER_DIGEST_MISMATCH");
    const decode = (name) =>
      unseal(entries.get(name), envelopeAAD(binding, receipt.packetId, name, realm), access.privateKey, limits);
    const indexBytes = decode("index.encrypted");
    if (indexBytes.length > limits.indexBytes) fail("INDEX_LIMIT");
    let index;
    try {
      index = JSON.parse(indexBytes);
    } catch {
      fail("INDEX_INVALID");
    }
    if (
      !exact(index, ["version", "purpose", "binding", "packetId", "files"]) ||
      index.version !== 1 ||
      index.purpose !== PRIVATE_CAPTURE_PURPOSE ||
      !same(bindingValue(index.binding), binding) ||
      index.packetId !== receipt.packetId ||
      !Array.isArray(index.files) ||
      !index.files.length ||
      index.files.length > limits.files
    )
      fail("INDEX_INVALID");
    const used = new Set(),
      logical = new Set();
    let plaintextTotal = 0;
    for (const file of index.files) {
      if (
        !exact(file, ["path", "type", "bytes", "sha256", "chunks"]) ||
        logical.has(safePath(file.path)) ||
        !hex(file.sha256) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 0 ||
        file.bytes > fileLimit({ path: file.path, sourcePath: file.path, type: file.type }, limits) ||
        !Array.isArray(file.chunks) ||
        !file.chunks.length
      )
        fail("INDEX_INVALID");
      logical.add(file.path);
      plaintextTotal += file.bytes;
      if (plaintextTotal > limits.plaintextBytes) fail("AGGREGATE_LIMIT");
      let offset = 0;
      for (const chunk of file.chunks) {
        if (
          !exact(chunk, ["name", "offset", "bytes", "sha256"]) ||
          chunk.name !== names[used.size] ||
          used.has(chunk.name) ||
          chunk.offset !== offset ||
          !hex(chunk.sha256) ||
          !Number.isSafeInteger(chunk.bytes) ||
          chunk.bytes < 0 ||
          chunk.bytes > limits.chunkBytes ||
          chunk.bytes !== Math.min(limits.chunkBytes, file.bytes - offset)
        )
          fail("INDEX_INVALID");
        used.add(chunk.name);
        offset += chunk.bytes;
      }
      if (offset !== file.bytes) fail("INDEX_INVALID");
    }
    if (used.size !== receipt.partCount) fail("INDEX_INVALID");
    const reviewRoot = await rootValue(access.reviewRoot);
    if (
      [...candidateRoots].some((root) => {
        const relative = path.relative(root, reviewRoot);
        return (
          relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
        );
      })
    )
      fail("PRIVATE_ROOT_INSIDE_CANDIDATE");
    // Explicit private root, outside every candidate checkout; keys stay in this realm.
    const viewDirectory = path.join(reviewRoot, randomUUID());
    await mkdir(viewDirectory, { mode: 0o700 });
    const viewIdentity = identity(await lstat(viewDirectory)).slice(0, 2);
    const materialized = new Map(),
      created = new Set();
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      if (
        (await realpath(viewDirectory)) !== viewDirectory ||
        path.dirname(viewDirectory) !== reviewRoot ||
        !same(identity(await lstat(viewDirectory)).slice(0, 2), viewIdentity) ||
        !same(await boundedNames(reviewRoot, path.basename(viewDirectory), limits.files), [...created].sort())
      )
        fail("VIEW_CLEANUP_INVALID");
      await rm(viewDirectory, { recursive: true });
    };
    try {
      for (const file of index.files) {
        signal?.throwIfAborted();
        // Disk names are opaque. Logical paths are never used for extraction.
        const target = path.join(viewDirectory, String(materialized.size));
        const output = await open(target, "wx", 0o600);
        created.add(path.basename(target));
        const digest = createHash("sha256");
        try {
          for (const chunk of file.chunks) {
            signal?.throwIfAborted();
            const bytes = decode(chunk.name);
            if (bytes.length !== chunk.bytes || hash(bytes) !== chunk.sha256) fail("CHUNK_CHANGED");
            digest.update(bytes);
            await output.writeFile(bytes);
          }
        } finally {
          await output.close();
        }
        if (digest.digest("hex") !== file.sha256) fail("FILE_CHANGED");
        materialized.set(file.path, { ...file, target, identity: identity(await lstat(target)) });
      }
      const readArtifact = ({ file }) => {
        if (closed) fail("VIEW_CLOSED");
        const entry = materialized.get(safePath(file));
        if (!entry) fail("UNSELECTED_ARTIFACT");
        const descriptor = openSync(entry.target, F.O_RDONLY | F.O_NOFOLLOW);
        try {
          const before = fstatSync(descriptor);
          if (!before.isFile() || !same(identity(before), entry.identity)) fail("VIEW_CHANGED");
          readBarrier({ path: entry.target, expectedBytes: entry.bytes }); // Fixture fault injection only.
          const bytes = Buffer.alloc(entry.bytes);
          let consumed = 0;
          while (consumed < bytes.length) {
            const read = readSync(descriptor, bytes, consumed, bytes.length - consumed, consumed);
            if (!read) fail("VIEW_CHANGED");
            consumed += read;
          }
          const probe = Buffer.alloc(1);
          if (
            readSync(descriptor, probe, 0, 1, entry.bytes) ||
            hash(bytes) !== entry.sha256 ||
            !same(identity(fstatSync(descriptor)), entry.identity) ||
            !same(identity(lstatSync(entry.target)), entry.identity)
          )
            fail("VIEW_CHANGED");
          return bytes;
        } finally {
          closeSync(descriptor);
        }
      };
      const capture = index.files.filter((file) => file.path.endsWith("/capture.json"));
      const manifest = capture.find(
        (file) => file.path === "Development_Docs/Testing/Product_Experience/evidence/capture.json",
      );
      if (!manifest) fail("CAPTURE_MANIFEST_MISSING");
      const evidence = JSON.parse(readArtifact({ file: manifest.path }));
      signal?.throwIfAborted();
      return Object.freeze({ evidence, readArtifact, close, classification: "FIXTURE_PRIVATE_VIEW_NOT_ACCEPTANCE" });
    } catch (error) {
      try {
        await close();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "PRODUCT_EXPERIENCE_PRIVATE_CAPTURE_VIEW_CLEANUP_FAILED", {
          cause: error,
        });
      }
      throw error;
    }
  }
  return Object.freeze({ createPublication, verifiedPaths, approveFixtureAccess, openView });
}

export function validatePrivateCaptureProvenance({
  artifact,
  run,
  workflow,
  artifactId,
  binding,
  actors,
  archiveBytes,
  archiveDigest,
  entries,
  limits = PRIVATE_CAPTURE_LIMITS,
  now = Date.now(),
  kind = "capture",
}) {
  if (
    !artifact ||
    !run ||
    !workflow ||
    artifact.id !== artifactId ||
    artifact.expired !== false ||
    !["capture", "review"].includes(kind) ||
    artifact.name !== `product-experience-${kind}-${binding.sourceDigest.slice(0, 16)}` ||
    artifact.workflow_run?.id !== run.id ||
    String(run.id) !== binding.runId ||
    String(run.run_attempt) !== binding.runAttempt ||
    run.head_sha !== binding.controllerSha ||
    run.head_branch !== "main" ||
    run.head_repository?.full_name !== binding.repository ||
    run.event !== "workflow_dispatch" ||
    run.conclusion !== "success" ||
    !actors.includes(run.actor?.login) ||
    run.triggering_actor?.login !== run.actor?.login ||
    workflow.path !== binding.workflowPath ||
    !Number.isFinite(Date.parse(artifact.expires_at)) ||
    Date.parse(artifact.expires_at) <= now ||
    !Number.isSafeInteger(archiveBytes) ||
    archiveBytes < 1 ||
    archiveBytes > limits.archiveBytes ||
    artifact.size_in_bytes !== archiveBytes ||
    !/^sha256:[a-f0-9]{64}$/u.test(archiveDigest ?? "") ||
    artifact.digest !== archiveDigest ||
    !(entries instanceof Map) ||
    entries.size > 4610
  )
    fail("PROVENANCE_INVALID");
  // loadArtifact must authenticate the actual archive bytes before returning these
  // entries. This fixture boundary is never accepted by production access/policy.
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== "--check-policy") fail("ARGUMENT_INVALID");
  requirePrivateCapturePolicy();
}
