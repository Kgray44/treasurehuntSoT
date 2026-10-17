// Shared fixed technical-case machinery. Only the literal R12/R13 wrappers select a protected profile.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createBrowserDiagnosticSession } from "./browser-diagnostics.mjs";
import { processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";

import {
  beginReadinessAttempt,
  completeReadinessAttempt,
  loadReadinessAttempt,
  requireLatestReadinessPASS,
  readinessSuiteArguments,
  readReadinessProfileContext,
  publishReadinessEvidence,
  validateReadinessReceipt,
} from "./experience-dependency-readiness.mjs";

const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function createTechnicalProof(version) {
  if (version !== 12 && version !== 13) throw Error("TECHNICAL_PROFILE_INVALID");
  const prefix = version === 12 ? "r12" : "r13";
  const coreModule = () => (version === 12 ? import("./experience-r12.mjs") : import("./experience-r13.mjs"));
  const TECHNICAL = Object.freeze({
    classification: "OPERATOR_LOCAL_ONE_USE_TECHNICAL_DIAGNOSTIC_NOT_AUTHENTICATED_CUSTODY",
    spec: "tests/e2e/crossdeck-phase2.spec.ts",
    title: "crossdeck.surface-handoff",
    grep: "crossdeck\\.surface-handoff$",
    publicationDirectory: `Development_Docs/Projects/Project_Crossdeck/evidence/${prefix}-verification-20261017/focused-technical`,
  });

  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const fail = (code) => {
    throw Error(`PRODUCT_EXPERIENCE_EXCEPTION_R${version}_TECHNICAL_${code}`);
  };
  const git = (root, ...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  const json = (file) => JSON.parse(readFileSync(file, "utf8"));
  const persist = (file, value, options) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", options);
  const stages = new Set(["original", "corrected"]);
  const runtimeSource = (file) =>
    /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
    /^(?:native|Development_Docs\/Spatial_Experience)\//u.test(file) ||
    file === ".agents/landfall-device-lab-hosted.yml" ||
    /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc|\.gitignore|\.gitattributes)$/u.test(file);
  function committedSourceManifest(root, revision) {
    const entries = git(root, "ls-tree", "-rz", revision)
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const [metadata, file] = line.split("\t");
        const [mode, type, blob] = metadata.split(" ");
        return { path: file, mode, type, blob };
      })
      .filter((entry) => runtimeSource(entry.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (entries.some((entry) => entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)))
      fail("COMMITTED_SOURCE_NOT_REGULAR_FILE");
    const blobs = [...new Set(entries.map((entry) => entry.blob))];
    const bytes = execFileSync("git", ["cat-file", "--batch"], {
      cwd: root,
      input: blobs.join("\n") + "\n",
      maxBuffer: 128 * 1024 * 1024,
    });
    const hashes = new Map();
    let offset = 0;
    for (const blob of blobs) {
      const newline = bytes.indexOf(10, offset);
      const [actual, type, lengthText] = bytes.subarray(offset, newline).toString("utf8").split(" ");
      const length = Number(lengthText);
      if (
        newline < offset ||
        actual !== blob ||
        type !== "blob" ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        newline + 1 + length >= bytes.length ||
        bytes[newline + 1 + length] !== 10
      )
        fail("COMMITTED_SOURCE_BATCH_INVALID");
      hashes.set(blob, hash(bytes.subarray(newline + 1, newline + 1 + length)));
      offset = newline + 1 + length + 1;
    }
    if (offset !== bytes.length) fail("COMMITTED_SOURCE_BATCH_INVALID");
    return entries
      .map((entry) => ({ path: entry.path, sha256: hashes.get(entry.blob) }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  function r12TechnicalMarkerPath(root, stage, launch = false) {
    if (!stages.has(stage)) fail("STAGE_INVALID");
    return path.join(
      git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"),
      "sounding-line",
      `crossdeck-${prefix}-focused-${stage}${launch ? "-launch" : ""}.json`,
    );
  }
  function r12TechnicalBrowserArguments() {
    return [
      TECHNICAL.spec,
      "--grep",
      TECHNICAL.grep,
      "--workers",
      "1",
      "--retries",
      "0",
      "--repeat-each",
      "1",
      "--reporter",
      "json",
    ];
  }
  function r12TechnicalSuiteArguments({ root, baseSha, candidateSha, stage, databaseUrl }) {
    return [
      "--profile",
      "generic",
      "--workspace",
      root,
      "--candidate",
      candidateSha,
      "--database-url",
      databaseUrl,
      `--${prefix}-technical-proof`,
      stage,
      `--${prefix}-base`,
      baseSha,
      "--",
      ...r12TechnicalBrowserArguments(),
    ];
  }
  function cleanSource(root) {
    git(root, "diff", "--exit-code", "HEAD", "--");
    const sourcePaths = [
      "src",
      "app",
      "components",
      "lib",
      "styles",
      "public",
      "prisma",
      "scripts",
      "tests",
      "testing",
      ".github",
      "native",
      "Development_Docs/Spatial_Experience",
      ".agents/landfall-device-lab-hosted.yml",
      "package.json",
      "package-lock.json",
      ":(top,glob)*.config.*",
      "tsconfig.json",
      ".nvmrc",
      ".gitignore",
      ".gitattributes",
    ];
    for (const ignored of [false, true]) {
      const untracked = git(
        root,
        "ls-files",
        "--others",
        ...(ignored ? ["--ignored"] : []),
        "--exclude-standard",
        "-z",
        "--",
        ...sourcePaths,
      )
        .split("\0")
        .filter(Boolean);
      if (untracked.some(runtimeSource)) fail("UNTRACKED_RUNTIME_SOURCE_FORBIDDEN");
    }
    for (const name of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
      ".env.test",
      ".env.test.local",
      ".env.development",
      ".env.development.local",
    ])
      if (existsSync(path.join(root, name))) fail("AMBIENT_DOTENV_FORBIDDEN");
  }
  function r12TechnicalSourceManifest(root) {
    cleanSource(root);
    return git(root, "ls-files", "-z")
      .split("\0")
      .filter(runtimeSource)
      .sort()
      .map((file) => {
        if (!lstatSync(path.join(root, file)).isFile()) fail("SOURCE_NOT_REGULAR_FILE");
        return { path: file, sha256: hash(readFileSync(path.join(root, file))) };
      });
  }
  function sameSource(root, marker) {
    if (hash(JSON.stringify(r12TechnicalSourceManifest(root))) !== marker.sourceManifestSha256)
      fail("WORKING_SOURCE_CHANGED");
  }
  function assertR12TechnicalSource(root, marker) {
    sameSource(root, marker);
    git(
      installed,
      "diff",
      "--exit-code",
      marker.baseSha,
      "--",
      "scripts/sounding-line",
      "testing/product-experience-exceptions.json",
      "package.json",
    );
  }
  function r12TechnicalEnvironment(environment = process.env) {
    // Ambient flags, tokens, NODE_OPTIONS, browser endpoints and provider selection
    // never reach the candidate setup or browser. The generic profile owns fixtures.
    return Object.fromEntries(
      [
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
      ]
        .filter((key) => typeof environment[key] === "string")
        .map((key) => [key, environment[key]]),
    );
  }
  async function admit(options) {
    const core = await coreModule();
    return core[`admitR${version}FocusedTechnical`](options);
  }

  async function requireR12TechnicalSuite({
    root,
    candidateSha,
    options,
    browserTests,
    argv,
    environment = process.env,
  }) {
    const stage = options[`${prefix}-technical-proof`];
    const baseSha = options[`${prefix}-base`];
    if (!stages.has(stage)) fail("STAGE_INVALID");
    const markerPath = r12TechnicalMarkerPath(root, stage);
    if (!existsSync(markerPath)) fail("RESERVATION_REQUIRED");
    const marker = json(markerPath);
    if (
      marker.status !== "STARTED" ||
      marker.classification !== TECHNICAL.classification ||
      marker.stage !== stage ||
      marker.baseSha !== baseSha ||
      marker.candidateSha !== candidateSha ||
      marker.lease !== environment[`SOUNDING_LINE_R${version}_TECHNICAL_LEASE`] ||
      marker.databaseUrl !== options["database-url"] ||
      JSON.stringify(argv) !==
        JSON.stringify(
          r12TechnicalSuiteArguments({ root, baseSha, candidateSha, stage, databaseUrl: marker.databaseUrl }),
        ) ||
      JSON.stringify(browserTests) !== JSON.stringify(r12TechnicalBrowserArguments())
    )
      fail("INVOCATION_CHANGED");
    try {
      process.kill(marker.ownerPid, 0);
    } catch {
      fail("OWNER_EXITED");
    }
    await validateLocalBinding({ root, baseSha, candidateSha, stage, marker });
    if (version === 13) {
      const ctx = requireLatestReadinessPASS({
        root,
        baseSha,
        candidateSha,
        stage,
        manifest: { ...marker },
        environment: r12TechnicalEnvironment(environment),
      });
      if (
        marker.readinessAttempt !== ctx.attempt ||
        marker.readinessReceiptSha256 !== hash(readFileSync(ctx.paths.receipt)) ||
        Number(environment.SOUNDING_LINE_R13_READINESS_ATTEMPT) !== ctx.attempt
      )
        fail("READINESS_BINDING_CHANGED");
    }
    // A duplicate child, setup failure, cancellation or unknown outcome is spent.
    persist(
      r12TechnicalMarkerPath(root, stage, true),
      {
        classification: marker.classification,
        stage,
        lease: marker.lease,
        ownerPid: process.pid,
        baseSha,
        candidateSha,
        sourceDigest: marker.sourceDigest,
        startedAt: new Date().toISOString(),
      },
      { flag: "wx" },
    );
    return marker;
  }

  async function validateLocalBinding({ root, baseSha, candidateSha, stage, marker }) {
    // The authenticated parent already checked live campaign history. The child
    // receives no credential and validates that same immutable protected source.
    const core = await coreModule();
    const CROSSDECK = core[`CROSSDECK_R${version}`];
    const FOCUSED = core[`R${version}_FOCUSED`];
    const validateRegistry = core[`validateR${version}Registry`];
    const { productSourceDigest, sourceSnapshot, planProductExperience } = await import("./product-experience.mjs");
    const registry = JSON.parse(git(installed, "show", `${baseSha}:testing/product-experience-exceptions.json`));
    validateRegistry(registry);
    if (
      git(installed, "rev-parse", "HEAD") !== baseSha ||
      git(root, "rev-parse", "origin/main") !== baseSha ||
      git(root, "rev-parse", "HEAD") !== candidateSha ||
      marker.recordDigest !== CROSSDECK.recordDigest ||
      marker.sourceDigest !== productSourceDigest(sourceSnapshot(root, candidateSha))
    )
      fail("BINDING_CHANGED");
    if (stage === "original") {
      if (
        candidateSha !== FOCUSED.original.candidateSha ||
        marker.candidateTree !== FOCUSED.original.candidateTree ||
        marker.sourceDigest !== FOCUSED.original.sourceDigest
      )
        fail("ORIGINAL_SOURCE_CHANGED");
    } else {
      const plan = planProductExperience({
        root,
        baseSha,
        candidateSha,
        changedPaths: git(root, "diff", "--name-only", "--no-renames", baseSha, candidateSha).split(/\r?\n/u),
        prNumber: 721,
      });
      if (plan.exception?.id !== CROSSDECK.id || plan.sourceDigest !== marker.sourceDigest)
        fail("CORRECTED_SOURCE_CHANGED");
    }
    if (
      FOCUSED.directory !== TECHNICAL.publicationDirectory ||
      FOCUSED.spec !== TECHNICAL.spec ||
      FOCUSED.title !== TECHNICAL.title
    )
      fail("BINDING_CHANGED");
    assertR12TechnicalSource(root, marker);
  }
  async function requireDependencyReadinessSuite({
    root,
    candidateSha,
    options,
    browserTests,
    argv,
    environment = process.env,
  }) {
    if (version !== 13) fail("READINESS_NOT_GRANTED");
    const stage = options["r13-dependency-readiness"],
      baseSha = options["r13-base"];
    const attempt = Number(options["r13-attempt"]);
    if (!stages.has(stage) || !Number.isInteger(attempt) || browserTests.length) fail("READINESS_INVOCATION_CHANGED");
    const ctx = loadReadinessAttempt({ root, stage, attempt, environment });
    if (
      JSON.stringify(argv) !==
      JSON.stringify(
        readinessSuiteArguments({ root, baseSha, candidateSha, stage, databaseUrl: ctx.paths.databaseUrl, attempt }),
      )
    )
      fail("READINESS_INVOCATION_CHANGED");
    await validateLocalBinding({
      root,
      baseSha,
      candidateSha,
      stage,
      marker: { ...ctx.binding, sourceManifestSha256: ctx.binding.sourceManifestSha256 },
    });
    return ctx;
  }
  function inspectR12TechnicalReport(report) {
    const specs = [];
    const walk = (suite) => {
      specs.push(...(suite.specs ?? []));
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of report?.suites ?? []) walk(suite);
    const tests = specs.flatMap((spec) => (spec.tests ?? []).map((entry) => ({ spec, entry })));
    if (tests.length !== 1 || report.errors?.length) fail("REPORT_CASE_COUNT_CHANGED");
    const { spec, entry } = tests[0];
    const result = entry.results?.[0];
    const project = report.config?.projects?.find((value) => value.name === "chromium");
    if (
      spec.title !== TECHNICAL.title ||
      typeof spec.file !== "string" ||
      !path
        .resolve(report.config?.rootDir ?? ".", spec.file)
        .replaceAll("\\", "/")
        .endsWith(`/${TECHNICAL.spec}`) ||
      entry.projectName !== "chromium" ||
      entry.results?.length !== 1 ||
      result?.retry !== 0 ||
      (entry.repeatEachIndex ?? 0) !== 0 ||
      report.config?.workers !== 1 ||
      project?.retries !== 0 ||
      project?.repeatEach !== 1 ||
      entry.expectedStatus !== "passed" ||
      result?.attachments?.some(
        (entry) =>
          /(?:image|video)\//u.test(entry.contentType ?? "") || /(?:\.webm|trace\.zip|\.png)$/u.test(entry.path ?? ""),
      ) ||
      !["passed", "failed", "timedOut", "interrupted"].includes(result?.status)
    )
      fail("REPORT_SCOPE_CHANGED");
    return {
      caseExecutions: 1,
      status: result.status === "passed" && entry.status === "expected" ? "PASS" : "FAIL",
      resultStatus: result.status,
    };
  }
  function assertReadinessFocusedBinding({ readiness, receipt, marker }) {
    if (version !== 13) fail("READINESS_NOT_GRANTED");
    for (const key of ["baseSha", "candidateSha", "candidateTree", "sourceDigest", "contractDigest", "recordDigest"])
      if (readiness?.binding?.[key] !== receipt[key]) fail("PUBLISHED_READINESS_SOURCE_CHANGED");
    if (
      readiness?.binding?.stage !== receipt.stage ||
      readiness.binding.sourceManifestSha256 !== marker.sourceManifestSha256 ||
      marker.readinessReceiptSha256 !== readiness.receiptSha256 ||
      marker.readinessAttempt !== readiness.attempt ||
      marker.proofRoot !== readiness.proofRoot ||
      marker.databaseUrl !== readiness.databaseUrl
    )
      fail("PUBLISHED_READINESS_BINDING_CHANGED");
  }
  function validateR12FocusedReceipt({ root, revision, record, stage, receipt }) {
    const directory = path.posix.join(TECHNICAL.publicationDirectory, stage);
    const read = (file) => {
      if (revision) {
        if (!/^100644 blob [a-f0-9]{40}\t/u.test(git(root, "ls-tree", revision, "--", file)))
          fail("PUBLISHED_OUTPUT_NOT_REGULAR_FILE");
        return execFileSync("git", ["show", `${revision}:${file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
      }
      if (!lstatSync(path.join(root, file)).isFile()) fail("PUBLISHED_OUTPUT_NOT_REGULAR_FILE");
      return readFileSync(path.join(root, file));
    };
    const evidence = (entry, expected) => {
      if (!entry || entry.path !== path.posix.join(directory, expected) || !/^[a-f0-9]{64}$/u.test(entry.sha256 ?? ""))
        fail("PUBLISHED_OUTPUT_PATH_CHANGED");
      const bytes = read(entry.path);
      if (hash(bytes) !== entry.sha256) fail("PUBLISHED_OUTPUT_HASH_CHANGED");
      return JSON.parse(bytes);
    };
    if (
      !stages.has(stage) ||
      receipt?.version !== 1 ||
      receipt.classification !== TECHNICAL.classification ||
      receipt.exceptionId !== record.id ||
      receipt.stage !== stage ||
      !["PASS", "FAIL"].includes(receipt.status) ||
      receipt.spec !== TECHNICAL.spec ||
      receipt.title !== TECHNICAL.title ||
      receipt.invocations !== 1 ||
      receipt.caseExecutions !== 1 ||
      receipt.retries !== 0 ||
      receipt.repeatEachIndex !== 0 ||
      receipt.additionalRepeats !== 0 ||
      receipt.productCaptures !== 0 ||
      receipt.productReviews !== 0 ||
      receipt.providerCalls !== 0 ||
      receipt.execution?.cancelled !== false ||
      receipt.execution?.cleanup?.status !== "PASS" ||
      (stage === "corrected" && receipt.status !== "PASS")
    )
      fail("PUBLISHED_RECEIPT_SCOPE_CHANGED");
    const manifest = evidence(receipt.files?.sourceManifest, "source-manifest.json");
    const marker = evidence(receipt.files?.marker, "marker.json");
    const launch = evidence(receipt.files?.launchMarker, "launch-marker.json");
    for (const key of ["baseSha", "candidateSha", "candidateTree", "sourceDigest", "contractDigest", "recordDigest"])
      if (manifest[key] !== receipt[key]) fail("PUBLISHED_MANIFEST_BINDING_CHANGED");
    if (
      marker.status !== receipt.status ||
      marker.stage !== stage ||
      marker.classification !== receipt.classification ||
      marker.candidateSha !== receipt.candidateSha ||
      marker.sourceDigest !== receipt.sourceDigest ||
      marker.recordDigest !== receipt.recordDigest ||
      marker.sourceManifestSha256 !== hash(JSON.stringify(manifest.files)) ||
      launch.lease !== marker.lease ||
      launch.stage !== stage ||
      launch.candidateSha !== receipt.candidateSha ||
      launch.baseSha !== receipt.baseSha ||
      launch.sourceDigest !== receipt.sourceDigest ||
      git(root, "rev-parse", `${receipt.candidateSha}^{tree}`) !== receipt.candidateTree
    )
      fail("PUBLISHED_MARKER_BINDING_CHANGED");
    if (JSON.stringify(manifest.files) !== JSON.stringify(committedSourceManifest(root, receipt.candidateSha)))
      fail("PUBLISHED_SOURCE_MANIFEST_CHANGED");
    const inspection = inspectR12TechnicalReport(evidence(receipt.files.report, "browser-report.json"));
    const runtime = evidence(receipt.files.runtimeReceipt, "browser-runtime.json");
    const profile = evidence(receipt.files.profileReceipt, "browser-suite-profile.json");
    const lab = evidence(receipt.files.deviceLabReceipt, "device-lab.json");
    const admissionManifest = { ...manifest };
    delete admissionManifest.version;
    delete admissionManifest.files;
    const diagnosticBinding = runtime.diagnosticBinding;
    if (
      inspection.status !== receipt.status ||
      profile.status !== receipt.status ||
      profile.profile !== "generic" ||
      JSON.stringify(profile.browserTests) !== JSON.stringify(r12TechnicalBrowserArguments()) ||
      runtime.lifecycle?.cleanup?.status !== "PASS" ||
      runtime.lifecycle?.cleanup?.portsReleased !== true ||
      diagnosticBinding?.baseSha !== receipt.baseSha ||
      diagnosticBinding?.candidateSha !== receipt.candidateSha ||
      diagnosticBinding?.planDigest !== hash(JSON.stringify(admissionManifest)) ||
      JSON.stringify(diagnosticBinding) !== JSON.stringify(profile.diagnosticBinding) ||
      lab.cleanupReceipt?.result !== "PASS" ||
      !Array.isArray(lab.cleanupReceipt?.remainingResources) ||
      lab.cleanupReceipt.remainingResources.length !== 0 ||
      lab.scenarioId !== TECHNICAL.title ||
      lab.source?.sourceSha !== receipt.candidateSha ||
      lab.source?.sourceTree !== receipt.candidateTree ||
      lab.source?.dirty !== false ||
      lab.tier !== "D1" ||
      lab.profile !== "chromium-mobile" ||
      (receipt.status === "FAIL" &&
        (runtime.failureCategory !== "PRODUCT_FAILURE" ||
          lab.passFailDisposition !== "FAIL" ||
          receipt.execution.exitCode === 0)) ||
      (receipt.status === "PASS" &&
        (runtime.failureCategory ||
          receipt.execution.exitCode !== 0 ||
          lab.passFailDisposition !== "PASS" ||
          JSON.stringify(lab.assertions?.map(({ id, state }) => ({ id, state }))) !==
            JSON.stringify([
              { id: "crossdeck.phase2.continuity", state: "PASS" },
              { id: "keyboard-reduced-motion-privacy", state: "PASS" },
            ])))
    )
      fail("PUBLISHED_EXECUTION_OUTCOME_CHANGED");
    if (
      receipt.media?.length !== (lab.artifacts?.length ?? 0) ||
      receipt.media.length > 1 ||
      (receipt.status === "PASS" && receipt.media.length !== 1)
    )
      fail("PUBLISHED_MEDIA_SCOPE_CHANGED");
    for (const [index, media] of receipt.media.entries()) {
      if (
        media.kind !== "SCREENSHOT" ||
        media.path !== path.posix.join(directory, "screenshot.png") ||
        media.sha256 !== lab.artifacts[index].sha256 ||
        lab.artifacts[index].kind !== "SCREENSHOT" ||
        hash(read(media.path)) !== media.sha256
      )
        fail("PUBLISHED_MEDIA_CHANGED");
    }
    if (
      receipt.outcome !==
      (stage === "original"
        ? receipt.status === "PASS"
          ? "NOT_REPRODUCED"
          : "ORIGINAL_CASE_FAILED"
        : "CORRECTION_PASS")
    )
      fail("PUBLISHED_OUTCOME_CHANGED");
    if (version === 13) {
      validateReadinessReceipt({ root, revision, record, stage, receipt: receipt.readiness });
      assertReadinessFocusedBinding({ readiness: receipt.readiness, receipt, marker });
    }
    const receiptEntry = {
      path: path.posix.join(directory, "receipt.json"),
      sha256: hash(read(path.posix.join(directory, "receipt.json"))),
    };
    const index = JSON.parse(read(path.posix.join(directory, "preservation-index.json")));
    const expectedIndex = [
      ...Object.values(receipt.files).filter(Boolean),
      ...receipt.media.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
      ...(receipt.readiness?.files ?? []),
      receiptEntry,
    ].sort((a, b) => a.path.localeCompare(b.path));
    if (index.version !== 1 || index.stage !== stage || JSON.stringify(index.files) !== JSON.stringify(expectedIndex))
      fail("PUBLISHED_PRESERVATION_INDEX_CHANGED");
    return receipt;
  }
  function publicationFile(root, directory, name, bytes) {
    const relative = path.posix.join(directory, name);
    const destination = path.join(root, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes, { flag: "wx" });
    return { path: relative, sha256: hash(bytes) };
  }
  function publishExisting(root, directory, name, source) {
    if (!source || !existsSync(source)) return null;
    if (!lstatSync(source).isFile()) fail("OUTPUT_NOT_REGULAR_FILE");
    return publicationFile(root, directory, name, readFileSync(source));
  }
  async function executeSuite({ root, argumentsList, environment, outputs, timeoutMs }) {
    let child;
    let cancelled = false;
    let timer;
    const streams = outputs
      ? [createWriteStream(outputs.stdout, { flags: "wx" }), createWriteStream(outputs.stderr, { flags: "wx" })]
      : [];
    const streamErrors = [];
    const streamCompletions = streams.map((stream) =>
      finished(stream).catch((error) => {
        streamErrors.push(error);
      }),
    );
    const cancel = () => {
      cancelled = true;
      if (child) void stopOwnedProcess(child);
    };
    process.on("SIGTERM", cancel);
    process.on("SIGINT", cancel);
    try {
      child = spawnOwnedProcess(process.execPath, argumentsList, { root, env: environment });
      if (streams.length) {
        child.stdout.pipe(streams[0]);
        child.stderr.pipe(streams[1]);
      }
      if (timeoutMs) timer = setTimeout(cancel, timeoutMs);
      const exit = await processExit(child);
      const cleanup = await stopOwnedProcess(child);
      return { exitCode: exit.code, cancelled, cleanup };
    } finally {
      clearTimeout(timer);
      process.off("SIGTERM", cancel);
      process.off("SIGINT", cancel);
      if (child) await stopOwnedProcess(child);
      for (const stream of streams) if (!stream.writableEnded && !stream.destroyed) stream.end();
      await Promise.all(streamCompletions);
      if (streamErrors.length) throw streamErrors[0];
    }
  }

  async function runR12TechnicalProof({
    root,
    baseSha,
    candidateSha,
    stage,
    environment = process.env,
    request,
    admission = admit,
    execute = executeSuite,
  }) {
    root = path.resolve(root);
    const { record, manifest } = await admission({ root, baseSha, candidateSha, stage, environment, request });
    if (!stages.has(stage)) fail("STAGE_INVALID");
    const sourceManifest = r12TechnicalSourceManifest(root);
    const readiness =
      version === 13
        ? requireLatestReadinessPASS({
            root,
            baseSha,
            candidateSha,
            stage,
            record,
            manifest: { ...manifest, sourceManifestSha256: hash(JSON.stringify(sourceManifest)) },
            environment: r12TechnicalEnvironment(environment),
          })
        : null;
    const markerPath = r12TechnicalMarkerPath(root, stage);
    const launchPath = r12TechnicalMarkerPath(root, stage, true);
    if (stage === "corrected") {
      const originalPath = r12TechnicalMarkerPath(root, "original");
      if (!existsSync(originalPath)) fail("ORIGINAL_CASE_REQUIRED_FIRST");
      const original = json(originalPath);
      if (
        !["PASS", "FAIL"].includes(original.status) ||
        original.caseExecutions !== 1 ||
        original.baseSha !== baseSha ||
        original.recordDigest !== manifest.recordDigest ||
        typeof original.proofRoot !== "string"
      )
        fail("ORIGINAL_CASE_REQUIRED_FIRST");
      const originalReceipt = json(
        path.join(original.proofRoot, TECHNICAL.publicationDirectory, "original/receipt.json"),
      );
      validateR12FocusedReceipt({ root: original.proofRoot, record, stage: "original", receipt: originalReceipt });
    }
    const directory = path.posix.join(TECHNICAL.publicationDirectory, stage);
    const reportPath = path.join(root, "artifacts", "sounding-line", `${prefix}-focused-${stage}-browser-report.json`);
    const deviceLabPath = path.join(root, "artifacts/crossdeck-phase2/crossdeck.surface-handoff-D1.json");
    if (
      existsSync(path.join(root, directory)) ||
      existsSync(launchPath) ||
      existsSync(reportPath) ||
      existsSync(deviceLabPath) ||
      existsSync(path.join(root, "test-results"))
    )
      fail("PROOF_ALREADY_CONSUMED");
    const timestamp = new Date().toISOString();
    const nonce = randomUUID().replaceAll("-", "");
    const generatedDatabaseUrl = `file:${path.join(root, "artifacts", "sounding-line", `generic-${candidateSha.slice(0, 12)}`, `validation-isolated-${timestamp.slice(0, 10).replaceAll("-", "")}-${timestamp.slice(11, 23).replaceAll(/[:.]/gu, "")}-${nonce}.db`).replaceAll("\\", "/")}`;
    const databaseUrl = readiness?.paths.databaseUrl ?? generatedDatabaseUrl;
    const marker = {
      version: 1,
      classification: TECHNICAL.classification,
      status: "STARTED",
      stage,
      ownerPid: process.pid,
      lease: randomUUID(),
      baseSha,
      candidateSha,
      candidateTree: manifest.candidateTree,
      sourceDigest: manifest.sourceDigest,
      recordDigest: manifest.recordDigest,
      contractDigest: manifest.contractDigest,
      sourceManifestSha256: hash(JSON.stringify(sourceManifest)),
      startedAt: timestamp,
      databaseUrl,
      proofRoot: root,
      ...(readiness
        ? { readinessAttempt: readiness.attempt, readinessReceiptSha256: hash(readFileSync(readiness.paths.receipt)) }
        : {}),
    };
    mkdirSync(path.dirname(markerPath), { recursive: true });
    // The create-only common-Git marker is consumed before any setup or browser.
    persist(markerPath, marker, { flag: "wx" });
    mkdirSync(path.join(root, directory), { recursive: true });
    const receiptPath = path.join(root, "artifacts", "sounding-line", `${prefix}-focused-${stage}-receipt.json`);
    mkdirSync(path.dirname(receiptPath), { recursive: true });
    const receipt = {
      version: 1,
      classification: marker.classification,
      exceptionId: record.id,
      stage,
      status: "UNKNOWN",
      baseSha,
      candidateSha,
      candidateTree: manifest.candidateTree,
      sourceDigest: manifest.sourceDigest,
      contractDigest: manifest.contractDigest,
      recordDigest: manifest.recordDigest,
      spec: TECHNICAL.spec,
      title: TECHNICAL.title,
      invocations: 1,
      caseExecutions: 0,
      retries: 0,
      repeatEachIndex: 0,
      additionalRepeats: 0,
      productCaptures: 0,
      productReviews: 0,
      providerCalls: 0,
      files: {},
      media: [],
      outcome: "EXECUTION_UNKNOWN",
      startedAt: timestamp,
      limitation:
        "Operator common-Git accounting is not authenticated global execution custody. Preserve both stage markers and all partial output. No reset, retry or raw-launch bypass.",
    };
    persist(receiptPath, receipt);
    const diagnostics = createBrowserDiagnosticSession(root, {
      baseSha,
      candidateSha,
      planDigest: hash(JSON.stringify(manifest)),
    });
    const diagnosticEnvironment = diagnostics.beginScope();
    let execution;
    try {
      execution = await execute({
        root,
        argumentsList: [
          path.join(installed, "scripts/sounding-line/run-browser-suite.mjs"),
          ...r12TechnicalSuiteArguments({ root, baseSha, candidateSha, stage, databaseUrl }),
        ],
        environment: {
          ...r12TechnicalEnvironment(environment),
          ...diagnosticEnvironment,
          [`SOUNDING_LINE_R${version}_TECHNICAL_LEASE`]: marker.lease,
          PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
          ...(readiness ? { SOUNDING_LINE_R13_READINESS_ATTEMPT: String(readiness.attempt) } : {}),
        },
      });
      receipt.execution = execution;
      sameSource(root, marker);
      if (existsSync(reportPath)) {
        const inspection = inspectR12TechnicalReport(json(reportPath));
        receipt.caseExecutions = inspection.caseExecutions;
        receipt.status = inspection.status;
        receipt.resultStatus = inspection.resultStatus;
      } else receipt.status = execution.cancelled || execution.exitCode === null ? "UNKNOWN" : "FAIL";
      const observed = await diagnostics.read();
      if (
        execution.cancelled ||
        receipt.resultStatus === "interrupted" ||
        execution.cleanup?.status !== "PASS" ||
        (receipt.caseExecutions === 1 &&
          (observed.runtime?.lifecycle?.cleanup?.status !== "PASS" ||
            observed.profile?.status !== receipt.status ||
            (receipt.status === "PASS"
              ? execution.exitCode !== 0 || observed.runtime?.failureCategory
              : observed.runtime?.failureCategory !== "PRODUCT_FAILURE")))
      )
        receipt.status = "UNKNOWN";
      receipt.outcome =
        receipt.status === "UNKNOWN" || receipt.caseExecutions !== 1
          ? "EXECUTION_UNKNOWN"
          : stage === "original"
            ? receipt.status === "PASS"
              ? "NOT_REPRODUCED"
              : "ORIGINAL_CASE_FAILED"
            : receipt.status === "PASS"
              ? "CORRECTION_PASS"
              : "CORRECTION_FAILED";
    } catch (error) {
      receipt.status = execution?.cancelled ? "UNKNOWN" : "FAIL";
      receipt.failure = "FOCUSED_TECHNICAL_FAILED_RETAIN_PARTIAL_OUTPUT_AND_CONSUMED_MARKER";
      throw error;
    } finally {
      receipt.completedAt = new Date().toISOString();
      if (readiness) receipt.readiness = publishReadinessEvidence({ attempt: readiness, publicationRoot: directory });
      const observed = await diagnostics.read();
      receipt.files.sourceManifest = publicationFile(
        root,
        directory,
        "source-manifest.json",
        JSON.stringify({ version: 1, ...manifest, files: sourceManifest }, null, 2) + "\n",
      );
      receipt.files.report = publishExisting(root, directory, "browser-report.json", reportPath);
      for (const [key, name] of [
        ["runtimeReceipt", "browser-runtime.json"],
        ["profileReceipt", "browser-suite-profile.json"],
      ]) {
        const value = key === "runtimeReceipt" ? observed.runtime : observed.profile;
        receipt.files[key] = value
          ? publicationFile(root, directory, name, JSON.stringify(value, null, 2) + "\n")
          : null;
      }
      receipt.files.deviceLabReceipt = publishExisting(root, directory, "device-lab.json", deviceLabPath);
      if (receipt.files.deviceLabReceipt) {
        for (const artifact of json(deviceLabPath).artifacts ?? []) {
          if (
            artifact.kind !== "SCREENSHOT" ||
            !artifact.path ||
            hash(readFileSync(path.resolve(root, artifact.path))) !== artifact.sha256
          )
            fail("MANDATORY_TECHNICAL_MEDIA_CHANGED");
          const media = publishExisting(root, directory, "screenshot.png", path.resolve(root, artifact.path));
          receipt.media.push({ ...media, kind: "SCREENSHOT" });
        }
      }
      persist(markerPath, {
        ...marker,
        status: receipt.status,
        caseExecutions: receipt.caseExecutions,
        outcome: receipt.outcome,
        completedAt: receipt.completedAt,
      });
      receipt.files.marker = publishExisting(root, directory, "marker.json", markerPath);
      receipt.files.launchMarker = publishExisting(root, directory, "launch-marker.json", launchPath);
      persist(receiptPath, receipt);
      const receiptEntry = publicationFile(root, directory, "receipt.json", JSON.stringify(receipt, null, 2) + "\n");
      publicationFile(
        root,
        directory,
        "preservation-index.json",
        JSON.stringify(
          {
            version: 1,
            stage,
            files: [
              ...Object.values(receipt.files).filter(Boolean),
              ...receipt.media.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
              ...(receipt.readiness?.files ?? []),
              receiptEntry,
            ].sort((a, b) => a.path.localeCompare(b.path)),
          },
          null,
          2,
        ) + "\n",
      );
    }
    return receipt;
  }

  function r12TechnicalExitCode(receipt) {
    return receipt.status === "PASS" ||
      (receipt.stage === "original" &&
        receipt.status === "FAIL" &&
        receipt.caseExecutions === 1 &&
        receipt.outcome === "ORIGINAL_CASE_FAILED")
      ? 0
      : 1;
  }

  async function preflight({
    root,
    baseSha,
    candidateSha,
    stage,
    environment = process.env,
    request,
    admission = admit,
    execute = executeSuite,
  }) {
    if (version !== 13) fail("READINESS_NOT_GRANTED");
    root = path.resolve(root);
    const { record, manifest } = await admission({ root, baseSha, candidateSha, stage, environment, request });
    const sourceManifest = r12TechnicalSourceManifest(root);
    const ctx = beginReadinessAttempt({
      root,
      baseSha,
      candidateSha,
      stage,
      record,
      manifest: { ...manifest, sourceManifestSha256: hash(JSON.stringify(sourceManifest)) },
      environment: r12TechnicalEnvironment(environment),
    });
    let execution, error;
    try {
      execution = await execute({
        root,
        argumentsList: [
          path.join(installed, "scripts/sounding-line/run-browser-suite.mjs"),
          ...readinessSuiteArguments({
            root,
            baseSha,
            candidateSha,
            stage,
            databaseUrl: ctx.paths.databaseUrl,
            attempt: ctx.attempt,
          }),
        ],
        environment: {
          ...r12TechnicalEnvironment(environment),
          SOUNDING_LINE_READINESS_LEASE: ctx.binding.lease,
          SOUNDING_LINE_READINESS_MARKER: ctx.paths.marker,
        },
        outputs: { stdout: ctx.paths.stdout, stderr: ctx.paths.stderr },
        timeoutMs: 1800000,
      });
      sameSource(root, { sourceManifestSha256: hash(JSON.stringify(sourceManifest)) });
    } catch (cause) {
      error = cause;
    }
    return completeReadinessAttempt({
      attempt: ctx,
      status:
        execution?.exitCode === 0 && !execution.cancelled && execution.cleanup?.status === "PASS" && !error
          ? "PASS"
          : "UNKNOWN",
      error,
      execution,
      cleanup: execution?.cleanup,
    });
  }
  async function caseProfileContext({ root, marker, environment = process.env }) {
    if (version !== 13) fail("READINESS_NOT_GRANTED");
    const ctx = requireLatestReadinessPASS({
      root,
      baseSha: marker.baseSha,
      candidateSha: marker.candidateSha,
      stage: marker.stage,
      manifest: marker,
      environment: r12TechnicalEnvironment(environment),
    });
    return readReadinessProfileContext({ attempt: ctx, environment, phase: "case" });
  }
  return {
    TECHNICAL,
    r12TechnicalMarkerPath,
    r12TechnicalBrowserArguments,
    r12TechnicalSuiteArguments,
    r12TechnicalSourceManifest,
    assertR12TechnicalSource,
    r12TechnicalEnvironment,
    requireR12TechnicalSuite,
    inspectR12TechnicalReport,
    validateR12FocusedReceipt,
    runR12TechnicalProof,
    r12TechnicalExitCode,
    admit,
    preflight,
    requireDependencyReadinessSuite,
    caseProfileContext,
    assertReadinessFocusedBinding,
  };
}
