import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const artifactRoot = process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation";
async function capture(page: Page, name: string) {
  const directory = path.join(artifactRoot, "phase-b1");
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, caret: "initial" });
}
async function ok(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  return response;
}
async function startFixture(context: BrowserContext) {
  const response = await context.request.post("/api/tales/b1-vision-waypoint-demo/start", {
    data: { ownerLabel: `B1 Crew ${crypto.randomUUID().slice(0, 6)}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<{ sessionId: string; url: string }>;
}
async function openJournal(page: Page) {
  const open = page.getByRole("button", { name: /Open the journal/i });
  await expect(open).toBeVisible();
  await open.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.locator("main.tall-tale-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  await expect(page.locator(".persistent-objective")).toHaveCSS("opacity", "1");
}
async function returnToCurrentObjective(page: Page) {
  const button = page.getByRole("button", { name: "Return to Current Objective" });
  await expect(button).toBeVisible();
  await button.click();
}

test("Studio lifecycle, browser scan, duplicate/stale guards, desktop path, and Captain diagnostics form one B-1 slice", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The shared-database B-1 mutation proof runs once in Chromium.");
  test.setTimeout(240_000);
  const captainContext = await browser.newContext();
  const captain = captainContext.request;
  const login = await captain.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  await ok(login);
  const { csrfToken } = (await login.json()) as { csrfToken: string };

  const unauthorizedContext = await browser.newContext();
  const unauthorized = await unauthorizedContext.request.post("/api/vision-waypoints", { data: { name: "Denied" } });
  expect(unauthorized.status()).toBe(401);
  await unauthorizedContext.close();
  const created = await captain.post("/api/vision-waypoints", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      name: `Playwright Waypoint ${crypto.randomUUID().slice(0, 8)}`,
      description: "Lifecycle acceptance record",
      type: "EXACT_LANDMARK",
      locationTags: ["e2e"],
      sharingScope: "PRIVATE",
      verificationProfile: "STORY_CRITICAL",
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { waypointId, draftVersionId } = (await created.json()) as { waypointId: string; draftVersionId: string };
  const detail = await captain.get(`/api/vision-waypoints/${waypointId}`);
  await ok(detail);
  const draft = (await detail.json()) as {
    waypoint: { versions: Array<{ id: string; draftConfiguration: Record<string, unknown> }> };
  };
  const configuration = draft.waypoint.versions.find((version) => version.id === draftVersionId)!.draftConfiguration;
  await ok(
    await captain.patch(`/api/vision-waypoint-versions/${draftVersionId}/draft`, {
      headers: { "x-csrf-token": csrfToken },
      data: configuration,
    }),
  );
  const publication = await captain.post(`/api/vision-waypoint-versions/${draftVersionId}/publish`, {
    headers: { "x-csrf-token": csrfToken },
    data: { scenario: "verified" },
  });
  await ok(publication);
  expect((await publication.json()).publication.packageHash).toMatch(/^[a-f0-9]{64}$/);
  const immutableEdit = await captain.patch(`/api/vision-waypoint-versions/${draftVersionId}/draft`, {
    headers: { "x-csrf-token": csrfToken },
    data: configuration,
  });
  expect(immutableEdit.status()).toBe(409);
  const nextDraftResponse = await captain.post(`/api/vision-waypoints/${waypointId}/versions`, {
    headers: { "x-csrf-token": csrfToken },
    data: { parentVersionId: draftVersionId },
  });
  expect(nextDraftResponse.status(), await nextDraftResponse.text()).toBe(201);
  const nextDraft = (await nextDraftResponse.json()) as {
    id: string;
    draftConfiguration: Record<string, unknown> & { scanInteraction: { holdDurationMs: number } };
  };
  nextDraft.draftConfiguration.scanInteraction.holdDurationMs = 1600;
  await ok(
    await captain.patch(`/api/vision-waypoint-versions/${nextDraft.id}/draft`, {
      headers: { "x-csrf-token": csrfToken },
      data: nextDraft.draftConfiguration,
    }),
  );
  const sealedVersion = await captain.get(`/api/vision-waypoint-versions/${draftVersionId}`);
  await ok(sealedVersion);
  expect((await sealedVersion.json()).version.draftConfiguration.scanInteraction.holdDurationMs).not.toBe(1600);

  const studioPage = await captainContext.newPage();
  await studioPage.goto("/studio/vision-waypoints");
  await expect(studioPage.getByRole("heading", { name: "Vision Waypoints" })).toBeVisible();
  await expect(studioPage.getByText(/Playwright Waypoint/).first()).toBeVisible();
  await studioPage.goto(`/studio/vision-waypoints/${waypointId}`);
  await expect(studioPage.getByRole("heading", { name: /Playwright Waypoint/ })).toBeVisible();
  await capture(studioPage, "00-studio-waypoint-versioning");
  const studioTales = (await (await ok(await captain.get("/api/studio/tales"))).json()) as {
    tales: Array<{ id: string; slug: string }>;
  };
  const fixtureTale = studioTales.tales.find((tale) => tale.slug === "b1-vision-waypoint-demo");
  expect(fixtureTale).toBeTruthy();
  await studioPage.goto(`/studio/tales/${fixtureTale!.id}`);
  await expect(studioPage.getByText("Inspect the Painted Lantern", { exact: true }).first()).toBeVisible();

  const browserContext = await browser.newContext();
  const browserRun = await startFixture(browserContext);
  const playerPage = await browserContext.newPage();
  await playerPage.goto(browserRun.url);
  await openJournal(playerPage);
  await expect(playerPage.getByRole("heading", { name: "Inspect the Painted Lantern", exact: true })).toBeVisible();
  await expect(playerPage.getByText(/deterministic mock/i)).toBeVisible();
  await expect(playerPage.locator(".runtime-connection.live")).toBeVisible();
  await capture(playerPage, "01-player-vision-ready");
  await playerPage.getByRole("button", { name: /Hold to Inspect Surroundings/i }).click({ delay: 1500 });
  await returnToCurrentObjective(playerPage);
  await expect(playerPage.getByRole("heading", { name: "The mark is true" })).toBeVisible();
  await expect(playerPage.locator('.main-journal-book[data-flip-state="read"]')).toBeVisible();
  await capture(playerPage, "02-player-verified-advanced");

  const duplicateContext = await browser.newContext();
  const duplicateRun = await startFixture(duplicateContext);
  const duplicatePage = await duplicateContext.newPage();
  await duplicatePage.goto(duplicateRun.url);
  await openJournal(duplicatePage);
  await duplicatePage.getByLabel("Test scenario").selectOption("duplicate_result_delivery");
  await duplicatePage.getByRole("button", { name: /Hold to Inspect Surroundings/i }).click({ delay: 1500 });
  await returnToCurrentObjective(duplicatePage);
  await expect(duplicatePage.getByRole("heading", { name: "The mark is true" })).toBeVisible();
  const duplicateAttempts = await captain.get(`/api/verification-attempts?sessionId=${duplicateRun.sessionId}`);
  await ok(duplicateAttempts);
  expect((await duplicateAttempts.json()).attempts[0]).toMatchObject({
    result: "VERIFIED",
    eventDeliveryStatus: "DELIVERED",
    duplicateResultRejected: true,
  });
  const captainState = await captain.get(`/api/captain/sessions/${duplicateRun.sessionId}`);
  await ok(captainState);
  const events = ((await captainState.json()) as { events: Array<{ eventType: string; blockId?: string }> }).events;
  expect(events.filter((event) => event.eventType === "verificationSatisfied")).toHaveLength(1);

  const staleContext = await browser.newContext();
  const staleRun = await startFixture(staleContext);
  const stalePage = await staleContext.newPage();
  await stalePage.goto(staleRun.url);
  await openJournal(stalePage);
  await stalePage.getByLabel("Test scenario").selectOption("stale_stage");
  await stalePage.getByRole("button", { name: /Hold to Inspect Surroundings/i }).click({ delay: 1500 });
  await expect(stalePage.getByRole("heading", { name: "Inspect the Painted Lantern", exact: true })).toBeVisible();
  let staleAttempt: Record<string, unknown> | undefined;
  await expect
    .poll(async () => {
      const staleAttempts = await captain.get(`/api/verification-attempts?sessionId=${staleRun.sessionId}`);
      await ok(staleAttempts);
      staleAttempt = ((await staleAttempts.json()) as { attempts: Array<Record<string, unknown>> }).attempts[0];
      return staleAttempt?.eventDeliveryStatus;
    })
    .toBe("REJECTED_STALE");
  expect(staleAttempt).toMatchObject({
    result: "SYSTEM_ERROR",
    eventDeliveryStatus: "REJECTED_STALE",
    staleResultRejected: true,
  });

  for (const [scenario, expectedResult, expectedState] of [
    ["insufficient", "INSUFFICIENT_VISUAL_EVIDENCE", "INSUFFICIENT"],
    ["not_at_target", "NOT_AT_TARGET", "NOT_AT_TARGET"],
    ["ambiguous", "AMBIGUOUS", "AMBIGUOUS"],
    ["system_error", "SYSTEM_ERROR", "ERROR"],
    ["cancelled", "CANCELLED", "CANCELLED"],
  ] as const) {
    const scenarioContext = await browser.newContext();
    const run = await startFixture(scenarioContext);
    const before = (await (
      await ok(await scenarioContext.request.get(`/api/play/sessions/${run.sessionId}`))
    ).json()) as { block: { id: string; configuration: { waypointVersionId: string } } };
    const createdAttempt = await scenarioContext.request.post("/api/verification-attempts", {
      data: {
        sessionId: run.sessionId,
        blockId: before.block.id,
        waypointVersionId: before.block.configuration.waypointVersionId,
        scenario,
        platform: "WEB",
        adapterType: "MOCK",
      },
    });
    expect(createdAttempt.status(), await createdAttempt.text()).toBe(201);
    const attemptId = ((await createdAttempt.json()) as { id: string }).id;
    const completed = await scenarioContext.request.post(`/api/verification-attempts/${attemptId}/mock-result`, {
      data: { scenario },
    });
    await ok(completed);
    expect(await completed.json()).toMatchObject({ result: expectedResult, attemptState: expectedState });
    const after = (await (
      await ok(await scenarioContext.request.get(`/api/play/sessions/${run.sessionId}`))
    ).json()) as { block: { id: string } };
    expect(after.block.id).toBe(before.block.id);
    await scenarioContext.close();
  }

  const delayedContext = await browser.newContext();
  const delayedRun = await startFixture(delayedContext);
  const delayedState = (await (
    await ok(await delayedContext.request.get(`/api/play/sessions/${delayedRun.sessionId}`))
  ).json()) as { block: { id: string; configuration: { waypointVersionId: string } } };
  const delayedAttemptResponse = await delayedContext.request.post("/api/verification-attempts", {
    data: {
      sessionId: delayedRun.sessionId,
      blockId: delayedState.block.id,
      waypointVersionId: delayedState.block.configuration.waypointVersionId,
      scenario: "delayed_verified",
      platform: "WEB",
      adapterType: "MOCK",
    },
  });
  await ok(delayedAttemptResponse);
  const delayedAttemptId = ((await delayedAttemptResponse.json()) as { id: string }).id;
  const delayedDelivery = delayedContext.request.post(`/api/verification-attempts/${delayedAttemptId}/mock-result`, {
    data: { scenario: "delayed_verified" },
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const delayedCaptainState = (await (
    await ok(await captain.get(`/api/captain/sessions/${delayedRun.sessionId}`))
  ).json()) as { chapters: Array<{ blocks: Array<{ id: string; blockType: string }> }> };
  const narrativeTarget = delayedCaptainState.chapters
    .flatMap((chapter) => chapter.blocks)
    .find((block) => block.blockType === "narrative")!;
  await ok(
    await captain.post(`/api/captain/sessions/${delayedRun.sessionId}`, {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "jump",
        targetBlockId: narrativeTarget.id,
        reason: "B-1 delayed-result stale-stage proof",
        idempotencyKey: crypto.randomUUID(),
      },
    }),
  );
  await ok(await delayedDelivery);
  const delayedRecord = await captain.get(`/api/verification-attempts/${delayedAttemptId}`);
  await ok(delayedRecord);
  expect((await delayedRecord.json()).attempt).toMatchObject({
    result: "SYSTEM_ERROR",
    eventDeliveryStatus: "REJECTED_STALE",
    staleResultRejected: true,
  });
  await delayedContext.close();

  const desktopContext = await browser.newContext();
  const desktopRun = await startFixture(desktopContext);
  const desktopState = (await (
    await ok(await desktopContext.request.get(`/api/play/sessions/${desktopRun.sessionId}`))
  ).json()) as { block: { id: string; configuration: { waypointVersionId: string } } };
  const desktopAttempt = await desktopContext.request.post("/api/verification-attempts", {
    data: {
      sessionId: desktopRun.sessionId,
      blockId: desktopState.block.id,
      waypointVersionId: desktopState.block.configuration.waypointVersionId,
      scenario: "verified",
      platform: "DESKTOP",
      adapterType: "DESKTOP",
    },
  });
  expect(desktopAttempt.status(), await desktopAttempt.text()).toBe(201);
  const desktopId = ((await desktopAttempt.json()) as { id: string }).id;
  await ok(
    await desktopContext.request.post(`/api/verification-attempts/${desktopId}/mock-result`, {
      data: { scenario: "verified" },
    }),
  );
  const desktopResult = await captain.get(`/api/verification-attempts/${desktopId}`);
  await ok(desktopResult);
  expect((await desktopResult.json()).attempt).toMatchObject({
    platform: "DESKTOP",
    adapterType: "DESKTOP",
    result: "VERIFIED",
    eventDeliveryStatus: "DELIVERED",
  });
  const diagnostics = await captain.get(`/api/vision-diagnostics?sessionId=${duplicateRun.sessionId}`);
  await ok(diagnostics);
  expect(await diagnostics.json()).toMatchObject({
    appVersion: "0.3.0-b1",
    protocolVersion: "1.0",
    packageSchemaVersion: 1,
    featureFlags: {
      creator_capture: true,
      vision_build_engine: ["1", "true", "yes", "on", "enabled"].includes(
        (process.env.FEATURE_VISION_BUILD_ENGINE ?? "").toLocaleLowerCase(),
      ),
      automatic_vision_progression: false,
      live_external_ar: ["1", "true", "yes", "on", "enabled"].includes(
        (process.env.FEATURE_LIVE_EXTERNAL_AR ?? "").toLocaleLowerCase(),
      ),
    },
    pwa: { mutableApiCache: false },
  });

  const captainPage = await captainContext.newPage();
  await captainPage.goto(`/captain/sessions/${duplicateRun.sessionId}`);
  await expect(captainPage.getByRole("heading", { name: "Vision attempt diagnostics" })).toBeVisible();
  await expect(captainPage.getByText("Duplicate rejected")).toBeVisible();
  await capture(captainPage, "03-captain-attempt-diagnostics");

  await Promise.all([
    captainContext.close(),
    browserContext.close(),
    duplicateContext.close(),
    staleContext.close(),
    desktopContext.close(),
  ]);
});

test("PWA advertises an installable shell while sensitive truth remains network-owned", async ({ page }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  await ok(manifest);
  expect(await manifest.json()).toMatchObject({ display: "standalone", start_url: "/" });
  const worker = await page.request.get("/sw.js");
  await ok(worker);
  expect(worker.headers()["cache-control"]).toMatch(/no-cache|no-store/);
  const source = await worker.text();
  expect(source).toContain('"/api/"');
  expect(source).toContain('fetch(request, { cache: "no-store" })');
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "The companion is offline." })).toBeVisible();
  await expect(page.getByText(/never served from a stale cache/i)).toBeVisible();
});
