import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";

test.skip(({ browserName }) => browserName !== "chromium", "The version-pinned mutation workflow runs once.");

const unique = (label: string) => `${label}-${crypto.randomUUID()}`;
const captainCredentials = () => ({
  username: process.env.GM_USERNAME ?? "kato",
  password: process.env.GM_PASSWORD ?? "development-captain-only",
});

async function current(request: APIRequestContext, sessionUrl: string) {
  const response = await request.get(sessionUrl);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    csrfToken: string;
    session: { status: string; versionId: string };
    block: { id: string; blockType: string; title: string } | null;
    pendingVerification: { id: string; providerType: string } | null;
    inventory: string[];
  }>;
}

async function addLibraryBlock(page: Page, name: string) {
  const source = page.locator(".block-library article").filter({ has: page.getByText(name, { exact: true }) });
  await source.scrollIntoViewIfNeeded();
  const before = await page.locator(".timeline-block").count();
  await source.getByLabel(`Add ${name} to first chapter`).click();
  await expect(page.locator(".timeline-block")).toHaveCount(before + 1);
}

test("published Studio tale completes through player, Captain, and helper contracts", async ({ browser }) => {
  const playerContext = await browser.newContext();
  const captainContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  const player = playerContext.request;
  const captain = captainContext.request;
  const playerPage = await playerContext.newPage();

  const catalogResponse = await player.get("/api/tales");
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = (await catalogResponse.json()) as {
    tales: Array<{ slug: string; title: string; version: string }>;
  };
  expect(catalog.tales).toContainEqual(expect.objectContaining({ slug: "development-studio-voyage", version: "1.0" }));

  const loginResponse = await captain.post("/api/gm/login", {
    data: captainCredentials(),
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { csrfToken } = (await loginResponse.json()) as { csrfToken: string };
  const captainLibrary = await captain.get("/api/captain/library");
  expect(captainLibrary.ok()).toBeTruthy();
  const library = (await captainLibrary.json()) as {
    publishedTales: Array<{ id: string; slug: string; versions: Array<{ id: string }> }>;
  };
  const source = library.publishedTales.find((tale) => tale.slug === "development-studio-voyage");
  expect(source?.versions[0]).toBeTruthy();
  const voyageResponse = await captain.post("/api/captain/playthroughs", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      taleId: source!.id,
      versionId: source!.versions[0]!.id,
      voyageName: unique("Studio Playwright voyage"),
      captainMode: "CAPTAIN_CONTROLLED",
      hints: "ON_REQUEST",
      sideQuests: true,
      scheduleTimezone: "America/New_York",
      accessibilityDefaults: { motion: "SYSTEM" },
      expiresInHours: 24,
      accountRequired: false,
      maxRedemptions: 1,
      players: [{ displayName: "Playwright Crew", crewRole: "Navigator" }],
    },
  });
  expect(voyageResponse.status(), await voyageResponse.text()).toBe(201);
  const voyage = (await voyageResponse.json()) as { playthroughId: string; invitations: Array<{ link: string }> };
  const sessionId = voyage.playthroughId;
  expect(voyage.invitations[0]).toBeTruthy();
  await playerPage.goto(voyage.invitations[0]!.link);
  await expect(playerPage).toHaveURL(/\/player\/invitation$/);
  const accepted = playerPage.waitForResponse(
    (response) => response.url().endsWith("/api/invitations/accept") && response.request().method() === "POST",
  );
  await playerPage.getByRole("button", { name: "Accept and join voyage" }).click({ noWaitAfter: true });
  expect((await accepted).ok()).toBe(true);
  await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${sessionId}$`));
  const playerUrl = (path: string) => new URL(path, playerPage.url()).href;
  const launch = await captain.post(`/api/captain/playthroughs/${sessionId}/launch`, {
    headers: { "x-csrf-token": csrfToken },
    data: {},
  });
  expect(launch.ok()).toBeTruthy();
  expect((await strangerContext.request.get(`/api/play/sessions/${sessionId}`)).status()).toBe(401);

  let state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
  const pinnedVersionId = state.session.versionId;
  expect(state.block).toMatchObject({ blockType: "narrative", title: "The Lantern Wakes" });

  let response = await player.post(playerUrl(`/api/play/sessions/${sessionId}`), {
    headers: { "x-csrf-token": state.csrfToken },
    data: { action: "continue", idempotencyKey: unique("narrative") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
  expect(state.pendingVerification?.providerType).toBe("textAnswer");

  response = await player.post(playerUrl(`/api/play/sessions/${sessionId}`), {
    headers: { "x-csrf-token": state.csrfToken },
    data: { action: "answer", answer: "anchor", idempotencyKey: unique("wrong-answer") },
  });
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).accepted).toBe(false);
  expect((await current(player, playerUrl(`/api/play/sessions/${sessionId}`))).block?.blockType).toBe("riddle");

  response = await player.post(playerUrl(`/api/play/sessions/${sessionId}`), {
    headers: { "x-csrf-token": state.csrfToken },
    data: { action: "answer", answer: "  LANTERN  ", idempotencyKey: unique("right-answer") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
  expect(state.block?.blockType).toBe("captainApproval");
  expect(state.pendingVerification?.providerType).toBe("captainManual");

  const pairResponse = await captain.post("/api/helper/pair", {
    headers: { "x-csrf-token": csrfToken },
    data: { sessionId, deviceId: "playwright-helper" },
  });
  expect(pairResponse.ok()).toBeTruthy();
  const { token, pairingId } = (await pairResponse.json()) as { token: string; pairingId: string };
  const helperStatus = await captain.get("/api/helper/status", { headers: { Authorization: `Bearer ${token}` } });
  expect(helperStatus.ok()).toBeTruthy();
  expect(await helperStatus.json()).toMatchObject({
    pairing: { id: pairingId, status: "ACTIVE" },
    scope: { sessionId, publishedVersionId: pinnedVersionId, currentBlockId: state.block!.id },
  });
  const pending = state.pendingVerification!;
  const wrongVersionResponse = await captain.post("/api/helper/verification", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      schemaVersion: 1,
      eventId: unique("helper-event"),
      idempotencyKey: unique("helper-idempotency"),
      eventType: "verification.observation",
      providerType: "captainManual",
      providerInstanceId: "playwright-helper",
      sessionId,
      publishedVersionId: `${pinnedVersionId}-wrong`,
      blockId: state.block!.id,
      verificationRequestId: pending.id,
      observedAt: new Date().toISOString(),
      result: "match",
      confidence: 0.99,
      evidence: { test: true },
    },
  });
  expect(wrongVersionResponse.status()).toBe(409);
  expect((await wrongVersionResponse.json()).code).toBe("wrongVersion");

  const approval = await captain.post(`/api/captain/sessions/${sessionId}`, {
    headers: { "x-csrf-token": csrfToken },
    data: { action: "approve", reason: "Playwright golden path", idempotencyKey: unique("captain-approve") },
  });
  expect(approval.ok()).toBeTruthy();
  state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
  expect(state.block?.blockType).toBe("chapterComplete");
  expect(state.session.versionId).toBe(pinnedVersionId);

  const revoke = await captain.delete(`/api/helper/pair/${pairingId}`, {
    headers: { "x-csrf-token": csrfToken },
  });
  expect(revoke.ok()).toBeTruthy();
  expect((await captain.get("/api/helper/status", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(
    409,
  );

  for (const expectedType of ["travelDirection", "confirmation", "taleComplete"]) {
    response = await player.post(playerUrl(`/api/play/sessions/${sessionId}`), {
      headers: { "x-csrf-token": state.csrfToken },
      data: { action: "continue", idempotencyKey: unique(`continue-${expectedType}`) },
    });
    expect(response.ok()).toBeTruthy();
    state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
    expect(state.block?.blockType).toBe(expectedType);
    expect(state.session.versionId).toBe(pinnedVersionId);
  }
  response = await player.post(playerUrl(`/api/play/sessions/${sessionId}`), {
    headers: { "x-csrf-token": state.csrfToken },
    data: { action: "continue", idempotencyKey: unique("complete-tale") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, playerUrl(`/api/play/sessions/${sessionId}`));
  expect(state.session.status).toBe("COMPLETED");
  expect(state.session.versionId).toBe(pinnedVersionId);
  const completedLibrary = await player.get(playerUrl("/api/player/library"));
  expect(completedLibrary.ok()).toBeTruthy();
  const completedVoyages = (await completedLibrary.json()) as {
    groups: { completed: Array<{ id: string }> };
  };
  expect(completedVoyages.groups.completed).toContainEqual(expect.objectContaining({ id: sessionId }));

  await playerContext.close();
  await captainContext.close();
  await strangerContext.close();
});

test("Studio rejects invalid Captain credentials", async ({ request }) => {
  const response = await request.post("/api/gm/login", {
    data: { username: captainCredentials().username, password: "invalid-playwright-captain-password" },
  });
  expect(response.status()).toBe(401);
});

test("Studio editor exposes searchable authoring tools and responsive isolated preview", async ({ page }) => {
  const login = await page.request.post("/api/gm/login", {
    data: captainCredentials(),
  });
  expect(login.ok()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const studioResponse = await page.request.get("/api/studio/tales");
  expect(studioResponse.ok()).toBeTruthy();
  const studio = (await studioResponse.json()) as { tales: Array<{ id: string; slug: string }> };
  const tale = studio.tales.find((item) => item.slug === "development-studio-voyage");
  expect(tale).toBeTruthy();

  await page.goto(`/studio/tales/${tale!.id}`);
  await expect(page.getByRole("tab", { name: "Passages" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chapters" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Outline" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Passages" })).toBeVisible();
  await expect(page.locator(".block-library-drag-handle").first()).toHaveAttribute(
    "aria-roledescription",
    "sortable Passage",
  );
  await page.locator(".timeline-block").first().click();
  await expect(page.getByRole("button", { name: "Preview Passage" })).toBeEnabled();
  await page.getByRole("button", { name: "Preview Passage" }).click();
  await expect(page.getByRole("dialog", { name: "The Lantern Wakes" })).toBeVisible();
  await page.getByRole("button", { name: "Mobile" }).click();
  await page.getByLabel("Reduced motion").check();
  await expect(page.locator(".block-preview-viewport.mobile.reduced-motion")).toBeVisible();
  await page.getByRole("button", { name: "Close Passage preview" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".timeline-block").first().click();
  await expect(page.getByRole("button", { name: "Close Passage inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Close Passage inspector" }).click();
  await expect(page.locator(".block-inspector.empty")).toBeHidden();

  const detail = (await (await page.request.get(`/api/studio/tales/${tale!.id}`)).json()) as {
    versions: Array<{ id: string; versionLabel: string }>;
  };
  const version = detail.versions[0];
  const publishedPreview = await page.request.post(`/api/studio/tales/${tale!.id}/versions/${version.id}`, {
    headers: { "x-csrf-token": csrfToken },
    data: { action: "preview" },
  });
  expect(publishedPreview.ok()).toBeTruthy();
  expect(await publishedPreview.json()).toMatchObject({ versionId: version.id });
  await page.goto("/play/development-studio-voyage/history");
  await expect(page.getByRole("heading", { name: "Preview voyages are not recorded" })).toBeVisible();
  const restored = await page.request.post(`/api/studio/tales/${tale!.id}/versions/${version.id}`, {
    headers: { "x-csrf-token": csrfToken },
    data: { action: "restore" },
  });
  expect(restored.ok(), await restored.text()).toBeTruthy();
  expect(await restored.json()).toMatchObject({ basedOnPublishedVersionId: version.id, revisionNumber: 2 });
  const copiedDetailResponse = await page.request.get(`/api/studio/tales/${tale!.id}`);
  expect(copiedDetailResponse.ok()).toBeTruthy();
  const copiedDetail = (await copiedDetailResponse.json()) as {
    draft: {
      chapters: Array<{
        blocks: Array<{ id: string; connections: Array<{ targetBlockId: string }> }>;
      }>;
    };
  };
  const copiedBlocks = copiedDetail.draft.chapters.flatMap((chapter) => chapter.blocks);
  const copiedBlockIds = new Set(copiedBlocks.map((block) => block.id));
  expect(
    copiedBlocks
      .flatMap((block) => block.connections)
      .every((connection) => copiedBlockIds.has(connection.targetBlockId)),
  ).toBe(true);
});

test("creator authors a media-rich tale and preserves the Drydock launch gate", async ({ page }) => {
  const login = await page.request.post("/api/gm/login", {
    data: captainCredentials(),
  });
  expect(login.ok()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const taleSlug = `playwright-moon-chart-${Date.now()}`;

  const studioReady = page.waitForResponse(
    (response) => response.url().endsWith("/api/studio/tales") && response.request().method() === "GET",
  );
  await page.goto("/studio/tales/new");
  expect((await studioReady).ok()).toBeTruthy();
  await page.getByLabel("Title", { exact: true }).fill("Playwright Moon Chart");
  await page.getByLabel(/Address/).fill(taleSlug);
  await page.getByLabel("Short description", { exact: true }).fill("A disposable media-rich authoring proof.");
  await page.getByLabel("Visibility").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect.poll(() => new URL(page.url()).pathname).not.toBe("/studio/tales/new");
  const taleId = new URL(page.url()).pathname.split("/").at(-1)!;
  const assetLibrary = await page.request.get(`/api/studio/tales/${taleId}/assets`);
  expect(assetLibrary.ok(), `${assetLibrary.url()} ${await assetLibrary.text()}`).toBeTruthy();

  const beforePng = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#17314a" },
  })
    .png()
    .toBuffer();
  const afterPng = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#d8bb78" },
  })
    .png()
    .toBuffer();
  const upload = async (name: string, buffer: Buffer) => {
    const response = await page.request.post(`/api/studio/tales/${taleId}/assets`, {
      headers: { "x-csrf-token": csrfToken },
      multipart: { files: { name, mimeType: "image/png", buffer } },
    });
    expect(response.status(), `${response.url()} ${await response.text()}`).toBe(201);
    const body = (await response.json()) as { assets: Array<{ asset: { id: string } }> };
    return body.assets[0].asset.id;
  };
  const beforeAssetId = await upload("before-moon.png", beforePng);
  const afterAssetId = await upload("after-moon.png", afterPng);

  const artifactResponse = await page.request.post(`/api/studio/tales/${taleId}/library`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      entity: "artifact",
      action: "create",
      data: {
        name: "Moon Compass",
        ordinaryGameObjectLabel: "practice compass",
        shortDescription: "A compass revealed by moonlit ink.",
        loreDescription: "The needle remembers the route home.",
      },
    },
  });
  expect(artifactResponse.ok()).toBeTruthy();
  const artifactId = ((await artifactResponse.json()) as { id: string }).id;

  await page.reload();
  for (const name of [
    "Arrival Check",
    "Image Transformation",
    "Artifact Reveal",
    "Image",
    "Confirmation",
    "Voyage Complete",
  ])
    await addLibraryBlock(page, name);
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });

  const detailResponse = await page.request.get(`/api/studio/tales/${taleId}`);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = (await detailResponse.json()) as {
    tale: Record<string, unknown>;
    draft: {
      autosaveVersion: number;
      chapters: Array<{
        id: string;
        title: string;
        blocks: Array<{
          id: string;
          blockType: string;
          title: string;
          configuration: Record<string, unknown>;
          completion: Record<string, unknown>;
        }>;
      }>;
    };
  };
  const configurations: Record<string, Record<string, unknown>> = {
    arrivalCheck: {
      prompt: "Confirm arrival at the moon mark.",
      pendingText: "Watching the horizon...",
      captainNotification: "The crew reached the moon mark.",
      verificationProvider: "playerConfirmation",
      allowCaptainOverride: true,
      completionMode: "playerConfirmation",
      futureProviderOptions: {},
    },
    imageTransformation: {
      beforeAssetId,
      afterAssetId,
      transitionPreset: "moonlight",
      duration: 600,
      holdBefore: 0,
      holdAfter: 0,
      caption: "Moon ink reveals the route.",
      nonMotionMeaning: "The moon ink reveals the route without relying on the animation.",
      alignment: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 50, focalX: 50, focalY: 50 },
      completionMode: "playerConfirmation",
    },
    artifactReveal: {
      artifactId,
      ordinaryObjectLabel: "practice compass",
      revealArtworkId: afterAssetId,
      loreTitle: "Moon Compass",
      loreDescription: "The needle remembers the route home.",
      addToCollection: true,
      revealAnimation: "lantern",
      completionMode: "playerConfirmation",
    },
    image: {
      assetId: afterAssetId,
      caption: "The completed moon chart.",
      altText: "A moonlit route drawn in blue ink",
      displayMode: "journalFrame",
      focalX: 50,
      focalY: 50,
      completionMode: "playerConfirmation",
    },
    confirmation: {
      prompt: "Secure the chart in the journal?",
      primaryLabel: "Secure chart",
      secondaryLabel: "",
      confirmationStyle: "standard",
      captainOverride: true,
      completionMode: "playerConfirmation",
    },
    taleComplete: {
      finaleHeading: "Moon chart complete",
      finaleContent: "The ink settles and the route is preserved.",
      completionMessage: "The media-rich voyage is complete.",
      credits: "Playwright authoring proof",
      replayAvailable: true,
      completionMode: "playerConfirmation",
    },
  };
  const saveResponse = await page.request.patch(`/api/studio/tales/${taleId}/draft`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      autosaveVersion: detail.draft.autosaveVersion,
      tale: { ...detail.tale, coverAssetId: beforeAssetId },
      chapters: detail.draft.chapters.map((chapter) => ({
        ...chapter,
        estimatedDuration: 12,
        blocks: chapter.blocks.map((block) => ({
          ...block,
          title: block.blockType === "imageTransformation" ? "Moon Ink Transformation" : block.title,
          configuration: { ...block.configuration, ...configurations[block.blockType] },
          completion:
            block.blockType === "arrivalCheck"
              ? { mode: "playerConfirmation", fallbackMode: "playerConfirmation" }
              : block.completion,
        })),
      })),
    },
  });
  expect(saveResponse.ok()).toBeTruthy();
  const validationResponse = await page.request.post(`/api/studio/tales/${taleId}/validate`, {
    headers: { "x-csrf-token": csrfToken },
    data: {},
  });
  expect(validationResponse.ok(), await validationResponse.text()).toBeTruthy();
  const validation = (await validationResponse.json()) as { valid: boolean; errors: unknown[] };
  expect(validation.valid, JSON.stringify(validation.errors)).toBe(true);

  await page.reload();
  await page.locator(".timeline-block").filter({ hasText: "Moon Ink Transformation" }).click();
  await page.getByRole("combobox", { name: "Authoring level" }).selectOption("DETAILED");
  await page.locator('[data-section="PRESENTATION"] .contract-section-toggle').click();
  const opacity = page.locator('.alignment-editor input[type="range"]').first();
  await opacity.fill("68");
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.getByRole("button", { name: "Preview Passage" }).click();
  await expect(page.getByRole("dialog", { name: "Moon Ink Transformation" })).toBeVisible();
  await page.getByRole("button", { name: "Replay Passage" }).click();
  await page.getByRole("button", { name: "Close Passage preview" }).click();

  await page.getByRole("button", { name: "Publish Chronicle" }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/tales/${taleId}/versions#publication-review$`));
  await expect(page.getByRole("heading", { name: "Review and publish" })).toBeVisible();
  await expect(page.getByText("NEEDS REPAIR")).toBeVisible();
  await page.getByLabel("Creator release notes").fill("Media-rich Playwright authoring proof");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Publish immutable Version" })).toBeDisabled();
});
