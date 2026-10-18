// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.admiralty.controls
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  createReachTelemetryReport,
  observeReachHistogram,
  reachTelemetrySubmissionSchema,
  reachTimingUpperBoundsMs,
  reachRateUpperBoundsHz,
  reachErrorUpperBounds,
  reachConfidenceUpperBounds,
  reachCorrelationUpperBounds,
  reachUncertaintyUpperBoundsPx,
  MAX_REACH_TELEMETRY_ACTIVE_MS,
} from "../../src/reach/telemetry";

type Fixture = {
  classification: "TASK_OWNED_SYNTHETIC_REACH_ADMIN";
  baseURL: string;
  databasePath: string;
  admin: { email: string; password: string };
  observer: { email: string; password: string };
};
let fixture: Fixture;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  if (
    process.env.REACH_ADMIRALTY_ISOLATED !== "1" ||
    !process.env.REACH_ADMIRALTY_TASK_ROOT ||
    !process.env.REACH_ADMIRALTY_CREDENTIALS
  )
    throw new Error(
      "Reach Admiralty browser proof requires its explicit isolated task database and private credentials.",
    );
  const root = path.resolve(process.env.REACH_ADMIRALTY_TASK_ROOT);
  const credentialPath = path.resolve(process.env.REACH_ADMIRALTY_CREDENTIALS);
  if (!credentialPath.startsWith(`${root}${path.sep}`))
    throw new Error("Private fixture credentials must remain inside the isolated task root.");
  fixture = JSON.parse(await readFile(credentialPath, "utf8")) as Fixture;
  const database = path.resolve(fixture.databasePath);
  if (fixture.classification !== "TASK_OWNED_SYNTHETIC_REACH_ADMIN" || !database.startsWith(`${root}${path.sep}`))
    throw new Error("An isolated synthetic Reach database is required; live preview databases are forbidden.");
});
test.beforeEach(async ({}, info) => {
  const configured = new URL(String(info.project.use.baseURL));
  const approved = new URL(fixture.baseURL);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname) ||
    configured.port === "3137" ||
    configured.origin !== approved.origin
  )
    throw new Error(
      "This suite may only use its explicitly provisioned isolated loopback server, never the owner3137 preview.",
    );
});
async function signIn(page: Page, account: Fixture["admin"]) {
  await page.goto("/sign-in?returnTo=%2Fadmin");
  await page.getByLabel("Email or Player name", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
  await page.locator('nav[aria-label="Admiralty navigation"] a[href="/admin/reach"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/reach");
  await expect(page.getByRole("heading", { name: "Reach", exact: true })).toBeVisible();
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).include('[data-reach-admin="canonical"]').analyze();
  expect(result.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: false });
}
// Deliberate synthetic numeric fixture, never camera evidence or fleet measurements.
function syntheticNumericReport(revision: number) {
  const report = createReachTelemetryReport(revision);
  report.activity = {
    activeMs: 60000,
    focusedMs: 55000,
    calibrationCollectingMs: 15000,
    normalMs: 40000,
    calibrationMs: 20000,
    droppedActivityMs: 500,
  };
  report.model = {
    packets: 120,
    accepted: 112,
    late: 6,
    invalid: 2,
    noHand: 10,
    multipleHands: 3,
    postureEligible: 85,
    handCountMissing: 8,
  };
  report.image = { unseeded: 3, tracking: 95, uncertain: 10, lost: 4, stale: 8 };
  report.readiness = {
    ready: 80,
    acquiring: 5,
    recovering: 7,
    noHand: 10,
    ambiguous: 3,
    framing: 2,
    geometry: 2,
    posture: 2,
    modelWaiting: 6,
    paused: 3,
  };
  report.events = {
    pauses: 3,
    recoveries: 2,
    sourceInvalidations: 1,
    trackingInterruptions: 4,
    manualHints: 1,
    cameraStarts: 1,
    cameraStops: 1,
  };
  for (const [key, histogram] of Object.entries(report.timings))
    for (const value of key === "imageAnalysisMs" ? [null, null] : [12, 48, 90, 140, 210, null])
      observeReachHistogram(histogram, reachTimingUpperBoundsMs, value);
  for (const hz of [10, 15, 15]) observeReachHistogram(report.rates.normalAchievedHz, reachRateUpperBoundsHz, hz);
  for (const hz of [15, 25, 30]) observeReachHistogram(report.rates.calibrationAchievedHz, reachRateUpperBoundsHz, hz);
  observeReachHistogram(report.rates.normalCapMs, reachRateUpperBoundsHz, 15, 40000, MAX_REACH_TELEMETRY_ACTIVE_MS);
  observeReachHistogram(
    report.rates.calibrationCapMs,
    reachRateUpperBoundsHz,
    60,
    20000,
    MAX_REACH_TELEMETRY_ACTIVE_MS,
  );
  for (const value of [0.88, 0.96])
    observeReachHistogram(report.imageQuality.correlation, reachCorrelationUpperBounds, value);
  observeReachHistogram(report.imageQuality.separation, reachErrorUpperBounds, 0.08);
  observeReachHistogram(report.imageQuality.uncertaintyPx, reachUncertaintyUpperBoundsPx, 2);
  for (const value of [0.89, 0.95])
    observeReachHistogram(report.confidence.handedness.histogram, reachConfidenceUpperBounds, value);
  report.confidence.handedness.count = 2;
  report.confidence.handedness.sum = 1.84;
  for (const mode of ["ABSOLUTE", "RELATIVE"] as const) {
    const c = report.calibration[mode];
    c.trainingStarted = c.trainingCompleted = 1;
    c.trainingTargetsSaved = mode === "ABSOLUTE" ? 9 : 5;
    c.checkStarted = mode === "ABSOLUTE" ? 2 : 1;
    c.checkPassed = 1;
    c.checkFailed = mode === "ABSOLUTE" ? 1 : 0;
    c.checkTargetsSaved = c.checkStarted * 5;
    for (const value of [0.01, 0.015, 0.02, 0.025, 0.04]) {
      observeReachHistogram(c.validationRawErrors, reachErrorUpperBounds, value);
      observeReachHistogram(c.validationJitter, reachErrorUpperBounds, value / 2);
      observeReachHistogram(c.trainingResiduals, reachErrorUpperBounds, value / 3);
    }
    observeReachHistogram(c.checkRawP95, reachErrorUpperBounds, 0.025);
    if (c.checkFailed) observeReachHistogram(c.checkRawP95, reachErrorUpperBounds, 0.04);
    observeReachHistogram(c.checkJitterP95, reachErrorUpperBounds, 0.015);
    observeReachHistogram(c.checkMedian, reachErrorUpperBounds, 0.02);
  }
  report.droppedEvents = 2;
  return reachTelemetrySubmissionSchema.parse({ idempotencyKey: randomUUID(), reportVersion: 1, report });
}

test("operator naturally reviews Reach reports and applies an assured revisioned model/capture policy", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, fixture.admin);
  await expect(page.getByText("Retained aggregate reports", { exact: true })).toBeVisible();
  await expect(page.getByText("Distinct people", { exact: true })).toBeVisible();
  await expect(page.getByText("No aggregate reports in this window", { exact: true })).toBeVisible();
  await accessible(page);
  await capture(page, info, "SYNTHETIC-reach-admin-empty-desktop");
  const initialPolicy = await (await page.request.get("/api/reach/policy")).json();
  const contribution = syntheticNumericReport(initialPolicy.revision);
  const ingested = await page.request.post("/api/reach/telemetry", {
    headers: { Origin: new URL(fixture.baseURL).origin },
    data: contribution,
  });
  expect(ingested.status()).toBe(202);
  await info.attach("SYNTHETIC-numeric-fixture-not-physical-or-fleet-evidence", {
    contentType: "application/json",
    body: JSON.stringify({ classification: "SYNTHETIC", report: contribution.report }),
  });
  await page.getByRole("button", { name: "Refresh Reach overview" }).click();
  await expect(page.getByText(/1 matching reports; 1 were aggregated/)).toBeVisible();
  await expect(page.getByText("No aggregate reports in this window", { exact: true })).toHaveCount(0);
  await capture(page, info, "SYNTHETIC-reach-admin-populated-desktop");
  await page.getByRole("heading", { name: "Detection and activity" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-counters-desktop");
  await page.getByRole("button", { name: "Performance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Performance distributions" })).toBeVisible();
  await page.getByRole("heading", { name: "Performance distributions" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-performance-desktop");
  await page.getByRole("figure", { name: "Model handedness classification score" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-classification-score-desktop");
  await page.getByRole("button", { name: "Calibration", exact: true }).click();
  await expect(page.getByText(/raw held-out 95th-percentile error limit remains 3%/)).toBeVisible();
  await page.getByRole("heading", { name: "Calibration and independent checks" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-calibration-desktop");
  await page.getByRole("button", { name: "Runtime policy", exact: true }).click();
  await page.getByLabel("Normal tracking ceiling (Hz)").fill("10");
  await page.getByLabel("Hand model inference ceiling (Hz)").fill("20");
  await page.getByLabel("Reason for policy change").fill("Tune the isolated synthetic Reach browser fixture");
  const preview = page.getByRole("button", { name: "Preview Reach policy" });
  await expect(preview).toBeDisabled();
  await page.getByLabel("Current password", { exact: true }).fill(fixture.admin.password);
  await page.getByRole("button", { name: "Verify identity", exact: true }).click();
  await expect(preview).toBeEnabled();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  await preview.click();
  await expect(page.getByRole("heading", { name: "Review Reach policy change" })).toBeVisible();
  const apply = page.getByRole("button", { name: "Confirm and apply Reach policy" });
  await expect(apply).toBeDisabled();
  await page.getByRole("heading", { name: "Review Reach policy change" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-policy-preview-desktop");
  await page.getByLabel("I reviewed the policy and its effect on all Reach clients.").check();
  await apply.click();
  await expect(page.getByRole("status").filter({ hasText: /Receipt/ })).toBeVisible();
  await page
    .getByRole("status")
    .filter({ hasText: /Receipt/ })
    .scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-policy-confirmed-desktop");
  const response = await page.request.get("/api/reach/policy");
  expect(response.ok()).toBe(true);
  expect((await response.json()).policy).toMatchObject({ normalMaximumHz: 10, modelMaximumHz: 20 });
  await page.getByRole("button", { name: "Privacy & history" }).click();
  await expect(page.getByText("Tune the isolated synthetic Reach browser fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stage previous policy" }).first()).toBeVisible();
  await accessible(page);
});
test("observe-only operator reads Reach but cannot preview or execute policy", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, fixture.observer);
  await page.getByRole("button", { name: "Runtime policy", exact: true }).click();
  await expect(page.getByText(/CONFIG_OPERATE authority is required/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Reach policy" })).toHaveCount(0);
  const context = await page.request.get("/api/auth/context");
  const identity = await context.json();
  expect(identity.csrfToken).toBeTruthy();
  for (const step of ["preview", "execute"]) {
    const denied = await page.request.post(`/api/admin/commands/reach-runtime-policy/${step}`, {
      headers: { "x-csrf-token": identity.csrfToken, Origin: new URL(fixture.baseURL).origin },
      data: {},
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe("ADMIRALTY_CAPABILITY_DENIED");
  }
  await accessible(page);
  await capture(page, info, "SYNTHETIC-reach-admin-observer-mobile");
});
test("mobile operator can inspect policy ranges and immutable safeguards without overflow", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, fixture.admin);
  await page.getByRole("button", { name: "Runtime policy", exact: true }).click();
  await expect(page.getByLabel("Hand model inference ceiling (Hz)")).toHaveAttribute("min", "5");
  await expect(page.getByLabel("Hand model inference ceiling (Hz)")).toHaveAttribute("max", "60");
  await expect(page.getByRole("heading", { name: "Immutable safeguards" })).toBeVisible();
  await accessible(page);
  await page.getByRole("heading", { name: "Mandatory runtime policy" }).scrollIntoViewIfNeeded();
  await capture(page, info, "SYNTHETIC-reach-admin-policy-mobile");
});
