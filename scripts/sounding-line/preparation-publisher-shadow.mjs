import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { canonicalJson, digest } from "./evidence.mjs";
import { createPreparationCapsuleShadow, verifyPreparationCapsuleShadow } from "./preparation-capsule-shadow.mjs";
import {
  measurePreparationContentShadow,
  inspectPreparationContentShadow,
  restorePreparationObservationModesShadow,
} from "./preparation-content-shadow.mjs";

export const PREPARATION_SHADOW_WORKFLOW = ".github/workflows/sounding-line-preparation-shadow.yml";
export const PREPARATION_PUBLISHER_READERS = Object.freeze([
  "scripts/sounding-line/preparation-publisher-shadow.mjs",
  "scripts/sounding-line/preparation-capsule-shadow.mjs",
  "scripts/sounding-line/preparation-content-shadow.mjs",
  "scripts/sounding-line/preparation-layer-identities.mjs",
  "scripts/sounding-line/evidence.mjs",
  "testing/prepared-artifacts.json",
  "prisma/schema.sqlite.prisma",
  "package.json",
  "package-lock.json",
  ".gitattributes",
  PREPARATION_SHADOW_WORKFLOW,
]);
const repository = "Kgray44/treasurehuntSoT",
  sha = /^[a-f0-9]{40}$/u,
  sha256 = /^[a-f0-9]{64}$/u;
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_PUBLISHER_${code}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jobKeys = ["publisher", "independent-verifier"];
const nativeFields = [
  "repository",
  "repositoryId",
  "actor",
  "actorId",
  "ref",
  "event",
  "workflowRef",
  "workflowSha",
  "runId",
  "attempt",
  "jobKey",
  "sourceCommit",
  "sourceTree",
  "readerDigest",
  "nonce",
];
const observationFields = ["kind", "version", "authentication", "certificate", "qualification", "reuseAuthorized"];

// Syntax and scope checks only. A serialized context remains untrusted until a
// separate fixed-provider reader verifies its original job/log/source binding.
export function preparationPublisherContext(input) {
  need(input && Object.getPrototypeOf(input) === Object.prototype, "CONTEXT_SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(input),
    names = Object.keys(descriptors).sort();
  need(
    Reflect.ownKeys(descriptors).every((key) => typeof key === "string") &&
      Object.values(descriptors).every((value) => Object.hasOwn(value, "value")) &&
      [nativeFields, [...nativeFields, ...observationFields]].some(
        (fields) => canonicalJson([...fields].sort()) === canonicalJson(names),
      ),
    "CONTEXT_FIELDS",
  );
  if (Object.hasOwn(input, "kind"))
    need(
      input.kind === "PREPARATION_PUBLISHER_CONTEXT_SHADOW" &&
        input.version === 1 &&
        input.authentication === "DECLARED_NATIVE_CONTEXT_NOT_PROVIDER_PROOF" &&
        input.certificate === "NOT_ISSUED" &&
        input.qualification === false &&
        input.reuseAuthorized === false,
      "CONTEXT_AUTHORITY",
    );
  need(input.repository === repository && input.repositoryId === 1303074266, "REPOSITORY");
  need(input.actor === "Kgray44" && input.actorId === 64373011, "OWNER");
  need(input.ref === "refs/heads/main" && input.event === "workflow_dispatch", "EVENT");
  need(input.workflowRef === `${repository}/${PREPARATION_SHADOW_WORKFLOW}@refs/heads/main`, "WORKFLOW");
  need(
    typeof input.sourceCommit === "string" &&
      typeof input.sourceTree === "string" &&
      sha.test(input.sourceCommit) &&
      sha.test(input.sourceTree) &&
      input.workflowSha === input.sourceCommit,
    "SOURCE",
  );
  need(
    Number.isSafeInteger(input.runId) && input.runId > 0 && input.attempt === 1 && jobKeys.includes(input.jobKey),
    "RUN",
  );
  need(
    typeof input.readerDigest === "string" &&
      typeof input.nonce === "string" &&
      sha256.test(input.readerDigest) &&
      /^[a-f0-9]{64}$/u.test(input.nonce),
    "CONTEXT",
  );
  return Object.freeze({
    kind: "PREPARATION_PUBLISHER_CONTEXT_SHADOW",
    version: 1,
    ...Object.fromEntries(nativeFields.map((field) => [field, input[field]])),
    authentication: "DECLARED_NATIVE_CONTEXT_NOT_PROVIDER_PROOF",
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  });
}

function readRegular(filename, maximum = 8 * 1024 * 1024) {
  const signature = (stat) =>
    [stat.dev, stat.ino, stat.size, stat.mode, stat.nlink, stat.mtimeNs, stat.ctimeNs].map(String).join(":");
  let fd, result, failure;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const before = fs.fstatSync(fd, { bigint: true }),
      named = fs.lstatSync(filename, { bigint: true });
    need(
      before.isFile() &&
        named.isFile() &&
        !named.isSymbolicLink() &&
        before.nlink === 1n &&
        before.size <= BigInt(maximum) &&
        signature(before) === signature(named),
      "READER_FILE",
    );
    result = Buffer.alloc(Number(before.size));
    let position = 0;
    while (position < result.length) {
      const count = fs.readSync(fd, result, position, result.length - position, position);
      need(count > 0, "READER_TRUNCATED");
      position += count;
    }
    need(
      signature(before) === signature(fs.fstatSync(fd, { bigint: true })) &&
        signature(before) === signature(fs.lstatSync(filename, { bigint: true })),
      "READER_DRIFT",
    );
  } catch (error) {
    failure = error;
  }
  if (fd !== undefined)
    try {
      fs.closeSync(fd);
    } catch (error) {
      if (failure)
        throw new AggregateError([failure, error], "PREPARATION_READER_AND_CLOSE_FAILED", { cause: failure });
      throw error;
    }
  if (failure) throw failure;
  return result;
}
function git(root, args) {
  return execFileSync("git", ["-c", "protocol.allow=never", ...args], {
    cwd: root,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function installed(root) {
  const sourceCommit = git(root, ["rev-parse", "HEAD"]).toString().trim();
  need(sourceCommit === process.env.GITHUB_SHA && sourceCommit === process.env.INPUT_BASE_SHA, "INSTALLED_MAIN");
  const inventory = new Map(
    git(root, ["ls-tree", "-rz", sourceCommit, "--", ...PREPARATION_PUBLISHER_READERS])
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
        need(match, "INSTALLED_READER_TYPE");
        return [match[3], match[1]];
      }),
  );
  need(inventory.size === PREPARATION_PUBLISHER_READERS.length, "INSTALLED_READER_CLOSURE");
  const readers = PREPARATION_PUBLISHER_READERS.map((file) => {
    const bytes = readRegular(path.join(root, file));
    const mode = Number(fs.lstatSync(path.join(root, file)).mode) & 0o777;
    need(mode === (inventory.get(file) === "100755" ? 0o755 : 0o644), "INSTALLED_READER_MODE");
    need(bytes.equals(git(root, ["show", `${sourceCommit}:${file}`])), "INSTALLED_READER_DRIFT");
    return { path: file, mode: inventory.get(file), sha256: hash(bytes) };
  });
  return {
    sourceCommit,
    sourceTree: git(root, ["rev-parse", "HEAD^{tree}"]).toString().trim(),
    readerDigest: digest(readers),
    readers,
  };
}
function nativeContext(root) {
  need(
    process.platform === "linux" &&
      process.arch === "x64" &&
      root === "/home/runner/work/treasurehuntSoT/treasurehuntSoT/candidate",
    "NATIVE_NAMESPACE",
  );
  const source = installed(root),
    e = process.env;
  return preparationPublisherContext({
    repository: e.GITHUB_REPOSITORY,
    repositoryId: Number(e.GITHUB_REPOSITORY_ID),
    actor: e.GITHUB_ACTOR,
    actorId: Number(e.GITHUB_ACTOR_ID),
    ref: e.GITHUB_REF,
    event: e.GITHUB_EVENT_NAME,
    workflowRef: e.GITHUB_WORKFLOW_REF,
    workflowSha: e.GITHUB_WORKFLOW_SHA,
    runId: Number(e.GITHUB_RUN_ID),
    attempt: Number(e.GITHUB_RUN_ATTEMPT),
    jobKey: e.GITHUB_JOB,
    sourceCommit: source.sourceCommit,
    sourceTree: source.sourceTree,
    readerDigest: source.readerDigest,
    nonce: randomBytes(32).toString("hex"),
  });
}
function configuration(root, sourceCommit) {
  const schema = readRegular(path.join(root, "prisma/schema.sqlite.prisma")).toString("utf8");
  need(
    (schema.match(/\bgenerator\s+\w+\s*\{/gu) ?? []).length === 1 &&
      /generator\s+client\s*\{\s*provider\s*=\s*"prisma-client-js"\s*\}/u.test(schema),
    "GENERATOR",
  );
  need(
    (schema.match(/\bdatasource\s+\w+\s*\{/gu) ?? []).length === 1 &&
      /datasource\s+db\s*\{\s*provider\s*=\s*"sqlite"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/u.test(schema),
    "DATASOURCE",
  );
  for (const name of ["prisma.config.ts", "prisma.config.js", "prisma.config.mjs", "prisma.config.cjs", ".npmrc"])
    need(
      !fs.existsSync(path.join(root, name)) && git(root, ["ls-tree", sourceCommit, "--", name]).length === 0,
      "UNDECLARED_CONFIGURATION",
    );
}
function inputs(root, context) {
  const source = installed(root);
  need(source.readerDigest === context.readerDigest, "CONTEXT_SOURCE_DRIFT");
  configuration(root, context.sourceCommit);
  const npmVersion = execFileSync("npm", ["--version"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 65536,
  }).trim();
  need(/^\d+\.\d+\.\d+$/u.test(npmVersion), "NPM_VERSION");
  const byPath = Object.fromEntries(source.readers.map((reader) => [reader.path, reader.sha256]));
  const osReleasePath = fs.realpathSync.native("/etc/os-release");
  need(["/etc/os-release", "/usr/lib/os-release"].includes(osReleasePath), "OS_RELEASE_PATH");
  const toolchain = {
    node: process.version,
    npm: npmVersion,
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    osReleasePath,
    osReleaseDigest: hash(readRegular(osReleasePath, 65536)),
    imageOS: process.env.ImageOS ?? null,
    imageVersion: process.env.ImageVersion ?? null,
    openssl: process.versions.openssl,
    namespaceDigest: digest(root),
  };
  const policy = JSON.parse(readRegular(path.join(root, "testing/prepared-artifacts.json")));
  need(
    policy.trustedPublisherClasses?.includes("protected-authoritative-workflow") &&
      policy.layers?.some((layer) => layer.id === "prisma-client" && layer.mutable === false),
    "POLICY",
  );
  const lock = JSON.parse(readRegular(path.join(root, "package-lock.json")));
  const prismaPackages = [
    lock.packages?.["node_modules/prisma"],
    lock.packages?.["node_modules/@prisma/client"],
    lock.packages?.["node_modules/@prisma/engines"],
  ];
  need(
    prismaPackages.every((value) => value && typeof value.version === "string" && typeof value.integrity === "string"),
    "PRISMA_LOCK",
  );
  const layerIdentities = {
    dependency: digest({
      package: byPath["package.json"],
      lock: byPath["package-lock.json"],
      toolchain,
      command: "npm ci --ignore-scripts",
    }),
    prisma: digest(prismaPackages),
    schema: byPath["prisma/schema.sqlite.prisma"],
    generator: digest({
      provider: "prisma-client-js",
      command: "npx --no-install prisma generate --schema prisma/schema.sqlite.prisma",
      namespaceDigest: toolchain.namespaceDigest,
    }),
    "os-arch": digest(toolchain),
  };
  const body = { source, toolchain, layerIdentities, policyDigest: byPath["testing/prepared-artifacts.json"] };
  return {
    ...body,
    inputFingerprint: digest({
      readerDigest: source.readerDigest,
      toolchain,
      layerIdentities,
      policyDigest: body.policyDigest,
    }),
  };
}
function eligibleInventory(entries) {
  const file =
    /^(?:(?:client|default|edge|index|index-browser|wasm)\.(?:js|d\.ts)|package\.json|schema\.prisma|query_engine_bg\.(?:js|wasm)|(?:wasm-edge-light-loader|wasm-worker-loader)\.mjs|(?:lib)?query_engine[-a-z0-9_.]+\.node)$/u;
  need(
    entries.length <= 64 &&
      entries.every((entry) =>
        entry.type === "directory"
          ? entry.path === "." && [0o755, 0o777].includes(entry.mode)
          : file.test(entry.path) && [0o644, 0o755, 0o666, 0o777].includes(entry.mode),
      ),
    "GENERATED_OUTPUT_CLASS",
  );
}
function output(name, value) {
  need(process.env.GITHUB_OUTPUT && !/[\r\n]/u.test(value), "OUTPUT");
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function writeJSON(filename, body) {
  const bytes = Buffer.from(canonicalJson(body) + "\n");
  fs.writeFileSync(filename, bytes, { flag: "wx", mode: 0o600 });
  return hash(bytes);
}

export function compareTransferredPreparationShadow({ directory, context, inputFingerprint, freshObservation }) {
  const independentVerifier = preparationPublisherContext(context);
  need(
    independentVerifier.jobKey === "independent-verifier" &&
      sha256.test(inputFingerprint) &&
      inspectPreparationContentShadow(freshObservation),
    "FRESH_OBSERVATION_REQUIRED",
  );
  const identity = { inputFingerprint },
    measured = freshObservation;
  const downloaded = directory;
  const publisher = JSON.parse(readRegular(path.join(downloaded, "publisher.json"), 2 * 1024 * 1024));
  need(
    publisher.kind === "PREPARATION_SOURCE_CAPSULE_SHADOW" &&
      publisher.version === 1 &&
      publisher.qualification === false &&
      publisher.reuseAuthorized === false &&
      publisher.certificate === "NOT_ISSUED",
    "SHADOW_ONLY",
  );
  preparationPublisherContext(publisher.context);
  need(
    publisher.context.jobKey === "publisher" &&
      publisher.context.runId === context.runId &&
      publisher.context.attempt === context.attempt &&
      publisher.context.sourceCommit === context.sourceCommit &&
      publisher.context.sourceTree === context.sourceTree &&
      publisher.context.readerDigest === context.readerDigest &&
      publisher.context.nonce !== context.nonce &&
      publisher.identity.inputFingerprint === identity.inputFingerprint,
    "INDEPENDENT_SOURCE_BINDING",
  );
  const manifestBytes = readRegular(path.join(downloaded, "manifest.json"), 2 * 1024 * 1024),
    manifest = JSON.parse(manifestBytes);
  need(
    manifest.kind === "PREPARATION_CAPSULE_SHADOW" &&
      manifest.version === 1 &&
      manifest.status === "COMPLETE_SHADOW" &&
      manifest.qualification === false &&
      manifest.reuseAuthorized === false &&
      manifest.certificate === "NOT_ISSUED",
    "COMPLETE_CAPSULE_REQUIRED",
  );
  const initialBytes = readRegular(path.join(downloaded, "initial.json"), 65536),
    initial = JSON.parse(initialBytes);
  need(
    initial.kind === "PREPARATION_CAPSULE_SHADOW" &&
      initial.status === "INCOMPLETE" &&
      initial.layer === "prisma-client" &&
      initial.qualification === false &&
      initial.reuseAuthorized === false &&
      initial.original.observationDigest === manifest.original.observationDigest,
    "ORIGINAL_INITIAL_RECEIPT",
  );
  need(
    hash(manifestBytes) === publisher.capsule.manifestSha256 && hash(initialBytes) === publisher.capsule.initialSha256,
    "ORIGINAL_MANIFEST_BYTES",
  );
  need(
    digest(manifest.inventory) === publisher.capsule.inventoryDigest &&
      manifest.original.inventoryDigest === publisher.capsule.inventoryDigest,
    "ORIGINAL_INVENTORY",
  );
  need(
    manifest.comparison.contentEquivalent === true &&
      manifest.comparison.sourceUnchanged === true &&
      manifest.comparison.destinationUnchanged === true &&
      manifest.comparison.qualification === false &&
      manifest.comparison.reuseAuthorized === false &&
      manifest.comparison.certificate === "NOT_ISSUED" &&
      manifest.comparison.action === "RUN_FRESH_PREPARATION",
    "ORIGINAL_COMPARISON",
  );
  eligibleInventory(manifest.inventory);
  const payload = path.join(downloaded, "payload"),
    transferred = measurePreparationContentShadow({ root: payload, layer: "prisma-client" });
  const withoutModes = (entries) => entries.map(({ mode, ...entry }) => entry);
  need(
    canonicalJson(withoutModes(inspectPreparationContentShadow(transferred).entries)) ===
      canonicalJson(withoutModes(manifest.inventory)),
    "TRANSFERRED_CONTENT",
  );
  // Artifact transport resets modes. Restore the declared originals only after
  // every transferred path/type/size/hash matches; this remains shadow data.
  const restored = restorePreparationObservationModesShadow(transferred, manifest.inventory);
  need(
    restored.inventoryDigest === publisher.capsule.inventoryDigest &&
      restored.inventoryDigest === measured.inventoryDigest &&
      restored.byteLength === publisher.capsule.byteLength &&
      restored.fileCount === publisher.capsule.fileCount,
    "FRESH_EQUIVALENCE",
  );
  const body = {
    kind: "PREPARATION_INDEPENDENT_EQUIVALENCE_SHADOW",
    version: 1,
    originalProducer: publisher.context,
    independentVerifier: context,
    inputFingerprint: identity.inputFingerprint,
    originalManifestSha256: publisher.capsule.manifestSha256,
    inventoryDigest: restored.inventoryDigest,
    originalTransportObservation: transferred,
    restoredObservation: restored,
    byteLength: restored.byteLength,
    fileCount: restored.fileCount,
    equivalent: true,
    providerAuthentication: "NOT_ESTABLISHED_BY_THIS_RECEIPT",
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  };
  return Object.freeze({
    ...body,
    originalProducer: preparationPublisherContext(body.originalProducer),
    independentVerifier,
  });
}

export function preparationPublisherMain(operation) {
  const root = fs.realpathSync(process.cwd()),
    contextDirectory = path.join(root, "artifacts/preparation-shadow");
  const current = nativeContext(root);
  fs.mkdirSync(contextDirectory, { recursive: true, mode: 0o700 });
  const contextPath = path.join(contextDirectory, `context-${current.jobKey}.json`);
  if (operation === "context") {
    const free = fs.statfsSync(root, { bigint: true });
    need(free.bavail * free.bsize >= 4n * 1024n ** 3n, "FREE_SPACE");
    configuration(root, current.sourceCommit);
    writeJSON(contextPath, current);
    console.log(`SOUNDING_LINE_PREPARATION_CONTEXT_V1 ${canonicalJson(current)}`);
    return;
  }
  const context = JSON.parse(readRegular(contextPath, 65536));
  need(
    context.sourceCommit === current.sourceCommit &&
      context.readerDigest === current.readerDigest &&
      context.runId === current.runId &&
      context.attempt === current.attempt &&
      context.jobKey === current.jobKey,
    "ORIGINAL_CONTEXT",
  );
  preparationPublisherContext(context);
  const identity = inputs(root, context);
  const source = path.join(root, "node_modules/.prisma/client");
  const measured = measurePreparationContentShadow({ root: source, layer: "prisma-client" });
  eligibleInventory(inspectPreparationContentShadow(measured).entries);
  if (operation === "produce") {
    need(context.jobKey === "publisher", "JOB_ROLE");
    const parent = path.join(contextDirectory, "capsules");
    fs.mkdirSync(parent, { mode: 0o700 });
    const capsule = createPreparationCapsuleShadow({ source, directory: parent, layer: "prisma-client" });
    if (capsule.status !== "PASS") {
      if (capsule.retentionError)
        throw new AggregateError([capsule.originalError, capsule.retentionError], "CAPSULE_AND_RETENTION_FAILURE", {
          cause: capsule.originalError,
        });
      throw capsule.originalError;
    }
    verifyPreparationCapsuleShadow(capsule);
    const body = {
      kind: "PREPARATION_SOURCE_CAPSULE_SHADOW",
      version: 1,
      context,
      identity,
      capsule: {
        inventoryDigest: capsule.inventoryDigest,
        byteLength: capsule.bytes,
        fileCount: capsule.files,
        manifestSha256: capsule.manifestSha256,
        initialSha256: hash(readRegular(path.join(capsule.root, "initial.json"), 65536)),
      },
      certificate: "NOT_ISSUED",
      qualification: false,
      reuseAuthorized: false,
    };
    writeJSON(path.join(capsule.root, "publisher.json"), body);
    output("capsule_path", capsule.root);
    console.log(
      `SOUNDING_LINE_PREPARATION_CAPSULE_V1 ${canonicalJson({ sourceCommit: context.sourceCommit, runId: context.runId, attempt: context.attempt, inputFingerprint: identity.inputFingerprint, manifestSha256: capsule.manifestSha256, qualification: false, reuseAuthorized: false })}`,
    );
    return;
  }
  need(operation === "compare" && context.jobKey === "independent-verifier", "OPERATION");
  const body = compareTransferredPreparationShadow({
    directory: path.join(root, "artifacts/preparation-downloaded"),
    context,
    inputFingerprint: identity.inputFingerprint,
    freshObservation: measured,
  });
  writeJSON(path.join(contextDirectory, "equivalence.json"), body);
  console.log(`SOUNDING_LINE_PREPARATION_EQUIVALENCE_V1 ${canonicalJson(body)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  preparationPublisherMain(process.argv[2]);
