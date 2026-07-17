import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";

test.skip(({ browserName }) => browserName !== "chromium", "The version-pinned mutation workflow runs once.");

const unique = (label: string) => `${label}-${crypto.randomUUID()}`;

async function current(request: APIRequestContext, sessionId: string) {
  const response = await request.get(`/api/play/sessions/${sessionId}`);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    session: { status: string; versionId: string };
    block: { id: string; blockType: string; title: string } | null;
    pendingVerification: { id: string; providerType: string } | null;
    inventory: string[];
  }>;
}

async function dragLibraryBlock(page: Page, name: string) {
  const source = page.locator(".block-library article").filter({ has: page.getByText(name, { exact: true }) });
  const target = page.locator(".timeline-drop").last();
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  const before = await page.locator(".timeline-block").count();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".timeline-block")).toHaveCount(before + 1);
}

test("published Studio tale completes through player, Captain, and helper contracts", async ({ browser }) => {
  const playerContext = await browser.newContext();
  const captainContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  const player = playerContext.request;
  const captain = captainContext.request;

  const catalogResponse = await player.get("/api/tales");
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = (await catalogResponse.json()) as {
    tales: Array<{ slug: string; title: string; version: string }>;
  };
  expect(catalog.tales).toContainEqual(expect.objectContaining({ slug: "development-studio-voyage", version: "1.0" }));

  const startResponse = await player.post("/api/tales/development-studio-voyage/start", {
    data: { ownerLabel: "Playwright Crew" },
  });
  expect(startResponse.status()).toBe(201);
  const started = (await startResponse.json()) as { sessionId: string };
  const sessionId = started.sessionId;
  expect((await strangerContext.request.get(`/api/play/sessions/${sessionId}`)).status()).toBe(401);

  let state = await current(player, sessionId);
  const pinnedVersionId = state.session.versionId;
  expect(state.block).toMatchObject({ blockType: "narrative", title: "The Lantern Wakes" });

  let response = await player.post(`/api/play/sessions/${sessionId}`, {
    data: { action: "continue", idempotencyKey: unique("narrative") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, sessionId);
  expect(state.pendingVerification?.providerType).toBe("textAnswer");

  response = await player.post(`/api/play/sessions/${sessionId}`, {
    data: { action: "answer", answer: "anchor", idempotencyKey: unique("wrong-answer") },
  });
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).accepted).toBe(false);
  expect((await current(player, sessionId)).block?.blockType).toBe("riddle");

  response = await player.post(`/api/play/sessions/${sessionId}`, {
    data: { action: "answer", answer: "  LANTERN  ", idempotencyKey: unique("right-answer") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, sessionId);
  expect(state.block?.blockType).toBe("captainApproval");
  expect(state.pendingVerification?.providerType).toBe("captainManual");

  const loginResponse = await captain.post("/api/gm/login", {
    data: { username: process.env.GM_USERNAME, password: process.env.GM_PASSWORD },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { csrfToken } = (await loginResponse.json()) as { csrfToken: string };

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
  state = await current(player, sessionId);
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
    response = await player.post(`/api/play/sessions/${sessionId}`, {
      data: { action: "continue", idempotencyKey: unique(`continue-${expectedType}`) },
    });
    expect(response.ok()).toBeTruthy();
    state = await current(player, sessionId);
    expect(state.block?.blockType).toBe(expectedType);
    expect(state.session.versionId).toBe(pinnedVersionId);
  }
  response = await player.post(`/api/play/sessions/${sessionId}`, {
    data: { action: "continue", idempotencyKey: unique("complete-tale") },
  });
  expect(response.ok()).toBeTruthy();
  state = await current(player, sessionId);
  expect(state.session.status).toBe("COMPLETED");
  expect(state.session.versionId).toBe(pinnedVersionId);
  const completedCatalog = (await (await player.get("/api/tales")).json()) as {
    tales: Array<{ slug: string; playerState: string; sessionId: string | null }>;
  };
  expect(completedCatalog.tales).toContainEqual(
    expect.objectContaining({ slug: "development-studio-voyage", playerState: "COMPLETED", sessionId }),
  );

  await playerContext.close();
  await captainContext.close();
  await strangerContext.close();
});

test("Studio editor exposes searchable authoring tools and responsive isolated preview", async ({ page }) => {
  const login = await page.request.post("/api/gm/login", {
    data: { username: process.env.GM_USERNAME, password: process.env.GM_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const studioResponse = await page.request.get("/api/studio/tales");
  expect(studioResponse.ok()).toBeTruthy();
  const studio = (await studioResponse.json()) as { tales: Array<{ id: string; slug: string }> };
  const tale = studio.tales.find((item) => item.slug === "development-studio-voyage");
  expect(tale).toBeTruthy();

  await page.goto(`/studio/tales/${tale!.id}`);
  await expect(page.getByRole("tab", { name: "Blocks" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chapters" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Outline" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search story blocks" })).toBeVisible();
  await expect(page.locator(".block-library article").first()).toHaveAttribute(
    "aria-roledescription",
    "sortable story block",
  );
  await page.locator(".timeline-block").first().click();
  await expect(page.getByRole("button", { name: "Preview Block" })).toBeEnabled();
  await page.getByRole("button", { name: "Preview Block" }).click();
  await expect(page.getByRole("dialog", { name: "The Lantern Wakes" })).toBeVisible();
  await page.getByRole("button", { name: "Mobile" }).click();
  await page.getByLabel("Reduced motion").check();
  await expect(page.locator(".block-preview-viewport.mobile.reduced-motion")).toBeVisible();
  await page.getByRole("button", { name: "Close block preview" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".timeline-block").first().click();
  await expect(page.getByRole("button", { name: "Close block inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Close block inspector" }).click();
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
  expect(restored.ok()).toBeTruthy();
  expect(await restored.json()).toMatchObject({ basedOnPublishedVersionId: version.id, revisionNumber: 2 });
});

test("creator authors, aligns, publishes, plays, and reviews a media-rich tale", async ({ page }) => {
  const login = await page.request.post("/api/gm/login", {
    data: { username: process.env.GM_USERNAME, password: process.env.GM_PASSWORD },
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
  await page.getByRole("button", { name: "Create and open editor" }).click();
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
    "Tale Complete",
  ])
    await dragLibraryBlock(page, name);
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
        blocks: Array<{ id: string; blockType: string; title: string; configuration: Record<string, unknown> }>;
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
          configuration: configurations[block.blockType],
        })),
      })),
    },
  });
  expect(saveResponse.ok()).toBeTruthy();

  await page.reload();
  await page.locator(".timeline-block").filter({ hasText: "Moon Ink Transformation" }).click();
  const opacity = page.locator('.alignment-editor input[type="range"]').first();
  await opacity.fill("68");
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.getByRole("button", { name: "Preview Block" }).click();
  await expect(page.getByRole("dialog", { name: "Moon Ink Transformation" })).toBeVisible();
  await page.getByRole("button", { name: "Replay block" }).click();
  await page.getByRole("button", { name: "Close block preview" }).click();

  const publishDetail = (await (await page.request.get(`/api/studio/tales/${taleId}`)).json()) as {
    draft: { autosaveVersion: number };
  };
  const publish = await page.request.post(`/api/studio/tales/${taleId}/publish`, {
    headers: { "x-csrf-token": csrfToken },
    data: {
      releaseNotes: "Media-rich Playwright authoring proof",
      autosaveVersion: publishDetail.draft.autosaveVersion,
    },
  });
  expect(publish.ok()).toBeTruthy();

  const start = await page.request.post(`/api/tales/${taleSlug}/start`, {
    data: { ownerLabel: "Moon Chart Crew" },
  });
  expect(start.status(), await start.text()).toBe(201);
  const { sessionId } = (await start.json()) as { sessionId: string };
  for (const expectedType of [
    "arrivalCheck",
    "imageTransformation",
    "artifactReveal",
    "image",
    "confirmation",
    "taleComplete",
  ]) {
    const state = await current(page.request, sessionId);
    expect(state.block?.blockType).toBe(expectedType);
    if (expectedType === "image") expect(state.inventory).toContain(artifactId);
    const advance = await page.request.post(`/api/play/sessions/${sessionId}`, {
      data: { action: "confirm", idempotencyKey: unique(`media-${expectedType}`) },
    });
    expect(advance.ok()).toBeTruthy();
  }
  expect((await current(page.request, sessionId)).session.status).toBe("COMPLETED");
  await page.goto(`/play/${taleSlug}/history`);
  await expect(page.getByRole("heading", { name: "Playwright Moon Chart" })).toBeVisible();
  await expect(page.getByText(/^Completed /)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "artifact Granted" })).toBeVisible();
});
