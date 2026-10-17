// Finite infrastructure proof. Importing this module never loads engines or browsers.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { bounded } from "./owned-process.mjs";

export const READINESS_POLICY = Object.freeze({
  requiredBeforeCaseSlot: true,
  classification: "FINITE_INFRASTRUCTURE_READINESS_NO_PRODUCT_JOURNEYS",
  maximumAttemptsPerStage: 3,
  maximumAttemptsTotal: 6,
  profile: "generic",
  schema: "prisma/schema.sqlite.prisma",
  nativeEngineVersionChecks: Object.freeze(["libquery-engine", "schema-engine"]),
  genericSetup: Object.freeze([
    "prisma-generate",
    "sqlite-bootstrap",
    "seed",
    "migrate-legacy-companion",
    "prepare-validation-isolation",
    "next-build",
  ]),
  browserProbe: "CHROMIUM_LAUNCH_CLOSE_WITHOUT_PAGE",
  productJourneys: 0,
  productCaptures: 0,
  providerCalls: 0,
});
export const READINESS_DEPENDENCIES = Object.freeze({
  prismaVersion: "6.19.3",
  engineVersion: "c2990dca591cba766e3b7ef5d9e8a84796e47ab7",
  lockBlob: "fca84d3ab68ff77c013554e5eb9531cb3f7b11c2",
  platform: "debian-openssl-3.0.x",
  playwrightVersion: "1.56.1",
  chromiumRevision: "1194",
  engines: Object.freeze([
    Object.freeze({
      name: "libquery-engine",
      file: "libquery_engine-debian-openssl-3.0.x.so.node",
      sha256: "a2924eab1c78a0a7bb67edac5738939fa10589ef073af5542f53812a22e4a7d8",
      gzipSha256: "d380872cc8a17310c6ebb249dc000f4fcbfbbd51ddc36beb57b1ed0c54c6d610",
    }),
    Object.freeze({
      name: "schema-engine",
      file: "schema-engine-debian-openssl-3.0.x",
      sha256: "5d42b181631fd20bb0ecc5abcdba72575e7f467a0d52f4d5ef1ff28f0c74e6e9",
      gzipSha256: "6c1dfdfe34538487b088fd21b3152147e1bd3c9d0c00b4fc6ecae40ceba83d8a",
    }),
  ]),
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const READINESS_POLICY_DIGEST = hash(JSON.stringify(READINESS_POLICY));
const fail = (code) => {
  throw Error(`PRODUCT_EXPERIENCE_DEPENDENCY_READINESS_${code}`);
};
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const stages = ["original", "corrected"];
const exceptionId = "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R13";
const ambientKeys = [
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
  "PLAYWRIGHT_BROWSERS_PATH",
];
const ambientEnvironment = (environment) =>
  sortedEnvironment(
    Object.fromEntries(
      ambientKeys.filter((key) => typeof environment[key] === "string").map((key) => [key, environment[key]]),
    ),
  );
const terminal = new Set(["PASS", "FAIL", "UNKNOWN"]);
const git = (root, ...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const bytes = (file) => {
  if (!lstatSync(file).isFile()) fail("REGULAR_FILE_REQUIRED");
  return readFileSync(file);
};
const persist = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
};
const sortedEnvironment = (environment) =>
  Object.fromEntries(Object.entries(environment).sort(([a], [b]) => a.localeCompare(b)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const errorRecord = (error, depth = 0) => ({
  name: error instanceof Error ? error.name : "Error",
  message: error instanceof Error ? error.message : String(error),
  ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  ...(typeof error?.code === "string" || typeof error?.code === "number" ? { code: error.code } : {}),
  ...(depth < 3 && error?.cause && error.cause !== error ? { cause: errorRecord(error.cause, depth + 1) } : {}),
});
const publicationDirectory = (stage) =>
  `Development_Docs/Projects/Project_Crossdeck/evidence/r13-verification-20261017/focused-technical/${stage}/dependency-readiness`;
function commonDirectory(root) {
  return path.join(git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"), "sounding-line");
}
function markerPath(root, stage, attempt) {
  if (!stages.includes(stage) || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) fail("SLOT_INVALID");
  return path.join(commonDirectory(root), `crossdeck-r13-readiness-${stage}-${attempt}.marker.json`);
}
function pathsFor(marker, markerFile) {
  const directory = path.join(
    marker.root,
    "artifacts",
    "sounding-line",
    "dependency-readiness",
    marker.stage,
    `attempt-${marker.attempt}`,
  );
  return {
    directory,
    marker: markerFile,
    launch: markerFile.replace(/\.marker\.json$/u, ".launch.json"),
    receipt: markerFile.replace(/\.marker\.json$/u, ".receipt.json"),
    privateContext: path.join(directory, "profile-context.private.json"),
    contextSeal: path.join(directory, "profile-context.seal.json"),
    nativeReceipt: path.join(directory, "native-dependencies.json"),
    browserReceipt: path.join(directory, "browser-dependencies.json"),
    setupReceipt: path.join(directory, "generic-setup.json"),
    dependencyManifest: path.join(directory, "node-modules-manifest.json"),
    stdout: path.join(directory, "setup.stdout.txt"),
    stderr: path.join(directory, "setup.stderr.txt"),
    databaseUrl: marker.databaseUrl,
  };
}
function context(marker, markerFile) {
  return {
    root: marker.root,
    stage: marker.stage,
    attempt: marker.attempt,
    marker,
    binding: marker.binding,
    paths: pathsFor(marker, markerFile),
  };
}
function validBinding(binding) {
  return (
    binding?.version === 1 &&
    typeof binding.exceptionId === "string" &&
    stages.includes(binding.stage) &&
    Number.isInteger(binding.attempt) &&
    binding.attempt >= 1 &&
    binding.attempt <= 3 &&
    [binding.baseSha, binding.candidateSha, binding.candidateTree].every((value) => sha.test(value ?? "")) &&
    [
      binding.sourceDigest,
      binding.contractDigest,
      binding.recordDigest,
      binding.manifestSha256,
      binding.sourceManifestSha256,
      binding.environmentDigest,
    ].every((value) => digest.test(value ?? "")) &&
    /^[a-f0-9-]{36}$/u.test(binding.lease ?? "")
  );
}
function inspectMarker(marker) {
  if (
    marker?.version !== 1 ||
    marker.classification !== READINESS_POLICY.classification ||
    marker.policyDigest !== READINESS_POLICY_DIGEST ||
    marker.status !== "RESERVED" ||
    !validBinding(marker.binding) ||
    marker.stage !== marker.binding.stage ||
    marker.attempt !== marker.binding.attempt ||
    !path.isAbsolute(marker.root ?? "") ||
    !Number.isInteger(marker.ownerPid) ||
    marker.ownerPid <= 0 ||
    typeof marker.databaseUrl !== "string" ||
    !marker.databaseUrl.startsWith(`file:${marker.root.replaceAll("\\", "/")}/artifacts/sounding-line/generic-`)
  )
    fail("MARKER_INVALID");
  return marker;
}
function allAttempts(root) {
  const entries = [];
  for (const stage of stages) {
    let missing = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const file = markerPath(root, stage, attempt);
      if (!existsSync(file)) {
        missing = true;
        continue;
      }
      if (missing) fail("ATTEMPT_HISTORY_GAP");
      const marker = inspectMarker(json(file));
      if (marker.stage !== stage || marker.attempt !== attempt || markerPath(marker.root, stage, attempt) !== file)
        fail("MARKER_SCOPE_CHANGED");
      entries.push(context(marker, file));
    }
  }
  if (entries.length > 6) fail("TOTAL_ATTEMPTS_EXHAUSTED");
  return entries;
}
function expectedBinding({ baseSha, candidateSha, stage, manifest, record, environment = process.env }) {
  const fields = {
    version: 1,
    exceptionId: record?.id ?? exceptionId,
    recordDigest: manifest.recordDigest,
    baseSha,
    candidateSha,
    candidateTree: manifest.candidateTree,
    sourceDigest: manifest.sourceDigest,
    contractDigest: manifest.contractDigest,
    sourceManifestSha256: manifest.sourceManifestSha256,
    environmentDigest: hash(JSON.stringify(ambientEnvironment(environment))),
    stage,
  };
  return { ...fields, manifestSha256: hash(JSON.stringify(fields)) };
}
function matchesExpected(binding, expected) {
  return Object.entries(expected).every(([key, value]) => binding[key] === value);
}
function unchangedReservation(attempt) {
  const marker = inspectMarker(json(attempt.paths.marker));
  if (!same(marker, attempt.marker)) fail("RESERVATION_CHANGED");
  return marker;
}
function requireLease(attempt, environment) {
  unchangedReservation(attempt);
  if (
    environment.SOUNDING_LINE_READINESS_LEASE !== attempt.binding.lease ||
    environment.SOUNDING_LINE_READINESS_MARKER !== attempt.paths.marker ||
    existsSync(attempt.paths.receipt)
  )
    fail("ACTIVE_LEASE_REQUIRED");
  try {
    process.kill(attempt.marker.ownerPid, 0);
  } catch {
    fail("OWNER_EXITED");
  }
}

export function readinessSuiteArguments({ root, baseSha, candidateSha, stage, databaseUrl, attempt }) {
  return [
    "--profile",
    "generic",
    "--workspace",
    root,
    "--candidate",
    candidateSha,
    "--database-url",
    databaseUrl,
    "--r13-dependency-readiness",
    stage,
    "--r13-base",
    baseSha,
    "--r13-attempt",
    String(attempt),
  ];
}
export function beginReadinessAttempt({
  root,
  baseSha,
  candidateSha,
  stage,
  manifest,
  record,
  environment = process.env,
}) {
  root = path.resolve(root);
  const expected = expectedBinding({ baseSha, candidateSha, stage, manifest, record, environment });
  if (
    !stages.includes(stage) ||
    !validBinding({ ...expected, attempt: 1, lease: randomUUID() }) ||
    environment.GITHUB_ACTIONS === "true"
  )
    fail("SCOPE_INVALID");
  const common = commonDirectory(root);
  mkdirSync(common, { recursive: true });
  const lock = path.join(common, "crossdeck-r13-readiness-reservation.lock");
  writeFileSync(lock, JSON.stringify({ ownerPid: process.pid, stage, candidateSha }) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  try {
    for (const suffix of ["", "-launch"])
      if (existsSync(path.join(common, `crossdeck-r13-focused-${stage}${suffix}.json`))) fail("CASE_ALREADY_CONSUMED");
    const history = allAttempts(root);
    if (
      history.some((entry) => entry.binding.recordDigest !== expected.recordDigest || entry.binding.baseSha !== baseSha)
    )
      fail("CAMPAIGN_CHANGED");
    for (const entry of history) {
      if (!existsSync(entry.paths.receipt)) fail("PRIOR_ATTEMPT_NONTERMINAL");
      validateReadinessReceipt({ root: entry.root, record, stage: entry.stage, receipt: json(entry.paths.receipt) });
    }
    const attempt = history.filter((entry) => entry.stage === stage).length + 1;
    if (attempt > 3 || history.length >= 6) fail("ATTEMPTS_EXHAUSTED");
    const startedAt = new Date().toISOString();
    const nonce = randomUUID().replaceAll("-", "");
    const databaseUrl = `file:${path.join(root, "artifacts", "sounding-line", `generic-${candidateSha.slice(0, 12)}`, `validation-isolated-${startedAt.slice(0, 10).replaceAll("-", "")}-${startedAt.slice(11, 23).replaceAll(/[:.]/gu, "")}-${nonce}.db`).replaceAll("\\", "/")}`;
    const marker = {
      version: 1,
      classification: READINESS_POLICY.classification,
      status: "RESERVED",
      policyDigest: READINESS_POLICY_DIGEST,
      root,
      stage,
      attempt,
      ownerPid: process.pid,
      startedAt,
      databaseUrl,
      binding: { ...expected, attempt, lease: randomUUID() },
    };
    const file = markerPath(root, stage, attempt);
    persist(file, marker);
    const result = context(marker, file);
    if (existsSync(result.paths.directory)) fail("OUTPUT_ALREADY_EXISTS");
    mkdirSync(result.paths.directory, { recursive: true });
    return result;
  } finally {
    unlinkSync(lock);
  }
}
export function loadReadinessAttempt({ root, stage, attempt, environment = process.env, phase = "readiness" }) {
  root = path.resolve(root);
  const file = markerPath(root, stage, Number(attempt));
  const marker = inspectMarker(json(file));
  if (marker.root !== root) fail("WORKSPACE_CHANGED");
  const result = context(marker, file);
  if (phase === "case") {
    const history = allAttempts(root).filter((entry) => entry.stage === stage);
    if (history.at(-1)?.attempt !== result.attempt) fail("LATEST_PASS_REQUIRED");
    result.receipt = validateReadinessReceipt({
      root,
      record: { id: marker.binding.exceptionId },
      stage,
      receipt: json(result.paths.receipt),
    });
    if (result.receipt.status !== "PASS") fail("LATEST_PASS_REQUIRED");
    return result;
  }
  if (phase !== "readiness") fail("PHASE_INVALID");
  requireLease(result, environment);
  persist(result.paths.launch, {
    version: 1,
    classification: READINESS_POLICY.classification,
    binding: marker.binding,
    ownerPid: process.pid,
    parentPid: marker.ownerPid,
    launchedAt: new Date().toISOString(),
  });
  return result;
}
function profileScope(environment) {
  const forbidden =
    /^(?:NODE_OPTIONS|NODE_PATH|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.*|GH_TOKEN|GITHUB_TOKEN|GITHUB_ACTIONS|AWS_.*|OPENAI_.*|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|all_proxy|no_proxy|PRISMA_.*|BINARY_DOWNLOAD_VERSION|XDG_CACHE_HOME|CACHE_DIR|CROSSDECK_.*|PLAYWRIGHT_BASE_URL|PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH|SOUNDING_LINE_EXCEPTION_LEASE)$/u;
  if (Object.entries(environment).some(([key, value]) => forbidden.test(key) || typeof value !== "string"))
    fail("PROFILE_ENVIRONMENT_FORBIDDEN");
  if (
    environment.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    environment.FOREVER_VALIDATION_ISOLATION !== "1" ||
    environment.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    environment.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER !== "SYNTHETIC_OUTBOX" ||
    environment.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER !== "TASK_OWNED_TEST"
  )
    fail("PROFILE_ENVIRONMENT_CHANGED");
}
export function sealReadinessProfileContext({ attempt, profileEnvironment }) {
  unchangedReservation(attempt);
  profileScope(profileEnvironment);
  if (profileEnvironment.DATABASE_URL !== attempt.paths.databaseUrl) fail("PROFILE_DATABASE_CHANGED");
  const environment = sortedEnvironment({ ...ambientEnvironment(process.env), ...profileEnvironment });
  if (hash(JSON.stringify(ambientEnvironment(environment))) !== attempt.binding.environmentDigest)
    fail("AMBIENT_ENVIRONMENT_CHANGED");
  persist(attempt.paths.privateContext, { version: 1, binding: attempt.binding, environment });
  const seal = {
    version: 1,
    binding: attempt.binding,
    databaseUrl: attempt.paths.databaseUrl,
    profileContextSha256: hash(bytes(attempt.paths.privateContext)),
    environmentSha256: hash(JSON.stringify(environment)),
    environmentKeys: Object.keys(environment),
  };
  persist(attempt.paths.contextSeal, seal);
  return { path: attempt.paths.privateContext, sha256: seal.profileContextSha256, seal };
}
export function readReadinessProfileContext({ attempt, environment = process.env, phase = "readiness" }) {
  unchangedReservation(attempt);
  if (phase === "readiness") requireLease(attempt, environment);
  else if (phase === "case") {
    const history = allAttempts(attempt.root).filter((entry) => entry.stage === attempt.stage);
    if (!history.length || history.at(-1).attempt !== attempt.attempt) fail("LATEST_PASS_REQUIRED");
    const receipt = json(attempt.paths.receipt);
    validateReadinessReceipt({
      root: attempt.root,
      record: { id: attempt.binding.exceptionId },
      stage: attempt.stage,
      receipt,
    });
    if (receipt.status !== "PASS") fail("LATEST_PASS_REQUIRED");
  } else fail("PHASE_INVALID");
  const seal = json(attempt.paths.contextSeal);
  const privateBytes = bytes(attempt.paths.privateContext);
  const value = JSON.parse(privateBytes);
  if (
    !same(value.binding, attempt.binding) ||
    !same(seal.binding, attempt.binding) ||
    hash(privateBytes) !== seal.profileContextSha256 ||
    hash(JSON.stringify(value.environment)) !== seal.environmentSha256 ||
    !same(Object.keys(value.environment), seal.environmentKeys)
  )
    fail("PROFILE_CONTEXT_CHANGED");
  profileScope(value.environment);
  if (value.environment.DATABASE_URL !== attempt.paths.databaseUrl) fail("PROFILE_DATABASE_CHANGED");
  if (hash(JSON.stringify(ambientEnvironment(environment))) !== attempt.binding.environmentDigest)
    fail("AMBIENT_ENVIRONMENT_CHANGED");
  if (phase === "readiness") {
    const actual = { ...environment };
    for (const key of ["SOUNDING_LINE_READINESS_LEASE", "SOUNDING_LINE_READINESS_MARKER", "LC_CTYPE"])
      delete actual[key];
    if (!same(sortedEnvironment(actual), value.environment)) fail("EFFECTIVE_ENVIRONMENT_CHANGED");
  }
  return value.environment;
}
function publicFile(file) {
  return { path: file, sha256: hash(bytes(file)) };
}
function checkedEngineInventory(root, environment) {
  const packages = ["prisma", "@prisma/client", "@prisma/engines"].map((name) => {
    const file = path.join(root, "node_modules", name, "package.json");
    const version = json(file).version;
    if (version !== READINESS_DEPENDENCIES.prismaVersion) fail("PRISMA_PACKAGE_VERSION_CHANGED");
    return { name, version, ...publicFile(file) };
  });
  const engineVersionFile = path.join(root, "node_modules/@prisma/engines-version/package.json");
  if (
    json(engineVersionFile).prisma?.enginesVersion !== READINESS_DEPENDENCIES.engineVersion ||
    git(root, "hash-object", "package-lock.json") !== READINESS_DEPENDENCIES.lockBlob
  )
    fail("LOCKED_ENGINE_VERSION_CHANGED");
  packages.push({ name: "@prisma/engines-version", ...publicFile(engineVersionFile) });
  const engines = [];
  for (const directory of ["node_modules/@prisma/engines", "node_modules/prisma"])
    for (const engine of READINESS_DEPENDENCIES.engines) {
      const file = path.join(root, directory, engine.file);
      const entry = { name: engine.name, ...publicFile(file) };
      if (entry.sha256 !== engine.sha256) fail("OFFICIAL_ENGINE_HASH_CHANGED");
      engines.push(entry);
    }
  const homeDirectory = environment.HOME ?? environment.USERPROFILE ?? os.homedir();
  const cacheDirectory = path.join(
    homeDirectory,
    ".cache/prisma/master",
    READINESS_DEPENDENCIES.engineVersion,
    READINESS_DEPENDENCIES.platform,
  );
  const cache = READINESS_DEPENDENCIES.engines.map((engine) => {
    const file = path.join(cacheDirectory, engine.name);
    if (!existsSync(file)) {
      if (existsSync(`${file}.sha256`) || existsSync(`${file}.gz.sha256`)) fail("DANGLING_CACHE_CHECKSUM");
      return { name: engine.name, path: file, status: "ABSENT" };
    }
    const entry = publicFile(file);
    const checksumFile = `${file}.sha256`;
    if (
      entry.sha256 !== engine.sha256 ||
      !existsSync(checksumFile) ||
      bytes(checksumFile).toString("utf8") !== engine.sha256
    )
      fail("CACHE_INTEGRITY_CHANGED");
    if (existsSync(`${file}.gz.sha256`) && bytes(`${file}.gz.sha256`).toString("utf8") !== engine.gzipSha256)
      fail("CACHE_GZIP_CHECKSUM_CHANGED");
    return {
      name: engine.name,
      ...entry,
      status: "VALID",
      checksum: publicFile(checksumFile),
      ...(existsSync(`${file}.gz.sha256`) ? { gzipChecksum: publicFile(`${file}.gz.sha256`) } : {}),
    };
  });
  return {
    packages,
    engines,
    cache,
    lockBlob: READINESS_DEPENDENCIES.lockBlob,
    engineVersion: READINESS_DEPENDENCIES.engineVersion,
    platform: READINESS_DEPENDENCIES.platform,
  };
}
export async function runNativeDependencyChecks({ attempt, environment = process.env }) {
  const result = {
    version: 1,
    binding: attempt.binding,
    classification: READINESS_POLICY.classification,
    status: "FAIL",
    startedAt: new Date().toISOString(),
  };
  try {
    const profileEnvironment = readReadinessProfileContext({ attempt, environment });
    if (process.platform !== "linux" || process.arch !== "x64") fail("NATIVE_PLATFORM_CHANGED");
    result.inventory = checkedEngineInventory(attempt.root, profileEnvironment);
    result.versions = [];
    for (const directory of ["node_modules/@prisma/engines", "node_modules/prisma"])
      for (const engine of READINESS_DEPENDENCIES.engines) {
        const file = path.join(attempt.root, directory, engine.file);
        const command = engine.name === "libquery-engine" ? process.execPath : file;
        const argumentsList =
          engine.name === "libquery-engine"
            ? [
                "-e",
                'const engine = require(process.argv[1]); process.stdout.write(JSON.stringify({commit: engine.version().commit}) + "\\n");',
                file,
              ]
            : ["--version"];
        const output = execFileSync(command, argumentsList, {
          cwd: attempt.root,
          env: profileEnvironment,
          encoding: "utf8",
          timeout: 15000,
          maxBuffer: 1024 * 1024,
        }).trim();
        const version = engine.name === "libquery-engine" ? JSON.parse(output).commit : output;
        if (
          engine.name === "libquery-engine"
            ? version !== READINESS_DEPENDENCIES.engineVersion
            : !version.split(/\s+/u).includes(READINESS_DEPENDENCIES.engineVersion)
        )
          fail("NATIVE_VERSION_CHANGED");
        result.versions.push({
          name: engine.name,
          path: file,
          version,
          command,
          arguments: argumentsList,
          stdout: output,
        });
      }
    // Recheck the bytes after native loading and version subprocesses.
    if (!same(result.inventory, checkedEngineInventory(attempt.root, profileEnvironment))) fail("NATIVE_INPUT_CHANGED");
    result.status = "PASS";
    return result;
  } catch (error) {
    result.error = errorRecord(error);
    throw error;
  } finally {
    result.completedAt = new Date().toISOString();
    persist(attempt.paths.nativeReceipt, result);
  }
}
function systemLibraryMetadata() {
  const libraries = [
    "libnss3.so",
    "libnspr4.so",
    "libatk-1.0.so.0",
    "libatk-bridge-2.0.so.0",
    "libX11.so.6",
    "libxcb.so.1",
    "libxkbcommon.so.0",
    "libgbm.so.1",
    "libasound.so.2",
    "libcups.so.2",
    "libdrm.so.2",
    "libpango-1.0.so.0",
    "libcairo.so.2",
    "libatspi.so.0",
    "libglib-2.0.so.0",
    "libgio-2.0.so.0",
    "libdbus-1.so.3",
    "libexpat.so.1",
  ];
  return {
    platform: process.platform,
    architecture: process.arch,
    release: os.release(),
    osRelease: existsSync("/etc/os-release") ? publicFile("/etc/os-release") : null,
    libraries: libraries.map((name) => {
      const file = path.join("/usr/lib/x86_64-linux-gnu", name);
      return existsSync(file) ? { name, ...publicFile(realpathSync(file)) } : { name, status: "ABSENT" };
    }),
  };
}
export function readinessDependencyManifest(root) {
  const entries = [];
  const visit = (relative) => {
    const file = path.join(root, relative),
      stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      const resolved = realpathSync(file);
      const containment = path.relative(path.join(root, "node_modules"), resolved);
      if (containment.startsWith("..") || path.isAbsolute(containment)) fail("DEPENDENCY_SYMLINK_ESCAPES");
      if (
        lstatSync(resolved).isDirectory() &&
        (resolved === path.dirname(file) || path.dirname(file).startsWith(`${resolved}${path.sep}`))
      )
        fail("DEPENDENCY_SYMLINK_CYCLE");
      entries.push({
        path: relative.replaceAll("\\", "/"),
        type: "symlink",
        target: readlinkSync(file),
        mode: stat.mode & 0o777,
      });
    } else if (stat.isDirectory()) {
      entries.push({ path: relative.replaceAll("\\", "/"), type: "directory", mode: stat.mode & 0o777 });
      for (const name of readdirSync(file).sort()) visit(path.join(relative, name));
    } else if (stat.isFile())
      entries.push({
        path: relative.replaceAll("\\", "/"),
        type: "file",
        mode: stat.mode & 0o777,
        sha256: hash(readFileSync(file)),
      });
    else fail("DEPENDENCY_FILE_TYPE_FORBIDDEN");
  };
  if (existsSync(path.join(root, "node_modules"))) visit("node_modules");
  return entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
function inspectDependencyManifest(manifest, binding) {
  if (
    manifest?.version !== 1 ||
    !same(manifest.binding, binding) ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length === 0 ||
    hash(JSON.stringify(manifest.entries)) !== manifest.treeSha256 ||
    !same(
      manifest.entries.map((entry) => entry.path),
      manifest.entries.map((entry) => entry.path).sort(),
    ) ||
    new Set(manifest.entries.map((entry) => entry.path)).size !== manifest.entries.length ||
    manifest.entries.some(
      (entry) =>
        !(entry.path === "node_modules" || entry.path.startsWith("node_modules/")) ||
        path.posix.normalize(entry.path) !== entry.path ||
        !["file", "directory", "symlink"].includes(entry.type) ||
        (entry.type === "file" && !digest.test(entry.sha256 ?? "")) ||
        (entry.type === "symlink" && typeof entry.target !== "string"),
    )
  )
    fail("DEPENDENCY_MANIFEST_CHANGED");
  return manifest;
}
export async function runBrowserDependencyProbe({ attempt, environment = process.env }) {
  const result = {
    version: 1,
    binding: attempt.binding,
    classification: READINESS_POLICY.classification,
    status: "FAIL",
    probe: READINESS_POLICY.browserProbe,
    contexts: 0,
    pages: 0,
    captures: 0,
    startedAt: new Date().toISOString(),
  };
  let browser;
  try {
    const profileEnvironment = readReadinessProfileContext({ attempt, environment });
    const require = createRequire(path.join(attempt.root, "package.json"));
    const packageFile = path.join(attempt.root, "node_modules/playwright-core/package.json");
    if (json(packageFile).version !== READINESS_DEPENDENCIES.playwrightVersion) fail("PLAYWRIGHT_VERSION_CHANGED");
    const browsersFile = path.join(attempt.root, "node_modules/playwright-core/browsers.json");
    const descriptors = json(browsersFile).browsers;
    if (
      ["chromium", "chromium-headless-shell"].some(
        (name) =>
          descriptors.find((entry) => entry.name === name)?.revision !== READINESS_DEPENDENCIES.chromiumRevision,
      )
    )
      fail("CHROMIUM_REVISION_CHANGED");
    const { registry, registryDirectory } = require(
      path.join(attempt.root, "node_modules/playwright-core/lib/server/registry/index.js"),
    );
    result.dependencies = {
      package: publicFile(packageFile),
      browsers: publicFile(browsersFile),
      cacheDirectory: registryDirectory,
      revision: READINESS_DEPENDENCIES.chromiumRevision,
      executables: ["chromium", "chromium-headless-shell"].map((name) => ({
        name,
        ...publicFile(registry.findExecutable(name).executablePath()),
      })),
      system: systemLibraryMetadata(),
    };
    const { chromium } = require("playwright");
    browser = await chromium.launch({ headless: true, env: profileEnvironment, timeout: 20000 });
    if (browser.contexts().length !== 0) fail("BROWSER_CONTEXT_FORBIDDEN");
    await bounded(() => browser.close(), 10000, "PRODUCT_EXPERIENCE_DEPENDENCY_READINESS_BROWSER_CLOSE_TIMEOUT");
    result.cleanup = { status: "PASS", browserClosed: !browser.isConnected() };
    if (!result.cleanup.browserClosed) fail("BROWSER_CLEANUP_FAILED");
    for (const executable of result.dependencies.executables)
      if (hash(bytes(executable.path)) !== executable.sha256) fail("BROWSER_INPUT_CHANGED");
    result.status = "PASS";
    return result;
  } catch (error) {
    result.error = errorRecord(error);
    throw error;
  } finally {
    if (browser?.isConnected()) {
      try {
        await bounded(() => browser.close(), 10000, "PRODUCT_EXPERIENCE_DEPENDENCY_READINESS_BROWSER_CLEANUP_TIMEOUT");
      } catch (error) {
        result.cleanup = { status: "FAIL", error: errorRecord(error) };
      }
    }
    result.completedAt = new Date().toISOString();
    persist(attempt.paths.browserReceipt, result);
  }
}
function inspectTerminal(receipt, record, stage) {
  if (
    receipt?.version !== 1 ||
    receipt.classification !== READINESS_POLICY.classification ||
    receipt.policyDigest !== READINESS_POLICY_DIGEST ||
    !terminal.has(receipt.status) ||
    !validBinding(receipt.binding) ||
    receipt.binding.exceptionId !== record.id ||
    receipt.binding.stage !== stage ||
    receipt.productJourneys !== 0 ||
    receipt.productCaptures !== 0 ||
    receipt.providerCalls !== 0
  )
    fail("RECEIPT_SCOPE_CHANGED");
  if (
    !Array.isArray(receipt.unparsedOutputs ?? []) ||
    (receipt.unparsedOutputs ?? []).some((key) => !receipt.outputErrors?.some((entry) => entry.key === key)) ||
    (receipt.status === "PASS" &&
      ((receipt.outputErrors?.length ?? 0) > 0 || (receipt.unparsedOutputs?.length ?? 0) > 0))
  )
    fail("OUTPUT_DIAGNOSTICS_CHANGED");
  if (
    receipt.status === "PASS" &&
    (receipt.cleanup?.status !== "PASS" ||
      receipt.setupStatus !== "PASS" ||
      receipt.execution?.exitCode !== 0 ||
      receipt.execution?.cancelled !== false ||
      receipt.execution?.cleanup?.status !== "PASS" ||
      receipt.native?.status !== "PASS" ||
      receipt.browser?.status !== "PASS" ||
      !same(
        receipt.setup?.map(({ id }) => id),
        READINESS_POLICY.genericSetup,
      ) ||
      receipt.setup.some((entry) => entry.status !== "PASS" || entry.exitCode !== 0) ||
      !digest.test(receipt.context?.environmentSha256 ?? "") ||
      !digest.test(receipt.context?.profileContextSha256 ?? "") ||
      !digest.test(receipt.dependencyTreeSha256 ?? ""))
  )
    fail("PASS_INCOMPLETE");
  if (receipt.status === "PASS") {
    const native = receipt.native,
      browser = receipt.browser;
    if (
      native.classification !== READINESS_POLICY.classification ||
      browser.classification !== READINESS_POLICY.classification ||
      native.inventory?.lockBlob !== READINESS_DEPENDENCIES.lockBlob ||
      native.inventory?.engineVersion !== READINESS_DEPENDENCIES.engineVersion ||
      native.inventory?.platform !== READINESS_DEPENDENCIES.platform ||
      native.inventory?.engines?.length !== 4 ||
      native.versions?.length !== 4 ||
      native.inventory.engines.some(
        (entry) =>
          !READINESS_DEPENDENCIES.engines.some(
            (engine) => engine.name === entry.name && engine.sha256 === entry.sha256,
          ),
      ) ||
      native.inventory?.cache?.length !== 2 ||
      native.inventory.cache.some((entry) => !["ABSENT", "VALID"].includes(entry.status)) ||
      browser.probe !== READINESS_POLICY.browserProbe ||
      browser.contexts !== 0 ||
      browser.pages !== 0 ||
      browser.captures !== 0 ||
      browser.cleanup?.status !== "PASS" ||
      browser.cleanup?.browserClosed !== true ||
      browser.dependencies?.revision !== READINESS_DEPENDENCIES.chromiumRevision ||
      browser.dependencies?.executables?.length !== 2 ||
      browser.dependencies.executables.some((entry) => !digest.test(entry.sha256 ?? ""))
    )
      fail("PASS_DEPENDENCY_SCOPE_CHANGED");
    const expectedArguments = [
      ["node_modules/prisma/build/index.js", "generate", "--schema", READINESS_POLICY.schema],
      ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", receipt.context.databaseUrl],
      ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
      ["node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts"],
      ["scripts/sounding-line/prepare-validation-isolation.mjs"],
      ["node_modules/next/dist/bin/next", "build"],
    ];
    if (
      receipt.setup.some(
        (entry, index) => !path.isAbsolute(entry.command ?? "") || !same(entry.arguments, expectedArguments[index]),
      )
    )
      fail("PASS_COMMAND_SCOPE_CHANGED");
  }
  return receipt;
}
function inspectProbeBindings(receipt, marker) {
  for (const value of [receipt.native, receipt.browser, receipt.context])
    if (value && !same(value.binding, marker.binding)) fail("PROBE_BINDING_CHANGED");
  if (receipt.context && receipt.context.databaseUrl !== marker.databaseUrl) fail("CONTEXT_DATABASE_CHANGED");
  if (receipt.status !== "PASS") return;
  const expected = ["node_modules/@prisma/engines", "node_modules/prisma"].flatMap((directory) =>
    READINESS_DEPENDENCIES.engines.map((engine) => ({
      name: engine.name,
      path: path.join(marker.root, directory, engine.file),
      sha256: engine.sha256,
    })),
  );
  if (
    !same(
      receipt.native.inventory.engines.map(({ name, path: enginePath, sha256 }) => ({
        name,
        path: enginePath,
        sha256,
      })),
      expected,
    )
  )
    fail("NATIVE_ENGINE_IDENTITIES_CHANGED");
  if (
    receipt.native.versions.some(
      (entry, index) =>
        entry.name !== expected[index].name ||
        entry.path !== expected[index].path ||
        (entry.name === "libquery-engine"
          ? entry.version !== READINESS_DEPENDENCIES.engineVersion
          : typeof entry.version !== "string" ||
            !entry.version.split(/\s+/u).includes(READINESS_DEPENDENCIES.engineVersion)),
    )
  )
    fail("NATIVE_VERSION_IDENTITIES_CHANGED");
  if (
    !same(
      receipt.browser.dependencies.executables.map(({ name }) => name),
      ["chromium", "chromium-headless-shell"],
    )
  )
    fail("BROWSER_IDENTITIES_CHANGED");
}
export function completeReadinessAttempt({ attempt, status, error, execution, cleanup }) {
  unchangedReservation(attempt);
  if (process.pid !== attempt.marker.ownerPid) fail("PARENT_COMPLETION_REQUIRED");
  if (!terminal.has(status)) fail("TERMINAL_STATUS_REQUIRED");
  // Probe results are owned immutable files, never accepted solely from caller objects.
  const outputErrors = [];
  const unparsedOutputs = [];
  const capture = (key, operation) => {
    try {
      return operation();
    } catch (cause) {
      outputErrors.push({ key, ...errorRecord(cause) });
      unparsedOutputs.push(key);
      return null;
    }
  };
  const captureJson = (key) =>
    existsSync(attempt.paths[key])
      ? capture(key, () => {
          const value = json(attempt.paths[key]);
          if (!value || typeof value !== "object" || Array.isArray(value)) fail("OUTPUT_JSON_INVALID");
          if (key !== "setupReceipt" && !same(value.binding, attempt.binding)) fail("OUTPUT_BINDING_CHANGED");
          if (key === "setupReceipt" && (!Array.isArray(value.steps) || !["PASS", "FAIL"].includes(value.status)))
            fail("SETUP_JSON_INVALID");
          return value;
        })
      : null;
  captureJson("launch");
  const nativeResult = captureJson("nativeReceipt");
  const browserResult = captureJson("browserReceipt");
  const setupResult = captureJson("setupReceipt");
  const setup = setupResult?.steps ?? [];
  const contextSeal = captureJson("contextSeal");
  const dependencyManifest = capture("dependencyManifest", () => {
    const dependencyEntries = readinessDependencyManifest(attempt.root);
    const value = {
      version: 1,
      binding: attempt.binding,
      entries: dependencyEntries,
      treeSha256: hash(JSON.stringify(dependencyEntries)),
    };
    persist(attempt.paths.dependencyManifest, value);
    return value;
  });
  const files = {};
  for (const key of [
    "marker",
    "launch",
    "contextSeal",
    "nativeReceipt",
    "browserReceipt",
    "setupReceipt",
    "dependencyManifest",
    "stdout",
    "stderr",
  ])
    if (existsSync(attempt.paths[key])) {
      const entry = capture(key, () => publicFile(attempt.paths[key]));
      if (entry) files[key] = entry;
    }
  const receipt = {
    version: 1,
    classification: READINESS_POLICY.classification,
    policyDigest: READINESS_POLICY_DIGEST,
    status: outputErrors.length ? "UNKNOWN" : status,
    binding: attempt.binding,
    startedAt: attempt.marker.startedAt,
    completedAt: new Date().toISOString(),
    productJourneys: 0,
    productCaptures: 0,
    providerCalls: 0,
    native: nativeResult,
    browser: browserResult,
    setup,
    setupStatus: setupResult?.status ?? "NOT_STARTED",
    cleanup: cleanup ?? { status: "UNKNOWN" },
    context: contextSeal,
    dependencyTreeSha256: dependencyManifest?.treeSha256 ?? null,
    outputErrors,
    unparsedOutputs: [...new Set(unparsedOutputs)],
    execution: execution ?? null,
    ...(error ? { error: errorRecord(error) } : {}),
    files,
  };
  try {
    inspectTerminal(receipt, { id: attempt.binding.exceptionId }, attempt.stage);
    inspectProbeBindings(receipt, attempt.marker);
    if (receipt.status === "PASS") inspectDependencyManifest(dependencyManifest, attempt.binding);
    if (
      receipt.status === "PASS" &&
      (setupResult?.status !== "PASS" ||
        !["launch", "contextSeal", "nativeReceipt", "browserReceipt", "setupReceipt", "stdout", "stderr"].every(
          (key) => receipt.files[key],
        ))
    )
      fail("PASS_OUTPUT_MISSING");
  } catch (completionError) {
    receipt.status = "UNKNOWN";
    receipt.completionError = errorRecord(completionError);
  }
  persist(attempt.paths.receipt, receipt);
  return receipt;
}
export function validateReadinessReceipt({ root, revision, record, stage, receipt }) {
  if (receipt?.publication === true) return validatePublished({ root, revision, record, stage, receipt });
  inspectTerminal(receipt, record, stage);
  for (const entry of Object.values(receipt.files ?? {}))
    if (!entry || !digest.test(entry.sha256 ?? "") || hash(bytes(entry.path)) !== entry.sha256)
      fail("OUTPUT_HASH_CHANGED");
  const marker = json(receipt.files?.marker?.path ?? "");
  inspectMarker(marker);
  if (!same(marker.binding, receipt.binding)) fail("RECEIPT_BINDING_CHANGED");
  inspectProbeBindings(receipt, marker);
  for (const probe of [receipt.native, receipt.browser])
    if (probe && !same(probe.binding, receipt.binding)) fail("PROBE_BINDING_CHANGED");
  if (receipt.context && !same(receipt.context.binding, receipt.binding)) fail("CONTEXT_BINDING_CHANGED");
  if (receipt.files.launch && !(receipt.status !== "PASS" && receipt.unparsedOutputs?.includes("launch"))) {
    const launch = json(receipt.files.launch.path);
    if (
      !same(launch.binding, receipt.binding) ||
      launch.parentPid !== marker.ownerPid ||
      !Number.isInteger(launch.ownerPid) ||
      launch.ownerPid <= 0
    )
      fail("LAUNCH_BINDING_CHANGED");
  }
  for (const [key, value] of [
    ["nativeReceipt", receipt.native],
    ["browserReceipt", receipt.browser],
    ["contextSeal", receipt.context],
  ])
    if (
      receipt.files[key] &&
      !(receipt.status !== "PASS" && receipt.unparsedOutputs?.includes(key)) &&
      !same(json(receipt.files[key].path), value)
    )
      fail("PROBE_RESULT_CHANGED");
  if (
    receipt.files.setupReceipt &&
    !(receipt.status !== "PASS" && receipt.unparsedOutputs?.includes("setupReceipt")) &&
    (!same(json(receipt.files.setupReceipt.path).steps, receipt.setup) ||
      json(receipt.files.setupReceipt.path).status !== receipt.setupStatus)
  )
    fail("SETUP_RESULT_CHANGED");
  if (receipt.status === "PASS") {
    const dependencies = inspectDependencyManifest(json(receipt.files.dependencyManifest?.path ?? ""), receipt.binding);
    if (dependencies.treeSha256 !== receipt.dependencyTreeSha256) fail("DEPENDENCY_MANIFEST_CHANGED");
  }
  if (
    receipt.status === "PASS" &&
    (!receipt.files.launch ||
      !receipt.files.contextSeal ||
      !receipt.files.nativeReceipt ||
      !receipt.files.browserReceipt ||
      !receipt.files.setupReceipt ||
      !receipt.files.stdout ||
      !receipt.files.stderr)
  )
    fail("PASS_OUTPUT_MISSING");
  return receipt;
}
export function requireLatestReadinessPASS({
  root,
  baseSha,
  candidateSha,
  stage,
  manifest,
  record = { id: exceptionId },
  environment = process.env,
}) {
  root = path.resolve(root);
  const expected = expectedBinding({ baseSha, candidateSha, stage, manifest, record, environment });
  const history = allAttempts(root);
  for (const entry of history) {
    if (
      entry.binding.recordDigest !== expected.recordDigest ||
      entry.binding.baseSha !== baseSha ||
      !existsSync(entry.paths.receipt)
    )
      fail("HISTORY_NOT_TERMINAL");
    const receipt = json(entry.paths.receipt);
    validateReadinessReceipt({ root: entry.root, record, stage: entry.stage, receipt });
    if (!same(receipt.binding, entry.binding)) fail("RECEIPT_BINDING_CHANGED");
  }
  const current = history.filter((entry) => entry.stage === stage).at(-1);
  if (!current || !matchesExpected(current.binding, expected)) fail("LATEST_SOURCE_CHANGED");
  const receipt = json(current.paths.receipt);
  if (receipt.status !== "PASS") fail("LATEST_PASS_REQUIRED");
  const profileEnvironment = readReadinessProfileContext({ attempt: current, environment, phase: "case" });
  if (!same(checkedEngineInventory(root, profileEnvironment), receipt.native.inventory))
    fail("CURRENT_DEPENDENCIES_CHANGED");
  if (hash(JSON.stringify(readinessDependencyManifest(root))) !== receipt.dependencyTreeSha256)
    fail("CURRENT_DEPENDENCY_TREE_CHANGED");
  for (const executable of receipt.browser.dependencies.executables)
    if (hash(bytes(executable.path)) !== executable.sha256) fail("CURRENT_BROWSER_CHANGED");
  for (const key of ["package", "browsers"])
    if (hash(bytes(receipt.browser.dependencies[key].path)) !== receipt.browser.dependencies[key].sha256)
      fail("CURRENT_BROWSER_PACKAGE_CHANGED");
  if (!same(systemLibraryMetadata(), receipt.browser.dependencies.system)) fail("CURRENT_SYSTEM_LIBRARIES_CHANGED");
  return { ...current, receipt };
}
export function publishReadinessEvidence({ attempt, publicationRoot }) {
  const destination = path.resolve(attempt.root, publicationRoot, "dependency-readiness");
  const relative = path.relative(attempt.root, destination);
  if (relative.replaceAll("\\", "/") !== publicationDirectory(attempt.stage)) fail("PUBLICATION_PATH_INVALID");
  const history = allAttempts(attempt.root).filter((entry) => entry.stage === attempt.stage);
  if (!history.length || history.at(-1).attempt !== attempt.attempt) fail("LATEST_PASS_REQUIRED");
  const attempts = [];
  for (const entry of history) {
    const receipt = json(entry.paths.receipt);
    validateReadinessReceipt({
      root: entry.root,
      record: { id: entry.binding.exceptionId },
      stage: entry.stage,
      receipt,
    });
    const files = {};
    for (const key of [
      "marker",
      "launch",
      "receipt",
      "contextSeal",
      "nativeReceipt",
      "browserReceipt",
      "setupReceipt",
      "dependencyManifest",
      "stdout",
      "stderr",
    ]) {
      const source = entry.paths[key];
      if (!existsSync(source)) continue;
      const target = path.join(
        destination,
        `attempt-${entry.attempt}`,
        `${key}${["stdout", "stderr"].includes(key) ? ".txt" : ".json"}`,
      );
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes(source), { flag: "wx" });
      files[key] = { path: path.relative(attempt.root, target).replaceAll("\\", "/"), sha256: hash(bytes(target)) };
    }
    attempts.push({ attempt: entry.attempt, binding: entry.binding, status: receipt.status, files });
  }
  if (attempts.at(-1)?.status !== "PASS") fail("LATEST_PASS_REQUIRED");
  const result = {
    version: 1,
    publication: true,
    classification: READINESS_POLICY.classification,
    policyDigest: READINESS_POLICY_DIGEST,
    stage: attempt.stage,
    attempt: attempt.attempt,
    receiptSha256: hash(bytes(attempt.paths.receipt)),
    proofRoot: attempt.root,
    databaseUrl: attempt.paths.databaseUrl,
    binding: attempt.binding,
    attempts,
  };
  const target = path.join(destination, "readiness-index.json");
  persist(target, result);
  const index = { path: path.relative(attempt.root, target).replaceAll("\\", "/"), sha256: hash(bytes(target)) };
  return {
    ...result,
    index,
    files: [...attempts.flatMap((entry) => Object.values(entry.files)), index].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
  };
}
function validatePublished({ root, revision, record, stage, receipt }) {
  if (
    receipt.version !== 1 ||
    receipt.classification !== READINESS_POLICY.classification ||
    receipt.policyDigest !== READINESS_POLICY_DIGEST ||
    receipt.stage !== stage ||
    !validBinding(receipt.binding) ||
    receipt.binding.exceptionId !== record.id ||
    !Array.isArray(receipt.attempts) ||
    receipt.attempts.length < 1 ||
    receipt.attempts.length > 3 ||
    !receipt.index
  )
    fail("PUBLICATION_SCOPE_CHANGED");
  const read = (entry) => {
    if (
      !entry ||
      !digest.test(entry.sha256 ?? "") ||
      typeof entry.path !== "string" ||
      path.posix.normalize(entry.path) !== entry.path ||
      entry.path.startsWith("../") ||
      path.isAbsolute(entry.path)
    )
      fail("PUBLICATION_FILE_INVALID");
    const value = revision
      ? (() => {
          if (!/^100644 blob [a-f0-9]{40}\t/u.test(git(root, "ls-tree", revision, "--", entry.path)))
            fail("PUBLICATION_REGULAR_FILE_REQUIRED");
          return execFileSync("git", ["show", `${revision}:${entry.path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
        })()
      : bytes(path.join(root, entry.path));
    if (hash(value) !== entry.sha256) fail("PUBLICATION_HASH_CHANGED");
    return value;
  };
  for (const [index, entry] of receipt.attempts.entries()) {
    if (entry.attempt !== index + 1 || entry.binding.stage !== stage || !validBinding(entry.binding))
      fail("PUBLICATION_HISTORY_CHANGED");
    const scope = (binding) =>
      Object.fromEntries(Object.entries(binding).filter(([key]) => !["attempt", "lease"].includes(key)));
    if (!same(scope(entry.binding), scope(receipt.binding))) fail("PUBLICATION_SOURCE_CHANGED");
    for (const [key, file] of Object.entries(entry.files)) {
      if (
        ![
          "marker",
          "launch",
          "receipt",
          "contextSeal",
          "nativeReceipt",
          "browserReceipt",
          "setupReceipt",
          "dependencyManifest",
          "stdout",
          "stderr",
        ].includes(key) ||
        file.path !==
          `${publicationDirectory(stage)}/attempt-${entry.attempt}/${key}${["stdout", "stderr"].includes(key) ? ".txt" : ".json"}`
      )
        fail("PUBLICATION_PATH_CHANGED");
      read(file);
    }
    const marker = JSON.parse(read(entry.files.marker));
    const terminalReceipt = JSON.parse(read(entry.files.receipt));
    inspectMarker(marker);
    inspectTerminal(terminalReceipt, record, stage);
    inspectProbeBindings(terminalReceipt, marker);
    if (
      terminalReceipt.status === "PASS" &&
      !["launch", "contextSeal", "nativeReceipt", "browserReceipt", "setupReceipt", "stdout", "stderr"].every(
        (key) => entry.files[key],
      )
    )
      fail("PUBLICATION_OUTPUT_MISSING");
    if (
      !same(marker.binding, entry.binding) ||
      !same(terminalReceipt.binding, entry.binding) ||
      terminalReceipt.status !== entry.status
    )
      fail("PUBLICATION_BINDING_CHANGED");
    if (
      entry.files.launch &&
      !(terminalReceipt.status !== "PASS" && terminalReceipt.unparsedOutputs?.includes("launch"))
    ) {
      const launch = JSON.parse(read(entry.files.launch));
      if (
        !same(launch.binding, entry.binding) ||
        launch.parentPid !== marker.ownerPid ||
        !Number.isInteger(launch.ownerPid) ||
        launch.ownerPid <= 0
      )
        fail("PUBLICATION_LAUNCH_CHANGED");
    }
    for (const key of Object.keys(terminalReceipt.files))
      if (!entry.files[key] || terminalReceipt.files[key].sha256 !== entry.files[key].sha256)
        fail("PUBLICATION_OUTPUT_CHANGED");
    for (const [key, value] of [
      ["nativeReceipt", terminalReceipt.native],
      ["browserReceipt", terminalReceipt.browser],
      ["contextSeal", terminalReceipt.context],
    ])
      if (
        entry.files[key] &&
        !(terminalReceipt.status !== "PASS" && terminalReceipt.unparsedOutputs?.includes(key)) &&
        !same(JSON.parse(read(entry.files[key])), value)
      )
        fail("PUBLICATION_PROBE_CHANGED");
    if (
      entry.files.setupReceipt &&
      !(terminalReceipt.status !== "PASS" && terminalReceipt.unparsedOutputs?.includes("setupReceipt")) &&
      (!same(JSON.parse(read(entry.files.setupReceipt)).steps, terminalReceipt.setup) ||
        JSON.parse(read(entry.files.setupReceipt)).status !== terminalReceipt.setupStatus)
    )
      fail("PUBLICATION_SETUP_CHANGED");
    if (terminalReceipt.status === "PASS") {
      const dependencyManifest = inspectDependencyManifest(
        JSON.parse(read(entry.files.dependencyManifest)),
        entry.binding,
      );
      if (dependencyManifest.treeSha256 !== terminalReceipt.dependencyTreeSha256)
        fail("PUBLICATION_DEPENDENCY_CHANGED");
    }
  }
  if (receipt.attempts.at(-1).status !== "PASS" || !same(receipt.attempts.at(-1).binding, receipt.binding))
    fail("LATEST_PASS_REQUIRED");
  const latestMarker = JSON.parse(read(receipt.attempts.at(-1).files.marker));
  if (receipt.proofRoot !== latestMarker.root || receipt.databaseUrl !== latestMarker.databaseUrl)
    fail("PUBLICATION_WORKSPACE_CHANGED");
  if (
    receipt.attempt !== receipt.attempts.length ||
    receipt.receiptSha256 !== receipt.attempts.at(-1).files.receipt.sha256
  )
    fail("PUBLICATION_TERMINAL_CHANGED");
  const expectedFiles = [...receipt.attempts.flatMap((entry) => Object.values(entry.files)), receipt.index].sort(
    (a, b) => a.path.localeCompare(b.path),
  );
  if (!same(receipt.files, expectedFiles)) fail("PUBLICATION_INVENTORY_CHANGED");
  if (receipt.index) {
    if (receipt.index.path !== `${publicationDirectory(stage)}/readiness-index.json`) fail("PUBLICATION_PATH_CHANGED");
    const index = JSON.parse(read(receipt.index));
    const withoutIndex = { ...receipt };
    delete withoutIndex.index;
    delete withoutIndex.files;
    if (!same(index, withoutIndex)) fail("PUBLICATION_INDEX_CHANGED");
  }
  return receipt;
}
