import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
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

async function actor(browser: Browser, label: string): Promise<Actor> {
  const suffix = randomUUID().slice(0, 8);
  const username = `sc07-${label}-${suffix}`;
  const account = await db.userAccount.create({
    data: { status: "ACTIVE", ordinaryWorkspaceEntryAt: new Date(), claimedAt: new Date() },
  });
  await db.playerProfile.create({
    data: {
      accountId: account.id,
      displayName: `Synthetic ${label} Creator`,
      normalizedDisplayName: `synthetic ${label} creator ${suffix}`,
      handle: username,
      normalizedHandle: username,
      defaultVisibility: "PUBLIC",
      status: "ACTIVE",
      claimedAt: new Date(),
    },
  });
  await db.accountEmail.create({
    data: {
      accountId: account.id,
      normalizedEmail: `${username}@example.test`,
      displayEmail: `${username}@example.test`,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await activateWorkspaceCapability(account.id, "CREATOR");
  const videoDir = path.resolve("artifacts/sc07-browser-video");
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
        configuration: { body: "A synthetic harbor greeting for another Creator." },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 1,
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
    compatibility: { minimumReaderVersion: 1, blockContractVersions: { narrative: 1 } },
  };
  const envelope = { ...unsigned, checksum: checksumReusableEnvelope(unsigned) } satisfies ReusableContentEnvelope;
  sourceId = envelope.itemId;
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
    if (video) await video.saveAs(path.resolve(`artifacts/sc07-browser-video/${name}.webm`));
  }
  await db.$disconnect();
});

test("Creator reviews exact saved item and submits it for moderation", async () => {
  const page = owner.page;
  await page.goto("/studio/exchange");
  await expect(page.getByRole("heading", { name: "Open the Exchange" })).toBeVisible();
  await page.getByLabel("Saved source").selectOption(`STORY_BLOCK_PRESET:${sourceId}`);
  await page.getByLabel("Community address").fill(listingSlug);
  await page.getByLabel("Preview-safe description").fill("A fictional greeting for other Creators.");
  await page.getByLabel("License").selectOption("SC07_TEST_REUSE");
  await page.getByLabel("I own or have permission to distribute every included item.").check();
  await page.getByRole("button", { name: "Review exact package" }).click();
  await expect(page.getByRole("heading", { name: "Review before submitting" })).toBeVisible();
  await page.getByText("Inspect every included field").click();
  await expect(page.getByText(/A synthetic harbor greeting for another Creator/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("creator-package-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Submit for moderation" }).click();
  await expect(page.getByText(/Submitted for independent moderation/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("creator-submitted.png"), fullPage: true });
  listingId = (await db.communityListing.findUniqueOrThrow({ where: { slug: listingSlug } })).id;
});

test("second Creator installs the approved release from public detail and opens Studio", async () => {
  const reviewPage = moderator.page;
  await reviewPage.goto(`/admin/community/${listingId}`);
  await expect(reviewPage.getByRole("heading", { name: "Review exact Creator release" })).toBeVisible();
  await reviewPage.getByText("Inspect every included field").click();
  await expect(reviewPage.getByText(/A synthetic harbor greeting for another Creator/)).toBeVisible();
  await reviewPage.screenshot({ path: test.info().outputPath("moderator-exact-package.png"), fullPage: true });
  await reviewPage.getByLabel("Confirm current password for privileged assurance").fill(moderatorPassword);
  await reviewPage.getByRole("button", { name: "Verify identity" }).click();
  await reviewPage.getByLabel(/I reviewed the exact content, ownership declaration/).check();
  await reviewPage.getByRole("button", { name: "Approve and publish release" }).click();
  await expect(reviewPage.getByText("Release approved.")).toBeVisible();
  const review = await db.communityRelease.findFirstOrThrow({ where: { listingId } });
  const page = installer.page;
  await page.goto(`/community/${listingSlug}`);
  await expect(page.getByRole("heading", { name: "Install this saved Creator item" })).toBeVisible();
  await expect(page.getByText(/Credits: Synthetic owner Creator/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("public-install-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Install to my reusable Library" }).click();
  await expect(page.getByRole("link", { name: "View my installed item" })).toBeVisible();
  await page.getByRole("link", { name: "View my installed item" }).click();
  await expect(page).toHaveURL(/\/studio\/exchange#installed-community/u);
  const installedPanel = page.locator("#installed-community");
  await expect(installedPanel.getByRole("heading", { name: "Installed from Community" })).toBeVisible();
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
