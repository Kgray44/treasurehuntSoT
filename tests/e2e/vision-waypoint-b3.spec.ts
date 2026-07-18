import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

type Aggregate = {
  version: { id: string; authoringRevision: number; currentWizardStep: number };
  configuration: Record<string, unknown>;
  dataHealth: { readyToPrepare: boolean; items: Array<{ code: string }> };
};

async function login(context: BrowserContext) {
  const response = await context.request.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { csrfToken: string };
}

async function createWaypoint(request: APIRequestContext, csrfToken: string, profile = "BALANCED") {
  const response = await request.post("/api/vision-waypoints", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      name: `B3 Waypoint ${randomUUID().slice(0, 8)}`,
      description: "B-3 authoring acceptance",
      type: "EXACT_LANDMARK",
      locationTags: ["b3", "e2e"],
      sharingScope: "PRIVATE",
      verificationProfile: profile,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<{ waypointId: string; draftVersionId: string }>;
}

async function getAggregate(request: APIRequestContext, versionId: string) {
  const response = await request.get(`/api/vision-waypoint-versions/${versionId}/authoring`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { authoring: Aggregate }).authoring;
}

async function mutate(
  request: APIRequestContext,
  csrfToken: string,
  aggregate: Aggregate,
  operation: Record<string, unknown>,
) {
  const response = await request.patch(`/api/vision-waypoint-versions/${aggregate.version.id}/authoring`, {
    headers: { "x-csrf-token": csrfToken },
    data: { ...operation, expectedRevision: aggregate.version.authoringRevision },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { authoring: Aggregate }).authoring;
}

async function captureFixture(
  request: APIRequestContext,
  csrfToken: string,
  versionId: string,
  purpose: string,
  suffix: string,
) {
  const id = suffix.replaceAll("-", "_");
  const now = Date.now();
  const response = await request.post("/api/vision-capture-sessions", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      schemaVersion: 1,
      artifactId: `artifact_b3_${id}`,
      recordingId: `recording_b3_${id}`,
      mediaType: "video/webm",
      storageCategory: "LOCAL_APP_DATA",
      contentHash: `sha256:${createHash("sha256").update(`b3-${id}`).digest("hex")}`,
      fileSize: 8192,
      startedAt: new Date(now - 4_000).toISOString(),
      completedAt: new Date(now).toISOString(),
      metadata: {
        waypointVersionId: versionId,
        purpose,
        creatorLabel: `B3 ${purpose.toLocaleLowerCase()}`,
        notes: "Clearly labeled automated manifest fixture; no target-game claim.",
        environmentNotes: "Playwright contract fixture",
        allowCloudUpload: false,
        target: {
          targetId: `window:${Math.floor(Math.random() * 800000 + 100000)}:0`,
          privacyLabel: "Automated fixture window",
        },
        captureApi: "ELECTRON_DESKTOP_CAPTURER",
      },
      capture: {
        sessionId: `creator_b3_${id}`,
        captureCoreVersion: "0.5.0-b3",
        protocolVersion: "2.0",
        originalDimensions: { width: 1920, height: 1080 },
        normalizedDimensions: { width: 320, height: 180 },
        estimatedFrameRate: 10,
        durationMs: 4_000,
        frameCount: 40,
        encoding: "video/webm;codecs=vp9",
        qualitySummary: { capturedFrameCount: 40, usableFrameCount: 38, frozen: false },
        interruptions: [],
      },
      retention: { policy: "CREATOR_MANAGED", deletable: true, uploadAuthorized: false },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return `artifact_b3_${id}`;
}

test("Exact Landmark authoring queues immutable B-4 BuildInput without inventing a completion", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Shared-database B-3 mutation proof runs once in Chromium.");
  const context = await browser.newContext();
  const { csrfToken } = await login(context);
  const created = await createWaypoint(context.request, csrfToken, "STORY_CRITICAL");
  let aggregate = await getAggregate(context.request, created.draftVersionId);
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "SAVE_STEP",
    step: 1,
    complete: true,
    data: {
      summary: "Recognize the exact painted lantern landmark",
      successDefinition: "Accept only the intended landmark from its accepted area",
      waypointType: "EXACT_LANDMARK",
      verificationProfile: "STORY_CRITICAL",
      buildPreference: "LOCAL",
    },
  });

  const target = await captureFixture(
    context.request,
    csrfToken,
    created.draftVersionId,
    "TARGET_REFERENCE",
    randomUUID(),
  );
  const nearby = await captureFixture(
    context.request,
    csrfToken,
    created.draftVersionId,
    "NEARBY_HARD_NEGATIVE",
    randomUUID(),
  );
  const distant = await captureFixture(
    context.request,
    csrfToken,
    created.draftVersionId,
    "DISTANT_HARD_NEGATIVE",
    randomUUID(),
  );
  aggregate = await getAggregate(context.request, created.draftVersionId);
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_POSE_REGION",
    classification: "ACCEPTED",
    parameters: { centerX: 0, centerZ: 0, radius: 3, facingDegrees: 0, toleranceDegrees: 120 },
    orientationRules: "Face generally toward the landmark.",
    visibilityRules: "The lantern remains visible.",
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_POSE_REGION",
    classification: "BOUNDARY",
    parameters: { centerX: 0, centerZ: 0, radius: 5, facingDegrees: 0, toleranceDegrees: 180 },
    orientationRules: "Outside this radius is rejected.",
    visibilityRules: "Context becomes ambiguous beyond the boundary.",
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_VISUAL_REGION",
    recordingAssetId: target,
    regionType: "TARGET",
    semanticLabel: "Painted lantern face",
    geometry: { tool: "RECTANGLE", x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_HARD_NEGATIVE",
    name: "Nearby unpainted lantern",
    classification: "NEARBY",
    reason: "Similar silhouette without the painted face.",
    assetIds: [nearby],
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_HARD_NEGATIVE",
    name: "Distant tavern lantern",
    classification: "DISTANT",
    reason: "Similar color and outline in a different structure.",
    assetIds: [distant],
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_TEST",
    name: "Accepted target",
    testType: "POSITIVE",
    expectedResult: "MATCH",
    instructions: "Use the target reference as positive validation evidence.",
    assetIds: [target],
    environment: "Ordinary daylight",
  });
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "UPSERT_TEST",
    name: "Nearby rejection",
    testType: "NEGATIVE",
    expectedResult: "NO_MATCH",
    instructions: "The nearby confuser must not match.",
    assetIds: [nearby],
    environment: "Ordinary daylight",
  });
  const detailed = await context.request.get(`/api/vision-waypoint-versions/${created.draftVersionId}/authoring`);
  const detailedBody = (await detailed.json()) as {
    authoring: Aggregate & { tests: Array<{ id: string; testType: string }> };
  };
  aggregate = detailedBody.authoring;
  const positive = detailedBody.authoring.tests.find((item) => item.testType === "POSITIVE")!;
  aggregate = await mutate(context.request, csrfToken, aggregate, { operation: "LOCK_TEST", id: positive.id });
  const remainingSteps: Array<[number, Record<string, unknown>]> = [
    [
      2,
      {
        playerTask: "Inspect the painted lantern.",
        narrativeImportance: "Confirms the correct story landmark.",
        failureConsequence: "Retry without advancing.",
      },
    ],
    [3, { privacyAcknowledged: true, selectedPath: "DESKTOP", lastConnectionState: "Automated contract fixture only" }],
    [
      4,
      {
        guidanceNotes: "Circle slowly with stable context visible.",
        coveragePlan: "BALANCED",
        representativeAssetId: target,
      },
    ],
    [5, { instructions: "Walk the accepted player positions.", provisionalAccuracyAcknowledged: true }],
    [6, { instructions: "Mark where acceptance ends.", reasons: ["The durable target detail is no longer clear."] }],
    [
      7,
      {
        confusionNotes: "Nearby and distant confusers are both represented.",
        storyCriticalRequirementAcknowledged: true,
      },
    ],
    [
      8,
      {
        targetDescription: "The painted lantern face is durable.",
        ignoreDescription: "Ignore water, sky, UI, and particles.",
      },
    ],
    [9, { reviewedAt: new Date().toISOString(), acknowledgedWarningCodes: ["TARGET_COVERAGE_LOW"] }],
    [10, { executionTarget: "LOCAL", rawMediaConsent: false }],
    [
      11,
      {
        notes: "Positive and negative cases are present.",
        acceptanceNotes: "Locked evidence remains outside authoring.",
      },
    ],
    [12, { confirmCaptureConsent: true, confirmNoModelYet: true, confirmLockedTests: true }],
  ];
  for (const [step, data] of remainingSteps)
    aggregate = await mutate(context.request, csrfToken, aggregate, {
      operation: "SAVE_STEP",
      step,
      complete: true,
      data,
    });
  expect(aggregate.dataHealth.readyToPrepare).toBe(true);

  const page = await context.newPage();
  await page.goto(`/studio/vision-waypoints/${created.waypointId}`);
  await expect(page.getByRole("heading", { name: /B3 Waypoint/ })).toBeVisible();
  await page.getByRole("button", { name: /Important Visual Regions/ }).click();
  await expect(page.getByRole("heading", { name: "Important Visual Regions", exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  const screenshotDirectory = path.join(process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation", "phase-b3");
  await fs.mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, "01-studio-region-authoring.png"),
    fullPage: true,
    caret: "initial",
  });
  aggregate = await getAggregate(context.request, created.draftVersionId);
  const unsafeDelete = await context.request.delete(`/api/vision-capture-sessions/${target}`, {
    headers: { "x-csrf-token": csrfToken },
  });
  expect(unsafeDelete.status()).toBe(409);
  expect(await unsafeDelete.json()).toMatchObject({ code: "CAPTURE_ARTIFACT_IN_USE" });

  const prepared = await context.request.post(`/api/vision-waypoint-versions/${created.draftVersionId}/prepare-build`, {
    headers: { "x-csrf-token": csrfToken },
    data: { expectedRevision: aggregate.version.authoringRevision },
  });
  expect(prepared.status(), await prepared.text()).toBe(201);
  const preparedBody = (await prepared.json()) as {
    jobId: string;
    inputHash: string;
    modelProduced: boolean;
    confidenceProduced: boolean;
  };
  expect(preparedBody).toMatchObject({ modelProduced: false, confidenceProduced: false });
  expect(preparedBody.inputHash).toMatch(/^[a-f0-9]{64}$/);
  const snapshot = await context.request.get(`/api/vision-build-jobs/${preparedBody.jobId}`);
  expect(snapshot.ok(), await snapshot.text()).toBeTruthy();
  expect(await snapshot.json()).toMatchObject({
    inputHash: preparedBody.inputHash,
    status: "QUEUED",
    processingStage: "QUEUED",
    buildInput: {
      boundary: {
        implementation: "LOCAL_COMPANION_BUILD_REQUIRED",
        modelProduced: false,
        confidenceProduced: false,
        shadowModeOnly: true,
        automaticProgression: false,
      },
    },
  });

  const packageHash = `sha256:${createHash("sha256").update(`b4-package-${preparedBody.jobId}`).digest("hex")}`;
  const packageId = `pkg_${randomUUID()}`;
  const completed = await context.request.patch(`/api/vision-build-jobs/${preparedBody.jobId}`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      event: "COMPLETED",
      report: {
        schemaVersion: 1,
        buildId: preparedBody.jobId,
        inputHash: `sha256:${preparedBody.inputHash}`,
        engineVersion: "1.0.0-b4",
        modelBundleVersion: "classical-vision-cpu-1",
        provider: { id: "CPU_CLASSICAL", active: true },
        calibration: { profile: "STORY_CRITICAL", thresholds: { minimumTargetNegativeMargin: 0.1 } },
        certification: {
          reliabilityGrade: "GOOD",
          automaticEligibility: false,
          approvedRuntimeModes: ["SHADOW"],
          metrics: { positiveAttempts: 2, negativeAttempts: 20, falseAccepts: 0, falseRejects: 1 },
        },
        package: {
          manifest: {
            packageId,
            packageHash,
            waypointVersionId: created.draftVersionId,
            shadowModeOnly: true,
            automaticEligibility: false,
          },
        },
        status: "COMPLETED",
        shadowModeOnly: true,
      },
      packageArtifact: {
        packageId,
        storageReference: `companion://vision-packages/${packageId}`,
        contentHash: packageHash,
        fileSize: 16_384,
      },
    },
  });
  expect(completed.ok(), await completed.text()).toBeTruthy();
  expect(await completed.json()).toMatchObject({
    status: "COMPLETED",
    lifecycleStatus: "SHADOW_READY",
    reliabilityGrade: "GOOD",
    automaticEligibility: false,
  });

  await page.reload();
  await expect(page.getByText("Automatic progression: disabled")).toBeVisible();
  await context.close();
});

test("Companion disconnect state and wizard position resume from persisted server state", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Shared-database B-3 mutation proof runs once in Chromium.");
  const context = await browser.newContext();
  const { csrfToken } = await login(context);
  const created = await createWaypoint(context.request, csrfToken);
  let aggregate = await getAggregate(context.request, created.draftVersionId);
  const staleRevision = aggregate.version.authoringRevision;
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "SAVE_STEP",
    step: 3,
    complete: true,
    data: {
      privacyAcknowledged: true,
      selectedPath: "BROWSER_PAIRED",
      lastConnectionState: "Disconnected; local Companion unavailable",
    },
  });
  expect(aggregate.version.currentWizardStep).toBe(4);
  const staleSave = await context.request.patch(`/api/vision-waypoint-versions/${created.draftVersionId}/authoring`, {
    headers: { "x-csrf-token": csrfToken },
    data: { operation: "SET_NAVIGATION", expectedRevision: staleRevision, mode: "GUIDED", currentStep: 2 },
  });
  expect(staleSave.status()).toBe(409);
  expect(await staleSave.json()).toMatchObject({
    code: "AUTHORING_CONFLICT",
    currentRevision: aggregate.version.authoringRevision,
  });
  const page = await context.newPage();
  await page.goto(`/studio/vision-waypoints/${created.waypointId}`);
  await expect(page.getByText("Step 4 of 12")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Step 4 of 12")).toBeVisible();
  await expect(page.getByText("Not connected")).toBeVisible();
  await context.close();
});

test("published waypoint versions reject every B-3 authoring mutation", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "Shared-database B-3 mutation proof runs once in Chromium.");
  const context = await browser.newContext();
  const { csrfToken } = await login(context);
  const created = await createWaypoint(context.request, csrfToken);
  const aggregate = await getAggregate(context.request, created.draftVersionId);
  const published = await context.request.post(`/api/vision-waypoint-versions/${created.draftVersionId}/publish`, {
    headers: { "x-csrf-token": csrfToken },
    data: { scenario: "verified" },
  });
  expect(published.ok(), await published.text()).toBeTruthy();
  const mutation = await context.request.patch(`/api/vision-waypoint-versions/${created.draftVersionId}/authoring`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      operation: "SET_NAVIGATION",
      expectedRevision: aggregate.version.authoringRevision,
      mode: "GUIDED",
      currentStep: 2,
    },
  });
  expect(mutation.status()).toBe(409);
  expect(await mutation.json()).toMatchObject({ code: "PUBLISHED_VERSION_IMMUTABLE" });
  await context.close();
});

test("Story-Critical preparation is blocked without nearby and distant hard negatives", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Shared-database B-3 mutation proof runs once in Chromium.");
  const context = await browser.newContext();
  const { csrfToken } = await login(context);
  const created = await createWaypoint(context.request, csrfToken, "STORY_CRITICAL");
  let aggregate = await getAggregate(context.request, created.draftVersionId);
  aggregate = await mutate(context.request, csrfToken, aggregate, {
    operation: "SAVE_STEP",
    step: 1,
    complete: true,
    data: {
      summary: "A Story-Critical exact landmark",
      successDefinition: "Only the exact intended landmark is accepted",
      waypointType: "EXACT_LANDMARK",
      verificationProfile: "STORY_CRITICAL",
      buildPreference: "LOCAL",
    },
  });
  expect(aggregate.dataHealth.items.map((item) => item.code)).toEqual(
    expect.arrayContaining(["NEARBY_HARD_NEGATIVE_REQUIRED", "DISTANT_HARD_NEGATIVE_REQUIRED"]),
  );
  const prepared = await context.request.post(`/api/vision-waypoint-versions/${created.draftVersionId}/prepare-build`, {
    headers: { "x-csrf-token": csrfToken },
    data: { expectedRevision: aggregate.version.authoringRevision },
  });
  expect(prepared.status()).toBe(409);
  expect(await prepared.json()).toMatchObject({ code: "DATA_HEALTH_BLOCKED" });
  await context.close();
});

test("web and desktop render the same shared authoring wizard", async ({ browser }) => {
  const web = await browser.newContext();
  const desktop = await browser.newContext();
  const webLogin = await login(web);
  await login(desktop);
  const created = await createWaypoint(web.request, webLogin.csrfToken);
  await desktop.addInitScript(() => {
    Object.defineProperty(window, "tallTaleDesktop", {
      value: {
        platform: "windows",
        shellVersion: "b3-e2e",
        invoke: async () => ({ protocolVersion: "2.0", state: "IDLE" }),
        subscribe: () => () => {},
      },
      configurable: true,
    });
  });
  const webPage = await web.newPage();
  const desktopPage = await desktop.newPage();
  await Promise.all([
    webPage.goto(`/studio/vision-waypoints/${created.waypointId}`),
    desktopPage.goto(`/studio/vision-waypoints/${created.waypointId}`),
  ]);
  for (const page of [webPage, desktopPage]) {
    await expect(page.getByRole("heading", { name: /B3 Waypoint/ })).toBeVisible();
    await expect(page.locator(".wizard-sidebar li")).toHaveCount(12);
    await expect(page.getByText("Step 1 of 12")).toBeVisible();
  }
  expect(await webPage.locator(".wizard-content").evaluate((node) => node.tagName)).toBe(
    await desktopPage.locator(".wizard-content").evaluate((node) => node.tagName),
  );
  await Promise.all([web.close(), desktop.close()]);
});
