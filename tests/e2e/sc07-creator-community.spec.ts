import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createChronicleFixture } from "../fixtures/sc07-chronicle";
import { createReusableFixtureEnvelope } from "../fixtures/sc07-reusable";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { createReusableAuthoringItem } from "../../src/studio/reusable-library-service";
import { checksumReusableEnvelope, type ReusableContentEnvelope } from "../../src/studio/reusable-content";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "serial" });
test.use({ video: "on" });

type Actor = { accountId: string; context: BrowserContext; page: Page };
let owner: Actor;
let installer: Actor;
let moderator: Actor;
let moderatorPassword: string;
let sourceId: string;
let sourceVersionId: string;
let listingSlug: string;
let listingId: string;

function requireOwnedDatabase() {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE === "generic") return ensureGenericSoundingLineIsolation();
  const url = process.env.DATABASE_URL ?? "";
  if (
    !/^file:\.\.\/artifacts\/validation-isolated-sc07-[^/\\]+\.db$/i.test(url) ||
    !path.resolve("artifacts").startsWith(path.resolve(process.cwd()) + path.sep)
  )
    throw new Error("SC07_OWNED_BROWSER_DATABASE_REQUIRED");
}

async function actor(browser: Browser, label: string, creator = true): Promise<Actor> {
  const suffix = randomUUID().slice(0, 8);
  const username = `sc07-${label}-${suffix}`;
  const claimedAt = creator ? new Date() : null;
  const account = await db.userAccount.create({
    data: { status: creator ? "ACTIVE" : "GUEST_UNCLAIMED", ordinaryWorkspaceEntryAt: claimedAt, claimedAt },
  });
  await db.playerProfile.create({
    data: {
      accountId: account.id,
      displayName: creator ? `Synthetic ${label} Creator` : "Synthetic Player",
      normalizedDisplayName: `synthetic ${label} ${suffix}`,
      handle: username,
      normalizedHandle: username,
      defaultVisibility: "PUBLIC",
      status: "ACTIVE",
      claimedAt,
    },
  });
  if (creator) {
    await db.accountEmail.create({
      data: {
        accountId: account.id,
        normalizedEmail: `${username}@example.test`,
        displayEmail: `${username}@example.test`,
        isPrimary: true,
        verificationState: "VERIFIED",
        verifiedAt: claimedAt,
      },
    });
    await activateWorkspaceCapability(account.id, "CREATOR");
  }
  const videoDir = path.join(test.info().project.outputDir, "role-recordings");
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({ recordVideo: { dir: videoDir } });
  const session = await createAccountSession(account.id, "Synthetic SC-07 Creator browser proof");
  await context.addCookies([
    {
      name: "wayfarer_account",
      value: session.token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
      sameSite: "Lax",
    },
  ]);
  return { accountId: account.id, context, page: await context.newPage() };
}

test.beforeAll(async ({ browser }) => {
  requireOwnedDatabase();
  owner = await actor(browser, "owner");
  installer = await actor(browser, "installer");
  moderator = await actor(browser, "moderator");
  moderatorPassword = `Synthetic-SC07-${randomUUID()}!`;
  await db.accountRoleAssignment.create({
    data: { accountId: moderator.accountId, role: "MODERATION_OPERATOR", scopeType: "GLOBAL" },
  });
  await db.accountCredential.create({
    data: { accountId: moderator.accountId, passwordHash: await bcrypt.hash(moderatorPassword, 10) },
  });
  await db.communityLicensePolicy.upsert({
    where: { key: "SC07_TEST_REUSE" },
    create: {
      key: "SC07_TEST_REUSE",
      displayName: "Synthetic reuse",
      active: true,
      allowsPrivateUse: true,
      allowsPublicUse: true,
      allowsModification: true,
      allowsRedistribution: true,
      requiresAttribution: true,
    },
    update: {},
  });
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId: randomUUID(),
    versionId: randomUUID(),
    kind: "PRESET" as const,
    name: "Harbor welcome",
    description: "A fictional welcome Passage.",
    tags: ["intro"],
    ownerId: owner.accountId,
    blocks: [
      {
        id: randomUUID(),
        blockType: "narrative",
        title: "Welcome",
        configuration: { heading: "Welcome", body: "A synthetic harbor greeting for another Creator." },
        presentation: {},
        completion: { mode: "playerConfirmation" },
        isEnabled: true,
        schemaVersion: 2,
      },
    ],
    chapters: [],
    entryPorts: [],
    exitPorts: [],
    parameters: [],
    dependencies: { assetIds: [], artifactIds: [], locationIds: [], providerIds: [] },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: owner.accountId, modified: false },
    lineage: [],
    compatibility: { minimumReaderVersion: 1, blockContractVersions: { narrative: 2 } },
  };
  const envelope = { ...unsigned, checksum: checksumReusableEnvelope(unsigned) } satisfies ReusableContentEnvelope;
  sourceId = envelope.itemId;
  sourceVersionId = envelope.versionId;
  await createReusableAuthoringItem(owner.accountId, envelope);
  listingSlug = `sc07-browser-${randomUUID().slice(0, 8)}`;
});

test.afterAll(async () => {
  for (const [name, participant] of [
    ["owner", owner],
    ["installer", installer],
    ["moderator", moderator],
  ] as const) {
    if (!participant) continue;
    const video = participant.page.video();
    await participant.context.close();
    if (video) await video.saveAs(path.join(test.info().project.outputDir, "role-recordings", `${name}.webm`));
  }
  await db.$disconnect();
});

test("only the owner with Creator access submits the exact saved item for moderation", async ({ browser }) => {
  const page = owner.page;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/exchange");
  await expect(page.getByRole("heading", { name: "Open the Exchange" })).toBeVisible();
  await page.getByLabel("Saved source").selectOption(`STORY_BLOCK_PRESET:${sourceId}`);
  await page.getByLabel("Community address").fill(listingSlug);
  await page.getByLabel("Preview-safe description").fill("A fictional greeting for other Creators.");
  await page.getByLabel("License").selectOption("SC07_TEST_REUSE");
  await page.getByLabel("I own or have permission to distribute every included item.").check();
  const reviewed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/community/creator-reuse/preflight",
  );
  await page.getByRole("button", { name: "Review exact package" }).press("Enter");
  const preflight = await reviewed;
  expect(preflight.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Review before submitting" })).toBeVisible();
  await page.getByText("Inspect every included field", { exact: true }).press("Enter");
  await expect(page.getByText(/A synthetic harbor greeting for another Creator/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("creator-package-review.png"), fullPage: true });

  const publishRequest = {
    publication: preflight.request().postDataJSON(),
    reviewDigest: (await preflight.json()).reviewDigest,
  };
  const player = await actor(browser, "player", false);
  try {
    await player.page.goto("/studio/exchange");
    await expect(player.page.getByRole("heading", { name: "Creator access is required." })).toBeVisible();
    for (const { participant, status, code } of [
      { participant: player, status: 403, code: "COMMUNITY_ACCESS_DENIED" },
      { participant: installer, status: 400, code: "COMMUNITY_SOURCE_NOT_OWNED" },
    ]) {
      const session = await participant.page.request.get("/api/player/session");
      expect(session.ok()).toBe(true);
      const { csrfToken } = await session.json();
      expect(csrfToken).toBeTruthy();
      const denied = await participant.page.request.post("/api/community/creator-reuse/publish", {
        data: publishRequest,
        headers: { "x-csrf-token": csrfToken },
      });
      expect(denied.status()).toBe(status);
      expect(await denied.json()).toMatchObject({ code });
    }
    expect(await db.communityListing.count({ where: { slug: listingSlug } })).toBe(0);
  } finally {
    await player.context.close();
  }

  await page.getByRole("button", { name: "Submit for moderation" }).press("Enter");
  const confirmation = page.getByRole("status").filter({ hasText: "Submitted for independent moderation" });
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: test.info().outputPath("creator-submitted.png") });
  listingId = (await db.communityListing.findUniqueOrThrow({ where: { slug: listingSlug } })).id;
  const ownerReview = await page.request.get(`/api/admin/community/creator-reuse/${listingId}/review`);
  expect(ownerReview.status()).toBe(403);
  expect(await ownerReview.text()).not.toContain("A synthetic harbor greeting for another Creator.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await installer.page.goto("/community/templates");
  await expect(installer.page.locator(`a[href="/community/${listingSlug}"]`)).toHaveCount(0);
  await installer.page.screenshot({
    path: test.info().outputPath("public-catalog-before-approval.png"),
    fullPage: true,
  });
});

test("Studio explains why an unsupported dependency blocks Creator submission", async () => {
  const { checksum: _checksum, ...fixture } = createReusableFixtureEnvelope(owner.accountId, "PRESET");
  const source = {
    ...fixture,
    name: "Welcome with an external asset",
    dependencies: { ...fixture.dependencies, assetIds: [randomUUID()] },
  };
  await createReusableAuthoringItem(owner.accountId, { ...source, checksum: checksumReusableEnvelope(source) });
  const slug = `sc07-blocked-${randomUUID().slice(0, 8)}`;
  const page = owner.page;
  await page.goto("/studio/exchange");
  await page.getByLabel("Saved source").selectOption(`STORY_BLOCK_PRESET:${source.itemId}`);
  await page.getByLabel("Community address").fill(slug);
  await page.getByLabel("Preview-safe description").fill("A fictional preset with an unverified reference.");
  await page.getByLabel("License").selectOption("SC07_TEST_REUSE");
  await page.getByLabel("I own or have permission to distribute every included item.").check();
  const reviewed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/community/creator-reuse/preflight",
  );
  await page.getByRole("button", { name: "Review exact package" }).press("Enter");
  const response = await reviewed;
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ code: "COMMUNITY_DEPENDENCY_UNSUPPORTED" });
  const refusal = page.getByRole("alert").filter({ hasText: "cannot yet be packaged with verified rights" });
  await expect(refusal).toBeInViewport({ ratio: 1 });
  await expect(refusal).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("unsupported-dependency-refusal.png") });
  await expect(page.getByRole("button", { name: "Submit for moderation" })).toHaveCount(0);
  expect(await db.communityListing.count({ where: { slug } })).toBe(0);
});

test("second Creator installs the approved Passage preset and applies it in private Studio", async () => {
  const reviewPage = moderator.page;
  await reviewPage.setViewportSize({ width: 390, height: 844 });
  await reviewPage.emulateMedia({ reducedMotion: "reduce" });
  await reviewPage.goto(`/admin/community/${listingId}`);
  await expect(reviewPage.getByRole("heading", { name: "Review exact Creator release" })).toBeVisible();
  await expect(reviewPage.getByRole("cell", { name: /^Awaiting approval/ })).toBeVisible();
  await reviewPage.getByText("Inspect every included field").press("Enter");
  await expect(reviewPage.getByText(/A synthetic harbor greeting for another Creator/)).toBeVisible();
  expect(await reviewPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const packageChecksum = reviewPage.getByText(/^Package checksum: [a-f0-9]{64}$/);
  expect(
    await packageChecksum.evaluate((element) => {
      const text = document.createRange();
      text.selectNodeContents(element);
      return [...text.getClientRects()].every((line) => line.left >= 0 && line.right <= innerWidth);
    }),
  ).toBe(true);
  const listingCopy = reviewPage.getByRole("button", { name: "Copy listing ID" });
  expect(
    await listingCopy.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }),
  ).toBe(true);
  await reviewPage.screenshot({ path: test.info().outputPath("moderator-exact-package.png"), fullPage: true });
  await reviewPage.getByLabel("Confirm current password for privileged assurance").fill(moderatorPassword);
  await reviewPage.getByRole("button", { name: "Verify identity" }).press("Enter");
  const acknowledgement = reviewPage.getByLabel(/I reviewed the exact content, ownership declaration/);
  await acknowledgement.press("Space");
  await expect(acknowledgement).toBeChecked();
  const approve = reviewPage.getByRole("button", { name: "Approve and publish release" });
  await expect(approve).toBeEnabled();
  await approve.press("Enter");
  const approval = reviewPage.getByRole("status").filter({ hasText: "Release approved." });
  await expect(approval).toBeFocused();
  await expect(approval).toBeInViewport({ ratio: 1 });
  await expect(reviewPage.getByRole("cell", { name: /^Awaiting approval/ })).toHaveCount(0);
  await expect(approval).toBeFocused();
  await reviewPage.screenshot({ path: test.info().outputPath("moderator-approved-receipt.png") });
  await reviewPage.setViewportSize({ width: 1280, height: 800 });
  const review = await db.communityRelease.findFirstOrThrow({ where: { listingId } });
  const page = installer.page;
  await page.goto("/community/templates");
  const listing = page.locator(`a[href="/community/${listingSlug}"]`).first();
  await expect(listing).toBeVisible();
  await listing.press("Enter");
  await expect(page).toHaveURL(`/community/${listingSlug}`);
  await expect(page.getByRole("heading", { name: "Install this saved Creator item" })).toBeVisible();
  await expect(page.getByText(/Credits: Synthetic owner Creator/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-install-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Install to my reusable Library" }).press("Enter");
  await expect(page.getByRole("link", { name: "View my installed item" })).toBeVisible();
  await page.getByRole("link", { name: "View my installed item" }).click();
  await expect(page).toHaveURL(/\/studio\/exchange#installed-community/u);
  const installedPanel = page.locator("#installed-community");
  const installedHeading = installedPanel.getByRole("heading", { name: "Installed from Community" });
  await expect(installedHeading).toBeInViewport();
  await expect
    .poll(async () => {
      const heading = await installedHeading.boundingBox();
      const header = await page.getByRole("banner").boundingBox();
      return heading !== null && header !== null && heading.y >= header.y + header.height;
    })
    .toBe(true);
  await expect(installedPanel.getByText("Credits: Synthetic owner Creator.")).toBeVisible();
  await expect(installedPanel.getByText(review.packageChecksum!)).toBeVisible();
  await installedPanel.screenshot({ path: test.info().outputPath("installed-private-studio.png") });
  const receipt = await db.communityInstallation.findFirstOrThrow({
    where: {
      accountId: installer.accountId,
      releaseId: review.id,
    },
  });
  expect(receipt.installedPackageChecksum).toBe(review.packageChecksum);

  const destination = await createStudioTale({
    creatorId: installer.accountId,
    title: "Private Passage destination",
    slug: `sc07-passage-${randomUUID().slice(0, 8)}`,
  });
  const initial = await getStudioTale(destination.id);
  const target = {
    id: randomUUID(),
    blockType: "narrative",
    title: "Destination Passage",
    configuration: { heading: "Draft greeting", body: "A private draft greeting." },
    presentation: {},
    completion: { mode: "playerConfirmation" },
    isEnabled: true,
    schemaVersion: 2,
  };
  await saveStudioDraft(
    destination.id,
    {
      autosaveVersion: initial.draft.autosaveVersion,
      tale: { ...initial.tale, visibility: "PRIVATE" },
      chapters: [{ ...initial.draft.chapters[0], blocks: [target] }],
    },
    installer.accountId,
  );
  await installedPanel.getByRole("link", { name: "Open a Chronicle to reuse an installed item" }).press("Enter");
  const destinationCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Private Passage destination" }) });
  await destinationCard.getByRole("link", { name: "Edit Chronicle" }).press("Enter");
  await expect(page).toHaveURL(`/studio/tales/${destination.id}`);
  await page.getByRole("group", { name: "Passage: Destination Passage" }).press("Enter");
  await page.getByRole("tab", { name: "Reuse" }).press("Enter");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Harbor welcome" })
    .getByRole("button", { name: "Apply to selected Passage" })
    .press("Enter");
  await expect
    .poll(async () => {
      const studio = await getStudioTale(destination.id);
      const usage = await db.reusableAuthoringUsage.findFirst({ where: { draftId: destination.draftId } });
      return {
        visibility: studio.tale.visibility,
        body: studio.draft.chapters[0].blocks[0].configuration.body,
        provenance: usage ? JSON.parse(usage.provenance) : null,
      };
    })
    .toMatchObject({
      visibility: "PRIVATE",
      body: "A synthetic harbor greeting for another Creator.",
      provenance: {
        sourceReleaseId: review.id,
        sourceOwnerId: owner.accountId,
        sourceItemId: sourceId,
        sourceVersionId,
        license: "SC07_TEST_REUSE",
        modified: true,
      },
    });
  await page.screenshot({ path: test.info().outputPath("passage-preset-private-reuse.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/community/${listingSlug}`);
  await expect(page.getByRole("link", { name: "View my installed item" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("mobile-installed-return.png"), fullPage: true });
});

test("signed-out mobile visitor gets a Creator sign-in return path without package content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/community/${listingSlug}`);
  await expect(page.getByRole("link", { name: "Sign in with Creator access" })).toBeVisible();
  await expect(page.getByText("A synthetic harbor greeting for another Creator.")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("mobile-signed-out-install.png"), fullPage: true });
});

test("second Creator edits an installed Chronicle through private Studio", async () => {
  const suffix = randomUUID().slice(0, 8);
  const slug = `sc07-chronicle-${suffix}`;
  const { source, version } = await createChronicleFixture(owner.accountId, suffix);
  const ownerPage = owner.page;
  await ownerPage.goto("/studio");
  await ownerPage.getByRole("link", { name: "Community Exchange" }).press("Enter");
  await ownerPage.getByLabel("Saved source").selectOption(`CHRONICLE:${version.id}`);
  await ownerPage.getByLabel("Community address").fill(slug);
  await ownerPage.getByLabel("Preview-safe description").fill("A fictional Chronicle for other Creators.");
  await ownerPage.getByLabel("License").selectOption("SC07_TEST_REUSE");
  await ownerPage.getByLabel("I own or have permission to distribute every included item.").check();
  await ownerPage.getByLabel(/I reviewed the full Chronicle for spoilers/).check();
  await ownerPage.getByRole("button", { name: "Review exact package" }).press("Enter");
  await ownerPage.getByText("Inspect every included field", { exact: true }).press("Enter");
  await expect(ownerPage.getByText(/A fictional harbor awaits/)).toBeVisible();
  await ownerPage.getByRole("button", { name: "Submit for moderation" }).press("Enter");
  await expect(ownerPage.getByText(/Submitted for independent moderation/)).toBeVisible();

  const moderatorPage = moderator.page;
  await moderatorPage.goto("/admin/community");
  await moderatorPage.getByLabel("Search Community content").fill(slug);
  await moderatorPage.getByRole("button", { name: "Search", exact: true }).press("Enter");
  await moderatorPage.getByRole("link", { name: "Synthetic Harbor Tale", exact: true }).press("Enter");
  await moderatorPage.getByText("Inspect every included field", { exact: true }).press("Enter");
  await expect(moderatorPage.getByText(/A fictional harbor awaits/)).toBeVisible();
  await moderatorPage.getByLabel(/I reviewed the exact content, ownership declaration/).check();
  await moderatorPage.getByRole("button", { name: "Approve and publish release" }).press("Enter");
  await expect(moderatorPage.getByText("Release approved.")).toBeVisible();

  const installerPage = installer.page;
  await installerPage.setViewportSize({ width: 390, height: 844 });
  await installerPage.emulateMedia({ reducedMotion: "reduce" });
  await installerPage.goto("/community/chronicles");
  await installerPage.locator(`a[href="/community/${slug}"]`).first().press("Enter");
  await expect(installerPage.getByRole("heading", { name: "Copy this Chronicle privately" })).toBeVisible();
  await expect(installerPage.getByText(/Credits: Synthetic owner Creator/)).toBeVisible();
  await expect(installerPage.getByText(/A fictional harbor awaits/)).toHaveCount(0);
  await installerPage.getByRole("button", { name: "Copy to my Studio" }).press("Enter");
  await installerPage.getByRole("link", { name: "Open my private Chronicle" }).press("Enter");
  await expect(installerPage).toHaveURL(/\/studio\/tales\/[^/]+$/u);
  const installedId = new URL(installerPage.url()).pathname.split("/").at(-1)!;
  await installerPage.getByRole("button", { name: "Chronicle Details" }).press("Enter");
  const details = installerPage.getByRole("region", { name: "Chronicle Details" });
  const editedTitle = "Private Harbor Chronicle";
  await details.getByRole("textbox", { name: "Title", exact: true }).fill(editedTitle);
  await details.getByRole("button", { name: "Save details" }).press("Enter");
  await expect
    .poll(() => db.chronicle.findUnique({ where: { id: installedId }, select: { title: true } }))
    .toEqual({ title: editedTitle });
  await expect(installerPage.getByRole("region", { name: "Chronicle Details" }).getByRole("status")).toHaveText(
    /^Saved at/,
  );
  await installerPage.screenshot({ path: test.info().outputPath("chronicle-private-edit.png"), fullPage: true });
  expect(await db.chronicle.findUnique({ where: { id: source.id }, select: { title: true } })).toEqual({
    title: "Synthetic Harbor Tale",
  });
  expect(await db.publishedTaleVersion.findUnique({ where: { id: version.id }, select: { checksum: true } })).toEqual({
    checksum: version.checksum,
  });
  await ownerPage.goto(`/studio/tales/${installedId}`);
  await expect(ownerPage.getByRole("heading", { name: "Chronicle access unavailable" })).toBeVisible();
});

test("Chapter template rejection stays private and installation rechecks the current release", async ({ request }) => {
  test.setTimeout(75_000);
  const suffix = randomUUID().slice(0, 8);
  const slug = `sc07-template-${suffix}`;
  const envelope = createReusableFixtureEnvelope(owner.accountId, "CHAPTER_TEMPLATE");
  await createReusableAuthoringItem(owner.accountId, envelope);
  const ownerPage = owner.page;
  const moderatorPage = moderator.page;
  const installerPage = installer.page;
  await installerPage.setViewportSize({ width: 1280, height: 800 });
  const listingLink = `a[href="/community/${slug}"]`;

  async function submitTemplate(replaceListingId?: string) {
    await ownerPage.goto("/studio/exchange");
    await ownerPage.getByLabel("Saved source").selectOption(`CHRONICLE_TEMPLATE:${envelope.itemId}`);
    if (replaceListingId) await ownerPage.getByLabel("Publication destination").selectOption(replaceListingId);
    else await ownerPage.getByLabel("Community address").fill(slug);
    await ownerPage.getByLabel("Preview-safe description").fill("A fictional Chapter template for other Creators.");
    await ownerPage.getByLabel("License").selectOption("SC07_TEST_REUSE");
    await ownerPage.getByLabel("I own or have permission to distribute every included item.").check();
    await ownerPage.getByRole("button", { name: "Review exact package" }).press("Enter");
    await ownerPage.getByRole("button", { name: "Submit for moderation" }).press("Enter");
    await expect(ownerPage.getByText(/Submitted for independent moderation/)).toBeVisible();
  }

  async function openTemplateReview(templateListingId: string) {
    await moderatorPage.goto(`/admin/community/${templateListingId}`);
    await moderatorPage.getByText("Inspect every included field", { exact: true }).press("Enter");
    await expect(moderatorPage.getByText(/Welcome to the fictional harbor/)).toBeVisible();
    const password = moderatorPage.getByLabel("Confirm current password for privileged assurance");
    if (await password.isVisible()) {
      await password.fill(moderatorPassword);
      await moderatorPage.getByRole("button", { name: "Verify identity" }).press("Enter");
    }
    await moderatorPage.getByLabel(/I reviewed the exact content, ownership declaration/).check();
  }

  await submitTemplate();
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug } });
  const rejectedId = listing.currentReleaseId!;
  await openTemplateReview(listing.id);
  await moderatorPage.getByLabel("Rejection reason for the moderation record").fill("Clarify the preview description.");
  await moderatorPage.getByRole("button", { name: "Reject release" }).press("Enter");
  await expect(
    moderatorPage.getByRole("status").filter({ hasText: "Release rejected. It remains private." }),
  ).toBeFocused();
  await installerPage.goto("/community/templates");
  await expect(installerPage.locator(listingLink)).toHaveCount(0);
  await installerPage.goto(`/community/${slug}`);
  await expect(installerPage.getByText(/Welcome to the fictional harbor/)).toHaveCount(0);
  await expect(installerPage.getByRole("button", { name: "Install to my reusable Library" })).toHaveCount(0);

  await submitTemplate(listing.id);
  await openTemplateReview(listing.id);
  await moderatorPage.getByRole("button", { name: "Approve and publish release" }).press("Enter");
  await expect(moderatorPage.getByText("Release approved.")).toBeVisible();
  const approved = await db.communityListing.findUniqueOrThrow({ where: { slug }, include: { currentRelease: true } });
  expect(approved.currentRelease?.semanticVersion).toBe("2.0.0");
  expect(approved.currentReleaseId).not.toBe(rejectedId);
  const publicReplacement = await request.get(`/api/community/releases/${approved.currentReleaseId}/public`);
  expect(publicReplacement.status()).toBe(200);
  expect(await publicReplacement.json()).toMatchObject({ semanticVersion: "2.0.0" });
  const rejectedRelease = await request.get(`/api/community/releases/${rejectedId}/public`);
  expect(rejectedRelease.status()).toBe(404);
  expect(await rejectedRelease.json()).toMatchObject({ code: "COMMUNITY_RELEASE_NOT_FOUND" });
  await installerPage.goto("/community/templates");
  await installerPage.locator(listingLink).first().press("Enter");
  const install = installerPage.getByRole("button", { name: "Install to my reusable Library" });
  await expect(installerPage.getByText(/release 2\.0\.0 by Synthetic owner Creator/)).toBeVisible();
  const { checksum: _checksum, ...original } = envelope;
  const updated = { ...original, versionId: randomUUID(), description: "An updated fictional harbor introduction." };
  const checksum = checksumReusableEnvelope(updated);
  await db.$transaction([
    db.reusableAuthoringItemVersion.create({
      data: {
        id: updated.versionId,
        itemId: updated.itemId,
        versionNumber: 2,
        envelope: JSON.stringify({ ...updated, checksum }),
        checksum,
      },
    }),
    db.reusableAuthoringItem.update({
      where: { id: updated.itemId },
      data: { currentVersionNumber: 2, description: updated.description },
    }),
  ]);
  await submitTemplate(listing.id);
  await openTemplateReview(listing.id);
  await moderatorPage.getByRole("button", { name: "Approve and publish release" }).press("Enter");
  await expect(moderatorPage.getByText("Release approved.")).toBeVisible();
  const replacement = await db.communityListing.findUniqueOrThrow({
    where: { slug },
    include: { currentRelease: true },
  });
  expect(replacement.currentRelease?.semanticVersion).toBe("3.0.0");
  const staleInstall = installerPage.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/community/creator-reuse/install/commit",
  );
  await install.press("Enter");
  const staleResponse = await staleInstall;
  expect(staleResponse.status()).toBe(400);
  expect(await staleResponse.json()).toMatchObject({ code: "COMMUNITY_REVIEW_STALE" });
  const staleAlert = installerPage.getByRole("alert").filter({ hasText: "The release changed" });
  await expect(staleAlert).toBeVisible();
  const refresh = installerPage.getByRole("button", { name: "Review current release" });
  await expect(refresh).toBeFocused();
  await expect(refresh).toBeInViewport();
  await expect(staleAlert).toBeInViewport();
  await expect(install).toHaveCount(0);
  await installerPage.screenshot({ path: test.info().outputPath("outdated-install-review.png") });
  await refresh.press("Enter");
  const currentReview = installerPage.getByRole("region", { name: "Install this saved Creator item" });
  await expect(currentReview.getByText(/release 3\.0\.0 by Synthetic owner Creator/)).toBeInViewport({ ratio: 1 });
  await expect(currentReview.getByRole("heading", { name: "Install this saved Creator item" })).toBeFocused();
  await expect(currentReview.getByText(/An updated fictional harbor introduction/)).toBeInViewport({ ratio: 1 });
  await expect(currentReview.getByText(/License: Synthetic reuse/)).toBeInViewport({ ratio: 1 });
  await expect(currentReview.getByText("Credits: Synthetic owner Creator", { exact: true })).toBeInViewport({
    ratio: 1,
  });
  expect(
    await db.communityInstallation.count({
      where: {
        accountId: installer.accountId,
        releaseId: { in: [approved.currentReleaseId!, replacement.currentReleaseId!] },
      },
    }),
  ).toBe(0);
  await installerPage.screenshot({ path: test.info().outputPath("current-install-review.png") });
  await install.press("Enter");
  await installerPage.getByRole("link", { name: "View my installed item" }).press("Enter");
  const installed = installerPage.getByRole("listitem").filter({ hasText: "Harbor opening" });
  await expect(installed.getByText("Credits: Synthetic owner Creator.")).toBeVisible();
  await expect(installed).toContainText("Synthetic reuse");

  const draft = await createStudioTale({
    creatorId: installer.accountId,
    title: "Private Chapter destination",
    slug: `sc07-private-${suffix}`,
  });
  await installerPage.getByRole("link", { name: "Open a Chronicle to reuse an installed item" }).press("Enter");
  const draftCard = installerPage
    .getByRole("article")
    .filter({ has: installerPage.getByRole("heading", { name: "Private Chapter destination" }) });
  await draftCard.getByRole("link", { name: "Edit Chronicle" }).press("Enter");
  await expect(installerPage).toHaveURL(`/studio/tales/${draft.id}`);
  await installerPage.getByRole("tab", { name: "Reuse" }).press("Enter");
  await installerPage
    .getByRole("listitem")
    .filter({ hasText: "Harbor opening" })
    .getByRole("button", { name: "Insert as new Chapter" })
    .press("Enter");
  await installerPage.getByRole("button", { name: "Insert reusable content" }).press("Enter");
  await expect
    .poll(async () => {
      const usage = await db.reusableAuthoringUsage.findFirst({ where: { draftId: draft.draftId } });
      return usage ? JSON.parse(usage.provenance) : null;
    })
    .toMatchObject({
      sourceReleaseId: replacement.currentReleaseId,
      sourceOwnerId: owner.accountId,
      sourceItemId: envelope.itemId,
      sourceVersionId: updated.versionId,
      license: "SC07_TEST_REUSE",
      modified: true,
    });
  await installerPage.screenshot({
    path: test.info().outputPath("chapter-template-private-reuse.png"),
    fullPage: true,
  });
});
