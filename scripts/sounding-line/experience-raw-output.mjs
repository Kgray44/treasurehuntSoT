// Raw browser output is retained diagnostic material, never publication evidence.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  constants,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const EXPERIENCE_RAW_OUTPUT = "SOUNDING_LINE_EXPERIENCE_RAW_OUTPUT";
const prefix = "artifacts/sounding-line/product-experience-capture-staging/";
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_RAW_OUTPUT_${code}`);
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
function safe(file) {
  if (
    typeof file !== "string" ||
    !file ||
    /[\\\u0000-\u001f\u007f]/u.test(file) ||
    path.posix.isAbsolute(file) ||
    file.split("/").some((part) => !part || part === "." || part === "..")
  )
    fail("PATH_INVALID");
  return file;
}
async function ownedRoot(root) {
  root = path.resolve(root);
  if ((await realpath(root)) !== root) fail("ROOT_SYMLINK");
  return root;
}
function repoPath(root, file) {
  return safe(path.isAbsolute(file) ? relative(root, file) : file);
}
function scope(directory) {
  safe(directory);
  const match =
    /^artifacts\/sounding-line\/product-experience-capture-staging\/(capture-[A-Za-z0-9_-]+)\/raw(?:\/|$)/u.exec(
      directory,
    );
  if (!match) fail("DIRECTORY_INVALID");
  const invocation = `${prefix}${match[1]}`;
  return { invocation, rawRoot: `${invocation}/raw` };
}
async function maybeStat(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
// Check each component: realpath containment alone accepts symlinked parents.
async function owned(root, file, parents = false) {
  const parts = safe(file).split("/");
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat = await maybeStat(current);
    if (!stat && parents && index < parts.length - 1) {
      await mkdir(current, { mode: 0o700 });
      stat = await lstat(current);
    }
    if (stat && (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory()))) fail("PATH_NOT_OWNED");
  }
  return current;
}
function validBinding(binding) {
  if (
    !binding ||
    ![binding.baseSha, binding.candidateSha].every((value) => /^[a-f0-9]{40}$/u.test(value ?? "")) ||
    ![binding.sourceDigest, binding.contractDigest].every((value) => /^[a-f0-9]{64}$/u.test(value ?? "")) ||
    !(binding.recordDigest === null || /^[a-f0-9]{64}$/u.test(binding.recordDigest ?? ""))
  )
    fail("BINDING_INVALID");
}
export function rawCaptureBinding(plan) {
  const binding = {
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    recordDigest: plan.exception?.recordDigest ?? null,
  };
  validBinding(binding);
  return binding;
}
async function fingerprint(file) {
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o7111) !== 0) fail("REGULAR_FILE_REQUIRED");
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) digest.update(chunk);
  const after = await lstat(file);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.ctimeMs !== after.ctimeMs
  )
    fail("FILE_CHANGED");
  return { bytes: before.size, sha256: digest.digest("hex"), permissions: before.mode & 0o777 };
}
export async function createRawOutputDirectory({ root, directory }) {
  root = await ownedRoot(root);
  directory = repoPath(root, directory);
  scope(directory);
  const target = await owned(root, directory, true);
  await mkdir(target, { mode: 0o700 }); // Exclusive final directory: no prior producer output.
  return target;
}

export async function readBoundedRawCaptureFile({ root, rawDirectory, file, maximumBytes }) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 64 * 1024 * 1024) fail("READ_BOUND");
  root = await ownedRoot(root);
  rawDirectory = repoPath(root, rawDirectory);
  if (scope(rawDirectory).rawRoot !== rawDirectory) fail("SEAL_ROOT_REQUIRED");
  file = repoPath(root, file);
  if (!file.startsWith(rawDirectory + "/")) fail("READ_SCOPE");
  const target = await owned(root, file);
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat(),
      named = await lstat(target);
    if (
      !before.isFile() ||
      named.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.dev !== named.dev ||
      before.ino !== named.ino ||
      (await realpath(target)) !== target ||
      before.size > maximumBytes ||
      (before.mode & 0o7111) !== 0
    )
      fail("READ_FILE");
    const bytes = Buffer.alloc(maximumBytes + 1);
    let count = 0,
      result;
    while ((result = await handle.read(bytes, count, bytes.length - count, null)).bytesRead > 0) {
      count += result.bytesRead;
      if (count > maximumBytes) fail("READ_BOUND");
    }
    const after = await handle.stat(),
      current = await lstat(target);
    if ((await realpath(target)) !== target) fail("READ_CHANGED");
    if (
      count !== before.size ||
      ![after, current].every(
        (stat) =>
          stat.isFile() &&
          stat.dev === before.dev &&
          stat.ino === before.ino &&
          stat.size === before.size &&
          stat.mtimeMs === before.mtimeMs &&
          stat.ctimeMs === before.ctimeMs &&
          stat.nlink === 1,
      )
    )
      fail("READ_CHANGED");
    return Buffer.from(bytes.subarray(0, count));
  } finally {
    await handle.close();
  }
}

// Shadow observation never changes the canonical capture outcome. A failure
// remains explicit and ineligible, without publishing paths or arbitrary errors.
export async function observeClosedContextShadow(operation) {
  try {
    return { status: "OBSERVED", value: await operation(), qualification: false, reuseAuthorized: false };
  } catch (error) {
    let reason = "UNCLASSIFIED_SHADOW_FAILURE";
    try {
      if (
        new Set(["EACCES", "EPERM", "ENOENT", "EEXIST", "EIO", "ENOSPC", "EMFILE", "ENFILE", "EROFS", "EBUSY"]).has(
          error?.code,
        )
      )
        reason = error.code;
      else if (
        new Set([
          "PRODUCT_EXPERIENCE_RAW_OUTPUT_CLOSED_CONTEXT_INVALID",
          "PRODUCT_EXPERIENCE_RAW_OUTPUT_CLOSED_CONTEXT_BOUND",
          "PRODUCT_EXPERIENCE_RAW_OUTPUT_CLOSED_CONTEXT_ARTIFACT_INVALID",
          "PRODUCT_EXPERIENCE_RAW_OUTPUT_CLOSED_CONTEXT_ARTIFACT_CHANGED",
          "PRODUCT_EXPERIENCE_RAW_OUTPUT_CLOSED_CONTEXT_ORDINARY_SCOPE_REQUIRED",
        ]).has(error?.message)
      )
        reason = error.message;
    } catch {
      /* Even a hostile error accessor cannot alter capture. */
    }
    const result = { status: "INCOMPLETE", reason, qualification: false, reuseAuthorized: false };
    try {
      console.error(JSON.stringify({ namespace: "SOUNDING_LINE_CLOSED_CONTEXT_SHADOW", ...result }));
    } catch {
      /* The returned incomplete result also disables further observation. */
    }
    return result;
  }
}

// Retain closed browser contexts inside the existing encrypted raw-output lane.
// These observations do not attest parent runtime cleanup or authorize resume.
// The browser calls append only after trace.stop, context.close and video.path.
export function closedContextShadowAllowed(plan, prNumber = plan?.prNumber) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return false;
  if (typeof prNumber === "string" && !/^[1-9][0-9]{0,15}$/u.test(prNumber)) return false;
  const pr = Number(prNumber);
  return Number.isSafeInteger(pr) && pr > 0 && ![721, 776, 805].includes(pr) && !plan?.exception;
}
export async function createClosedContextJournal({
  root,
  rawDirectory,
  binding,
  maximumMediaBytes = 256 * 1024 * 1024,
}) {
  root = await ownedRoot(root);
  validBinding(binding);
  if (binding.recordDigest !== null) fail("CLOSED_CONTEXT_ORDINARY_SCOPE_REQUIRED");
  if (!Number.isSafeInteger(maximumMediaBytes) || maximumMediaBytes < 0 || maximumMediaBytes > 256 * 1024 * 1024)
    fail("CLOSED_CONTEXT_BOUND");
  rawDirectory = repoPath(root, rawDirectory);
  const { invocation } = scope(rawDirectory);
  const boundBinding = JSON.parse(json(binding));
  const directory = `${rawDirectory}/closed-contexts`;
  await createRawOutputDirectory({ root, directory });
  let totalBytes = 0,
    count = 0,
    copiedMediaBytes = 0;
  return Object.freeze({
    async append({ context, artifacts, journey, recordingSource }) {
      const contextFields = ["contractId", "journeyId", "device", "role", "motionMode"];
      if (
        !context ||
        Object.keys(context).length !== contextFields.length + 1 ||
        !contextFields.every(
          (key) => typeof context[key] === "string" && context[key].length > 0 && context[key].length <= 2048,
        ) ||
        !["DESKTOP", "MOBILE"].includes(context.device) ||
        !["NORMAL", "REDUCED"].includes(context.motionMode) ||
        !context.viewport ||
        Object.keys(context.viewport).length !== 2 ||
        ![context.viewport.width, context.viewport.height].every(
          (n) => Number.isSafeInteger(n) && n >= 1 && n <= 10000,
        ) ||
        !Array.isArray(artifacts) ||
        artifacts.length > 512 ||
        !journey ||
        typeof journey !== "object" ||
        Array.isArray(journey) ||
        journey.status !== "PASS" ||
        journey.id !== context.journeyId ||
        !["contractId", "device", "role", "motionMode"].every((key) => journey[key] === context[key])
      )
        fail("CLOSED_CONTEXT_INVALID");
      // Bound serialization before filesystem work; clone to retain exact input
      // values even if the producer mutates its aggregate capture afterward.
      const originalBytes = Buffer.from(json({ context, artifacts, journey }));
      if (originalBytes.length > 2 * 1024 * 1024) fail("CLOSED_CONTEXT_BOUND");
      const original = JSON.parse(originalBytes);
      if (["trace", "recording"].some((type) => original.artifacts.filter((item) => item.type === type).length !== 1))
        fail("CLOSED_CONTEXT_ARTIFACT_INVALID");
      const contextIdentity = json({
        ...Object.fromEntries(contextFields.map((key) => [key, original.context[key]])),
        viewport: { width: original.context.viewport.width, height: original.context.viewport.height },
      });
      const contextId = hash(contextIdentity);
      const ids = new Set(),
        paths = new Set(),
        files = [],
        media = [];
      for (const artifact of original.artifacts) {
        if (
          typeof artifact.id !== "string" ||
          ids.has(artifact.id) ||
          paths.has(artifact.path) ||
          !["screenshot", "trace", "recording"].includes(artifact.type) ||
          !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? "") ||
          !["contractId", "device", "role", "motionMode"].every((key) => artifact[key] === original.context[key]) ||
          !safe(artifact.path).startsWith(`${invocation}/capture/`)
        )
          fail("CLOSED_CONTEXT_ARTIFACT_INVALID");
        ids.add(artifact.id);
        paths.add(artifact.path);
        const source = await owned(root, artifact.path);
        const stat = await lstat(source);
        if (!stat.isFile() || stat.size < 1 || stat.size > 64 * 1024 * 1024) fail("CLOSED_CONTEXT_BOUND");
        const observed = await fingerprint(source);
        if (observed.sha256 !== artifact.sha256) fail("CLOSED_CONTEXT_ARTIFACT_CHANGED");
        files.push({ path: artifact.path, ...observed });
        const existingRecording = artifact.type === "recording" && recordingSource !== undefined;
        const rawPath = existingRecording
          ? repoPath(root, recordingSource)
          : `${rawDirectory}/closed-media/${contextId}/${hash(artifact.path)}`;
        if (existingRecording) {
          if (!rawPath.startsWith(`${rawDirectory}/recordings/`)) fail("CLOSED_CONTEXT_ARTIFACT_INVALID");
          if (json(await fingerprint(await owned(root, rawPath))) !== json(observed))
            fail("CLOSED_CONTEXT_ARTIFACT_CHANGED");
        }
        media.push({ originalPath: artifact.path, path: rawPath, ...observed, copyRequired: !existingRecording });
      }
      const additionalMediaBytes = media.reduce((sum, file) => sum + (file.copyRequired ? file.bytes : 0), 0);
      if (!Number.isSafeInteger(additionalMediaBytes) || copiedMediaBytes + additionalMediaBytes > maximumMediaBytes)
        fail("CLOSED_CONTEXT_BOUND");
      const observation = {
        version: 1,
        classification: "CLOSED_BROWSER_CONTEXT_OBSERVATION_NOT_RUNTIME_CLEANUP",
        binding: boundBinding,
        ...original,
        files,
        rawFiles: media.map((file) => {
          const retained = { ...file };
          delete retained.copyRequired;
          return retained;
        }),
        mutableStateClass: "UNATTESTED_SHARED_TASK_RUNTIME",
        parentRuntimeCleanup: "UNAVAILABLE_UNTIL_PARENT_REAP",
        coverage: "REQUIRES_INDEPENDENT_COMPLETE_CONTEXT_VALIDATION",
        qualification: false,
        reuseAuthorized: false,
      };
      const bytes = Buffer.from(json(observation));
      if (count >= 8192 || bytes.length > 2 * 1024 * 1024 || totalBytes + bytes.length > 64 * 1024 * 1024)
        fail("CLOSED_CONTEXT_BOUND");
      const file = `${directory}/${contextId}.json`;
      // Reserve before yielding to the write, so parallel callers cannot exceed
      // the aggregate cap. A failed write conservatively consumes its allowance.
      count++;
      totalBytes += bytes.length;
      copiedMediaBytes += additionalMediaBytes;
      for (const entry of media) {
        const expected = { bytes: entry.bytes, sha256: entry.sha256, permissions: entry.permissions };
        if (entry.copyRequired) {
          const target = await owned(root, entry.path, true);
          await copyFile(await owned(root, entry.originalPath), target, constants.COPYFILE_EXCL);
          await chmod(target, entry.permissions);
        }
        if (
          json(await fingerprint(await owned(root, entry.path))) !== json(expected) ||
          json(await fingerprint(await owned(root, entry.originalPath))) !== json(expected)
        )
          fail("CLOSED_CONTEXT_ARTIFACT_CHANGED");
      }
      // Publish metadata last: partial media copies are retained raw fragments,
      // never a completed context. Existing raw recordings are not duplicated.
      await writeFile(await owned(root, file), bytes, { flag: "wx", mode: 0o600 });
      return { path: file, bytes: bytes.length, sha256: hash(bytes), qualification: false };
    },
  });
}
function copyPaths(root, rawDirectory, source, destination) {
  rawDirectory = repoPath(root, rawDirectory);
  const { invocation, rawRoot } = scope(rawDirectory);
  source = repoPath(root, source);
  destination = repoPath(root, destination);
  if (
    !source.startsWith(rawDirectory + "/") ||
    source.startsWith(rawRoot + "/declared/") ||
    source === rawRoot + "/raw-output-inventory.json" ||
    !destination.startsWith(`${invocation}/capture/`) ||
    path.posix.basename(source) !== path.posix.basename(destination)
  )
    fail("COPY_PATH_INVALID");
  return { source, destination, rawRoot };
}
export async function copyDeclaredCaptureFile({ root, rawDirectory, source, destination, kind, binding }) {
  root = await ownedRoot(root);
  validBinding(binding);
  if (!["json", "screenshot", "recording", "trace"].includes(kind)) fail("KIND_INVALID");
  const paths = copyPaths(root, rawDirectory, source, destination);
  const input = await owned(root, paths.source);
  const output = await owned(root, paths.destination, true);
  const original = await fingerprint(input);
  await copyFile(input, output, constants.COPYFILE_EXCL);
  await chmod(output, original.permissions);
  const copied = await fingerprint(output);
  if (json(original) !== json(copied) || json(original) !== json(await fingerprint(input))) fail("COPY_CHANGED");
  const declaration = {
    schema: "DECLARED_CAPTURE_COPY_1",
    source: paths.source,
    destination: paths.destination,
    kind,
    bytes: original.bytes,
    sha256: original.sha256,
    binding,
  };
  const receipt = await owned(root, `${paths.rawRoot}/declared/${hash(paths.destination)}.json`, true);
  await writeFile(receipt, json(declaration), { flag: "wx", mode: 0o600 });
  return { path: paths.destination, source: paths.source, sha256: original.sha256, bytes: original.bytes };
}
export async function inventoryRawCaptureFiles({ root, rawDirectory }) {
  root = await ownedRoot(root);
  rawDirectory = repoPath(root, rawDirectory);
  const { rawRoot } = scope(rawDirectory);
  if (rawRoot !== rawDirectory) fail("SEAL_ROOT_REQUIRED");
  const files = [];
  let entries = 0;
  async function visit(directory, depth = 0) {
    if (depth > 16) fail("INVENTORY_LIMIT");
    for (const entry of (await readdir(await owned(root, directory), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (++entries > 16384) fail("INVENTORY_LIMIT");
      const file = `${directory}/${entry.name}`;
      const target = await owned(root, file);
      const stat = await lstat(target);
      if (stat.isDirectory()) await visit(file, depth + 1);
      else files.push({ path: file, ...(await fingerprint(target)) });
    }
  }
  await visit(rawRoot);
  return files;
}
export async function sealRawCaptureOutput({ root, rawDirectory, binding, outcome }) {
  root = await ownedRoot(root);
  validBinding(binding);
  if (!["PASS", "FAIL"].includes(outcome)) fail("OUTCOME_INVALID");
  rawDirectory = repoPath(root, rawDirectory);
  const { rawRoot } = scope(rawDirectory);
  if (rawRoot !== rawDirectory) fail("SEAL_ROOT_REQUIRED");
  const files = (await inventoryRawCaptureFiles({ root, rawDirectory })).map((file) => ({
    ...file,
    classification: "RAW_ONLY",
  }));
  const byPath = new Map(files.map((file) => [file.path, file]));
  const declarations = [];
  const destinations = new Set();
  for (const file of files.filter((item) => item.path.startsWith(rawRoot + "/declared/"))) {
    if (file.bytes > 65536) fail("DECLARATION_INVALID");
    const declaration = JSON.parse(await readFile(await owned(root, file.path), "utf8"));
    if (
      declaration.schema !== "DECLARED_CAPTURE_COPY_1" ||
      json(declaration.binding) !== json(binding) ||
      !["json", "screenshot", "recording", "trace"].includes(declaration.kind) ||
      file.path !== `${rawRoot}/declared/${hash(declaration.destination)}.json` ||
      destinations.has(declaration.destination)
    )
      fail("DECLARATION_INVALID");
    copyPaths(root, rawRoot, declaration.source, declaration.destination);
    const source = byPath.get(declaration.source);
    const target = await fingerprint(await owned(root, declaration.destination));
    if (
      !source ||
      source.bytes !== declaration.bytes ||
      source.sha256 !== declaration.sha256 ||
      json(target) !== json({ bytes: source.bytes, sha256: source.sha256, permissions: source.permissions })
    )
      fail("DECLARATION_CHANGED");
    destinations.add(declaration.destination);
    file.classification = "DECLARATION";
    source.classification = "DECLARED";
    declarations.push(declaration);
  }
  const inventory = {
    version: 1,
    qualification: false,
    acceptance: false,
    binding,
    outcome,
    outcomeScope: "CAPTURE_PRODUCER",
    rawDirectory,
    files,
    declarations,
  };
  await writeFile(await owned(root, `${rawRoot}/raw-output-inventory.json`), json(inventory), {
    flag: "wx",
    mode: 0o600,
  });
  return inventory;
}
