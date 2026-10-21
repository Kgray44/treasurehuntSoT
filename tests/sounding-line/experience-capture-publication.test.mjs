import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import {
  captureAndPublishExperience,
  createCaptureSubmission,
  publishExperienceCapture,
} from "../../scripts/sounding-line/experience-capture-publication.mjs";
import { writeExperienceReviewPackets } from "../../scripts/sounding-line/experience-browser.mjs";
import { writeCaptureOutputs } from "../../scripts/sounding-line/experience-prepare.mjs";
import {
  BROWSER_DIAGNOSTIC_CONTEXT,
  browserReceiptPaths,
  writeBrowserDiagnosticReceipt,
} from "../../scripts/sounding-line/browser-diagnostics.mjs";
import {
  PAIRED_CASES,
  PAIRED_CONTRACTS,
  planPairedEvidence,
  producePairedEvidence,
  sealPairedRuntime,
  validatePairedEvidence,
} from "../../scripts/sounding-line/experience-paired.mjs";
import {
  artifactBytes,
  experienceDigest,
  validateExperienceArtifacts,
  validateExperienceEvidence,
} from "../../scripts/sounding-line/product-experience.mjs";
import {
  CURRENT_ADMISSION_KIND,
  validateCurrentCaptureIdentity,
  validateCurrentPublicationArtifacts,
} from "../../scripts/sounding-line/experience-current-admission.mjs";

const canonical = "Development_Docs/Testing/Product_Experience/evidence";
const staging = "artifacts/sounding-line/product-experience-capture-staging";
const publication = "artifacts/sounding-line/product-experience-capture-publication";
const evidencePath = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const historicalSentinel = `${canonical}/generic/paired/historical-sentinel.txt`;
const immutableSentinel = "Development_Docs/Testing/Product_Experience/history/immutable.txt";
const contractIds = [
  "crossdeck.phase2.continuity",
  "crossdeck.refit.companion",
  "crossdeck.refit.published-lens",
  "homeport.shell.crossdeck-access-recovery",
  "homeport.shell.crossdeck-companion",
  "homeport.shell.crossdeck-companion-mobile",
  "reach.phase1.foundation",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
const identity = (artifacts) =>
  artifacts.map((artifact) => {
    const unchanged = { ...artifact };
    delete unchanged.path;
    return unchanged;
  });
const write = (root, file, bytes) => {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes, { flag: "wx", mode: 0o644 });
};
const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const webm = Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from("webm"), Buffer.alloc(128)]);
const trace = Buffer.from([80, 75, 3, 4, 0]);
const images = new Map();
for (const [name, width, height] of [
  ["DESKTOP", 1440, 1000],
  ["MOBILE", 390, 844],
  ["medium", 820, 1180],
  ["landscape", 844, 390],
]) {
  images.set(
    name,
    await sharp({ create: { width, height, channels: 4, background: "#123456" } })
      .png()
      .toBuffer(),
  );
}

function contracts() {
  return contractIds.map((id, index) => ({
    id,
    experience: {
      objective: `Synthetic publication fixture for ${id}`,
      entryPoint: "/fixture",
      devices: ["DESKTOP", "MOBILE"],
      roles: ["PLAYER"],
      states: ["READY"],
      systems: ["fixture"],
      motion: true,
      references: [],
      journeys: Array.from({ length: index === 0 ? 2 : 1 }, (_, i) => ({
        id: `journey-${i}`,
        roles: ["PLAYER"],
        outcome: "Synthetic helper fixture only",
        steps: [],
      })),
      ...(PAIRED_CONTRACTS.includes(id)
        ? { pairedEvidence: { version: 1, caseIds: PAIRED_CASES.map((entry) => entry.id) } }
        : {}),
    },
  }));
}

function genericContexts(selected) {
  return selected.flatMap((contract) =>
    contract.experience.devices.flatMap((device) =>
      contract.experience.journeys.flatMap((journey) =>
        journey.roles.flatMap((role) =>
          ["NORMAL", "REDUCED"].map((motionMode) => ({
            contractId: contract.id,
            id: journey.id,
            device,
            role,
            motionMode,
          })),
        ),
      ),
    ),
  );
}

function genericFile(context, type) {
  const suffix = { screenshot: ".png", recording: ".webm", trace: ".zip" }[type];
  return `generic/${context.contractId}-${context.id}-${context.device}-${context.role}-${context.motionMode}-${type}${suffix}`;
}

function pairedFiles(entry, device) {
  return [
    `${device}.png`,
    `${device}.webm`,
    `${device}.zip`,
    ...(entry.id === "crossdeck-pair-normal"
      ? [device === "DESKTOP" ? "14-medium-chronicle.png" : "15-phone-landscape.png"]
      : []),
  ];
}

function publicationJsonFiles() {
  return [
    `${canonical}/capture.json`,
    ...contractIds.map((id) => `${canonical}/${id}-review-packet.json`),
    `${canonical}/generic/capture.json`,
    ...contractIds.map((id) => `${canonical}/generic/${id}-review-packet.json`),
    `${canonical}/generic/paired/playwright-report.json`,
    ...PAIRED_CASES.flatMap((entry) => [
      `${canonical}/generic/paired/${entry.directory}/paired-witness.json`,
      `${canonical}/generic/paired/${entry.directory}/observations.json`,
    ]),
    `${canonical}/generic/paired/runtime.original.json`,
    `${canonical}/generic/paired/profile.original.json`,
  ];
}

function snapshot(root, directory = canonical) {
  const result = {};
  function visit(file) {
    const target = path.join(root, file),
      stat = lstatSync(target);
    if (stat.isDirectory()) {
      for (const name of readdirSync(target).sort()) visit(`${file}/${name}`);
    } else {
      result[file] = {
        mode: stat.mode & 0o777,
        ...(stat.isSymbolicLink()
          ? { symlink: readlinkSync(target) }
          : { bytes: readFileSync(target).toString("base64") }),
      };
    }
  }
  if (existsSync(path.join(root, directory))) visit(directory);
  return result;
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "capture-publication-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q", "--initial-branch=main");
  git("config", "user.name", "Synthetic Publication Fixture");
  git("config", "user.email", "fixture@example.invalid");
  const selected = contracts();
  write(root, "scripts/runtime.mjs", "// synthetic frozen runtime\n");
  write(root, evidencePath, json({ historicalReview: "must remain untouched" }));
  write(root, historicalSentinel, "tracked historical paired sentinel\n");
  write(root, immutableSentinel, "immutable historical bytes\n");
  for (const file of publicationJsonFiles()) write(root, file, json({ historical: file }));
  const media = [
    ...genericContexts(selected).flatMap((context) =>
      ["screenshot", "recording", "trace"].map((type) => genericFile(context, type)),
    ),
    ...PAIRED_CASES.flatMap((entry) =>
      ["DESKTOP", "MOBILE"].flatMap((device) =>
        pairedFiles(entry, device).map((name) => `generic/paired/${entry.directory}/${name}`),
      ),
    ),
  ];
  for (const file of media) write(root, `${canonical}/${file}`, `historical media ${file}\n`);
  chmodSync(path.join(root, canonical, "capture.json"), 0o640);
  chmodSync(path.join(root, canonical, `${contractIds[0]}-review-packet.json`), 0o644);
  git("add", ".");
  git("commit", "-qm", "tracked synthetic historical capture");
  const candidateSha = git("rev-parse", "HEAD");
  const plan = {
    applicable: true,
    baseSha: candidateSha,
    candidateSha,
    sourceDigest: hash(Buffer.from("synthetic publication fixture source")),
    contractDigest: experienceDigest(selected),
    contractIds,
    contracts: selected,
    genericContextCount: 32,
    contextCount: 38,
    paired: planPairedEvidence(selected),
    exception: { id: "SYNTHETIC_PUBLICATION_FIXTURE", recordDigest: "c".repeat(64) },
  };
  const record = {
    immutableHistory: [{ path: immutableSentinel }],
    currentSourceAdmission: { publicationFiles: [evidencePath, ...publicationJsonFiles()] },
  };
  return { root, git, plan, record, before: snapshot(root), reviewBytes: readFileSync(path.join(root, evidencePath)) };
}

function report() {
  return {
    errors: [],
    stats: { expected: 3, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [
      {
        specs: PAIRED_CASES.map((entry) => ({
          title: entry.title,
          file: entry.spec,
          tests: [{ projectName: "chromium", expectedStatus: "passed", results: [{ status: "passed", retry: 0 }] }],
        })),
      },
    ],
  };
}

function fakePairedRun(_executable, args, options) {
  assert(args.includes("--retries=0") && args.includes("--repeat-each=1"));
  assert.equal(options.env.GH_TOKEN, undefined);
  assert.equal(options.env.GITHUB_TOKEN, undefined);
  const binding = JSON.parse(options.env.SOUNDING_LINE_PAIRED_BINDING);
  writeFileSync(options.env.PLAYWRIGHT_JSON_OUTPUT_FILE, json(report()));
  for (const entry of PAIRED_CASES) {
    const directory = path.join(options.env.CROSSDECK_REFIT_ARTIFACT_ROOT, entry.directory);
    mkdirSync(directory);
    const witness = {
      version: 1,
      status: "PASS",
      caseId: entry.id,
      binding,
      fixture: { voyageId: "synthetic-voyage", editionId: "synthetic-edition", databaseSha256: binding.databaseSha256 },
      contexts: Object.fromEntries(
        ["DESKTOP", "MOBILE"].map((device) => [
          device,
          {
            voyageId: "synthetic-voyage",
            editionId: "synthetic-edition",
            surfaceId: device,
            viewport: device === "DESKTOP" ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
            reducedMotion: entry.motionMode === "REDUCED",
          },
        ]),
      ),
      outcomes: Object.fromEntries(entry.outcomes.map((outcome) => [outcome, true])),
      cleanup: { tracesStopped: true, contextsClosed: true, videosFlushed: true, fixtureRemoved: true },
      media: {},
    };
    for (const device of ["DESKTOP", "MOBILE"]) {
      const screenshots = pairedFiles(entry, device).filter((name) => name.endsWith(".png"));
      witness.media[device] = {
        screenshots,
        screenshotViewports: Object.fromEntries(
          screenshots.map((name) => [
            name,
            name === "14-medium-chronicle.png"
              ? { width: 820, height: 1180 }
              : name === "15-phone-landscape.png"
                ? { width: 844, height: 390 }
                : witness.contexts[device].viewport,
          ]),
        ),
        recording: `${device}.webm`,
        trace: `${device}.zip`,
      };
      for (const file of pairedFiles(entry, device)) {
        const bytes = file.endsWith(".webm")
          ? webm
          : file.endsWith(".zip")
            ? trace
            : images.get(
                file === "14-medium-chronicle.png"
                  ? "medium"
                  : file === "15-phone-landscape.png"
                    ? "landscape"
                    : device,
              );
        writeFileSync(path.join(directory, file), bytes);
      }
    }
    writeFileSync(path.join(directory, "paired-witness.json"), json(witness));
    writeFileSync(path.join(directory, "observations.json"), json({ caseId: entry.id, binding, synthetic: true }));
  }
  return { status: 0 };
}

async function completedCapture({ root, plan }) {
  const output = plan.outputDirectory,
    generic = `${output}/generic`;
  mkdirSync(path.join(root, generic), { recursive: true });
  const contexts = genericContexts(plan.contracts);
  const capture = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    exception: plan.exception,
    ownerAcceptance: "NOT_CLAIMED",
    artifacts: [],
    journeys: contexts.map((context) => ({ ...context, status: "PASS", roleVerified: true, returnPathVerified: true })),
    reviews: [],
  };
  for (const context of contexts) {
    for (const type of ["screenshot", "recording", "trace"]) {
      const file = genericFile(context, type),
        bytes = type === "screenshot" ? images.get(context.device) : type === "recording" ? webm : trace;
      write(root, `${output}/${file}`, bytes);
      capture.artifacts.push({
        ...context,
        path: `${output}/${file}`,
        sha256: hash(bytes),
        type,
        origin: "ACTUAL_APPLICATION",
        id: `${context.contractId}-${context.id}-${context.device}-${context.role}-${context.motionMode}-${type}`,
        ...(type === "screenshot" ? { state: "READY" } : {}),
      });
    }
  }
  const paired = await producePairedEvidence({
    root,
    plan,
    baseURL: "http://127.0.0.1:4321",
    outputDirectory: generic,
    environment: { DATABASE_URL: "file:synthetic.db", GH_TOKEN: "never-forward", GITHUB_TOKEN: "never-forward" },
    run: fakePairedRun,
  });
  capture.artifacts.push(...paired.artifacts);
  capture.pairedEvidence = paired.pairedEvidence;
  const diagnosticBinding = {
    version: 1,
    runId: "synthetic-run",
    scopeId: "synthetic-scope",
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    planDigest: experienceDigest(plan),
  };
  await sealPairedRuntime({
    root,
    evidence: capture,
    outputDirectory: generic,
    runtime: {
      diagnosticBinding,
      failureCategory: null,
      lifecycle: { capture: "PASS", cleanup: { status: "PASS", portsReleased: true }, cancelled: false },
    },
    profile: { diagnosticBinding, status: "PASS", profile: "generic", failureCategory: null },
  });
  write(root, `${output}/capture.json`, json(capture));
  write(root, `${generic}/capture.json`, json(capture));
  await writeExperienceReviewPackets({ plan, evidence: capture, artifactRoot: path.join(root, output) });
  await writeExperienceReviewPackets({ plan, evidence: capture, artifactRoot: path.join(root, generic) });
  return {
    status: "PASS",
    sourceDigest: plan.sourceDigest,
    profiles: ["generic"],
    capturePath: path.join(root, output, "capture.json"),
    captured: structuredClone(capture),
  };
}

async function staged(t) {
  const f = fixture(t);
  const parent = path.join(f.root, staging);
  mkdirSync(parent, { recursive: true });
  const owned = mkdtempSync(path.join(parent, "fixture-"));
  const workingDirectory = `${relative(f.root, owned)}/capture`;
  mkdirSync(path.join(f.root, workingDirectory));
  const replay = await completedCapture({ root: f.root, plan: { ...f.plan, outputDirectory: workingDirectory } });
  return { ...f, workingDirectory, journalDirectory: `${publication}/fixture`, replay };
}

test("current automated replay validates all 32 generic plus 6 paired contexts in its runtime namespace", async (t) => {
  const f = fixture(t);
  // Inert source fixture: no registry, execution claim, provider or browser run.
  f.plan.exception.currentSourceAdmission = { kind: CURRENT_ADMISSION_KIND };
  for (const contract of f.plan.contracts) {
    contract.experience.motion = { feedbackBudgetMs: 150, measurement: "SYNTHETIC_INPUT_TO_FEEDBACK" };
    contract.experience.continuity = { checks: [{ id: "voyage" }] };
    contract.experience.systems = ["synthetic-desktop", "synthetic-phone"];
  }
  f.plan.contractDigest = experienceDigest(f.plan.contracts);
  const replay = await completedCapture({
    root: f.root,
    plan: { ...f.plan, outputDirectory: "artifacts/sounding-line/product-experience-replay" },
  });
  const evidence = replay.captured;
  for (const journey of evidence.journeys) {
    Object.assign(journey, {
      entryPoint: "/fixture",
      outcome: "Synthetic helper fixture only",
      visibleActions: 1,
      accessibility: { keyboard: true, focus: true, motionPreferenceVerified: true },
      feedbackMs: 50,
      measurement: "SYNTHETIC_INPUT_TO_FEEDBACK",
      continuity: [{ id: "voyage", before: "d".repeat(64), atOutcomes: ["d".repeat(64)], after: "d".repeat(64) }],
    });
  }
  const verify = (value = evidence) =>
    validateExperienceEvidence({ root: f.root, plan: f.plan, evidence: value, automatedOnly: true });
  assert.equal(evidence.journeys.length, 32);
  assert.equal(evidence.pairedEvidence.browserContexts, 6);
  assert.equal(verify().status, "PASS");
  // The same descriptors cannot be submitted as committed publication evidence.
  assert.throws(
    () => validateCurrentPublicationArtifacts(evidence.artifacts),
    /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u,
  );
  assert.throws(
    () => validateCurrentCaptureIdentity(f.plan, evidence, evidence),
    /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u,
  );
  const reject = (mutate, pattern) => {
    const changed = structuredClone(evidence);
    mutate(changed);
    assert.throws(() => verify(changed), pattern);
  };
  const descriptorError = /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u;
  for (const field of ["id", "sha256", "contractId", "state", "device", "role", "motionMode"])
    reject((value) => {
      delete value.artifacts[0][field];
    }, descriptorError);
  for (const invalid of [
    "src/app/escaped.png",
    "artifacts/sounding-line/product-experience-replay-other/escaped.png",
    "artifacts/sounding-line/product-experience-replay/../escaped.png",
    "artifacts/sounding-line/product-experience-replay/escaped.webm",
  ])
    reject((value) => {
      value.artifacts[0].path = invalid;
    }, descriptorError);
  reject((value) => {
    value.artifacts = [];
  }, descriptorError);
  reject((value) => {
    value.artifacts = Array.from({ length: 4097 }, (_, index) => ({
      ...value.artifacts[0],
      id: `excess-${index}`,
      path: `artifacts/sounding-line/product-experience-replay/excess-${index}.png`,
    }));
  }, descriptorError);
  reject((value) => {
    value.artifacts[1].id = value.artifacts[0].id;
  }, descriptorError);
  reject((value) => {
    value.artifacts.push({ ...value.artifacts[0], id: "arbitrary-path-alias" });
  }, descriptorError);
  const paired = evidence.artifacts.find((item) => item.state?.startsWith("PAIRED_"));
  for (const mutation of [
    { sha256: "0".repeat(64) },
    { contractId: paired.contractId },
    { role: "CREATOR" },
    { motionMode: "INVALID" },
    { viewport: { width: 1, height: 1 } },
    { id: "unbound-paired-alias" },
  ])
    reject((value) => {
      const alias = value.artifacts.find((item) => item.path === paired.path && item.id !== paired.id);
      Object.assign(alias, mutation);
    }, descriptorError);
  reject((value) => {
    value.artifacts.push({ ...paired, id: "third-paired-alias" });
  }, descriptorError);
  reject((value) => {
    value.exception.recordDigest = "0".repeat(64);
  }, /EVIDENCE_BINDING_MISSING/u);
  for (const field of ["baseSha", "sourceDigest", "contractDigest"])
    reject((value) => {
      value[field] = "0".repeat(value[field].length);
    }, /EVIDENCE_SOURCE_MISMATCH/u);
  reject((value) => {
    value.artifacts[0].sha256 = "0".repeat(64);
  }, /ARTIFACT_DIGEST_MISMATCH/u);
  reject((value) => {
    value.artifacts[0].origin = "SYNTHETIC";
  }, /ARTIFACT_ORIGIN_INVALID/u);
  reject((value) => {
    value.journeys.shift();
  }, /SEMANTIC_JOURNEY_FAILED/u);
  reject((value) => {
    value.journeys[0].accessibility.overflow = true;
  }, /ACCESSIBILITY_OR_RESPONSIVE_DEFECT/u);
  reject((value) => {
    value.journeys[0].feedbackMs = 151;
  }, /RESPONSIVENESS_FAILED/u);
  reject((value) => {
    value.journeys[0].continuity[0].after = "e".repeat(64);
  }, /CROSS_PROJECT_JOURNEY_FAILED/u);
  reject((value) => {
    value.pairedEvidence.report = null;
  }, /RECEIPT_MISSING/u);
  reject((value) => {
    value.pairedEvidence.report.sha256 = "0".repeat(64);
  }, /RECEIPT_DIGEST_MISMATCH/u);
  reject((value) => {
    value.pairedEvidence.cases[0].witness.sha256 = "0".repeat(64);
  }, /RECEIPT_DIGEST_MISMATCH/u);
  reject((value) => {
    value.pairedEvidence.cases[0].cleanup.contextsClosed = false;
  }, /CLEANUP_REQUIRED/u);
  const rewriteReceipt = (reference, mutate) => {
    const bytes = artifactBytes({ root: f.root, file: reference.path });
    const changed = JSON.parse(bytes);
    mutate(changed);
    const replacement = Buffer.from(json(changed));
    writeFileSync(path.join(f.root, reference.path), replacement);
    reference.sha256 = hash(replacement);
    return () => writeFileSync(path.join(f.root, reference.path), bytes);
  };
  for (const [field, mutate, pattern] of [
    [
      "report",
      (value) => {
        value.stats.skipped = 1;
      },
      /THREE_SUCCESSFUL_CASES_REQUIRED/u,
    ],
    [
      "runtime",
      (value) => {
        value.lifecycle.cleanup.portsReleased = false;
      },
      /TERMINAL_CLEANUP_REQUIRED/u,
    ],
    [
      "runtime",
      (value) => {
        value.diagnosticBinding.candidateSha = "0".repeat(40);
      },
      /RUNTIME_BINDING_MISSING/u,
    ],
  ]) {
    const changed = structuredClone(evidence);
    const restore = rewriteReceipt(changed.pairedEvidence[field], mutate);
    try {
      assert.throws(() => verify(changed), pattern);
    } finally {
      restore();
    }
  }
  assert.equal(verify().status, "PASS");
});

test("failed replay preserves every historical canonical byte and retains partial output only in its fresh namespace", async (t) => {
  const f = fixture(t),
    failure = new Error("synthetic replay failure");
  let workingDirectory;
  await assert.rejects(
    captureAndPublishExperience({
      ...f,
      replay: async ({ root, plan, validateReplay }) => {
        assert.equal(validateReplay, false);
        assert.equal(plan.sourceDigest, f.plan.sourceDigest);
        workingDirectory = plan.outputDirectory;
        assert(workingDirectory.startsWith(staging + "/"));
        write(root, `${workingDirectory}/partial.txt`, "partial capture retained\n");
        throw failure;
      },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(snapshot(f.root), f.before);
  assert.deepEqual(readFileSync(path.join(f.root, evidencePath)), f.reviewBytes);
  assert.equal(readFileSync(path.join(f.root, workingDirectory, "partial.txt"), "utf8"), "partial capture retained\n");
  assert.equal(f.git("diff", "--", "Development_Docs"), "");
});

test("fresh capture publishes all 32 generic plus 6 paired contexts over tracked canonical paired history without changing identities", async (t) => {
  const f = fixture(t);
  let captured;
  const result = await captureAndPublishExperience({
    ...f,
    replay: async (options) => {
      const replay = await completedCapture(options);
      captured = replay.captured;
      return replay;
    },
  });
  assert.equal(result.capturePath, path.join(f.root, canonical, "capture.json"));
  const capture = JSON.parse(readFileSync(result.capturePath, "utf8"));
  assert.equal(capture.journeys.length, 32);
  assert.deepEqual(capture.journeys, captured.journeys);
  assert.equal(capture.pairedEvidence.browserContexts, 6);
  assert.equal(capture.journeys.length + capture.pairedEvidence.browserContexts, f.plan.contextCount);
  assert.deepEqual(identity(capture.artifacts), identity(captured.artifacts));
  assert.deepEqual(capture.pairedEvidence.binding, captured.pairedEvidence.binding);
  assert.deepEqual(capture.exception, captured.exception);
  assert.equal(readFileSync(path.join(f.root, historicalSentinel), "utf8"), "tracked historical paired sentinel\n");
  assert.deepEqual(readFileSync(path.join(f.root, evidencePath)), f.reviewBytes);
  assert.equal(readFileSync(path.join(f.root, immutableSentinel), "utf8"), "immutable historical bytes\n");
  validateExperienceArtifacts({ root: f.root, plan: f.plan, evidence: capture });
  validatePairedEvidence({
    root: f.root,
    plan: f.plan,
    evidence: capture,
    read: (file) => artifactBytes({ root: f.root, file }),
  });
  validateCurrentPublicationArtifacts(capture.artifacts);
  const currentPlan = {
    ...f.plan,
    exception: { ...f.plan.exception, currentSourceAdmission: { kind: CURRENT_ADMISSION_KIND } },
  };
  const profileCapture = readJson(f.root, `${canonical}/generic/capture.json`);
  validateCurrentCaptureIdentity(currentPlan, capture, profileCapture);
  const changedProfile = structuredClone(profileCapture);
  changedProfile.artifacts[0].sha256 = "0".repeat(64);
  assert.throws(
    () => validateCurrentCaptureIdentity(currentPlan, capture, changedProfile),
    /CURRENT_CAPTURE_PATH_OR_CONTEXT_CHANGED/,
  );
  const aliases = new Map();
  for (const artifact of capture.artifacts) {
    assert(artifact.path.startsWith(canonical + "/"));
    assert.equal(hash(readFileSync(path.join(f.root, artifact.path))), artifact.sha256);
    const group = aliases.get(artifact.path) ?? [];
    group.push(artifact);
    aliases.set(artifact.path, group);
  }
  assert.equal([...aliases.values()].filter((group) => group.length === 2).length, 20);
  for (const group of aliases.values())
    if (group.length > 1) assert.deepEqual(group.map((item) => item.contractId).sort(), [...PAIRED_CONTRACTS].sort());
  for (const file of publicationJsonFiles()) {
    const value = readJson(f.root, file);
    assert.equal(json(value).includes(staging + "/"), false, file);
  }
  assert.equal(publicationJsonFiles().length, 25);
  for (const contract of f.plan.contracts) {
    const packet = readJson(f.root, `${canonical}/${contract.id}-review-packet.json`);
    assert.deepEqual(
      packet.artifacts,
      capture.artifacts.filter((artifact) => artifact.contractId === contract.id),
    );
    assert.deepEqual(packet, readJson(f.root, `${canonical}/generic/${contract.id}-review-packet.json`));
    assert.equal(packet.builderRationaleIncluded, false);
    if (contract.experience.pairedEvidence) assert.deepEqual(packet.pairedEvidence, capture.pairedEvidence);
  }
  const journal = JSON.parse(readFileSync(result.journalPath, "utf8"));
  assert.equal(journal.status, "PASS");
  assert.deepEqual(
    journal.files.map((entry) => entry.path).sort(),
    [...publicationJsonFiles(), ...aliases.keys()].sort(),
  );
  assert.equal(journal.files.length, 141);
  assert.deepEqual(journal.promoted, journal.attempted);
  assert.equal(journal.promoted.length, journal.files.length);
  for (const entry of journal.files) {
    const source = path.join(f.root, journal.workingDirectory, entry.path.slice(canonical.length + 1));
    assert.equal(hash(readFileSync(source)), entry.source.sha256);
    assert.equal(lstatSync(source).mode & 0o777, entry.source.permissions);
    assert.equal(entry.previous.permissions, f.before[entry.path].mode);
    assert.equal(lstatSync(path.join(f.root, entry.path)).mode & 0o777, entry.next.permissions);
    assert.equal(hash(readFileSync(path.join(f.root, entry.path))), entry.next.sha256);
  }
  const remapped = structuredClone(captured);
  const remap = (file) => canonical + file.slice(journal.workingDirectory.length);
  for (const artifact of remapped.artifacts) artifact.path = remap(artifact.path);
  for (const reference of [
    remapped.pairedEvidence.report,
    remapped.pairedEvidence.runtime,
    remapped.pairedEvidence.profile,
    ...remapped.pairedEvidence.cases.map((entry) => entry.witness),
  ]) {
    reference.path = remap(reference.path);
    assert.equal(hash(readFileSync(path.join(f.root, reference.path))), reference.sha256);
  }
  assert.deepEqual(capture, remapped);
});

test("the paired producer still rejects reuse of its fresh output and keeps the completed bytes intact", async (t) => {
  const f = await staged(t),
    before = snapshot(f.root, f.workingDirectory);
  await assert.rejects(
    producePairedEvidence({
      ...f,
      baseURL: "http://127.0.0.1:4321",
      outputDirectory: `${f.workingDirectory}/generic`,
      environment: { DATABASE_URL: "file:synthetic.db" },
      run: fakePairedRun,
    }),
    { code: "EEXIST" },
  );
  assert.deepEqual(snapshot(f.root, f.workingDirectory), before);
  assert.deepEqual(snapshot(f.root), f.before);
});

for (const afterRename of [false, true]) {
  test(`promotion failure ${afterRename ? "after" : "before"} rename restores exact tracked bytes and retains journal/preimages`, async (t) => {
    const f = await staged(t),
      failure = new Error("synthetic promotion failure");
    let calls = 0;
    await assert.rejects(
      publishExperienceCapture({
        ...f,
        promote: async (from, to) => {
          calls += 1;
          if (calls === 4 && !afterRename) throw failure;
          await rename(from, to);
          if (calls === 4 && afterRename) throw failure;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(calls, 4);
    assert.deepEqual(snapshot(f.root), f.before);
    assert.equal(f.git("diff", "--", "Development_Docs"), "");
    const journal = readJson(f.root, `${f.journalDirectory}/journal.json`);
    assert.equal(journal.status, "FAILED");
    assert.equal(journal.attempted.length, 4);
    assert.equal(
      journal.rollback.some((entry) => entry.status === "FAILED"),
      false,
    );
    assert(journal.rollback.some((entry) => entry.status === "RESTORED"));
    for (const entry of journal.files) {
      assert(entry.previous);
      const preimage = readFileSync(path.join(f.root, f.journalDirectory, "preimages", entry.path));
      assert.equal(preimage.toString("base64"), f.before[entry.path].bytes);
      assert.equal(
        lstatSync(path.join(f.root, f.journalDirectory, "preimages", entry.path)).mode & 0o777,
        f.before[entry.path].mode,
      );
    }
  });
}

test("publication refuses reuse of a previous journal without touching either its bytes or canonical history", async (t) => {
  const f = await staged(t);
  write(f.root, `${f.journalDirectory}/sentinel.txt`, "preexisting journal\n");
  await assert.rejects(publishExperienceCapture(f), { code: "EEXIST" });
  assert.equal(readFileSync(path.join(f.root, f.journalDirectory, "sentinel.txt"), "utf8"), "preexisting journal\n");
  assert.deepEqual(snapshot(f.root), f.before);
});

test("escape, symlink and immutable-history overlap are rejected before any canonical publication", async (t) => {
  for (const kind of ["escape", "source-symlink", "destination-symlink", "immutable"]) {
    await t.test(kind, async (t) => {
      const f = await staged(t);
      const media = f.replay.captured.artifacts[0];
      if (kind === "escape") f.workingDirectory = "../outside";
      if (kind === "source-symlink") {
        const original = path.join(f.root, media.path),
          replacement = path.join(f.root, "preserved-source.png");
        await rename(original, replacement);
        symlinkSync(replacement, original);
      }
      if (kind === "destination-symlink") {
        const destination = path.join(f.root, `${canonical}/capture.json`),
          outside = path.join(f.root, "outside.json");
        writeFileSync(outside, "untouched outside bytes\n");
        rmSync(destination);
        symlinkSync(outside, destination);
      }
      if (kind === "immutable") f.record.immutableHistory.push({ path: `${canonical}/capture.json` });
      const before = snapshot(f.root);
      const expected = {
        escape: /CAPTURE_PUBLICATION_PATH_INVALID/,
        "source-symlink": /CAPTURE_PUBLICATION_PATH_NOT_OWNED/,
        "destination-symlink": /CAPTURE_PUBLICATION_PATH_NOT_OWNED/,
        immutable: /CAPTURE_PUBLICATION_IMMUTABLE_HISTORY_OVERLAP/,
      }[kind];
      await assert.rejects(publishExperienceCapture(f), expected);
      assert.deepEqual(snapshot(f.root), before);
      if (kind === "destination-symlink")
        assert.equal(readFileSync(path.join(f.root, "outside.json"), "utf8"), "untouched outside bytes\n");
    });
  }
});

test("a deleted tracked publication destination is retained as missing and rejected before promotion", async (t) => {
  const f = await staged(t);
  const deleted = path.join(f.root, canonical, "capture.json");
  rmSync(deleted);
  const before = snapshot(f.root);
  let promotions = 0;
  await assert.rejects(
    publishExperienceCapture({
      ...f,
      promote: async (from, to) => {
        promotions += 1;
        await rename(from, to);
      },
    }),
    /PRODUCT_EXPERIENCE_CAPTURE_PUBLICATION_DESTINATION_/,
  );
  assert.equal(promotions, 0);
  assert.equal(existsSync(deleted), false);
  assert.deepEqual(snapshot(f.root), before);
});

test("failure-journal ENOSPC preserves the promotion error and restores canonical bytes and modes", async (t) => {
  const f = await staged(t);
  const promotionFailure = new Error("synthetic promotion failure before fourth rename");
  const journalFailure = Object.assign(new Error("synthetic full disk while writing failure journal"), {
    code: "ENOSPC",
  });
  let promotions = 0,
    failedJournalWrites = 0,
    observed;
  await assert.rejects(
    publishExperienceCapture({
      ...f,
      promote: async (from, to) => {
        promotions += 1;
        if (promotions === 4) throw promotionFailure;
        await rename(from, to);
      },
      writeJournal: async (file, text, options) => {
        if (JSON.parse(text).status === "FAILED") {
          failedJournalWrites += 1;
          assert.equal(options.flag, "wx");
          await writeFile(file, text.slice(0, 31), options);
          throw journalFailure;
        }
        await writeFile(file, text, options);
      },
    }),
    (error) => {
      observed = error;
      return error instanceof AggregateError;
    },
  );
  assert.equal(promotions, 4);
  assert.equal(failedJournalWrites, 1);
  assert.equal(observed.cause, promotionFailure);
  assert(observed.errors.includes(promotionFailure));
  assert(observed.errors.includes(journalFailure));
  assert.deepEqual(snapshot(f.root), f.before);
  assert.equal(f.git("diff", "--", "Development_Docs"), "");
  const lastDurableJournal = readJson(f.root, `${f.journalDirectory}/journal.json`);
  assert.equal(lastDurableJournal.status, "READY");
  assert.equal(lastDurableJournal.attempted.length, 4);
  const failureReceipt = readJson(f.root, `${f.journalDirectory}/journal-failure.json`);
  assert.equal(failureReceipt.status, "FAILED");
  assert.equal(failureReceipt.error, String(promotionFailure));
  assert.equal(failureReceipt.journalError, String(journalFailure));
  assert.equal(
    failureReceipt.rollback.some((entry) => entry.status === "FAILED"),
    false,
  );
  const partialJournals = readdirSync(path.join(f.root, f.journalDirectory)).filter((name) =>
    name.endsWith(".pending"),
  );
  assert.equal(partialJournals.length, 1);
  assert.throws(() => readJson(f.root, `${f.journalDirectory}/${partialJournals[0]}`), SyntaxError);
  for (const entry of lastDurableJournal.files) {
    const preimage = path.join(f.root, f.journalDirectory, "preimages", entry.path);
    assert.equal(readFileSync(preimage).toString("base64"), f.before[entry.path].bytes);
    assert.equal(lstatSync(preimage).mode & 0o777, f.before[entry.path].mode);
  }
});

test("stale fixed submission ownership is refused without emitting paths or changing old bytes", async (t) => {
  const f = fixture(t);
  const submission = "artifacts/sounding-line/product-experience-submission";
  write(f.root, `${submission}/plan.json`, "stale plan bytes\n");
  write(f.root, `${submission}/capture.json`, "stale capture bytes\n");
  write(f.root, `${submission}/activation.json`, "stale activation bytes\n");
  const before = snapshot(f.root, submission),
    emitted = [];
  await assert.rejects(
    createCaptureSubmission({
      root: f.root,
      plan: f.plan,
      onPaths: async (paths) => {
        emitted.push(structuredClone(paths));
      },
    }),
    { code: "EEXIST" },
  );
  assert.deepEqual(emitted, []);
  assert.deepEqual(snapshot(f.root, submission), before);
  assert.deepEqual(snapshot(f.root), f.before);
});

test("invalid early preparation emits no paths despite old submission, stage, journal and lifecycle roots", (t) => {
  const f = fixture(t);
  const output = "github-output.private.txt";
  write(f.root, output, "inherited_sentinel=keep\n");
  for (const file of [
    "artifacts/sounding-line/product-experience-submission/plan.json",
    `${staging}/stale/capture/partial.txt`,
    `${publication}/stale/journal.json`,
    "artifacts/sounding-line/browser-runtime.json",
    "artifacts/sounding-line/browser-suite-profile.json",
    "artifacts/sounding-line/browser-diagnostics/stale-run/stale-scope/browser-runtime.json",
  ])
    write(f.root, file, `old bytes ${file}\n`);
  const before = snapshot(f.root, "artifacts");
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../../scripts/sounding-line/experience-prepare.mjs", import.meta.url)),
      "--workspace",
      f.root,
      "--base",
      "invalid",
      "--candidate",
      f.plan.candidateSha,
      "--mode",
      "capture",
    ],
    {
      cwd: f.root,
      env: { PATH: process.env.PATH, GITHUB_OUTPUT: path.join(f.root, output) },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PRODUCT_EXPERIENCE_EXACT_SOURCE_REQUIRED/);
  assert.equal(result.stdout, "");
  assert.equal(readFileSync(path.join(f.root, output), "utf8"), "inherited_sentinel=keep\n");
  assert.deepEqual(snapshot(f.root, "artifacts"), before);
  assert.deepEqual(snapshot(f.root), f.before);
});

function parseActionsOutputs(text) {
  const lines = text.trimEnd().split("\n"),
    values = {};
  for (let index = 0; index < lines.length; index += 1) {
    const single = /^([a-z_]+)=(.*)$/u.exec(lines[index]);
    if (single) {
      values[single[1]] = single[2];
      continue;
    }
    const multiline = /^([a-z_]+)<<(.+)$/u.exec(lines[index]);
    assert(multiline, `Invalid output declaration: ${lines[index]}`);
    const content = [];
    while (++index < lines.length && lines[index] !== multiline[2]) content.push(lines[index]);
    assert.equal(lines[index], multiline[2]);
    values[multiline[1]] = content.join("\n");
  }
  return values;
}

function seedStaleCapturePaths(root) {
  const files = [
    `${staging}/stale-run/capture/partial.txt`,
    `${publication}/stale-run/journal.json`,
    `${publication}/stale-run/journal-failure.json`,
    `${publication}/stale-run/journal.1.pending`,
    "artifacts/sounding-line/browser-runtime.json",
    "artifacts/sounding-line/browser-suite-profile.json",
    "artifacts/sounding-line/browser-diagnostics/stale-run/stale-scope/browser-runtime.json",
    "artifacts/sounding-line/browser-diagnostics/stale-run/stale-scope/browser-suite-profile.json",
  ];
  for (const file of files) write(root, file, `stale bytes ${file}\n`);
  return Object.fromEntries(files.map((file) => [file, readFileSync(path.join(root, file))]));
}

test("submission outputs follow the exclusive current plan write and encode every lifecycle array line", async (t) => {
  const f = fixture(t),
    emitted = [];
  const outputFile = path.join(f.root, "github-output.private.txt");
  const environment = { GITHUB_OUTPUT: outputFile };
  const result = await createCaptureSubmission({
    root: f.root,
    plan: f.plan,
    onPaths: async (paths) => {
      assert.deepEqual(readJson(f.root, paths.capture_plan_path), f.plan);
      assert.equal(existsSync(path.join(f.root, paths.capture_manifest_path)), false);
      assert.equal(existsSync(path.join(f.root, paths.capture_activation_path)), false);
      emitted.push(structuredClone(paths));
      await writeCaptureOutputs(paths, environment);
    },
  });
  assert.equal(result.receiptRoot, path.join(f.root, "artifacts/sounding-line/product-experience-submission"));
  assert.equal(emitted.length, 1);
  assert.deepEqual(Object.keys(emitted[0]).sort(), [
    "capture_activation_path",
    "capture_manifest_path",
    "capture_plan_path",
  ]);
  const lifecycle = {
    capture_runtime_paths: [
      "artifacts/sounding-line/browser-diagnostics/current/scope-1/browser-runtime.json",
      "artifacts/sounding-line/browser-diagnostics/current/scope-2/browser-runtime.json",
    ],
    capture_profile_paths: [
      "artifacts/sounding-line/browser-diagnostics/current/scope-1/browser-suite-profile.json",
      "artifacts/sounding-line/browser-diagnostics/current/scope-2/browser-suite-profile.json",
    ],
  };
  await writeCaptureOutputs(lifecycle, environment);
  const actual = parseActionsOutputs(readFileSync(outputFile, "utf8"));
  for (const [name, value] of Object.entries(emitted[0])) assert.equal(actual[name], `candidate/${value}`);
  for (const [name, values] of Object.entries(lifecycle))
    assert.deepEqual(
      actual[name].split("\n"),
      values.map((file) => `candidate/${file}`),
    );
  const before = readFileSync(outputFile);
  for (const bad of ["../escape", "artifacts/sounding-line/current\nforeign=1", "/tmp/foreign"]) {
    await assert.rejects(writeCaptureOutputs({ capture_stage_path: bad }, environment));
    assert.deepEqual(readFileSync(outputFile), before);
  }
  assert.deepEqual(snapshot(f.root), f.before);
});

test("failed or cancelled replay emits only its owned stage, journal and two current diagnostic scopes", async (t) => {
  for (const outcome of ["failure", "cancelled"])
    await t.test(outcome, async (t) => {
      const f = fixture(t),
        stale = seedStaleCapturePaths(f.root),
        events = [],
        scopes = [];
      const outputFile = path.join(f.root, "github-output.private.txt");
      const failure = new Error(`synthetic ${outcome} before publication`);
      if (outcome === "cancelled") failure.name = "AbortError";
      const outputEnvironment = { GITHUB_OUTPUT: outputFile };
      let workingDirectory;
      await assert.rejects(
        captureAndPublishExperience({
          ...f,
          environment: { [BROWSER_DIAGNOSTIC_CONTEXT]: "inherited-invalid-context-must-not-bind-current-run" },
          onPaths: async (paths) => {
            if (paths.capture_stage_path) {
              assert(lstatSync(path.join(f.root, paths.capture_stage_path)).isDirectory());
              const journal = path.dirname(path.join(f.root, paths.capture_journal_path));
              assert.deepEqual(readdirSync(journal), []);
            }
            events.push(structuredClone(paths));
            await writeCaptureOutputs(paths, outputEnvironment);
          },
          replay: async ({ root, plan, diagnostics, onDiagnosticScope, validateReplay }) => {
            assert.equal(validateReplay, false);
            assert.equal(events.length, 1);
            workingDirectory = plan.outputDirectory;
            assert.equal(events[0].capture_stage_path, workingDirectory);
            assert.deepEqual(await diagnostics.read(), { binding: null, runtime: null, profile: null });
            write(root, `${workingDirectory}/partial.txt`, `current ${outcome} retained\n`);
            for (let index = 0; index < 2; index += 1) {
              const diagnosticEnvironment = diagnostics.beginScope();
              const paths = browserReceiptPaths(root, diagnosticEnvironment);
              assert.equal(paths.binding.baseSha, f.plan.baseSha);
              assert.equal(paths.binding.candidateSha, f.plan.candidateSha);
              assert.equal(paths.binding.planDigest, experienceDigest(plan));
              await onDiagnosticScope(paths);
              assert(lstatSync(paths.directory).isDirectory());
              assert.deepEqual(readdirSync(paths.directory), []);
              await writeBrowserDiagnosticReceipt(
                root,
                "browser-runtime.json",
                { fixture: index, status: "SYNTHETIC" },
                diagnosticEnvironment,
              );
              await writeBrowserDiagnosticReceipt(
                root,
                "browser-suite-profile.json",
                { fixture: index, status: "SYNTHETIC" },
                diagnosticEnvironment,
              );
              scopes.push(paths);
              const last = events.at(-1);
              assert.deepEqual(
                last.capture_runtime_paths,
                scopes.map((scope) => relative(root, scope.runtime)),
              );
              assert.deepEqual(
                last.capture_profile_paths,
                scopes.map((scope) => relative(root, scope.profile)),
              );
            }
            throw failure;
          },
        }),
        (error) => error === failure,
      );
      assert.equal(events.length, 4);
      const current = events[0],
        journalDirectory = path.posix.dirname(current.capture_journal_path);
      assert.equal(current.capture_raw_retention_status, "PENDING");
      assert.equal(events.at(-1).capture_raw_retention_status, "COMPLETE");
      assert.equal(current.capture_raw_encrypted_path, `${path.posix.dirname(workingDirectory)}/encrypted`);
      assert(lstatSync(path.join(f.root, current.capture_raw_encrypted_path)).isDirectory());
      const verifiedPaths = readdirSync(path.join(f.root, current.capture_raw_encrypted_path))
        .map((name) => `${current.capture_raw_encrypted_path}/${name}`)
        .sort();
      assert.deepEqual(Object.keys(events.at(-1)).sort(), [
        "capture_raw_retention_status",
        "capture_raw_verified_paths",
      ]);
      assert.deepEqual([...events.at(-1).capture_raw_verified_paths].sort(), verifiedPaths);
      assert.equal(Object.hasOwn(current, "capture_raw_path"), false);
      assert.equal(current.capture_journal_failure_path, `${journalDirectory}/journal-failure.json`);
      assert.equal(current.capture_journal_pending_path, `${journalDirectory}/journal.*.pending`);
      assert.equal(path.posix.basename(journalDirectory), path.posix.basename(path.posix.dirname(workingDirectory)));
      assert.equal(
        readFileSync(path.join(f.root, workingDirectory, "partial.txt"), "utf8"),
        `current ${outcome} retained\n`,
      );
      assert.equal(scopes[0].binding.runId, scopes[1].binding.runId);
      assert.notEqual(scopes[0].binding.scopeId, scopes[1].binding.scopeId);
      const actual = parseActionsOutputs(readFileSync(outputFile, "utf8"));
      for (const [name, value] of Object.entries(current))
        if (name !== "capture_raw_retention_status") assert.equal(actual[name], `candidate/${value}`);
      assert.equal(actual.capture_raw_retention_status, "COMPLETE");
      assert.deepEqual(
        actual.capture_raw_verified_paths.split("\n").sort(),
        verifiedPaths.map((file) => `candidate/${file}`),
      );
      assert.deepEqual(
        actual.capture_runtime_paths.split("\n"),
        scopes.map((scope) => `candidate/${relative(f.root, scope.runtime)}`),
      );
      assert.deepEqual(
        actual.capture_profile_paths.split("\n"),
        scopes.map((scope) => `candidate/${relative(f.root, scope.profile)}`),
      );
      assert.equal(JSON.stringify(events).includes("stale-run"), false);
      for (const [file, bytes] of Object.entries(stale)) assert.deepEqual(readFileSync(path.join(f.root, file)), bytes);
      assert.deepEqual(snapshot(f.root), f.before);
    });
});

function projectWorkflowUpload(block, outcome, outputs, mode = "capture") {
  const knownNames = [...block.matchAll(/steps\.experience\.outputs\.([a-z_]+)/gu)].map((match) => match[1]);
  const context = {
    always: () => true,
    inputs: { experience_mode: mode },
    steps: {
      experience: { outcome, outputs: { ...Object.fromEntries(knownNames.map((name) => [name, ""])), ...outputs } },
    },
  };
  const evaluate = (expression) => runInNewContext(expression, context, { timeout: 100 });
  const condition = /^        if: (.+)$/mu.exec(block)?.[1];
  assert(condition);
  if (!evaluate(condition)) return { enabled: false, paths: [] };
  const lines = block.split("\n"),
    start = lines.indexOf("          path: |");
  assert(start >= 0);
  const paths = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("            ")) break;
    const expression = /^            \$\{\{\s*(.*?)\s*\}\}$/u.exec(line);
    assert(expression, "Upload path must be an explicit current-output expression");
    const value = evaluate(expression[1]);
    if (value) paths.push(...String(value).split("\n").filter(Boolean));
  }
  return { enabled: true, paths };
}

test("capture workflow projects only emitted current paths for success, failure and cancellation; no-output early failure skips uploads", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sounding-line-ordinary.yml", import.meta.url), "utf8");
  const blocks = workflow.split(/(?=^      - )/mu);
  const capture = blocks.find((block) => block.includes("name: product-experience-capture-"));
  const lifecycle = blocks.find((block) => block.includes("name: product-experience-lifecycle-"));
  assert(capture && lifecycle);
  const current = {
    capture_plan_path: "candidate/artifacts/sounding-line/product-experience-submission/plan.json",
    capture_manifest_path: "candidate/artifacts/sounding-line/product-experience-submission/capture.json",
    capture_activation_path: "candidate/artifacts/sounding-line/product-experience-submission/activation.json",
    capture_stage_path: `candidate/${staging}/current-only/capture`,
    capture_journal_path: `candidate/${publication}/current-only/journal.json`,
    capture_journal_failure_path: `candidate/${publication}/current-only/journal-failure.json`,
    capture_journal_pending_path: `candidate/${publication}/current-only/journal.*.pending`,
    capture_runtime_paths: [1, 2]
      .map(
        (index) => `candidate/artifacts/sounding-line/browser-diagnostics/current/scope-${index}/browser-runtime.json`,
      )
      .join("\n"),
    capture_profile_paths: [1, 2]
      .map(
        (index) =>
          `candidate/artifacts/sounding-line/browser-diagnostics/current/scope-${index}/browser-suite-profile.json`,
      )
      .join("\n"),
  };
  for (const outcome of ["success", "failure", "cancelled"]) {
    const actual = projectWorkflowUpload(capture, outcome, current);
    assert.equal(actual.enabled, true);
    assert.deepEqual(
      actual.paths,
      outcome === "success"
        ? [
            current.capture_manifest_path,
            current.capture_plan_path,
            current.capture_activation_path,
            `candidate/${canonical}/`,
            current.capture_journal_path,
          ]
        : [
            current.capture_plan_path,
            current.capture_stage_path,
            current.capture_journal_path,
            current.capture_journal_failure_path,
            current.capture_journal_pending_path,
          ],
    );
    const actualLifecycle = projectWorkflowUpload(lifecycle, outcome, current);
    assert.equal(actualLifecycle.enabled, true);
    assert.deepEqual(actualLifecycle.paths, [
      ...current.capture_runtime_paths.split("\n"),
      ...current.capture_profile_paths.split("\n"),
      current.capture_plan_path,
    ]);
    for (const file of [...actual.paths, ...actualLifecycle.paths]) {
      assert.equal(file.includes("**"), false);
      assert.equal(file.includes("stale"), false);
      assert(file === current.capture_journal_pending_path || !file.includes("*"));
    }
  }
  for (const block of [capture, lifecycle]) {
    assert.deepEqual(projectWorkflowUpload(block, "failure", {}), { enabled: false, paths: [] });
    assert.deepEqual(projectWorkflowUpload(block, "cancelled", { ...current, capture_plan_path: "" }), {
      enabled: false,
      paths: [],
    });
    assert.deepEqual(projectWorkflowUpload(block, "success", current, "review"), { enabled: false, paths: [] });
  }
});
