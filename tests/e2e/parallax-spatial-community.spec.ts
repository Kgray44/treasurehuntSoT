import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, editSpatialDraft } from "../../src/parallax/authoring";
import { extractComposition, insertSpatialElement } from "../../src/parallax/element-authoring";
import { createEmptyEnvironment } from "../../src/parallax/environment-library-authoring";
import { environmentReleaseReference } from "../../src/parallax/environment-version-resolution";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  releaseEnvironmentVersion,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
} from "../../src/parallax/library-lifecycle-service";
import { listSpatialItems, saveSpatialDraft } from "../../src/parallax/library-service";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.afterAll(() => db.$disconnect());

function requireOwnedBrowser() {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE === "generic") {
    ensureGenericSoundingLineIsolation();
    return;
  }
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/^file:.*validation-isolated-sc07a-[^/\\]*\.db$/i.test(process.env.DATABASE_URL ?? "")
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
}

async function creator(name: string) {
  const account = await closureAccount(name);
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: account.id },
    data: { handle: `spatial-${suffix}`, normalizedHandle: `spatial-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(account.id, "CREATOR");
  return account;
}

async function libraryDetail(page: Page, kind: string, name: string) {
  const library = page.locator('section[aria-label="Spatial content library"]');
  const openButton = page.getByRole("button", { name: /Open (Spatial )?Library/ });
  const ensureOpen = async () => {
    if ((await openButton.getAttribute("aria-pressed")) !== "true") await openButton.click();
  };
  await ensureOpen();
  const tab = library.getByRole("tab", { name: kind });
  try {
    await tab.click({ timeout: 3_000 });
  } catch (cause) {
    if ((await openButton.getAttribute("aria-pressed")) === "true") throw cause;
    await ensureOpen();
    await tab.click({ timeout: 5_000 });
  }
  const inspect = library.getByRole("button", { name: `Inspect ${name}` });
  try {
    await inspect.click({ timeout: 3_000 });
  } catch (cause) {
    if ((await openButton.getAttribute("aria-pressed")) === "true") throw cause;
    await ensureOpen();
    await tab.click({ timeout: 5_000 });
    await inspect.click({ timeout: 5_000 });
  }
  const details = library.getByRole("complementary", { name: `${name} details` });
  await expect(details).toBeVisible();
  return details;
}

async function submitWizard(
  page: Page,
  slug: string,
  description: string,
  includesEnvironment = false,
  existingListingId?: string,
  expectedResolvedContent?: string,
  reviewScreenshotPath?: string,
) {
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toBeVisible();
  await wizard.getByRole("button", { name: "Continue" }).click();
  if (existingListingId) {
    await wizard.getByLabel("Community release").selectOption(existingListingId);
    await expect(wizard.getByLabel("Community address")).toHaveValue(slug);
    await expect(wizard).toContainText("new immutable release for your existing listing");
    await wizard.getByLabel("Description").fill(description);
  } else {
    await wizard.getByLabel("Community address").fill(slug);
    await wizard.getByLabel("Description").fill(description);
  }
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  const rights = wizard.getByLabel(/I own or have permission to redistribute/);
  await rights.focus();
  await page.keyboard.press("Space");
  await expect(rights).toBeChecked();
  if (includesEnvironment) {
    const privacy = wizard.getByLabel(/I reviewed the Environment geometry/);
    await privacy.focus();
    await page.keyboard.press("Space");
    await expect(privacy).toBeChecked();
  }
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByText("SERVER-VERIFIED PACKAGE")).toBeVisible();
  if (expectedResolvedContent) {
    const definitions = wizard.locator('details[aria-label="Included effects and behavior"]');
    await definitions.locator("summary").click();
    await expect(definitions).toContainText(expectedResolvedContent);
    if (reviewScreenshotPath) await definitions.screenshot({ path: reviewScreenshotPath });
  }
  const packageAcknowledgment = wizard.getByLabel(/I reviewed the included content, credits, warnings/);
  await packageAcknowledgment.focus();
  await page.keyboard.press("Space");
  await expect(packageAcknowledgment).toBeChecked();
  const submit = wizard.getByRole("button", { name: "Submit to Community" });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  return wizard;
}

async function approveFromAdmin(browser: Browser, baseURL: string, listingId: string) {
  const moderator = await closureAccount("Synthetic SC-07A Moderator");
  await db.accountRoleAssignment.create({ data: { accountId: moderator.id, role: "MODERATION_OPERATOR" } });
  const session = await db.accountSession.findFirstOrThrow({ where: { accountId: moderator.id } });
  await db.privilegedAssurance.create({
    data: {
      accountId: moderator.id,
      accountSessionId: session.id,
      assuranceLevel: "ADMIN_REAUTHENTICATED",
      method: "OTHER_GOVERNED_METHOD",
      expiresAt: new Date(Date.now() + 5 * 60_000),
      correlationId: randomUUID(),
    },
  });
  const context = await browser.newContext();
  try {
    await authenticateClosure(context, moderator, baseURL);
    const page = await context.newPage();
    await page.goto(`/admin/community/${listingId}`);
    const panel = page.locator('section[aria-labelledby="spatial-publication-review-title"]');
    await expect(panel.getByRole("heading", { name: "Review exact spatial release" })).toBeVisible();
    await panel.getByText("Inspect the full sanitized package").click();
    await panel.getByLabel(/I reviewed the exact content, rights declaration/).check();
    await panel.getByRole("button", { name: "Approve and publish release" }).click();
    await expect(page.getByRole("link", { name: "Open Community listing" })).toBeVisible();
  } finally {
    await context.close();
  }
}

test("private asset reaches the canonical listing and installs as an immutable Library release", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Asset Creator");
  const suffix = randomUUID().slice(0, 8);
  const draft = createSpatialDraft(randomUUID());
  draft.library = { type: "ASSET", description: "Synthetic desk map" };
  draft.content.title = "Synthetic Desk Map";
  await test.step("1. Save privately without publication", async () => {
    expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
    expect((await saveDefinitionToLibrary(owner.id, draft.content.definitionId, 1)).revision).toBe(2);
    expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  });
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  await test.step("2. Open the contextual Studio publishing flow", async () => {
    const details = await libraryDetail(page, "Assets", draft.content.title);
    await details.getByRole("button", { name: /Publish to Community/ }).click();
    const wizard = page.getByRole("dialog", { name: "Publish to Community" });
    await expect(wizard).toContainText("SAVED SOURCE · REVISION 2");
    await expect(wizard.getByLabel("Saved source preview")).toContainText("Desk Map");
  });
  await test.step("12. Check mobile layout, keyboard focus and accessibility", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("asset-source-mobile.png"), fullPage: true });
    const wizard = page.getByRole("dialog", { name: "Publish to Community" });
    await expect(wizard).toBeVisible({ timeout: 5_000 });
    await wizard.getByRole("button", { name: "Close publishing" }).focus({ timeout: 5_000 });
    await page.keyboard.press("Tab");
    expect(await wizard.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await test.step("3–4. Review metadata, rights and exact package; submit through Harborlight", async () => {
    const wizard = await submitWizard(page, `synthetic-desk-${suffix}`, "A synthetic tabletop map for other Creators.");
    await expect(wizard).toContainText("Your saved source remains in Spatial Studio");
    expect(
      (await db.communityListing.findUniqueOrThrow({ where: { slug: `synthetic-desk-${suffix}` } })).publicationStatus,
    ).toBe("READY_FOR_REVIEW");
    await page.screenshot({ path: testInfo.outputPath("asset-submitted-desktop.png"), fullPage: true });
  });
  const listing = await db.communityListing.findUniqueOrThrow({
    where: { slug: `synthetic-desk-${suffix}` },
    include: { currentRelease: true },
  });
  const packageBefore = await db.communityPackage.findUniqueOrThrow({
    where: { releaseId: listing.currentReleaseId! },
  });
  await approveFromAdmin(browser, baseURL!, listing.id);
  await test.step("5. Open the approved Community listing", async () => {
    await page.goto(`/community/${listing.slug}`);
    await expect(page.getByRole("heading", { name: listing.title, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Install this exact release" })).toBeVisible();
    await expect(page.getByText("Your installation stays pinned to this immutable version.")).toBeVisible();
    await expect(page.getByText("Spatial asset · Moment").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("asset-listing-desktop.png"), fullPage: true });
  });
  await test.step("6. Install into a second Creator Library", async () => {
    const installer = await creator("Synthetic SC-07A Asset Installer");
    for (let index = 0; index < 49; index++) {
      const earlierAsset = createSpatialDraft(randomUUID());
      earlierAsset.library = { type: "ASSET", description: "Synthetic pagination fixture" };
      earlierAsset.content.title = `AA Fixture ${String(index).padStart(2, "0")}`;
      expect(await saveSpatialDraft(installer.id, earlierAsset, 0)).toBe(1);
      expect((await saveDefinitionToLibrary(installer.id, earlierAsset.content.definitionId, 1)).revision).toBe(2);
    }
    const installerContext = await browser.newContext();
    try {
      await authenticateClosure(installerContext, installer, baseURL!);
      const installPage = await installerContext.newPage();
      await installPage.setViewportSize({ width: 1440, height: 1000 });
      await installPage.goto(`/community/${listing.slug}`);
      await installPage.getByRole("button", { name: "Install to my Library" }).click();
      await expect(installPage.getByRole("link", { name: "Open in Spatial Studio" })).toBeVisible();
      await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
      await expect(installPage).toHaveURL(/library=saved%3A/);
      await expect(
        installPage.getByText(/Installed release selected in Library.*pinned copy is read-only/),
      ).toBeVisible();
      await expect(installPage.getByText("SEPARATE WORKING SCENE")).toBeVisible();
      const library = installPage.locator('section[aria-label="Spatial content library"]');
      await expect(library.getByRole("tab", { name: "Assets" })).toHaveAttribute("aria-selected", "true");
      await expect(library.getByRole("button", { name: `Inspect ${draft.content.title}` })).toHaveCount(0);
      const details = library.getByRole("complementary", { name: `${draft.content.title} details` });
      await expect(details).toBeVisible();
      await expect(details).toContainText("Installed Community content is read-only");
      await expect(details).toContainText("Spatial asset");
      await expect(details).toContainText("A synthetic tabletop map for other Creators.");
      await expect(details).not.toContainText("Saved Scene");
      await expect(details).not.toContainText("Creator-owned spatial Scene");
      await expect(details.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
      await expect(installPage.locator("header").getByText(draft.content.title, { exact: true })).toHaveCount(0);
      await details.screenshot({ path: testInfo.outputPath("asset-installed-details.png") });
      await installPage.screenshot({ path: testInfo.outputPath("asset-installed-desktop.png"), fullPage: true });
      await installPage.setViewportSize({ width: 390, height: 844 });
      const openLibrary = installPage.getByRole("button", { name: "Open Library" });
      if ((await openLibrary.getAttribute("aria-pressed")) !== "true") await openLibrary.click();
      await expect(details).toBeVisible();
      await installPage.screenshot({ path: testInfo.outputPath("asset-installed-mobile.png"), fullPage: true });
      await installPage.setViewportSize({ width: 1440, height: 1000 });
      const installedId = new URL(installPage.url()).searchParams.get("library")?.replace(/^saved:/, "");
      expect(installedId).toBeTruthy();
      await installPage.goto(`/studio/parallax?definition=${encodeURIComponent(installedId!)}`);
      await expect(installPage).toHaveURL(/library=saved%3A/);
      await expect(installPage.getByText("SEPARATE WORKING SCENE")).toBeVisible();
      await expect(installPage.locator("header").getByText(draft.content.title, { exact: true })).toHaveCount(0);
    } finally {
      await installerContext.close();
    }
  });
  await test.step("11. Editing the private source leaves the published package unchanged", async () => {
    const changed = structuredClone(draft);
    changed.content.entities[0].content = "A later private revision";
    expect(await saveSpatialDraft(owner.id, changed, 2)).toBe(3);
    expect((await db.communityPackage.findUniqueOrThrow({ where: { id: packageBefore.id } })).packageChecksum).toBe(
      packageBefore.packageChecksum,
    );
  });
});

test("Creator updates an approved listing through the same wizard without rewriting its first release", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Updating Creator");
  const draft = createSpatialDraft(randomUUID());
  draft.library = { type: "ASSET", description: "Synthetic reusable map" };
  draft.content.title = "Synthetic Updating Map";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, draft.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  const details = await libraryDetail(page, "Assets", draft.content.title);
  await details.getByRole("button", { name: /Publish to Community/ }).click();
  const slug = `updating-map-${randomUUID().slice(0, 8)}`;
  await submitWizard(page, slug, "The initial synthetic map release.");
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug }, include: { currentRelease: true } });
  const originalReleaseId = listing.currentReleaseId!;
  const originalPackage = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: originalReleaseId } });
  await approveFromAdmin(browser, baseURL!, listing.id);

  const revised = structuredClone(draft);
  revised.content.entities[0].content = "The updated synthetic map release.";
  expect(await saveSpatialDraft(owner.id, revised, 2)).toBe(3);
  expect((await db.communityPackage.findUniqueOrThrow({ where: { id: originalPackage.id } })).packageChecksum).toBe(
    originalPackage.packageChecksum,
  );

  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  const updatedDetails = await libraryDetail(page, "Assets", draft.content.title);
  await updatedDetails.getByRole("button", { name: /Publish to Community/ }).click();
  const updateWizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(updateWizard).toContainText("SAVED SOURCE · REVISION 3");
  await submitWizard(page, slug, "The updated synthetic map release.", false, listing.id);
  await expect(updateWizard).toContainText("Community review is next");
  await page.screenshot({ path: testInfo.outputPath("updated-release-pending-review.png"), fullPage: true });

  const pending = await db.communityListing.findUniqueOrThrow({
    where: { id: listing.id },
    include: { currentRelease: true },
  });
  expect(pending.publicationStatus).toBe("UPDATE_PENDING");
  expect(pending.currentReleaseId).not.toBe(originalReleaseId);
  expect(pending.currentRelease?.semanticVersion).toBe("2.0.0");
  expect((await db.communityPackage.findUniqueOrThrow({ where: { id: originalPackage.id } })).packageChecksum).toBe(
    originalPackage.packageChecksum,
  );
  await approveFromAdmin(browser, baseURL!, listing.id);
  const published = await db.communityListing.findUniqueOrThrow({
    where: { id: listing.id },
    include: { currentRelease: true },
  });
  expect(published.publicationStatus).toBe("PUBLISHED");
  expect(published.currentReleaseId).toBe(pending.currentReleaseId);
  expect(published.currentRelease?.semanticVersion).toBe("2.0.0");
  expect((await db.communityPackage.findUniqueOrThrow({ where: { id: originalPackage.id } })).packageChecksum).toBe(
    originalPackage.packageChecksum,
  );
  await page.goto(`/community/${slug}`);
  await expect(page.getByRole("heading", { name: listing.title, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install this exact release" })).toBeVisible();
  await expect(page.getByText("The updated synthetic map release.").first()).toBeVisible();
  const publicReleaseFact = page
    .locator(".community-detail__facts dt")
    .filter({ hasText: /^Release$/ })
    .locator("..")
    .locator("dd")
    .first();
  await expect(publicReleaseFact).toBeVisible();
  await expect(publicReleaseFact).toHaveText("2.0.0");
  await expect(page.getByText("Loading Community relationship state.")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("updated-release-listing.png"), fullPage: true });
});

test("rich Environment and pinned Scene use reviewed geometry without private Library metadata", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Scene Creator");
  const suffix = randomUUID().slice(0, 8);
  const id = randomUUID();
  const room = createEmptyEnvironment(id);
  room.name = "Imaginary harbor room";
  const document = createEnvironmentDraft(id, room);
  document.name = room.name;
  document.collection = "C:\\private\\room-photo.jpg";
  expect(await saveEnvironmentDraft(owner.id, document, 0)).toBe(1);
  const release = await releaseEnvironmentVersion(owner.id, id, 1);
  const row = await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: release.versionId } });
  const reference = environmentReleaseReference(row);
  const scene = createSpatialDraft(randomUUID());
  scene.category = "SCENE_TEMPLATE";
  scene.content.title = "Imaginary harbor Scene";
  scene.content.environment = reference;
  scene.content.studio!.environment = document.room!;
  expect(await saveSpatialDraft(owner.id, scene, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, scene.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(scene.content.definitionId)}`);
  await test.step("7 and 9. Review the pinned Scene dependency and exclude private source labels", async () => {
    const details = await libraryDetail(page, "Scenes", scene.content.title);
    await details.getByRole("button", { name: /Publish to Community/ }).click();
    const wizard = page.getByRole("dialog", { name: "Publish to Community" });
    await expect(wizard).toContainText("SAVED SOURCE · REVISION 2");
    await wizard.getByRole("button", { name: "Continue" }).click();
    await wizard.getByLabel("Community address").fill(`harbor-scene-${suffix}`);
    await wizard.getByLabel("Description").fill("A wholly imagined spatial Scene and room.");
    await wizard.getByRole("button", { name: "Continue" }).click();
    await wizard.getByRole("button", { name: "Continue" }).click();
    await wizard.getByLabel(/I own or have permission to redistribute/).check();
    await wizard.getByLabel(/I reviewed the Environment geometry/).check();
    await wizard.getByRole("button", { name: "Review package" }).click();
    await expect(wizard).toContainText("items/environment.json");
    await wizard.getByText("Inspect the sanitized package").click();
    await expect(wizard.locator("pre")).not.toContainText("room-photo.jpg");
    await page.screenshot({ path: testInfo.outputPath("scene-package-review.png"), fullPage: true });
    await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
    await wizard.getByRole("button", { name: "Submit to Community" }).click();
    await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  });
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `harbor-scene-${suffix}` } });
  expect(listing.itemType).toBe("SPATIAL_SCENE");
  const packageRow = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: listing.currentReleaseId! } });
  const packageItems = await db.communityPackageItem.findMany({ where: { packageId: packageRow.id } });
  expect(packageItems).toHaveLength(2);
  expect(JSON.stringify(packageItems)).not.toContain("room-photo.jpg");
});

test("owned synthetic Environment publishes from Library and installs as a read-only Environment", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Environment Creator");
  const suffix = randomUUID().slice(0, 8);
  const id = randomUUID();
  const room = createEmptyEnvironment(id);
  room.name = "Imaginary glasshouse";
  const document = createEnvironmentDraft(id, room);
  document.name = room.name;
  document.collection = "C:\\private\\glasshouse-photo.jpg";
  expect(await saveEnvironmentDraft(owner.id, document, 0)).toBe(1);
  const released = await releaseEnvironmentVersion(owner.id, id, 1);
  expect(released.revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/parallax");
  const details = await libraryDetail(page, "Environments", document.name);
  await details.getByLabel("Use version").selectOption(released.versionId);
  await details.getByRole("button", { name: /Publish to Community/ }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 2");
  await expect(wizard.getByLabel("Saved source preview")).toContainText("room features");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`imaginary-glasshouse-${suffix}`);
  await wizard.getByLabel("Description").fill("A fully imagined synthetic glasshouse.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByLabel(/I reviewed the Environment geometry/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByLabel("Community content preview")).toContainText("room features");
  await expect(wizard).toContainText("A home layout can remain sensitive even without photographs");
  await wizard.getByText("Inspect the sanitized package").click();
  await expect(wizard.locator("pre")).not.toContainText("glasshouse-photo.jpg");
  await page.screenshot({ path: testInfo.outputPath("environment-review-desktop.png"), fullPage: true });
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `imaginary-glasshouse-${suffix}` } });
  expect(listing.itemType).toBe("SPATIAL_ENVIRONMENT");
  await approveFromAdmin(browser, baseURL!, listing.id);
  const installer = await creator("Synthetic SC-07A Environment Installer");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.setViewportSize({ width: 1440, height: 1000 });
    await installPage.goto(`/community/${listing.slug}`);
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await expect(installPage.getByRole("link", { name: "Open in Spatial Studio" })).toBeVisible();
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    const installedDetails = await libraryDetail(installPage, "Environments", document.name);
    await expect(installedDetails).toContainText("Installed Community content is read-only");
    await expect(installedDetails.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
    await installedDetails.screenshot({ path: testInfo.outputPath("environment-installed-details.png") });
    await installPage.screenshot({ path: testInfo.outputPath("environment-installed-desktop.png"), fullPage: true });
  } finally {
    await installContext.close();
  }
});

test("procedural Effect publishes from Effects and installs in the second Creator's Effects Library", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Effect Creator");
  const baseline = createSpatialDraft(randomUUID());
  const effect = editSpatialDraft(insertSpatialElement(baseline, "mist", "mist-1"), {
    type: "DELETE",
    entityId: baseline.content.entities[0].id,
  });
  effect.category = "EFFECT";
  effect.content.title = "Imaginary blue mist";
  const animationTrack = {
    id: "mist-fade",
    entityId: effect.content.entities[0].id,
    enabled: true,
    property: "OPACITY" as const,
    interpolation: "LINEAR" as const,
    keyframes: [
      { id: "mist-hidden", atMs: 0, value: 0 },
      { id: "mist-visible", atMs: 1000, value: 1 },
    ],
  };
  effect.content.studio!.animationTracks = [animationTrack];
  expect(await saveSpatialDraft(owner.id, effect, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, effect.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/parallax");
  const details = await libraryDetail(page, "Effects", effect.content.title);
  await details.getByRole("button", { name: /Publish to Community/ }).click();
  const slug = `imaginary-mist-${randomUUID().slice(0, 8)}`;
  const wizard = await submitWizard(
    page,
    slug,
    "A reusable synthetic procedural mist effect.",
    false,
    undefined,
    "Animation: opacity",
    testInfo.outputPath("effect-package-review.png"),
  );
  await expect(wizard).toContainText("Community review is next");
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug } });
  expect(listing.itemType).toBe("SPATIAL_ASSET");
  const packageRow = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: listing.currentReleaseId! } });
  const packageItem = await db.communityPackageItem.findFirstOrThrow({ where: { packageId: packageRow.id } });
  expect(JSON.parse(packageItem.metadata)).toMatchObject({
    category: "EFFECT",
    content: { studio: { animationTracks: [animationTrack] } },
  });
  await approveFromAdmin(browser, baseURL!, listing.id);

  const installer = await creator("Synthetic SC-07A Effect Installer");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.goto(`/community/${slug}`);
    await expect(installPage.getByRole("heading", { name: effect.content.title, level: 1 })).toBeVisible();
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    const installedDetails = await libraryDetail(installPage, "Effects", effect.content.title);
    await expect(installedDetails).toContainText("Installed Community content is read-only");
    await expect(installedDetails.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
    expect(
      (await listSpatialItems(installer.id)).find((item) => item.draft.content.title === effect.content.title)?.draft
        .content.studio?.animationTracks,
    ).toEqual([animationTrack]);
    await installPage.screenshot({ path: testInfo.outputPath("effect-installed-desktop.png"), fullPage: true });
  } finally {
    await installContext.close();
  }
});

test("owned Composition publishes from Compositions and installs as a reusable read-only prefab", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Composition Creator");
  const parent = createSpatialDraft(randomUUID());
  expect(await saveSpatialDraft(owner.id, parent, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, parent.content.definitionId, 1)).revision).toBe(2);
  const composition = extractComposition(parent, parent.content.entities[0].id, randomUUID());
  composition.content.title = "Imaginary desk clue";
  expect(await saveSpatialDraft(owner.id, composition, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, composition.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/parallax");
  const details = await libraryDetail(page, "Compositions", composition.content.title);
  await details.getByRole("button", { name: /Publish to Community/ }).click();
  const slug = `imaginary-composition-${randomUUID().slice(0, 8)}`;
  const wizard = await submitWizard(page, slug, "An owned dependency-closed spatial prefab.");
  await expect(wizard).toContainText("Community review is next");
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug } });
  expect(listing.itemType).toBe("SPATIAL_ASSET");
  const packageRow = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: listing.currentReleaseId! } });
  const packageItem = await db.communityPackageItem.findFirstOrThrow({ where: { packageId: packageRow.id } });
  expect(JSON.parse(packageItem.metadata)).toMatchObject({ category: "SCENE_TEMPLATE", composition: true });
  await approveFromAdmin(browser, baseURL!, listing.id);

  const installer = await creator("Synthetic SC-07A Composition Installer");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.goto(`/community/${slug}`);
    await expect(installPage.getByRole("heading", { name: composition.content.title, level: 1 })).toBeVisible();
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    const installedDetails = await libraryDetail(installPage, "Compositions", composition.content.title);
    await expect(installedDetails).toContainText("Installed Community content is read-only");
    await expect(installedDetails.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
    await installPage.screenshot({ path: testInfo.outputPath("composition-installed-desktop.png"), fullPage: true });
  } finally {
    await installContext.close();
  }
});

test("unlicensed physical content has a visible refusal and remains private", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Rights Review");
  const draft = insertSpatialElement(createSpatialDraft(randomUUID()), "articulated-chest", randomUUID());
  draft.library = { type: "ASSET", description: "Private model study" };
  draft.content.title = "Private chest study";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, draft.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  const details = await libraryDetail(page, "Assets", draft.content.title);
  await expect(details.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
  await details.getByRole("button", { name: "Review publishing limits" }).click();
  const wizard = page.getByRole("dialog", { name: "Review Community publishing" });
  await expect(wizard).toContainText("owner redistribution authorization");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`private-chest-${randomUUID().slice(0, 8)}`);
  await wizard.getByLabel("Description").fill("A private synthetic item with an unlicensed model reference.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByRole("alert")).toContainText("owner redistribution authorization");
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).not.toBeVisible();
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await wizard.getByRole("alert").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rights-refusal-mobile.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Close publishing" }).click();
  await page.reload();
  expect((await db.reusableAuthoringItem.findUniqueOrThrow({ where: { id: draft.content.definitionId } })).status).toBe(
    "SAVED",
  );
});

test("a lost submission response reports uncertainty and exact retry recovers one release", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await creator("Synthetic SC-07A Retry Creator");
  const suffix = randomUUID().slice(0, 8);
  const draft = createSpatialDraft(randomUUID());
  draft.library = { type: "ASSET", description: "Synthetic retry source" };
  draft.content.title = "Recoverable desk map";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, draft.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  const details = await libraryDetail(page, "Assets", draft.content.title);
  await details.getByRole("button", { name: /Publish to Community/ }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`recoverable-desk-${suffix}`);
  await wizard.getByLabel("Description").fill("A synthetic package for response recovery.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  let dropped = false;
  await page.route("**/api/community/spatial-publication/publish", async (route) => {
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("alert")).toContainText("did not confirm this submission");
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).not.toBeVisible();
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `recoverable-desk-${suffix}` } });
  await page.screenshot({ path: testInfo.outputPath("unconfirmed-response.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Review package" }).click();
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  expect((await db.communityListing.findUniqueOrThrow({ where: { id: listing.id } })).currentReleaseId).toBe(
    listing.currentReleaseId,
  );
  expect(await db.communityRelease.count({ where: { listingId: listing.id } })).toBe(1);
});

test("a Creator reaches server package review from the ordinary Studio entry without publishing", async ({
  page,
}, testInfo) => {
  requireOwnedBrowser();
  test.skip(process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic", "Uses the isolated generic experience identity.");
  const accountId = "00000000-0000-4000-8000-00000000a105";
  await page.goto("/sign-in?returnTo=%2Fstudio%2Flibrary");
  await page
    .getByRole("textbox", { name: "Email or Player name" })
    .fill("parallax-review-community-creator@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("Synthetic-Parallax-Review-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
  await page.getByRole("link", { name: "Spatial Studio" }).click();
  await expect(page.getByRole("heading", { name: "Parallax" })).toBeVisible();
  await page.getByRole("button", { name: "Save to Library" }).click();
  await expect(page.getByRole("main")).toContainText("Saved to Library · one definition");
  expect(await db.communityListing.count({ where: { owner: { accountId } } })).toBe(0);
  const details = await libraryDetail(page, "Scenes", "Desk Map");
  await expect(details).toContainText("Private Library");
  await details.getByRole("button", { name: "Publish to Community…" }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("This is your private saved source");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("textbox", { name: "Description" }).fill("A synthetic tabletop Scene for other Creators.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard).toContainText("The server checks the saved revision");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard).toContainText("Visibility: Community after approval");
  await wizard.getByRole("checkbox", { name: /I own or have permission to redistribute/ }).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard).toContainText("SERVER-VERIFIED PACKAGE");
  await page.screenshot({ path: testInfo.outputPath("natural-studio-package-review.png"), fullPage: true });
  expect(await db.communityListing.count({ where: { owner: { accountId } } })).toBe(0);
  await wizard.getByRole("button", { name: "Close publishing" }).click();
  await page.getByRole("link", { name: "← Creator Studio" }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
});

test("a Creator without a public Profile gets a direct setup route and returns to the saved source", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await closureAccount("Synthetic SC-07A Profile Recovery Creator");
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const draft = createSpatialDraft(randomUUID());
  draft.library = { type: "ASSET", description: "Synthetic private profile prerequisite source" };
  draft.content.title = "Profile Recovery Map";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, draft.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  const details = await libraryDetail(page, "Assets", draft.content.title);
  await details.getByRole("button", { name: "Publish to Community…" }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("Community publishing needs a public Profile with a handle");
  await expect(wizard.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("profile-required-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const setupLink = wizard.getByRole("link", { name: "Set up public Profile" });
  await expect(setupLink).toBeVisible();
  const linkBounds = await setupLink.boundingBox();
  expect(linkBounds).not.toBeNull();
  expect(linkBounds!.y).toBeGreaterThanOrEqual(0);
  expect(linkBounds!.y + linkBounds!.height).toBeLessThan(730);
  await page.screenshot({ path: testInfo.outputPath("profile-required-mobile.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await wizard.getByRole("link", { name: "Set up public Profile" }).click();
  await expect(page.getByRole("heading", { name: "Public Profile", level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: /Handle/ }).fill(`sc07a-profile-${randomUUID().slice(0, 8)}`);
  await page.getByRole("combobox", { name: "Default visibility" }).selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/parallax\\?definition=${draft.content.definitionId}`));
  const returnedDetails = await libraryDetail(page, "Assets", draft.content.title);
  await returnedDetails.getByRole("button", { name: "Publish to Community…" }).click();
  const returnedWizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(returnedWizard.getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(returnedWizard).not.toContainText("Community publishing needs a public Profile with a handle");
  await page.screenshot({ path: testInfo.outputPath("profile-ready-return.png"), fullPage: true });
  expect((await db.reusableAuthoringItem.findUniqueOrThrow({ where: { id: draft.content.definitionId } })).status).toBe(
    "SAVED",
  );
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
});

test("a private-profile Environment returns to its selected immutable version after Profile setup", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireOwnedBrowser();
  const owner = await closureAccount("Synthetic SC-07A Environment Profile Creator");
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const id = randomUUID();
  const room = createEmptyEnvironment(id);
  room.name = "Profile Recovery Glasshouse";
  const document = createEnvironmentDraft(id, room);
  document.name = room.name;
  expect(await saveEnvironmentDraft(owner.id, document, 0)).toBe(1);
  const released = await releaseEnvironmentVersion(owner.id, id, 1);
  const asset = createSpatialDraft(randomUUID());
  asset.library = { type: "ASSET", description: "Synthetic return-navigation source" };
  asset.content.title = "Return Navigation Map";
  expect(await saveSpatialDraft(owner.id, asset, 0)).toBe(1);
  expect((await saveDefinitionToLibrary(owner.id, asset.content.definitionId, 1)).revision).toBe(2);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/parallax");
  const details = await libraryDetail(page, "Environments", document.name);
  await details.getByLabel("Use version").selectOption(released.versionId);
  await details.getByRole("button", { name: "Publish to Community…" }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("Community publishing needs a public Profile with a handle");
  await expect(wizard.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(wizard).toContainText("Immutable Environment version 1");
  await wizard.getByRole("link", { name: "Set up public Profile" }).click();
  await expect(page.getByRole("heading", { name: "Public Profile", level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: /Handle/ }).fill(`sc07a-environment-${randomUUID().slice(0, 8)}`);
  await page.getByRole("combobox", { name: "Default visibility" }).selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/studio/parallax" &&
      url.searchParams.get("library") === `environment:${id}` &&
      url.searchParams.get("libraryKind") === "ENVIRONMENTS" &&
      url.searchParams.get("libraryVersion") === released.versionId,
  );
  const returnedDetails = page
    .locator('section[aria-label="Spatial content library"]')
    .getByRole("complementary", { name: `${document.name} details` });
  await expect(returnedDetails).toBeVisible();
  await expect(returnedDetails.getByLabel("Use version")).toHaveValue(released.versionId);
  await returnedDetails.getByRole("button", { name: "Publish to Community…" }).click();
  const returnedWizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(returnedWizard.getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(returnedWizard).toContainText("Immutable Environment version 1");
  await page.screenshot({ path: testInfo.outputPath("environment-profile-return.png"), fullPage: true });
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  await returnedWizard.getByRole("button", { name: "Close publishing" }).click();
  const assetDetails = await libraryDetail(page, "Assets", asset.content.title);
  await assetDetails.getByRole("button", { name: "Open original" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/studio/parallax" &&
      url.searchParams.get("definition") === asset.content.definitionId &&
      !url.searchParams.has("libraryVersion"),
  );
});
