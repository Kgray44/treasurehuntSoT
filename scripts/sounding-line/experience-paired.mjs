// Paired witnesses augment the canonical capture manifest; they issue no acceptance decision.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EXPERIENCE_RAW_OUTPUT,
  createRawOutputDirectory,
  copyDeclaredCaptureFile,
  rawCaptureBinding,
} from "./experience-raw-output.mjs";

export const PAIRED_CONTRACTS = ["crossdeck.phase2.continuity", "crossdeck.refit.companion"];
export const PAIRED_CASES = [
  {
    id: "crossdeck-pair-normal",
    spec: "tests/e2e/crossdeck-experience-refit.spec.ts",
    title: "complete multi-device experience · no-preference",
    directory: "refit-no-preference",
    motionMode: "NORMAL",
    outcomes: ["JOIN_AUTHORIZED", "DELIVERY_ACKNOWLEDGED", "RECOVERY", "CONTINUATION_ACTIVATED"],
  },
  {
    id: "crossdeck-pair-reduced",
    spec: "tests/e2e/crossdeck-experience-refit.spec.ts",
    title: "complete multi-device experience · reduce",
    directory: "refit-reduce",
    motionMode: "REDUCED",
    outcomes: ["JOIN_AUTHORIZED", "DELIVERY_ACKNOWLEDGED", "RECOVERY", "CONTINUATION_ACTIVATED"],
  },
  {
    id: "crossdeck-pair-adverse",
    spec: "tests/e2e/crossdeck-refit-recovery.spec.ts",
    title: "recover pairing and transfers while preserving shared-screen privacy",
    directory: "refit-recovery",
    motionMode: "NORMAL",
    outcomes: [
      "JOIN_AUTHORIZED",
      "PAIRING_EXPIRED_REFUSED",
      "PRIVATE_SEND_CONFIRMED_CANCELLED_DECLINED",
      "CREW_PRIVATE_SEPARATION",
      "REVOKED_PRIVATE_VIEW_CLEARED",
      "DELIVERY_ACKNOWLEDGED",
    ],
  },
];
const devices = ["DESKTOP", "MOBILE"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (value) => hash(JSON.stringify(value));
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_PAIRED_${code}`);
};
const same = (a, b) => digest(a) === digest(b);
const relative = (root, file) => path.relative(root, file).replaceAll("\\", "/");

export function planPairedEvidence(contracts) {
  const selected = contracts.filter((c) => c.experience.pairedEvidence);
  if (!selected.length) return null;
  const ids = selected.map((c) => c.id).sort();
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !PAIRED_CONTRACTS.includes(id)) ||
    selected.some((c) => !same(c.experience.pairedEvidence, { version: 1, caseIds: PAIRED_CASES.map((p) => p.id) }))
  )
    fail("CONTRACT_SCOPE_CHANGED");
  return { version: 1, contractIds: ids, cases: PAIRED_CASES, browserContexts: PAIRED_CASES.length * devices.length };
}

export function pairedBinding({ root, plan, databaseUrl }) {
  const tree = execFileSync("git", ["rev-parse", `${plan.candidateSha}^{tree}`], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return {
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    candidateTree: tree,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    recordDigest: plan.exception?.recordDigest ?? null,
    databaseSha256: hash(databaseUrl),
  };
}

export function validatePairedReport(report) {
  const found = [];
  const visit = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) found.push(spec);
      visit(suite.suites);
    }
  };
  visit(report?.suites);
  if (
    report?.errors?.length ||
    report?.stats?.unexpected !== 0 ||
    report.stats.flaky !== 0 ||
    report.stats.skipped !== 0 ||
    report.stats.expected !== 3 ||
    found.length !== 3
  )
    fail("THREE_SUCCESSFUL_CASES_REQUIRED");
  for (const expected of PAIRED_CASES) {
    const observed = found.filter(
      (s) =>
        s.title === expected.title && s.file?.replaceAll("\\", "/").endsWith(expected.spec.slice("tests/e2e/".length)),
    );
    const tests = observed[0]?.tests;
    if (
      observed.length !== 1 ||
      tests?.length !== 1 ||
      tests[0].expectedStatus !== "passed" ||
      tests[0].results?.length !== 1 ||
      tests[0].results[0].status !== "passed" ||
      tests[0].results[0].retry !== 0 ||
      tests[0].projectName !== "chromium"
    )
      fail("CASE_FAILED_RETRIED_OR_MISSING");
  }
}

export function validatePairedWitness(witness, expected, binding) {
  if (
    witness?.version !== 1 ||
    witness.status !== "PASS" ||
    witness.caseId !== expected.id ||
    !same(witness.binding, binding) ||
    witness.fixture?.databaseSha256 !== binding.databaseSha256 ||
    expected.outcomes.some((o) => witness.outcomes?.[o] !== true)
  )
    fail("WITNESS_BINDING_OR_OUTCOME_MISSING");
  const contexts = devices.map((d) => witness.contexts?.[d]);
  if (
    contexts.some(
      (c) => !c?.surfaceId || c.voyageId !== witness.fixture.voyageId || c.editionId !== witness.fixture.editionId,
    ) ||
    !witness.fixture.voyageId ||
    !witness.fixture.editionId ||
    contexts[0].surfaceId === contexts[1].surfaceId
  )
    fail("DISTINCT_AUTHORIZED_CONTEXTS_REQUIRED");
  if (
    ["tracesStopped", "contextsClosed", "videosFlushed", "fixtureRemoved"].some(
      (key) => witness.cleanup?.[key] !== true,
    )
  )
    fail("CASE_CLEANUP_REQUIRED");
  for (const device of devices) {
    if (
      !same(
        witness.contexts[device].viewport,
        device === "DESKTOP" ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
      ) ||
      witness.contexts[device].reducedMotion !== (expected.motionMode === "REDUCED")
    )
      fail("VIEWPORT_OR_MOTION_CHANGED");
    const media = witness.media?.[device];
    if (!Array.isArray(media?.screenshots) || !media.screenshots.length || !media.recording || !media.trace)
      fail("EACH_CONTEXT_MEDIA_REQUIRED");
    if (!same(Object.keys(media.screenshotViewports ?? {}).sort(), [...media.screenshots].sort()))
      fail("SCREENSHOT_VIEWPORT_CHANGED");
  }
  const rawMedia = devices.flatMap((d) => [
    ...witness.media[d].screenshots,
    witness.media[d].recording,
    witness.media[d].trace,
  ]);
  if (new Set(rawMedia).size !== rawMedia.length) fail("DISTINCT_CONTEXT_MEDIA_REQUIRED");
}

async function ownedFile(directory, file) {
  if (
    typeof file !== "string" ||
    !file ||
    file.includes("\\") ||
    file.split("/").some((p) => !p || p === "." || p === "..") ||
    path.posix.isAbsolute(file)
  )
    fail("MEDIA_PATH_INVALID");
  const requested = path.resolve(directory, file),
    owned = await realpath(directory),
    resolved = await realpath(requested);
  if (
    !resolved.startsWith(owned + path.sep) ||
    !(await lstat(requested)).isFile() ||
    (await lstat(requested)).isSymbolicLink()
  )
    fail("MEDIA_PATH_INVALID");
  return { path: requested, bytes: await readFile(requested) };
}

export async function producePairedEvidence({
  root,
  plan,
  baseURL,
  outputDirectory,
  environment = process.env,
  run = spawnSync,
  rawOutputDirectory = environment[EXPERIENCE_RAW_OUTPUT],
}) {
  const paired = planPairedEvidence(plan.contracts);
  if (!paired) return null;
  if (!environment.DATABASE_URL || !/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/u.test(baseURL ?? ""))
    fail("OWNED_SOURCE_RUNTIME_REQUIRED");
  const output = path.resolve(root, outputDirectory, "paired");
  if (!output.startsWith(path.resolve(root) + path.sep)) fail("MEDIA_PATH_INVALID");
  await mkdir(output); // A previous/partial run must never be silently reused.
  const producerOutput = rawOutputDirectory
    ? await createRawOutputDirectory({ root, directory: `${rawOutputDirectory}/paired` })
    : output;
  const binding = pairedBinding({ root, plan, databaseUrl: environment.DATABASE_URL });
  const reportFile = path.join(producerOutput, "playwright-report.json");
  const env = {
    ...environment,
    FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
    PLAYWRIGHT_BASE_URL: baseURL,
    CROSSDECK_REFIT_ARTIFACT_ROOT: producerOutput,
    SOUNDING_LINE_PAIRED_BINDING: JSON.stringify(binding),
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  const result = run(
    process.execPath,
    [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      ...new Set(PAIRED_CASES.map((c) => c.spec)),
      "--project=chromium",
      "--workers=1",
      "--retries=0",
      "--repeat-each=1",
      "--reporter=json",
      "--forbid-only",
    ],
    { cwd: root, env, stdio: "inherit", windowsHide: true, timeout: 600000 },
  );
  if (result.error || result.status !== 0) fail("EXECUTION_FAILED");
  const reportBytes = await readFile(reportFile);
  validatePairedReport(JSON.parse(reportBytes));
  const selectedFile = async (source, kind) => {
    if (producerOutput === output) return source;
    const selected = await copyDeclaredCaptureFile({
      root,
      rawDirectory: producerOutput,
      source,
      destination: path.join(output, path.relative(producerOutput, source)),
      kind,
      binding: rawCaptureBinding(plan),
    });
    return path.join(root, selected.path);
  };
  const selectedReport = await selectedFile(reportFile, "json");
  const artifacts = [],
    cases = [];
  for (const expected of PAIRED_CASES) {
    const directory = path.join(producerOutput, expected.directory);
    const witnessFile = await ownedFile(directory, "paired-witness.json");
    const witness = JSON.parse(witnessFile.bytes);
    validatePairedWitness(witness, expected, binding);
    const selectedWitness = await selectedFile(witnessFile.path, "json");
    // Observations remain exact producer bytes, including their original raw paths.
    if (producerOutput !== output) {
      const observations = await ownedFile(directory, "observations.json");
      await selectedFile(observations.path, "json");
    }
    const ids = [];
    for (const device of devices) {
      const media = witness.media[device];
      for (const [type, files, suffix] of [
        ["screenshot", media.screenshots, ".png"],
        ["recording", [media.recording], ".webm"],
        ["trace", [media.trace], ".zip"],
      ]) {
        for (const file of files) {
          if (!file.endsWith(suffix)) fail("MEDIA_TYPE_INVALID");
          const observed = await ownedFile(directory, file);
          const selected = await selectedFile(observed.path, type);
          for (const contractId of paired.contractIds) {
            const id = `${contractId}-${expected.id}-${device}-${type}-${path.basename(file)}`;
            if (ids.includes(id)) fail("MEDIA_ID_DUPLICATED");
            ids.push(id);
            artifacts.push({
              id,
              path: relative(root, selected),
              sha256: hash(observed.bytes),
              type,
              contractId,
              device,
              role: "PLAYER",
              motionMode: expected.motionMode,
              state: `PAIRED_${expected.id}`,
              origin: "ACTUAL_APPLICATION",
              ...(type === "screenshot" && observed.bytes.length >= 24
                ? { viewport: { width: observed.bytes.readUInt32BE(16), height: observed.bytes.readUInt32BE(20) } }
                : {}),
            });
          }
        }
      }
    }
    cases.push({
      ...witness,
      witness: { path: relative(root, selectedWitness), sha256: hash(witnessFile.bytes) },
      artifactIds: ids,
    });
  }
  return {
    artifacts,
    pairedEvidence: {
      version: 1,
      binding,
      browserContexts: paired.browserContexts,
      report: { path: relative(root, selectedReport), sha256: hash(reportBytes) },
      cases,
    },
  };
}

export function pairedPublicationPathAllowed(file) {
  return (
    /^(?:Development_Docs|docs)\/.*\.md$/u.test(file) ||
    [
      "Development_Docs/Features/catalog/crossdeck.json",
      "CHANGELOG.md",
      ".agents/crossdeck-refit-checkpoint.md",
      "Development_Docs/document-index.json",
      "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    ].includes(file) ||
    /^Development_Docs\/Projects\/Project_Crossdeck\/evidence\//u.test(file) ||
    /^Development_Docs\/Testing\/Product_Experience\/(?:candidate-review\.json$|evidence\/)/u.test(file)
  );
}
export function validatePairedPublication({ root, plan, binding }) {
  if (
    !binding ||
    binding.baseSha !== plan.baseSha ||
    binding.sourceDigest !== plan.sourceDigest ||
    binding.contractDigest !== plan.contractDigest ||
    binding.recordDigest !== (plan.exception?.recordDigest ?? null) ||
    !/^[a-f0-9]{40}$/u.test(binding.candidateSha ?? "") ||
    !/^[a-f0-9]{40}$/u.test(binding.candidateTree ?? "")
  )
    fail("CAPTURE_BINDING_MISSING");
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  if (git(["rev-parse", `${binding.candidateSha}^{tree}`]) !== binding.candidateTree) fail("EXECUTED_TREE_CHANGED");
  git(["merge-base", "--is-ancestor", binding.candidateSha, plan.candidateSha]);
  // The original executed SHA/tree remain immutable. Only publication files may
  // advance after execution; current admission separately pins every runtime input.
  const changes = git(["diff", "--name-only", "--no-renames", binding.candidateSha, plan.candidateSha])
    .split(/\r?\n/u)
    .filter(Boolean);
  if (changes.some((file) => !pairedPublicationPathAllowed(file))) fail("EXECUTED_SOURCE_CHANGED");
}

export function validatePairedEvidence({ root, plan, evidence, read }) {
  const paired = planPairedEvidence(plan.contracts);
  if (!paired) {
    if (evidence.pairedEvidence) fail("UNPLANNED_WITNESS");
    return;
  }
  const observed = evidence.pairedEvidence;
  if (
    observed?.version !== 1 ||
    observed.browserContexts !== paired.browserContexts ||
    observed.cases?.length !== 3 ||
    !/^[a-f0-9]{64}$/u.test(observed.binding?.databaseSha256 ?? "")
  )
    fail("CAPTURE_BINDING_MISSING");
  validatePairedPublication({ root, plan, binding: observed.binding });
  const readJson = (reference) => {
    if (!reference?.path || !/^[a-f0-9]{64}$/u.test(reference.sha256 ?? "")) fail("RECEIPT_MISSING");
    const bytes = read(reference.path);
    if (hash(bytes) !== reference.sha256) fail("RECEIPT_DIGEST_MISMATCH");
    return JSON.parse(bytes);
  };
  validatePairedReport(readJson(observed.report));
  for (const expected of PAIRED_CASES) {
    const cases = observed.cases.filter((c) => c.caseId === expected.id);
    if (cases.length !== 1) fail("CASE_FAILED_RETRIED_OR_MISSING");
    const item = cases[0];
    validatePairedWitness(item, expected, observed.binding);
    const { witness, artifactIds, ...original } = item;
    if (
      witness?.path !==
      path.posix.join(path.posix.dirname(observed.report.path), expected.directory, "paired-witness.json")
    )
      fail("WITNESS_PATH_CHANGED");
    if (!same(original, readJson(witness))) fail("WITNESS_BYTES_CHANGED");
    const expectedIds = [];
    for (const device of devices)
      for (const contractId of paired.contractIds)
        for (const [type, files] of [
          ["screenshot", item.media[device].screenshots],
          ["recording", [item.media[device].recording]],
          ["trace", [item.media[device].trace]],
        ]) {
          for (const file of files) {
            if (
              typeof file !== "string" ||
              file.includes("\\") ||
              path.posix.isAbsolute(file) ||
              file.split("/").some((p) => !p || p === "." || p === "..")
            )
              fail("MEDIA_PATH_INVALID");
            const artifact = evidence.artifacts.filter(
              (a) =>
                artifactIds?.includes(a.id) &&
                a.path === path.posix.join(path.posix.dirname(witness.path), file) &&
                a.contractId === contractId &&
                a.device === device &&
                a.type === type &&
                a.motionMode === expected.motionMode &&
                a.role === "PLAYER" &&
                a.state === `PAIRED_${expected.id}`,
            );
            if (artifact.length !== 1) fail("EACH_CONTEXT_MEDIA_REQUIRED");
            expectedIds.push(artifact[0].id);
            if (type === "screenshot") {
              const bytes = read(artifact[0].path);
              const alternate =
                expected.id !== "crossdeck-pair-adverse" &&
                ((device === "DESKTOP" && file === "14-medium-chronicle.png") ||
                  (device === "MOBILE" && file === "15-phone-landscape.png"));
              const allowed = alternate
                ? device === "DESKTOP"
                  ? { width: 820, height: 1180 }
                  : { width: 844, height: 390 }
                : item.contexts[device].viewport;
              const viewport = artifact[0].viewport;
              if (
                bytes.length < 24 ||
                !viewport ||
                bytes.readUInt32BE(16) !== viewport.width ||
                bytes.readUInt32BE(20) !== viewport.height ||
                !same(viewport, allowed) ||
                !same(viewport, item.media[device].screenshotViewports[file])
              )
                fail("SCREENSHOT_VIEWPORT_CHANGED");
            }
            if (
              type === "trace" &&
              !read(artifact[0].path)
                .subarray(0, 4)
                .equals(Buffer.from([80, 75, 3, 4]))
            )
              fail("TRACE_INVALID");
          }
        }
    if (!same([...expectedIds].sort(), [...(artifactIds ?? [])].sort())) fail("MEDIA_ID_DUPLICATED");
  }
  const runtime = readJson(observed.runtime),
    profile = readJson(observed.profile);
  const diagnostic = runtime.diagnosticBinding;
  if (
    !diagnostic ||
    !same(diagnostic, profile.diagnosticBinding) ||
    diagnostic.baseSha !== observed.binding.baseSha ||
    diagnostic.candidateSha !== observed.binding.candidateSha ||
    !/^[a-f0-9]{64}$/u.test(diagnostic.planDigest ?? "") ||
    !diagnostic.runId ||
    !diagnostic.scopeId
  )
    fail("RUNTIME_BINDING_MISSING");
  if (
    runtime.failureCategory ||
    runtime.lifecycle?.capture !== "PASS" ||
    runtime.lifecycle?.cleanup?.status !== "PASS" ||
    !runtime.lifecycle.cleanup.portsReleased ||
    runtime.lifecycle.cancelled ||
    profile.status !== "PASS" ||
    profile.failureCategory ||
    profile.profile !== "generic"
  )
    fail("TERMINAL_CLEANUP_REQUIRED");
}

export async function sealPairedRuntime({ root, evidence, outputDirectory, runtime, profile }) {
  if (!evidence.pairedEvidence) return;
  for (const [name, value] of [
    ["runtime", runtime],
    ["profile", profile],
  ]) {
    if (!value) fail("TERMINAL_CLEANUP_REQUIRED");
    const file = path.resolve(root, outputDirectory, "paired", `${name}.original.json`);
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    await writeFile(file, bytes);
    evidence.pairedEvidence[name] = { path: relative(root, file), sha256: hash(bytes) };
  }
}
