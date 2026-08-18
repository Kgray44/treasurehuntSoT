import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { db } from "../../src/lib/db";

test.skip(({ browserName }) => browserName !== "chromium", "The version-pinned mutation workflow runs once.");

const unique = (label: string) => `${label}-${crypto.randomUUID()}`;

async function createStudioCaptain() {
  const username = process.env.GM_USERNAME ?? "kato";
  const password = process.env.GM_PASSWORD ?? "development-captain-only";
  const activatedAt = new Date();
  const gm = await db.gameMasterUser.findUnique({ where: { username } });
  expect(gm, "The governed development fixture must include the Studio Captain.").toBeTruthy();
  const account = await db.userAccount.upsert({
    where: { legacyGameMasterId: gm!.id },
    update: {
      status: "ACTIVE",
      claimedAt: activatedAt,
      ordinaryWorkspaceEntryAt: activatedAt,
    },
    create: {
      status: "ACTIVE",
      legacyGameMasterId: gm!.id,
      claimedAt: activatedAt,
      ordinaryWorkspaceEntryAt: activatedAt,
    },
  });
  const verifiedEmails = await db.accountEmail.updateMany({
    where: { accountId: account.id, isPrimary: true },
    data: { verificationState: "VERIFIED", verifiedAt: activatedAt },
  });
  expect(verifiedEmails.count, "The governed development fixture must include a primary Captain email.").toBe(1);
  const primaryEmail = await db.accountEmail.findFirst({
    where: { accountId: account.id, isPrimary: true },
    select: { displayEmail: true },
  });
  expect(primaryEmail, "The governed development fixture must include a readable primary Captain email.").toBeTruthy();
  await db.accountCredential.upsert({
    where: { accountId: account.id },
    update: { passwordHash: await bcrypt.hash(password, 4), changedAt: activatedAt },
    create: { accountId: account.id, passwordHash: await bcrypt.hash(password, 4) },
  });
  await db.playerProfile.upsert({
    where: { accountId: account.id },
    create: {
      accountId: account.id,
      displayName: "Synthetic Studio Captain",
      status: "ACTIVE",
      claimedAt: activatedAt,
    },
    update: { status: "ACTIVE", claimedAt: activatedAt },
  });
  const sourceTale = await db.chronicle.findUnique({ where: { slug: "development-studio-voyage" } });
  expect(sourceTale, "The governed development fixture must include the Studio Chronicle.").toBeTruthy();
  await db.chronicle.update({
    where: { id: sourceTale!.id },
    data: { creatorId: account.id, creatorAccountId: account.id },
  });
  await db.taleDraft.updateMany({
    where: { taleId: sourceTale!.id },
    data: { createdBy: account.id, createdByAccountId: account.id },
  });
  return { username, password, accountId: account.id, accountLogin: primaryEmail!.displayEmail };
}

async function createOrdinaryPlayer(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  const suffix = crypto.randomUUID();
  const email = `studio-player-${suffix}@example.test`;
  const password = "Cobalt-tide-lantern-2026!";
  const registration = await context.request.post("/api/auth/register", {
    data: {
      displayName: "Synthetic Studio Player",
      email,
      password,
      confirmPassword: password,
    },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const registered = (await registration.json()) as { player: { id: string } };
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: registered.player.id },
    select: { accountId: true },
  });
  expect(profile.accountId, "The registered Studio player must be linked to an account.").toBeTruthy();
  const activatedAt = new Date();
  await db.$transaction([
    db.userAccount.update({
      where: { id: profile.accountId! },
      data: { status: "ACTIVE", claimedAt: activatedAt, ordinaryWorkspaceEntryAt: activatedAt },
    }),
    db.accountEmail.updateMany({
      where: { accountId: profile.accountId!, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt: activatedAt },
    }),
  ]);
  const signIn = await context.request.post("/api/auth/sign-in", { data: { login: email, password } });
  expect(signIn.status(), await signIn.text()).toBe(200);
  const signedIn = (await signIn.json()) as { csrfToken: string };
  return { context, csrfToken: signedIn.csrfToken };
}

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
  const before = await page.locator(".timeline-block").count();
  await page.getByRole("button", { name: `Add ${name} to first chapter` }).click();
  await expect(page.locator(".timeline-block")).toHaveCount(before + 1);
}

test("published Studio tale completes through player, Captain, and helper contracts", async ({ browser }) => {
  const credentials = await createStudioCaptain();
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
  await db.taleSession.update({
    where: { id: sessionId },
    data: { captainId: credentials.accountId, captainAccountId: credentials.accountId },
  });

  const loginResponse = await captain.post("/api/auth/sign-in", {
    data: { login: credentials.accountLogin, password: credentials.password },
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
  const credentials = await createStudioCaptain();
  const login = await page.request.post("/api/gm/login", {
    data: credentials,
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
  expect(restored.ok(), `${restored.status()}: ${await restored.text()}`).toBeTruthy();
  expect(await restored.json()).toMatchObject({ basedOnPublishedVersionId: version.id, revisionNumber: 2 });
});

test("creator authors, aligns, publishes, plays, and reviews a media-rich tale", async ({ page, browser }) => {
  const credentials = await createStudioCaptain();
  const login = await page.request.post("/api/gm/login", {
    data: credentials,
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
      nonMotionMeaning: "The completed moon chart remains visible as a readable route without motion.",
      completionMode: "playerConfirmation",
    },
    artifactReveal: {
      artifactId,
      ordinaryObjectLabel: "practice compass",
      revealArtworkId: afterAssetId,
      loreTitle: "Moon Compass",
      loreDescription: "The needle remembers the route home.",
      addToCollection: true,
      recipientPolicy: "CREW_COLLECTION_ONLY",
      selectedRecipientProfileIds: [],
      requiredCrewRole: null,
      discoveringMembershipId: null,
      personalGrantState: "COLLECTED",
      custodyKind: "PERSONAL",
      assemblyDefinitionId: null,
      componentRole: null,
      receiptState: "ACTIVE",
      correctionOfGrantId: null,
      correctionReason: null,
      revealAnimation: "lantern",
      completionMode: "playerConfirmation",
    },
    image: {
      assetId: afterAssetId,
      caption: "The completed moon chart.",
      altText: "A moonlit route drawn in blue ink",
      displayMode: "journalFrame",
      objectFit: "cover",
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
        blocks: chapter.blocks.map((block, index, blocks) => ({
          ...block,
          title: block.blockType === "imageTransformation" ? "Moon Ink Transformation" : block.title,
          configuration: configurations[block.blockType],
          completion:
            block.blockType === "arrivalCheck"
              ? { ...(block.completion ?? {}), mode: "playerConfirmation", fallbackMode: "playerConfirmation" }
              : block.completion,
          connections:
            index < blocks.length - 1
              ? [{ targetBlockId: blocks[index + 1].id, connectionType: "DEFAULT", orderIndex: 0 }]
              : [],
        })),
      })),
    },
  });
  expect(saveResponse.ok()).toBeTruthy();

  await page.reload();
  await page.locator(".timeline-block").filter({ hasText: "Moon Ink Transformation" }).click();
  await page.getByRole("combobox", { name: "Authoring level" }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Presentation" }).click();
  const opacity = page.locator('.alignment-editor input[type="range"]').first();
  await opacity.fill("68");
  await expect(page.locator(".save-state")).toContainText("Saved at", { timeout: 15_000 });
  await page.getByRole("button", { name: "Preview Passage" }).click();
  await expect(page.getByRole("dialog", { name: "Moon Ink Transformation" })).toBeVisible();
  await page.getByRole("button", { name: "Replay Passage" }).click();
  await page.getByRole("button", { name: "Close Passage preview" }).click();

  const publishResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith(`/api/studio/tales/${taleId}/publish`),
  );
  await page.getByRole("button", { name: "Publish Chronicle" }).click();
  const publishDialog = page.getByRole("dialog", { name: "Publish a new immutable Version?" });
  await publishDialog.getByLabel("Release notes").fill("Media-rich Playwright authoring proof");
  await publishDialog.getByRole("button", { name: "Publish Version" }).click();
  const response = await publishResponse;
  expect(response.status(), await response.text()).toBe(200);
  await expect(page.locator(".save-state")).toContainText(/Published as Version/, { timeout: 30_000 });

  const playerSession = await createOrdinaryPlayer(browser);
  const player = playerSession.context.request;
  const start = await player.post(`/api/tales/${taleSlug}/start`, {
    headers: { "x-csrf-token": playerSession.csrfToken },
    data: {},
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
    const state = await current(player, sessionId);
    expect(state.block?.blockType).toBe(expectedType);
    if (expectedType === "image") expect(state.inventory).toContain(artifactId);
    const advance = await player.post(`/api/play/sessions/${sessionId}`, {
      headers: { "x-csrf-token": playerSession.csrfToken },
      data: { action: "confirm", idempotencyKey: unique(`media-${expectedType}`) },
    });
    expect(advance.ok(), `${advance.status()}: ${await advance.text()}`).toBeTruthy();
  }
  expect((await current(player, sessionId)).session.status).toBe("COMPLETED");
  const playerPage = await playerSession.context.newPage();
  await playerPage.goto(`/play/${taleSlug}/history`);
  await expect(playerPage.getByRole("heading", { name: "Playwright Moon Chart" })).toBeVisible();
  await expect(playerPage.getByText(/^Completed /)).toBeVisible();
  await expect(playerPage.getByRole("listitem").filter({ hasText: "artifact Granted" })).toBeVisible();
  await playerSession.context.close();
});
