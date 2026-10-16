import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { withVerificationStage, observeVerificationFailure } from "./verification-diagnostics.mjs";
import { runBrowserAuthority, writeBrowserReceiptAndExit } from "./browser-authority.mjs";
import { browserSuiteProfiles } from "./browser-suite-profiles.mjs";
import {
  BROWSER_DIAGNOSTIC_CONTEXT,
  writeBrowserDiagnosticReceipt,
  readBrowserDiagnosticReceipt,
  createBrowserDiagnosticSession,
} from "./browser-diagnostics.mjs";
import { producePairedEvidence, sealPairedRuntime, validatePairedEvidence } from "./experience-paired.mjs";
import {
  assertExceptionExecution,
  claimExceptionPhase,
  CROSSDECK_R3,
  CROSSDECK_R6,
  CROSSDECK_R7,
  CROSSDECK_R8,
} from "./experience-exception.mjs";
import {
  experienceDigest,
  planProductExperience,
  REVIEW_DIMENSIONS,
  validateExperienceEvidence,
  validateExperienceArtifacts,
  artifactBytes,
  revisionJson,
} from "./product-experience.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_${code}`);
};
const relative = (root, file) => path.relative(root, file).replaceAll("\\", "/");
export const EXPERIENCE_VIEWPORTS = { DESKTOP: { width: 1440, height: 900 }, MOBILE: { width: 390, height: 844 } };

export function experienceChangedPaths(root, baseSha, candidateSha) {
  // Large reconciliations exceed Node's 1 MiB default. Retain the complete diff
  // within the same finite 64 MiB bound used by the experience source readers.
  // Overflow still throws; a truncated path list must never reach the planner.
  return execFileSync("git", ["diff", "--name-only", "--no-renames", baseSha, candidateSha], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .trim()
    .split(/\r?\n/u);
}

// Only the canonical sign-in prefix is reusable. Everything after it belongs
// to each fresh browser context, including tab-scoped device registration.
export function roleSetupAuthenticationResume(setup) {
  const prefix = [
    { action: "fill", role: "textbox", name: "Email or Player name" },
    { action: "fill", role: "textbox", name: "Password" },
    { action: "click", role: "button", name: "Sign in" },
  ];
  if (
    !Array.isArray(setup?.steps) ||
    prefix.some((expected, index) =>
      Object.entries(expected).some(([key, value]) => setup.steps[index]?.[key] !== value),
    ) ||
    typeof setup.entryPoint !== "string" ||
    !setup.entryPoint.startsWith("/") ||
    setup.entryPoint.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/u.test(setup.entryPoint)
  )
    return null;
  const origin = "https://experience.invalid";
  const entry = new URL(setup.entryPoint, origin);
  if (!["/sign-in", "/player/sign-in"].includes(entry.pathname)) return null;
  const values = [...entry.searchParams.getAll("returnTo"), ...entry.searchParams.getAll("return")];
  if (!values.length) return null;
  const destination = values[0];
  if (
    values.length !== 1 ||
    destination.length > 2048 ||
    !destination.startsWith("/") ||
    destination.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]|%(?:00|0[1-9a-f]|1[0-9a-f]|25|2f|3a|5c)/iu.test(destination)
  )
    return null;
  const resolved = new URL(destination, origin);
  if (resolved.origin !== origin || ["/sign-in", "/player/sign-in"].includes(resolved.pathname)) return null;
  return { stepCount: prefix.length, entryPoint: `${resolved.pathname}${resolved.search}${resolved.hash}` };
}

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
  const unobscuredActions = [];
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
        if (step.unobscured === true) {
          // Visibility and keyboard activation alone can pass beneath an overlay.
          // Check the settled viewport before any action scrolls or focuses it.
          const hit = await target.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const insetX = Math.min(box.width / 4, 12),
              insetY = Math.min(box.height / 4, 12);
            const points = [
              [box.left + box.width / 2, box.top + box.height / 2],
              [box.left + insetX, box.top + insetY],
              [box.right - insetX, box.top + insetY],
              [box.left + insetX, box.bottom - insetY],
              [box.right - insetX, box.bottom - insetY],
            ];
            return (
              box.width > 0 &&
              box.height > 0 &&
              box.top >= 0 &&
              box.left >= 0 &&
              box.bottom <= innerHeight &&
              box.right <= innerWidth &&
              points.every(([x, y]) => {
                const top = document.elementFromPoint(x, y);
                return Boolean(top && (element === top || element.contains(top)));
              })
            );
          });
          if (!hit) fail("PRIMARY_ACTION_OBSCURED");
          await target.click({ trial: true, timeout: 5000 });
          unobscuredActions.push({ role: step.role, name: step.name, viewportHitTest: true, trialClick: true });
        }
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
      ...(unobscuredActions.length ? { unobscuredActions } : {}),
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
  const exceptionLease = await assertExceptionExecution({ root, plan, kind: "experience" });
  if (exceptionLease)
    claimExceptionPhase({
      root,
      phase:
        plan.localProof === CROSSDECK_R3.id
          ? `r3-local-render-${plan.localProofMotionMode}`
          : plan.localProof === CROSSDECK_R8.id
            ? "r8-local-render"
            : plan.localProof === CROSSDECK_R7.id
              ? "r7-local-render"
              : plan.localProof === CROSSDECK_R6.id
                ? "r6-local-render"
                : "render",
      plan,
      runId: Number(process.env.GITHUB_RUN_ID),
    });
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
  const browser = plan.pairedOnly ? null : await chromium.launch({ headless: true });
  const evidence = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    ...(plan.exception
      ? { exception: plan.exception, exceptionPreparationReservation: exceptionLease.preparationReservation }
      : {}),
    ownerAcceptance: "NOT_CLAIMED",
    artifacts: [],
    journeys: [],
    reviews: [],
  };
  const authenticatedStates = new Map();
  try {
    for (const contract of plan.pairedOnly ? [] : plan.contracts) {
      for (const device of contract.experience.devices) {
        if (!EXPERIENCE_VIEWPORTS[device]) fail("VIEWPORT_UNSUPPORTED");
        for (const journey of contract.experience.journeys) {
          for (const role of journey.roles)
            for (const motionMode of plan.localProof === CROSSDECK_R3.id
              ? [plan.localProofMotionMode]
              : contract.experience.motion
                ? ["NORMAL", "REDUCED"]
                : ["REDUCED"]) {
              const diagnosticContext = { contractId: contract.id, journeyId: journey.id, device, role, motionMode };
              const progress = (event, operation) =>
                experienceDiagnostic(diagnosticStartedAt, event, diagnosticContext, operation);
              progress("context.start");
              const setup = role === "ANONYMOUS" ? null : contract.experience.roleSetup?.[role];
              const authenticationResume = roleSetupAuthenticationResume(setup);
              const authenticationKey = authenticationResume
                ? digest(Buffer.from(JSON.stringify({ role, entryPoint: setup.entryPoint, steps: setup.steps })))
                : null;
              const authenticatedState = authenticationKey ? authenticatedStates.get(authenticationKey) : null;
              let authenticatedEntryVerified = Boolean(authenticatedState);
              const context = await browser.newContext({
                baseURL,
                viewport: EXPERIENCE_VIEWPORTS[device],
                reducedMotion: motionMode === "REDUCED" ? "reduce" : "no-preference",
                recordVideo: { dir: artifactRoot },
                ...((authenticatedState ?? storageState) ? { storageState: authenticatedState ?? storageState } : {}),
              });
              await context.tracing.start({ screenshots: true, snapshots: true });
              const page = await context.newPage();
              try {
                if (role === "ANONYMOUS" && storageState) fail("ANONYMOUS_ROLE_STATE_MISMATCH");
                if (role !== "ANONYMOUS") {
                  if (!setup?.witness || (!storageState && !authenticatedState && !setup.steps?.length))
                    fail("ISOLATED_ROLE_FIXTURE_REQUIRED");
                  if (authenticatedState) {
                    progress("operation.start", { actionKind: "navigate-authenticated-entry" });
                    await page.goto(authenticationResume.entryPoint);
                    progress("operation.result", { actionKind: "navigate-authenticated-entry" });
                  } else {
                    progress("operation.start", { actionKind: "navigate-setup-entry" });
                    await page.goto(setup.entryPoint ?? contract.experience.entryPoint);
                    progress("operation.result", { actionKind: "navigate-setup-entry" });
                  }
                  const setupSteps = setup.steps ?? [];
                  for (
                    let stepIndex = authenticatedState ? authenticationResume.stepCount : 0;
                    stepIndex < setupSteps.length;
                    stepIndex++
                  ) {
                    const step = setupSteps[stepIndex];
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
                    if (
                      authenticationResume &&
                      !authenticatedState &&
                      stepIndex === authenticationResume.stepCount - 1
                    ) {
                      progress("operation.start", { stepIndex, actionKind: "wait-authenticated-destination" });
                      await page.waitForURL(
                        (destination) =>
                          destination.origin === url.origin &&
                          !["/sign-in", "/player/sign-in"].includes(destination.pathname),
                        { waitUntil: "domcontentloaded" },
                      );
                      const destination = new URL(page.url());
                      authenticatedEntryVerified =
                        `${destination.pathname}${destination.search}${destination.hash}` ===
                        authenticationResume.entryPoint;
                      progress("operation.result", { stepIndex, actionKind: "wait-authenticated-destination" });
                    }
                  }
                  progress("operation.start", { actionKind: "witness" });
                  await page
                    .getByRole(setup.witness.role, { name: setup.witness.name, exact: true })
                    .filter({ hasText: setup.witness.text })
                    .waitFor({ state: "visible" });
                  progress("operation.result", { actionKind: "witness" });
                  if (authenticationKey && !authenticatedState && authenticatedEntryVerified) {
                    const state = await context.storageState();
                    // Reuse only the authenticated cookies; each journey starts with fresh UI layout state.
                    authenticatedStates.set(authenticationKey, { cookies: state.cookies, origins: [] });
                  }
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
    await browser?.close();
  }
  const paired = await producePairedEvidence({ root, plan, baseURL, outputDirectory });
  if (paired) {
    evidence.artifacts.push(...paired.artifacts);
    evidence.pairedEvidence = paired.pairedEvidence;
  }
  await writeFile(path.join(artifactRoot, "capture.json"), JSON.stringify(evidence, null, 2) + "\n");
  await writeExperienceReviewPackets({ plan, evidence, artifactRoot });
  return evidence;
}
export async function writeExperienceReviewPackets({ plan, evidence, artifactRoot }) {
  for (const contract of plan.contracts) {
    const artifacts = evidence.artifacts.filter((artifact) => artifact.contractId === contract.id);
    const packet = {
      objective: contract.experience.objective,
      contract,
      sourceDigest: plan.sourceDigest,
      artifacts,
      ...(contract.experience.pairedEvidence ? { pairedEvidence: evidence.pairedEvidence } : {}),
      packetDigest: experienceDigest({
        sourceDigest: plan.sourceDigest,
        contract,
        artifacts: artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
        ...(contract.experience.pairedEvidence ? { pairedEvidence: evidence.pairedEvidence } : {}),
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
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  const root = path.resolve(options.workspace ?? process.cwd());
  if (options["run-server"]) {
    const plan = JSON.parse(await readFile(options["run-server"], "utf8"));
    await assertExceptionExecution({ root, plan, kind: "experience" });
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
    await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", receipt);
    await writeBrowserReceiptAndExit(receipt);
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
  const changedPaths = experienceChangedPaths(root, baseSha, candidateSha);
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
export async function runTrustedExperienceReplay({ root, plan, environment, validateReplay = true, diagnostics }) {
  const exceptionLease = await withVerificationStage("REPLAY_ADMISSION", () =>
    assertExceptionExecution({
      root,
      plan,
      kind: "experience",
      environment: { ...process.env, ...environment },
      claim: true,
    }),
  );
  if (!plan.applicable) return { status: "NOT_APPLICABLE" };
  if (plan.paired)
    diagnostics ??= createBrowserDiagnosticSession(root, {
      baseSha: plan.baseSha,
      candidateSha: plan.candidateSha,
      planDigest: experienceDigest(plan),
    });
  diagnostics?.clearScope();
  const replayPath = path.join(root, "artifacts/sounding-line/product-experience-plan.json");
  await withVerificationStage("REPLAY_PLAN_DIRECTORY", () => mkdir(path.dirname(replayPath), { recursive: true }));
  await withVerificationStage("REPLAY_PLAN_WRITE", () => writeFile(replayPath, JSON.stringify(plan)));
  const profiles = plan.pairedOnly
    ? ["generic"]
    : [...new Set(plan.contracts.map((contract) => contract.experience.fixtureProfile ?? "generic"))];
  const isolatedEnvironment = { ...process.env, ...environment };
  if (exceptionLease) isolatedEnvironment.SOUNDING_LINE_EXCEPTION_LEASE = exceptionLease.lease;
  delete isolatedEnvironment[BROWSER_DIAGNOSTIC_CONTEXT];
  delete isolatedEnvironment.GH_TOKEN;
  delete isolatedEnvironment.GITHUB_TOKEN;
  const combined = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    ...(plan.exception
      ? { exception: plan.exception, exceptionPreparationReservation: exceptionLease.preparationReservation }
      : {}),
    ownerAcceptance: "NOT_CLAIMED",
    artifacts: [],
    journeys: [],
    reviews: [],
  };
  const isolatedFixtures = [];
  for (const profile of profiles) {
    const diagnosticEnvironment = diagnostics?.beginScope();
    if (!browserSuiteProfiles[profile] || browserSuiteProfiles[profile].dedicatedRunner)
      fail("PROFILE_ADAPTER_REQUIRED");
    const outputDirectory = `${plan.outputDirectory ?? "artifacts/sounding-line/product-experience-replay"}/${profile}`;
    const scopedPlan = {
      ...plan,
      fixtureProfile: profile,
      outputDirectory,
      contracts: plan.contracts.filter((contract) => (contract.experience.fixtureProfile ?? "generic") === profile),
    };
    await withVerificationStage("REPLAY_PROFILE_PLAN_WRITE", () => writeFile(replayPath, JSON.stringify(scopedPlan)));
    const databaseUrl = experienceDatabaseUrl(root, plan.candidateSha, profile);
    isolatedFixtures.push({ profile, databaseSha256: digest(databaseUrl) });
    const result = await withVerificationStage("REPLAY_PROFILE_PROCESS", () =>
      spawnSync(
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
          env: { ...isolatedEnvironment, ...diagnosticEnvironment },
          stdio: "inherit",
        },
      ),
    );
    if (result.status !== 0)
      throw observeVerificationFailure(
        "REPLAY_PROFILE_PROCESS",
        new Error("PRODUCT_EXPERIENCE_TRUSTED_REPLAY_FAILED"),
        { cause: result.error ?? result },
      );
    const captured = await withVerificationStage("REPLAY_CAPTURE_READ", async () =>
      JSON.parse(await readFile(path.join(root, outputDirectory, "capture.json"), "utf8")),
    );
    if (captured.pairedEvidence) {
      if (combined.pairedEvidence) fail("PAIRED_DUPLICATE_EXECUTION");
      const receiptEnvironment = { ...process.env, ...diagnosticEnvironment };
      await withVerificationStage("REPLAY_PAIRED_SEAL", async () =>
        sealPairedRuntime({
          root,
          evidence: captured,
          outputDirectory,
          runtime: await readBrowserDiagnosticReceipt(root, "browser-runtime.json", receiptEnvironment),
          profile: await readBrowserDiagnosticReceipt(root, "browser-suite-profile.json", receiptEnvironment),
        }),
      );
      combined.pairedEvidence = captured.pairedEvidence;
      await withVerificationStage("REPLAY_CAPTURE_WRITE", () =>
        writeFile(path.join(root, outputDirectory, "capture.json"), JSON.stringify(captured, null, 2) + "\n"),
      );
      await withVerificationStage("REPLAY_PAIRED_PACKETS", () =>
        writeExperienceReviewPackets({
          plan: scopedPlan,
          evidence: captured,
          artifactRoot: path.join(root, outputDirectory),
        }),
      );
    }
    combined.artifacts.push(...captured.artifacts);
    combined.journeys.push(...captured.journeys);
  }
  const capturePath = path.join(
    root,
    plan.outputDirectory ?? "artifacts/sounding-line/product-experience-replay",
    "capture.json",
  );
  // Capture preparation deliberately omits human review validation. Paired case
  // completeness and terminal cleanup are still mandatory before publication.
  if (plan.paired) {
    await withVerificationStage("REPLAY_PAIRED_VALIDATE", () => {
      validateExperienceArtifacts({ root, plan, evidence: combined });
      validatePairedEvidence({ root, plan, evidence: combined, read: (file) => artifactBytes({ root, file }) });
    });
  }
  await withVerificationStage("REPLAY_CAPTURE_WRITE", () =>
    writeFile(capturePath, JSON.stringify(combined, null, 2) + "\n"),
  );
  await withVerificationStage("REPLAY_REVIEW_PACKETS", () =>
    writeExperienceReviewPackets({ plan, evidence: combined, artifactRoot: path.dirname(capturePath) }),
  );
  if (validateReplay) {
    combined.reviews = plan.evidencePath
      ? (revisionJson(root, plan.candidateSha, plan.evidencePath, true)?.reviews ?? [])
      : [];
    await withVerificationStage("REPLAY_EVIDENCE_VALIDATE", () =>
      validateExperienceEvidence({ root, plan, evidence: combined, automatedOnly: true }),
    );
  }
  return {
    status: "PASS",
    sourceDigest: plan.sourceDigest,
    profiles,
    capturePath,
    ...(plan.localProof === CROSSDECK_R3.id ? { isolatedFixtures } : {}),
  };
}
export function experienceDatabaseUrl(root, candidateSha, profile, now = new Date()) {
  const stamp = now.toISOString().replaceAll(/[-:TZ.]/gu, "");
  const filename = `validation-isolated-${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(16).toString("hex")}.db`;
  return `file:${path.join(root, "artifacts/sounding-line", `${profile}-${candidateSha.slice(0, 12)}`, filename).replaceAll("\\", "/")}`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
