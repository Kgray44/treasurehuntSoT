import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runBrowserAuthority } from "./browser-authority.mjs";
import { browserSuiteProfiles } from "./browser-suite-profiles.mjs";
import {
  experienceDigest,
  planProductExperience,
  REVIEW_DIMENSIONS,
  validateExperienceEvidence,
  revisionJson,
} from "./product-experience.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_${code}`);
};
const relative = (root, file) => path.relative(root, file).replaceAll("\\", "/");
export const EXPERIENCE_VIEWPORTS = { DESKTOP: { width: 1440, height: 900 }, MOBILE: { width: 390, height: 844 } };

function experienceDiagnostic(startedAt, event, context, { stepIndex, actionKind } = {}) {
  try {
    const safeId = (value) =>
      typeof value === "string" && value.length <= 160 && /^[A-Za-z0-9_.-]+$/u.test(value) ? value : null;
    const record = {
      namespace: "SOUNDING_LINE_DIAGNOSTIC",
      version: 1,
      component: "experience-browser",
      event,
      utc: new Date().toISOString(),
      elapsedMs: Number(Math.max(0, performance.now() - startedAt).toFixed(3)),
      contractId: safeId(context.contractId),
      journeyId: safeId(context.journeyId),
      device: safeId(context.device),
      role: safeId(context.role),
      motionMode: safeId(context.motionMode),
    };
    if (Number.isSafeInteger(stepIndex) && stepIndex >= 0) record.stepIndex = stepIndex;
    if (actionKind) record.actionKind = actionKind;
    // Never include setup values, labels, URLs, storage state or error text.
    console.error(JSON.stringify(record));
  } catch {
    // Diagnostics cannot replace or change capture/evidence behavior.
  }
}

// Use semantic visible controls. API setup may provision identities/data; it
// cannot replace entry, action, destination, or return-path proof.
export async function runExperienceJourney({
  page,
  contract,
  journey,
  device,
  artifactRoot,
  root,
  role = "ANONYMOUS",
  motionMode = "REDUCED",
  accessibilityCheck,
}) {
  const captures = [];
  const observations = [];
  const stateAccessibility = [];
  const outcomeContinuity = [];
  let visibleActions = 0;
  let maximumFeedbackMs = 0;
  let returnPathVerified = false;
  let observedDeparture = false;
  let actionPredicates = new Map();
  const predicateSatisfied = async (step) => {
    const target = page.getByRole(step.role, { name: step.name, exact: true });
    if (!(await target.isVisible()) || (step.path && new URL(page.url()).pathname !== step.path)) return false;
    if (step.text && !(await target.innerText()).toLowerCase().includes(step.text.toLowerCase())) return false;
    if (
      step.absentRole &&
      (await page.getByRole(step.absentRole.role, { name: step.absentRole.name, exact: true }).isVisible())
    )
      return false;
    return true;
  };
  let actionStarted = null;
  const readContinuity = async (stage = "entry") =>
    Promise.all(
      (contract.experience.continuity?.checks ?? []).map(async (check) => {
        const selector = stage === "outcome" ? (check.destination ?? check) : check;
        const value = await page
          .getByRole(selector.role, { name: selector.name, exact: true })
          .getAttribute(selector.attribute);
        if (!value) fail("CONTINUITY_OBSERVATION_MISSING");
        return { id: check.id, digest: digest(Buffer.from(value)) };
      }),
    );
  const beforeContinuity = await readContinuity();
  for (const [index, step] of journey.steps.entries()) {
    if (step.action === "keyboard") {
      await page.keyboard.press(step.key);
      if (step.expectFocus) {
        const target = page.getByRole(step.expectFocus.role, { name: step.expectFocus.name, exact: true });
        if (!(await target.evaluate((element) => element === document.activeElement))) fail("KEYBOARD_FOCUS_FAILED");
      }
    } else {
      const target = page.getByRole(step.role, { name: step.name, exact: true });
      await target.waitFor({ state: "visible" });
      if (step.action === "click") {
        actionPredicates = new Map();
        for (let following = index + 1; following < journey.steps.length; following++) {
          const predicate = journey.steps[following];
          if (predicate.action === "click" || predicate.action === "fill") break;
          if (predicate.action === "assert") actionPredicates.set(following, await predicateSatisfied(predicate));
        }
        let reachable = await target.evaluate((element) => element === document.activeElement);
        for (let attempt = 0; attempt < 128 && !reachable; attempt++) {
          await page.keyboard.press("Tab");
          reachable = await target.evaluate((element) => element === document.activeElement);
        }
        if (!reachable) fail("KEYBOARD_REACHABILITY_FAILED");
        // Keyboard activation proves the ordinary action is not pointer-only.
        actionStarted = performance.now();
        await target.press("Enter");
        visibleActions++;
      } else if (step.action === "fill") {
        await target.fill(step.value);
      } else if (step.action === "assert") {
        if (step.path) {
          try {
            await page.waitForURL((url) => url.pathname === step.path, { timeout: 5000 });
          } catch {
            fail("JOURNEY_DESTINATION_FAILED");
          }
        }
        if (step.text) {
          try {
            await target.filter({ hasText: step.text }).waitFor({ state: "visible", timeout: 5000 });
          } catch {
            fail("USER_OUTCOME_FAILED");
          }
        }
        if (
          step.absentRole &&
          (await page.getByRole(step.absentRole.role, { name: step.absentRole.name, exact: true }).isVisible())
        )
          fail("ROLE_EXPERIENCE_MISSING");
        if (step.path && new URL(page.url()).pathname !== step.path) fail("JOURNEY_DESTINATION_FAILED");
        const changed = actionPredicates.has(index) && !actionPredicates.get(index) && (await predicateSatisfied(step));
        if (changed && step.kind === "outcome") observedDeparture = true;
        if (step.kind === "outcome" && !changed)
          fail(
            `ACTION_OUTCOME_NOT_OBSERVED:${journey.id}.${index}:before-${actionPredicates.get(index)}:after-${await predicateSatisfied(step)}`,
          );
        if (step.returnPath && step.path) {
          if (!observedDeparture || step.kind === "outcome" || !changed) fail("RETURN_WITHOUT_DEPARTURE");
          returnPathVerified = true;
        }
        if (step.kind === "outcome") outcomeContinuity.push(await readContinuity("outcome"));
        if (step.kind === "outcome")
          observations.push({
            step: index,
            meaning: step.meaning,
            role: step.role,
            name: step.name,
            text: step.text ?? null,
          });
      }
    }
    if (step.feedbackBoundary) {
      if (actionStarted === null || step.action !== "assert") fail("FEEDBACK_BOUNDARY_INVALID");
      maximumFeedbackMs = Math.max(maximumFeedbackMs, performance.now() - actionStarted);
      actionStarted = null;
    }
    if (step.state) {
      if (accessibilityCheck) stateAccessibility.push({ state: step.state, ...(await accessibilityCheck()) });
      const id = `${contract.id}-${journey.id}-${device}-${role}-${motionMode}-${step.state}-${index}`;
      const file = path.join(artifactRoot, `${id.replaceAll(/[^a-zA-Z0-9_.-]/gu, "-")}.png`);
      // Capture the view actually used by this journey. Chromium's beyond-viewport
      // capture temporarily resizes the page to 1x1 and can invalidate live context.
      // Recordings retain the journey's navigation and scrolling evidence.
      await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
      captures.push({
        id,
        path: relative(root, file),
        sha256: digest(await readFile(file)),
        type: "screenshot",
        origin: "ACTUAL_APPLICATION",
        contractId: contract.id,
        state: step.state,
        device,
        role,
        motionMode,
      });
    }
  }
  if (!observations.length || !returnPathVerified || !visibleActions) fail("SEMANTIC_JOURNEY_FAILED");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const afterContinuity = await readContinuity();
  const continuity = beforeContinuity.map((before, index) => ({
    id: before.id,
    before: before.digest,
    atOutcomes: outcomeContinuity.map((values) => values.find((value) => value.id === before.id)?.digest),
    after: afterContinuity[index]?.digest,
  }));
  if (
    continuity.some(
      (observation) =>
        observation.before !== observation.after ||
        observation.atOutcomes.some((value) => value !== observation.before),
    )
  )
    fail("CROSS_PROJECT_JOURNEY_FAILED");
  const reducedMotion = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return {
    captures,
    result: {
      id: journey.id,
      contractId: contract.id,
      device,
      role,
      motionMode,
      entryPoint: contract.experience.entryPoint,
      outcome: journey.outcome,
      observations,
      visibleActions,
      returnPathVerified,
      status: "PASS",
      continuity,
      feedbackMs: maximumFeedbackMs,
      measurement: contract.experience.motion?.measurement ?? null,
      accessibility: {
        keyboard: visibleActions > 0,
        focus: visibleActions > 0,
        reducedMotion,
        motionPreferenceVerified: reducedMotion === (motionMode === "REDUCED"),
        overflow: overflow || stateAccessibility.some((state) => state.overflow),
        states: stateAccessibility,
      },
    },
  };
}

export async function captureProductExperience({ root, plan, baseURL, outputDirectory, storageState }) {
  if (!plan.applicable) return { status: "NOT_APPLICABLE" };
  const diagnosticStartedAt = performance.now();
  const url = new URL(baseURL);
  if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(url.hostname)) fail("TASK_OWNED_LOOPBACK_REQUIRED");
  const require = createRequire(path.join(root, "package.json"));
  const { chromium } = require("playwright");
  const AxeBuilder = require("@axe-core/playwright").default;
  const artifactRoot = path.resolve(root, outputDirectory);
  if (!artifactRoot.startsWith(path.resolve(root) + path.sep)) fail("ARTIFACT_PATH_INVALID");
  await mkdir(artifactRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const evidence = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    ownerAcceptance: "NOT_CLAIMED",
    artifacts: [],
    journeys: [],
    reviews: [],
  };
  try {
    for (const contract of plan.contracts) {
      for (const device of contract.experience.devices) {
        if (!EXPERIENCE_VIEWPORTS[device]) fail("VIEWPORT_UNSUPPORTED");
        for (const journey of contract.experience.journeys) {
          for (const role of journey.roles)
            for (const motionMode of contract.experience.motion ? ["NORMAL", "REDUCED"] : ["REDUCED"]) {
              const diagnosticContext = { contractId: contract.id, journeyId: journey.id, device, role, motionMode };
              const progress = (event, operation) =>
                experienceDiagnostic(diagnosticStartedAt, event, diagnosticContext, operation);
              progress("context.start");
              const context = await browser.newContext({
                baseURL,
                viewport: EXPERIENCE_VIEWPORTS[device],
                reducedMotion: motionMode === "REDUCED" ? "reduce" : "no-preference",
                recordVideo: { dir: artifactRoot },
                ...(storageState ? { storageState } : {}),
              });
              await context.tracing.start({ screenshots: true, snapshots: true });
              const page = await context.newPage();
              try {
                if (role === "ANONYMOUS" && storageState) fail("ANONYMOUS_ROLE_STATE_MISMATCH");
                if (role !== "ANONYMOUS") {
                  const setup = contract.experience.roleSetup?.[role];
                  if (!setup?.witness || (!storageState && !setup.steps?.length))
                    fail("ISOLATED_ROLE_FIXTURE_REQUIRED");
                  progress("operation.start", { actionKind: "navigate-setup-entry" });
                  await page.goto(setup.entryPoint ?? contract.experience.entryPoint);
                  progress("operation.result", { actionKind: "navigate-setup-entry" });
                  let stepIndex = 0;
                  for (const step of setup.steps ?? []) {
                    const target = page.getByRole(step.role, { name: step.name, exact: true });
                    if (step.action === "fill") {
                      progress("operation.start", { stepIndex, actionKind: "fill" });
                      await target.fill(step.valueFrom ? process.env[step.valueFrom] : step.value);
                      progress("operation.result", { stepIndex, actionKind: "fill" });
                    } else if (step.action === "click") {
                      progress("operation.start", { stepIndex, actionKind: "click" });
                      await target.click();
                      progress("operation.result", { stepIndex, actionKind: "click" });
                    } else {
                      progress("operation.start", { stepIndex, actionKind: "wait" });
                      await target.waitFor({ state: "visible" });
                      progress("operation.result", { stepIndex, actionKind: "wait" });
                    }
                    stepIndex += 1;
                  }
                  progress("operation.start", { actionKind: "witness" });
                  await page
                    .getByRole(setup.witness.role, { name: setup.witness.name, exact: true })
                    .filter({ hasText: setup.witness.text })
                    .waitFor({ state: "visible" });
                  progress("operation.result", { actionKind: "witness" });
                }
                progress("operation.start", { actionKind: "navigate-journey-entry" });
                await page.goto(contract.experience.entryPoint);
                progress("operation.result", { actionKind: "navigate-journey-entry" });
                const observed = await runExperienceJourney({
                  page,
                  contract,
                  journey,
                  device,
                  artifactRoot,
                  root,
                  role,
                  motionMode,
                  accessibilityCheck: async () => {
                    const a11y = await new AxeBuilder({ page }).analyze();
                    return {
                      axeSerious: a11y.violations
                        .filter((violation) => ["critical", "serious"].includes(violation.impact))
                        .map((violation) => violation.id),
                      overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
                    };
                  },
                });
                const a11y = await new AxeBuilder({ page }).analyze();
                observed.result.roleVerified = true;
                observed.result.accessibility.axeSerious = [
                  ...new Set([
                    ...observed.result.accessibility.states.flatMap((state) => state.axeSerious),
                    ...a11y.violations
                      .filter((violation) => ["critical", "serious"].includes(violation.impact))
                      .map((violation) => violation.id),
                  ]),
                ];
                evidence.artifacts.push(...observed.captures);
                evidence.journeys.push(observed.result);
                const tracePath = path.join(
                  artifactRoot,
                  `${contract.id}-${journey.id}-${device}-${role}-${motionMode}.trace.zip`,
                );
                await context.tracing.stop({ path: tracePath });
                evidence.artifacts.push({
                  id: `${contract.id}-${journey.id}-${device}-${role}-${motionMode}-trace`,
                  path: relative(root, tracePath),
                  sha256: digest(await readFile(tracePath)),
                  type: "trace",
                  origin: "ACTUAL_APPLICATION",
                  contractId: contract.id,
                  device,
                  role,
                  motionMode,
                });
                const video = page.video();
                await context.close();
                const videoPath = await video.path();
                evidence.artifacts.push({
                  id: `${contract.id}-${journey.id}-${device}-${role}-${motionMode}-recording`,
                  path: relative(root, videoPath),
                  sha256: digest(await readFile(videoPath)),
                  type: "recording",
                  origin: "ACTUAL_APPLICATION",
                  contractId: contract.id,
                  device,
                  role,
                  motionMode,
                });
              } finally {
                await context.close();
              }
              progress("context.result");
            }
        }
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(artifactRoot, "capture.json"), JSON.stringify(evidence, null, 2) + "\n");
  for (const contract of plan.contracts) {
    const artifacts = evidence.artifacts.filter((artifact) => artifact.contractId === contract.id);
    const packet = {
      objective: contract.experience.objective,
      contract,
      sourceDigest: plan.sourceDigest,
      artifacts,
      packetDigest: experienceDigest({
        sourceDigest: plan.sourceDigest,
        contract,
        artifacts: artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
      }),
      instructions:
        "Inspect rendered images and recordings before source. Record concrete evidence for every dimension. Builder rationale is intentionally excluded. Return review JSON; do not infer owner acceptance.",
      reviewDimensions: REVIEW_DIMENSIONS,
      builderRationaleIncluded: false,
    };
    await writeFile(
      path.join(artifactRoot, `${contract.id}-review-packet.json`),
      JSON.stringify(packet, null, 2) + "\n",
    );
  }
  return evidence;
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const { execFileSync } = await import("node:child_process");
  const root = path.resolve(options.workspace ?? process.cwd());
  if (options["run-server"]) {
    const plan = JSON.parse(await readFile(options["run-server"], "utf8"));
    const profile = browserSuiteProfiles[plan.fixtureProfile ?? "generic"];
    if (!profile || profile.dedicatedRunner) fail("PROFILE_ADAPTER_REQUIRED");
    const receipt = await runBrowserAuthority({
      root,
      browserArguments: [],
      browserScriptArguments: [fileURLToPath(import.meta.url), "--workspace", root, "--replay", options["run-server"]],
      fixtureArguments: profile.fixtureArguments ?? [],
      fixtureProject: profile.fixtureProject ?? "chromium",
      environment: process.env,
    });
    if (receipt.failureCategory) fail(`TRUSTED_REPLAY_FAILED:${receipt.failureCode}`);
    return;
  }
  if (options.replay) {
    const plan = JSON.parse(await readFile(options.replay, "utf8"));
    await captureProductExperience({
      root,
      plan,
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
      outputDirectory: plan.outputDirectory ?? "artifacts/sounding-line/product-experience-replay",
    });
    return;
  }
  const baseSha = options.base;
  const candidateSha = options.candidate;
  if (!baseSha || !candidateSha) fail("EXACT_SOURCE_REQUIRED");
  const changedPaths = execFileSync("git", ["diff", "--name-only", "--no-renames", baseSha, candidateSha], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/u);
  const plan = planProductExperience({ root, baseSha, candidateSha, changedPaths });
  if (options.plan) {
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return;
  }
  const evidence = await captureProductExperience({
    root,
    plan,
    baseURL: options.url,
    outputDirectory: options.output ?? "Development_Docs/Testing/Product_Experience/evidence",
    storageState: options["storage-state"],
  });
  process.stdout.write(
    JSON.stringify({ status: "CAPTURED_REVIEW_REQUIRED", captures: evidence.artifacts?.length ?? 0 }) + "\n",
  );
}
export async function runTrustedExperienceReplay({ root, plan, environment, validateReplay = true }) {
  if (!plan.applicable) return { status: "NOT_APPLICABLE" };
  const replayPath = path.join(root, "artifacts/sounding-line/product-experience-plan.json");
  await mkdir(path.dirname(replayPath), { recursive: true });
  await writeFile(replayPath, JSON.stringify(plan));
  const profiles = [...new Set(plan.contracts.map((contract) => contract.experience.fixtureProfile ?? "generic"))];
  const isolatedEnvironment = { ...process.env, ...environment };
  delete isolatedEnvironment.GH_TOKEN;
  delete isolatedEnvironment.GITHUB_TOKEN;
  const combined = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    ownerAcceptance: "NOT_CLAIMED",
    artifacts: [],
    journeys: [],
    reviews: [],
  };
  for (const profile of profiles) {
    if (!browserSuiteProfiles[profile] || browserSuiteProfiles[profile].dedicatedRunner)
      fail("PROFILE_ADAPTER_REQUIRED");
    const outputDirectory = `${plan.outputDirectory ?? "artifacts/sounding-line/product-experience-replay"}/${profile}`;
    const scopedPlan = {
      ...plan,
      fixtureProfile: profile,
      outputDirectory,
      contracts: plan.contracts.filter((contract) => (contract.experience.fixtureProfile ?? "generic") === profile),
    };
    await writeFile(replayPath, JSON.stringify(scopedPlan));
    const databaseUrl = experienceDatabaseUrl(root, plan.candidateSha, profile);
    const result = spawnSync(
      process.execPath,
      [
        path.join(path.dirname(fileURLToPath(import.meta.url)), "run-browser-suite.mjs"),
        "--profile",
        profile,
        "--candidate",
        plan.candidateSha,
        "--database-url",
        databaseUrl,
        "--experience-plan",
        replayPath,
        "--experience-runner",
        fileURLToPath(import.meta.url),
      ],
      {
        cwd: root,
        env: isolatedEnvironment,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) fail("TRUSTED_REPLAY_FAILED");
    const captured = JSON.parse(await readFile(path.join(root, outputDirectory, "capture.json"), "utf8"));
    combined.artifacts.push(...captured.artifacts);
    combined.journeys.push(...captured.journeys);
  }
  const capturePath = path.join(
    root,
    plan.outputDirectory ?? "artifacts/sounding-line/product-experience-replay",
    "capture.json",
  );
  await writeFile(capturePath, JSON.stringify(combined, null, 2) + "\n");
  if (validateReplay) {
    combined.reviews = plan.evidencePath
      ? (revisionJson(root, plan.candidateSha, plan.evidencePath, true)?.reviews ?? [])
      : [];
    validateExperienceEvidence({ root, plan, evidence: combined, automatedOnly: true });
  }
  return { status: "PASS", sourceDigest: plan.sourceDigest, profiles, capturePath };
}
export function experienceDatabaseUrl(root, candidateSha, profile, now = new Date()) {
  const stamp = now.toISOString().replaceAll(/[-:TZ.]/gu, "");
  const filename = `validation-isolated-${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(16).toString("hex")}.db`;
  return `file:${path.join(root, "artifacts/sounding-line", `${profile}-${candidateSha.slice(0, 12)}`, filename).replaceAll("\\", "/")}`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
