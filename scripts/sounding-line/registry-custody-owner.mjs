// Owner-run private console only. Never invoke real setup through captured tools.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  publicEncrypt,
  privateDecrypt,
  constants,
  randomUUID,
} from "node:crypto";
import {
  INTERNAL_CUSTODY_TARGETS,
  planInternalRegistryCustody,
  custodyInventoryEnvironment,
} from "./registry-custody-bootstrap.mjs";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";
import { requireMergeProtection } from "./protected-merge-transaction.mjs";
import { verifiedRegistryOwnerTool } from "./registry-owner-tools.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const need = (value, code) => {
  if (!value) throw Error(`OWNER_CUSTODY_${code}`);
};
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, "../..");
const powershell = path.win32.join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const age = path.join(os.homedir(), "AppData", "Local", "Voyagewright", "Tools", "age", "1.3.2", "age.exe");
const gh = "C:\\Program Files\\GitHub CLI\\gh.exe";
const git = path.join(os.homedir(), "AppData", "Local", "Programs", "Git", "cmd", "git.exe");
const ageSha = "2821a4ed191da07372acd302e5f6feae7a7985e285e1417765ebe74025af45f0";
const guard = "C:\\Users\\kkids\\AppData\\Local\\AeroStorageWatch\\ReserveGuard.ps1";
const env = () => ({
  ...custodyInventoryEnvironment(process.env),
  ...(process.env.APPDATA ? { APPDATA: process.env.APPDATA } : {}),
});
const targets = Object.values(INTERNAL_CUSTODY_TARGETS),
  generationDirectories = targets.map((file) => path.dirname(file));
const label = Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1");
const canary = Buffer.from("VW_OWNER_KEY_RECOVERY_CANARY_V1\nNO_PROVIDER_OR_REUSE_AUTHORITY\n");
let activeAge;
const statSignature = (s) => [s.dev, s.ino, s.size, s.nlink, s.mtimeNs, s.ctimeNs].map(String).join(":");

export function ownerConsolePreflightObservation() {
  const captured = ["CODEX_THREAD_ID", "CODEX_SESSION_ID", "CODEX_TOOL_CALL_ID", "CODEX_CI"].some((key) =>
    Boolean(process.env[key]),
  );
  return {
    windows: process.platform === "win32",
    inputTTY: !!process.stdin.isTTY,
    outputTTY: !!process.stdout.isTTY,
    errorTTY: !!process.stderr.isTTY,
    captured,
    ownerPresenceProved: false,
  };
}
function reserve(cBytes, dBytes) {
  const text = execFileSync(
    powershell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      guard,
      "-EstimatedCBytes",
      String(cBytes),
      "-EstimatedDBytes",
      String(dBytes),
    ],
    { env: env(), encoding: "utf8", timeout: 15000, maxBuffer: 16384, windowsHide: true },
  );
  const result = JSON.parse(text);
  need(result.allowed === true && result.floorBytesEach === 32212254720, "RESERVE_DENIED");
  return result;
}
function boundedFile(file, maximum, expectedSha) {
  const before = fs.lstatSync(file, { bigint: true });
  need(
    before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size <= BigInt(maximum),
    "FILE_BOUND_OR_ALIAS",
  );
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)),
    chunks = [];
  let size = 0;
  try {
    need(statSignature(fs.fstatSync(fd, { bigint: true })) === statSignature(before), "FILE_CHANGED");
    const buffer = Buffer.alloc(65536);
    for (;;) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, maximum + 1 - size), null);
      if (!count) break;
      size += count;
      need(size <= maximum, "FILE_BOUND");
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    need(
      statSignature(fs.fstatSync(fd, { bigint: true })) === statSignature(before) &&
        statSignature(fs.lstatSync(file, { bigint: true })) === statSignature(before),
      "FILE_CHANGED",
    );
  } finally {
    fs.closeSync(fd);
  }
  const bytes = Buffer.concat(chunks);
  need(!expectedSha || hash(bytes) === expectedSha, "FILE_DIGEST");
  return bytes;
}
function canonicalDirectory(directory) {
  need(fs.realpathSync.native(directory) === directory, "DIRECTORY_ALIAS");
  for (let p = directory; ; p = path.dirname(p)) {
    const st = fs.lstatSync(p);
    need(st.isDirectory() && !st.isSymbolicLink(), "DIRECTORY_ALIAS");
    if (path.dirname(p) === p) break;
  }
}
async function publicMetadata(script, args = [], allowFailure = false) {
  const child = spawnOwnedProcess(powershell, ["-NoProfile", "-NonInteractive", "-File", script, ...args], {
    root,
    env: env(),
    inheritExecutionPolicy: true,
    cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
  });
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  const chunks = [];
  let bytes = 0,
    timer,
    result,
    cleanup;
  child.stdout.on("data", (b) => {
    bytes += b.length;
    if (bytes <= 65536) chunks.push(Buffer.from(b));
  });
  child.stderr.resume();
  child.stdout.resume();
  try {
    result = await Promise.race([
      processExit(child),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("OWNER_CUSTODY_METADATA_TIMEOUT")), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    cleanup = await stopOwnedProcess(child);
  }
  need(cleanup.status === "PASS" && cleanup.treeReaped && cleanup.streamsClosed, "METADATA_CLEANUP");
  need(bytes <= 65536 && (allowFailure || result.code === 0), "METADATA_FAILED");
  return {
    value: JSON.parse(
      Buffer.concat(chunks)
        .toString("utf8")
        .replace(/^\uFEFF/u, ""),
    ),
    exitCode: result.code,
    cleanup,
  };
}
function protectedSource(opening = false) {
  const providerTool = opening ? verifiedRegistryOwnerTool("gh") : gh;
  const sourceTool = opening ? verifiedRegistryOwnerTool("git") : git;
  const api = (endpoint) =>
    JSON.parse(
      execFileSync(providerTool, ["api", `repos/Kgray44/treasurehuntSoT/${endpoint}`], {
        env: env(),
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 1048576,
        windowsHide: true,
      }),
    );
  const actor = JSON.parse(
    execFileSync(providerTool, ["api", "user"], {
      env: env(),
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 1048576,
      windowsHide: true,
    }),
  );
  need(actor.login === "Kgray44" && actor.id === 64373011, "OWNER_ACCOUNT_REQUIRED");
  const main = api("git/ref/heads/main").object.sha,
    protection = api("branches/main/protection"),
    rulesets = [];
  for (let page = 1; page <= 20; page++) {
    const rows = api(`rulesets?includes_parents=true&per_page=100&page=${page}`);
    need(Array.isArray(rows), "RULESET_METADATA");
    rulesets.push(...rows);
    if (rows.length < 100) break;
    need(page < 20, "RULESET_BOUND");
  }
  requireMergeProtection(protection, rulesets);
  const local = (args, maxBuffer = 1048576) =>
    execFileSync(sourceTool, ["-c", "protocol.allow=never", "-c", "core.fsmonitor=false", ...args], {
      cwd: root,
      env: { ...env(), GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
      encoding: "utf8",
      timeout: 15000,
      maxBuffer,
      windowsHide: true,
    });
  need(local(["rev-parse", "HEAD"]).trim() === main, "INSTALLED_PROTECTED_SOURCE_REQUIRED");
  const rows = local(["ls-tree", "-rz", main, "--", "scripts/sounding-line"]).split("\0").filter(Boolean);
  need(rows.length > 0 && rows.length <= 4096, "SOURCE_BOUND");
  let total = 0;
  const bindings = [];
  for (const row of rows) {
    const match = /^100644 blob ([a-f0-9]{40})\t(scripts\/sounding-line\/[A-Za-z0-9_.-]+)$/u.exec(row);
    need(match, "SOURCE_MODE");
    const bytes = boundedFile(path.join(root, match[2]), 1048576);
    total += bytes.length;
    need(
      total <= 16 * 1024 * 1024 &&
        createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === match[1],
      "SOURCE_CONTENT",
    );
    bindings.push({ path: match[2], blob: match[1] });
  }
  need(
    bindings.some((row) => path.resolve(root, row.path) === fileURLToPath(import.meta.url)),
    "ENTRYPOINT_NOT_PROTECTED_SOURCE",
  );
  return {
    source: main,
    actor: actor.login,
    controlFiles: bindings.length,
    sourceBindingsDigest: hash(Buffer.from(JSON.stringify(bindings))),
  };
}
async function encryptFreshKey() {
  const pair = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }),
    keyId = hash(Buffer.from(publicKey));
  const challenge = publicEncrypt(
    { key: pair.publicKey, oaepHash: "sha256", oaepLabel: label, padding: constants.RSA_PKCS1_OAEP_PADDING },
    canary,
  );
  const der = pair.privateKey.export({ type: "pkcs8", format: "der" });
  try {
    return { encrypted: await ageProcess(["--passphrase"], der), publicKey, keyId, challenge };
  } finally {
    der.fill(0);
  }
}
async function ageProcess(args, input = Buffer.alloc(0)) {
  // Direct child inherits the owner's real console. Secret prompts use CONIN$/
  // CONOUT$; key bytes use separate binary pipes. No plugin mode is accepted.
  boundedFile(age, 7172096, ageSha);
  const child = spawn(age, args, {
    env: env(),
    windowsHide: false,
    stdio: ["pipe", "pipe", "inherit"],
    signal: AbortSignal.timeout(180000),
  });
  activeAge = child;
  const chunks = [];
  let size = 0,
    spawnFailure = false;
  child.stdout.on("data", (b) => {
    size += b.length;
    if (size <= 1048576) chunks.push(Buffer.from(b));
    b.fill(0);
  });
  child.stdin.on("error", () => {});
  child.stdin.end(input);
  try {
    const exit = await new Promise((resolve) => {
      child.once("error", () => {
        spawnFailure = true;
      });
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    need(!spawnFailure && exit.code === 0 && size <= 1048576, "AGE_FAILED_OR_CANCELLED");
    return Buffer.concat(chunks);
  } finally {
    activeAge = null;
    for (const chunk of chunks) chunk.fill(0);
  }
}
function writeExclusive(file, bytes) {
  need(bytes.length <= 1048576, "PACKAGE_BOUND");
  canonicalDirectory(path.dirname(file));
  const fd = fs.openSync(
    file,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    let written = 0;
    while (written < bytes.length) {
      const count = fs.writeSync(fd, bytes, written, bytes.length - written);
      need(count > 0, "WRITE_STALLED");
      written += count;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  need(boundedFile(file, 1048576, hash(bytes)).equals(bytes), "COPY_READBACK");
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}

// Test the same create-only writer using fixed public bytes, never caller data.
export function runPublicOwnerStorageProbe(firstParent, secondParent) {
  canonicalDirectory(firstParent);
  canonicalDirectory(secondParent);
  need(firstParent !== secondParent, "PUBLIC_PROBE_PARENTS");
  const bytes = Buffer.from("VW_PUBLIC_OWNER_STORAGE_PROBE_V1\nNO_KEY_MATERIAL\n");
  const directories = [],
    copies = [],
    cleanup = [];
  let failure;
  try {
    for (const parent of [firstParent, secondParent]) {
      const directory = fs.mkdtempSync(path.join(parent, "owner-custody-public-storage-"));
      directories.push(directory);
      copies.push(writeExclusive(path.join(directory, "public-canary.bin"), bytes));
    }
  } catch (error) {
    failure = error;
  } finally {
    for (const directory of directories) {
      try {
        const names = fs.readdirSync(directory);
        if (names.length) {
          need(names.length === 1 && names[0] === "public-canary.bin", "PUBLIC_PROBE_UNKNOWN_ENTRY");
          const file = path.join(directory, names[0]);
          need(boundedFile(file, bytes.length, hash(bytes)).equals(bytes), "PUBLIC_PROBE_CHANGED");
          fs.unlinkSync(file);
        }
        fs.rmdirSync(directory);
        cleanup.push({ directory, status: "VERIFIED_PUBLIC_PROBE_RETIRED" });
      } catch (error) {
        cleanup.push({ directory, status: "HELD", error: error.message.slice(0, 512) });
      }
    }
  }
  if (failure || cleanup.some((row) => row.status === "HELD")) {
    const error = failure ?? Error("OWNER_CUSTODY_PUBLIC_PROBE_CLEANUP_HELD");
    error.publicProbeCleanup = cleanup;
    throw error;
  }
  return {
    kind: "FIXED_PUBLIC_OWNER_STORAGE_PROBE_ONLY",
    copies,
    cleanup,
    ownerKeyOperations: 0,
    qualification: false,
    reuseAuthorized: false,
  };
}
async function recoverCanary(file, expected) {
  const der = await ageProcess(["--decrypt", file]);
  try {
    const key = createPrivateKey({ key: der, type: "pkcs8", format: "der" });
    need(createPublicKey(key).export({ type: "spki", format: "pem" }) === expected.publicKey, "RECOVERED_KEY_PIN");
    const plain = privateDecrypt(
      { key, oaepHash: "sha256", oaepLabel: label, padding: constants.RSA_PKCS1_OAEP_PADDING },
      expected.challenge,
    );
    try {
      need(plain.equals(canary), "RECOVERY_CANARY");
    } finally {
      plain.fill(0);
    }
    return {
      selectedInput: file,
      publicKeyId: expected.keyId,
      canarySha256: hash(canary),
      result: "PASS_LOCAL_KEY_CANARY_NOT_PROVIDER_ACCEPTANCE",
    };
  } finally {
    der.fill(0);
  }
}
// A completed key canary is insufficient if later file/journal closure fails.
// This result normalization grants no custody, provider or release authority.
export function finalizeOwnerCustodyResult(result) {
  const failure = result.failure ?? (result.journalFailures.length ? "OWNER_CUSTODY_JOURNAL_FAILED" : null);
  return { ...result, receipt: failure ? null : result.receipt, failure, qualification: false, reuseAuthorized: false };
}
async function openProviderDiagnostic({
  source,
  runId,
  artifactId,
  prNumber,
  archiveSha256,
  sourceBindingsDigest,
  drive,
}) {
  const [
    {
      authenticateNativeOriginalContext,
      authenticateNativeRegistryArchive,
      inspectNativeRegistryArchive,
      openNativeRegistryRetention,
      inspectNativeRegistryRetention,
    },
    { artifactLogicalKey },
    { installedRegistryWriteRecipient },
    { inspectArtifactRegistryRetention },
  ] = await Promise.all([
    import("./native-original-context-auth.mjs"),
    import("./artifact-evidence-registry.mjs"),
    import("./registry-recipient-policy.mjs"),
    import("./artifact-registry-retention.mjs"),
  ]);
  const baseSha = source.source;
  const input = {
    root,
    acceptedBaseSha: baseSha,
    runId,
    attempt: 1,
    prNumber,
    jobKey: "experience-preparation",
    privateOwnerWindows: true,
    expectedOriginalSource: { baseSha, candidateSha: baseSha },
  };
  const authored = JSON.parse(
    execFileSync(
      verifiedRegistryOwnerTool("git"),
      ["-c", "protocol.allow=never", "show", `${baseSha}:testing/contracts.json`],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 2097152,
        windowsHide: true,
        env: { ...env(), GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" },
      },
    ),
  );
  // Derive complete coverage from the authored journey. Producer claims and
  // retained journal coverage cannot change the owner's expected obligations.
  const contracts = authored.contracts.filter(({ id }) => id === "homeport.transition.auth-routes");
  need(contracts.length === 1, "DIAGNOSTIC_PLAN");
  const [contract] = contracts;
  const viewports = { DESKTOP: { width: 1440, height: 900 }, MOBILE: { width: 390, height: 844 } };
  const expectedCoverage = [];
  for (const journey of contract.experience.journeys) {
    need(
      journey.steps.every((step) => !Object.hasOwn(step, "when") && !Object.hasOwn(step, "devices")),
      "DIAGNOSTIC_PLAN",
    );
    for (const role of journey.roles) {
      need(role === "ANONYMOUS", "DIAGNOSTIC_PLAN");
      for (const device of contract.experience.devices) {
        need(Object.hasOwn(viewports, device), "DIAGNOSTIC_PLAN");
        for (const motionMode of contract.experience.motion ? ["NORMAL", "REDUCED"] : ["REDUCED"]) {
          const context = {
            contractId: contract.id,
            journeyId: journey.id,
            role,
            device,
            motionMode,
            viewport: { ...viewports[device] },
          };
          for (const [captureIndex, step] of journey.steps.entries())
            if (step.state) expectedCoverage.push({ ...context, type: "screenshot", state: step.state, captureIndex });
          for (const type of ["recording", "trace", "accessibility", "cleanup", "journey"])
            expectedCoverage.push({ ...context, type, state: "CONTEXT_CLOSED", captureIndex: null });
        }
      }
    }
  }
  const keys = expectedCoverage.map(artifactLogicalKey).sort();
  need(keys.length === 16 && new Set(keys).size === keys.length, "DIAGNOSTIC_COVERAGE");
  const originalProof = await authenticateNativeOriginalContext(input);
  const registryProof = await authenticateNativeRegistryArchive({
    originalProof,
    input,
    artifactId,
    sourceBindingsDigest,
  });
  const archive = inspectNativeRegistryArchive(registryProof, input);
  need(archive?.producerMode === "capture-diagnostic" && archive.archiveSha256 === archiveSha256, "DIAGNOSTIC_ARCHIVE");
  const pin = installedRegistryWriteRecipient();
  inspectArtifactRegistryRetention({ bytes: archive.envelope, binding: archive.binding, encryption: pin });
  const target = INTERNAL_CUSTODY_TARGETS[drive];
  const directory = path.dirname(target);
  canonicalDirectory(directory);
  const verification = await publicMetadata(path.join(here, "registry-custody-owner-windows.ps1"), [
    "-Operation",
    "verify",
  ]);
  need(verification.value.status === "VERIFIED_EXISTING_CUSTODY_ACL", "DIRECTORY_ACL_CHANGED");
  const custody = JSON.parse(boundedFile(path.join(directory, "custody.public.json"), 65536));
  const copy = custody.copies?.find((entry) => entry.path === target);
  need(
    custody.kind === "INTERNAL_TWO_DEVICE_OWNER_KEY_RECOVERY_CANARY_ONLY" &&
      custody.publicKeyId === pin.keyId &&
      custody.publicKey === pin.publicKey &&
      /^[a-f0-9]{64}$/u.test(copy?.sha256 ?? "") &&
      Number.isSafeInteger(copy.bytes) &&
      copy.bytes > 0 &&
      copy.bytes <= 1048576,
    "RECOVERY_PUBLIC_BINDING",
  );
  reserve(268435456, 67108864);
  const receiptDirectory = path.join(os.homedir(), "AppData", "Local", "Voyagewright", "CustodyReceipts");
  canonicalDirectory(receiptDirectory);
  const encrypted = boundedFile(target, copy.bytes, copy.sha256);
  need(encrypted.length === copy.bytes, "RECOVERY_FILE_SIZE");
  const receiptBase = {
    source: baseSha,
    runId,
    attempt: 1,
    artifactId,
    prNumber,
    archiveSha256,
    sourceBindingsDigest,
    drive,
    publicKeyId: pin.keyId,
    expectedCoverageDigest: hash(JSON.stringify(keys)),
    externalIsolationProved: false,
    qualification: false,
    reuseAuthorized: false,
  };
  const operationId = randomUUID();
  const retain = (stage, value) =>
    writeExclusive(
      path.join(receiptDirectory, `owner-provider-${runId}-${operationId}-${stage}.json`),
      Buffer.from(JSON.stringify({ operationId, ...receiptBase, ...value }, null, 2) + "\n"),
    );
  retain("prepared", { kind: "OWNER_PROVIDER_RECOVERY_PREPARED", ownerKeyOperations: 0 });
  console.log(
    `Open the authenticated diagnostic registry from run ${runId}, artifact ${artifactId}, using the ${drive}: recovery copy.`,
  );
  let der;
  let opened;
  try {
    der = await ageProcess(["--decrypt"], encrypted);
    const privateKey = createPrivateKey({ key: der, type: "pkcs8", format: "der" });
    der.fill(0);
    need(createPublicKey(privateKey).export({ type: "spki", format: "pem" }) === pin.publicKey, "RECOVERED_KEY_PIN");
    const proof = await openNativeRegistryRetention({ registryProof, input, privateKey, expectedCoverage });
    const { manifest } = inspectNativeRegistryRetention(proof, input) ?? {};
    need(manifest?.completedContexts.length === 2 && manifest.artifacts.length === keys.length, "DIAGNOSTIC_COVERAGE");
    opened = {
      kind: "OWNER_OPENED_NATIVE_DIAGNOSTIC_REGISTRY_NOT_REUSE_AUTHORITY",
      manifestDigest: manifest.manifestDigest,
      completedContexts: manifest.completedContexts.length,
      artifacts: manifest.artifacts.length,
      ownerKeyOperations: 1,
    };
  } catch (error) {
    const failure = /^(?:OWNER_CUSTODY|SOUNDING_LINE)_[A-Z0-9_]+$/u.test(error?.message ?? "")
      ? error.message
      : "OWNER_CUSTODY_PROVIDER_OPEN_FAILED";
    opened = { kind: "OWNER_PROVIDER_RECOVERY_FAILED", ownerKeyOperations: 1, failure };
  } finally {
    der?.fill(0);
  }
  return { ...receiptBase, ...opened, publicReceipt: retain("result", opened) };
}
export async function runRegistryCustodyOwner(args) {
  const opening = args[0] === "--operation" && args[1] === "owner-open-provider-registry";
  const positive = (value) => /^[1-9][0-9]{0,15}$/u.test(value ?? "") && Number.isSafeInteger(Number(value));
  if (opening)
    need(
      args.length === 8 &&
        args.slice(2, 5).every(positive) &&
        ![721, 776, 805].includes(Number(args[4])) &&
        /^[a-f0-9]{64}$/u.test(args[5]) &&
        /^[a-f0-9]{64}$/u.test(args[6]) &&
        ["C", "D"].includes(args[7]),
      "ARGUMENTS",
    );
  need(
    opening ||
      (args.length === 2 && args[0] === "--operation" && ["check-private-console", "owner-prepare"].includes(args[1])),
    "ARGUMENTS",
  );
  const preliminary = ownerConsolePreflightObservation();
  const preliminaryReady =
    preliminary.windows &&
    preliminary.inputTTY &&
    preliminary.outputTTY &&
    preliminary.errorTTY &&
    !preliminary.captured;
  if (args[1] === "check-private-console" && !preliminaryReady)
    return { ...preliminary, ready: false, ownerKeyOperations: 0 };
  need(preliminaryReady, "PRIVATE_OWNER_CONSOLE_REQUIRED");
  reserve(2097152, 2097152);
  const observation = JSON.parse(
    execFileSync(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        path.join(here, "registry-custody-owner-windows.ps1"),
        "-Operation",
        "console",
      ],
      { env: env(), encoding: "utf8", timeout: 15000, maxBuffer: 16384, windowsHide: false },
    ),
  );
  need(observation.attached === true && observation.visible === true, "VISIBLE_OWNER_CONSOLE_REQUIRED");
  if (args[1] === "check-private-console")
    return { ...preliminary, ...observation, ready: true, ownerKeyOperations: 0 };
  boundedFile(age, 7172096, ageSha);
  const source = protectedSource(opening);
  if (opening)
    return openProviderDiagnostic({
      source,
      runId: Number(args[2]),
      artifactId: Number(args[3]),
      prNumber: Number(args[4]),
      archiveSha256: args[5],
      sourceBindingsDigest: args[6],
      drive: args[7],
    });
  for (const directory of generationDirectories) need(!fs.existsSync(directory), "GENERATION_ALREADY_EXISTS");
  const firstPlan = planInternalRegistryCustody(
    (await publicMetadata(path.join(here, "registry-custody-inventory.ps1"))).value,
  );
  const reviewedDeviceIds = [
    "55885cd9473c9c64fcd2c028f8bf4bb69a5f7b49f705ba426d7433467963d91d",
    "9202b0892cddefea43157eb7122e96e95513ccbb1894dd08c82b1aa99c90f3cb",
  ];
  need(
    firstPlan.devices.every((device, index) => device.deviceIdentitySha256 === reviewedDeviceIds[index]),
    "DEVICE_BASELINE_REVIEW_REQUIRED",
  );
  reserve(268435456, 67108864);
  const journalDirectory = path.join(os.homedir(), "AppData", "Local", "Voyagewright", "CustodyReceipts");
  fs.mkdirSync(journalDirectory, { recursive: true });
  canonicalDirectory(journalDirectory);
  const operationId = randomUUID(),
    journal = path.join(journalDirectory, `owner-${operationId}.jsonl`);
  let journalBytes = 0,
    journalIdentity;
  const emit = (value) => {
    const bytes = Buffer.from(JSON.stringify({ operationId, at: new Date().toISOString(), ...value }) + "\n");
    need(journalBytes + bytes.length <= 65536, "JOURNAL_BOUND");
    const flags =
      fs.constants.O_WRONLY |
      (fs.constants.O_NOFOLLOW ?? 0) |
      (journalIdentity ? fs.constants.O_APPEND : fs.constants.O_CREAT | fs.constants.O_EXCL);
    const fd = fs.openSync(journal, flags, 0o600);
    try {
      const stat = fs.fstatSync(fd, { bigint: true });
      need(stat.isFile() && stat.nlink === 1n && stat.size === BigInt(journalBytes), "JOURNAL_CHANGED");
      const identity = `${stat.dev}:${stat.ino}`;
      need(!journalIdentity || identity === journalIdentity, "JOURNAL_CHANGED");
      need(statSignature(fs.lstatSync(journal, { bigint: true })) === statSignature(stat), "JOURNAL_CHANGED");
      journalIdentity = identity;
      let offset = 0;
      while (offset < bytes.length) {
        const count = fs.writeSync(fd, bytes, offset, bytes.length - offset);
        need(count > 0, "JOURNAL_WRITE_STALLED");
        offset += count;
      }
      fs.fsyncSync(fd);
      const after = fs.fstatSync(fd, { bigint: true });
      need(
        after.size === BigInt(journalBytes + bytes.length) &&
          after.nlink === 1n &&
          `${after.dev}:${after.ino}` === journalIdentity &&
          statSignature(fs.lstatSync(journal, { bigint: true })) === statSignature(after),
        "JOURNAL_CHANGED",
      );
    } finally {
      fs.closeSync(fd);
    }
    journalBytes += bytes.length;
  };
  emit({
    stage: "STARTED_PRIVATE_OWNER_OPERATION",
    source,
    profile: firstPlan.profile,
    devices: firstPlan.devices,
    ownerKeyOperations: 0,
  });
  const created = [],
    copies = [],
    recoveries = [],
    cleanup = [];
  let publicReceipt,
    failure,
    keyGenerated = false;
  const journalFailures = [];
  const emitFailureSafe = (value) => {
    try {
      emit(value);
    } catch {
      journalFailures.push({ stage: value.stage, error: "OWNER_CUSTODY_JOURNAL_FAILED" });
    }
  };
  const verifyDirectories = async () => {
    for (const directory of generationDirectories) {
      canonicalDirectory(directory);
      const expected = created.find((row) => row.path === directory),
        st = fs.lstatSync(directory);
      need(expected && st.dev === expected.dev && st.ino === expected.ino, "DIRECTORY_CHANGED");
    }
    const verification = await publicMetadata(path.join(here, "registry-custody-owner-windows.ps1"), [
      "-Operation",
      "verify",
    ]);
    need(verification.value.status === "VERIFIED_EXISTING_CUSTODY_ACL", "DIRECTORY_ACL_CHANGED");
  };
  const writeCustody = async (file, bytes) => {
    await verifyDirectories();
    const copy = writeExclusive(file, bytes);
    await verifyDirectories();
    return copy;
  };
  try {
    const directories = await publicMetadata(
      path.join(here, "registry-custody-owner-windows.ps1"),
      ["-Operation", "directories"],
      true,
    );
    const allowed = new Set(
      ["C", "D"].flatMap((drive) => [
        `${drive}:\\VoyagewrightRecovery`,
        `${drive}:\\VoyagewrightRecovery\\SoundingLine`,
        `${drive}:\\VoyagewrightRecovery\\SoundingLine\\B`,
        `${drive}:\\VoyagewrightRecovery\\SoundingLine\\B\\generation-0001`,
      ]),
    );
    need(Array.isArray(directories.value.created), "DIRECTORY_METADATA");
    for (const directory of directories.value.created) {
      need(allowed.has(directory), "DIRECTORY_SCOPE");
      canonicalDirectory(directory);
      const st = fs.lstatSync(directory);
      created.push({ path: directory, dev: st.dev, ino: st.ino });
    }
    need(directories.exitCode === 0 && directories.value.status === "NEW_DIRECTORIES_ONLY", "DIRECTORY_PREPARATION");
    emit({ stage: "NEW_DIRECTORIES_ACL_VERIFIED", created, acl: directories.value.directories });
    console.log(
      "Create a recovery passphrase in this private window. Then verify each drive with the same passphrase.",
    );
    keyGenerated = true;
    const capsule = await encryptFreshKey();
    need(
      capsule.encrypted.subarray(0, 256).toString("ascii").startsWith("age-encryption.org/v1\n-> scrypt "),
      "SCRYPT_PACKAGE_REQUIRED",
    );
    emit({
      stage: "KEY_ENCRYPTED_IN_MEMORY",
      publicKeyId: capsule.keyId,
      publicKey: capsule.publicKey,
      challenge: capsule.challenge.toString("base64"),
      ownerKeyOperations: 1,
    });
    for (const file of targets) {
      const current = planInternalRegistryCustody(
        (await publicMetadata(path.join(here, "registry-custody-inventory.ps1"))).value,
      );
      need(JSON.stringify(current.devices) === JSON.stringify(firstPlan.devices), "PHYSICAL_DEVICE_CHANGED");
      reserve(file.startsWith("C:") ? 2097152 : 131072, file.startsWith("D:") ? 2097152 : 0);
      copies.push(await writeCustody(file, capsule.encrypted));
      await writeCustody(
        path.join(path.dirname(file), "package-created.public.json"),
        Buffer.from(
          JSON.stringify({
            kind: "PACKAGE_CREATED_NOT_RECOVERY_ACCEPTANCE",
            operationId,
            source,
            publicKey: capsule.publicKey,
            publicKeyId: capsule.keyId,
            challenge: capsule.challenge.toString("base64"),
            copy: copies.at(-1),
            qualification: false,
          }) + "\n",
        ),
      );
      emit({ stage: "ENCRYPTED_COPY_READBACK", copy: copies.at(-1) });
    }
    need(copies.length === 2 && copies[0].sha256 === copies[1].sha256, "COPIES_DIFFER");
    for (const file of targets) {
      await verifyDirectories();
      reserve(2097152, 2097152);
      console.log(`Verify the recovery copy on ${file.slice(0, 2)}.`);
      recoveries.push(await recoverCanary(file, capsule));
      emit({ stage: "SELECTED_INPUT_RECOVERY_CANARY", recovery: recoveries.at(-1) });
    }
    publicReceipt = {
      kind: "INTERNAL_TWO_DEVICE_OWNER_KEY_RECOVERY_CANARY_ONLY",
      operationId,
      source,
      profile: firstPlan.profile,
      devices: firstPlan.devices,
      publicKey: capsule.publicKey,
      publicKeyId: capsule.keyId,
      copies,
      recoveries,
      canary: {
        kind: "RSA_OAEP_SHA256_EXISTING_FORMAT_LABEL_ONLY",
        challenge: capsule.challenge.toString("base64"),
        sha256: hash(canary),
        registryDecoderAcceptance: false,
      },
      ageSha256: ageSha,
      privateOwnerConsole: { attached: true, visible: true, capturedSession: false, ownerPresenceProved: false },
      managedPrivateDERBuffersCleared: true,
      completeMemoryErasureProved: false,
      pagefileErasureProved: false,
      offHostRecoveryProved: false,
      laptopLossRecoveryProved: false,
      physicalDeviceFailureTested: false,
      providerArchiveTested: false,
      qualification: false,
      reuseAuthorized: false,
      registryRecipientPinInstalled: false,
    };
    const bytes = Buffer.from(JSON.stringify(publicReceipt, null, 2) + "\n");
    const finalPlan = planInternalRegistryCustody(
      (await publicMetadata(path.join(here, "registry-custody-inventory.ps1"))).value,
    );
    need(JSON.stringify(finalPlan.devices) === JSON.stringify(firstPlan.devices), "PHYSICAL_DEVICE_CHANGED");
    reserve(2097152, 2097152);
    for (const directory of generationDirectories) {
      await writeCustody(path.join(directory, "custody.public.json"), bytes);
      await writeCustody(
        path.join(directory, "README-recovery.txt"),
        Buffer.from(
          "Sounding Line internal recovery copy\r\nThis laptop has two copies of the same age-encrypted RSA PKCS#8 DER key.\r\nThe recovery passphrase is not stored here. Use the independently reviewed owner recovery tool; never paste the passphrase or decrypted key into chat.\r\nCheck custody.public.json for the public fingerprint and immutable encrypted-file hash.\r\nLocal key canaries do not prove off-host, laptop-loss or physical-device-failure recovery, provider evidence acceptance or reuse.\r\n",
        ),
      );
    }
    emit({
      stage: "BOTH_SELECTED_INPUT_CANARIES_VERIFIED_PENDING_INDEPENDENT_REVIEW",
      publicKeyId: capsule.keyId,
      copies,
      recoveries,
    });
  } catch (error) {
    failure = /^OWNER_CUSTODY_[A-Z_]+$/u.test(error.message) ? error.message : "OWNER_CUSTODY_FAILED";
    emitFailureSafe({
      stage: "INCOMPLETE_CUSTODY",
      error: failure,
      copies,
      created,
      ownerKeyOperations: keyGenerated ? 1 : 0,
    });
  } finally {
    if (failure) {
      for (const row of [...created].reverse()) {
        try {
          const st = fs.lstatSync(row.path);
          need(
            st.isDirectory() && !st.isSymbolicLink() && st.dev === row.dev && st.ino === row.ino,
            "DIRECTORY_CHANGED",
          );
          if (fs.readdirSync(row.path).length) {
            cleanup.push({ path: row.path, status: "HELD_PRESERVE_EXISTING_CONTENT" });
            continue;
          }
          fs.rmdirSync(row.path);
          cleanup.push({ path: row.path, status: "VERIFIED_EMPTY_CREATED_DIRECTORY_RETIRED" });
        } catch {
          cleanup.push({ path: row.path, status: "HELD" });
        }
      }
    }
    emitFailureSafe({
      stage: "CLOSED",
      failure: failure ?? null,
      cleanup,
      ownerKeyOperations: keyGenerated ? 1 : 0,
      qualification: false,
    });
  }
  return finalizeOwnerCustodyResult({
    receipt: publicReceipt ?? null,
    failure: failure ?? null,
    journal,
    journalFailures,
    created,
    copies,
    recoveries,
    cleanup,
    ownerKeyOperations: keyGenerated ? 1 : 0,
    qualification: false,
    reuseAuthorized: false,
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.on("SIGINT", () => activeAge?.kill());
  try {
    const result = await runRegistryCustodyOwner(process.argv.slice(2));
    if (result.kind === "OWNER_PROVIDER_RECOVERY_FAILED") {
      console.log(JSON.stringify(result));
      process.exitCode = 1;
    } else if (result.failure) {
      console.error("Recovery setup is incomplete. Existing copies are preserved; public recording may be incomplete.");
      console.log(JSON.stringify(result));
      process.exitCode = 1;
    } else if (result.receipt) {
      console.log(
        "Both encrypted copies passed their local recovery checks. The public receipt is ready for independent review.",
      );
      console.log(result.journal);
    } else console.log(JSON.stringify(result));
  } catch (error) {
    console.error(/^OWNER_CUSTODY_[A-Z_]+$/u.test(error.message) ? error.message : "OWNER_CUSTODY_FAILED");
    process.exitCode = 1;
  }
}
