// Source-generated modeled boundary fixtures only. No captured application/archive bytes,
// protected record, reservation, accepted product verdict or external artifact is used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { writeExperienceReviewPackets } from "../../../scripts/sounding-line/experience-browser.mjs";
import {
  PAIRED_CASES,
  PAIRED_CONTRACTS,
  planPairedEvidence,
  producePairedEvidence,
  sealPairedRuntime,
} from "../../../scripts/sounding-line/experience-paired.mjs";
import { experienceDigest } from "../../../scripts/sounding-line/product-experience.mjs";

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

async function completedCapture({ root, plan, rawOutputDirectory, runPaired = fakePairedRun }) {
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
    run: runPaired,
    rawOutputDirectory,
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
  const owned = mkdtempSync(path.join(parent, "capture-"));
  const workingDirectory = `${relative(f.root, owned)}/capture`;
  mkdirSync(path.join(f.root, workingDirectory));
  const replay = await completedCapture({ root: f.root, plan: { ...f.plan, outputDirectory: workingDirectory } });
  return { ...f, workingDirectory, journalDirectory: `${publication}/fixture`, replay };
}

export {
  identity,
  publicationJsonFiles,
  genericContexts,
  canonical,
  staging,
  publication,
  evidencePath,
  historicalSentinel,
  immutableSentinel,
  contractIds,
  hash,
  json,
  relative,
  write,
  readJson,
  webm,
  trace,
  fixture,
  completedCapture,
  staged,
  snapshot,
  fakePairedRun,
};
