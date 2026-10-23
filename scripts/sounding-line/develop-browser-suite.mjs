#!/usr/bin/env node
// Focused development only. These receipts never grant product acceptance.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { chmod, lstat, mkdir, open, readdir, realpath, rename, unlink, readlink, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { browserSuiteProfiles } from "./browser-suite-profiles.mjs";
import { runBrowserAuthority } from "./browser-authority.mjs";
import { createBrowserDiagnosticSession } from "./browser-diagnostics.mjs";
import { createBrowserFailurePublicationOutput } from "./private-browser-failure-output.mjs";
import { processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";
import { createDevelopmentFailureEvidence, readDevelopmentFailureReport } from "./development-failure-evidence.mjs";
import { createPreparationCapture, preparationPrivateError } from "./development-preparation-evidence.mjs";
import { createPreparationFailurePublisher } from "./preparation-failure-publication.mjs";
import { createPreparationFailurePublicationOutput } from "./preparation-failure-output.mjs";

const ROLE = "DEVELOPMENT_ONLY";
const DIST = ".next";
const LOG_LIMIT = 16 * 1024 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const requireValue = (value, code) => {
  if (!value) throw new Error(code);
};
const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  }).trimEnd();
const contained = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export function createDevelopmentBrowserPlan({ workspace, test, outputDirectory, candidateSha, profile = "generic" }) {
  requireValue(
    typeof workspace === "string" && path.isAbsolute(workspace) && path.resolve(workspace) === workspace,
    "DEVELOPMENT_ABSOLUTE_WORKSPACE_REQUIRED",
  );
  requireValue(/^[a-f0-9]{40}$/u.test(candidateSha ?? ""), "DEVELOPMENT_CANDIDATE_SHA_REQUIRED");
  requireValue(profile === "generic", "DEVELOPMENT_GENERIC_PROFILE_REQUIRED");
  requireValue(
    typeof test === "string" &&
      /^tests\/e2e\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.spec\.ts(?::[1-9][0-9]*)?$/u.test(test),
    "DEVELOPMENT_FOCUSED_TEST_REQUIRED",
  );
  requireValue(
    typeof outputDirectory === "string" &&
      path.isAbsolute(outputDirectory) &&
      path.resolve(outputDirectory) === outputDirectory &&
      outputDirectory !== workspace &&
      !contained(workspace, outputDirectory),
    "DEVELOPMENT_PRIVATE_OUTPUT_OUTSIDE_WORKSPACE_REQUIRED",
  );
  const stateDirectory = path.join(workspace, "artifacts", "sounding-line", "browser-development");
  const setup = [
    {
      label: "prisma-generate",
      args: ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"],
    },
    {
      label: "sqlite-bootstrap",
      args: ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "<owned-database-url>"],
    },
    { label: "generic-seed", args: ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"] },
    ...browserSuiteProfiles.generic.preparers.map((preparer) => ({
      label: preparer.script,
      args: [
        ...(preparer.runtime === "tsx" ? ["node_modules/tsx/dist/cli.mjs"] : []),
        preparer.script,
        ...(preparer.arguments ?? []),
      ],
    })),
  ];
  return {
    version: 1,
    role: ROLE,
    qualification: false,
    workspace,
    candidateSha,
    profile,
    test,
    outputDirectory,
    stateDirectory,
    activeRuntimeDirectory: path.join(workspace, "artifacts", "sounding-line", `generic-${candidateSha.slice(0, 12)}`),
    distDirectory: path.join(workspace, DIST),
    setup,
    browserArguments: [
      test,
      "--project",
      "chromium",
      "--workers",
      "1",
      "--retries",
      "0",
      "--repeat-each",
      "1",
      "--reporter",
      "list,json,html",
      "--output",
      path.join(outputDirectory, "test-results"),
    ],
  };
}

async function regularBytes(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const initial = await handle.stat(),
      named = await lstat(file);
    requireValue(
      initial.isFile() &&
        !named.isSymbolicLink() &&
        initial.dev === named.dev &&
        initial.ino === named.ino &&
        initial.size <= 256 * 1024 * 1024,
      "DEVELOPMENT_REGULAR_BOUNDED_FILE_REQUIRED",
    );
    const value = await handle.readFile(),
      final = await handle.stat(),
      current = await lstat(file);
    requireValue(
      value.length === initial.size &&
        final.size === initial.size &&
        final.mtimeMs === initial.mtimeMs &&
        final.ctimeMs === initial.ctimeMs &&
        current.dev === initial.dev &&
        current.ino === initial.ino &&
        !current.isSymbolicLink(),
      "DEVELOPMENT_FILE_CHANGED_DURING_READ",
    );
    return value;
  } finally {
    await handle.close();
  }
}
async function privateWrite(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n");
  const handle = await open(
    file,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { file, sha256: hash(bytes) };
}
async function ownedDirectory(file, create = false) {
  if (create) await mkdir(file, { mode: 0o700 });
  const stat = await lstat(file);
  requireValue(
    stat.isDirectory() && !stat.isSymbolicLink() && (await realpath(file)) === file,
    "DEVELOPMENT_REGULAR_DIRECTORY_REQUIRED",
  );
}
async function missing(file) {
  try {
    await lstat(file);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}
const sourceInput = (file) =>
  !file.includes("/") ||
  /^(src|app|components|lib|styles|public|prisma|scripts|tests|testing|native|bridgewatch)\//u.test(file);
export async function developmentSourceFingerprint(workspace) {
  const files = [];
  const paths = new Set(
    git(workspace, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
      .split("\0")
      .filter((file) => file && sourceInput(file)),
  );
  // Parse real import syntax: fixture strings and comments are not dependencies.
  const ts = createRequire(path.join(workspace, "package.json"))("typescript");
  for (const file of [...paths]) {
    if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
    const source = (await regularBytes(path.join(workspace, file))).toString("utf8");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.includes("Development_Docs")) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.text));
        requireValue(
          target.startsWith("Development_Docs/") && target.endsWith(".json") && !target.includes(".."),
          "DEVELOPMENT_IMPORTED_DATA_PATH_INVALID",
        );
        paths.add(target);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
  }
  for (const file of [...paths].sort())
    files.push({ path: file, sha256: hash(await regularBytes(path.join(workspace, file))) });
  return { head: git(workspace, ["rev-parse", "HEAD"]), files, digest: hash(JSON.stringify(files)) };
}
export function assertDevelopmentBuildReuse(prepared, current, plan) {
  requireValue(
    plan?.version === 1 &&
      plan.role === ROLE &&
      plan.qualification === false &&
      prepared?.version === 1 &&
      prepared.role === ROLE &&
      prepared.qualification === false &&
      prepared.workspace === plan.workspace &&
      prepared.profile === "generic" &&
      plan.profile === "generic" &&
      prepared.node === process.version &&
      prepared.activeRuntimeDirectory === plan.activeRuntimeDirectory,
    "DEVELOPMENT_PREPARED_SCOPE_MISMATCH",
  );
  requireValue(
    /^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(prepared.databaseName ?? ""),
    "DEVELOPMENT_DATABASE_BASENAME_INVALID",
  );
  requireValue(
    /^[a-f0-9]{64}$/u.test(current?.digest ?? "") && prepared.source?.digest === current.digest,
    "DEVELOPMENT_SOURCE_CHANGED_PREPARE_AGAIN",
  );
}
export function developmentDiagnosticBinding(source) {
  requireValue(
    /^[a-f0-9]{40}$/u.test(source?.head ?? "") && /^[a-f0-9]{64}$/u.test(source?.digest ?? ""),
    "DEVELOPMENT_DIAGNOSTIC_SOURCE_INVALID",
  );
  return { baseSha: source.head, candidateSha: source.head, planDigest: source.digest };
}
async function inspectBuildLink(file, relative, workspace) {
  const before = await lstat(file),
    literal = await readlink(file);
  const target = path.resolve(path.dirname(path.join(workspace, DIST, relative)), literal);
  const absolute = path.isAbsolute(literal);
  requireValue(
    before.isSymbolicLink() && contained(path.join(workspace, "node_modules"), target),
    "DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES",
  );
  if (absolute) {
    const targetStat = process.platform === "win32" && literal === target ? await lstat(target) : null;
    requireValue(
      targetStat?.isDirectory() && !targetStat.isSymbolicLink(),
      "DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES",
    );
  }
  requireValue((await realpath(target)) === target, "DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES");
  const after = await lstat(file);
  requireValue(
    after.isSymbolicLink() &&
      after.dev === before.dev &&
      after.ino === before.ino &&
      after.ctimeMs === before.ctimeMs &&
      after.mtimeMs === before.mtimeMs &&
      (await readlink(file)) === literal,
    "DEVELOPMENT_BUILD_LINK_CHANGED",
  );
  return { link: literal, target, ...(absolute ? { linkType: "junction" } : {}) };
}
async function treeFingerprint(root, workspace) {
  const files = [];
  async function visit(directory, prefix, depth = 0) {
    requireValue(depth <= 64 && files.length < 100000, "DEVELOPMENT_BUILD_TREE_LIMIT");
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name,
        file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        files.push({ path: relative, type: "symlink", ...(await inspectBuildLink(file, relative, workspace)) });
      } else if (entry.isDirectory()) {
        await ownedDirectory(file);
        await visit(file, relative, depth + 1);
      } else {
        const value = await regularBytes(file);
        files.push({ path: relative, bytes: value.length, sha256: hash(value) });
      }
    }
  }
  await ownedDirectory(root);
  await visit(root, "");
  return { files, digest: hash(JSON.stringify(files)) };
}
async function copyBuild(from, to, workspace, prefix = "") {
  await ownedDirectory(to, true);
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const source = path.join(from, entry.name),
      target = path.join(to, entry.name);
    if (entry.isSymbolicLink()) {
      const descriptor = await inspectBuildLink(source, relative, workspace);
      await symlink(descriptor.link, target, descriptor.linkType);
    } else if (entry.isDirectory()) await copyBuild(source, target, workspace, relative);
    else await privateWrite(target, await regularBytes(source));
  }
}
async function immutable(root, workspace, prefix = "") {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      await inspectBuildLink(file, relative, workspace);
      continue;
    }
    if (entry.isDirectory()) await immutable(file, workspace, relative);
    else {
      await regularBytes(file);
      await chmod(file, 0o400);
    }
  }
  await chmod(root, 0o500);
}
export {
  treeFingerprint as developmentBuildFingerprint,
  copyBuild as copyDevelopmentBuild,
  immutable as makeDevelopmentBuildImmutable,
};
async function streamedFileHash(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const initial = await handle.stat(),
      named = await lstat(file);
    requireValue(
      initial.isFile() &&
        !named.isSymbolicLink() &&
        initial.dev === named.dev &&
        initial.ino === named.ino &&
        initial.size <= 1024 * 1024 * 1024,
      "DEVELOPMENT_BROWSER_FILE_REQUIRED",
    );
    const digest = createHash("sha256"),
      buffer = Buffer.allocUnsafe(1024 * 1024);
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      requireValue(total <= initial.size && total <= 1024 * 1024 * 1024, "DEVELOPMENT_BROWSER_HASH_LIMIT");
      digest.update(buffer.subarray(0, bytesRead));
    }
    const final = await handle.stat(),
      current = await lstat(file);
    requireValue(
      total === initial.size &&
        final.size === initial.size &&
        final.mtimeMs === initial.mtimeMs &&
        final.ctimeMs === initial.ctimeMs &&
        current.dev === initial.dev &&
        current.ino === initial.ino &&
        !current.isSymbolicLink(),
      "DEVELOPMENT_BROWSER_CHANGED_DURING_READ",
    );
    return { file, bytes: total, sha256: digest.digest("hex") };
  } finally {
    await handle.close();
  }
}
async function installedTreeDigest(root) {
  const base = path.join(root, "node_modules"),
    rows = [];
  async function visit(folder, prefix, depth = 0) {
    requireValue(depth <= 64 && rows.length < 150000, "DEVELOPMENT_DEPENDENCY_INVENTORY_LIMIT");
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name),
        relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        const target = await realpath(file);
        requireValue(
          contained(base, target) || target === path.join(root, "bridgewatch"),
          "DEVELOPMENT_EXTERNAL_DEPENDENCY_LINK_REFUSED",
        );
        rows.push({ path: relative, link: await readlink(file), target });
      } else if (entry.isDirectory()) {
        await ownedDirectory(file);
        await visit(file, relative, depth + 1);
      } else rows.push({ path: relative, sha256: hash(await regularBytes(file)) });
    }
  }
  await visit(base, "");
  return hash(JSON.stringify(rows));
}
async function dependencyFingerprint(root) {
  await ownedDirectory(path.join(root, "node_modules"));
  const { registry } = await import(
    pathToFileURL(path.join(root, "node_modules/playwright-core/lib/server/registry/index.js")).href
  );
  const browsers = [];
  for (const name of ["chromium", "chromium-headless-shell", "ffmpeg"]) {
    const file = registry.findExecutable(name).executablePath();
    requireValue((await realpath(file)) === file, "DEVELOPMENT_BROWSER_SYMLINK_REFUSED");
    browsers.push({ name, ...(await streamedFileHash(file)) });
  }
  return {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    installedLock: hash(await regularBytes(path.join(root, "node_modules", ".package-lock.json"))),
    projectLock: hash(await regularBytes(path.join(root, "package-lock.json"))),
    installedTree: await installedTreeDigest(root),
    browsers,
  };
}
async function freshContext(plan) {
  if (!(await missing(plan.activeRuntimeDirectory))) {
    await ownedDirectory(plan.activeRuntimeDirectory);
    await rename(plan.activeRuntimeDirectory, path.join(plan.outputDirectory, "previous-mutable-context"));
  }
  await ownedDirectory(plan.activeRuntimeDirectory, true);
}
function fixtureEnvironment(plan, databaseName, secret, sourceDigest) {
  const inherited = [
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "PLAYWRIGHT_BROWSERS_PATH",
  ];
  return {
    ...Object.fromEntries(
      inherited.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]),
    ),
    ...browserSuiteProfiles.generic.environment,
    DATABASE_URL: `file:${path.join(plan.activeRuntimeDirectory, databaseName)}`,
    SOUNDING_LINE_SUITE_PROFILE: "generic",
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    SOUNDING_LINE_INTERNAL_RUNTIME: "1",
    FOREVER_VALIDATION_ISOLATION: "1",
    FOREVER_VALIDATION_PRODUCTION_IDENTITY: "1",
    FOREVER_VALIDATION_NONCE_HASH: hash(`development:${sourceDigest}:generic`),
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_PHASE7_TASK_ROOT: path.join(plan.activeRuntimeDirectory, "email"),
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(plan.activeRuntimeDirectory, "email", "outbox", "messages.jsonl"),
    PHASE2_LEGACY_ACCESS_CODE: secret,
    NEXT_DIST_DIR: DIST,
    NEXT_TELEMETRY_DISABLED: "1",
    SEALED_HOLD_SINGLE_FORK: "1",
    CIRCLE_NODE_TOTAL: "2",
    PLAYWRIGHT_HTML_OPEN: "never",
  };
}
function privateLauncher(output, secret) {
  const children = [];
  return {
    launch(command, args, options) {
      const child = spawnOwnedProcess(command, args, options),
        streams = {};
      child.stdout.unpipe(process.stdout);
      child.stderr.unpipe(process.stderr);
      for (const [name, stream] of [
        ["stdout", child.stdout],
        ["stderr", child.stderr],
      ]) {
        const item = { chunks: [], bytes: 0, retained: 0, complete: true, digest: createHash("sha256") };
        streams[name] = item;
        stream.on("data", (chunk) => {
          item.bytes += chunk.length;
          item.digest.update(chunk);
          if (item.retained + chunk.length <= LOG_LIMIT) {
            item.chunks.push(chunk);
            item.retained += chunk.length;
          } else item.complete = false;
        });
        stream.resume();
      }
      children.push({ command, args, streams });
      return child;
    },
    snapshot() {
      requireValue(children.length === 2, "DEVELOPMENT_PRODUCER_SET_CHANGED");
      return children.flatMap((child, index) =>
        Object.entries(child.streams).map(([kind, item]) => ({
          label: `${index === 0 ? "server" : "browser"}.${kind}`,
          bytes: Buffer.concat(item.chunks),
          originalBytes: item.bytes,
          originalStreamSHA256: item.digest.copy().digest("hex"),
          complete: item.complete,
        })),
      );
    },
    async close() {
      const receipts = [];
      for (const [index, child] of children.entries()) {
        const streams = {};
        for (const [name, item] of Object.entries(child.streams)) {
          const original = Buffer.concat(item.chunks),
            token = Buffer.from(secret),
            pieces = [];
          let offset = 0,
            found;
          while ((found = original.indexOf(token, offset)) !== -1) {
            pieces.push(original.subarray(offset, found), Buffer.from("[REDACTED_GENERATED_RUNTIME_CREDENTIAL]"));
            offset = found + token.length;
          }
          pieces.push(original.subarray(offset));
          const value = Buffer.concat(pieces);
          streams[name] = {
            ...(await privateWrite(path.join(output, `child-${index + 1}-${name}.redacted.log`), Buffer.from(value))),
            originalBytes: item.bytes,
            originalStreamSHA256: item.digest.digest("hex"),
            complete: item.complete,
          };
        }
        receipts.push({ command: child.command, args: child.args, streams });
      }
      requireValue(
        receipts.every((child) => Object.values(child.streams).every((stream) => stream.complete)),
        "DEVELOPMENT_LOG_LIMIT_EXCEEDED",
      );
      return receipts;
    },
  };
}
export { privateLauncher as createDevelopmentPrivateLauncher };
async function setupCommand(plan, env, launcher, step, receipts) {
  if (launcher.runPreparationStep) return launcher.runPreparationStep(plan, env, step, receipts);
  const args = step.args.map((arg) => (arg === "<owned-database-url>" ? env.DATABASE_URL : arg));
  const child = launcher.launch(process.execPath, args, { root: plan.workspace, env });
  let timer, exit, error, cleanup;
  try {
    exit = await Promise.race([
      processExit(child),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("DEVELOPMENT_SETUP_TIMEOUT")), 20 * 60_000);
      }),
    ]);
  } catch (cause) {
    error = cause;
  } finally {
    clearTimeout(timer);
    try {
      cleanup = await stopOwnedProcess(child);
    } catch {
      cleanup = { status: "FAIL" };
    }
    receipts.push({ label: step.label, exit: exit ?? null, cleanup });
  }
  if (error) throw error;
  requireValue(
    exit?.code === 0 && !exit.supervisionFailure && cleanup.status === "PASS",
    `DEVELOPMENT_SETUP_FAILED:${step.label}`,
  );
}
export { setupCommand as runDevelopmentSetupCommand, fixtureEnvironment as developmentFixtureEnvironment };
function preparationSession(plan) {
  const authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const controllerSha = git(authorityRoot, ["rev-parse", "HEAD"]);
  const hosted = process.env.GITHUB_ACTIONS === "true";
  if (hosted)
    requireValue(
      process.env.GITHUB_SHA === controllerSha &&
        process.env.CANDIDATE_SHA === plan.candidateSha &&
        process.env.TEST_SELECTOR === plan.test &&
        process.env.GITHUB_REF === "refs/heads/main" &&
        process.env.GITHUB_WORKFLOW_REF ===
          "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-focused-repair.yml@refs/heads/main",
      "DEVELOPMENT_PREPARATION_TRUSTED_CONTROLLER_REQUIRED",
    );
  else requireValue(!process.env.GITHUB_OUTPUT, "DEVELOPMENT_PREPARATION_HOSTED_OUTPUT_REQUIRED");
  const binding = {
    version: 1,
    sessionId: randomUUID(),
    controllerSha,
    candidateSha: plan.candidateSha,
    selectorDigest: hash(plan.test),
    provider: hosted
      ? {
          repository: process.env.GITHUB_REPOSITORY,
          runId: process.env.GITHUB_RUN_ID,
          attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
          workflowSha: process.env.GITHUB_SHA,
        }
      : null,
  };
  const output = createPreparationFailurePublicationOutput({
    outputFile: process.env.GITHUB_OUTPUT,
    nonce: process.env.SOUNDING_LINE_PREPARATION_FAILURE_PUBLICATION_NONCE,
    binding,
  });
  requireValue(output.initialized, "DEVELOPMENT_PREPARATION_OUTPUT_INITIALIZATION_FAILED");
  const capture = createPreparationCapture(binding, plan.outputDirectory);
  const publisher = createPreparationFailurePublisher({ binding, authorityRoot, onPublication: output.capture });
  return {
    capture,
    finish(receipt, error) {
      let publication;
      try {
        const token = capture.complete(receipt, error);
        publication = hosted ? publisher.complete(token) : { status: "NOT_CONFIGURED", qualification: false };
      } catch {
        publication = { status: "NOT_PUBLISHED", code: "COLLECTION_FAILED", qualification: false };
      }
      return { publication, output: output.finish({ failed: !receipt.status.startsWith("PASS_") }) };
    },
  };
}
async function execute(mode, plan, options) {
  requireValue(["prepare", "run"].includes(mode), "DEVELOPMENT_PREPARE_OR_RUN_REQUIRED");
  const preparation = mode === "prepare" ? preparationSession(plan) : null;
  const receipt = { version: 1, role: ROLE, qualification: false, status: "FAIL", mode, test: plan.test, commands: [] };
  let lockFile,
    lock,
    launcher,
    diagnosticSession,
    outputStartedAt,
    outputReady = false,
    originalError;
  try {
    requireValue(
      (await lstat(path.join(plan.workspace, ".git"))).isFile() &&
        git(plan.workspace, ["branch", "--show-current"]) !== "main" &&
        (await realpath(plan.workspace)) === plan.workspace,
      "DEVELOPMENT_DEDICATED_WORKTREE_REQUIRED",
    );
    for (const file of [".env", ".env.local", ".env.production", ".env.production.local"])
      requireValue(await missing(path.join(plan.workspace, file)), "DEVELOPMENT_UNOWNED_ENVIRONMENT_FILE_REFUSED");
    await ownedDirectory(path.dirname(plan.outputDirectory));
    await ownedDirectory(plan.outputDirectory, true);
    outputReady = true;
    outputStartedAt = Math.floor((await lstat(plan.outputDirectory)).ctimeMs);
    for (const artifacts of [
      path.join(plan.workspace, "artifacts"),
      path.join(plan.workspace, "artifacts", "sounding-line"),
    ]) {
      if (await missing(artifacts)) await ownedDirectory(artifacts, true);
      else await ownedDirectory(artifacts);
    }
    if (await missing(plan.stateDirectory)) await ownedDirectory(plan.stateDirectory, true);
    else await ownedDirectory(plan.stateDirectory);
    lockFile = path.join(plan.stateDirectory, "active.lock");
    preparation?.capture.phase("LOCK");
    lock = await open(lockFile, "wx", 0o600);
    preparation?.capture.phase("SOURCE_FINGERPRINT");
    const source = await developmentSourceFingerprint(plan.workspace);
    if (mode === "prepare") {
      preparation.capture.source(source);
      preparation.capture.phase("CONTEXT");
      const preparedDirectory = path.join(plan.stateDirectory, `prepared-${randomUUID()}`);
      await ownedDirectory(preparedDirectory, true);
      await freshContext(plan);
      const stamp = new Date().toISOString().replace(/\D/gu, "");
      const databaseName = `validation-isolated-${stamp.slice(0, 8)}-${stamp.slice(8, 17)}-${randomBytes(16).toString("hex")}.db`;
      const secret = `synthetic-${randomBytes(24).toString("base64url")}`;
      const environment = fixtureEnvironment(plan, databaseName, secret, source.digest);
      launcher = preparation.capture;
      preparation.capture.phase("DEPENDENCIES");
      await dependencyFingerprint(plan.workspace);
      for (const step of plan.setup) await setupCommand(plan, environment, launcher, step, receipt.commands);
      if (!(await missing(plan.distDirectory))) {
        await ownedDirectory(plan.distDirectory);
        await rename(plan.distDirectory, path.join(plan.outputDirectory, "previous-runtime-build"));
      }
      await setupCommand(
        plan,
        environment,
        launcher,
        { label: "next-build", args: ["node_modules/next/dist/bin/next", "build"] },
        receipt.commands,
      );
      preparation.capture.phase("VERIFY_SOURCE");
      requireValue(
        (await developmentSourceFingerprint(plan.workspace)).digest === source.digest,
        "DEVELOPMENT_SOURCE_CHANGED_DURING_PREPARE",
      );
      const buildDirectory = path.join(preparedDirectory, "immutable-build");
      preparation.capture.phase("FREEZE_BUILD");
      await rename(plan.distDirectory, buildDirectory);
      await immutable(buildDirectory, plan.workspace);
      preparation.capture.phase("SNAPSHOT_DATABASE");
      const database = await regularBytes(path.join(plan.activeRuntimeDirectory, databaseName));
      await privateWrite(path.join(preparedDirectory, databaseName), database);
      const secretFile = await privateWrite(path.join(preparedDirectory, "fixture-credential.private.json"), {
        secret,
      });
      preparation.capture.phase("MANIFEST");
      const prepared = {
        version: 1,
        role: ROLE,
        qualification: false,
        workspace: plan.workspace,
        profile: "generic",
        source,
        node: process.version,
        activeRuntimeDirectory: plan.activeRuntimeDirectory,
        preparedDirectory,
        buildDirectory,
        build: await treeFingerprint(buildDirectory, plan.workspace),
        databaseName,
        databaseSHA256: hash(database),
        secretFile,
        dependencies: await dependencyFingerprint(plan.workspace),
      };
      receipt.preparedManifest = await privateWrite(path.join(preparedDirectory, "prepared.private.json"), prepared);
      receipt.status = "PASS_DEVELOPMENT_PREPARED_NOT_ACCEPTANCE";
    } else {
      requireValue(
        typeof options.prepared === "string" &&
          path.isAbsolute(options.prepared) &&
          contained(plan.stateDirectory, options.prepared) &&
          /^[a-f0-9]{64}$/u.test(options["manifest-sha256"] ?? ""),
        "DEVELOPMENT_EXACT_MANIFEST_REQUIRED",
      );
      await ownedDirectory(path.dirname(options.prepared));
      const raw = await regularBytes(options.prepared);
      requireValue(hash(raw) === options["manifest-sha256"], "DEVELOPMENT_MANIFEST_CHANGED");
      const prepared = JSON.parse(raw.toString("utf8"));
      assertDevelopmentBuildReuse(prepared, source, plan);
      requireValue(
        prepared.preparedDirectory === path.dirname(options.prepared) &&
          prepared.buildDirectory === path.join(prepared.preparedDirectory, "immutable-build") &&
          prepared.secretFile.file === path.join(prepared.preparedDirectory, "fixture-credential.private.json"),
        "DEVELOPMENT_PREPARED_LAYOUT_CHANGED",
      );
      await ownedDirectory(prepared.preparedDirectory);
      requireValue(
        (await treeFingerprint(prepared.buildDirectory, plan.workspace)).digest === prepared.build.digest &&
          JSON.stringify(await dependencyFingerprint(plan.workspace)) === JSON.stringify(prepared.dependencies),
        "DEVELOPMENT_PREPARED_BUILD_OR_DEPENDENCIES_CHANGED",
      );
      const secretBytes = await regularBytes(prepared.secretFile.file);
      requireValue(hash(secretBytes) === prepared.secretFile.sha256, "DEVELOPMENT_FIXTURE_CREDENTIAL_CHANGED");
      const { secret } = JSON.parse(secretBytes.toString("utf8"));
      requireValue(/^synthetic-[A-Za-z0-9_-]{32}$/u.test(secret), "DEVELOPMENT_FIXTURE_CREDENTIAL_INVALID");
      await freshContext(plan);
      const database = await regularBytes(path.join(prepared.preparedDirectory, prepared.databaseName));
      requireValue(hash(database) === prepared.databaseSHA256, "DEVELOPMENT_DATABASE_BASELINE_CHANGED");
      await privateWrite(path.join(plan.activeRuntimeDirectory, prepared.databaseName), database);
      if (!(await missing(plan.distDirectory))) {
        await ownedDirectory(plan.distDirectory);
        await rename(plan.distDirectory, path.join(plan.outputDirectory, "previous-runtime-build"));
      }
      await copyBuild(prepared.buildDirectory, plan.distDirectory, plan.workspace);
      requireValue(
        (await treeFingerprint(plan.distDirectory, plan.workspace)).digest === prepared.build.digest,
        "DEVELOPMENT_RUNTIME_COPY_CHANGED",
      );
      launcher = privateLauncher(plan.outputDirectory, secret);
      const environment = fixtureEnvironment(plan, prepared.databaseName, secret, source.digest);
      const diagnosticBinding = developmentDiagnosticBinding(source);
      diagnosticSession = createBrowserDiagnosticSession(plan.workspace, diagnosticBinding);
      const publicationOutput = createBrowserFailurePublicationOutput({
        outputFile: process.env.GITHUB_OUTPUT,
        nonce: process.env.SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE,
      });
      requireValue(publicationOutput.initialized, "DEVELOPMENT_PUBLICATION_OUTPUT_INITIALIZATION_FAILED");
      receipt.diagnosticIdentity = {
        role: ROLE,
        qualification: false,
        meaning: "Source identity only; neither head field claims protected main.",
        ...diagnosticBinding,
      };
      receipt.runtime = await runBrowserAuthority({
        root: plan.workspace,
        onPrivateFailurePublication: publicationOutput.capture,
        async collectDevelopmentFailureEvidence({ binding, producersClosed }) {
          requireValue(producersClosed, "DEVELOPMENT_PRODUCER_CLOSURE_UNPROVEN");
          const report = await readDevelopmentFailureReport(plan.outputDirectory, outputStartedAt);
          const provider =
            process.env.GITHUB_ACTIONS === "true"
              ? {
                  repository: process.env.GITHUB_REPOSITORY,
                  runId: process.env.GITHUB_RUN_ID,
                  attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
                  workflowSha: process.env.GITHUB_SHA,
                }
              : null;
          return createDevelopmentFailureEvidence({
            binding,
            selector: plan.test,
            provider,
            report,
            streams: launcher.snapshot(),
            producersClosed,
          });
        },
        environment: {
          ...environment,
          ...diagnosticSession.beginScope(),
          PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(plan.outputDirectory, "playwright-report.original.json"),
          PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(plan.outputDirectory, "html-report"),
        },
        fixtureArguments: [],
        browserArguments: plan.browserArguments,
        launch: launcher.launch,
      });
      receipt.privateFailureOutput = publicationOutput.finish({ failed: Boolean(receipt.runtime.failureCategory) });
      await privateWrite(path.join(plan.outputDirectory, "browser-runtime.private.json"), receipt.runtime);
      requireValue(receipt.runtime.lifecycle.cleanup.status === "PASS", "DEVELOPMENT_BROWSER_CLEANUP_FAILED");
      const reportBytes = await regularBytes(path.join(plan.outputDirectory, "playwright-report.original.json"));
      const report = JSON.parse(reportBytes.toString("utf8"));
      const selected = report.stats.expected + report.stats.unexpected + report.stats.flaky + report.stats.skipped;
      requireValue(
        Number.isSafeInteger(selected) &&
          selected > 0 &&
          (!plan.test.includes(":") || selected === 1) &&
          report.stats.skipped === 0 &&
          report.stats.flaky === 0,
        "DEVELOPMENT_SELECTED_CASE_COUNT_MISMATCH",
      );
      requireValue(
        (report.stats.unexpected === 0) === !receipt.runtime.failureCategory,
        "DEVELOPMENT_CASE_AND_RUNTIME_DISAGREE",
      );
      receipt.actualSelectedCases = selected;
      receipt.report = {
        file: path.join(plan.outputDirectory, "playwright-report.original.json"),
        sha256: hash(reportBytes),
      };
      requireValue(
        (await developmentSourceFingerprint(plan.workspace)).digest === source.digest &&
          (await treeFingerprint(prepared.buildDirectory, plan.workspace)).digest === prepared.build.digest &&
          JSON.stringify(await dependencyFingerprint(plan.workspace)) === JSON.stringify(prepared.dependencies),
        "DEVELOPMENT_SOURCE_OR_SNAPSHOT_CHANGED",
      );
      await rename(plan.distDirectory, path.join(plan.outputDirectory, "used-runtime-build"));
      receipt.status = receipt.runtime.failureCategory
        ? "DEVELOPMENT_CASE_FAILED_NOT_ACCEPTANCE"
        : "PASS_DEVELOPMENT_CASE_NOT_ACCEPTANCE";
      receipt.buildReusedWithoutRebuild = true;
    }
  } catch (error) {
    originalError = error;
    if (preparation) receipt.privateError = preparationPrivateError(error);
    receipt.error = {
      name: error.name,
      messageSHA256: hash(String(error.message)),
      code: /^DEVELOPMENT_[A-Z0-9_:.\/-]+$/u.test(error.message) ? error.message : "DEVELOPMENT_OPERATION_FAILED",
    };
  } finally {
    if (preparation) receipt.operationStatus = receipt.status;
    diagnosticSession?.clearScope();
    try {
      if (launcher?.close) receipt.logs = await launcher.close();
    } catch (error) {
      receipt.status = "FAIL";
      receipt.logEvidenceIncomplete = true;
      if (preparation) {
        receipt.logFinalizationError = preparationPrivateError(error);
        if (!originalError) preparation.capture.phase("FINALIZATION");
        originalError ??= error;
      }
    }
    try {
      if (outputReady) {
        try {
          await privateWrite(path.join(plan.outputDirectory, "development-result.private.json"), receipt);
        } catch (error) {
          if (!preparation) throw error;
          receipt.status = "FAIL";
          receipt.privateReceiptPersistence = { status: "FAIL", error: preparationPrivateError(error) };
          originalError ??= error;
        }
      } else receipt.privateReceiptPersistence = { status: "NOT_CREATED" };
    } finally {
      try {
        if (lock) {
          await lock.close();
          await unlink(lockFile);
        }
      } catch (error) {
        if (!preparation) throw error;
        receipt.status = "FAIL";
        receipt.lockRelease = { status: "FAIL", error: preparationPrivateError(error) };
        originalError ??= error;
      } finally {
        if (preparation) receipt.preparationRetention = preparation.finish(receipt, originalError);
      }
    }
  }
  return receipt;
}
export { execute as executeDevelopmentBrowserSuite };
function optionsFrom(argv) {
  const result = {};
  const allowed = new Set(["workspace", "test", "output", "prepared", "manifest-sha256"]);
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2);
    requireValue(
      argv[i]?.startsWith("--") &&
        allowed.has(name) &&
        argv[i + 1] &&
        !argv[i + 1].startsWith("--") &&
        result[name] === undefined,
      "DEVELOPMENT_ARGUMENTS_INVALID",
    );
    result[name] = argv[i + 1];
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    const options = optionsFrom(process.argv.slice(3));
    const plan = createDevelopmentBrowserPlan({
      workspace: options.workspace,
      test: options.test,
      outputDirectory: options.output,
      candidateSha: git(options.workspace, ["rev-parse", "HEAD"]),
    });
    const receipt = await execute(process.argv[2], plan, options);
    process.stdout.write(
      JSON.stringify({
        status: receipt.status,
        role: ROLE,
        qualification: false,
        output: plan.outputDirectory,
        ...(receipt.preparationRetention ? { preparationRetention: receipt.preparationRetention } : {}),
      }) + "\n",
    );
    if (!receipt.status.startsWith("PASS_")) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      JSON.stringify({ status: "FAIL", role: ROLE, qualification: false, errorSHA256: hash(String(error.message)) }) +
        "\n",
    );
    process.exitCode = 1;
  }
}
